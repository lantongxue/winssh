import { randomUUID } from 'node:crypto'
import { posix } from 'node:path'
import { Worker } from 'node:worker_threads'
import { decodeSshDataFrame, encodeSshDataFrame } from '@shared/ssh-data-frame'
import { normalizeRemotePath } from '@shared/sftp'
import type {
  CommandHistoryEntry,
  CommandRecordedEvent,
  ConnectionRequest,
  HostTrustResult,
  PortForwardInput,
  PortForwardRule,
  RemoteEntry,
  Server,
  SessionConnectResult,
  SessionDataEvent,
  SessionErrorEvent,
  SessionExitEvent,
  SessionResourceSnapshot,
  SessionStateEvent,
  SessionSummary,
  SftpFileChunkEvent,
  SftpFileReadStreamStart,
  SftpFileStreamDirection,
  SftpFileStreamStateEvent,
  SftpFileWriteStreamStart,
  TransferProgressEvent,
  SftpListResult
} from '@shared/types'
import type { SshCoreOutbound } from '@shared/ssh-protocol'
import type { DatabaseService } from '../database'
import type { MainTranslator } from '../localization'
import { createOscScannerState, scanOscChunk, type OscScannerState } from '../osc-scanner'
import type { HostTrustService } from './host-trust-service'
import type { SshDataAggregator } from './ssh-data-aggregator'
import { ConnectionFailure, isAuthenticationFailure } from './ssh-connection-errors'
import { SshConnectionResolver } from './ssh-connection-resolver'
import { SshControlPort } from './ssh-control-port'
import { PortForwardDispatcher } from './port-forward-dispatcher'
import type { SessionRuntime } from './session-runtime'
import { isShellIntegrationInternal, stripShellIntegrationInstallEcho } from '../shell-integration'
import { createResourceMonitorSnapshot } from '../workers/resource-monitor'
import { encodeContent } from '../encoding'

type WorkerPort = Pick<Worker, 'on' | 'postMessage' | 'terminate'>

type EventMap = {
  'sessions:data': SessionDataEvent
  'sessions:error': SessionErrorEvent
  'sessions:exit': SessionExitEvent
  'sessions:state': SessionStateEvent
  'sftp:fileChunk': SftpFileChunkEvent
  'sftp:fileStreamState': SftpFileStreamStateEvent
  'sftp:transfer': TransferProgressEvent
  'sessions:cwdChanged': {
    sessionId: string
    cwd: string
    correlationId?: string
    source?: 'main'
    timestamp?: string
  }
  'commandHistory:added': CommandRecordedEvent
}

type WorkerEvent = Exclude<
  SshCoreOutbound,
  Extract<SshCoreOutbound, { type: 'ack' }> | Extract<SshCoreOutbound, { type: 'hostTrust' }>
>

interface ActiveWorkerSession {
  sessionId: string
  summary: SessionSummary
  worker: WorkerPort
  port: SshControlPort
  request: ConnectionRequest
  oscState: OscScannerState
  pendingCommand: {
    text: string | null
    startedAt: number | null
    cwd: string | null
  }
  historyCaptureEnabled: boolean
  integrationBuffer?: string
  integrationTimeoutTimer?: ReturnType<typeof setTimeout>
}

interface WorkerEditorFileWriteTask {
  streamId: string
  sessionId: string
  remotePath: string
  fileName: string
  encoding: string
  contents: string
  transferred: number
  state: 'open' | 'closing' | 'closed' | 'cancelled'
}

export interface WorkerSessionRuntimeOptions {
  database: Pick<
    DatabaseService,
    | 'getServerById'
    | 'getServerPassword'
    | 'getServerPassphrase'
    | 'getServerPrivateKey'
    | 'getSettings'
    | 'recordCommand'
    | 'recordRecentSession'
  >
  hostTrustService: Pick<HostTrustService, 'verifyHost' | 'resolveHostTrust'>
  legacyRuntime: SessionRuntime
  sendToRenderer: <T extends keyof EventMap>(channel: T, payload: EventMap[T]) => void
  dataAggregator?: Pick<SshDataAggregator, 'routeFrame'>
  spawnWorker?: (sessionId: string) => WorkerPort
  terminalDefaults?: { cols: number; rows: number }
  translate: MainTranslator
  requestTimeoutMs?: number
  useResourceMonitorWorker?: boolean
  createResourceSnapshot?: typeof createResourceMonitorSnapshot
}

