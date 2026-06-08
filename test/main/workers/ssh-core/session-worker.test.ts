import { EventEmitter } from 'node:events'
import { SshCoreSessionWorker } from '@main/workers/ssh-core/session-worker'

class FakeChannel extends EventEmitter {
  stderr = new EventEmitter()
  write = vi.fn()
  setWindow = vi.fn()
  close = vi.fn()
}

class FakeSftp {
  realpath = vi.fn((_path: string, callback: (error: Error | undefined, path: string) => void) =>
    callback(undefined, '/home/alice')
  )
  readFile = vi.fn((_path: string, _options: unknown, callback: (error: Error | undefined, data: Buffer) => void) =>
    callback(undefined, Buffer.from('hello'))
  )
  writeFile = vi.fn((_path: string, _data: Buffer, callback: (error?: Error) => void) =>
    callback()
  )
}

class FakeClient extends EventEmitter {
  connect = vi.fn()
  end = vi.fn()
  shell = vi.fn((_options, callback) => callback(undefined, new FakeChannel()))
  sftp = vi.fn((callback) => callback(undefined, new FakeSftp()))
}

describe('SshCoreSessionWorker', () => {
  it('emits ready after client ready and shell/sftp open', async () => {
    const client = new FakeClient()
    const postMessage = vi.fn()
    const worker = new SshCoreSessionWorker({
      createClient: () => client as never,
      postMessage
    })

    const promise = worker.connect({
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
    })

    client.emit('ready')
    await promise

    expect(client.connect).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'example.com', username: 'alice', password: 'secret' })
    )
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'state', phase: 'handshake' })
    )
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'state', phase: 'ready' }))
  })

  it('forwards shell data and terminal control operations', async () => {
    const client = new FakeClient()
    const channel = new FakeChannel()
    client.shell = vi.fn((_options, callback) => callback(undefined, channel))
    const postMessage = vi.fn()
    const worker = new SshCoreSessionWorker({
      createClient: () => client as never,
      postMessage
    })

    const promise = worker.connect({
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
    })
    client.emit('ready')
    await promise

    channel.emit('data', Buffer.from('hi'))
    worker.write('session-1', Buffer.from('pwd\r'))
    worker.resize('session-1', 120, 32)
    worker.disconnect('session-1')

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'data', sessionId: 'session-1', seq: 1 }),
      expect.any(Array)
    )
    expect(channel.write).toHaveBeenCalledWith(Buffer.from('pwd\r'))
    expect(channel.setWindow).toHaveBeenCalledWith(32, 120, 0, 0)
    expect(channel.close).toHaveBeenCalledOnce()
    expect(client.end).toHaveBeenCalledOnce()
  })

  it('waits for host trust verification before accepting a host key', async () => {
    const client = new FakeClient()
    const worker = new SshCoreSessionWorker({
      createClient: () => client as never,
      postMessage: vi.fn()
    })

    const promise = worker.connect({
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
    })
    const connectConfig = client.connect.mock.calls[0][0]
    const verify = vi.fn()

    connectConfig.hostVerifier(Buffer.from('key'), verify)
    worker.resolveHostTrust('host-1', true)
    client.emit('ready')
    await promise

    expect(verify).toHaveBeenCalledWith(true)
  })

  it('reads and writes text files through sftp', async () => {
    const client = new FakeClient()
    const sftp = new FakeSftp()
    client.sftp = vi.fn((callback) => callback(undefined, sftp))
    const worker = new SshCoreSessionWorker({
      createClient: () => client as never,
      postMessage: vi.fn()
    })

    const promise = worker.connect({
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
    })
    client.emit('ready')
    await promise

    await expect(worker.readFile('session-1', '/tmp/a.txt')).resolves.toEqual({
      content: 'hello',
      encoding: 'utf8'
    })
    await worker.writeFile('session-1', '/tmp/a.txt', 'bye', 'utf8')

    expect(sftp.readFile).toHaveBeenCalledWith('/tmp/a.txt', {}, expect.any(Function))
    expect(sftp.writeFile).toHaveBeenCalledWith('/tmp/a.txt', Buffer.from('bye'), expect.any(Function))
  })
})
