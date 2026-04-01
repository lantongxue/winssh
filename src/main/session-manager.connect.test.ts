import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  dialog: {
    showMessageBox: vi.fn(),
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn()
  }
}))

type MockClientBehavior =
  | { type: 'auth-failed' }
  | { type: 'error'; error: Error }
  | { type: 'ready' }

const { clientBehaviors } = vi.hoisted(() => ({
  clientBehaviors: [] as MockClientBehavior[]
}))

vi.mock('ssh2', () => ({
  Client: class MockSshClient extends EventEmitter {
    connect = vi.fn((config: unknown) => {
      void config
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
        realpath: (_remotePath: string, next: (error: undefined, absolutePath: string) => void) =>
          next(undefined, '/home/test')
      })
      return this
    })
  }
}))

import { SessionManager } from './session-manager'

function createPasswordServer() {
  return {
    id: 'server-1',
    name: 'alpha',
    host: '127.0.0.1',
    port: 22,
    username: 'root',
    authType: 'password' as const,
    privateKeyPath: null,
    note: null,
    groupId: null,
    favorite: false,
    createdAt: '',
    updatedAt: '',
    lastConnectedAt: null,
    group: null,
    tags: [],
    hasPassword: false,
    hasPassphrase: false
  }
}

function createManager() {
  const database = {
    getKnownHost: vi.fn(),
    getServerById: vi.fn(() => createPasswordServer()),
    recordRecentSession: vi.fn(),
    upsertKnownHost: vi.fn()
  }
  const secureStore = {
    deleteSecret: vi.fn(),
    getSecret: vi.fn(),
    setSecret: vi.fn()
  }

  const manager = new SessionManager(
    database as never,
    secureStore as never,
    () => null,
    vi.fn() as never,
    ((key: string) => key) as never
  )

  return {
    database,
    manager,
    secureStore
  }
}

beforeEach(() => {
  clientBehaviors.length = 0
})

describe('SessionManager connect', () => {
  it('returns password_required when no password is available', async () => {
    const { manager, secureStore } = createManager()
    secureStore.getSecret.mockResolvedValueOnce(null)

    const result = await manager.connect({ serverId: 'server-1' })

    expect(result).toEqual({
      ok: false,
      code: 'password_required',
      message: 'errors.passwordRequired'
    })
  })

  it('returns auth_failed for SSH authentication errors', async () => {
    const { manager, secureStore } = createManager()
    secureStore.getSecret.mockResolvedValueOnce(null)
    clientBehaviors.push({ type: 'auth-failed' })

    const result = await manager.connect({
      password: 'bad-password',
      rememberPassword: true,
      serverId: 'server-1'
    })

    expect(result).toEqual({
      ok: false,
      code: 'auth_failed',
      message: 'errors.authFailed'
    })
    expect(secureStore.setSecret).not.toHaveBeenCalled()
  })

  it('returns connection_failed for non-auth SSH errors', async () => {
    const { manager } = createManager()
    clientBehaviors.push({ type: 'error', error: new Error('socket hang up') })

    const result = await manager.connect({
      password: 'bad-password',
      serverId: 'server-1'
    })

    expect(result).toEqual({
      ok: false,
      code: 'connection_failed',
      message: 'socket hang up'
    })
  })

  it('persists a remembered password only after a successful connection', async () => {
    const { database, manager, secureStore } = createManager()
    clientBehaviors.push({ type: 'ready' })

    const result = await manager.connect({
      password: 'correct-password',
      rememberPassword: true,
      serverId: 'server-1'
    })

    expect(result.ok).toBe(true)
    expect(database.recordRecentSession).toHaveBeenCalledWith('server-1')
    expect(secureStore.setSecret).toHaveBeenCalledWith('server-1', 'password', 'correct-password')
  })
})
