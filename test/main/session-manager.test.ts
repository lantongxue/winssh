import { EventEmitter } from 'node:events'
import { promises as fs } from 'node:fs'
import net, { type AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_RESOURCE_MONITOR_LINUX_ONLY,
  SESSION_RESOURCE_MONITOR_UNAVAILABLE
} from '@shared/types'

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
      upsertKnownHost: vi.fn()
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
    portForwards: new Map()
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
        stdout: createResourceMonitorOutput({
          cpuLine: 'cpu  100 0 100 900 0 0 0 0 0 0',
          networkInterfaces: ['eth0: 1000 0 0 0 0 0 0 0 2000 0 0 0 0 0 0 0']
        })
      },
      {
        stdout: createResourceMonitorOutput({
          cpuLine: 'cpu  150 0 200 950 0 0 0 0 0 0',
          networkInterfaces: ['eth0: 5000 0 0 0 0 0 0 0 8000 0 0 0 0 0 0 0']
        })
      }
    )

    const firstSnapshot = await manager.getResourceSnapshot('session-1')
    expect(firstSnapshot.cpu.usagePercent).toBeNull()
    expect(firstSnapshot.memory.usagePercent).toBe(50)
    expect(firstSnapshot.disk.usagePercent).toBe(25)
    expect(firstSnapshot.network).toEqual({
      rxBytesPerSecond: null,
      txBytesPerSecond: null
    })

    vi.setSystemTime(new Date('2026-04-06T00:00:02.000Z'))
    const secondSnapshot = await manager.getResourceSnapshot('session-1')
    expect(secondSnapshot.cpu.usagePercent).toBe(75)
    expect(secondSnapshot.network).toEqual({
      rxBytesPerSecond: 2000,
      txBytesPerSecond: 3000
    })
  })

  it('clears CPU and network baselines when the session disconnects', async () => {
    const manager = createManager()
    const client = new MockClient()
    const runtime = createRuntime('session-1', client)
    getSessionsMap(manager).set('session-1', runtime)

    execBehaviors.push({
      stdout: createResourceMonitorOutput({
        cpuLine: 'cpu  100 0 100 900 0 0 0 0 0 0'
      })
    })

    await manager.getResourceSnapshot('session-1')
    expect(getCpuBaselinesMap(manager).has('session-1')).toBe(true)
    expect(getNetworkBaselinesMap(manager).has('session-1')).toBe(true)

    await manager.disconnect('session-1')
    expect(getCpuBaselinesMap(manager).has('session-1')).toBe(false)
    expect(getNetworkBaselinesMap(manager).has('session-1')).toBe(false)
  })

  it('reports Linux-only availability when the remote host is not Linux', async () => {
    const manager = createManager()
    const client = new MockClient()
    const runtime = createRuntime('session-1', client)
    getSessionsMap(manager).set('session-1', runtime)

    execBehaviors.push({
      stdout: createResourceMonitorOutput({
        platform: 'Darwin'
      })
    })

    await expect(manager.getResourceSnapshot('session-1')).rejects.toThrow(
      SESSION_RESOURCE_MONITOR_LINUX_ONLY
    )
  })

  it('returns unavailable when the session is missing, not ready, or remote sampling fails', async () => {
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
    execBehaviors.push({
      code: 1,
      stderr: 'cat: /proc/stat: No such file or directory',
      stdout: createResourceMonitorOutput({
        platform: 'Linux'
      })
    })

    await expect(manager.getResourceSnapshot('session-1')).rejects.toThrow(
      SESSION_RESOURCE_MONITOR_UNAVAILABLE
    )
  })
})
