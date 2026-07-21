import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { resolveServerProxy } from '@shared/proxy'
import type { Server } from '@shared/types'

function createServer(overrides: Partial<Server> = {}): Server {
  return {
    id: 'server-1',
    name: 'Server',
    host: 'example.com',
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
    proxyMode: 'global',
    proxyType: 'socks5',
    proxyHost: null,
    proxyPort: 1080,
    favorite: false,
    captureCommandHistory: true,
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

describe('resolveServerProxy', () => {
  it('defaults to a direct connection when the global proxy is disabled', () => {
    expect(resolveServerProxy(createServer(), DEFAULT_APP_SETTINGS)).toBeNull()
  })

  it('inherits the manually configured global proxy', () => {
    expect(
      resolveServerProxy(createServer(), {
        ...DEFAULT_APP_SETTINGS,
        proxyMode: 'manual',
        proxyType: 'http',
        proxyHost: 'global.proxy',
        proxyPort: 3128
      })
    ).toEqual({ type: 'http', host: 'global.proxy', port: 3128 })
  })

  it('lets a server disable or override the global proxy', () => {
    const globalSettings = {
      ...DEFAULT_APP_SETTINGS,
      proxyMode: 'manual' as const,
      proxyHost: 'global.proxy'
    }

    expect(resolveServerProxy(createServer({ proxyMode: 'none' }), globalSettings)).toBeNull()
    expect(
      resolveServerProxy(
        createServer({
          proxyMode: 'custom',
          proxyType: 'socks5',
          proxyHost: 'server.proxy',
          proxyPort: 1081
        }),
        globalSettings
      )
    ).toEqual({ type: 'socks5', host: 'server.proxy', port: 1081 })
  })
})
