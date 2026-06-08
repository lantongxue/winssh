import { EventEmitter } from 'node:events'
import { encodeSshDataFrame } from '@shared/ssh-data-frame'
import { WorkerSessionRuntime } from '@main/services/worker-session-runtime'

class FakeWorker extends EventEmitter {
  posted: unknown[] = []
  postMessage = vi.fn((message: unknown) => {
    this.posted.push(message)
  })
  terminate = vi.fn(async () => 0)
}

function createServer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'server-1',
    name: 'Production',
    host: 'example.com',
    port: 22,
    username: 'alice',
    authType: 'password',
    privateKeyPath: null,
    jumpServerId: null,
    captureCommandHistory: false,
    ...overrides
  }
}

function createRuntime(worker = new FakeWorker()) {
  const sendToRenderer = vi.fn()
  const database = {
    getServerById: vi.fn((id: string) => (id === 'server-1' ? createServer() : null)),
    getServerPassword: vi.fn(() => 'stored-password'),
    getServerPassphrase: vi.fn(() => null),
    getServerPrivateKey: vi.fn(() => null),
    recordRecentSession: vi.fn()
  }
  const runtime = new WorkerSessionRuntime({
    database: database as never,
    hostTrustService: { verifyHost: vi.fn(async () => true), resolveHostTrust: vi.fn() },
    legacyRuntime: { dispose: vi.fn() } as never,
    sendToRenderer,
    spawnWorker: vi.fn(() => worker as never),
    terminalDefaults: { cols: 120, rows: 30 },
    translate: ((key: string) => key) as never
  })

  return { database, runtime, sendToRenderer, worker }
}

describe('WorkerSessionRuntime', () => {
  it('marks session error when ssh-core worker crashes', () => {
    const { runtime, sendToRenderer } = createRuntime()

    runtime.handleWorkerCrash('session-1', 1)

    expect(sendToRenderer).toHaveBeenCalledWith(
      'sessions:error',
      expect.objectContaining({
        sessionId: 'session-1',
        code: 'worker_crashed',
        recoverable: true
      })
    )
    expect(sendToRenderer).toHaveBeenCalledWith(
      'sessions:state',
      expect.objectContaining({ sessionId: 'session-1', status: 'error', code: 'worker_crashed' })
    )
  })

  it('resolves connection prerequisites before sending connect to the worker', async () => {
    const { database, runtime, worker } = createRuntime()
    const promise = runtime.connect({ serverId: 'server-1', sessionId: 'session-1' })
    await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(0))
    const connectMessage = worker.posted[0] as { requestId: string }

    worker.emit('message', { type: 'ack', requestId: connectMessage.requestId, ok: true })
    const result = await promise

    expect(result.ok).toBe(true)
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'connect',
        config: expect.objectContaining({
          target: expect.objectContaining({ auth: { password: 'stored-password' } }),
          terminal: { cols: 120, rows: 30 }
        })
      })
    )
    expect(database.recordRecentSession).toHaveBeenCalledWith('server-1')
  })

  it('decodes worker data frames into existing renderer events', async () => {
    const { runtime, sendToRenderer, worker } = createRuntime()
    const promise = runtime.connect({ serverId: 'server-1', sessionId: 'session-1' })
    await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(0))
    const connectMessage = worker.posted[0] as { requestId: string }

    worker.emit('message', { type: 'ack', requestId: connectMessage.requestId, ok: true })
    await promise

    const frame = encodeSshDataFrame({
      seq: 1,
      sentAtMs: Date.now(),
      payload: Buffer.from('hello')
    })
    worker.emit('message', {
      type: 'data',
      sessionId: 'session-1',
      correlationId: 'session-1',
      frame,
      seq: 1
    })

    expect(sendToRenderer).toHaveBeenCalledWith(
      'sessions:data',
      expect.objectContaining({ sessionId: 'session-1', data: 'hello' })
    )
  })
})