const DEFAULT_TERMINAL_SIZE = { cols: 120, rows: 30 }

export class WorkerSessionRuntime implements SessionRuntime {
  private readonly sessions = new Map<string, ActiveWorkerSession>()
  private readonly history = new Map<string, ConnectionRequest>()
  private readonly connectionResolver: SshConnectionResolver
  private readonly terminalDefaults: { cols: number; rows: number }
  private readonly portForwardDispatcher: PortForwardDispatcher
  private readonly editorWriteStreams = new Map<string, WorkerEditorFileWriteTask>()
  private dataAggregator: Pick<SshDataAggregator, 'routeFrame'> | undefined

  constructor(private readonly options: WorkerSessionRuntimeOptions) {
    this.connectionResolver = new SshConnectionResolver(options.database, options.translate)
    this.terminalDefaults = options.terminalDefaults ?? DEFAULT_TERMINAL_SIZE
    this.dataAggregator = options.dataAggregator
    this.portForwardDispatcher = new PortForwardDispatcher({
      legacyRuntime: {
        listPortForwards: () => [],
        createPortForward: () =>
          Promise.reject(new Error('Worker runtime port forwarding is not available yet')),
        startPortForward: () =>
          Promise.reject(new Error('Worker runtime port forwarding is not available yet')),
        stopPortForward: () =>
          Promise.reject(new Error('Worker runtime port forwarding is not available yet')),
        removePortForward: () =>
          Promise.reject(new Error('Worker runtime port forwarding is not available yet'))
      },
      useWorker: false
    })
  }

  setDataAggregator(dataAggregator: Pick<SshDataAggregator, 'routeFrame'> | undefined): void {
    this.dataAggregator = dataAggregator
  }

