import { join } from 'node:path'
import { app, BrowserWindow, nativeTheme, shell, type TitleBarOverlayOptions } from 'electron'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { APP_ID, APP_NAME } from '@shared/constants'
import { normalizeLocalTerminalShell } from '@shared/local-terminal-shells'
import type { AppSettings } from '@shared/types'
import { createAppInfo } from './app-info'
import { setupAppFocusAndActivityListeners } from './app-focus-activity'
import { syncApplicationMenu } from './app-menu'
import { DatabaseService } from './database'
import { LocalTerminalManager } from './local-terminal-manager'
import { LogFileService } from './log-file-service'
import { createMainTranslator, resolveMainLanguage } from './localization'
import { createLogger, setAppLogSink } from './observability'
import { ServersApplicationService } from './application/servers-application-service'
import { SessionsApplicationService } from './application/sessions-application-service'
import { SettingsApplicationService } from './application/settings-application-service'
import { registerServerIpc } from './ipc/register-server-ipc'
import { registerSessionIpc } from './ipc/register-session-ipc'
import { registerSystemIpc } from './ipc/register-system-ipc'
import { registerCommandHistoryIpc } from './ipc/register-command-history-ipc'
import { registerCustomCommandIpc } from './ipc/register-custom-command-ipc'
import { registerSftpBookmarkIpc } from './ipc/register-sftp-bookmark-ipc'
import { SecureStoreService } from './secure-store'
import { SessionManager } from './session-manager'
import { ThemeRegistry } from './theme-registry'
import { UpdateService } from './update-service'
import { WebDAVBackupService } from './webdav-backup-service'
import { getWindowChromeOptions } from './window-config'

let mainWindow: BrowserWindow | null = null
const CUSTOM_TITLEBAR_HEIGHT = 36
const WINDOWS_TITLEBAR_OVERLAY_HEIGHT = CUSTOM_TITLEBAR_HEIGHT - 1

function sendWindowState(window: BrowserWindow) {
  window.webContents.send('system:windowState', {
    isMaximized: window.isMaximized()
  })
}

