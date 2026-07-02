import { decodeSshDataFrame } from '@shared/ssh-data-frame'
import type { TerminalBackpressureEvent } from '@shared/ipc-channels'
import type { SessionDataEvent } from '@shared/types'

interface DataPort {
  postMessage(message: unknown, transferList?: Array<ArrayBuffer>): void
  close(): void
}

export interface SshDataRouteEvent {
  sessionId: string
  frame: ArrayBuffer
  seq: number
  sentAtMs: number
}

export interface SshDataAggregatorOptions {
  sendLegacyData?: (sessionId: string, event: SessionDataEvent) => void
  onBackpressure?: (event: TerminalBackpressureEvent) => void
}

export class SshDataAggregator {
  private readonly ports = new Map<string, DataPort>()

  constructor(private readonly options: SshDataAggregatorOptions = {}) {}

  registerSessionPort(sessionId: string, port: DataPort): void {
    this.unregisterSessionPort(sessionId)
    this.ports.set(sessionId, port)
  }

  unregisterSessionPort(sessionId: string): void {
    const port = this.ports.get(sessionId)
    if (!port) {
      return
    }

    this.ports.delete(sessionId)
    port.close()
  }

  routeFrame(event: SshDataRouteEvent): void {
    const lagMs = Math.max(0, performance.now() - event.sentAtMs)
    const port = this.ports.get(event.sessionId)

    if (!port) {
      this.sendLegacy(event)
      return
    }

    try {
      port.postMessage(
        {
          type: 'data',
          sessionId: event.sessionId,
          seq: event.seq,
          lagMs,
          frame: event.frame
        },
        [event.frame]
      )
    } catch {
      this.ports.delete(event.sessionId)
      this.options.onBackpressure?.({
        sessionId: event.sessionId,
        droppedFrames: 1,
        queuedBytes: event.frame.byteLength
      })
      this.sendLegacy(event)
    }
  }

  dispose(): void {
    for (const sessionId of this.ports.keys()) {
      this.unregisterSessionPort(sessionId)
    }
  }

  private sendLegacy(event: SshDataRouteEvent): void {
    const payload = decodePayload(event.frame)
    this.options.sendLegacyData?.(event.sessionId, {
      sessionId: event.sessionId,
      data: Buffer.from(payload).toString('utf8'),
      correlationId: event.sessionId,
      source: 'main',
      timestamp: new Date().toISOString()
    })
  }
}

function decodePayload(frame: ArrayBuffer): Uint8Array {
  try {
    return decodeSshDataFrame(frame).payload
  } catch {
    return new Uint8Array(frame)
  }
}