  async connect(request: ConnectionRequest): Promise<SessionConnectResult> {
    try {
      const summary = await this.establishConnection(request)
      return { ok: true, summary }
    } catch (error) {
      const failure = this.normalizeConnectionFailure(error)
      return {
        ok: false,
        code: failure.code,
        message: failure.message,
        serverId: failure.serverId,
        secretKind: failure.secretKind
      }
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    const runtime = this.sessions.get(sessionId)
    if (!runtime) {
      return
    }

    this.clearShellIntegrationBuffer(runtime)
    this.releaseEditorFileStreams(sessionId)
    await runtime.port.request({
      type: 'disconnect',
      requestId: this.nextRequestId('disconnect', sessionId),
      sessionId,
      correlationId: sessionId
    })
    await runtime.worker.terminate()
    runtime.port.dispose()
    this.sessions.delete(sessionId)
    this.history.delete(sessionId)
    this.emitSessionState(
      sessionId,
      'disconnected',
      undefined,
      this.options.translate('session.closed')
    )
  }

  async reconnect(sessionId: string): Promise<SessionSummary> {
    const request = this.history.get(sessionId)
    if (!request) {
      throw new Error(this.options.translate('errors.reconnectUnavailable'))
    }

    await this.disconnect(sessionId)
    const result = await this.connect({ ...request, sessionId })
    if (!result.ok) {
      throw new Error(result.message)
    }

    return result.summary
  }

  getResourceSnapshot(sessionId: string): Promise<SessionResourceSnapshot> {
    if (this.options.useResourceMonitorWorker) {
      const createSnapshot = this.options.createResourceSnapshot ?? createResourceMonitorSnapshot
      return createSnapshot({ sessionId })
    }

    return this.options.legacyRuntime.getResourceSnapshot(sessionId)
  }

  write(sessionId: string, data: string): void {
    const runtime = this.requireSession(sessionId)
    const arrayBuffer = toArrayBuffer(Buffer.from(data))
    void runtime.port
      .request({
        type: 'write',
        requestId: this.nextRequestId('write', sessionId),
        sessionId,
        correlationId: sessionId,
        data: arrayBuffer
      })
      .catch((error) => this.emitSessionError(sessionId, error))
  }

  async resize(sessionId: string, columns: number, rows: number): Promise<void> {
    await this.requireSession(sessionId).port.request({
      type: 'resize',
      requestId: this.nextRequestId('resize', sessionId),
      sessionId,
      correlationId: sessionId,
      cols: columns,
      rows
    })
  }

  async listDirectory(sessionId: string, remotePath: string): Promise<SftpListResult> {
    return this.listDirectoryViaCoreWorker(sessionId, remotePath)
  }

  private async listDirectoryViaCoreWorker(
    sessionId: string,
    remotePath: string
  ): Promise<SftpListResult> {
    const response = await this.requireSession(sessionId).port.request({
      type: 'sftp:listDirectory',
      requestId: this.nextRequestId('sftp:listDirectory', sessionId),
      sessionId,
      correlationId: sessionId,
      remotePath
    })
    return coerceSftpListResult(response.result)
  }

  async createFile(sessionId: string, remotePath: string, name: string): Promise<void> {
    await this.requireSession(sessionId).port.request({
      type: 'sftp:createFile',
      requestId: this.nextRequestId('sftp:createFile', sessionId),
      sessionId,
      correlationId: sessionId,
      remotePath: posix.join(normalizeRemotePath(remotePath), name.trim())
    })
  }

  async openFileReadStream(
    sessionId: string,
    remotePath: string
  ): Promise<SftpFileReadStreamStart> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const streamId = `sftp-read:${sessionId}:${randomUUID()}`
    const fileName = posix.basename(normalized)

    try {
      const response = await runtime.port.request({
        type: 'sftp:readFile',
        requestId: this.nextRequestId('sftp:readFile', sessionId),
        sessionId,
        correlationId: sessionId,
        remotePath: normalized
      })
      const result = coerceReadFileResult(response.result)
      const total = encodeContent(result.content, result.encoding).byteLength

      if (result.content) {
        this.emitFileChunk({
          streamId,
          sessionId,
          remotePath: normalized,
          chunk: result.content,
          transferred: total,
          total
        })
      }
      this.emitFileStreamState(
        {
          kind: 'read',
          streamId,
          sessionId,
          remotePath: normalized,
          fileName,
          transferred: total,
          total
        },
        'completed'
      )

      return {
        streamId,
        sessionId,
        remotePath: normalized,
        fileName,
        total,
        encoding: result.encoding
      }
    } catch (error) {
      this.emitFileStreamState(
        {
          kind: 'read',
          streamId,
          sessionId,
          remotePath: normalized,
          fileName,
          transferred: 0,
          total: 0
        },
        'error',
        error instanceof Error ? error.message : String(error)
      )
      throw error
    }
  }

  openFileWriteStream(
    sessionId: string,
    remotePath: string,
    encoding: string
  ): Promise<SftpFileWriteStreamStart> {
    this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const streamId = `sftp-write:${sessionId}:${randomUUID()}`
    this.editorWriteStreams.set(streamId, {
      streamId,
      sessionId,
      remotePath: normalized,
      fileName: posix.basename(normalized),
      encoding,
      contents: '',
      transferred: 0,
      state: 'open'
    })
    return Promise.resolve({ streamId, sessionId, remotePath: normalized })
  }

  writeFileChunk(streamId: string, chunk: string): Promise<void> {
    const task = this.requireWriteFileStream(streamId)
    task.contents += chunk
    task.transferred += encodeContent(chunk, task.encoding).byteLength
    this.emitFileStreamState(
      {
        kind: 'write',
        streamId: task.streamId,
        sessionId: task.sessionId,
        remotePath: task.remotePath,
        fileName: task.fileName,
        transferred: task.transferred,
        total: task.transferred
      },
      'running'
    )
    return Promise.resolve()
  }

