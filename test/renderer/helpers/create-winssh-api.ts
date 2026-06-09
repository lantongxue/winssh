import type { WinsshApi } from '@shared/api'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import {
  createThemeDefinition,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  DEFAULT_PIXEL_THEME_ID
} from '@shared/themes'
import appPackage from '../../../package.json'

const noopUnsubscribe = () => undefined
export const APP_PACKAGE_VERSION = appPackage.version

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
    version: '1.0.0'
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
    version: '1.0.0'
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
      fontId: 'cascadia-mono',
      fontSize: 13,
      lineHeight: 1.08
    },
    version: '1.0.0'
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
  const defaultSettings = {
    ...DEFAULT_APP_SETTINGS,
    language: 'en-US',
    terminalFontId: 'cascadia-mono',
    windowTitleBarStyle: 'custom'
  } as const
  const systemOverrides = overrides.system
  const menuOverrides = systemOverrides?.menu
  const windowOverrides = systemOverrides?.window
  const appFocusOverrides = systemOverrides?.appFocus
  const appActivityOverrides = systemOverrides?.appActivity
  const defaultMenuApi: WinsshApi['system']['menu'] = {
    onAction: () => noopUnsubscribe
  }
  const resolvedMenuApi: WinsshApi['system']['menu'] = {
    onAction: menuOverrides?.onAction ?? defaultMenuApi.onAction
  }
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
  const resolvedAppFocusApi: WinsshApi['system']['appFocus'] = {
    onStateChange: appFocusOverrides?.onStateChange ?? (() => noopUnsubscribe)
  }
  const resolvedAppActivityApi: WinsshApi['system']['appActivity'] = {
    onStateChange: appActivityOverrides?.onStateChange ?? (() => noopUnsubscribe)
  }
  const resolvedSystemApi: WinsshApi['system'] = {
    getCapabilities:
      systemOverrides?.getCapabilities ?? (async () => ({ credentialStorage: true })),
    getAppInfo:
      systemOverrides?.getAppInfo ??
      (async () => ({
        name: 'WinSSH',
        platform: 'linux',
        releaseChannel: 'latest',
        version: APP_PACKAGE_VERSION
      })),
    getPathForFile:
      systemOverrides?.getPathForFile ??
      ((file) => {
        const maybePath = (file as { path?: string } | null | undefined)?.path
        return maybePath?.trim() ? maybePath : null
      }),
    getKnownHosts: systemOverrides?.getKnownHosts ?? (async () => []),
    removeKnownHost: systemOverrides?.removeKnownHost ?? (async () => undefined),
    pickPrivateKey: systemOverrides?.pickPrivateKey ?? (async () => null),
    pickServerIcon: systemOverrides?.pickServerIcon ?? (async () => null),
    relaunch: systemOverrides?.relaunch ?? (async () => undefined),
    respondHostTrust: systemOverrides?.respondHostTrust ?? (async () => undefined),
    getShellIntegrationScript:
      systemOverrides?.getShellIntegrationScript ?? (async () => 'mock-script'),
    onHostTrustRequest: systemOverrides?.onHostTrustRequest ?? (() => noopUnsubscribe),
    menu: resolvedMenuApi,
    window: resolvedWindowApi,
    appFocus: resolvedAppFocusApi,
    appActivity: resolvedAppActivityApi
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
      getResourceSnapshot: async () => ({
        cpu: {
          usagePercent: 42.5
        },
        disk: {
          mountPath: '/',
          totalBytes: 512 * 1024 * 1024 * 1024,
          usedBytes: 256 * 1024 * 1024 * 1024,
          usagePercent: 50
        },
        memory: {
          totalBytes: 8 * 1024 * 1024 * 1024,
          usedBytes: 3 * 1024 * 1024 * 1024,
          usagePercent: 37.5
        },
        network: {
          rxBytesPerSecond: 128 * 1024,
          txBytesPerSecond: 64 * 1024
        },
        latency: { rttMs: 23 },
        platform: 'linux',
        sampledAt: new Date().toISOString(),
        sessionId: 'session-1'
      }),
      onData: () => noopUnsubscribe,
      createDataChannel: async () => {
        const channel = new MessageChannel()
        return channel.port1
      },
      onError: () => noopUnsubscribe,
      onExit: () => noopUnsubscribe,
      onStateChange: () => noopUnsubscribe,
      onCwdChanged: () => noopUnsubscribe,
      onTerminalBackpressure: () => noopUnsubscribe,
      onTerminalDegraded: () => noopUnsubscribe,
      reconnect: async () => {
        throw new Error('not implemented')
      },
      resize: async () => undefined,
      write: () => undefined,
      ...overrides.sessions
    },
    localTerminals: {
      close: async () => undefined,
      create: async () => ({
        cwd: '/Users/tester',
        shell: 'zsh',
        startedAt: new Date().toISOString(),
        status: 'running',
        terminalId: 'local-terminal-1',
        title: 'zsh'
      }),
      onData: () => noopUnsubscribe,
      onExit: () => noopUnsubscribe,
      onStateChange: () => noopUnsubscribe,
      resize: async () => undefined,
      write: () => undefined,
      ...overrides.localTerminals
    },
    sftp: {
      createFile: async () => undefined,
      downloadFile: async () => undefined,
      list: async () => ({ entries: [], path: '/' }),
      mkdir: async () => undefined,
      onTransferProgress: () => noopUnsubscribe,
      openFileReadStream: async (sessionId, remotePath) => ({
        encoding: 'utf8',
        fileName: remotePath.split('/').at(-1) ?? remotePath,
        remotePath,
        sessionId,
        streamId: `read:${sessionId}:${remotePath}`,
        total: 0
      }),
      startFileReadStream: () => undefined,
      openFileWriteStream: async (sessionId, remotePath) => ({
        remotePath,
        sessionId,
        streamId: `write:${sessionId}:${remotePath}`
      }),
      writeFileChunk: async () => undefined,
      closeFileWriteStream: async () => undefined,
      cancelFileStream: () => undefined,
      onFileChunk: () => noopUnsubscribe,
      onFileStreamState: () => noopUnsubscribe,
      refresh: async () => ({ entries: [], path: '/' }),
      move: async () => undefined,
      remove: async () => undefined,
      rename: async () => undefined,
      uploadFiles: async () => undefined,
      uploadPaths: async () => undefined,
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
      get: async () => ({ ...defaultSettings }),
      update: async (input) => ({
        ...defaultSettings,
        ...input
      }),
      ...overrides.settings
    },
    logs: {
      clear: async () => undefined,
      getState: async () => ({ logFilePath: '/tmp/winssh.log' }),
      list: async () => [],
      updatePath: async (logFilePath) => ({ logFilePath }),
      write: async () => undefined,
      ...overrides.logs
    },
    backup: {
      backupNow: async () => undefined,
      delete: async () => undefined,
      getState: async () => ({
        lastBackupAt: null,
        lastBackupError: null,
        nextBackupAt: null
      }),
      list: async () => [],
      restore: async () => undefined,
      testConnection: async () => ({
        message: 'ok',
        ok: true
      }),
      ...overrides.backup
    },
    updates: {
      check: async () => ({
        autoCheckEnabled: true,
        availableUpdate: null,
        currentVersion: APP_PACKAGE_VERSION,
        downloadProgressPercent: null,
        errorMessage: null,
        phase: 'not-available',
        supported: false,
        unsupportedReason: 'platform_not_supported'
      }),
      download: async () => ({
        autoCheckEnabled: true,
        availableUpdate: null,
        currentVersion: APP_PACKAGE_VERSION,
        downloadProgressPercent: null,
        errorMessage: null,
        phase: 'not-available',
        supported: false,
        unsupportedReason: 'platform_not_supported'
      }),
      getState: async () => ({
        autoCheckEnabled: true,
        availableUpdate: null,
        currentVersion: APP_PACKAGE_VERSION,
        downloadProgressPercent: null,
        errorMessage: null,
        phase: 'unsupported',
        supported: false,
        unsupportedReason: 'platform_not_supported'
      }),
      onStateChange: () => noopUnsubscribe,
      quitAndInstall: async () => undefined,
      ...overrides.updates
    },
    credentials: {
      create: async () => {
        throw new Error('not implemented')
      },
      delete: async () => undefined,
      getSecret: async () => ({
        password: null,
        passphrase: null,
        privateKey: null
      }),
      list: async () => [],
      update: async () => {
        throw new Error('not implemented')
      },
      ...overrides.credentials
    },
    themes: {
      deletePlugin: async () => ({
        deletedThemeIds: [],
        nextThemeSelection: null,
        pluginDisplayName: 'Imported Theme Pack',
        pluginId: 'example.imported-theme-pack'
      }),
      importArchive: async () => null,
      list: async () => defaultThemes,
      ...overrides.themes
    },
    commandHistory: {
      list: async () => [],
      search: async () => [],
      clear: async () => undefined,
      clearAll: async () => undefined,
      deleteEntry: async () => undefined,
      setServerCapture: async () => undefined,
      onCommandAdded: () => noopUnsubscribe,
      ...overrides.commandHistory
    },
    customCommands: {
      list: async () => [],
      create: async () => {
        throw new Error('not implemented')
      },
      update: async () => {
        throw new Error('not implemented')
      },
      delete: async () => undefined,
      ...overrides.customCommands
    },
    sftpBookmarks: {
      list: async () => [],
      add: async () => ({
        id: 'mock-id',
        serverId: 'mock-server-id',
        path: '/',
        createdAt: new Date().toISOString()
      }),
      delete: async () => undefined,
      deleteByPath: async () => undefined,
      ...overrides.sftpBookmarks
    },
    system: resolvedSystemApi
  }
}
