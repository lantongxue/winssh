import { randomUUID } from 'node:crypto'
import { posix } from 'node:path'
import { Worker } from 'node:worker_threads'
import { decodeSshDataFrame } from '@shared/ssh-data-frame'
import { normalizeRemotePath } from '@shared/sftp'
import type {
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
  SftpListResult
} from '@shared/types'
import type { SshCoreOutbound } from '@shared/ssh-protocol'
import type { DatabaseService } from '../database'
import type { MainTranslator } from '../localization'
import type { HostTrustService } from './host-trust-service'
import type { SshDataAggregator } from './ssh-data-aggregator'
import {
  ConnectionFailure,
  isAuthenticationFailure
} from './ssh-connection-errors'
import { SshConnectionResolver } from './ssh-connection-resolver'
import { SshControlPort } from './ssh-control-port'
import type { SessionRuntime } from './session-runtime'

type WorkerPort = Pick<Worker, 'on' | 'postMessage' | 'terminate'>

type EventMap = {
  'sessions:data': SessionDataEvent
  'sessions:error': SessionErrorEvent
  'sessions:exit': SessionExitEvent
  'sessions:state': SessionStateEvent
  'sessions:cwdChanged': { sessionId: string; cwd: string; correlationId?: string; source?: 'main'; timestamp?: string }
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
}

export interface WorkerSessionRuntimeOptions {
  database: Pick<
    DatabaseService,
    | 'getServerById'
    | 'getServerPassword'
    | 'getServerPassphrase'
    | 'getServerPrivateKey'
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
}

const DEFAULT_TERMINAL_SIZE = { cols: 120, rows: 30 }

export class WorkerSessionRuntime implements SessionRuntime {
  private readonly sessions = new Map<string, ActiveWorkerSession>()
  private readonly history = new Map<string, ConnectionRequest>()
  private readonly connectionResolver: SshConnectionResolver
  private readonly terminalDefaults: { cols: number; rows: number }
  private dataAggregator: Pick<SshDataAggregator, 'routeFrame'> | undefined

  constructor(private readonly options: WorkerSessionRuntimeOptions) {
    this.connectionResolver = new SshConnectionResolver(options.database, options.translate)
    this.terminalDefaults = options.terminalDefaults ?? DEFAULT_TERMINAL_SIZE
    this.dataAggregator = options.dataAggregator
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
    this.emitSessionState(sessionId, 'disconnected', undefined, this.options.translate('session.closed'))
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

  getResourceSnapshot(_sessionId: string): Promise<SessionResourceSnapshot> {
    return this.options.legacyRuntime.getResourceSnapshot(_sessionId)
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

  async readFile(
    sessionId: string,
    remotePath: string
  ): Promise<{ content: string; encoding: string; cancelled?: boolean }> {
    const response = await this.requireSession(sessionId).port.request({
      type: 'sftp:readFile',
      requestId: this.nextRequestId('sftp:readFile', sessionId),
      sessionId,
      correlationId: sessionId,
      remotePath
    })
    return coerceReadFileResult(response.result)
  }

  cancelReadFile(_sessionId: string, _remotePath: string): void {}

  async writeFile(
    sessionId: string,
    remotePath: string,
    contents: string,
    encoding?: string
  ): Promise<void> {
    await this.requireSession(sessionId).port.request({
      type: 'sftp:writeFile',
      requestId: this.nextRequestId('sftp:writeFile', sessionId),
      sessionId,
      correlationId: sessionId,
      remotePath,
      contents,
      encoding
    })
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
      targetPath: posix.join(normalizeRemotePath(destinationDirPath), posix.basename(normalizedSource))
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

  listPortForwards(_sessionId: string): PortForwardRule[] {
    return []
  }

  createPortForward(_sessionId: string, _input: PortForwardInput): Promise<PortForwardRule> {
    return Promise.reject(new Error('Worker runtime port forwarding is not available yet'))
  }

  startPortForward(_sessionId: string, _ruleId: string): Promise<PortForwardRule> {
    return Promise.reject(new Error('Worker runtime port forwarding is not available yet'))
  }

  stopPortForward(_sessionId: string, _ruleId: string): Promise<PortForwardRule> {
    return Promise.reject(new Error('Worker runtime port forwarding is not available yet'))
  }

  removePortForward(_sessionId: string, _ruleId: string): Promise<void> {
    return Promise.reject(new Error('Worker runtime port forwarding is not available yet'))
  }

  resolveHostTrust(result: HostTrustResult): void {
    this.options.hostTrustService.resolveHostTrust(result)
  }

  dispose(): void {
    for (const runtime of this.sessions.values()) {
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
    runtime?.port.dispose()
    this.sessions.delete(sessionId)
    this.history.delete(sessionId)
    void exitCode
  }

  private async establishConnection(request: ConnectionRequest): Promise<SessionSummary> {
    const server = this.options.database.getServerById(request.serverId)
    if (!server) {
      throw new ConnectionFailure('connection_failed', this.options.translate('errors.serverNotFound'))
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

    this.emitConnectionPhase(sessionId, 'handshake')
    const worker = this.spawnWorker(sessionId)
    const port = new SshControlPort(worker, {
      requestTimeoutMs: this.options.requestTimeoutMs,
      verifyHost: (input) => this.options.hostTrustService.verifyHost(input),
      onEvent: (event) => this.handleWorkerMessage(event)
    })
    const runtime: ActiveWorkerSession = { sessionId, summary, worker, port, request }

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
          terminal: this.terminalDefaults
        }
      })
    } catch (error) {
      this.sessions.delete(sessionId)
      port.dispose()
      void worker.terminate()
      throw error
    }

    summary.status = 'ready'
    this.history.set(sessionId, { ...request, sessionId })
    this.options.database.recordRecentSession(server.id)
    this.emitSessionState(sessionId, 'ready', undefined, this.options.translate('session.connected'))
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
      if (this.dataAggregator) {
        const decoded = decodeSshDataFrame(event.frame)
        this.dataAggregator.routeFrame({
          sessionId: event.sessionId,
          frame: event.frame,
          seq: event.seq,
          sentAtMs: decoded.sentAtMs
        })
      } else {
        const frame = decodeSshDataFrame(event.frame)
        this.emitToRenderer(
          'sessions:data',
          this.withObservableMetadata(event.sessionId, {
            sessionId: event.sessionId,
            data: Buffer.from(frame.payload).toString('utf8')
          })
        )
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
      this.emitToRenderer(
        'sessions:exit',
        this.withObservableMetadata(event.sessionId, {
          sessionId: event.sessionId,
          code: event.code,
          signal: event.signal
        })
      )
      this.emitSessionState(event.sessionId, 'disconnected', undefined, this.options.translate('session.disconnected'))
    }
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