  async closeFileWriteStream(streamId: string): Promise<void> {
    const task = this.requireWriteFileStream(streamId)
    const runtime = this.requireSession(task.sessionId)
    task.state = 'closing'
    this.editorWriteStreams.delete(streamId)

    try {
      await runtime.port.request({
        type: 'sftp:writeFile',
        requestId: this.nextRequestId('sftp:writeFile', task.sessionId),
        sessionId: task.sessionId,
        correlationId: task.sessionId,
        remotePath: task.remotePath,
        contents: task.contents,
        encoding: task.encoding
      })
      task.state = 'closed'
      this.emitFileStreamState(
        {
          kind: 'write',
          streamId: task.streamId,
          sessionId: task.sessionId,
          remotePath: task.remotePath,
          fileName: task.fileName,
          transferred: task.transferred,
          total: task.transferred
        },
        'completed'
      )
    } catch (error) {
      this.emitFileStreamState(
        {
          kind: 'write',
          streamId: task.streamId,
          sessionId: task.sessionId,
          remotePath: task.remotePath,
          fileName: task.fileName,
          transferred: task.transferred,
          total: task.transferred
        },
        'error',
        error instanceof Error ? error.message : String(error)
      )
      throw error
    }
  }

  cancelFileStream(streamId: string): void {
    const task = this.editorWriteStreams.get(streamId)
    if (!task) {
      return
    }

    task.state = 'cancelled'
    this.editorWriteStreams.delete(streamId)
    this.emitFileStreamState(
      {
        kind: 'write',
        streamId: task.streamId,
        sessionId: task.sessionId,
        remotePath: task.remotePath,
        fileName: task.fileName,
        transferred: task.transferred,
        total: task.transferred
      },
      'cancelled'
    )
  }

  async makeDirectory(sessionId: string, remotePath: string, name: string): Promise<void> {
    await this.requireSession(sessionId).port.request({
      type: 'sftp:makeDirectory',
      requestId: this.nextRequestId('sftp:makeDirectory', sessionId),
      sessionId,
      correlationId: sessionId,
      remotePath: posix.join(normalizeRemotePath(remotePath), name.trim())
    })
  }

  async rename(sessionId: string, remotePath: string, newName: string): Promise<void> {
    const normalized = normalizeRemotePath(remotePath)
    await this.requireSession(sessionId).port.request({
      type: 'sftp:rename',
      requestId: this.nextRequestId('sftp:rename', sessionId),
      sessionId,
      correlationId: sessionId,
      sourcePath: normalized,
      targetPath: posix.join(posix.dirname(normalized), newName.trim())
    })
  }

  async move(sessionId: string, sourcePath: string, destinationDirPath: string): Promise<void> {
    const normalizedSource = normalizeRemotePath(sourcePath)
    await this.requireSession(sessionId).port.request({
      type: 'sftp:rename',
      requestId: this.nextRequestId('sftp:rename', sessionId),
      sessionId,
      correlationId: sessionId,
      sourcePath: normalizedSource,
      targetPath: posix.join(
        normalizeRemotePath(destinationDirPath),
        posix.basename(normalizedSource)
      )
    })
  }

  async remove(sessionId: string, remotePath: string): Promise<void> {
    await this.requireSession(sessionId).port.request({
      type: 'sftp:remove',
      requestId: this.nextRequestId('sftp:remove', sessionId),
      sessionId,
      correlationId: sessionId,
      remotePath: normalizeRemotePath(remotePath)
    })
  }

  uploadFiles(_sessionId: string, _targetPath: string): Promise<void> {
    return Promise.reject(new Error('Worker runtime upload is not available yet'))
  }

  uploadPaths(_sessionId: string, _targetPath: string, _localPaths: string[]): Promise<void> {
    return Promise.reject(new Error('Worker runtime upload is not available yet'))
  }

  downloadFile(_sessionId: string, _remotePath: string): Promise<void> {
    return Promise.reject(new Error('Worker runtime download is not available yet'))
  }

  cancelTransfer(_batchId: string): void {}

  cancelAllTransfers(): void {}

  listPortForwards(sessionId: string): PortForwardRule[] {
    const rules = this.portForwardDispatcher.list(sessionId)
    if (rules instanceof Promise) {
      throw new Error('Worker port forwarding list returned asynchronously')
    }
    return rules
  }

  createPortForward(sessionId: string, input: PortForwardInput): Promise<PortForwardRule> {
    return this.portForwardDispatcher.create(sessionId, input)
  }

  startPortForward(sessionId: string, ruleId: string): Promise<PortForwardRule> {
    return this.portForwardDispatcher.start(sessionId, ruleId)
  }

