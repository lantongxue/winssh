import type { Worker } from 'node:worker_threads'
import type { SshCoreInbound, SshCoreOutbound } from '@shared/ssh-protocol'

type WorkerPort = Pick<Worker, 'on' | 'postMessage'>

type HostTrustRequest = Extract<SshCoreOutbound, { type: 'hostTrust' }>
type AckMessage = Extract<SshCoreOutbound, { type: 'ack' }>

export interface SshControlPortOptions {
  requestTimeoutMs?: number
  verifyHost?: (input: {
    serverName: string
    host: string
    port: number
    key: Buffer
  }) => Promise<boolean>
  onEvent?: (event: Exclude<SshCoreOutbound, AckMessage | HostTrustRequest>) => void
}

interface PendingRequest {
  type: SshCoreInbound['type']
  resolve: (message: AckMessage) => void
  reject: (error: Error) => void
  timer: NodeJS.Timeout
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

export class SshControlPort {
  private requestCounter = 0
  private readonly requestTimeoutMs: number
  private readonly pending = new Map<string, PendingRequest>()

  constructor(
    private readonly worker: WorkerPort,
    private readonly options: SshControlPortOptions = {}
  ) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    this.worker.on('message', (message) => {
      void this.handleWorkerMessage(message as SshCoreOutbound)
    })
  }

  request(message: SshCoreInbound): Promise<AckMessage> {
    const requestId = 'requestId' in message ? message.requestId : this.nextRequestId(message)
    const request = { ...message, requestId } as SshCoreInbound

    return new Promise<AckMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error(`SSH worker request timed out: ${message.type}`))
      }, this.requestTimeoutMs)

      this.pending.set(requestId, {
        type: message.type,
        resolve,
        reject,
        timer
      })
      this.worker.postMessage(request)
    })
  }

  dispose(): void {
    for (const [requestId, pending] of this.pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error(`SSH worker request cancelled: ${pending.type}`))
      this.pending.delete(requestId)
    }
  }

  private async handleWorkerMessage(message: SshCoreOutbound): Promise<void> {
    if (message.type === 'ack') {
      this.handleAck(message)
      return
    }

    if (message.type === 'hostTrust') {
      await this.handleHostTrust(message)
      return
    }

    this.options.onEvent?.(message)
  }

  private handleAck(message: AckMessage): void {
    const pending = this.pending.get(message.requestId)
    if (!pending) {
      return
    }

    clearTimeout(pending.timer)
    this.pending.delete(message.requestId)

    if (message.ok) {
      pending.resolve(message)
      return
    }

    pending.reject(new Error(message.message ?? `SSH worker request failed: ${pending.type}`))
  }

  private async handleHostTrust(message: HostTrustRequest): Promise<void> {
    try {
      const trusted =
        (await this.options.verifyHost?.({
          serverName: message.serverName,
          host: message.host,
          port: message.port,
          key: Buffer.from(message.key)
        })) ?? false

      this.worker.postMessage({
        type: 'hostTrustResult',
        requestId: message.requestId,
        ok: true,
        trusted
      } satisfies SshCoreInbound)
    } catch (error) {
      this.worker.postMessage({
        type: 'hostTrustResult',
        requestId: message.requestId,
        ok: false,
        message: error instanceof Error ? error.message : 'Host trust verification failed'
      } satisfies SshCoreInbound)
    }
  }

  private nextRequestId(message: SshCoreInbound): string {
    this.requestCounter += 1
    return `${message.type}-${Date.now()}-${this.requestCounter}`
  }
}