function syncWindowTheme(
  window: BrowserWindow,
  settings: Pick<AppSettings, 'theme' | 'windowTitleBarStyle'>,
  themeRegistry: ThemeRegistry
) {
  const resolvedWindowTheme = themeRegistry.getWindowThemeColors(
    settings.theme,
    nativeTheme.shouldUseDarkColors
  )

  window.setBackgroundColor(resolvedWindowTheme.backgroundColor)

  if (process.platform === 'win32' && settings.windowTitleBarStyle === 'custom') {
    const overlayOptions: TitleBarOverlayOptions = {
      color: resolvedWindowTheme.titleBarColor,
      height: WINDOWS_TITLEBAR_OVERLAY_HEIGHT,
      symbolColor: resolvedWindowTheme.titleBarSymbolColor
    }

    try {
      window.setTitleBarOverlay(overlayOptions)
    } catch {
      // Window was not created with titleBarOverlay enabled (e.g. switching
      // from native to custom title bar). The user must relaunch the app
      // for the change to take effect, so we silently ignore the error here.
    }
  }
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

  syncWindowTheme(window, settings, themeRegistry)

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

function normalizeAppSettingsForPlatform(settings: AppSettings): AppSettings {
  return {
    ...settings,
    logFilePath: settings.logFilePath?.trim() || join(app.getPath('logs'), 'winssh.log'),
    localTerminalShell: normalizeLocalTerminalShell(
      settings.localTerminalShell,
      process.platform,
      process.platform === 'win32' ? process.env['ComSpec'] : process.env['SHELL']
    )
  }
}



function parseVersionSegments(version: string): number[] {
  const [coreVersion] = version.split('-')
  return coreVersion.split('.').map((segment) => Number.parseInt(segment, 10) || 0)
}

function isVersionLessThanOrEqual(version: string, targetVersion: string): boolean {
  const current = parseVersionSegments(version)
  const target = parseVersionSegments(targetVersion)
  const length = Math.max(current.length, target.length)

  for (let index = 0; index < length; index += 1) {
    const currentSegment = current[index] ?? 0
    const targetSegment = target[index] ?? 0

    if (currentSegment < targetSegment) {
      return true
    }

    if (currentSegment > targetSegment) {
      return false
    }
  }

  return true
}

async function migrateKeychainSecretsToDatabase(
  database: DatabaseService,
  secureStore: SecureStoreService,
  version: string
): Promise<void> {
  if (!isVersionLessThanOrEqual(version, '1.1.0')) {
    return
  }

  const available = await secureStore.isAvailable()
  if (!available) {
    return
  }

  try {
    const servers = database.listServers()
    const migrations: Array<{
      serverId: string
      password: string | null
      passphrase: string | null
    }> = []

    for (const server of servers) {
      if (server.hasPassword && server.hasPassphrase) {
        continue
      }

      const [password, passphrase] = await Promise.all([
        server.hasPassword ? null : secureStore.getSecret(server.id, 'password'),
        server.hasPassphrase ? null : secureStore.getSecret(server.id, 'passphrase')
      ])

      if (password !== null || passphrase !== null) {
        migrations.push({
          serverId: server.id,
          password,
          passphrase
        })
      }
    }

    if (migrations.length > 0) {
      database.migrateServerSecrets(migrations)

      for (const migration of migrations) {
        if (migration.password !== null) {
          await secureStore.deleteSecret(migration.serverId, 'password')
        }
        if (migration.passphrase !== null) {
          await secureStore.deleteSecret(migration.serverId, 'passphrase')
        }
      }
    }
  } catch (error) {
    void error
  }
}

export async function bootstrap(): Promise<void> {
  const logger = createLogger('main')
  electronApp.setAppUserModelId(APP_ID)

  const database = new DatabaseService(join(app.getPath('userData'), 'winssh.db'))
  const themeRegistry = new ThemeRegistry(
    join(app.getAppPath(), 'themes', 'builtin'),
    join(app.getPath('userData'), 'themes')
  )
  const secureStore = new SecureStoreService()
  await migrateKeychainSecretsToDatabase(database, secureStore, app.getVersion())
  const translate = createMainTranslator(() =>
    resolveMainLanguage(database.getSettings().language, app.getLocale())
  )
  const appInfo = createAppInfo({
    name: APP_NAME,
    platform: process.platform,
    version: app.getVersion()
  })
  const updateService = new UpdateService({
    autoCheckEnabled: themeRegistry.normalizeSettings(
      normalizeAppSettingsForPlatform(database.getSettings())
    ).autoUpdateCheckEnabled,
    currentVersion: appInfo.version,
    githubOwner: 'lantongxue',
    githubRepo: 'winssh',
    isPackaged: app.isPackaged,
    platform: process.platform
  })
  const sessionManager = new SessionManager(
    database,
    () => mainWindow,
    (channel, payload) => {
      mainWindow?.webContents.send(channel, payload)
    },
    translate
  )
  const localTerminalManager = new LocalTerminalManager(
    (channel, payload) => {
      mainWindow?.webContents.send(channel, payload)
    },
    () => database.getSettings(),
    database
  )
  const logFileService = new LogFileService(
    normalizeAppSettingsForPlatform(database.getSettings()).logFilePath ??
      join(app.getPath('logs'), 'winssh.log')
  )
  setAppLogSink((event) => {
    logFileService.append(event)
  })

  const serversService = new ServersApplicationService(database, secureStore)
  const sessionsService = new SessionsApplicationService(sessionManager, localTerminalManager)
  const settingsService = new SettingsApplicationService(
    database,
    themeRegistry,
    updateService,
    normalizeAppSettingsForPlatform,
    (settings) => {
      if (mainWindow) {
        syncWindowTheme(mainWindow, settings, themeRegistry)
      }

      syncApplicationMenu({
        appName: APP_NAME,
        getMainWindow: () => mainWindow,
        isDevelopment: is.dev,
        platform: process.platform,
        translate,
        updateService
      })
    }
  )
  const webdavBackupService = new WebDAVBackupService(database, secureStore, settingsService)
  await webdavBackupService.syncAutoBackupSettings()

  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  updateService.on('state-change', (state) => {
    mainWindow?.webContents.send('updates:state', state)
  })

  registerServerIpc({
    database,
    serversService
  })
  registerSessionIpc(sessionsService)
  registerCommandHistoryIpc(database)
  registerCustomCommandIpc(database)
  registerSftpBookmarkIpc(database)
  registerSystemIpc({
    appInfo,
    credentialStorageAvailable: () => Promise.resolve(true),
    database,
    getMainWindow: () => mainWindow,
    logFileService,
    settingsService,
    sessionsService,
    themeRegistry,
    translate,
    updateService,
    webdavBackupService
  })

  syncApplicationMenu({
    appName: APP_NAME,
    getMainWindow: () => mainWindow,
    isDevelopment: is.dev,
    platform: process.platform,
    translate,
    updateService
  })

  mainWindow = createWindow(settingsService.getSettings(), themeRegistry)
  setupAppFocusAndActivityListeners(mainWindow)
  mainWindow.webContents.once('did-finish-load', () => {
    if (updateService.getState().autoCheckEnabled) {
      void updateService.check()
    }
  })

  nativeTheme.on('updated', () => {
    if (mainWindow) {
      syncWindowTheme(mainWindow, settingsService.getSettings(), themeRegistry)
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow(settingsService.getSettings(), themeRegistry)
    }
  })

  app.on('before-quit', () => {
    logger.info('Disposing application services')
    webdavBackupService.dispose()
    localTerminalManager.dispose()
    sessionManager.dispose()
    database.close()
  })
}