  stopPortForward(sessionId: string, ruleId: string): Promise<PortForwardRule> {
    return this.portForwardDispatcher.stop(sessionId, ruleId)
  }

  removePortForward(sessionId: string, ruleId: string): Promise<void> {
    return this.portForwardDispatcher.remove(sessionId, ruleId)
  }

  resolveHostTrust(result: HostTrustResult): void {
    this.options.hostTrustService.resolveHostTrust(result)
  }

  dispose(): void {
    for (const runtime of this.sessions.values()) {
      this.clearShellIntegrationBuffer(runtime)
      this.releaseEditorFileStreams(runtime.sessionId)
      runtime.port.dispose()
      void runtime.worker.terminate()
    }
    this.sessions.clear()
    this.history.clear()
    this.options.legacyRuntime.dispose()
  }

  handleWorkerCrash(sessionId: string, exitCode: number): void {
    const message = this.options.translate('session.workerCrashed')
    this.emitToRenderer(
      'sessions:error',
      this.withObservableMetadata(sessionId, {
        sessionId,
        message,
        code: 'worker_crashed',
        recoverable: true
      })
    )
    this.emitSessionState(sessionId, 'error', undefined, message, 'worker_crashed', true)
    const runtime = this.sessions.get(sessionId)
    if (runtime) {
      this.clearShellIntegrationBuffer(runtime)
      runtime.port.dispose()
    }
    this.sessions.delete(sessionId)
    this.history.delete(sessionId)
    void exitCode
  }

  private async establishConnection(request: ConnectionRequest): Promise<SessionSummary> {
    const server = this.options.database.getServerById(request.serverId)
    if (!server) {
      throw new ConnectionFailure(
        'connection_failed',
        this.options.translate('errors.serverNotFound')
      )
    }

    const sessionId = request.sessionId ?? randomUUID()
    const connectedAt = now()
    const summary: SessionSummary = {
      sessionId,
      serverId: server.id,
      serverName: server.name,
      host: server.host,
      port: server.port,
      status: 'connecting',
      connectedAt,
      currentPath: '/'
    }

    this.emitConnectionPhase(sessionId, 'validate')
    const jumpServer = this.connectionResolver.resolveJumpServer(server)
    const [targetAuth, jumpAuth] = await Promise.all([
      this.connectionResolver.resolveAuth(server, request),
      jumpServer ? this.connectionResolver.resolveAuth(jumpServer, request) : Promise.resolve(null)
    ])
    const commandHistoryEnabled =
      Boolean(server.captureCommandHistory) &&
      this.options.database.getSettings().commandHistoryEnabled

    this.emitConnectionPhase(sessionId, 'handshake')
    const worker = this.spawnWorker(sessionId)
    const port = new SshControlPort(worker, {
      requestTimeoutMs: this.options.requestTimeoutMs,
      verifyHost: (input) => this.options.hostTrustService.verifyHost(input),
      onEvent: (event) => this.handleWorkerMessage(event)
    })
    const runtime: ActiveWorkerSession = {
      sessionId,
      summary,
      worker,
      port,
      request,
      oscState: createOscScannerState(),
      pendingCommand: { text: null, startedAt: null, cwd: null },
      historyCaptureEnabled: commandHistoryEnabled
    }

    this.sessions.set(sessionId, runtime)
    worker.on('exit', (exitCode) => {
      if (exitCode !== 0) {
        this.handleWorkerCrash(sessionId, exitCode)
      }
    })

    try {
      await port.request({
        type: 'connect',
        requestId: this.nextRequestId('connect', sessionId),
        correlationId: sessionId,
        config: {
          sessionId,
          target: toResolvedServer(server, targetAuth),
          ...(jumpServer && jumpAuth ? { jump: toResolvedServer(jumpServer, jumpAuth) } : {}),
          commandHistory: commandHistoryEnabled,
          terminal: this.terminalDefaults
        }
      })
    } catch (error) {
      this.clearShellIntegrationBuffer(runtime)
      this.sessions.delete(sessionId)
      port.dispose()
      void worker.terminate()
      throw error
    }

    summary.status = 'ready'
    this.history.set(sessionId, { ...request, sessionId })
    this.options.database.recordRecentSession(server.id)
    this.emitSessionState(
      sessionId,
      'ready',
      undefined,
      this.options.translate('session.connected')
    )
    return summary
  }

