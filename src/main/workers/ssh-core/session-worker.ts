import { randomUUID } from 'node:crypto'
import { posix } from 'node:path'
import {
  Client,
  type ClientChannel,
  type ConnectConfig,
  type OpenMode,
  type SFTPWrapper,
  type Stats
} from 'ssh2'
import type {
  RemoteEntry,
  SftpFileReadStreamStart,
  SftpFileStreamDirection,
  SftpFileStreamStateEvent,
  SftpFileWriteStreamStart
} from '@shared/types'
import { encodeSshDataFrame } from '@shared/ssh-data-frame'
import type { SshConnectConfig, SshResolvedServer } from '@shared/ssh-protocol'
import { normalizeRemotePath, sortRemoteEntries } from '@shared/sftp'
import {
  createIncrementalTextDecoder,
  encodeContent,
  shouldContinueIncrementalEncodingProbe
} from '../../encoding'
import { formatRemoteEntryPermissions } from '../../session-manager'
import { createShellIntegrationScript } from '../../shell-integration'

interface PostMessagePort {
  postMessage(message: unknown, transferList?: Array<ArrayBuffer>): void
}

type CreateClient = () => Client

export interface SshCoreSessionWorkerOptions {
  createClient?: CreateClient
  postMessage: PostMessagePort['postMessage']
}

interface ActiveSession {
  sessionId: string
  correlationId: string
  target: SshResolvedServer
  client: Client
  upstreamClients: Client[]
  shell: ClientChannel
  sftp: SFTPWrapper
  seq: number
}

interface PendingHostTrust {
  verify: (trusted: boolean) => void
}

interface EditorFileReadTask {
  kind: 'read'
  streamId: string
  sessionId: string
  remotePath: string
  fileName: string
  total: number
  transferred: number
  controller: AbortController
  sftp: SFTPWrapper
  handle?: Buffer
}

interface EditorFileWriteTask {
  kind: 'write'
  streamId: string
  sessionId: string
  remotePath: string
  fileName: string
  encoding: string
  transferred: number
  state: 'open' | 'closing' | 'closed' | 'cancelled' | 'error'
  failure?: Error
  queue: Promise<void>
  sftp: SFTPWrapper
  handle?: Buffer
}

interface PendingReadStreamStart {
  task: EditorFileReadTask
  decoder: ReturnType<typeof createIncrementalTextDecoder>
  initialSample: Buffer
  firstBytesRead: number
}

class SftpReadCancelledError extends Error {}

export class SshCoreSessionWorker {
  private readonly createClient: CreateClient
  private readonly postMessage: PostMessagePort['postMessage']
  private session: ActiveSession | null = null
  private hostTrustCounter = 0
  private readonly pendingHostTrust = new Map<string, PendingHostTrust>()
  private readonly editorFileStreams = new Map<string, EditorFileReadTask | EditorFileWriteTask>()
  private readonly pendingReadStreamStarts = new Map<string, PendingReadStreamStart>()

  constructor(options: SshCoreSessionWorkerOptions) {
    this.createClient = options.createClient ?? (() => new Client())
    this.postMessage = options.postMessage
  }

  async connect(config: SshConnectConfig): Promise<void> {
    this.emitState(config.sessionId, 'handshake')

    const upstreamClients: Client[] = []
    let client: Client | null = null

    try {
      let sock: ClientChannel | undefined

      if (config.jump) {
        const jumpClient = await this.connectClient(config.sessionId, config.jump)
        upstreamClients.push(jumpClient)
        sock = await this.forwardOut(jumpClient, config.target.host, config.target.port)
      }

      client = await this.connectClient(config.sessionId, config.target, sock)
      const [shell, sftp] = await Promise.all([
        this.openShell(client, config.terminal.cols, config.terminal.rows),
        this.openSftp(client)
      ])
      const currentPath = normalizeRemotePath(await this.realpath(sftp, '.').catch(() => '/'))

      this.session = {
        sessionId: config.sessionId,
        correlationId: config.sessionId,
        target: config.target,
        client,
        upstreamClients,
        shell,
        sftp,
        seq: 0
      }

      shell.on('data', (chunk: Buffer | string) => this.emitData(config.sessionId, chunk))
      shell.stderr.on('data', (chunk: Buffer | string) => this.emitData(config.sessionId, chunk))
      shell.on('close', (code?: number, signal?: string) => {
        this.postMessage({
          type: 'exit',
          sessionId: config.sessionId,
          correlationId: config.sessionId,
          code: code ?? 0,
          signal
        })
        client?.end()
      })
      client.on('error', (error) => {
        this.emitError(config.sessionId, error instanceof Error ? error.message : String(error))
      })

      this.emitState(config.sessionId, 'prepare')
      this.postMessage({
        type: 'cwd',
        sessionId: config.sessionId,
        correlationId: config.sessionId,
        cwd: currentPath
      })
      await this.installShellIntegration(config.sessionId, client, shell, {
        commandHistory: config.commandHistory === true
      })
      this.emitState(config.sessionId, 'attach')
    } catch (error) {
      client?.end()
      for (const upstreamClient of upstreamClients) {
        upstreamClient.end()
      }
      throw error
    }
  }

