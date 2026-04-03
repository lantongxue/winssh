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
    terminal: {
      background: '#ffffff',
      foreground: '#1f2328',
      cursor: '#0f6cbd',
      selectionBackground: 'rgba(15,108,189,0.18)',
      black: '#24292f',
      red: '#cf222e',
      green: '#1a7f37',
      yellow: '#9a6700',
      blue: '#0969da',
      magenta: '#8250df',
      cyan: '#1b7c83',
      white: '#57606a',
      brightBlack: '#6e7781',
      brightRed: '#a40e26',
      brightGreen: '#116329',
      brightYellow: '#7d4e00',
      brightBlue: '#0550ae',
      brightMagenta: '#6639ba',
      brightCyan: '#0a6a75',
      brightWhite: '#24292f'
    },
    version: '0.1.0'
  }),
  createThemeDefinition({
    appearance: 'dark',
    id: DEFAULT_DARK_THEME_ID,
    label: 'Dark+',
    pluginDisplayName: 'WinSSH Default Themes',
    pluginId: 'winssh.default-themes',
    source: 'builtin',
    terminal: {
      background: '#181a1f',
      foreground: '#d7dbe0',
      cursor: '#3794ff',
      selectionBackground: 'rgba(55,148,255,0.24)',
      black: '#181a1f',
      red: '#f14c4c',
      green: '#33c481',
      yellow: '#f0b44c',
      blue: '#3794ff',
      magenta: '#bc8cff',
      cyan: '#4fd6be',
      white: '#d7dbe0',
      brightBlack: '#97a3b6',
      brightRed: '#ff7b72',
      brightGreen: '#5ee6a0',
      brightYellow: '#ffd172',
      brightBlue: '#74b7ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#7ee7d8',
      brightWhite: '#f3f6fa'
    },
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
      background: '#0b1811',
      brightBlack: '#4e6954',
      brightBlue: '#8acaff',
      brightCyan: '#8dffe5',
      brightGreen: '#a8ffb9',
      brightMagenta: '#efb0ff',
      brightRed: '#ff9d91',
      brightWhite: '#f2fff4',
      brightYellow: '#e7ff9b',
      black: '#0b1811',
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
    getCapabilities:
      systemOverrides?.getCapabilities ?? (async () => ({ credentialStorage: true })),
    getKnownHosts: systemOverrides?.getKnownHosts ?? (async () => []),
    listFonts:
      systemOverrides?.listFonts ??
      (async () => ['Consolas', 'JetBrains Mono', 'Cascadia Mono', 'IBM Plex Mono']),
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
      getSecrets: async () => ({
        password: null,
        passphrase: null,
        privateKey: null
      }),
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
      createFile: async () => undefined,
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
