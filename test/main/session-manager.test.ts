import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import net, { type AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { dialog } from 'electron'
import iconv from 'iconv-lite'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SESSION_RESOURCE_MONITOR_UNAVAILABLE } from '@shared/types'
import type { SftpFileChunkEvent, SftpFileStreamStateEvent } from '@shared/types'

vi.mock('electron', () => ({
  dialog: {
    showMessageBox: vi.fn(),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
  }
}))

import { formatRemoteEntryPermissions, SessionManager } from '@main/session-manager'

class MockClient extends EventEmitter {
  exec = vi.fn(
    (
      _command: string,
      callback?: (error: Error | undefined, channel: PassThrough & { stderr: PassThrough }) => void
    ) => {
      const behavior = execBehaviors.shift() ?? { error: new Error('missing exec behavior') }
      if ('error' in behavior) {
        callback?.(behavior.error, undefined as never)
        return this
      }

      const channel = new PassThrough() as PassThrough & { stderr: PassThrough }
      channel.stderr = new PassThrough()
      callback?.(undefined, channel)

      queueMicrotask(() => {
        if (behavior.stdout) {
          channel.write(behavior.stdout)
        }
        if (behavior.stderr) {
          channel.stderr.write(behavior.stderr)
        }

        channel.emit('close', behavior.code ?? 0)
        channel.end()
        channel.stderr.end()
      })

      return this
    }
  )
  end = vi.fn()
  forwardIn = vi.fn(
    (
      _: string,
      port: number,
      callback?: (error?: Error | undefined, assignedPort?: number) => void
    ) => {
      callback?.(undefined, port)
      return this
    }
  )
  unforwardIn = vi.fn((_: string, __: number, callback?: (error?: Error | undefined) => void) => {
    callback?.()
    return this
  })
  forwardOut = vi.fn(
    (
      _: string,
      __: number,
      ___: string,
      ____: number,
      callback?: (error: Error | undefined, stream: PassThrough) => void
    ) => {
      callback?.(undefined, new PassThrough())
      return this
    }
  )
}

type ExecBehavior =
  | {
      code?: number
      stderr?: string
      stdout: string
    }
  | {
      error: Error
    }

const execBehaviors: ExecBehavior[] = []
const temporaryPaths: string[] = []

function createManager() {
  return new SessionManager(
    {
      getKnownHost: vi.fn(),
      getServerById: vi.fn(),
      recordRecentSession: vi.fn(),
      upsertKnownHost: vi.fn(),
      getSettings: vi.fn(() => ({
        sftpUploadConcurrency: 3,
        sftpDownloadConcurrency: 3
      }))
    } as never,
    () => null,
    vi.fn() as never,
    ((key: string) => key) as never
  )
}

function createRuntime(sessionId: string, client: MockClient) {
  const shell = new PassThrough() as PassThrough & {
    stderr: PassThrough
    setWindow: ReturnType<typeof vi.fn>
    write: ReturnType<typeof vi.fn>
  }
  shell.stderr = new PassThrough()
  shell.setWindow = vi.fn()
  shell.write = vi.fn()

  return {
    sessionId,
    client,
    upstreamClients: [],
    shell,
    sftp: {} as never,
    summary: {
      sessionId,
      serverId: 'server-1',
      serverName: 'alpha',
      host: '127.0.0.1',
      port: 22,
      status: 'ready' as const,
      connectedAt: new Date().toISOString(),
      currentPath: '/'
    },
    portForwards: new Map(),
    oscState: { pending: '' },
    pendingCommand: { text: null, startedAt: null, cwd: null },
    historyCaptureEnabled: false,
    historyCaptureStatus: 'unavailable' as const
  }
}

function getSessionsMap(manager: SessionManager) {
  return Reflect.get(manager as object, 'sessions') as Map<string, ReturnType<typeof createRuntime>>
}

function getHistoryMap(manager: SessionManager) {
  return Reflect.get(manager as object, 'history') as Map<string, { serverId: string }>
}

function getCpuBaselinesMap(manager: SessionManager) {
  return Reflect.get(manager as object, 'resourceCpuBaselines') as Map<string, unknown>
}

function getNetworkBaselinesMap(manager: SessionManager) {
  return Reflect.get(manager as object, 'resourceNetworkBaselines') as Map<string, unknown>
}

async function waitForFileStreamCompletion(
  emitToRenderer: ReturnType<typeof vi.fn>,
  streamId: string
) {
  await vi.waitFor(() => {
    expect(
      emitToRenderer.mock.calls.some(
        ([channel, payload]) =>
          channel === 'sftp:fileStreamState' &&
          (payload as SftpFileStreamStateEvent).streamId === streamId &&
          (payload as SftpFileStreamStateEvent).status === 'completed'
      )
    ).toBe(true)
  })
}

async function finalizeManagedSession(manager: SessionManager, sessionId: string) {
  const finalizeSession = Reflect.get(manager as object, 'finalizeSession') as (
    targetSessionId: string
  ) => Promise<void>

  await finalizeSession.call(manager, sessionId)
}

async function getAvailablePort() {
  return new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo
      server.close(() => resolve(address.port))
    })
  })
}

async function connectLocal(port: number) {
  return new Promise<net.Socket>((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    socket.once('connect', () => resolve(socket))
    socket.once('error', reject)
  })
}

async function expectConnectionFailure(port: number) {
  return new Promise<string>((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    socket.once('connect', () => {
      socket.end()
      resolve('')
    })
    socket.once('error', (error) => resolve((error as NodeJS.ErrnoException).code ?? 'error'))
  })
}

function createResourceMonitorOutput({
  cpuLine,
  memAvailableKb = 4_096_000,
  memTotalKb = 8_192_000,
  networkInterfaces = [
    '  lo: 100 0 0 0 0 0 0 0 100 0 0 0 0 0 0 0',
    'eth0: 1000 0 0 0 0 0 0 0 2000 0 0 0 0 0 0 0'
  ],
  platform = 'Linux'
}: {
  cpuLine?: string
  memAvailableKb?: number
  memTotalKb?: number
  networkInterfaces?: string[]
  platform?: string
}) {
  const sections = ['__WINSSH_PLATFORM__', platform]

  if (platform === 'Linux') {
    sections.push(
      '__WINSSH_PROC_STAT__',
      cpuLine ?? 'cpu  100 0 100 900 0 0 0 0 0 0',
      '__WINSSH_PROC_MEMINFO__',
      `MemTotal:       ${memTotalKb} kB`,
      `MemAvailable:   ${memAvailableKb} kB`,
      '__WINSSH_PROC_NET_DEV__',
      'Inter-|   Receive                                                |  Transmit',
      ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
      ...networkInterfaces,
      '__WINSSH_DF__',
      'Filesystem     1B-blocks        Used   Available Use% Mounted on',
      '/dev/root      1073741824   268435456   805306368  25% /'
    )
  }

  return `${sections.join('\n')}\n`
}

