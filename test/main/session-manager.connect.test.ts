import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Server } from '@shared/types'

vi.mock('electron', () => ({
  dialog: {
    showMessageBox: vi.fn(),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
  }
}))

type MockClientBehavior =
  { type: 'auth-failed' } | { type: 'error'; error: Error } | { type: 'ready' }

const { clientBehaviors, connectConfigs, forwardOutCalls, sftpFiles } = vi.hoisted(() => ({
  clientBehaviors: [] as MockClientBehavior[],
  connectConfigs: [] as Array<Record<string, unknown>>,
  forwardOutCalls: [] as Array<{ dstIP: string; dstPort: number; srcIP: string; srcPort: number }>,
  sftpFiles: new Map<string, string>()
}))

vi.mock('ssh2', () => ({
  Client: class MockSshClient extends EventEmitter {
    connect = vi.fn((config: Record<string, unknown>) => {
      connectConfigs.push(config)
      const behavior = clientBehaviors.shift() ?? { type: 'ready' }

      queueMicrotask(() => {
        if (behavior.type === 'ready') {
          this.emit('ready')
          return
        }

        if (behavior.type === 'auth-failed') {
          this.emit(
            'error',
            Object.assign(new Error('All configured authentication methods failed'), {
              level: 'client-authentication'
            })
          )
          return
        }

        this.emit('error', behavior.error)
      })

      return this
    })

    end = vi.fn(() => this)

    forwardOut = vi.fn(
      (
        srcIP: string,
        srcPort: number,
        dstIP: string,
        dstPort: number,
        callback?: (error: undefined, stream: PassThrough) => void
      ) => {
        forwardOutCalls.push({ dstIP, dstPort, srcIP, srcPort })
        callback?.(undefined, new PassThrough())
        return this
      }
    )

    shell = vi.fn((_: unknown, callback: (error: undefined, stream: PassThrough) => void) => {
      const shell = new PassThrough() as PassThrough & {
        stderr: PassThrough
        setWindow: ReturnType<typeof vi.fn>
        write: ReturnType<typeof vi.fn>
      }
      shell.stderr = new PassThrough()
      shell.setWindow = vi.fn()
      shell.write = vi.fn()
      callback(undefined, shell)
      return this
    })

    sftp = vi.fn((callback: (error: undefined, sftp: unknown) => void) => {
      callback(undefined, {
        close: (_handle: Buffer, next: (error?: Error) => void) => next(),
        open: (
          remotePath: string,
          _flags: string,
          next: (error: undefined, handle: Buffer) => void
        ) => next(undefined, Buffer.from(remotePath)),
        read: (
          handle: Buffer,
          buffer: Buffer,
          offset: number,
          length: number,
          position: number,
          next: (error: Error | undefined, bytesRead: number, buffer: Buffer) => void
        ) => {
          const contents = sftpFiles.get(handle.toString('utf8'))
          if (contents === undefined) {
            next(new Error('ENOENT'), 0, buffer)
            return
          }

          const chunk = Buffer.from(contents).subarray(position, position + length)
          chunk.copy(buffer, offset)
          next(undefined, chunk.length, buffer)
        },
        realpath: (_remotePath: string, next: (error: undefined, absolutePath: string) => void) =>
          next(undefined, '/home/test')
      })
      return this
    })
  }
}))

import { SessionManager } from '@main/session-manager'

function createPasswordServer(overrides: Partial<Server> = {}): Server {
  return {
    id: 'server-1',
    name: 'alpha',
    host: '127.0.0.1',
    port: 22,
    username: 'root',
    authType: 'password',
    brandId: null,
    customIconDataUrl: null,
    privateKeyPath: null,
    note: null,
    groupId: null,
    credentialId: null,
    jumpServerId: null,
    favorite: false,
    createdAt: '',
    updatedAt: '',
    lastConnectedAt: null,
    group: null,
    tags: [],
    hasPassword: false,
    hasPassphrase: false,
    ...overrides
  }
}

function createPrivateKeyServer(overrides: Partial<Server> = {}): Server {
  return createPasswordServer({
    authType: 'privateKey',
    ...overrides
  })
}