  private spawnWorker(sessionId: string): WorkerPort {
    if (this.options.spawnWorker) {
      return this.options.spawnWorker(sessionId)
    }

    return new Worker(new URL('../workers/ssh-core/index.js', import.meta.url))
  }

  handleWorkerMessage(event: WorkerEvent): void {
    if (event.type === 'state') {
      this.emitSessionState(event.sessionId, 'connecting', event.phase)
      return
    }

    if (event.type === 'data') {
      this.handleWorkerData(event)
      return
    }

    if (event.type === 'shellIntegrationInstall') {
      const runtime = this.sessions.get(event.sessionId)
      if (runtime) {
        runtime.integrationBuffer = ''
        if (runtime.integrationTimeoutTimer) {
          clearTimeout(runtime.integrationTimeoutTimer)
        }
        runtime.integrationTimeoutTimer = setTimeout(() => {
          if (runtime.integrationBuffer !== undefined) {
            const data = runtime.integrationBuffer
            runtime.integrationBuffer = undefined
            if (data) {
              const cleanedData = this.scanWorkerData(runtime, data)
              if (cleanedData) {
                this.emitCleanWorkerData(runtime.sessionId, cleanedData)
              }
            }
          }
          runtime.integrationTimeoutTimer = undefined
        }, 1000)
      }
      return
    }

    if (event.type === 'cwd') {
      const runtime = this.sessions.get(event.sessionId)
      if (runtime) {
        runtime.summary.currentPath = event.cwd
      }
      this.emitToRenderer(
        'sessions:cwdChanged',
        this.withObservableMetadata(event.sessionId, { sessionId: event.sessionId, cwd: event.cwd })
      )
      return
    }

    if (event.type === 'error') {
      this.emitSessionError(event.sessionId, new Error(event.message), event.code)
      return
    }

    if (event.type === 'exit') {
      const runtime = this.sessions.get(event.sessionId)
      if (runtime) {
        this.clearShellIntegrationBuffer(runtime)
      }
      this.emitToRenderer(
        'sessions:exit',
        this.withObservableMetadata(event.sessionId, {
          sessionId: event.sessionId,
          code: event.code,
          signal: event.signal
        })
      )
      this.emitSessionState(
        event.sessionId,
        'disconnected',
        undefined,
        this.options.translate('session.disconnected')
      )
    }
  }

  private clearShellIntegrationBuffer(runtime: ActiveWorkerSession): void {
    if (runtime.integrationTimeoutTimer) {
      clearTimeout(runtime.integrationTimeoutTimer)
      runtime.integrationTimeoutTimer = undefined
    }
    runtime.integrationBuffer = undefined
  }

  private handleWorkerData(event: Extract<WorkerEvent, { type: 'data' }>): void {
    const runtime = this.sessions.get(event.sessionId)
    const frame = decodeSshDataFrame(event.frame)
    const rawData = Buffer.from(frame.payload).toString('utf8')
    const cleanedData = runtime ? this.filterWorkerData(runtime, rawData) : rawData

    if (!cleanedData) {
      return
    }

    this.emitCleanWorkerData(event.sessionId, cleanedData, frame.sentAtMs, event.seq)
  }

  private emitCleanWorkerData(
    sessionId: string,
    cleanedData: string,
    sentAtMs = Date.now(),
    seq = 0
  ): void {
    const cleanPayload = Buffer.from(cleanedData, 'utf8')
    const cleanFrame = encodeSshDataFrame({
      seq,
      sentAtMs,
      payload: cleanPayload
    })

    if (this.dataAggregator) {
      this.dataAggregator.routeFrame({
        sessionId,
        frame: cleanFrame,
        seq,
        sentAtMs
      })
      return
    }

    this.emitToRenderer(
      'sessions:data',
      this.withObservableMetadata(sessionId, {
        sessionId,
        data: cleanedData
      })
    )
  }