afterEach(async () => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  execBehaviors.length = 0
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map((targetPath) =>
        fs.rm(targetPath, { recursive: true, force: true }).catch(() => undefined)
      )
  )
})

describe('SessionManager SFTP file streams', () => {
  function createManagerWithSftpEmitSpy() {
    const emitToRenderer = vi.fn()
    const manager = new SessionManager(
      {
        getKnownHost: vi.fn(),
        getServerById: vi.fn(),
        recordRecentSession: vi.fn(),
        upsertKnownHost: vi.fn(),
        getSettings: vi.fn(() => ({
          sftpUploadConcurrency: 3,
          sftpDownloadConcurrency: 3
        }))
      } as never,
      () => null,
      emitToRenderer as never,
      ((key: string) => key) as never
    )
    return { manager, emitToRenderer }
  }

  function createFileSftp(contents: Buffer) {
    const handle = Buffer.from('file-handle')
    return {
      close: vi.fn((_handle: Buffer, callback: (error?: Error) => void) => callback()),
      open: vi.fn(
        (
          _remotePath: string,
          _flags: string,
          callback: (error: Error | undefined, nextHandle: Buffer) => void
        ) => callback(undefined, handle)
      ),
      read: vi.fn(
        (
          _handle: Buffer,
          buffer: Buffer,
          offset: number,
          length: number,
          position: number,
          callback: (error: Error | undefined, bytesRead: number) => void
        ) => {
          const slice = contents.subarray(position, position + length)
          slice.copy(buffer, offset)
          callback(undefined, slice.byteLength)
        }
      ),
      stat: vi.fn(
        (_remotePath: string, callback: (error: Error | undefined, stats: unknown) => void) =>
          callback(undefined, {
            isDirectory: () => false,
            size: contents.byteLength
          })
      ),
      write: vi.fn(
        (
          _handle: Buffer,
          _buffer: Buffer,
          _offset: number,
          _length: number,
          _position: number,
          callback: (error?: Error) => void
        ) => callback()
      )
    }
  }

  it('streams remote file chunks before completion', async () => {
    const { manager, emitToRenderer } = createManagerWithSftpEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())
    runtime.sftp = createFileSftp(Buffer.from('alpha\nbeta\n', 'utf8')) as never
    getSessionsMap(manager).set('session-1', runtime)

    const start = await manager.openFileReadStream('session-1', '/etc/app.conf')

    expect(start).toMatchObject({
      encoding: 'utf8',
      fileName: 'app.conf',
      remotePath: '/etc/app.conf',
      sessionId: 'session-1',
      total: 11
    })
    expect(start.streamId).toEqual(expect.any(String))

    await waitForFileStreamCompletion(emitToRenderer, start.streamId)

    const chunks = emitToRenderer.mock.calls
      .filter(([channel]) => channel === 'sftp:fileChunk')
      .map(([, payload]) => payload as SftpFileChunkEvent)
      .filter((event) => event.streamId === start.streamId)

    expect(chunks.map((event) => event.chunk).join('')).toBe('alpha\nbeta\n')
    expect(emitToRenderer).toHaveBeenCalledWith(
      'sftp:fileStreamState',
      expect.objectContaining({
        streamId: start.streamId,
        status: 'completed',
        transferred: 11,
        total: 11
      } satisfies Partial<SftpFileStreamStateEvent>)
    )
  })

  it('keeps probing past an ASCII-only initial sample before streaming GBK text', async () => {
    const { manager, emitToRenderer } = createManagerWithSftpEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())
    const text = `${'a'.repeat(32768)}这是一段比较长的中文文本用来测试编码检测功能是否正常工作`
    runtime.sftp = createFileSftp(iconv.encode(text, 'gbk')) as never
    getSessionsMap(manager).set('session-1', runtime)

    const start = await manager.openFileReadStream('session-1', '/etc/app.conf')

    expect(start.encoding).toBe('gbk')
    await waitForFileStreamCompletion(emitToRenderer, start.streamId)

    const chunks = emitToRenderer.mock.calls
      .filter(([channel]) => channel === 'sftp:fileChunk')
      .map(([, payload]) => payload as SftpFileChunkEvent)
      .filter((event) => event.streamId === start.streamId)

    expect(chunks.map((event) => event.chunk).join('')).toBe(text)
  })

  it('does not emit read chunks before the read stream start resolves', async () => {
    const { manager, emitToRenderer } = createManagerWithSftpEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())
    runtime.sftp = createFileSftp(Buffer.from('alpha\nbeta\n', 'utf8')) as never
    getSessionsMap(manager).set('session-1', runtime)

    const start = await manager.openFileReadStream('session-1', '/etc/app.conf')

    const earlyFileEvents = emitToRenderer.mock.calls.filter(
      ([channel]) => channel === 'sftp:fileChunk' || channel === 'sftp:fileStreamState'
    )
    expect(earlyFileEvents).toHaveLength(0)

    await waitForFileStreamCompletion(emitToRenderer, start.streamId)
  })

  it('writes acknowledged chunks incrementally and closes the remote handle', async () => {
    const { manager } = createManagerWithSftpEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())
    const written: string[] = []
    const sftp = createFileSftp(Buffer.alloc(0))
    sftp.write.mockImplementation(
      (
        _handle: Buffer,
        buffer: Buffer,
        offset: number,
        length: number,
        _position: number,
        callback: (error?: Error) => void
      ) => {
        written.push(buffer.subarray(offset, offset + length).toString('utf8'))
        callback()
      }
    )
    runtime.sftp = sftp as never
    getSessionsMap(manager).set('session-1', runtime)

    const start = await manager.openFileWriteStream('session-1', '/etc/app.conf', 'utf8')
    await manager.writeFileChunk(start.streamId, 'alpha')
    await manager.writeFileChunk(start.streamId, '\nbeta')
    await manager.closeFileWriteStream(start.streamId)

    expect(written.join('')).toBe('alpha\nbeta')
    expect(sftp.close).toHaveBeenCalledOnce()
  })

  it('rejects a committed write stream when the remote close fails', async () => {
    const { manager, emitToRenderer } = createManagerWithSftpEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())
    const sftp = createFileSftp(Buffer.alloc(0))
    sftp.close.mockImplementation((_handle: Buffer, callback: (error?: Error) => void) => {
      callback(new Error('remote close failed'))
    })
    runtime.sftp = sftp as never
    getSessionsMap(manager).set('session-1', runtime)

    const start = await manager.openFileWriteStream('session-1', '/etc/app.conf', 'utf8')
    await manager.writeFileChunk(start.streamId, 'alpha')

    await expect(manager.closeFileWriteStream(start.streamId)).rejects.toThrow(
      'remote close failed'
    )
    await expect(manager.writeFileChunk(start.streamId, 'late')).rejects.toThrow(
      /stream unavailable|remote close failed/i
    )

    const states = emitToRenderer.mock.calls
      .filter(([channel]) => channel === 'sftp:fileStreamState')
      .map(([, payload]) => payload as SftpFileStreamStateEvent)
      .filter((event) => event.streamId === start.streamId)

    expect(states.some((event) => event.status === 'error')).toBe(true)
    expect(states.some((event) => event.status === 'completed')).toBe(false)
  })

  it('cancels file streams by stream id and closes the remote handle', async () => {
    const { manager } = createManagerWithSftpEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())
    const sftp = createFileSftp(Buffer.alloc(0))
    runtime.sftp = sftp as never
    getSessionsMap(manager).set('session-1', runtime)

    const start = await manager.openFileWriteStream('session-1', '/etc/app.conf', 'utf8')
    manager.cancelFileStream(start.streamId)

    await expect(manager.writeFileChunk(start.streamId, 'late')).rejects.toThrow(
      /stream unavailable/i
    )
    expect(sftp.close).toHaveBeenCalledOnce()
  })

  it('serializes concurrent write chunks so offsets advance in call order', async () => {
    const { manager } = createManagerWithSftpEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())
    const positions: number[] = []
    let releaseFirstWrite: (() => void) | null = null
    const sftp = createFileSftp(Buffer.alloc(0))
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
        if (!releaseFirstWrite) {
          releaseFirstWrite = () => callback()
          return
        }
        callback()
      }
    )
    runtime.sftp = sftp as never
    getSessionsMap(manager).set('session-1', runtime)

    const start = await manager.openFileWriteStream('session-1', '/etc/app.conf', 'utf8')
    const firstWrite = manager.writeFileChunk(start.streamId, 'alpha')
    const secondWrite = manager.writeFileChunk(start.streamId, '\nbeta')

    await vi.waitFor(() => expect(positions).toEqual([0]))
    releaseFirstWrite?.()
    await Promise.all([firstWrite, secondWrite])

    expect(positions).toEqual([0, 5])
  })

  it('fails a write stream after a chunk write error and rejects queued chunks', async () => {
    const { manager, emitToRenderer } = createManagerWithSftpEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())
    const positions: number[] = []
    let releaseFirstWrite: ((error?: Error) => void) | null = null
    const sftp = createFileSftp(Buffer.alloc(0))
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
    runtime.sftp = sftp as never
    getSessionsMap(manager).set('session-1', runtime)

    const start = await manager.openFileWriteStream('session-1', '/etc/app.conf', 'utf8')
    const firstWrite = manager.writeFileChunk(start.streamId, 'alpha')
    const secondWrite = manager.writeFileChunk(start.streamId, '\nbeta')

    await vi.waitFor(() => expect(positions).toEqual([0]))
    releaseFirstWrite?.(new Error('remote disk full'))

    await expect(firstWrite).rejects.toThrow('remote disk full')
    await expect(secondWrite).rejects.toThrow(/stream unavailable|remote disk full/i)
    await expect(manager.closeFileWriteStream(start.streamId)).rejects.toThrow(
      /stream unavailable|remote disk full/i
    )

    expect(positions).toEqual([0])
    expect(sftp.close).toHaveBeenCalledOnce()
    const states = emitToRenderer.mock.calls
      .filter(([channel]) => channel === 'sftp:fileStreamState')
      .map(([, payload]) => payload as SftpFileStreamStateEvent)
      .filter((event) => event.streamId === start.streamId)
    expect(states.some((event) => event.status === 'error')).toBe(true)
    expect(states.some((event) => event.status === 'completed')).toBe(false)
  })

  it('does not emit running after a write stream is cancelled while a chunk is in flight', async () => {
    const { manager, emitToRenderer } = createManagerWithSftpEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())
    let releaseFirstWrite: (() => void) | null = null
    const sftp = createFileSftp(Buffer.alloc(0))
    sftp.write.mockImplementation(
      (
        _handle: Buffer,
        _buffer: Buffer,
        _offset: number,
        _length: number,
        _position: number,
        callback: (error?: Error) => void
      ) => {
        releaseFirstWrite = () => callback()
      }
    )
    runtime.sftp = sftp as never
    getSessionsMap(manager).set('session-1', runtime)

    const start = await manager.openFileWriteStream('session-1', '/etc/app.conf', 'utf8')
    const firstWrite = manager.writeFileChunk(start.streamId, 'alpha')
    await vi.waitFor(() => expect(releaseFirstWrite).toBeTypeOf('function'))

    manager.cancelFileStream(start.streamId)
    await expect(manager.writeFileChunk(start.streamId, 'late')).rejects.toThrow(
      /stream unavailable/i
    )
    releaseFirstWrite?.()
    await expect(firstWrite).rejects.toThrow(/stream unavailable|cancelled/i)

    const states = emitToRenderer.mock.calls
      .filter(([channel]) => channel === 'sftp:fileStreamState')
      .map(([, payload]) => payload as SftpFileStreamStateEvent)
      .filter((event) => event.streamId === start.streamId)

    const cancelledIndex = states.findIndex((event) => event.status === 'cancelled')
    expect(cancelledIndex).toBeGreaterThanOrEqual(0)
    expect(states.slice(cancelledIndex + 1).some((event) => event.status === 'running')).toBe(false)
  })

  it('closes active editor write streams on disconnect and rejects later writes', async () => {
    const { manager } = createManagerWithSftpEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())
    const sftp = createFileSftp(Buffer.alloc(0))
    runtime.sftp = sftp as never
    getSessionsMap(manager).set('session-1', runtime)

    const start = await manager.openFileWriteStream('session-1', '/etc/app.conf', 'utf8')
    await manager.disconnect('session-1')

    await expect(manager.writeFileChunk(start.streamId, 'late')).rejects.toThrow(
      /stream unavailable/i
    )
    expect(sftp.close).toHaveBeenCalledOnce()
  })

  it('closes active editor read streams on dispose and rejects later writes for the session', async () => {
    const { manager } = createManagerWithSftpEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())
    let releaseSecondRead: (() => void) | null = null
    const sftp = createFileSftp(Buffer.from('alpha\nbeta\n', 'utf8'))
    sftp.read.mockImplementation(
      (
        _handle: Buffer,
        buffer: Buffer,
        offset: number,
        length: number,
        position: number,
        callback: (error: Error | undefined, bytesRead: number) => void
      ) => {
        if (position === 0) {
          const slice = Buffer.from('alpha', 'utf8')
          slice.copy(buffer, offset)
          callback(undefined, slice.byteLength)
          return
        }
        releaseSecondRead = () => callback(undefined, 0)
        void length
      }
    )
    runtime.sftp = sftp as never
    getSessionsMap(manager).set('session-1', runtime)

    const readStart = await manager.openFileReadStream('session-1', '/etc/app.conf')
    const writeStart = await manager.openFileWriteStream('session-1', '/etc/other.conf', 'utf8')
    await vi.waitFor(() => expect(releaseSecondRead).toBeTypeOf('function'))

    manager.dispose()
    releaseSecondRead?.()

    await expect(manager.writeFileChunk(writeStart.streamId, 'late')).rejects.toThrow(
      /stream unavailable/i
    )
    await vi.waitFor(() => expect(sftp.close).toHaveBeenCalledTimes(2))
    const editorStreams = Reflect.get(manager as object, 'editorFileStreams') as Map<
      string,
      unknown
    >
    expect(editorStreams.has(readStart.streamId)).toBe(false)
    expect(editorStreams.has(writeStart.streamId)).toBe(false)
  })
})

