import type { WinsshApi } from '@shared/api'
import {
  createThemeDefinition,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  DEFAULT_PIXEL_THEME_ID
} from '@shared/themes'

const noopUnsubscribe = () => undefined

const defaultThemes = [
  createThemeDefinition({
    appearance: 'light',
    id: DEFAULT_LIGHT_THEME_ID,
    label: 'Light+',
    pluginDisplayName: 'WinSSH Default Themes',
    pluginId: 'winssh.default-themes',
    source: 'builtin',
    version: '0.1.0'
  }),
  createThemeDefinition({
    appearance: 'dark',
    id: DEFAULT_DARK_THEME_ID,
    label: 'Dark+',
    pluginDisplayName: 'WinSSH Default Themes',
    pluginId: 'winssh.default-themes',
    source: 'builtin',
    version: '0.1.0'
  }),
  createThemeDefinition({
    appearance: 'dark',
    id: DEFAULT_PIXEL_THEME_ID,
    label: 'Pixel CRT',
    pluginDisplayName: 'WinSSH Default Themes',
    pluginId: 'winssh.default-themes',
    source: 'builtin',
    terminal: {
      background: '#050b07',
      brightBlack: '#4e6954',
      brightBlue: '#8acaff',
      brightCyan: '#8dffe5',
      brightGreen: '#a8ffb9',
      brightMagenta: '#efb0ff',
      brightRed: '#ff9d91',
      brightWhite: '#f2fff4',
      brightYellow: '#e7ff9b',
      black: '#050b07',
      blue: '#69b7ff',
      cursor: '#7dff9b',
      cyan: '#63ffd5',
      foreground: '#9ff6a8',
      green: '#7dff9b',
      magenta: '#e38bff',
      red: '#ff7a6b',
      selectionBackground: 'rgba(125,255,155,0.22)',
      white: '#d8ffe1',
      yellow: '#d8ff72'
    },
    terminalDefaults: {
      fontFamily: 'Lucida Console, Cascadia Mono, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.08
    },
    version: '0.1.0'
  })
]

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
  const defaultWindowApi: WinsshApi['system']['window'] = {
    close: async () => undefined,
    isMaximized: async () => false,
    minimize: async () => undefined,
    onStateChange: () => noopUnsubscribe,
    toggleMaximize: async () => undefined
  }
  const resolvedWindowApi: WinsshApi['system']['window'] = {
    close: windowOverrides?.close ?? defaultWindowApi.close,
    isMaximized: windowOverrides?.isMaximized ?? defaultWindowApi.isMaximized,
    minimize: windowOverrides?.minimize ?? defaultWindowApi.minimize,
    onStateChange: windowOverrides?.onStateChange ?? defaultWindowApi.onStateChange,
    toggleMaximize: windowOverrides?.toggleMaximize ?? defaultWindowApi.toggleMaximize
  }
  const resolvedSystemApi: WinsshApi['system'] = {
    getCapabilities: systemOverrides?.getCapabilities ?? (async () => ({ credentialStorage: true })),
    getKnownHosts: systemOverrides?.getKnownHosts ?? (async () => []),
    removeKnownHost: systemOverrides?.removeKnownHost ?? (async () => undefined),
    pickPrivateKey: systemOverrides?.pickPrivateKey ?? (async () => null),
    relaunch: systemOverrides?.relaunch ?? (async () => undefined),
    window: resolvedWindowApi
  }

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
    themes: {
      list: async () => defaultThemes,
      ...overrides.themes
    },
    system: resolvedSystemApi
  }
}