function createManager() {
  const database = {
    getKnownHost: vi.fn(),
    getServerPassphrase: vi.fn((): string | null => null),
    getServerPassword: vi.fn((): string | null => null),
    getServerPrivateKey: vi.fn((): string | null => null),
    getServerById: vi.fn((id: string): Server | null =>
      id === 'server-1' ? createPasswordServer() : null
    ),
    recordRecentSession: vi.fn(),
    updateServerBrand: vi.fn(),
    updateServerPassphrase: vi.fn(),
    updateServerPassword: vi.fn(),
    upsertKnownHost: vi.fn()
  }

  const manager = new SessionManager(
    database as never,
    () => null,
    vi.fn() as never,
    ((key: string) => key) as never
  )

  return {
    database,
    manager
  }
}

beforeEach(() => {
  clientBehaviors.length = 0
  connectConfigs.length = 0
  forwardOutCalls.length = 0
  sftpFiles.clear()
})

describe('SessionManager connect', () => {
  it('returns secret_required with server metadata when no password is available', async () => {
    const { manager, database } = createManager()
    database.getServerPassword.mockReturnValue(null)

    const result = await manager.connect({ serverId: 'server-1' })

    expect(result).toEqual({
      ok: false,
      code: 'secret_required',
      message: 'errors.passwordRequired',
      serverId: 'server-1',
      secretKind: 'password'
    })
  })

  it('returns auth_failed with the failing hop metadata for SSH authentication errors', async () => {
    const { manager } = createManager()
    clientBehaviors.push({ type: 'auth-failed' })

    const result = await manager.connect({
      secrets: {
        'server-1': {
          password: 'bad-password',
          rememberPassword: true
        }
      },
      serverId: 'server-1'
    })

    expect(result).toEqual({
      ok: false,
      code: 'auth_failed',
      message: 'errors.authFailed',
      serverId: 'server-1',
      secretKind: 'password'
    })
  })

  it('returns connection_failed for non-auth SSH errors', async () => {
    const { manager } = createManager()
    clientBehaviors.push({ type: 'error', error: new Error('socket hang up') })

    const result = await manager.connect({
      secrets: {
        'server-1': {
          password: 'bad-password'
        }
      },
      serverId: 'server-1'
    })

    expect(result).toEqual({
      ok: false,
      code: 'connection_failed',
      message: 'socket hang up',
      serverId: 'server-1',
      secretKind: undefined
    })
  })

  it('persists a remembered password only after a successful connection', async () => {
    const { database, manager } = createManager()
    clientBehaviors.push({ type: 'ready' })

    const result = await manager.connect({
      secrets: {
        'server-1': {
          password: 'correct-password',
          rememberPassword: true
        }
      },
      serverId: 'server-1'
    })

    expect(result.ok).toBe(true)
    expect(database.recordRecentSession).toHaveBeenCalledWith('server-1')
    expect(database.updateServerPassword).toHaveBeenCalledWith('server-1', 'correct-password')
  })

  it('uses the stored private key content for key-based authentication', async () => {
    const { database, manager } = createManager()
    database.getServerById.mockReturnValue(createPrivateKeyServer())
    database.getServerPrivateKey.mockReturnValue(
      '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'
    )
    clientBehaviors.push({ type: 'ready' })

    const result = await manager.connect({
      secrets: {
        'server-1': {
          passphrase: 'secret',
          rememberPassphrase: true
        }
      },
      serverId: 'server-1'
    })

    expect(result.ok).toBe(true)
    expect(connectConfigs).toHaveLength(1)
    expect(connectConfigs[0]).toEqual(
      expect.objectContaining({
        passphrase: 'secret',
        privateKey: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'
      })
    )
  })

  it('returns secret_required for the jump server when its password is missing', async () => {
    const { database, manager } = createManager()
    const targetServer = createPasswordServer({
      id: 'server-1',
      jumpServerId: 'jump-1',
      name: 'target',
      port: 2222
    })
    const jumpServer = createPasswordServer({
      host: '10.0.0.10',
      id: 'jump-1',
      name: 'jump',
      port: 22,
      username: 'jump'
    })

    database.getServerById.mockImplementation((id: string) => {
      if (id === 'server-1') {
        return targetServer
      }

      if (id === 'jump-1') {
        return jumpServer
      }

      return null
    })
    database.getServerPassword.mockReturnValue(null)

    const result = await manager.connect({ serverId: 'server-1' })

    expect(result).toEqual({
      ok: false,
      code: 'secret_required',
      message: 'errors.passwordRequired',
      serverId: 'jump-1',
      secretKind: 'password'
    })
  })

  it('connects through the jump server and passes the forwarded socket to the target connection', async () => {
    const { database, manager } = createManager()
    const targetServer = createPasswordServer({
      id: 'server-1',
      host: '10.0.0.20',
      jumpServerId: 'jump-1',
      name: 'target',
      port: 2222,
      username: 'target'
    })
    const jumpServer = createPasswordServer({
      host: '10.0.0.10',
      id: 'jump-1',
      name: 'jump',
      port: 22,
      username: 'jump'
    })

    database.getServerById.mockImplementation((id: string) => {
      if (id === 'server-1') {
        return targetServer
      }

      if (id === 'jump-1') {
        return jumpServer
      }

      return null
    })
    database.getServerPassword.mockImplementation((serverId: string) =>
      serverId === 'jump-1' ? 'jump-password' : 'target-password'
    )
    clientBehaviors.push({ type: 'ready' }, { type: 'ready' })

    const result = await manager.connect({ serverId: 'server-1' })

    expect(result.ok).toBe(true)
    expect(connectConfigs).toHaveLength(2)
    expect(connectConfigs[0]).toEqual(
      expect.objectContaining({
        host: '10.0.0.10',
        password: 'jump-password',
        port: 22,
        username: 'jump'
      })
    )
    expect(connectConfigs[1]).toEqual(
      expect.objectContaining({
        host: '10.0.0.20',
        password: 'target-password',
        port: 2222,
        sock: expect.any(PassThrough),
        username: 'target'
      })
    )
    expect(forwardOutCalls).toEqual([
      {
        dstIP: '10.0.0.20',
        dstPort: 2222,
        srcIP: '127.0.0.1',
        srcPort: 0
      }
    ])
  })

  it('detects and stores a brand from /etc/os-release on the first successful connection', async () => {
    const { database, manager } = createManager()
    clientBehaviors.push({ type: 'ready' })
    sftpFiles.set('/etc/os-release', 'ID=ubuntu\nNAME="Ubuntu"\n')

    const result = await manager.connect({
      secrets: {
        'server-1': {
          password: 'correct-password'
        }
      },
      serverId: 'server-1'
    })

    expect(result.ok).toBe(true)
    expect(database.updateServerBrand).toHaveBeenCalledWith('server-1', 'ubuntu')
  })

  it('detects and stores the archlinux brand from Arch os-release identifiers', async () => {
    const { database, manager } = createManager()
    clientBehaviors.push({ type: 'ready' })
    sftpFiles.set('/etc/os-release', 'ID=arch\nNAME="Arch Linux"\n')

    const result = await manager.connect({
      secrets: {
        'server-1': {
          password: 'correct-password'
        }
      },
      serverId: 'server-1'
    })

    expect(result.ok).toBe(true)
    expect(database.updateServerBrand).toHaveBeenCalledWith('server-1', 'archlinux')
  })

  it('falls back to linux when brand detection cannot match the remote OS', async () => {
    const { database, manager } = createManager()
    clientBehaviors.push({ type: 'ready' })
    sftpFiles.set('/usr/lib/os-release', 'ID=nixos\nNAME="NixOS"\n')

    const result = await manager.connect({
      secrets: {
        'server-1': {
          password: 'correct-password'
        }
      },
      serverId: 'server-1'
    })

    expect(result.ok).toBe(true)
    expect(database.updateServerBrand).toHaveBeenCalledWith('server-1', 'linux')
  })

  it('skips brand detection when the server already has a saved brand', async () => {
    const { database, manager } = createManager()
    database.getServerById.mockReturnValue(createPasswordServer({ brandId: 'fedora' }))
    clientBehaviors.push({ type: 'ready' })

    const result = await manager.connect({
      secrets: {
        'server-1': {
          password: 'correct-password'
        }
      },
      serverId: 'server-1'
    })

    expect(result.ok).toBe(true)
    expect(database.updateServerBrand).not.toHaveBeenCalled()
  })
})
