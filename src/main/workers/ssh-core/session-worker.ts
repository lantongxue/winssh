import { Client, type ClientChannel, type ConnectConfig, type SFTPWrapper } from 'ssh2'
import type { RemoteEntry } from '@shared/types'
import { encodeSshDataFrame } from '@shared/ssh-data-frame'
import type { SshConnectConfig, SshResolvedServer } from '@shared/ssh-protocol'
import { normalizeRemotePath, sortRemoteEntries } from '@shared/sftp'
import { encodeContent, smartDecode } from '../../encoding'
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

export class SshCoreSessionWorker {
  private readonly createClient: CreateClient
  private readonly postMessage: PostMessagePort['postMessage']
  private session: ActiveSession | null = null
  private hostTrustCounter = 0
  private readonly pendingHostTrust = new Map<string, PendingHostTrust>()

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

  async readFile(
    sessionId: string,
    remotePath: string
  ): Promise<{ content: string; encoding: string }> {
    const buffer = await this.sftpReadFile(this.requireSession(sessionId).sftp, remotePath)
    return smartDecode(buffer)
  }

  async writeFile(
    sessionId: string,
    remotePath: string,
    contents: string,
    encoding?: string
  ): Promise<void> {
    await this.sftpWriteFile(
      this.requireSession(sessionId).sftp,
      remotePath,
      encodeContent(contents, encoding)
    )
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

  private sftpReadFile(sftp: SFTPWrapper, remotePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      sftp.readFile(remotePath, {}, (error, data) => {
        if (error) {
          reject(error)
          return
        }
        resolve(Buffer.isBuffer(data) ? data : Buffer.from(data))
      })
    })
  }

  private sftpWriteFile(sftp: SFTPWrapper, remotePath: string, data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      sftp.writeFile(remotePath, data, (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
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
