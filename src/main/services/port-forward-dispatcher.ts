import { randomUUID } from 'node:crypto'
import type { PortForwardInput, PortForwardRule } from '@shared/types'

type PortForwardLegacyRuntime = {
  listPortForwards(sessionId: string): PortForwardRule[]
  createPortForward(sessionId: string, input: PortForwardInput): Promise<PortForwardRule>
  startPortForward(sessionId: string, ruleId: string): Promise<PortForwardRule>
  stopPortForward(sessionId: string, ruleId: string): Promise<PortForwardRule>
  removePortForward(sessionId: string, ruleId: string): Promise<void>
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

export interface PortForwardDispatcherOptions {
  legacyRuntime: PortForwardLegacyRuntime
  useWorker: boolean
  getWorkerPort?: (sessionId: string) => WorkerPort
  requestTimeoutMs?: number
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

export class PortForwardDispatcher {
  private readonly requestTimeoutMs: number

  constructor(private readonly options: PortForwardDispatcherOptions) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  }

  list(sessionId: string): PortForwardRule[] | Promise<PortForwardRule[]> {
    if (!this.options.useWorker) {
      return this.options.legacyRuntime.listPortForwards(sessionId)
    }

    return this.request<PortForwardRule[]>(sessionId, { type: 'list', sessionId })
  }

  create(sessionId: string, input: PortForwardInput): Promise<PortForwardRule> {
    if (!this.options.useWorker) {
      return this.options.legacyRuntime.createPortForward(sessionId, input)
    }

    return this.request<PortForwardRule>(sessionId, { type: 'create', sessionId, input })
  }

  start(sessionId: string, ruleId: string): Promise<PortForwardRule> {
    if (!this.options.useWorker) {
      return this.options.legacyRuntime.startPortForward(sessionId, ruleId)
    }

    return this.request<PortForwardRule>(sessionId, { type: 'start', sessionId, ruleId })
  }

  stop(sessionId: string, ruleId: string): Promise<PortForwardRule> {
    if (!this.options.useWorker) {
      return this.options.legacyRuntime.stopPortForward(sessionId, ruleId)
    }

    return this.request<PortForwardRule>(sessionId, { type: 'stop', sessionId, ruleId })
  }

  remove(sessionId: string, ruleId: string): Promise<void> {
    if (!this.options.useWorker) {
      return this.options.legacyRuntime.removePortForward(sessionId, ruleId)
    }

    return this.request<void>(sessionId, { type: 'remove', sessionId, ruleId })
  }

  disposeSession(sessionId: string): void {
    if (!this.options.useWorker) {
      return
    }

    this.requireWorkerPort(sessionId).postMessage({ type: 'disposeSession', sessionId })
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
      return Promise.reject(new Error('Port forward worker port does not support responses'))
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

        reject(new Error(ack.message ?? 'Port forward worker request failed'))
      }
      const cleanup = () => {
        clearTimeout(timer)
        port.off?.('message', handleMessage)
      }
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Port forward worker request timed out: ${String(message.type)}`))
      }, this.requestTimeoutMs)

      port.on?.('message', handleMessage)
      port.postMessage(payload)
    })
  }

  private requireWorkerPort(sessionId: string): WorkerPort {
    const port = this.options.getWorkerPort?.(sessionId)
    if (!port) {
      throw new Error(`Port forward worker port unavailable: ${sessionId}`)
    }
    return port
  }
}