  private filterWorkerData(runtime: ActiveWorkerSession, data: string): string {
    if (runtime.integrationBuffer !== undefined) {
      runtime.integrationBuffer += data
      const stripped = stripShellIntegrationInstallEcho(runtime.integrationBuffer)

      if (stripped.matched) {
        if (runtime.integrationTimeoutTimer) {
          clearTimeout(runtime.integrationTimeoutTimer)
          runtime.integrationTimeoutTimer = undefined
        }
        runtime.integrationBuffer = undefined
        return this.scanWorkerData(runtime, stripped.cleaned)
      }

      return ''
    }

    return this.scanWorkerData(runtime, data)
  }

  private scanWorkerData(runtime: ActiveWorkerSession, data: string): string {
    return scanOscChunk(runtime.oscState, data, {
      onCommandText: (command) => {
        if (!runtime.historyCaptureEnabled) {
          return
        }
        if (isShellIntegrationInternal(command)) {
          return
        }
        runtime.pendingCommand = {
          text: command,
          startedAt: runtime.pendingCommand.startedAt,
          cwd: runtime.summary.currentPath || null
        }
      },
      onCommandPre: () => {
        if (!runtime.historyCaptureEnabled) {
          return
        }
        if (runtime.pendingCommand.startedAt === null) {
          runtime.pendingCommand.startedAt = Date.now()
        }
        if (!runtime.pendingCommand.cwd) {
          runtime.pendingCommand.cwd = runtime.summary.currentPath || null
        }
      },
      onCommandDone: (exitCode) => {
        if (!runtime.historyCaptureEnabled) {
          return
        }
        this.handleWorkerCommandDone(runtime, exitCode)
      },
      onCwd: (cwd) => {
        const normalized = normalizeRemotePath(cwd)
        if (runtime.summary.currentPath === normalized) {
          return
        }
        runtime.summary.currentPath = normalized
        this.emitToRenderer(
          'sessions:cwdChanged',
          this.withObservableMetadata(runtime.sessionId, {
            sessionId: runtime.sessionId,
            cwd: normalized
          })
        )
      }
    })
  }

  private handleWorkerCommandDone(runtime: ActiveWorkerSession, exitCode: number | null): void {
    const pending = runtime.pendingCommand
    runtime.pendingCommand = { text: null, startedAt: null, cwd: null }
    if (!pending.text) {
      return
    }

    const executedAt = pending.startedAt
      ? new Date(pending.startedAt).toISOString()
      : new Date().toISOString()
    const durationMs =
      pending.startedAt !== null ? Math.max(0, Date.now() - pending.startedAt) : null

    let entry: CommandHistoryEntry | null = null
    try {
      entry = this.options.database.recordCommand({
        scope: { kind: 'ssh', serverId: runtime.summary.serverId },
        command: pending.text,
        executedAt,
        cwd: pending.cwd,
        exitCode,
        durationMs
      })
    } catch {
      return
    }

    if (!entry) {
      return
    }

    this.emitToRenderer(
      'commandHistory:added',
      this.withObservableMetadata(runtime.sessionId, {
        scope: { kind: 'ssh', serverId: runtime.summary.serverId },
        entry
      })
    )
  }

  private normalizeConnectionFailure(error: unknown): ConnectionFailure {
    if (error instanceof ConnectionFailure) {
      return error
    }

    if (isAuthenticationFailure(error)) {
      return new ConnectionFailure('auth_failed', this.options.translate('errors.authFailed'))
    }

    const message =
      error instanceof Error ? error.message : this.options.translate('errors.connectionFailed')
    return new ConnectionFailure('connection_failed', message)
  }

  private requireSession(sessionId: string): ActiveWorkerSession {
    const runtime = this.sessions.get(sessionId)
    if (!runtime) {
      throw new Error(this.options.translate('errors.sessionUnavailable'))
    }

    return runtime
  }

  private requireWriteFileStream(streamId: string): WorkerEditorFileWriteTask {
    const task = this.editorWriteStreams.get(streamId)
    if (!task || task.state !== 'open') {
      throw new Error(`SFTP file stream unavailable: ${streamId}`)
    }

    return task
  }

  private releaseEditorFileStreams(sessionId: string): void {
    for (const task of this.editorWriteStreams.values()) {
      if (task.sessionId !== sessionId) {
        continue
      }

      task.state = 'cancelled'
      this.editorWriteStreams.delete(task.streamId)
      this.emitFileStreamState(
        {
          kind: 'write',
          streamId: task.streamId,
          sessionId: task.sessionId,
          remotePath: task.remotePath,
          fileName: task.fileName,
          transferred: task.transferred,
          total: task.transferred
        },
        'cancelled'
      )
    }
  }

