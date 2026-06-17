import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp } from 'node:fs/promises'
import { ConnectionFailure } from '@main/services/ssh-connection-errors'
import { SshConnectionResolver } from '@main/services/ssh-connection-resolver'
import type { DatabaseService } from '@main/database'
import type { Server } from '@shared/types'

function createServer(overrides: Partial<Server> = {}): Server {
  return {
    authType: 'password',
    brandId: null,
    captureCommandHistory: true,
    createdAt: '2026-06-09T00:00:00.000Z',
    credentialId: null,
    customIconDataUrl: null,
    favorite: false,
    group: null,
    groupId: null,
    hasPassphrase: false,
    hasPassword: false,
    host: 'example.com',
    id: 'server-1',
    jumpServerId: null,
    lastConnectedAt: null,
    name: 'Example',
    note: null,
    port: 22,
    privateKeyPath: null,
    tags: [],
    updatedAt: '2026-06-09T00:00:00.000Z',
    username: 'alice',
    ...overrides
  }
}

describe('SshConnectionResolver', () => {
  it('requires a password for password authentication', async () => {
    const database = {
      getServerPassword: vi.fn(() => null),
      getServerPassphrase: vi.fn(() => null)
    } as unknown as DatabaseService
    const resolver = new SshConnectionResolver(database, (key) => key)

    await expect(resolver.resolveAuth(createServer(), { serverId: 'server-1' })).rejects.toMatchObject(
      {
        code: 'secret_required',
        serverId: 'server-1',
        secretKind: 'password'
      } satisfies Partial<ConnectionFailure>
    )
  })

  it('prefers stored private key content and falls back to legacy private key path', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'winssh-key-'))
    const keyPath = join(dir, 'id_rsa')
    await fs.writeFile(keyPath, 'path-private-key', 'utf8')

    const database = {
      getServerPassword: vi.fn(() => null),
      getServerPassphrase: vi.fn(() => 'stored-passphrase'),
      getServerPrivateKey: vi.fn(() => null)
    } as unknown as DatabaseService
    const resolver = new SshConnectionResolver(database, (key) => key)

    const auth = await resolver.resolveAuth(
      createServer({ authType: 'privateKey', privateKeyPath: keyPath }),
      { serverId: 'server-1' }
    )

    expect(auth.privateKey).toBe('path-private-key')
    expect(auth.passphrase).toBe('stored-passphrase')

    vi.mocked(database.getServerPrivateKey).mockReturnValue('inline-private-key')

    await expect(
      resolver.resolveAuth(createServer({ authType: 'privateKey', privateKeyPath: keyPath }), {
        serverId: 'server-1'
      })
    ).resolves.toMatchObject({ privateKey: 'inline-private-key' })
  })

  it('rejects nested jump servers', () => {
    const jump = createServer({ id: 'jump-1', jumpServerId: 'jump-2' })
    const database = {
      getServerById: vi.fn(() => jump)
    } as unknown as DatabaseService
    const resolver = new SshConnectionResolver(database, (key) => key)

    expect(() => resolver.resolveJumpServer(createServer({ jumpServerId: 'jump-1' }))).toThrow(
      ConnectionFailure
    )
  })
})