describe('SessionManager port forwarding', () => {
  it('installs shell integration inline without writing a remote temporary file', async () => {
    vi.useFakeTimers()

    const manager = createManager()
    const client = new MockClient()
    execBehaviors.push({ stdout: '/bin/bash\n' })
    const sftp = {
      close: vi.fn((_handle: Buffer, callback: (error?: Error) => void) => callback()),
      open: vi.fn(
        (
          _remotePath: string,
          _flags: string,
          callback: (error: Error | undefined, handle: Buffer) => void
        ) => callback(undefined, Buffer.from('handle'))
      ),
      write: vi.fn(
        (
          _handle: Buffer,
          _buffer: Buffer,
          _offset: number,
          _length: number,
          _position: number,
          callback: (error?: Error) => void
        ) => callback()
      )
    }
    const runtime = {
      ...createRuntime('session-1', client),
      sftp: sftp as never,
      summary: {
        ...createRuntime('session-1', client).summary,
        currentPath: '/home/alice'
      }
    }

    const installShellIntegration = Reflect.get(manager as object, 'installShellIntegration') as (
      targetRuntime: typeof runtime
    ) => Promise<void>

    await installShellIntegration.call(manager, runtime)

    expect(sftp.open).not.toHaveBeenCalled()
    expect(sftp.write).not.toHaveBeenCalled()
    expect(sftp.close).not.toHaveBeenCalled()
    expect(runtime.shell.write).toHaveBeenCalledTimes(1)
    const written = runtime.shell.write.mock.calls[0]?.[0] as string
    expect(written).not.toContain('.winssh_init_')
    expect(written).not.toContain(' && rm -f ')
    expect(written).toMatch(/\r$/)
  })

  it('installs cwd-only shell integration when command history is disabled', async () => {
    const manager = createManager()
    const client = new MockClient()
    execBehaviors.push({ stdout: '/bin/bash\n' })
    const runtime = createRuntime('session-1', client)
    runtime.historyCaptureEnabled = false

    const installShellIntegration = Reflect.get(manager as object, 'installShellIntegration') as (
      targetRuntime: typeof runtime
    ) => Promise<void>

    await installShellIntegration.call(manager, runtime)

    expect(runtime.shell.write).toHaveBeenCalledTimes(1)
    const written = runtime.shell.write.mock.calls[0]?.[0] as string
    expect(written).toContain('133;P;Cwd=')
    expect(written).not.toContain('633;Eh;')
  })

  it('formats SFTP permissions as octal and symbolic text', () => {
    expect(formatRemoteEntryPermissions(0o040755, 'directory')).toEqual({
      octal: '0755',
      symbolic: 'drwxr-xr-x'
    })

    expect(formatRemoteEntryPermissions(0o100644, 'file')).toEqual({
      octal: '0644',
      symbolic: '-rw-r--r--'
    })
  })

  it('reuses the existing session id while reconnecting so state events stay bound to the same tab', async () => {
    const manager = createManager()
    getHistoryMap(manager).set('session-old', { serverId: 'server-1' })

    const connectSpy = vi.spyOn(manager, 'connect').mockResolvedValue({
      ok: true,
      summary: {
        sessionId: 'session-old',
        serverId: 'server-1',
        serverName: 'alpha',
        host: '127.0.0.1',
        port: 22,
        status: 'ready',
        connectedAt: new Date().toISOString(),
        currentPath: '/'
      }
    })

    const summary = await manager.reconnect('session-old')

    expect(connectSpy).toHaveBeenCalledWith({ serverId: 'server-1', sessionId: 'session-old' })
    expect(summary.sessionId).toBe('session-old')
  })

  it('releases the active runtime before reconnecting a still-ready session', async () => {
    const manager = createManager()
    const oldClient = new MockClient()
    const runtime = createRuntime('session-old', oldClient)
    getSessionsMap(manager).set('session-old', runtime)
    getHistoryMap(manager).set('session-old', { serverId: 'server-1' })

    vi.spyOn(manager, 'connect').mockResolvedValue({
      ok: true,
      summary: {
        sessionId: 'session-old',
        serverId: 'server-1',
        serverName: 'alpha',
        host: '127.0.0.1',
        port: 22,
        status: 'ready',
        connectedAt: new Date().toISOString(),
        currentPath: '/'
      }
    })

    await manager.reconnect('session-old')

    expect(runtime.finalizing).toBe(true)
    expect(oldClient.end).toHaveBeenCalledTimes(1)
    expect(getSessionsMap(manager).has('session-old')).toBe(false)
  })

  it('starts a local forward and releases the listener on stop', async () => {
    const manager = createManager()
    const client = new MockClient()
    let resolveForwarded: (() => void) | null = null
    const forwarded = new Promise<void>((resolve) => {
      resolveForwarded = resolve
    })
    client.forwardOut.mockImplementationOnce(
      (
        _: string,
        __: number,
        ___: string,
        ____: number,
        callback?: (error: Error | undefined, stream: PassThrough) => void
      ) => {
        callback?.(undefined, new PassThrough())
        resolveForwarded?.()
        return client
      }
    )

    const runtime = createRuntime('session-1', client)
    getSessionsMap(manager).set('session-1', runtime)
    getHistoryMap(manager).set('session-1', { serverId: 'server-1' })

    const port = await getAvailablePort()
    const rule = await manager.createPortForward('session-1', {
      kind: 'local',
      bindHost: '127.0.0.1',
      bindPort: port,
      targetHost: 'db.internal',
      targetPort: 5432
    })

    expect(rule.status).toBe('active')
    expect(rule.enabled).toBe(true)

    const socket = await connectLocal(port)
    socket.end()
    await forwarded
    expect(client.forwardOut).toHaveBeenCalledTimes(1)

    const stopped = await manager.stopPortForward('session-1', rule.id)
    expect(stopped.status).toBe('stopped')
    expect(stopped.enabled).toBe(false)

    const failureCode = await expectConnectionFailure(port)
    expect(failureCode).not.toBe('')

    manager.dispose()
  })

  it('preserves enabled rules across disconnect and restores them after reconnect', async () => {
    const manager = createManager()
    const oldClient = new MockClient()
    const oldRuntime = createRuntime('session-old', oldClient)
    getSessionsMap(manager).set('session-old', oldRuntime)
    getHistoryMap(manager).set('session-old', { serverId: 'server-1' })

    const created = await manager.createPortForward('session-old', {
      kind: 'remote',
      bindHost: '127.0.0.1',
      bindPort: 18080,
      targetHost: '127.0.0.1',
      targetPort: 3000
    })

    expect(created.status).toBe('active')
    expect(oldClient.forwardIn).toHaveBeenCalledTimes(1)

    await finalizeManagedSession(manager, 'session-old')
    expect(manager.listPortForwards('session-old')[0]?.status).toBe('error')

    const newClient = new MockClient()
    const newRuntime = createRuntime('session-new', newClient)
    vi.spyOn(manager, 'connect').mockImplementation(async (request) => {
      getHistoryMap(manager).set('session-new', request)
      getSessionsMap(manager).set('session-new', newRuntime)
      return {
        ok: true,
        summary: newRuntime.summary
      }
    })

    const reconnected = await manager.reconnect('session-old')
    expect(reconnected.sessionId).toBe('session-new')
    expect(manager.listPortForwards('session-old')).toEqual([])
    expect(manager.listPortForwards('session-new')[0]?.status).toBe('active')
    expect(newClient.forwardIn).toHaveBeenCalledTimes(1)

    manager.dispose()
  })

  it('uploads local directories recursively and preserves empty folders', async () => {
    const manager = createManager()
    const client = new MockClient()
    const rootDir = await fs.mkdtemp(join(tmpdir(), 'winssh-sftp-upload-'))
    const localProjectPath = join(rootDir, 'project')
    temporaryPaths.push(rootDir)

    await fs.mkdir(join(localProjectPath, 'nested', 'empty'), { recursive: true })
    await fs.writeFile(join(localProjectPath, 'nested', 'config.json'), '{"ok":true}\n')
    await fs.writeFile(join(localProjectPath, 'README.md'), '# demo\n')

    const remoteDirectories = new Set(['/deploy'])
    const uploadedFiles: Array<{ localPath: string; remotePath: string }> = []
    const sftp = {
      fastPut: vi.fn(
        (
          localPath: string,
          remotePath: string,
          options: { step?: (transferred: number, chunk: number, total: number) => void },
          callback: (error?: Error) => void
        ) => {
          uploadedFiles.push({ localPath, remotePath })
          options.step?.(1, 1, 1)
          callback()
        }
      ),
      mkdir: vi.fn((remotePath: string, callback: (error?: Error) => void) => {
        if (remoteDirectories.has(remotePath)) {
          callback(new Error('EEXIST'))
          return
        }

        remoteDirectories.add(remotePath)
        callback()
      }),
      stat: vi.fn(
        (
          remotePath: string,
          callback: (error: Error | undefined, stats?: { isDirectory: () => boolean }) => void
        ) => {
          if (remoteDirectories.has(remotePath)) {
            callback(undefined, { isDirectory: () => true })
            return
          }

          if (uploadedFiles.some((entry) => entry.remotePath === remotePath)) {
            callback(undefined, { isDirectory: () => false })
            return
          }

          callback(new Error('ENOENT'))
        }
      )
    } as never

    const runtime = {
      ...createRuntime('session-1', client),
      sftp
    }
    getSessionsMap(manager).set('session-1', runtime)

    await manager.uploadPaths('session-1', '/deploy', [localProjectPath])

    expect(remoteDirectories).toEqual(
      new Set([
        '/deploy',
        '/deploy/project',
        '/deploy/project/nested',
        '/deploy/project/nested/empty'
      ])
    )
    expect(uploadedFiles.map((entry) => entry.remotePath).sort()).toEqual([
      '/deploy/project/README.md',
      '/deploy/project/nested/config.json'
    ])
  })

  it('downloads remote directories recursively and preserves empty folders', async () => {
    const manager = createManager()
    const client = new MockClient()
    const rootDir = await fs.mkdtemp(join(tmpdir(), 'winssh-sftp-download-'))
    temporaryPaths.push(rootDir)
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [rootDir]
    })

    const remoteDirectories = new Set([
      '/deploy/project',
      '/deploy/project/nested',
      '/deploy/project/nested/empty'
    ])
    const remoteFiles = new Map([
      ['/deploy/project/README.md', '# demo\n'],
      ['/deploy/project/nested/config.json', '{"ok":true}\n']
    ])
    const downloadedFiles: Array<{ localPath: string; remotePath: string }> = []
    const createStats = (kind: 'directory' | 'file', size = 0) => ({
      isDirectory: () => kind === 'directory',
      isSymbolicLink: () => false,
      mode: kind === 'directory' ? 0o040755 : 0o100644,
      mtime: 0,
      size
    })
    const sftp = {
      fastGet: vi.fn(
        (
          remotePath: string,
          localPath: string,
          options: { step?: (transferred: number, chunk: number, total: number) => void },
          callback: (error?: Error) => void
        ) => {
          downloadedFiles.push({ localPath, remotePath })
          const content = remoteFiles.get(remotePath) ?? ''
          fs.writeFile(localPath, content)
            .then(() => {
              options.step?.(content.length, content.length, content.length || 1)
              callback()
            })
            .catch(callback)
        }
      ),
      readdir: vi.fn(
        (remotePath: string, callback: (error: Error | undefined, entries?: unknown[]) => void) => {
          const children = Array.from([...remoteDirectories, ...remoteFiles.keys()])
            .filter(
              (entryPath) => entryPath !== remotePath && entryPath.startsWith(`${remotePath}/`)
            )
            .filter((entryPath) => entryPath.slice(remotePath.length + 1).split('/').length === 1)
            .map((entryPath) => {
              const isDirectory = remoteDirectories.has(entryPath)
              const content = remoteFiles.get(entryPath) ?? ''
              return {
                attrs: createStats(isDirectory ? 'directory' : 'file', content.length),
                filename: entryPath.split('/').at(-1) ?? ''
              }
            })
          callback(undefined, children)
        }
      ),
      stat: vi.fn(
        (
          remotePath: string,
          callback: (error: Error | undefined, stats?: ReturnType<typeof createStats>) => void
        ) => {
          if (remoteDirectories.has(remotePath)) {
            callback(undefined, createStats('directory'))
            return
          }

          const content = remoteFiles.get(remotePath)
          if (content !== undefined) {
            callback(undefined, createStats('file', content.length))
            return
          }

          callback(new Error('ENOENT'))
        }
      )
    } as never

    const runtime = {
      ...createRuntime('session-1', client),
      sftp
    }
    getSessionsMap(manager).set('session-1', runtime)

    await manager.downloadFile('session-1', '/deploy/project')

    expect(downloadedFiles.map((entry) => entry.remotePath).sort()).toEqual([
      '/deploy/project/README.md',
      '/deploy/project/nested/config.json'
    ])
    await expect(fs.readFile(join(rootDir, 'project', 'README.md'), 'utf8')).resolves.toBe(
      '# demo\n'
    )
    await expect(
      fs.readFile(join(rootDir, 'project', 'nested', 'config.json'), 'utf8')
    ).resolves.toBe('{"ok":true}\n')
    await expect(fs.stat(join(rootDir, 'project', 'nested', 'empty'))).resolves.toMatchObject({})
  })

  it('removes non-empty directories recursively', async () => {
    const manager = createManager()
    const client = new MockClient()
    const removedFiles: string[] = []
    const removedDirectories: string[] = []
    const remoteDirectories = new Set(['/deploy/project', '/deploy/project/nested'])
    const remoteFiles = new Set(['/deploy/project/README.md', '/deploy/project/nested/config.json'])

    const createStats = (kind: 'directory' | 'file' | 'symlink') =>
      ({
        isDirectory: () => kind === 'directory',
        isSymbolicLink: () => kind === 'symlink'
      }) as {
        isDirectory: () => boolean
        isSymbolicLink: () => boolean
      }

    const sftp = {
      lstat: vi.fn(
        (
          remotePath: string,
          callback: (
            error: Error | undefined,
            stats?: {
              isDirectory: () => boolean
              isSymbolicLink: () => boolean
            }
          ) => void
        ) => {
          if (remoteDirectories.has(remotePath)) {
            callback(undefined, createStats('directory'))
            return
          }

          if (remoteFiles.has(remotePath)) {
            callback(undefined, createStats('file'))
            return
          }

          callback(new Error('ENOENT'))
        }
      ),
      readdir: vi.fn(
        (remotePath: string, callback: (error?: Error, entries?: unknown[]) => void) => {
          if (remotePath === '/deploy/project') {
            callback(undefined, [
              {
                attrs: {
                  isDirectory: () => false,
                  isSymbolicLink: () => false,
                  mtime: 0,
                  size: 7
                },
                filename: 'README.md'
              },
              {
                attrs: {
                  isDirectory: () => true,
                  isSymbolicLink: () => false,
                  mtime: 0,
                  size: 0
                },
                filename: 'nested'
              }
            ])
            return
          }

          if (remotePath === '/deploy/project/nested') {
            callback(undefined, [
              {
                attrs: {
                  isDirectory: () => false,
                  isSymbolicLink: () => false,
                  mtime: 0,
                  size: 15
                },
                filename: 'config.json'
              }
            ])
            return
          }

          callback(undefined, [])
        }
      ),
      rmdir: vi.fn((remotePath: string, callback: (error?: Error) => void) => {
        removedDirectories.push(remotePath)
        remoteDirectories.delete(remotePath)
        callback()
      }),
      unlink: vi.fn((remotePath: string, callback: (error?: Error) => void) => {
        removedFiles.push(remotePath)
        remoteFiles.delete(remotePath)
        callback()
      })
    } as never

    const runtime = {
      ...createRuntime('session-1', client),
      sftp
    }
    getSessionsMap(manager).set('session-1', runtime)

    await manager.remove('session-1', '/deploy/project')

    expect([...removedFiles].sort()).toEqual([
      '/deploy/project/README.md',
      '/deploy/project/nested/config.json'
    ])
    expect(removedDirectories).toEqual(['/deploy/project/nested', '/deploy/project'])
  })

  it('removes symlinks with unlink instead of recursing into their targets', async () => {
    const manager = createManager()
    const client = new MockClient()
    const unlink = vi.fn((_remotePath: string, callback: (error?: Error) => void) => callback())
    const readdir = vi.fn()
    const rmdir = vi.fn()
    const sftp = {
      lstat: vi.fn(
        (
          remotePath: string,
          callback: (
            error: Error | undefined,
            stats?: {
              isDirectory: () => boolean
              isSymbolicLink: () => boolean
            }
          ) => void
        ) => {
          if (remotePath === '/deploy/link-to-dir') {
            callback(undefined, {
              isDirectory: () => false,
              isSymbolicLink: () => true
            })
            return
          }

          callback(new Error('ENOENT'))
        }
      ),
      readdir,
      stat: vi.fn(),
      rmdir,
      unlink
    } as never

    const runtime = {
      ...createRuntime('session-1', client),
      sftp
    }
    getSessionsMap(manager).set('session-1', runtime)

    await manager.remove('session-1', '/deploy/link-to-dir')

    expect(unlink).toHaveBeenCalledWith('/deploy/link-to-dir', expect.any(Function))
    expect(readdir).not.toHaveBeenCalled()
    expect(rmdir).not.toHaveBeenCalled()
  })

  it('does not auto-restore a manually stopped rule after reconnect', async () => {
    const manager = createManager()
    const oldClient = new MockClient()
    const oldRuntime = createRuntime('session-old', oldClient)
    getSessionsMap(manager).set('session-old', oldRuntime)
    getHistoryMap(manager).set('session-old', { serverId: 'server-1' })

    const created = await manager.createPortForward('session-old', {
      kind: 'remote',
      bindHost: '127.0.0.1',
      bindPort: 19090,
      targetHost: '127.0.0.1',
      targetPort: 4000
    })
    await manager.stopPortForward('session-old', created.id)
    await finalizeManagedSession(manager, 'session-old')

    const newClient = new MockClient()
    const newRuntime = createRuntime('session-new', newClient)
    vi.spyOn(manager, 'connect').mockImplementation(async (request) => {
      getHistoryMap(manager).set('session-new', request)
      getSessionsMap(manager).set('session-new', newRuntime)
      return {
        ok: true,
        summary: newRuntime.summary
      }
    })

    await manager.reconnect('session-old')
    const restored = manager.listPortForwards('session-new')[0]
    expect(restored?.enabled).toBe(false)
    expect(restored?.status).toBe('stopped')
    expect(newClient.forwardIn).not.toHaveBeenCalled()

    manager.dispose()
  })

  it('keeps the session alive when a local bind port is already occupied', async () => {
    const manager = createManager()
    const client = new MockClient()
    const runtime = createRuntime('session-1', client)
    getSessionsMap(manager).set('session-1', runtime)
    getHistoryMap(manager).set('session-1', { serverId: 'server-1' })

    const occupiedServer = net.createServer()
    const occupiedPort = await new Promise<number>((resolve, reject) => {
      occupiedServer.once('error', reject)
      occupiedServer.listen(0, '127.0.0.1', () => {
        const address = occupiedServer.address() as AddressInfo
        resolve(address.port)
      })
    })

    const rule = await manager.createPortForward('session-1', {
      kind: 'local',
      bindHost: '127.0.0.1',
      bindPort: occupiedPort,
      targetHost: 'db.internal',
      targetPort: 3306
    })

    expect(rule.status).toBe('error')
    expect(rule.enabled).toBe(true)
    expect(getSessionsMap(manager).has('session-1')).toBe(true)

    await new Promise<void>((resolve) => occupiedServer.close(() => resolve()))
    manager.dispose()
  })

  it('keeps the session alive when remote forwardIn fails', async () => {
    const manager = createManager()
    const client = new MockClient()
    client.forwardIn.mockImplementationOnce(
      (_: string, __: number, callback?: (error?: Error) => void) => {
        callback?.(new Error('forwardIn failed'))
        return client
      }
    )

    const runtime = createRuntime('session-1', client)
    getSessionsMap(manager).set('session-1', runtime)
    getHistoryMap(manager).set('session-1', { serverId: 'server-1' })

    const rule = await manager.createPortForward('session-1', {
      kind: 'remote',
      bindHost: '127.0.0.1',
      bindPort: 20022,
      targetHost: '127.0.0.1',
      targetPort: 22
    })

    expect(rule.status).toBe('error')
    expect(rule.enabled).toBe(true)
    expect(getSessionsMap(manager).has('session-1')).toBe(true)

    manager.dispose()
  })

  it('returns Linux resource metrics and computes CPU and network rates from the second sample onward', async () => {
    const manager = createManager()
    const client = new MockClient()
    const runtime = createRuntime('session-1', client)
    getSessionsMap(manager).set('session-1', runtime)

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-06T00:00:00.000Z'))

    execBehaviors.push(
      {
        stdout: 'Linux\n'
      },
      {
        stdout: createResourceMonitorOutput({
          cpuLine: 'cpu  100 0 100 900 0 0 0 0 0 0',
          networkInterfaces: ['eth0: 1000 0 0 0 0 0 0 0 2000 0 0 0 0 0 0 0']
        })
      },
      {
        stdout: 'Linux\n'
      },
      {
        stdout: createResourceMonitorOutput({
          cpuLine: 'cpu  150 0 200 950 0 0 0 0 0 0',
          networkInterfaces: ['eth0: 5000 0 0 0 0 0 0 0 8000 0 0 0 0 0 0 0']
        })
      }
    )

    const firstSnapshot = await manager.getResourceSnapshot('session-1')
    expect(firstSnapshot.platform).toBe('linux')
    expect(firstSnapshot.latency.rttMs).toBeTypeOf('number')
    expect(firstSnapshot.cpu!.usagePercent).toBeNull()
    expect(firstSnapshot.memory!.usagePercent).toBe(50)
    expect(firstSnapshot.disk!.usagePercent).toBe(25)
    expect(firstSnapshot.network!).toEqual({
      rxBytesPerSecond: null,
      txBytesPerSecond: null
    })

    vi.setSystemTime(new Date('2026-04-06T00:00:02.000Z'))
    const secondSnapshot = await manager.getResourceSnapshot('session-1')
    expect(secondSnapshot.platform).toBe('linux')
    expect(secondSnapshot.latency.rttMs).toBeTypeOf('number')
    expect(secondSnapshot.cpu!.usagePercent).toBe(75)
    expect(secondSnapshot.network!).toEqual({
      rxBytesPerSecond: 2000,
      txBytesPerSecond: 3000
    })
  })

  it('clears CPU and network baselines when the session disconnects', async () => {
    const manager = createManager()
    const client = new MockClient()
    const runtime = createRuntime('session-1', client)
    getSessionsMap(manager).set('session-1', runtime)

    execBehaviors.push(
      {
        stdout: 'Linux\n'
      },
      {
        stdout: createResourceMonitorOutput({
          cpuLine: 'cpu  100 0 100 900 0 0 0 0 0 0'
        })
      }
    )

    await manager.getResourceSnapshot('session-1')
    expect(getCpuBaselinesMap(manager).has('session-1')).toBe(true)
    expect(getNetworkBaselinesMap(manager).has('session-1')).toBe(true)

    await manager.disconnect('session-1')
    expect(getCpuBaselinesMap(manager).has('session-1')).toBe(false)
    expect(getNetworkBaselinesMap(manager).has('session-1')).toBe(false)
  })

  it('returns partial snapshot with latency for non-Linux platforms', async () => {
    const manager = createManager()
    const client = new MockClient()
    const runtime = createRuntime('session-1', client)
    getSessionsMap(manager).set('session-1', runtime)

    // Phase 1: latency/platform command returns Darwin
    execBehaviors.push({
      stdout: 'Darwin\n'
    })

    const snapshot = await manager.getResourceSnapshot('session-1')
    expect(snapshot.platform).toBe('darwin')
    expect(snapshot.latency.rttMs).toBeTypeOf('number')
    expect(snapshot.cpu).toBeNull()
    expect(snapshot.memory).toBeNull()
    expect(snapshot.network).toBeNull()
    expect(snapshot.disk).toBeNull()
  })

  it('returns unavailable when the session is missing, not ready, or latency measurement fails', async () => {
    const manager = createManager()

    await expect(manager.getResourceSnapshot('missing-session')).rejects.toThrow(
      'errors.sessionUnavailable'
    )

    const client = new MockClient()
    const runtime = createRuntime('session-1', client)
    const runtimeSummary = runtime.summary as { status: 'connecting' | 'ready' }
    runtimeSummary.status = 'connecting'
    getSessionsMap(manager).set('session-1', runtime)

    await expect(manager.getResourceSnapshot('session-1')).rejects.toThrow(
      SESSION_RESOURCE_MONITOR_UNAVAILABLE
    )

    runtime.summary.status = 'ready'

    // Phase 1 (latency) fails - connection is broken
    execBehaviors.push({
      error: new Error('connection lost')
    })

    await expect(manager.getResourceSnapshot('session-1')).rejects.toThrow(
      SESSION_RESOURCE_MONITOR_UNAVAILABLE
    )
  })

  it('returns partial snapshot when latency succeeds but resource sampling fails', async () => {
    const manager = createManager()
    const client = new MockClient()
    const runtime = createRuntime('session-1', client)
    getSessionsMap(manager).set('session-1', runtime)

    // Phase 1: latency succeeds (Linux)
    execBehaviors.push({
      stdout: 'Linux\n'
    })

    // Phase 2: resource command fails (exit code 1)
    execBehaviors.push({
      code: 1,
      stderr: 'cat: /proc/stat: No such file or directory',
      stdout: createResourceMonitorOutput({
        platform: 'Linux'
      })
    })

    const snapshot = await manager.getResourceSnapshot('session-1')
    expect(snapshot.platform).toBe('linux')
    expect(snapshot.latency.rttMs).toBeTypeOf('number')
    expect(snapshot.cpu).toBeNull()
    expect(snapshot.memory).toBeNull()
    expect(snapshot.network).toBeNull()
    expect(snapshot.disk).toBeNull()
  })
})