  write(sessionId: string, data: Buffer): void {
    this.requireSession(sessionId).shell.write(data)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.requireSession(sessionId).shell.setWindow(rows, cols, 0, 0)
  }

  disconnect(sessionId: string): void {
    const session = this.requireSession(sessionId)
    void this.releaseSessionEditorFileStreams(sessionId)
    session.shell.close()
    session.client.end()
    for (const upstreamClient of session.upstreamClients) {
      upstreamClient.end()
    }
    this.session = null
  }

  resolveHostTrust(requestId: string, trusted: boolean): void {
    const pending = this.pendingHostTrust.get(requestId)
    if (!pending) {
      return
    }

    this.pendingHostTrust.delete(requestId)
    pending.verify(trusted)
  }

  async openFileReadStream(
    sessionId: string,
    remotePath: string
  ): Promise<SftpFileReadStreamStart> {
    const session = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const stats = await this.sftpStat(session.sftp, normalized)

    if (stats.isDirectory()) {
      throw new Error(`Remote path is a directory: ${normalized}`)
    }

    const total = stats.size ?? 0
    const streamId = `sftp-read:${sessionId}:${randomUUID()}`
    const fileName = posix.basename(normalized)
    const controller = new AbortController()
    const handle = await this.sftpOpen(session.sftp, normalized, 'r')
    const task: EditorFileReadTask = {
      kind: 'read',
      streamId,
      sessionId,
      remotePath: normalized,
      fileName,
      total,
      transferred: 0,
      controller,
      sftp: session.sftp,
      handle
    }

    let initialSample: Buffer = Buffer.alloc(0)
    let firstBytesRead = 0
    let reachedEof = total === 0
    try {
      const sample = await this.readInitialFileStreamSample(session.sftp, handle, total)
      initialSample = sample.initialSample
      firstBytesRead = sample.firstBytesRead
      reachedEof = sample.reachedEof
    } catch (error) {
      await this.closeReadFileTaskHandle(task)
      throw error
    }

    const decoder = createIncrementalTextDecoder(initialSample, { finalSample: reachedEof })
    this.editorFileStreams.set(streamId, task)
    this.pendingReadStreamStarts.set(streamId, {
      task,
      decoder,
      initialSample,
      firstBytesRead
    })

    return {
      streamId,
      sessionId,
      remotePath: normalized,
      fileName,
      total,
      encoding: decoder.encoding
    }
  }

  startFileReadStream(streamId: string): void {
    const pending = this.pendingReadStreamStarts.get(streamId)
    if (!pending || this.editorFileStreams.get(streamId) !== pending.task) {
      return
    }

    this.pendingReadStreamStarts.delete(streamId)
    void this.runFileReadStream(
      pending.task,
      pending.decoder,
      pending.initialSample,
      pending.firstBytesRead
    )
  }

  async openFileWriteStream(
    sessionId: string,
    remotePath: string,
    encoding: string
  ): Promise<SftpFileWriteStreamStart> {
    const session = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const handle = await this.sftpOpen(session.sftp, normalized, 'w')
    const streamId = `sftp-write:${sessionId}:${randomUUID()}`
    this.editorFileStreams.set(streamId, {
      kind: 'write',
      streamId,
      sessionId,
      remotePath: normalized,
      fileName: posix.basename(normalized),
      encoding,
      transferred: 0,
      state: 'open',
      queue: Promise.resolve(),
      sftp: session.sftp,
      handle
    })

    return { streamId, sessionId, remotePath: normalized }
  }

