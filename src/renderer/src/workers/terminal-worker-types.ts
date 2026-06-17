import type { TerminalDegradedReason } from '@shared/worker-protocol'

export interface TerminalWorkerAttachInput {
  sessionId: string
  container: HTMLDivElement
}

export interface TerminalWorkerHostLike {
  attach(input: TerminalWorkerAttachInput): Promise<void>
  detach(): void
  focus(): void
  resize(cols: number, rows: number): void
}

export type TerminalWorkerDegradedHandler = (
  sessionId: string,
  reason: TerminalDegradedReason
) => void
