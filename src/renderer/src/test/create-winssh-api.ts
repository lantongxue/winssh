import type { WinsshApi } from '@shared/api'

const noopUnsubscribe = () => undefined

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

export function createWinsshApiMock(overrides: DeepPartial<WinsshApi> = {}): WinsshApi {
  const systemOverrides = overrides.system
  const windowOverrides = systemOverrides?.window

  return {
    groups: {
      create: async () => {
        throw new Error('not implemented')
      },
      delete: async () => undefined,
      list: async () => [],
      update: async () => {
        throw new Error('not implemented')
      },
      ...overrides.groups
    },
    tags: {
      create: async () => {
        throw new Error('not implemented')
      },
      delete: async () => undefined,
      list: async () => [],
      update: async () => {
        throw new Error('not implemented')
      },
      ...overrides.tags
    },
    servers: {
      clearRecent: async () => undefined,
      create: async () => {
        throw new Error('not implemented')
      },
      delete: async () => undefined,
      list: async () => [],
      listRecent: async () => [],
      toggleFavorite: async () => {
        throw new Error('not implemented')
      },
      update: async () => {
        throw new Error('not implemented')
      },
      ...overrides.servers
    },
    sessions: {
      connect: async () => ({ code: 'connection_failed', message: 'not implemented', ok: false }),
      disconnect: async () => undefined,
      onData: () => noopUnsubscribe,
      onError: () => noopUnsubscribe,
      onExit: () => noopUnsubscribe,
      onStateChange: () => noopUnsubscribe,
      reconnect: async () => {
        throw new Error('not implemented')
      },
      resize: async () => undefined,
      write: async () => undefined,
      ...overrides.sessions
    },
    sftp: {
      downloadFile: async () => undefined,
      list: async () => ({ entries: [], path: '/' }),
      mkdir: async () => undefined,
      onTransferProgress: () => noopUnsubscribe,
      refresh: async () => ({ entries: [], path: '/' }),
      remove: async () => undefined,
      rename: async () => undefined,
      uploadFiles: async () => undefined,
      ...overrides.sftp
    },
    portForwards: {
      create: async () => {
        throw new Error('not implemented')
      },
      list: async () => [],
      onStateChange: () => noopUnsubscribe,
      remove: async () => undefined,
      start: async () => {
        throw new Error('not implemented')
      },
      stop: async () => {
        throw new Error('not implemented')
      },
      ...overrides.portForwards
    },
    settings: {
      get: async () => ({
        copyOnSelect: true,
        cursorBlink: true,
        cursorStyle: 'block',
        language: 'en-US',
        terminalFontFamily: 'Consolas',
        terminalFontSize: 14,
        theme: 'system',
        windowTitleBarStyle: 'custom'
      }),
      update: async (input) => ({
        copyOnSelect: true,
        cursorBlink: true,
        cursorStyle: 'block',
        language: 'en-US',
        terminalFontFamily: 'Consolas',
        terminalFontSize: 14,
        theme: input.theme ?? 'system',
        windowTitleBarStyle: 'custom'
      }),
      ...overrides.settings
    },
    system: {
      ...systemOverrides,
      getCapabilities: async () => ({ credentialStorage: true }),
      getKnownHosts: async () => [],
      pickPrivateKey: async () => null,
      relaunch: async () => undefined,
      window: {
        close: async () => undefined,
        isMaximized: async () => false,
        minimize: async () => undefined,
        onStateChange: () => noopUnsubscribe,
        toggleMaximize: async () => undefined,
        ...windowOverrides
      }
    }
  }
}
