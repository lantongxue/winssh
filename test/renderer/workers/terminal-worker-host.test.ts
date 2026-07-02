import { TerminalWorkerHost } from '@/workers/terminal-worker-host'

class FakeWorker {
  postMessage = vi.fn()
  terminate = vi.fn()
  private readonly listeners = new Map<string, EventListener>()

  addEventListener = vi.fn((event: string, listener: EventListener) => {
    this.listeners.set(event, listener)
  })
  removeEventListener = vi.fn()

  emit(event: string, data: unknown) {
    this.listeners.get(event)?.(new MessageEvent(event, { data }))
  }
}

describe('TerminalWorkerHost', () => {
  it('initializes worker with session id and canvas support flags', async () => {
    const worker = new FakeWorker()
    const createDataChannel = vi.fn(async () => new MessageChannel().port1)
    const host = new TerminalWorkerHost({
      createWorker: () => worker as never,
      createDataChannel,
      supportsOffscreenCanvas: () => false,
      isCrossOriginIsolated: () => false
    })

    await host.attach({ sessionId: 'session-1', container: document.createElement('div') })

    expect(createDataChannel).toHaveBeenCalledWith('session-1')
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'attach',
        sessionId: 'session-1',
        useOffscreenCanvas: false
      }),
      expect.any(Array)
    )

    host.detach()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })

  it('reports degraded when worker emits degraded message', async () => {
    const worker = new FakeWorker()
    const onDegraded = vi.fn()
    const host = new TerminalWorkerHost({
      createWorker: () => worker as never,
      createDataChannel: async () => new MessageChannel().port1,
      supportsOffscreenCanvas: () => false,
      isCrossOriginIsolated: () => false,
      onDegraded
    })

    await host.attach({ sessionId: 'session-1', container: document.createElement('div') })
    worker.emit('message', {
      type: 'degraded',
      sessionId: 'session-1',
      reason: 'worker_init_failed'
    })

    expect(onDegraded).toHaveBeenCalledWith('session-1', 'worker_init_failed')
  })
})
