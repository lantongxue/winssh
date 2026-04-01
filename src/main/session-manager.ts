import { createHash, randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path, { basename, posix } from 'node:path'
import { Client, type ClientChannel, type ConnectConfig, type SFTPWrapper, type Stats } from 'ssh2'
import {
  dialog,
  type BrowserWindow,
  type MessageBoxOptions,
  type OpenDialogOptions
} from 'electron'
import { normalizeRemotePath, sortRemoteEntries } from '@shared/sftp'
import type {
  ConnectionRequest,
  RemoteEntry,
  SessionDataEvent,
  SessionErrorEvent,
  SessionExitEvent,
  SessionStateEvent,
  SessionSummary,
  TransferProgressEvent
} from '@shared/types'
import type { DatabaseService } from './database'
import type { MainTranslator } from './localization'
import type { SecureStoreService } from './secure-store'

type WindowProvider = () => BrowserWindow | null

type EventMap = {
  'sessions:data': SessionDataEvent
  'sessions:error': SessionErrorEvent
  'sessions:exit': SessionExitEvent
  'sessions:state': SessionStateEvent
  'sftp:transfer': TransferProgressEvent
}

interface SessionRuntime {
  sessionId: string
  client: Client
  shell: ClientChannel
  sftp: SFTPWrapper
  summary: SessionSummary
  connectRequest: ConnectionRequest
  lastError?: string
  lastExit?: SessionExitEvent
  finalizing?: boolean
}

function toFingerprint(key: Buffer): string {
  return `SHA256:${createHash('sha256').update(key).digest('base64')}`
}

function sftpRealpath(sftp: SFTPWrapper, remotePath: string): Promise<string> {
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

function sftpReadDir(sftp: SFTPWrapper, remotePath: string): Promise<RemoteEntry[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (error, entries) => {
      if (error) {
        reject(error)
        return
      }

      const mapped = (entries ?? []).map((entry) => {
        const fullPath = normalizeRemotePath(posix.join(remotePath, entry.filename))
        const attrs = entry.attrs
        const kind = attrs.isDirectory() ? 'directory' : attrs.isSymbolicLink() ? 'symlink' : 'file'

        return {
          name: entry.filename,
          path: fullPath,
          kind,
          size: attrs.size ?? 0,
          modifiedAt: attrs.mtime ? new Date(attrs.mtime * 1000).toISOString() : null,
          permissions: typeof attrs.mode === 'number' ? (attrs.mode & 0o777).toString(8) : null
        } as RemoteEntry
      })

      resolve(sortRemoteEntries(mapped))
    })
  })
}

