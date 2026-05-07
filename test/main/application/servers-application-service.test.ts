import type { Server } from '@shared/types'
import { ServersApplicationService } from '@main/application/servers-application-service'

interface ServersDatabaseDouble {
  createServer?: ReturnType<typeof vi.fn>
  getCredentialSecret?: ReturnType<typeof vi.fn>
  getServerById?: ReturnType<typeof vi.fn>
  listServers?: ReturnType<typeof vi.fn>
}

interface SecureStoreDouble {
  deleteSecret?: ReturnType<typeof vi.fn>
  getSecret?: ReturnType<typeof vi.fn>
  listStatuses?: ReturnType<typeof vi.fn>
  setSecret?: ReturnType<typeof vi.fn>
}

function createServer(overrides: Partial<Server> = {}): Server {
  return {
    authType: 'password',
    brandId: null,
    createdAt: '2026-04-10T00:00:00.000Z',
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
    updatedAt: '2026-04-10T00:00:00.000Z',
    username: 'tester',
    ...overrides
  }
}

describe('ServersApplicationService', () => {
  it('merges secure-store status into listed servers', async () => {
    const database = {
      listServers: vi.fn(() => [createServer()])
    } satisfies ServersDatabaseDouble as unknown as ConstructorParameters<
      typeof ServersApplicationService
    >[0]
    const secureStore = {
      listStatuses: vi.fn(
        async () =>
          new Map([
            [
              'server-1',
              {
                hasPassphrase: false,
                hasPassword: true
              }
            ]
          ])
      )
    } satisfies SecureStoreDouble as unknown as ConstructorParameters<
      typeof ServersApplicationService
    >[1]

    const service = new ServersApplicationService(database, secureStore)
    const servers = await service.listServers()

    expect(servers).toHaveLength(1)
    expect(servers[0]).toMatchObject({
      hasPassphrase: false,
      hasPassword: true,
      id: 'server-1'
    })
  })

  it('prefers credential-vault secrets over server-level secrets', async () => {
    const database = {
      getCredentialSecret: vi.fn(() => ({
        passphrase: 'vault-passphrase',
        password: 'vault-password',
        privateKey: 'vault-private-key'
      })),
      getServerById: vi.fn(() =>
        createServer({
          authType: 'privateKey',
          credentialId: 'cred-1'
        })
      )
    } satisfies ServersDatabaseDouble as unknown as ConstructorParameters<
      typeof ServersApplicationService
    >[0]
    const secureStore = {
      getSecret: vi.fn(async () => 'ignored'),
      listStatuses: vi.fn(async () => new Map())
    } satisfies SecureStoreDouble as unknown as ConstructorParameters<
      typeof ServersApplicationService
    >[1]

    const service = new ServersApplicationService(database, secureStore)
    const secrets = await service.getSecrets('server-1')

    expect(secrets).toEqual({
      passphrase: 'vault-passphrase',
      password: 'vault-password',
      privateKey: 'vault-private-key'
    })
    expect(secureStore.getSecret).not.toHaveBeenCalled()
  })

  it('persists remembered password secrets during create', async () => {
    const createdServer = createServer()
    const database = {
      createServer: vi.fn(() => createdServer),
      listServers: vi.fn(() => [createdServer])
    } satisfies ServersDatabaseDouble as unknown as ConstructorParameters<
      typeof ServersApplicationService
    >[0]
    const secureStore = {
      deleteSecret: vi.fn(async () => undefined),
      listStatuses: vi.fn(
        async () =>
          new Map([
            [
              'server-1',
              {
                hasPassphrase: false,
                hasPassword: true
              }
            ]
          ])
      ),
      setSecret: vi.fn(async () => undefined)
    } satisfies SecureStoreDouble as unknown as ConstructorParameters<
      typeof ServersApplicationService
    >[1]

    const service = new ServersApplicationService(database, secureStore)

    await service.create({
      authType: 'password',
      favorite: false,
      groupId: null,
      host: 'example.com',
      jumpServerId: null,
      name: 'Example',
      note: '',
      password: 'top-secret',
      port: 22,
      rememberPassphrase: false,
      rememberPassword: true,
      tagIds: [],
      username: 'tester'
    })

    expect(secureStore.setSecret).toHaveBeenCalledWith('server-1', 'password', 'top-secret')
    expect(secureStore.deleteSecret).toHaveBeenCalledWith('server-1', 'passphrase')
  })
})