  async writeFileChunk(streamId: string, chunk: string): Promise<void> {
    const task = this.requireWriteFileStream(streamId)
    const buffer = encodeContent(chunk, task.encoding)
    const writeOperation = task.queue.then(async () => {
      if (this.isWriteFileTaskUnavailable(task)) {
        throw this.createWriteFileStreamUnavailableError(task)
      }

      const handle = task.handle
      if (!handle) {
        throw this.createWriteFileStreamUnavailableError(task)
      }

      try {
        await this.sftpWrite(task.sftp, handle, buffer, 0, buffer.byteLength, task.transferred)
      } catch (error) {
        throw await this.failWriteFileTask(task, error)
      }

      if (this.isWriteFileTaskUnavailable(task)) {
        throw this.createWriteFileStreamUnavailableError(task)
      }

      task.transferred += buffer.byteLength
      this.emitFileStreamState(task, 'running')
    })
    task.queue = writeOperation.catch(() => undefined)
    return writeOperation
  }

  async closeFileWriteStream(streamId: string): Promise<void> {
    const task = this.requireWriteFileStream(streamId)
    task.state = 'closing'
    this.editorFileStreams.delete(streamId)
    await task.queue
    if (task.failure) {
      throw this.createWriteFileStreamUnavailableError(task)
    }

    try {
      await this.commitWriteFileTaskHandle(task)
    } catch (error) {
      const failure = error instanceof Error ? error : new Error(String(error))
      task.state = 'error'
      task.failure = failure
      this.emitFileStreamState(task, 'error', failure.message)
      throw failure
    }

    task.state = 'closed'
    this.emitFileStreamState(task, 'completed')
  }

  async cancelFileStream(streamId: string): Promise<void> {
    const task = this.editorFileStreams.get(streamId)
    if (!task) {
      return
    }

    this.editorFileStreams.delete(streamId)
    if (task.kind === 'read') {
      this.pendingReadStreamStarts.delete(streamId)
      task.controller.abort()
      await this.closeReadFileTaskHandle(task)
      return
    }

    if (task.state !== 'cancelled' && task.state !== 'closed') {
      task.state = 'cancelled'
      await this.closeWriteFileTaskHandle(task)
      this.emitFileStreamState(task, 'cancelled')
    }
  }

  async listDirectory(
    sessionId: string,
    remotePath: string
  ): Promise<{ path: string; entries: RemoteEntry[] }> {
    const normalized = normalizeRemotePath(remotePath)
    const entries = await this.sftpReadDir(this.requireSession(sessionId).sftp, normalized)
    return { path: normalized, entries }
  }

  async createFile(sessionId: string, remotePath: string): Promise<void> {
    const sftp = this.requireSession(sessionId).sftp
    const handle = await new Promise<Buffer>((resolve, reject) => {
      sftp.open(remotePath, 'w', (error, nextHandle) => {
        if (error) {
          reject(error)
          return
        }
        resolve(nextHandle)
      })
    })
    await new Promise<void>((resolve, reject) => {
      sftp.close(handle, (error) => (error ? reject(error) : resolve()))
    })
  }

