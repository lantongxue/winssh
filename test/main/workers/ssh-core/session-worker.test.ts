import { EventEmitter } from 'node:events'
import iconv from 'iconv-lite'
import { SshCoreSessionWorker } from '@main/workers/ssh-core/session-worker'

class FakeChannel extends EventEmitter {
  stderr = new EventEmitter()
  write = vi.fn()
  setWindow = vi.fn()
  close = vi.fn()
}

class FakeSftp {
  private readonly handle = Buffer.from('file-handle')

  constructor(private readonly contents = Buffer.from('hello')) {}

  realpath = vi.fn((_path: string, callback: (error: Error | undefined, path: string) => void) =>
    callback(undefined, '/home/alice')
  )
  readFile = vi.fn(
    (
      _path: string,
      _options: unknown,
      callback: (error: Error | undefined, data: Buffer) => void
    ) => callback(undefined, Buffer.from('hello'))
  )
  writeFile = vi.fn((_path: string, _data: Buffer, callback: (error?: Error) => void) => callback())
  readdir = vi.fn(
    (
      _path: string,
      callback: (
        error: Error | undefined,
        entries: Array<{
          filename: string
          attrs: {
            isDirectory(): boolean
            isSymbolicLink(): boolean
            size: number
            mtime: number
            mode: number
          }
        }>
      ) => void
    ) =>
      callback(undefined, [
        {
          filename: 'notes.txt',
          attrs: {
            isDirectory: () => false,
            isSymbolicLink: () => false,
            size: 12,
            mtime: 1_714_348_800,
            mode: 0o100644
          }
        }
      ])
  )
  mkdir = vi.fn((_path: string, callback: (error?: Error) => void) => callback())
  rename = vi.fn((_fromPath: string, _toPath: string, callback: (error?: Error) => void) =>
    callback()
  )
  unlink = vi.fn((_path: string, callback: (error?: Error) => void) => callback())
  stat = vi.fn((_path: string, callback: (error: Error | undefined, stats: unknown) => void) =>
    callback(undefined, {
      isDirectory: () => false,
      size: this.contents.byteLength
    })
  )
  open = vi.fn(
    (_path: string, _flags: string, callback: (error: Error | undefined, handle: Buffer) => void) =>
      callback(undefined, this.handle)
  )
  read = vi.fn(
    (
      _handle: Buffer,
      buffer: Buffer,
      offset: number,
      length: number,
      position: number,
      callback: (error: Error | undefined, bytesRead: number) => void
    ) => {
      const slice = this.contents.subarray(position, position + length)
      slice.copy(buffer, offset)
      callback(undefined, slice.byteLength)
    }
  )
  write = vi.fn(
    (
      _handle: Buffer,
      _buffer: Buffer,
      _offset: number,
      _length: number,
      _position: number,
      callback: (error?: Error) => void
    ) => callback()
  )
  close = vi.fn((_handle: Buffer, callback: (error?: Error) => void) => callback())
}

class FakeClient extends EventEmitter {
  connect = vi.fn()
  end = vi.fn()
  exec = vi.fn((_command: string, callback) => {
    const stdout = new EventEmitter()
    const stderr = new EventEmitter()
    const channel = Object.assign(stdout, { stderr })
    callback(undefined, channel)
    queueMicrotask(() => {
      stdout.emit('data', Buffer.from('/bin/bash\n'))
      stdout.emit('close', 0)
    })
    return this
  })
  shell = vi.fn((_options, callback) => callback(undefined, new FakeChannel()))
  sftp = vi.fn((callback) => callback(undefined, new FakeSftp()))
}

