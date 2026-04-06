import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  shell,
  type OpenDialogOptions
} from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { APP_ID } from '@shared/constants'
import { isServerIconMimeType, type ServerIconMimeType } from '@shared/server-brands'
import { getDefaultThemeId, SYSTEM_THEME_ID, type ThemeAppearance } from '@shared/themes'
import type {
  AppSettings,
  ConnectionRequest,
  CredentialUpsertInput,
  GroupInput,
  PortForwardInput,
  ServerUpsertInput,
  TagInput
} from '@shared/types'
import {
  connectionRequestSchema,
  credentialSchema,
  groupSchema,
  portForwardSchema,
  serverSchema,
  settingsSchema,
  tagSchema
} from '@shared/validation'
import { DatabaseService } from './database'
import { LocalTerminalManager } from './local-terminal-manager'
import { createMainTranslator, resolveMainLanguage } from './localization'
import { SecureStoreService } from './secure-store'
import { SessionManager } from './session-manager'
import { configureHardwareAcceleration } from './gpu-config'
import { SystemFontService } from './system-fonts'
import { ThemeRegistry, ThemeRegistryError } from './theme-registry'
import { getWindowChromeOptions } from './window-config'

let mainWindow: BrowserWindow | null = null

function sendWindowState(window: BrowserWindow) {
  window.webContents.send('system:windowState', {
    isMaximized: window.isMaximized()
  })
}

function createWindow(settings: AppSettings, themeRegistry: ThemeRegistry): BrowserWindow {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1280,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    title: 'WinSSH',
    backgroundColor: themeRegistry.getWindowBackgroundColor(
      settings.theme,
      nativeTheme.shouldUseDarkColors
    ),
    ...(process.platform === 'linux' ? { icon } : {}),
    ...getWindowChromeOptions(settings, process.platform),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  window.on('ready-to-show', () => {
    window.show()
  })
  window.on('maximize', () => sendWindowState(window))
  window.on('unmaximize', () => sendWindowState(window))

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  window.webContents.on('did-finish-load', () => {
    sendWindowState(window)
  })

  return window
}

function parseInput<T>(parser: { parse: (value: unknown) => T }, value: unknown): T {
  return parser.parse(value)
}

function getServerIconMimeType(filePath: string): ServerIconMimeType | null {
  const extension = extname(filePath).toLowerCase()
  const mimeType =
    extension === '.png'
      ? 'image/png'
      : extension === '.jpg' || extension === '.jpeg'
        ? 'image/jpeg'
        : extension === '.webp'
          ? 'image/webp'
          : null

  return mimeType && isServerIconMimeType(mimeType) ? mimeType : null
}