function sftpMkdir(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.mkdir(remotePath, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function sftpRename(sftp: SFTPWrapper, fromPath: string, toPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rename(fromPath, toPath, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function sftpStat(sftp: SFTPWrapper, remotePath: string): Promise<Stats> {
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

function sftpUnlink(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.unlink(remotePath, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function sftpRmdir(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rmdir(remotePath, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function openShell(client: Client): Promise<ClientChannel> {
  return new Promise((resolve, reject) => {
    client.shell({ term: 'xterm-256color', rows: 30, cols: 120 }, (error, stream) => {
      if (error) {
        reject(error)
        return
      }

      resolve(stream)
    })
  })
}

function openSftp(client: Client): Promise<SFTPWrapper> {
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

export class SessionManager {
  private readonly sessions = new Map<string, SessionRuntime>()
  private readonly history = new Map<string, ConnectionRequest>()

  constructor(
    private readonly database: DatabaseService,
    private readonly secureStore: SecureStoreService,
    private readonly getWindow: WindowProvider,
    private readonly emitToRenderer: <T extends keyof EventMap>(
      channel: T,
      payload: EventMap[T]
    ) => void,
    private readonly t: MainTranslator
  ) {}

  async connect(request: ConnectionRequest): Promise<SessionSummary> {
    const server = this.database.getServerById(request.serverId)
    if (!server) {
      throw new Error(this.t('errors.serverNotFound'))
    }

    const password =
      request.password ?? (await this.secureStore.getSecret(server.id, 'password')) ?? undefined
    const passphrase =
      request.passphrase ?? (await this.secureStore.getSecret(server.id, 'passphrase')) ?? undefined

    if (server.authType === 'password' && !password) {
      throw new Error(this.t('errors.passwordRequired'))
    }

    let privateKey: string | undefined
    if (server.authType === 'privateKey') {
      if (!server.privateKeyPath) {
        throw new Error(this.t('errors.privateKeyMissing'))
      }

      privateKey = await fs.readFile(server.privateKeyPath, 'utf8')
    }

    if (request.rememberPassword && request.password) {
      await this.secureStore.setSecret(server.id, 'password', request.password)
    }
    if (request.rememberPassphrase && request.passphrase) {
      await this.secureStore.setSecret(server.id, 'passphrase', request.passphrase)
    }

    const sessionId = randomUUID()
    const connectedAt = new Date().toISOString()
    const baseSummary: SessionSummary = {
      sessionId,
      serverId: server.id,
      serverName: server.name,
      host: server.host,
      port: server.port,
      status: 'connecting',
      connectedAt,
      currentPath: '/'
    }

    this.history.set(sessionId, request)
    this.emitToRenderer('sessions:state', {
      sessionId,
      status: 'connecting',
      message: this.t('session.connecting')
    })

    const client = new Client()
    const connectConfig: ConnectConfig = {
      host: server.host,
      port: server.port,
      username: server.username,
      readyTimeout: 15_000,
      keepaliveInterval: 10_000,
      keepaliveCountMax: 3,
      password,
      privateKey,
      passphrase,
      hostVerifier: (key, verify) => {
        this.verifyHost(server.name, server.host, server.port, key)
          .then(verify)
          .catch(() => verify(false))
      }
    }

    return new Promise<SessionSummary>((resolve, reject) => {
      let settled = false

      const rejectWith = (error: unknown) => {
        const message = error instanceof Error ? error.message : this.t('errors.connectionFailed')
        if (!settled) {
          settled = true
          this.emitToRenderer('sessions:error', { sessionId, message })
          this.emitToRenderer('sessions:state', { sessionId, status: 'error', message })
          reject(new Error(message))
        }
      }

      client.once('error', (error) => {
        rejectWith(error)
      })

      client.once('ready', async () => {
        try {
          const [shell, sftp] = await Promise.all([openShell(client), openSftp(client)])
          const currentPath = normalizeRemotePath(await sftpRealpath(sftp, '.').catch(() => '/'))
          const summary: SessionSummary = {
            ...baseSummary,
            status: 'ready',
            currentPath
          }

          const runtime: SessionRuntime = {
            sessionId,
            client,
            shell,
            sftp,
            summary,
            connectRequest: request
          }

          shell.on('data', (chunk: Buffer | string) => {
            this.emitToRenderer('sessions:data', {
              sessionId,
              data: chunk.toString()
            })
          })
          shell.stderr.on('data', (chunk: Buffer | string) => {
            this.emitToRenderer('sessions:data', {
              sessionId,
              data: chunk.toString()
            })
          })
          shell.on('close', (code?: number, signal?: string) => {
            runtime.lastExit = { sessionId, code, signal }
            client.end()
          })

          client.on('error', (error) => {
            runtime.lastError = error.message
            this.emitToRenderer('sessions:error', { sessionId, message: error.message })
            this.emitToRenderer('sessions:state', {
              sessionId,
              status: 'error',
              message: error.message
            })
          })
          client.on('close', () => {
            this.finalizeSession(sessionId)
          })

          this.sessions.set(sessionId, runtime)
          this.database.recordRecentSession(server.id)
          this.emitToRenderer('sessions:state', {
            sessionId,
            status: 'ready',
            message: this.t('session.connected')
          })

          if (!settled) {
            settled = true
            resolve(summary)
          }
        } catch (error) {
          rejectWith(error)
          client.end()
        }
      })

      try {
        client.connect(connectConfig)
      } catch (error) {
        rejectWith(error)
      }
    })
  }

  async reconnect(sessionId: string): Promise<SessionSummary> {
    const request = this.history.get(sessionId)
    if (!request) {
      throw new Error(this.t('errors.reconnectUnavailable'))
    }

    return this.connect(request)
  }

  async disconnect(sessionId: string): Promise<void> {
    const runtime = this.sessions.get(sessionId)
    if (!runtime) {
      return
    }

    runtime.finalizing = true
    runtime.client.end()
    this.sessions.delete(sessionId)
    this.emitToRenderer('sessions:state', {
      sessionId,
      status: 'disconnected',
      message: this.t('session.closed')
    })
  }

  async write(sessionId: string, data: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    runtime.shell.write(data)
  }

  async resize(sessionId: string, columns: number, rows: number): Promise<void> {
    const runtime = this.requireSession(sessionId)
    runtime.shell.setWindow(rows, columns, 0, 0)
  }

  async listDirectory(sessionId: string, remotePath: string) {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath || runtime.summary.currentPath)
    const entries = await sftpReadDir(runtime.sftp, normalized)
    runtime.summary.currentPath = normalized
    return {
      path: normalized,
      entries
    }
  }

  async makeDirectory(sessionId: string, currentPath: string, name: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    await sftpMkdir(runtime.sftp, posix.join(normalizeRemotePath(currentPath), name.trim()))
  }

  async rename(sessionId: string, remotePath: string, newName: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const targetPath = posix.join(posix.dirname(normalized), newName.trim())
    await sftpRename(runtime.sftp, normalized, targetPath)
  }

  async remove(sessionId: string, remotePath: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const stats = await sftpStat(runtime.sftp, normalized)
    if (stats.isDirectory()) {
      await sftpRmdir(runtime.sftp, normalized)
      return
    }

    await sftpUnlink(runtime.sftp, normalized)
  }

  async uploadFiles(sessionId: string, targetPath: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    const window = this.getWindow()
    const openOptions: OpenDialogOptions = {
      title: this.t('dialogs.uploadFiles.title'),
      properties: ['openFile', 'multiSelections']
    }
    const selection = window
      ? await dialog.showOpenDialog(window, openOptions)
      : await dialog.showOpenDialog(openOptions)

    if (selection.canceled || selection.filePaths.length === 0) {
      return
    }

    for (const localPath of selection.filePaths) {
      const remotePath = posix.join(normalizeRemotePath(targetPath), basename(localPath))
      const fileName = basename(localPath)
      await new Promise<void>((resolve, reject) => {
        runtime.sftp.fastPut(
          localPath,
          remotePath,
          {
            step: (transferred, _chunk, total) => {
              this.emitToRenderer('sftp:transfer', {
                sessionId,
                direction: 'upload',
                fileName,
                localPath,
                remotePath,
                transferred,
                total,
                status: 'running'
              })
            }
          },
          (error) => {
            if (error) {
              this.emitToRenderer('sftp:transfer', {
                sessionId,
                direction: 'upload',
                fileName,
                localPath,
                remotePath,
                transferred: 0,
                total: 0,
                status: 'error',
                error: error.message
              })
              reject(error)
              return
            }

            this.emitToRenderer('sftp:transfer', {
              sessionId,
              direction: 'upload',
              fileName,
              localPath,
              remotePath,
              transferred: 1,
              total: 1,
              status: 'completed'
            })
            resolve()
          }
        )
      })
    }
  }

  async downloadFile(sessionId: string, remotePath: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const window = this.getWindow()
    const fileName = path.posix.basename(normalized)
    const saveOptions = {
      title: this.t('dialogs.downloadFile.title'),
      defaultPath: fileName
    }
    const saveResult = window
      ? await dialog.showSaveDialog(window, saveOptions)
      : await dialog.showSaveDialog(saveOptions)

    if (saveResult.canceled || !saveResult.filePath) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      runtime.sftp.fastGet(
        normalized,
        saveResult.filePath as string,
        {
          step: (transferred, _chunk, total) => {
            this.emitToRenderer('sftp:transfer', {
              sessionId,
              direction: 'download',
              fileName,
              localPath: saveResult.filePath as string,
              remotePath: normalized,
              transferred,
              total,
              status: 'running'
            })
          }
        },
        (error) => {
          if (error) {
            this.emitToRenderer('sftp:transfer', {
              sessionId,
              direction: 'download',
              fileName,
              localPath: saveResult.filePath as string,
              remotePath: normalized,
              transferred: 0,
              total: 0,
              status: 'error',
              error: error.message
            })
            reject(error)
            return
          }

          this.emitToRenderer('sftp:transfer', {
            sessionId,
            direction: 'download',
            fileName,
            localPath: saveResult.filePath as string,
            remotePath: normalized,
            transferred: 1,
            total: 1,
            status: 'completed'
          })
          resolve()
        }
      )
    })
  }

  dispose(): void {
    for (const runtime of this.sessions.values()) {
      runtime.client.end()
    }

    this.sessions.clear()
  }

  private requireSession(sessionId: string): SessionRuntime {
    const runtime = this.sessions.get(sessionId)
    if (!runtime) {
      throw new Error(this.t('errors.sessionUnavailable'))
    }

    return runtime
  }

  private finalizeSession(sessionId: string): void {
    const runtime = this.sessions.get(sessionId)
    if (!runtime || runtime.finalizing) {
      return
    }

    runtime.finalizing = true
    this.sessions.delete(sessionId)

    if (runtime.lastExit) {
      this.emitToRenderer('sessions:exit', runtime.lastExit)
    }

    this.emitToRenderer('sessions:state', {
      sessionId,
      status: runtime.lastError ? 'error' : 'disconnected',
      message: runtime.lastError ?? this.t('session.disconnected')
    })
  }

  private async verifyHost(
    serverName: string,
    host: string,
    port: number,
    key: Buffer
  ): Promise<boolean> {
    const fingerprint = toFingerprint(key)
    const known = this.database.getKnownHost(host, port)

    if (known?.fingerprint === fingerprint) {
      return true
    }

    const window = this.getWindow()

    if (known && known.fingerprint !== fingerprint) {
      const warningOptions: MessageBoxOptions = {
        type: 'warning',
        buttons: [
          this.t('dialogs.hostChanged.buttons.cancel'),
          this.t('dialogs.hostChanged.buttons.trust')
        ],
        cancelId: 0,
        defaultId: 0,
        title: this.t('dialogs.hostChanged.title'),
        message: this.t('dialogs.hostChanged.message', { serverName }),
        detail: this.t('dialogs.hostChanged.detail', {
          fingerprint,
          knownFingerprint: known.fingerprint
        })
      }
      const changed = window
        ? await dialog.showMessageBox(window, warningOptions)
        : await dialog.showMessageBox(warningOptions)

      if (changed.response !== 1) {
        return false
      }
    } else {
      const trustOptions: MessageBoxOptions = {
        type: 'question',
        buttons: [
          this.t('dialogs.hostFirstSeen.buttons.reject'),
          this.t('dialogs.hostFirstSeen.buttons.trust')
        ],
        cancelId: 0,
        defaultId: 1,
        title: this.t('dialogs.hostFirstSeen.title'),
        message: this.t('dialogs.hostFirstSeen.message', { serverName }),
        detail: this.t('dialogs.hostFirstSeen.detail', { fingerprint, host, port })
      }
      const firstTrust = window
        ? await dialog.showMessageBox(window, trustOptions)
        : await dialog.showMessageBox(trustOptions)

      if (firstTrust.response !== 1) {
        return false
      }
    }

    this.database.upsertKnownHost({
      host,
      port,
      algorithm: 'sha256',
      fingerprint,
      verifiedAt: new Date().toISOString()
    })

    return true
  }
}