async function connectWorkerSession(worker: SshCoreSessionWorker, client: FakeClient) {
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
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'state', phase: 'attach' })
    )
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

  it('installs shell integration inline for compatible shells without remote temp files', async () => {
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
      commandHistory: true,
      terminal: { cols: 80, rows: 24 }
    })
    client.emit('ready')
    await promise

    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'shellIntegrationInstall', sessionId: 'session-1' })
    )
    expect(channel.write).toHaveBeenCalledWith(expect.any(String))
    const written = channel.write.mock.calls[0]?.[0] as string
    expect(written).not.toContain('.winssh_init_')
    expect(written).not.toContain(' && rm -f ')
    expect(written).toMatch(/\r$/)
  })

  it('installs cwd-only shell integration when command history is disabled', async () => {
    const client = new FakeClient()
    const channel = new FakeChannel()
    client.shell = vi.fn((_options, callback) => callback(undefined, channel))
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
      commandHistory: false,
      terminal: { cols: 80, rows: 24 }
    })
    client.emit('ready')
    await promise

    expect(channel.write).toHaveBeenCalledWith(expect.any(String))
    const written = channel.write.mock.calls[0]?.[0] as string
    expect(written).toContain('133;P;Cwd=')
    expect(written).not.toContain('633;Eh;')
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

  it('runs retained sftp directory and file operations through the worker wrapper', async () => {
    const client = new FakeClient()
    const sftp = new FakeSftp()
    client.sftp = vi.fn((callback) => callback(undefined, sftp))
    const worker = new SshCoreSessionWorker({
      createClient: () => client as never,
      postMessage: vi.fn()
    })

    await connectWorkerSession(worker, client)

    const result = await worker.listDirectory('session-1', '/tmp/project')
    await worker.createFile('session-1', '/tmp/project/new.txt')
    await worker.makeDirectory('session-1', '/tmp/project/new-dir')
    await worker.rename('session-1', '/tmp/project/new.txt', '/tmp/project/renamed.txt')
    await worker.remove('session-1', '/tmp/project/renamed.txt')

    expect(result).toMatchObject({
      path: '/tmp/project',
      entries: [
        {
          name: 'notes.txt',
          path: '/tmp/project/notes.txt',
          kind: 'file',
          size: 12
        }
      ]
    })
    expect((sftp as unknown as { readdir: unknown }).readdir).toHaveBeenCalledWith(
      '/tmp/project',
      expect.any(Function)
    )
    expect(sftp.open).toHaveBeenCalledWith('/tmp/project/new.txt', 'w', expect.any(Function))
    expect(sftp.close).toHaveBeenCalledOnce()
    expect((sftp as unknown as { mkdir: unknown }).mkdir).toHaveBeenCalledWith(
      '/tmp/project/new-dir',
      expect.any(Function)
    )
    expect((sftp as unknown as { rename: unknown }).rename).toHaveBeenCalledWith(
      '/tmp/project/new.txt',
      '/tmp/project/renamed.txt',
      expect.any(Function)
    )
    expect((sftp as unknown as { unlink: unknown }).unlink).toHaveBeenCalledWith(
      '/tmp/project/renamed.txt',
      expect.any(Function)
    )
  })

  it('streams text file chunks through sftp open and read', async () => {
    const client = new FakeClient()
    const sftp = new FakeSftp(Buffer.from('alpha\nbeta\n'))
    client.sftp = vi.fn((callback) => callback(undefined, sftp))
    const postMessage = vi.fn()
    const worker = new SshCoreSessionWorker({
      createClient: () => client as never,
      postMessage
    })

    await connectWorkerSession(worker, client)

    const start = await worker.openFileReadStream('session-1', '/tmp/a.txt')
    const earlyFileEvents = postMessage.mock.calls
      .map(([message]) => message)
      .filter(
        (message) =>
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          (message.type === 'sftp:fileChunk' || message.type === 'sftp:fileStreamState')
      )
    expect(earlyFileEvents).toHaveLength(0)
    worker.startFileReadStream(start.streamId)

    expect(start).toMatchObject({
      streamId: expect.any(String),
      sessionId: 'session-1',
      remotePath: '/tmp/a.txt',
      fileName: 'a.txt',
      total: 11,
      encoding: 'utf8'
    })
    await vi.waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sftp:fileStreamState',
          streamId: start.streamId,
          status: 'completed',
          transferred: 11,
          total: 11
        })
      )
    )
    const chunks = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message): message is { type: string; streamId: string; chunk: string } => {
        return (
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'sftp:fileChunk'
        )
      })
      .filter((message) => message.streamId === start.streamId)

    expect(chunks.map((message) => message.chunk).join('')).toBe('alpha\nbeta\n')
    expect(sftp.open).toHaveBeenCalledWith('/tmp/a.txt', 'r', expect.any(Function))
    expect(sftp.read).toHaveBeenCalled()
    expect(sftp.close).toHaveBeenCalledOnce()
    expect(sftp.readFile).not.toHaveBeenCalled()
  })

  it('keeps probing past an ASCII-only initial sample before streaming GBK text', async () => {
    const client = new FakeClient()
    const text = `${'a'.repeat(32768)}这是一段比较长的中文文本用来测试编码检测功能是否正常工作`
    const sftp = new FakeSftp(iconv.encode(text, 'gbk'))
    client.sftp = vi.fn((callback) => callback(undefined, sftp))
    const postMessage = vi.fn()
    const worker = new SshCoreSessionWorker({
      createClient: () => client as never,
      postMessage
    })

    await connectWorkerSession(worker, client)

    const start = await worker.openFileReadStream('session-1', '/tmp/a.txt')
    expect(start.encoding).toBe('gbk')
    worker.startFileReadStream(start.streamId)

    await vi.waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sftp:fileStreamState',
          streamId: start.streamId,
          status: 'completed'
        })
      )
    )
    const chunks = postMessage.mock.calls
      .map(([message]) => message)
      .filter((message): message is { type: string; streamId: string; chunk: string } => {
        return (
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'sftp:fileChunk'
        )
      })
      .filter((message) => message.streamId === start.streamId)

    expect(chunks.map((message) => message.chunk).join('')).toBe(text)
  })

  it('writes text file chunks sequentially through sftp write offsets', async () => {
    const client = new FakeClient()
    const sftp = new FakeSftp()
    client.sftp = vi.fn((callback) => callback(undefined, sftp))
    const postMessage = vi.fn()
    const worker = new SshCoreSessionWorker({
      createClient: () => client as never,
      postMessage
    })
    const positions: number[] = []
    let releaseFirstWrite: ((error?: Error) => void) | null = null
    sftp.write.mockImplementation(
      (
        _handle: Buffer,
        _buffer: Buffer,
        _offset: number,
        _length: number,
        position: number,
        callback: (error?: Error) => void
      ) => {
        positions.push(position)
        if (positions.length === 1) {
          releaseFirstWrite = callback
          return
        }
        callback()
      }
    )

    await connectWorkerSession(worker, client)

    const start = await worker.openFileWriteStream('session-1', '/tmp/a.txt', 'utf8')
    const firstWrite = worker.writeFileChunk(start.streamId, 'alpha')
    const secondWrite = worker.writeFileChunk(start.streamId, '\nbeta')

    await vi.waitFor(() => expect(positions).toEqual([0]))
    releaseFirstWrite?.()
    await firstWrite
    await secondWrite
    await worker.closeFileWriteStream(start.streamId)

    expect(positions).toEqual([0, 5])
    expect(sftp.open).toHaveBeenCalledWith('/tmp/a.txt', 'w', expect.any(Function))
    expect(sftp.writeFile).not.toHaveBeenCalled()
    expect(sftp.close).toHaveBeenCalledOnce()
    expect(postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sftp:fileStreamState',
        streamId: start.streamId,
        status: 'completed',
        transferred: 10,
        total: 10
      })
    )
  })

  it('rejects a committed write stream when the remote close fails', async () => {
    const client = new FakeClient()
    const sftp = new FakeSftp()
    sftp.close.mockImplementation((_handle: Buffer, callback: (error?: Error) => void) => {
      callback(new Error('remote close failed'))
    })
    client.sftp = vi.fn((callback) => callback(undefined, sftp))
    const postMessage = vi.fn()
    const worker = new SshCoreSessionWorker({
      createClient: () => client as never,
      postMessage
    })

    await connectWorkerSession(worker, client)

    const start = await worker.openFileWriteStream('session-1', '/tmp/a.txt', 'utf8')
    await worker.writeFileChunk(start.streamId, 'alpha')

    await expect(worker.closeFileWriteStream(start.streamId)).rejects.toThrow('remote close failed')
    await expect(worker.writeFileChunk(start.streamId, 'late')).rejects.toThrow(
      /stream unavailable|remote close failed/i
    )

    const states = postMessage.mock.calls
      .map(([message]) => message)
      .filter(
        (message): message is { type: string; streamId: string; status: string } =>
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'sftp:fileStreamState' &&
          'streamId' in message &&
          message.streamId === start.streamId
      )

    expect(states.some((event) => event.status === 'error')).toBe(true)
    expect(states.some((event) => event.status === 'completed')).toBe(false)
  })

  it('fails a write stream after a chunk write error and rejects queued chunks', async () => {
    const client = new FakeClient()
    const sftp = new FakeSftp()
    client.sftp = vi.fn((callback) => callback(undefined, sftp))
    const postMessage = vi.fn()
    const worker = new SshCoreSessionWorker({
      createClient: () => client as never,
      postMessage
    })
    const positions: number[] = []
    let releaseFirstWrite: ((error?: Error) => void) | null = null
    sftp.write.mockImplementation(
      (
        _handle: Buffer,
        _buffer: Buffer,
        _offset: number,
        _length: number,
        position: number,
        callback: (error?: Error) => void
      ) => {
        positions.push(position)
        if (positions.length === 1) {
          releaseFirstWrite = callback
          return
        }
        callback()
      }
    )

    await connectWorkerSession(worker, client)

    const start = await worker.openFileWriteStream('session-1', '/tmp/a.txt', 'utf8')
    const firstWrite = worker.writeFileChunk(start.streamId, 'alpha')
    const secondWrite = worker.writeFileChunk(start.streamId, '\nbeta')

    await vi.waitFor(() => expect(positions).toEqual([0]))
    releaseFirstWrite?.(new Error('remote disk full'))

    await expect(firstWrite).rejects.toThrow('remote disk full')
    await expect(secondWrite).rejects.toThrow(/stream unavailable|remote disk full/i)
    await expect(worker.closeFileWriteStream(start.streamId)).rejects.toThrow(
      /stream unavailable|remote disk full/i
    )

    expect(positions).toEqual([0])
    expect(sftp.close).toHaveBeenCalledOnce()
    const states = postMessage.mock.calls
      .map(([message]) => message)
      .filter(
        (message): message is { type: string; streamId: string; status: string } =>
          typeof message === 'object' &&
          message !== null &&
          'type' in message &&
          message.type === 'sftp:fileStreamState' &&
          'streamId' in message &&
          message.streamId === start.streamId
      )
    expect(states.some((event) => event.status === 'error')).toBe(true)
    expect(states.some((event) => event.status === 'completed')).toBe(false)
  })
})