  async makeDirectory(sessionId: string, remotePath: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.requireSession(sessionId).sftp.mkdir(remotePath, (error) =>
        error ? reject(error) : resolve()
      )
    })
  }

  async rename(sessionId: string, fromPath: string, toPath: string): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.requireSession(sessionId).sftp.rename(fromPath, toPath, (error) =>
        error ? reject(error) : resolve()
      )
    })
  }

  async remove(sessionId: string, remotePath: string): Promise<void> {
    const sftp = this.requireSession(sessionId).sftp
    await new Promise<void>((resolve, reject) => {
      sftp.unlink(remotePath, (error) => (error ? reject(error) : resolve()))
    })
  }

  private async runFileReadStream(
    task: EditorFileReadTask,
    decoder: ReturnType<typeof createIncrementalTextDecoder>,
    initialSample: Buffer,
    firstBytesRead: number
  ): Promise<void> {
    try {
      if (task.controller.signal.aborted) {
        throw new SftpReadCancelledError()
      }

      if (firstBytesRead > 0) {
        task.transferred = firstBytesRead
        this.emitFileChunk(task, decoder.write(initialSample))
        this.emitFileStreamState(task, 'running')
      }

      let position = firstBytesRead

      while (true) {
        if (task.controller.signal.aborted) {
          throw new SftpReadCancelledError()
        }

        const buffer = Buffer.allocUnsafe(32768)
        const bytesRead = await this.sftpRead(
          task.sftp,
          task.handle!,
          buffer,
          0,
          buffer.byteLength,
          position
        )

        if (task.controller.signal.aborted) {
          throw new SftpReadCancelledError()
        }

        if (bytesRead <= 0) {
          break
        }

        position += bytesRead
        task.transferred = position
        this.emitFileChunk(task, decoder.write(buffer.subarray(0, bytesRead)))
        this.emitFileStreamState(task, 'running')

        if (bytesRead < buffer.byteLength) {
          break
        }
      }

      this.emitFileChunk(task, decoder.end())
      await this.closeReadFileTaskHandle(task)
      this.editorFileStreams.delete(task.streamId)
      this.emitFileStreamState(task, 'completed')
    } catch (error) {
      await this.closeReadFileTaskHandle(task)
      this.editorFileStreams.delete(task.streamId)

      if (error instanceof SftpReadCancelledError || task.controller.signal.aborted) {
        this.emitFileStreamState(task, 'cancelled')
        return
      }

      this.emitFileStreamState(
        task,
        'error',
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  private async releaseSessionEditorFileStreams(sessionId: string): Promise<void> {
    const tasks = [...this.editorFileStreams.values()].filter(
      (task) => task.sessionId === sessionId
    )
    await Promise.all(tasks.map((task) => this.cancelFileStream(task.streamId)))
  }

  private requireWriteFileStream(streamId: string): EditorFileWriteTask {
    const task = this.editorFileStreams.get(streamId)
    if (!task || task.kind !== 'write' || task.state !== 'open') {
      throw new Error(`SFTP file stream unavailable: ${streamId}`)
    }

    return task
  }

  private isWriteFileTaskUnavailable(task: EditorFileWriteTask): boolean {
    return task.state === 'cancelled' || task.state === 'closed' || task.state === 'error'
  }

  private createWriteFileStreamUnavailableError(task: EditorFileWriteTask): Error {
    return task.failure ?? new Error(`SFTP file stream unavailable: ${task.streamId}`)
  }

  private async failWriteFileTask(task: EditorFileWriteTask, error: unknown): Promise<Error> {
    const failure = error instanceof Error ? error : new Error(String(error))
    if (task.state === 'error') {
      return task.failure ?? failure
    }

    task.state = 'error'
    task.failure = failure
    this.editorFileStreams.delete(task.streamId)
    await this.closeWriteFileTaskHandle(task)
    this.emitFileStreamState(task, 'error', failure.message)
    return failure
  }

  private async closeReadFileTaskHandle(task: EditorFileReadTask): Promise<void> {
    const handle = task.handle
    if (!handle) {
      return
    }

    task.handle = undefined
    await this.sftpClose(task.sftp, handle).catch(() => undefined)
  }

  private async closeWriteFileTaskHandle(task: EditorFileWriteTask): Promise<void> {
    const handle = task.handle
    if (!handle) {
      return
    }

    task.handle = undefined
    await this.sftpClose(task.sftp, handle).catch(() => undefined)
  }

  private async commitWriteFileTaskHandle(task: EditorFileWriteTask): Promise<void> {
    const handle = task.handle
    if (!handle) {
      return
    }

    task.handle = undefined
    await this.sftpClose(task.sftp, handle)
  }

  private emitFileChunk(task: EditorFileReadTask, chunk: string): void {
    if (!chunk) {
      return
    }

    this.postMessage({
      type: 'sftp:fileChunk',
      streamId: task.streamId,
      sessionId: task.sessionId,
      correlationId: task.sessionId,
      remotePath: task.remotePath,
      chunk,
      transferred: task.transferred,
      total: task.total
    })
  }

  private emitFileStreamState(
    task: EditorFileReadTask | EditorFileWriteTask,
    status: SftpFileStreamStateEvent['status'],
    error?: string
  ): void {
    const direction: SftpFileStreamDirection = task.kind === 'read' ? 'download' : 'upload'
    const total = task.kind === 'read' ? task.total : task.transferred

    this.postMessage({
      type: 'sftp:fileStreamState',
      streamId: task.streamId,
      sessionId: task.sessionId,
      correlationId: task.sessionId,
      remotePath: task.remotePath,
      direction,
      status,
      transferred: task.transferred,
      total,
      ...(error ? { error } : {})
    })
  }

  private connectClient(
    sessionId: string,
    server: SshResolvedServer,
    sock?: ClientChannel
  ): Promise<Client> {
    const client = this.createClient()

    return new Promise<Client>((resolve, reject) => {
      let settled = false
      const fail = (error: unknown) => {
        if (settled) {
          return
        }
        settled = true
        reject(error)
      }

      client.once('ready', () => {
        if (settled) {
          return
        }
        settled = true
        resolve(client)
      })
      client.once('error', fail)

      try {
        client.connect(this.createConnectConfig(sessionId, server, sock))
      } catch (error) {
        fail(error)
      }
    })
  }

  private createConnectConfig(
    sessionId: string,
    server: SshResolvedServer,
    sock?: ClientChannel
  ): ConnectConfig {
    return {
      host: server.host,
      port: server.port,
      username: server.username,
      readyTimeout: 15_000,
      keepaliveInterval: 10_000,
      keepaliveCountMax: 3,
      password: server.auth.password,
      privateKey: server.auth.privateKey,
      passphrase: server.auth.passphrase,
      ...(sock ? { sock } : {}),
      hostVerifier: (key, verify) => {
        const requestId = this.nextHostTrustRequestId()
        this.pendingHostTrust.set(requestId, { verify })
        const keyBuffer = Buffer.from(key)
        const frame = keyBuffer.buffer.slice(
          keyBuffer.byteOffset,
          keyBuffer.byteOffset + keyBuffer.byteLength
        )

        this.postMessage(
          {
            type: 'hostTrust',
            requestId,
            sessionId,
            correlationId: sessionId,
            serverName: server.name,
            host: server.host,
            port: server.port,
            key: frame
          },
          [frame]
        )
      }
    }
  }

  private openShell(client: Client, cols: number, rows: number): Promise<ClientChannel> {
    return new Promise((resolve, reject) => {
      client.shell({ term: 'xterm-256color', cols, rows }, (error, stream) => {
        if (error) {
          reject(error)
          return
        }
        resolve(stream)
      })
    })
  }

  private openSftp(client: Client): Promise<SFTPWrapper> {
    return new Promise((resolve, reject) => {
      client.sftp((error, sftp) => {
        if (error) {
          reject(error)
          return
        }
        resolve(sftp)
      })
    })
  }

  private forwardOut(client: Client, host: string, port: number): Promise<ClientChannel> {
    return new Promise((resolve, reject) => {
      client.forwardOut('127.0.0.1', 0, host, port, (error, stream) => {
        if (error) {
          reject(error)
          return
        }
        resolve(stream)
      })
    })
  }

  private realpath(sftp: SFTPWrapper, remotePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      sftp.realpath(remotePath, (error, absolutePath) => {
        if (error) {
          reject(error)
          return
        }
        resolve(absolutePath)
      })
    })
  }

  private async installShellIntegration(
    sessionId: string,
    client: Client,
    shell: ClientChannel,
    options: { commandHistory: boolean }
  ): Promise<void> {
    const detectedShell = await this.detectInteractiveShell(client)
    if (detectedShell !== 'bash' && detectedShell !== 'zsh') {
      return
    }

    this.postMessage({
      type: 'shellIntegrationInstall',
      sessionId,
      correlationId: sessionId
    })
    shell.write(createShellIntegrationScript({ commandHistory: options.commandHistory }))
  }

  private async detectInteractiveShell(client: Client): Promise<'bash' | 'zsh' | 'unknown'> {
    const result = await this.execCommand(
      client,
      'printf "%s\\n" "${BASH_VERSION:+bash}" "${ZSH_VERSION:+zsh}" "$SHELL" 2>/dev/null'
    ).catch(() => null)

    if (!result || result.code !== 0) {
      return 'unknown'
    }

    const stdout = result.stdout.toLowerCase()
    if (/\bbash\b/.test(stdout)) {
      return 'bash'
    }
    if (/\bzsh\b/.test(stdout)) {
      return 'zsh'
    }
    return 'unknown'
  }

  private execCommand(
    client: Client,
    command: string
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    return new Promise((resolve, reject) => {
      client.exec(command, (error, channel) => {
        if (error) {
          reject(error)
          return
        }

        let stdout = ''
        let stderr = ''
        channel.on('data', (chunk: Buffer | string) => {
          stdout += chunk.toString()
        })
        channel.stderr.on('data', (chunk: Buffer | string) => {
          stderr += chunk.toString()
        })
        channel.on('close', (code: number | null) => {
          resolve({ stdout, stderr, code })
        })
      })
    })
  }

  private sftpOpen(sftp: SFTPWrapper, remotePath: string, flags: OpenMode): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      sftp.open(remotePath, flags, (error, handle) => {
        if (error) {
          reject(error)
          return
        }
        resolve(handle)
      })
    })
  }

  private sftpClose(sftp: SFTPWrapper, handle: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      sftp.close(handle, (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }

  private sftpRead(
    sftp: SFTPWrapper,
    handle: Buffer,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      sftp.read(handle, buffer, offset, length, position, (error, bytesRead) => {
        if (error) {
          reject(error)
          return
        }
        resolve(bytesRead)
      })
    })
  }

  private async readInitialFileStreamSample(
    sftp: SFTPWrapper,
    handle: Buffer,
    total: number
  ): Promise<{ initialSample: Buffer; firstBytesRead: number; reachedEof: boolean }> {
    const chunks: Buffer[] = []
    let position = 0
    let reachedEof = total === 0

    while (!reachedEof) {
      const remaining = total > 0 ? total - position : 32768
      if (total > 0 && remaining <= 0) {
        reachedEof = true
        break
      }

      const buffer = Buffer.allocUnsafe(Math.min(32768, remaining > 0 ? remaining : 32768))
      const bytesRead = await this.sftpRead(sftp, handle, buffer, 0, buffer.byteLength, position)

      if (bytesRead <= 0) {
        reachedEof = true
        break
      }

      chunks.push(buffer.subarray(0, bytesRead))
      position += bytesRead
      reachedEof = bytesRead < buffer.byteLength || (total > 0 && position >= total)

      const sample = Buffer.concat(chunks)
      if (!shouldContinueIncrementalEncodingProbe(sample, reachedEof)) {
        break
      }
    }

    return {
      initialSample: Buffer.concat(chunks),
      firstBytesRead: position,
      reachedEof
    }
  }

  private sftpWrite(
    sftp: SFTPWrapper,
    handle: Buffer,
    buffer: Buffer,
    offset: number,
    length: number,
    position: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      sftp.write(handle, buffer, offset, length, position, (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }

  private sftpStat(sftp: SFTPWrapper, remotePath: string): Promise<Stats> {
    return new Promise((resolve, reject) => {
      sftp.stat(remotePath, (error, stats) => {
        if (error) {
          reject(error)
          return
        }
        resolve(stats)
      })
    })
  }

  private sftpReadDir(sftp: SFTPWrapper, remotePath: string): Promise<RemoteEntry[]> {
    return new Promise((resolve, reject) => {
      sftp.readdir(remotePath, (error, entries) => {
        if (error) {
          reject(error)
          return
        }

        const mapped = (entries ?? []).map((entry) => {
          const fullPath = normalizeRemotePath(`${remotePath.replace(/\/$/, '')}/${entry.filename}`)
          const attrs = entry.attrs
          const kind = attrs.isDirectory()
            ? 'directory'
            : attrs.isSymbolicLink()
              ? 'symlink'
              : 'file'

          return {
            name: entry.filename,
            path: fullPath,
            kind,
            size: attrs.size ?? 0,
            modifiedAt: attrs.mtime ? new Date(attrs.mtime * 1000).toISOString() : null,
            permissions:
              typeof attrs.mode === 'number' ? formatRemoteEntryPermissions(attrs.mode, kind) : null
          } as RemoteEntry
        })

        resolve(sortRemoteEntries(mapped))
      })
    })
  }

  private emitData(sessionId: string, chunk: Buffer | string): void {
    const session = this.requireSession(sessionId)
    session.seq += 1
    const payload = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    const frame = encodeSshDataFrame({
      seq: session.seq,
      sentAtMs: Date.now(),
      payload
    })
    this.postMessage(
      {
        type: 'data',
        sessionId,
        correlationId: session.correlationId,
        frame,
        seq: session.seq
      },
      [frame]
    )
  }

  private emitState(sessionId: string, phase: 'handshake' | 'prepare' | 'attach'): void {
    this.postMessage({
      type: 'state',
      sessionId,
      correlationId: sessionId,
      phase
    })
  }

  private emitError(sessionId: string, message: string): void {
    this.postMessage({
      type: 'error',
      sessionId,
      correlationId: sessionId,
      message,
      code: 'connection_failed'
    })
  }

  private requireSession(sessionId: string): ActiveSession {
    if (!this.session || this.session.sessionId !== sessionId) {
      throw new Error(`SSH worker session not found: ${sessionId}`)
    }

    return this.session
  }

  private nextHostTrustRequestId(): string {
    this.hostTrustCounter += 1
    return `host-${this.hostTrustCounter}`
  }
}