  private emitFileChunk(event: Omit<SftpFileChunkEvent, 'correlationId' | 'source' | 'timestamp'>) {
    this.emitToRenderer('sftp:fileChunk', this.withObservableMetadata(event.sessionId, event))
  }

  private emitFileStreamState(
    task: {
      kind: 'read' | 'write'
      streamId: string
      sessionId: string
      remotePath: string
      fileName: string
      transferred: number
      total: number
    },
    status: SftpFileStreamStateEvent['status'],
    error?: string
  ): void {
    const direction: SftpFileStreamDirection = task.kind === 'read' ? 'download' : 'upload'
    const payload = {
      streamId: task.streamId,
      sessionId: task.sessionId,
      remotePath: task.remotePath,
      direction,
      status,
      transferred: task.transferred,
      total: task.total,
      ...(error ? { error } : {})
    }

    this.emitToRenderer(
      'sftp:fileStreamState',
      this.withObservableMetadata(task.sessionId, payload)
    )
    this.emitToRenderer(
      'sftp:transfer',
      this.withObservableMetadata(task.sessionId, {
        sessionId: task.sessionId,
        direction,
        fileName: task.fileName,
        localPath: '__editor__',
        remotePath: task.remotePath,
        transferred: task.transferred,
        total: task.total,
        status,
        ...(error ? { error } : {})
      })
    )
  }

  private emitConnectionPhase(sessionId: string, phase: SessionStateEvent['phase']): void {
    this.emitSessionState(sessionId, 'connecting', phase)
  }

  private emitSessionError(sessionId: string, error: unknown, code = 'connection_failed'): void {
    this.emitToRenderer(
      'sessions:error',
      this.withObservableMetadata(sessionId, {
        sessionId,
        message: error instanceof Error ? error.message : String(error),
        code,
        recoverable: true
      })
    )
  }

  private emitSessionState(
    sessionId: string,
    status: SessionStateEvent['status'],
    phase?: SessionStateEvent['phase'],
    message?: string,
    code?: string,
    recoverable?: boolean
  ): void {
    this.emitToRenderer(
      'sessions:state',
      this.withObservableMetadata(sessionId, {
        sessionId,
        status,
        phase,
        message,
        code,
        recoverable
      })
    )
  }

  private emitToRenderer<T extends keyof EventMap>(channel: T, payload: EventMap[T]): void {
    this.options.sendToRenderer(channel, payload)
  }

  private withObservableMetadata<TPayload extends object>(
    correlationId: string,
    payload: TPayload
  ) {
    return {
      ...payload,
      correlationId,
      source: 'main' as const,
      timestamp: now()
    }
  }

  private nextRequestId(type: string, sessionId: string): string {
    return `${type}:${sessionId}:${Date.now()}:${randomUUID()}`
  }
}

function toResolvedServer(
  server: Server,
  auth: { password?: string; passphrase?: string; privateKey?: string }
) {
  return {
    id: server.id,
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    authType: server.authType,
    auth
  }
}

function coerceSftpListResult(result: unknown): SftpListResult {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('path' in result) ||
    !('entries' in result) ||
    typeof result.path !== 'string' ||
    !Array.isArray(result.entries)
  ) {
    throw new Error('Invalid SFTP list result from worker')
  }

  return {
    path: result.path,
    entries: result.entries as RemoteEntry[]
  }
}

function coerceReadFileResult(result: unknown): { content: string; encoding: string } {
  if (
    typeof result !== 'object' ||
    result === null ||
    !('content' in result) ||
    !('encoding' in result) ||
    typeof result.content !== 'string' ||
    typeof result.encoding !== 'string'
  ) {
    throw new Error('Invalid SFTP read result from worker')
  }

  return {
    content: result.content,
    encoding: result.encoding
  }
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(buffer.byteLength)
  new Uint8Array(arrayBuffer).set(buffer)
  return arrayBuffer
}

function now(): string {
  return new Date().toISOString()
}
