import { EventEmitter } from 'node:events'
import { encodeSshDataFrame } from '@shared/ssh-data-frame'
import type { SftpFileChunkEvent, SftpFileStreamStateEvent } from '@shared/types'
import { WorkerSessionRuntime } from '@main/services/worker-session-runtime'

class FakeWorker extends EventEmitter {
  posted: unknown[] = []
  postMessage = vi.fn((message: unknown) => {
    this.posted.push(message)
  })
  terminate = vi.fn(async () => 0)
}

function encodeHex(text: string): string {
  return Buffer.from(text, 'utf8').toString('hex')
}

function createFrame(payload: string, seq = 1) {
  return encodeSshDataFrame({
    seq,
    sentAtMs: Date.now(),
    payload: Buffer.from(payload)
  })
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
    getSettings: vi.fn(() => ({ commandHistoryEnabled: true })),
    recordCommand: vi.fn((input) => ({ id: 'cmd-1', ...input })),
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

async function connectRuntime(runtime: WorkerSessionRuntime, worker: FakeWorker) {
  const promise = runtime.connect({ serverId: 'server-1', sessionId: 'session-1' })
  await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(0))
  const connectMessage = worker.posted[0] as { requestId: string }
  worker.emit('message', { type: 'ack', requestId: connectMessage.requestId, ok: true })
  return promise
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

  it('keeps cwd integration enabled when command history is disabled', async () => {
    const { database, runtime, sendToRenderer, worker } = createRuntime()
    database.getServerById.mockImplementation((id: string) =>
      id === 'server-1' ? createServer({ captureCommandHistory: false }) : null
    )

    const result = await connectRuntime(runtime, worker)

    expect(result.ok).toBe(true)
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'connect',
        config: expect.objectContaining({ commandHistory: false })
      })
    )

    const frame = createFrame(
      [
        `\x1b]633;Eh;${encodeHex('cat secret.txt')}\x07`,
        '\x1b]133;D;0\x07',
        '\x1b]133;P;Cwd=/srv/app\x07'
      ].join('')
    )
    worker.emit('message', {
      type: 'data',
      sessionId: 'session-1',
      correlationId: 'session-1',
      frame,
      seq: 1
    })

    expect(sendToRenderer).toHaveBeenCalledWith(
      'sessions:cwdChanged',
      expect.objectContaining({ sessionId: 'session-1', cwd: '/srv/app' })
    )
    expect(database.recordCommand).not.toHaveBeenCalled()
  })

  it('decodes worker data frames into existing renderer events', async () => {
    const { runtime, sendToRenderer, worker } = createRuntime()
    const promise = runtime.connect({ serverId: 'server-1', sessionId: 'session-1' })
    await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(0))
    const connectMessage = worker.posted[0] as { requestId: string }

    worker.emit('message', { type: 'ack', requestId: connectMessage.requestId, ok: true })
    await promise

    const frame = createFrame('hello')
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

  it('bridges file read streams through the connected ssh-core worker session', async () => {
    const { runtime, sendToRenderer, worker } = createRuntime()
    await connectRuntime(runtime, worker)

    const startPromise = runtime.openFileReadStream('session-1', '/etc/app.conf')
    await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(1))
    const readMessage = worker.posted[1] as { requestId: string; type: string }

    expect(readMessage).toMatchObject({
      type: 'sftp:openFileReadStream',
      sessionId: 'session-1',
      remotePath: '/etc/app.conf'
    })
    expect(readMessage.type).not.toBe('sftp:readFile')
    worker.emit('message', {
      type: 'ack',
      requestId: readMessage.requestId,
      ok: true,
      result: {
        streamId: 'worker-read-1',
        sessionId: 'session-1',
        remotePath: '/etc/app.conf',
        fileName: 'app.conf',
        total: 11,
        encoding: 'utf8'
      }
    })

    const start = await startPromise

    expect(start).toMatchObject({
      encoding: 'utf8',
      fileName: 'app.conf',
      remotePath: '/etc/app.conf',
      sessionId: 'session-1',
      total: 11
    })
    expect(start.streamId).toBe('worker-read-1')

    worker.emit('message', {
      type: 'sftp:fileChunk',
      streamId: start.streamId,
      sessionId: 'session-1',
      remotePath: '/etc/app.conf',
      chunk: 'alpha\nbeta\n',
      transferred: 11,
      total: 11
    })
    worker.emit('message', {
      type: 'sftp:fileStreamState',
      streamId: start.streamId,
      sessionId: 'session-1',
      remotePath: '/etc/app.conf',
      direction: 'download',
      status: 'completed',
      transferred: 11,
      total: 11
    })

    expect(sendToRenderer).toHaveBeenCalledWith(
      'sftp:fileChunk',
      expect.objectContaining({
        streamId: start.streamId,
        chunk: 'alpha\nbeta\n',
        transferred: 11,
        total: 11
      } satisfies Partial<SftpFileChunkEvent>)
    )
    expect(sendToRenderer).toHaveBeenCalledWith(
      'sftp:fileStreamState',
      expect.objectContaining({
        streamId: start.streamId,
        status: 'completed',
        transferred: 11,
        total: 11
      } satisfies Partial<SftpFileStreamStateEvent>)
    )
    expect(sendToRenderer).toHaveBeenCalledWith(
      'sftp:transfer',
      expect.objectContaining({
        sessionId: 'session-1',
        direction: 'download',
        fileName: 'app.conf',
        localPath: '__editor__',
        remotePath: '/etc/app.conf',
        transferred: 11,
        total: 11,
        status: 'completed'
      })
    )
  })

  it('bridges file write stream chunks through the connected ssh-core worker session', async () => {
    const { runtime, sendToRenderer, worker } = createRuntime()
    await connectRuntime(runtime, worker)

    const startPromise = runtime.openFileWriteStream('session-1', '/etc/app.conf', 'utf8')
    await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(1))
    const openMessage = worker.posted[1] as { requestId: string; type: string }

    expect(openMessage).toMatchObject({
      type: 'sftp:openFileWriteStream',
      sessionId: 'session-1',
      remotePath: '/etc/app.conf',
      encoding: 'utf8'
    })
    worker.emit('message', {
      type: 'ack',
      requestId: openMessage.requestId,
      ok: true,
      result: {
        streamId: 'worker-write-1',
        sessionId: 'session-1',
        remotePath: '/etc/app.conf'
      }
    })
    const start = await startPromise

    const firstWrite = runtime.writeFileChunk(start.streamId, 'alpha')
    await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(2))
    const firstWriteMessage = worker.posted[2] as { requestId: string; type: string }

    expect(firstWriteMessage).toMatchObject({
      type: 'sftp:writeFileChunk',
      streamId: 'worker-write-1',
      chunk: 'alpha'
    })
    worker.emit('message', { type: 'ack', requestId: firstWriteMessage.requestId, ok: true })
    await firstWrite

    const secondWrite = runtime.writeFileChunk(start.streamId, '\nbeta')
    await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(3))
    const secondWriteMessage = worker.posted[3] as { requestId: string; type: string }

    expect(secondWriteMessage).toMatchObject({
      type: 'sftp:writeFileChunk',
      streamId: 'worker-write-1',
      chunk: '\nbeta'
    })
    worker.emit('message', { type: 'ack', requestId: secondWriteMessage.requestId, ok: true })
    await secondWrite

    const closePromise = runtime.closeFileWriteStream(start.streamId)
    await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(4))
    const closeMessage = worker.posted[4] as { requestId: string; type: string }

    expect(closeMessage).toMatchObject({
      type: 'sftp:closeFileWriteStream',
      streamId: 'worker-write-1'
    })
    expect(worker.posted).not.toContainEqual(expect.objectContaining({ type: 'sftp:writeFile' }))
    worker.emit('message', { type: 'ack', requestId: closeMessage.requestId, ok: true })
    worker.emit('message', {
      type: 'sftp:fileStreamState',
      streamId: start.streamId,
      sessionId: 'session-1',
      remotePath: '/etc/app.conf',
      direction: 'upload',
      status: 'completed',
      transferred: 10,
      total: 10
    })
    await closePromise

    expect(sendToRenderer).toHaveBeenCalledWith(
      'sftp:fileStreamState',
      expect.objectContaining({
        streamId: start.streamId,
        status: 'completed',
        transferred: 10,
        total: 10
      } satisfies Partial<SftpFileStreamStateEvent>)
    )
  })

  it('cancels worker file streams using the stream protocol', async () => {
    const { runtime, worker } = createRuntime()
    await connectRuntime(runtime, worker)

    const startPromise = runtime.openFileWriteStream('session-1', '/etc/app.conf', 'utf8')
    await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(1))
    const openMessage = worker.posted[1] as { requestId: string }
    worker.emit('message', {
      type: 'ack',
      requestId: openMessage.requestId,
      ok: true,
      result: {
        streamId: 'worker-write-1',
        sessionId: 'session-1',
        remotePath: '/etc/app.conf'
      }
    })
    const start = await startPromise

    runtime.cancelFileStream(start.streamId)

    await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(2))
    expect(worker.posted[2]).toMatchObject({
      type: 'sftp:cancelFileStream',
      streamId: 'worker-write-1'
    })
  })

  it('clears active editor file streams when the ssh-core worker crashes', async () => {
    const { runtime, worker } = createRuntime()
    await connectRuntime(runtime, worker)

    const startPromise = runtime.openFileWriteStream('session-1', '/etc/app.conf', 'utf8')
    await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(1))
    const openMessage = worker.posted[1] as { requestId: string }
    worker.emit('message', {
      type: 'ack',
      requestId: openMessage.requestId,
      ok: true,
      result: {
        streamId: 'worker-write-1',
        sessionId: 'session-1',
        remotePath: '/etc/app.conf'
      }
    })
    const start = await startPromise
    const editorStreams = Reflect.get(runtime as object, 'editorFileStreams') as Map<
      string,
      unknown
    >
    expect(editorStreams.has(start.streamId)).toBe(true)

    runtime.handleWorkerCrash('session-1', 1)

    expect(editorStreams.has(start.streamId)).toBe(false)
    await expect(runtime.writeFileChunk(start.streamId, 'late')).rejects.toThrow(
      /stream unavailable/i
    )
  })

  it('forwards worker data frames to the data aggregator when available', () => {
    const routeFrame = vi.fn()
    const { runtime } = createRuntime()

    runtime.setDataAggregator({ routeFrame } as never)
    const frame = createFrame('hello')
    runtime.handleWorkerMessage({
      type: 'data',
      sessionId: 'session-1',
      correlationId: 'session-1',
      frame,
      seq: 1
    })

    expect(routeFrame).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', seq: 1 })
    )
  })

  it('strips OSC integration markers from worker data and records command history', async () => {
    const { database, runtime, sendToRenderer, worker } = createRuntime()
    database.getServerById.mockImplementation((id: string) =>
      id === 'server-1' ? createServer({ captureCommandHistory: true }) : null
    )
    const promise = runtime.connect({ serverId: 'server-1', sessionId: 'session-1' })
    await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(0))
    const connectMessage = worker.posted[0] as { requestId: string }

    worker.emit('message', { type: 'ack', requestId: connectMessage.requestId, ok: true })
    await promise

    const frame = createFrame(
      [
        'before',
        `\x1b]633;Eh;${encodeHex('ls -la')}\x07`,
        '\x1b]133;D;0\x07',
        '\x1b]133;P;Cwd=/var/log\x07',
        'after'
      ].join('')
    )
    worker.emit('message', {
      type: 'data',
      sessionId: 'session-1',
      correlationId: 'session-1',
      frame,
      seq: 1
    })

    expect(sendToRenderer).toHaveBeenCalledWith(
      'sessions:data',
      expect.objectContaining({ sessionId: 'session-1', data: 'beforeafter' })
    )
    expect(sendToRenderer).toHaveBeenCalledWith(
      'sessions:cwdChanged',
      expect.objectContaining({ sessionId: 'session-1', cwd: '/var/log' })
    )
    expect(database.recordCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'ls -la',
        cwd: '/',
        exitCode: 0,
        scope: { kind: 'ssh', serverId: 'server-1' }
      })
    )
    expect(sendToRenderer).toHaveBeenCalledWith(
      'commandHistory:added',
      expect.objectContaining({
        entry: expect.objectContaining({ command: 'ls -la' }),
        scope: { kind: 'ssh', serverId: 'server-1' }
      })
    )
  })

  it('flushes worker output if shell integration install echo is not observed', async () => {
    vi.useFakeTimers()

    try {
      const { runtime, sendToRenderer, worker } = createRuntime()
      const promise = runtime.connect({ serverId: 'server-1', sessionId: 'session-1' })
      await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(0))
      const connectMessage = worker.posted[0] as { requestId: string }

      worker.emit('message', { type: 'ack', requestId: connectMessage.requestId, ok: true })
      await promise

      runtime.handleWorkerMessage({
        type: 'shellIntegrationInstall',
        sessionId: 'session-1',
        correlationId: 'session-1'
      })
      runtime.handleWorkerMessage({
        type: 'data',
        sessionId: 'session-1',
        correlationId: 'session-1',
        frame: createFrame('prompt$ '),
        seq: 1
      })

      expect(sendToRenderer).not.toHaveBeenCalledWith(
        'sessions:data',
        expect.objectContaining({ sessionId: 'session-1', data: 'prompt$ ' })
      )

      await vi.advanceTimersByTimeAsync(1000)

      expect(sendToRenderer).toHaveBeenCalledWith(
        'sessions:data',
        expect.objectContaining({ sessionId: 'session-1', data: 'prompt$ ' })
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not flush buffered shell integration output after disconnect', async () => {
    vi.useFakeTimers()

    try {
      const { runtime, sendToRenderer, worker } = createRuntime()
      const promise = runtime.connect({ serverId: 'server-1', sessionId: 'session-1' })
      await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(0))
      const connectMessage = worker.posted[0] as { requestId: string }

      worker.emit('message', { type: 'ack', requestId: connectMessage.requestId, ok: true })
      await promise

      runtime.handleWorkerMessage({
        type: 'shellIntegrationInstall',
        sessionId: 'session-1',
        correlationId: 'session-1'
      })
      runtime.handleWorkerMessage({
        type: 'data',
        sessionId: 'session-1',
        correlationId: 'session-1',
        frame: createFrame('prompt$ '),
        seq: 1
      })

      const disconnectPromise = runtime.disconnect('session-1')
      await vi.waitFor(() => expect(worker.posted.length).toBeGreaterThan(1))
      const disconnectMessage = worker.posted[1] as { requestId: string }
      worker.emit('message', { type: 'ack', requestId: disconnectMessage.requestId, ok: true })
      await disconnectPromise
      sendToRenderer.mockClear()

      await vi.advanceTimersByTimeAsync(1000)

      expect(sendToRenderer).not.toHaveBeenCalledWith(
        'sessions:data',
        expect.objectContaining({ sessionId: 'session-1', data: 'prompt$ ' })
      )
    } finally {
      vi.useRealTimers()
    }
  })
})
