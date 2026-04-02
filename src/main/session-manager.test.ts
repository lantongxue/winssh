import { EventEmitter } from 'node:events'
import net, { type AddressInfo } from 'node:net'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  dialog: {
    showMessageBox: vi.fn(),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
  }
}))

import { formatRemoteEntryPermissions, SessionManager } from './session-manager'

class MockClient extends EventEmitter {
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

function createManager() {
  return new SessionManager(
    {
      getKnownHost: vi.fn(),
      getServerById: vi.fn(),
      recordRecentSession: vi.fn(),
      upsertKnownHost: vi.fn()
    } as never,
    {
      getSecret: vi.fn(),
      setSecret: vi.fn()
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
    portForwards: new Map()
  }
}

function getSessionsMap(manager: SessionManager) {
  return Reflect.get(manager as object, 'sessions') as Map<string, ReturnType<typeof createRuntime>>
}

function getHistoryMap(manager: SessionManager) {
  return Reflect.get(manager as object, 'history') as Map<string, { serverId: string }>
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

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SessionManager port forwarding', () => {
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
})