describe('SessionManager session data forwarding', () => {
  function createManagerWithEmitSpy() {
    const emitToRenderer = vi.fn()
    const manager = new SessionManager(
      {
        getKnownHost: vi.fn(),
        getServerById: vi.fn(),
        recordRecentSession: vi.fn(),
        upsertKnownHost: vi.fn(),
        getSettings: vi.fn(() => ({
          sftpUploadConcurrency: 3,
          sftpDownloadConcurrency: 3
        }))
      } as never,
      () => null,
      emitToRenderer as never,
      ((key: string) => key) as never
    )
    return { manager, emitToRenderer }
  }

  function pushData(
    manager: SessionManager,
    runtime: ReturnType<typeof createRuntime>,
    data: string
  ) {
    const emit = Reflect.get(manager as object, 'emitSessionData') as (
      r: ReturnType<typeof createRuntime>,
      data: string
    ) => void
    emit.call(manager, runtime, data)
  }

  function getDataPayloads(emit: ReturnType<typeof vi.fn>) {
    return emit.mock.calls
      .filter((call) => call[0] === 'sessions:data')
      .map((call) => (call[1] as { data: string }).data)
  }

  it('extracts OSC 7 cwd sequences, updates currentPath, and emits sessions:cwdChanged', () => {
    const { manager, emitToRenderer } = createManagerWithEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())

    pushData(manager, runtime, 'user@host:~$ ls\r\n')
    pushData(manager, runtime, `prefix\x1b]7;file://host/tmp/foo\x07suffix`)

    expect(getDataPayloads(emitToRenderer)).toEqual(['user@host:~$ ls\r\n', 'prefixsuffix'])
    expect(runtime.summary.currentPath).toBe('/tmp/foo')

    const cwdChangeCall = emitToRenderer.mock.calls.find(
      (call) => call[0] === 'sessions:cwdChanged'
    )
    expect(cwdChangeCall).toBeDefined()
    expect(cwdChangeCall?.[1]).toMatchObject({
      sessionId: 'session-1',
      cwd: '/tmp/foo'
    })
  })

  it('extracts OSC 133;P;Cwd sequences and updates summary.currentPath', () => {
    const { manager, emitToRenderer } = createManagerWithEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())

    pushData(manager, runtime, `prefix\x1b]133;P;Cwd=/var/log\x07suffix`)

    expect(getDataPayloads(emitToRenderer)).toEqual(['prefixsuffix'])
    expect(runtime.summary.currentPath).toBe('/var/log')
  })

  it('correctly associates Cwd with commands when executing a sequence of cd and subsequent commands', () => {
    const recordedCommands: any[] = []
    const databaseMock = {
      getKnownHost: vi.fn(),
      getServerById: vi.fn(),
      recordRecentSession: vi.fn(),
      upsertKnownHost: vi.fn(),
      getSettings: vi.fn(() => ({
        commandHistoryEnabled: true
      })),
      recordCommand: vi.fn((input) => {
        recordedCommands.push(input)
        return {
          id: 'test-command-id',
          ...input
        }
      })
    }
    const emitToRenderer = vi.fn()
    const manager = new SessionManager(
      databaseMock as any,
      () => null,
      emitToRenderer as never,
      ((key: string) => key) as never
    )

    const runtime = createRuntime('session-1', new MockClient())
    runtime.historyCaptureEnabled = true
    runtime.historyCaptureStatus = 'active'
    runtime.summary.currentPath = '/root'

    const send = (data: string) => {
      const emit = Reflect.get(manager as object, 'emitSessionData') as (
        r: typeof runtime,
        data: string
      ) => void
      emit.call(manager, runtime, data)
    }

    // 1. User runs `cd /var/`
    send(`\x1b]633;E;${Buffer.from('cd /var/', 'utf8').toString('base64')}\x07`)
    send(`\x1b]133;C\x07`)
    send(`\x1b]133;D;0\x07`)
    send(`\x1b]133;P;Cwd=/var\x07`)
    send(`\x1b]133;A\x07`)

    // 2. User runs `ifconfig`
    send(`\x1b]633;E;${Buffer.from('ifconfig', 'utf8').toString('base64')}\x07`)
    send(`\x1b]133;C\x07`)
    send(`\x1b]133;D;0\x07`)
    send(`\x1b]133;P;Cwd=/var\x07`)
    send(`\x1b]133;A\x07`)

    expect(recordedCommands.length).toBe(2)
    expect(recordedCommands[0].command).toBe('cd /var/')
    expect(recordedCommands[0].cwd).toBe('/root')
    expect(recordedCommands[1].command).toBe('ifconfig')
    expect(recordedCommands[1].cwd).toBe('/var')
  })
})
