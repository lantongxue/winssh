import { EventEmitter } from 'node:events'
import { SshControlPort } from '@main/services/ssh-control-port'

class FakeWorker extends EventEmitter {
  postMessage = vi.fn()
}

describe('SshControlPort', () => {
  it('resolves a request when worker replies with the same requestId', async () => {
    const worker = new FakeWorker()
    const port = new SshControlPort(worker as never, { requestTimeoutMs: 1000 })

    const promise = port.request({
      type: 'connect',
      requestId: 'req-1',
      correlationId: 'session-1',
      config: {
        sessionId: 'session-1',
        target: {
          id: 'server-1',
          name: 'Production',
          host: 'example.com',
          port: 22,
          username: 'alice',
          authType: 'password',
          auth: { password: 'secret' }
        },
        terminal: { cols: 80, rows: 24 }
      }
    })

    worker.emit('message', { type: 'ack', requestId: 'req-1', ok: true })

    await expect(promise).resolves.toEqual({ type: 'ack', requestId: 'req-1', ok: true })
    expect(worker.postMessage).toHaveBeenCalledOnce()
  })

  it('rejects failed acknowledgements from the worker', async () => {
    const worker = new FakeWorker()
    const port = new SshControlPort(worker as never, { requestTimeoutMs: 1000 })

    const promise = port.request({
      type: 'disconnect',
      requestId: 'req-2',
      sessionId: 'session-1',
      correlationId: 'session-1'
    })

    worker.emit('message', {
      type: 'ack',
      requestId: 'req-2',
      ok: false,
      message: 'connection failed'
    })

    await expect(promise).rejects.toThrow('connection failed')
  })

  it('rejects when a request times out', async () => {
    vi.useFakeTimers()
    const worker = new FakeWorker()
    const port = new SshControlPort(worker as never, { requestTimeoutMs: 5 })

    const promise = port.request({
      type: 'disconnect',
      sessionId: 'session-1',
      correlationId: 'session-1'
    })
    const expectation = expect(promise).rejects.toThrow('SSH worker request timed out: disconnect')

    await vi.advanceTimersByTimeAsync(6)

    await expectation
    vi.useRealTimers()
  })

  it('routes worker host trust requests and replies with the verification result', async () => {
    const worker = new FakeWorker()
    const verifyHost = vi.fn(async () => true)
    new SshControlPort(worker as never, { requestTimeoutMs: 1000, verifyHost })

    worker.emit('message', {
      type: 'hostTrust',
      requestId: 'host-1',
      sessionId: 'session-1',
      correlationId: 'session-1',
      serverName: 'Production',
      host: 'example.com',
      port: 22,
      key: new ArrayBuffer(4)
    })

    await vi.waitFor(() => {
      expect(worker.postMessage).toHaveBeenCalledWith({
        type: 'hostTrustResult',
        requestId: 'host-1',
        ok: true,
        trusted: true
      })
    })
    expect(verifyHost).toHaveBeenCalledWith({
      serverName: 'Production',
      host: 'example.com',
      port: 22,
      key: Buffer.from(new ArrayBuffer(4))
    })
  })
})
