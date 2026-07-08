import type { TerminalDegradedReason } from '@shared/worker-protocol'
import { terminalWorkerMessageSchema } from '@shared/worker-protocol'
import { sessionsClient } from '@/features/sessions/api/sessions-client'
import type {
  TerminalWorkerAttachInput,
  TerminalWorkerDegradedHandler
} from './terminal-worker-types'

interface WorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void
  terminate(): void
  addEventListener(type: string, listener: EventListener): void
  removeEventListener(type: string, listener: EventListener): void
}

export interface TerminalWorkerHostOptions {
  createWorker?: () => WorkerLike
  createDataChannel?: (sessionId: string) => Promise<MessagePort>
  supportsOffscreenCanvas?: (container: HTMLDivElement) => boolean
  isCrossOriginIsolated?: () => boolean
  onDegraded?: TerminalWorkerDegradedHandler
}

export class TerminalWorkerHost {
  private worker: WorkerLike | null = null
  private dataPort: MessagePort | null = null
  private sessionId: string | null = null
  private messageListener: EventListener | null = null
  private errorListener: EventListener | null = null

  constructor(private readonly options: TerminalWorkerHostOptions = {}) {}

  async attach(input: TerminalWorkerAttachInput): Promise<void> {
    this.detach()
    this.sessionId = input.sessionId
    const worker = this.createWorker()
    const dataPort = await (this.options.createDataChannel ?? sessionsClient.createDataChannel)(
      input.sessionId
    )
    this.worker = worker
    this.dataPort = dataPort

    const messageListener: EventListener = (event) => {
      const parsed = terminalWorkerMessageSchema.safeParse((event as MessageEvent).data)
      if (!parsed.success || parsed.data.type !== 'degraded') {
        return
      }

      this.options.onDegraded?.(parsed.data.sessionId, parsed.data.reason)
    }
    const errorListener: EventListener = () => {
      this.reportDegraded('terminal_worker_crashed')
    }
    this.messageListener = messageListener
    this.errorListener = errorListener
    worker.addEventListener('message', messageListener)
    worker.addEventListener('error', errorListener)

    const useOffscreenCanvas =
      (this.options.supportsOffscreenCanvas ?? supportsOffscreenCanvas)(input.container) &&
      (this.options.isCrossOriginIsolated ?? defaultCrossOriginIsolated)()

    const transfer: Transferable[] = [dataPort]
    worker.postMessage(
      {
        type: 'attach',
        sessionId: input.sessionId,
        useOffscreenCanvas
      },
      transfer
    )

    if (!useOffscreenCanvas) {
      this.reportDegraded('offscreen_canvas_unavailable')
    }
  }

  focus(): void {
    if (!this.worker || !this.sessionId) {
      return
    }

    this.worker.postMessage({ type: 'focus', sessionId: this.sessionId })
  }

  resize(cols: number, rows: number): void {
    if (!this.worker || !this.sessionId) {
      return
    }

    this.worker.postMessage({ type: 'resize', sessionId: this.sessionId, cols, rows })
  }

  detach(): void {
    if (this.worker && this.messageListener) {
      this.worker.removeEventListener('message', this.messageListener)
    }
    if (this.worker && this.errorListener) {
      this.worker.removeEventListener('error', this.errorListener)
    }

    this.dataPort?.close()
    this.worker?.terminate()
    this.worker = null
    this.dataPort = null
    this.sessionId = null
    this.messageListener = null
    this.errorListener = null
  }

  private createWorker(): WorkerLike {
    return (
      this.options.createWorker?.() ??
      new Worker(new URL('./terminal.worker.ts', import.meta.url), { type: 'module' })
    )
  }

  private reportDegraded(reason: TerminalDegradedReason): void {
    if (this.sessionId) {
      this.options.onDegraded?.(this.sessionId, reason)
    }
  }
}

function supportsOffscreenCanvas(container: HTMLDivElement): boolean {
  return (
    typeof (container as unknown as { transferControlToOffscreen?: unknown })
      .transferControlToOffscreen === 'function'
  )
}

function defaultCrossOriginIsolated(): boolean {
  return globalThis.crossOriginIsolated === true
}
