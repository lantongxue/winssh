import { createSshCoreMessageHandler } from '@main/workers/ssh-core'

describe('ssh-core worker entry', () => {
  it('acknowledges successful commands', async () => {
    const sessionWorker = {
      connect: vi.fn(async () => undefined),
      write: vi.fn(),
      resolveHostTrust: vi.fn()
    }
    const postMessage = vi.fn()
    const handleMessage = createSshCoreMessageHandler(sessionWorker as never, postMessage)

    await handleMessage({
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

    expect(sessionWorker.connect).toHaveBeenCalledOnce()
    expect(postMessage).toHaveBeenCalledWith({ type: 'ack', requestId: 'req-1', ok: true })
  })

  it('returns command results in acknowledgements', async () => {
    const sessionWorker = {
      openFileReadStream: vi.fn(async () => ({
        streamId: 'worker-read-1',
        sessionId: 'session-1',
        remotePath: '/tmp/a.txt',
        fileName: 'a.txt',
        total: 5,
        encoding: 'utf8'
      })),
      startFileReadStream: vi.fn(),
      resolveHostTrust: vi.fn()
    }
    const postMessage = vi.fn()
    const handleMessage = createSshCoreMessageHandler(sessionWorker as never, postMessage)

    await handleMessage({
      type: 'sftp:openFileReadStream',
      requestId: 'req-2',
      sessionId: 'session-1',
      correlationId: 'session-1',
      remotePath: '/tmp/a.txt'
    })

    expect(sessionWorker.openFileReadStream).toHaveBeenCalledWith('session-1', '/tmp/a.txt')
    expect(postMessage).toHaveBeenCalledWith({
      type: 'ack',
      requestId: 'req-2',
      ok: true,
      result: {
        streamId: 'worker-read-1',
        sessionId: 'session-1',
        remotePath: '/tmp/a.txt',
        fileName: 'a.txt',
        total: 5,
        encoding: 'utf8'
      }
    })
  })

  it('starts read streams only after acknowledging the open request', async () => {
    const postMessage = vi.fn()
    const sessionWorker = {
      openFileReadStream: vi.fn(async () => ({
        streamId: 'worker-read-1',
        sessionId: 'session-1',
        remotePath: '/tmp/a.txt',
        fileName: 'a.txt',
        total: 5,
        encoding: 'utf8'
      })),
      startFileReadStream: vi.fn((streamId: string) => {
        postMessage({
          type: 'sftp:fileChunk',
          streamId,
          sessionId: 'session-1',
          remotePath: '/tmp/a.txt',
          chunk: 'hello',
          transferred: 5,
          total: 5
        })
      }),
      resolveHostTrust: vi.fn()
    }
    const handleMessage = createSshCoreMessageHandler(sessionWorker as never, postMessage)

    await handleMessage({
      type: 'sftp:openFileReadStream',
      requestId: 'req-read',
      sessionId: 'session-1',
      correlationId: 'session-1',
      remotePath: '/tmp/a.txt'
    })

    expect(postMessage.mock.calls.map(([message]) => (message as { type: string }).type)).toEqual([
      'ack',
      'sftp:fileChunk'
    ])
    expect(sessionWorker.startFileReadStream).toHaveBeenCalledWith('worker-read-1')
  })

  it('routes file stream write commands', async () => {
    const sessionWorker = {
      openFileWriteStream: vi.fn(async () => ({
        streamId: 'worker-write-1',
        sessionId: 'session-1',
        remotePath: '/tmp/a.txt'
      })),
      writeFileChunk: vi.fn(async () => undefined),
      closeFileWriteStream: vi.fn(async () => undefined),
      cancelFileStream: vi.fn(async () => undefined),
      resolveHostTrust: vi.fn()
    }
    const postMessage = vi.fn()
    const handleMessage = createSshCoreMessageHandler(sessionWorker as never, postMessage)

    await handleMessage({
      type: 'sftp:openFileWriteStream',
      requestId: 'req-open',
      sessionId: 'session-1',
      correlationId: 'session-1',
      remotePath: '/tmp/a.txt',
      encoding: 'utf8'
    })
    await handleMessage({
      type: 'sftp:writeFileChunk',
      requestId: 'req-chunk',
      streamId: 'worker-write-1',
      chunk: 'hello'
    })
    await handleMessage({
      type: 'sftp:closeFileWriteStream',
      requestId: 'req-close',
      streamId: 'worker-write-1'
    })
    await handleMessage({
      type: 'sftp:cancelFileStream',
      requestId: 'req-cancel',
      streamId: 'worker-write-1'
    })

    expect(sessionWorker.openFileWriteStream).toHaveBeenCalledWith(
      'session-1',
      '/tmp/a.txt',
      'utf8'
    )
    expect(sessionWorker.writeFileChunk).toHaveBeenCalledWith('worker-write-1', 'hello')
    expect(sessionWorker.closeFileWriteStream).toHaveBeenCalledWith('worker-write-1')
    expect(sessionWorker.cancelFileStream).toHaveBeenCalledWith('worker-write-1')
    expect(postMessage).toHaveBeenCalledWith({
      type: 'ack',
      requestId: 'req-open',
      ok: true,
      result: {
        streamId: 'worker-write-1',
        sessionId: 'session-1',
        remotePath: '/tmp/a.txt'
      }
    })
  })

  it('routes retained sftp directory and file operation commands', async () => {
    const listResult = { path: '/tmp', entries: [] }
    const sessionWorker = {
      listDirectory: vi.fn(async () => listResult),
      createFile: vi.fn(async () => undefined),
      makeDirectory: vi.fn(async () => undefined),
      rename: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
      resolveHostTrust: vi.fn()
    }
    const postMessage = vi.fn()
    const handleMessage = createSshCoreMessageHandler(sessionWorker as never, postMessage)

    await handleMessage({
      type: 'sftp:listDirectory',
      requestId: 'req-list',
      sessionId: 'session-1',
      correlationId: 'session-1',
      remotePath: '/tmp'
    })
    await handleMessage({
      type: 'sftp:createFile',
      requestId: 'req-create',
      sessionId: 'session-1',
      correlationId: 'session-1',
      remotePath: '/tmp/new.txt'
    })
    await handleMessage({
      type: 'sftp:makeDirectory',
      requestId: 'req-mkdir',
      sessionId: 'session-1',
      correlationId: 'session-1',
      remotePath: '/tmp/new-dir'
    })
    await handleMessage({
      type: 'sftp:rename',
      requestId: 'req-rename',
      sessionId: 'session-1',
      correlationId: 'session-1',
      sourcePath: '/tmp/new.txt',
      targetPath: '/tmp/renamed.txt'
    })
    await handleMessage({
      type: 'sftp:remove',
      requestId: 'req-remove',
      sessionId: 'session-1',
      correlationId: 'session-1',
      remotePath: '/tmp/renamed.txt'
    })

    expect(sessionWorker.listDirectory).toHaveBeenCalledWith('session-1', '/tmp')
    expect(sessionWorker.createFile).toHaveBeenCalledWith('session-1', '/tmp/new.txt')
    expect(sessionWorker.makeDirectory).toHaveBeenCalledWith('session-1', '/tmp/new-dir')
    expect(sessionWorker.rename).toHaveBeenCalledWith(
      'session-1',
      '/tmp/new.txt',
      '/tmp/renamed.txt'
    )
    expect(sessionWorker.remove).toHaveBeenCalledWith('session-1', '/tmp/renamed.txt')
    expect(postMessage).toHaveBeenCalledWith({
      type: 'ack',
      requestId: 'req-list',
      ok: true,
      result: listResult
    })
    expect(postMessage).toHaveBeenCalledWith({ type: 'ack', requestId: 'req-create', ok: true })
    expect(postMessage).toHaveBeenCalledWith({ type: 'ack', requestId: 'req-mkdir', ok: true })
    expect(postMessage).toHaveBeenCalledWith({ type: 'ack', requestId: 'req-rename', ok: true })
    expect(postMessage).toHaveBeenCalledWith({ type: 'ack', requestId: 'req-remove', ok: true })
  })

  it('routes host trust results without sending an acknowledgement', async () => {
    const sessionWorker = {
      resolveHostTrust: vi.fn()
    }
    const postMessage = vi.fn()
    const handleMessage = createSshCoreMessageHandler(sessionWorker as never, postMessage)

    await handleMessage({
      type: 'hostTrustResult',
      requestId: 'host-1',
      ok: true,
      trusted: true
    })

    expect(sessionWorker.resolveHostTrust).toHaveBeenCalledWith('host-1', true)
    expect(postMessage).not.toHaveBeenCalled()
  })

  it('acknowledges command failures', async () => {
    const sessionWorker = {
      disconnect: vi.fn(() => {
        throw new Error('boom')
      }),
      resolveHostTrust: vi.fn()
    }
    const postMessage = vi.fn()
    const handleMessage = createSshCoreMessageHandler(sessionWorker as never, postMessage)

    await handleMessage({
      type: 'disconnect',
      requestId: 'req-3',
      sessionId: 'session-1',
      correlationId: 'session-1'
    })

    expect(postMessage).toHaveBeenCalledWith({
      type: 'ack',
      requestId: 'req-3',
      ok: false,
      message: 'boom'
    })
  })
})