async function bootstrap(): Promise<void> {
  electronApp.setAppUserModelId(APP_ID)

  const database = new DatabaseService(join(app.getPath('userData'), 'winssh.db'))
  const themeRegistry = new ThemeRegistry(
    join(app.getAppPath(), 'themes', 'builtin'),
    join(app.getPath('userData'), 'themes')
  )
  const secureStore = new SecureStoreService()
  const systemFontService = new SystemFontService()
  const translate = createMainTranslator(() =>
    resolveMainLanguage(database.getSettings().language, app.getLocale())
  )
  const sessionManager = new SessionManager(
    database,
    secureStore,
    () => mainWindow,
    (channel, payload) => {
      mainWindow?.webContents.send(channel, payload)
    },
    translate
  )
  const localTerminalManager = new LocalTerminalManager((channel, payload) => {
    mainWindow?.webContents.send(channel, payload)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const withServerSecrets = async () => {
    const servers = database.listServers()
    const statuses = await secureStore.listStatuses(servers.map((server) => server.id))
    return servers.map((server) => {
      const status = statuses.get(server.id)
      return {
        ...server,
        hasPassword: status?.hasPassword ?? false,
        hasPassphrase: status?.hasPassphrase ?? false
      }
    })
  }

  const persistSecrets = async (serverId: string, payload: ServerUpsertInput) => {
    if (payload.authType === 'password') {
      if (!payload.rememberPassword) {
        await secureStore.deleteSecret(serverId, 'password')
      } else if (payload.password) {
        await secureStore.setSecret(serverId, 'password', payload.password)
      }

      await secureStore.deleteSecret(serverId, 'passphrase')
    }

    if (payload.authType === 'privateKey') {
      if (!payload.rememberPassphrase) {
        await secureStore.deleteSecret(serverId, 'passphrase')
      } else if (payload.passphrase) {
        await secureStore.setSecret(serverId, 'passphrase', payload.passphrase)
      }

      await secureStore.deleteSecret(serverId, 'password')
    }
  }

  const resolveStoredPrivateKey = async (id: string) => {
    const server = database.getServerById(id)
    if (!server) {
      return null
    }

    // Priority 1: credential vault reference
    if (server.credentialId) {
      const secret = database.getCredentialSecret(server.credentialId)
      if (secret?.privateKey?.trim()) {
        return secret.privateKey
      }
    }

    const storedPrivateKey = database.getServerPrivateKey(id)
    if (storedPrivateKey?.trim()) {
      return storedPrivateKey
    }

    if (!server.privateKeyPath) {
      return null
    }

    try {
      return await readFile(server.privateKeyPath, 'utf8')
    } catch {
      return null
    }
  }

  const captureThemeSelectionState = () => {
    const settings = themeRegistry.normalizeSettings(database.getSettings())
    const selection = settings.theme
    const selectedTheme = selection === SYSTEM_THEME_ID ? null : themeRegistry.getTheme(selection)

    return {
      appearance: selectedTheme?.appearance ?? null,
      selection
    }
  }

  const syncThemeSelectionAfterMutation = (previousState: {
    appearance: ThemeAppearance | null
    selection: string
  }) => {
    if (
      previousState.selection === SYSTEM_THEME_ID ||
      !previousState.appearance ||
      themeRegistry.hasTheme(previousState.selection)
    ) {
      return null
    }

    const nextThemeSelection = getDefaultThemeId(previousState.appearance)
    database.updateSettings({
      ...themeRegistry.normalizeSettings(database.getSettings()),
      theme: nextThemeSelection
    })

    return nextThemeSelection
  }

  const formatThemeRegistryError = (error: unknown) => {
    if (!(error instanceof ThemeRegistryError)) {
      return error instanceof Error ? error.message : translate('errors.themeImportFailed')
    }

    switch (error.code) {
      case 'archiveEmpty':
      case 'archiveInvalid':
      case 'invalidPlugin':
      case 'invalidPluginDirectoryName':
        return translate('errors.themeImportFailed')
      case 'archiveLayoutInvalid':
        return translate('errors.themeArchiveLayoutInvalid')
      case 'builtinThemeConflict':
        return translate('errors.themeBuiltinConflict', {
          value: error.context.themeId ?? error.context.pluginId ?? 'builtin'
        })
      case 'pluginDeleteBuiltin':
        return translate('errors.themePluginDeleteBuiltin')
      case 'pluginNotFound':
        return translate('errors.themePluginNotFound')
      default:
        return translate('errors.themeImportFailed')
    }
  }

  ipcMain.handle('credentials:list', () => database.listCredentials())
  ipcMain.handle('credentials:getSecret', (_event, id: string) => {
    const secret = database.getCredentialSecret(id)
    return secret ?? { password: null, privateKey: null, passphrase: null }
  })
  ipcMain.handle('credentials:create', (_event, input: CredentialUpsertInput) => {
    const payload = parseInput(credentialSchema, input)
    return database.createCredential(payload as CredentialUpsertInput)
  })
  ipcMain.handle('credentials:update', (_event, id: string, input: CredentialUpsertInput) => {
    const payload = parseInput(credentialSchema, input)
    return database.updateCredential(id, payload as CredentialUpsertInput)
  })
  ipcMain.handle('credentials:delete', (_event, id: string) => {
    database.deleteCredential(id)
  })

  ipcMain.handle('groups:list', () => database.listGroups())
  ipcMain.handle('groups:create', (_event, input: GroupInput) =>
    database.createGroup(parseInput(groupSchema, input))
  )
  ipcMain.handle('groups:update', (_event, id: string, input: GroupInput) =>
    database.updateGroup(id, parseInput(groupSchema, input))
  )
  ipcMain.handle('groups:delete', (_event, id: string) => {
    database.deleteGroup(id)
  })

  ipcMain.handle('tags:list', () => database.listTags())
  ipcMain.handle('tags:create', (_event, input: TagInput) =>
    database.createTag(parseInput(tagSchema, input))
  )
  ipcMain.handle('tags:update', (_event, id: string, input: TagInput) =>
    database.updateTag(id, parseInput(tagSchema, input))
  )
  ipcMain.handle('tags:delete', (_event, id: string) => {
    database.deleteTag(id)
  })

  ipcMain.handle('servers:list', async () => withServerSecrets())
  ipcMain.handle('servers:getSecrets', async (_event, id: string) => {
    const server = database.getServerById(id)
    if (!server) {
      return {
        password: null,
        passphrase: null,
        privateKey: null
      }
    }

    // If server references a credential vault entry, return that credential's secrets
    if (server.credentialId) {
      const credSecret = database.getCredentialSecret(server.credentialId)
      if (credSecret) {
        return {
          password: credSecret.password,
          passphrase: credSecret.passphrase,
          privateKey: credSecret.privateKey
        }
      }
    }

    const [password, passphrase, privateKey] = await Promise.all([
      secureStore.getSecret(id, 'password'),
      secureStore.getSecret(id, 'passphrase'),
      resolveStoredPrivateKey(id)
    ])

    return {
      password,
      passphrase,
      privateKey
    }
  })
  ipcMain.handle('servers:create', async (_event, input: ServerUpsertInput) => {
    const payload = parseInput(serverSchema, input)
    const server = database.createServer(payload)
    await persistSecrets(server.id, payload)
    const [updated] = (await withServerSecrets()).filter((item) => item.id === server.id)
    return updated
  })
  ipcMain.handle('servers:update', async (_event, id: string, input: ServerUpsertInput) => {
    const payload = parseInput(serverSchema, { ...input, id })
    const server = database.updateServer(id, payload)
    await persistSecrets(server.id, payload)
    const [updated] = (await withServerSecrets()).filter((item) => item.id === server.id)
    return updated
  })
  ipcMain.handle('servers:delete', async (_event, id: string) => {
    await secureStore.deleteSecret(id, 'password')
    await secureStore.deleteSecret(id, 'passphrase')
    database.deleteServer(id)
  })
  ipcMain.handle('servers:toggleFavorite', async (_event, id: string) => {
    database.toggleFavorite(id)
    const [updated] = (await withServerSecrets()).filter((item) => item.id === id)
    return updated
  })
  ipcMain.handle('servers:listRecent', () => database.listRecentSessions())
  ipcMain.handle('servers:clearRecent', () => {
    database.clearRecentSessions()
  })

  ipcMain.handle('sessions:connect', async (_event, request: ConnectionRequest) =>
    sessionManager.connect(parseInput(connectionRequestSchema, request))
  )
  ipcMain.handle('sessions:disconnect', (_event, sessionId: string) =>
    sessionManager.disconnect(sessionId)
  )
  ipcMain.handle('sessions:reconnect', (_event, sessionId: string) =>
    sessionManager.reconnect(sessionId)
  )
  ipcMain.handle('sessions:getResourceSnapshot', (_event, sessionId: string) =>
    sessionManager.getResourceSnapshot(sessionId)
  )
  ipcMain.handle('sessions:write', (_event, sessionId: string, data: string) =>
    sessionManager.write(sessionId, data)
  )
  ipcMain.handle('sessions:resize', (_event, sessionId: string, columns: number, rows: number) =>
    sessionManager.resize(sessionId, columns, rows)
  )
  ipcMain.handle('localTerminals:create', () => localTerminalManager.create())
  ipcMain.handle('localTerminals:close', (_event, terminalId: string) =>
    localTerminalManager.close(terminalId)
  )
  ipcMain.handle('localTerminals:write', (_event, terminalId: string, data: string) =>
    localTerminalManager.write(terminalId, data)
  )
  ipcMain.handle(
    'localTerminals:resize',
    (_event, terminalId: string, columns: number, rows: number) =>
      localTerminalManager.resize(terminalId, columns, rows)
  )

  ipcMain.handle('sftp:list', (_event, sessionId: string, remotePath: string) =>
    sessionManager.listDirectory(sessionId, remotePath)
  )
  ipcMain.handle('sftp:refresh', (_event, sessionId: string, remotePath: string) =>
    sessionManager.listDirectory(sessionId, remotePath)
  )
  ipcMain.handle('sftp:createFile', (_event, sessionId: string, remotePath: string, name: string) =>
    sessionManager.createFile(sessionId, remotePath, name)
  )
  ipcMain.handle('sftp:mkdir', (_event, sessionId: string, remotePath: string, name: string) =>
    sessionManager.makeDirectory(sessionId, remotePath, name)
  )
  ipcMain.handle('sftp:rename', (_event, sessionId: string, remotePath: string, newName: string) =>
    sessionManager.rename(sessionId, remotePath, newName)
  )
  ipcMain.handle('sftp:remove', (_event, sessionId: string, remotePath: string) =>
    sessionManager.remove(sessionId, remotePath)
  )
  ipcMain.handle('sftp:uploadFiles', (_event, sessionId: string, targetPath: string) =>
    sessionManager.uploadFiles(sessionId, targetPath)
  )
  ipcMain.handle('sftp:downloadFile', (_event, sessionId: string, remotePath: string) =>
    sessionManager.downloadFile(sessionId, remotePath)
  )

  ipcMain.handle('portForwards:list', (_event, sessionId: string) =>
    sessionManager.listPortForwards(sessionId)
  )
  ipcMain.handle('portForwards:create', (_event, sessionId: string, input: PortForwardInput) =>
    sessionManager.createPortForward(sessionId, parseInput(portForwardSchema, input))
  )
  ipcMain.handle('portForwards:start', (_event, sessionId: string, ruleId: string) =>
    sessionManager.startPortForward(sessionId, ruleId)
  )
  ipcMain.handle('portForwards:stop', (_event, sessionId: string, ruleId: string) =>
    sessionManager.stopPortForward(sessionId, ruleId)
  )
  ipcMain.handle('portForwards:remove', (_event, sessionId: string, ruleId: string) =>
    sessionManager.removePortForward(sessionId, ruleId)
  )

  ipcMain.handle('themes:list', () => themeRegistry.listThemes())
  ipcMain.handle('themes:importArchive', async () => {
    const options: OpenDialogOptions = {
      title: translate('dialogs.importThemeArchive.title'),
      properties: ['openFile'],
      filters: [
        {
          name: translate('dialogs.importThemeArchive.filters.zip'),
          extensions: ['zip']
        },
        { name: translate('dialogs.importThemeArchive.filters.allFiles'), extensions: ['*'] }
      ]
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled) {
      return null
    }

    const filePath = result.filePaths[0]
    if (!filePath) {
      return null
    }

    const previousThemeState = captureThemeSelectionState()

    try {
      const imported = await themeRegistry.importArchive(filePath)
      syncThemeSelectionAfterMutation(previousThemeState)
      return imported
    } catch (error) {
      throw new Error(formatThemeRegistryError(error))
    }
  })
  ipcMain.handle('themes:deletePlugin', async (_event, pluginId: string) => {
    const previousThemeState = captureThemeSelectionState()

    try {
      const deleted = await themeRegistry.deletePlugin(pluginId)
      const nextThemeSelection = syncThemeSelectionAfterMutation(previousThemeState)

      return {
        ...deleted,
        nextThemeSelection
      }
    } catch (error) {
      throw new Error(formatThemeRegistryError(error))
    }
  })
  ipcMain.handle('settings:get', () => themeRegistry.normalizeSettings(database.getSettings()))
  ipcMain.handle('settings:update', (_event, input: Partial<AppSettings>) => {
    const merged = parseInput(settingsSchema, {
      ...themeRegistry.normalizeSettings(database.getSettings()),
      ...input
    })

    if (!themeRegistry.isValidSelection(merged.theme)) {
      throw new Error(`unknown theme "${merged.theme}"`)
    }

    return themeRegistry.normalizeSettings(database.updateSettings(merged))
  })

  ipcMain.handle('system:pickPrivateKey', async () => {
    const options: OpenDialogOptions = {
      title: translate('dialogs.pickPrivateKey.title'),
      properties: ['openFile'],
      filters: [
        {
          name: translate('dialogs.pickPrivateKey.filters.privateKey'),
          extensions: ['pem', 'ppk', 'key', 'pub']
        },
        { name: translate('dialogs.pickPrivateKey.filters.allFiles'), extensions: ['*'] }
      ]
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled) {
      return null
    }

    const filePath = result.filePaths[0]
    if (!filePath) {
      return null
    }

    return readFile(filePath, 'utf8')
  })
  ipcMain.handle('system:pickServerIcon', async () => {
    const options: OpenDialogOptions = {
      title: translate('dialogs.pickServerIcon.title'),
      properties: ['openFile'],
      filters: [
        {
          name: translate('dialogs.pickServerIcon.filters.images'),
          extensions: ['png', 'jpg', 'jpeg', 'webp']
        },
        { name: translate('dialogs.pickServerIcon.filters.allFiles'), extensions: ['*'] }
      ]
    }
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled) {
      return null
    }

    const filePath = result.filePaths[0]
    if (!filePath) {
      return null
    }

    const mimeType = getServerIconMimeType(filePath)
    if (!mimeType) {
      return null
    }

    const data = new Uint8Array(await readFile(filePath))
    return {
      mimeType,
      data
    }
  })
  ipcMain.handle('system:listFonts', () => systemFontService.listFonts())
  ipcMain.handle('system:getKnownHosts', () => database.listKnownHosts())
  ipcMain.handle('system:removeKnownHost', (_event, host: string, port: number) => {
    database.deleteKnownHost(host, port)
  })
  ipcMain.handle('system:getCapabilities', async () => ({
    credentialStorage: await secureStore.isAvailable()
  }))
  ipcMain.handle('system:relaunch', () => {
    app.relaunch()
    app.exit(0)
  })
  ipcMain.handle('system:window:minimize', () => {
    mainWindow?.minimize()
  })
  ipcMain.handle('system:window:toggleMaximize', () => {
    if (!mainWindow) {
      return
    }

    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize()
      return
    }

    mainWindow.maximize()
  })
  ipcMain.handle('system:window:close', () => {
    mainWindow?.close()
  })
  ipcMain.handle('system:window:isMaximized', () => mainWindow?.isMaximized() ?? false)

  mainWindow = createWindow(themeRegistry.normalizeSettings(database.getSettings()), themeRegistry)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow(
        themeRegistry.normalizeSettings(database.getSettings()),
        themeRegistry
      )
    }
  })

  app.on('before-quit', () => {
    localTerminalManager.dispose()
    sessionManager.dispose()
    database.close()
  })
}

configureHardwareAcceleration(app, process.platform, process.env)

app.whenReady().then(bootstrap)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
