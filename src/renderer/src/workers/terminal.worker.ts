import { decodeSshDataFrame } from '@shared/ssh-data-frame'
import { terminalWorkerMessageSchema } from '@shared/worker-protocol'

let dataPort: MessagePort | null = null

self.addEventListener('message', (event: MessageEvent) => {
  const parsed = terminalWorkerMessageSchema.safeParse(event.data)
  if (!parsed.success) {
    return
  }

  switch (parsed.data.type) {
    case 'attach':
      dataPort = event.ports[0] ?? null
      dataPort?.addEventListener('message', handleDataPortMessage)
      dataPort?.start()
      if (!parsed.data.useOffscreenCanvas) {
        postDegraded(parsed.data.sessionId, 'offscreen_canvas_unavailable')
        return
      }
      postDegraded(parsed.data.sessionId, 'worker_init_failed')
      return
    case 'dispose':
      dispose()
      return
    case 'focus':
    case 'resize':
    case 'ready':
    case 'degraded':
      return
  }
})

function handleDataPortMessage(event: MessageEvent): void {
  const message = event.data as { type?: string; frame?: ArrayBuffer }
  if (message.type !== 'data' || !(message.frame instanceof ArrayBuffer)) {
    return
  }

  try {
    decodeSshDataFrame(message.frame)
  } catch {
    // Invalid frames are ignored; the main-thread fallback remains authoritative.
  }
}

function postDegraded(
  currentSessionId: string,
  reason: 'offscreen_canvas_unavailable' | 'worker_init_failed'
): void {
  self.postMessage({
    type: 'degraded',
    sessionId: currentSessionId,
    reason
  })
}

function dispose(): void {
  dataPort?.removeEventListener('message', handleDataPortMessage)
  dataPort?.close()
  dataPort = null
}

export {}
