import { randomUUID } from 'node:crypto'
import type { SftpListResult } from '@shared/types'

type ReadFileResult = { content: string; encoding: string; cancelled?: boolean }

type SftpLegacyRuntime = {
  listDirectory(sessionId: string, remotePath: string): Promise<SftpListResult>
  readFile(sessionId: string, remotePath: string): Promise<ReadFileResult>
  writeFile(
    sessionId: string,
    remotePath: string,
    contents: string,
    encoding?: string
  ): Promise<void>
  cancelReadFile?(sessionId: string, remotePath: string): void
}

type WorkerPort = {
  postMessage(message: unknown): void
  on?(event: 'message', listener: (message: unknown) => void): void
  off?(event: 'message', listener: (message: unknown) => void): void
}

type WorkerAck = {
  type: 'ack'
  requestId: string
  ok: boolean
  result?: unknown
  message?: string
}

export interface SftpDispatcherOptions {
  legacyRuntime: SftpLegacyRuntime
  useWorker: boolean
  getWorkerPort?: (sessionId: string) => WorkerPort
  requestTimeoutMs?: number
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

export class SftpDispatcher {
  private readonly requestTimeoutMs: number

  constructor(private readonly options: SftpDispatcherOptions) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  }

  list(sessionId: string, remotePath: string): Promise<SftpListResult> {
    if (!this.options.useWorker) {
      return this.options.legacyRuntime.listDirectory(sessionId, remotePath)
    }

    return this.request<SftpListResult>(sessionId, {
      type: 'list',
      sessionId,
      remotePath
    })
  }

  readFile(sessionId: string, remotePath: string): Promise<ReadFileResult> {
    if (!this.options.useWorker) {
      return this.options.legacyRuntime.readFile(sessionId, remotePath)
    }

    return this.request<ReadFileResult>(sessionId, {
      type: 'readFile',
      sessionId,
      remotePath
    })
  }

  writeFile(
    sessionId: string,
    remotePath: string,
    contents: string,
    encoding?: string
  ): Promise<void> {
    if (!this.options.useWorker) {
      return this.options.legacyRuntime.writeFile(sessionId, remotePath, contents, encoding)
    }

    return this.request<void>(sessionId, {
      type: 'writeFile',
      sessionId,
      remotePath,
      contents,
      encoding
    })
  }

  cancelReadFile(sessionId: string, remotePath: string): void {
    if (!this.options.useWorker) {
      this.options.legacyRuntime.cancelReadFile?.(sessionId, remotePath)
      return
    }

    this.requireWorkerPort(sessionId).postMessage({
      type: 'cancelReadFile',
      sessionId,
      remotePath
    })
  }

  private request<TResult>(
    sessionId: string,
    message: Record<string, unknown>
  ): Promise<TResult> {
    const port = this.requireWorkerPort(sessionId)
    const requestId = `${String(message.type)}:${sessionId}:${randomUUID()}`
    const payload = { ...message, requestId }

    if (!port.on) {
      port.postMessage(payload)
      return Promise.reject(new Error('SFTP worker port does not support request responses'))
    }

    return new Promise<TResult>((resolve, reject) => {
      const handleMessage = (raw: unknown) => {
        const ack = raw as Partial<WorkerAck>
        if (ack.type !== 'ack' || ack.requestId !== requestId) {
          return
        }

        cleanup()
        if (ack.ok) {
          resolve(ack.result as TResult)
          return
        }

        reject(new Error(ack.message ?? 'SFTP worker request failed'))
      }
      const cleanup = () => {
        clearTimeout(timer)
        port.off?.('message', handleMessage)
      }
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`SFTP worker request timed out: ${String(message.type)}`))
      }, this.requestTimeoutMs)

      port.on?.('message', handleMessage)
      port.postMessage(payload)
    })
  }

  private requireWorkerPort(sessionId: string): WorkerPort {
    const port = this.options.getWorkerPort?.(sessionId)
    if (!port) {
      throw new Error(`SFTP worker port unavailable: ${sessionId}`)
    }
    return port
  }
}
