import { join } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain, shell, type OpenDialogOptions } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { APP_ID } from '@shared/constants'
import type {
  AppSettings,
  ConnectionRequest,
  GroupInput,
  ServerUpsertInput,
  TagInput
} from '@shared/types'
import {
  connectionRequestSchema,
  groupSchema,
  serverSchema,
  settingsSchema,
  tagSchema
} from '@shared/validation'
import { DatabaseService } from './database'
import { createMainTranslator, resolveMainLanguage } from './localization'
import { SecureStoreService } from './secure-store'
import { SessionManager } from './session-manager'
import { configureHardwareAcceleration } from './gpu-config'
import { getWindowChromeOptions } from './window-config'

let mainWindow: BrowserWindow | null = null

function sendWindowState(window: BrowserWindow) {
  window.webContents.send('system:windowState', {
    isMaximized: window.isMaximized()
  })
}

function createWindow(settings: AppSettings): BrowserWindow {
  const window = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1280,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    title: 'WinSSH',
    backgroundColor: '#09090b',
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

async function bootstrap(): Promise<void> {
  electronApp.setAppUserModelId(APP_ID)

  const database = new DatabaseService(join(app.getPath('userData'), 'winssh.db'))
  const secureStore = new SecureStoreService()
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
  ipcMain.handle('sessions:write', (_event, sessionId: string, data: string) =>
    sessionManager.write(sessionId, data)
  )
  ipcMain.handle('sessions:resize', (_event, sessionId: string, columns: number, rows: number) =>
    sessionManager.resize(sessionId, columns, rows)
  )

  ipcMain.handle('sftp:list', (_event, sessionId: string, remotePath: string) =>
    sessionManager.listDirectory(sessionId, remotePath)
  )
  ipcMain.handle('sftp:refresh', (_event, sessionId: string, remotePath: string) =>
    sessionManager.listDirectory(sessionId, remotePath)
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

  ipcMain.handle('settings:get', () => database.getSettings())
  ipcMain.handle('settings:update', (_event, input: Partial<AppSettings>) => {
    const merged = {
      ...database.getSettings(),
      ...input
    }
    return database.updateSettings(parseInput(settingsSchema, merged))
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

    return result.filePaths[0] ?? null
  })
  ipcMain.handle('system:getKnownHosts', () => database.listKnownHosts())
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

  mainWindow = createWindow(database.getSettings())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow(database.getSettings())
    }
  })

  app.on('before-quit', () => {
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
