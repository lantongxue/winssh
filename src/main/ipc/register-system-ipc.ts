import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { app, dialog, ipcMain, type BrowserWindow, type OpenDialogOptions } from 'electron'
import type { AppLogEvent } from '@shared/observability'
import { isServerIconMimeType } from '@shared/server-brands'
import { getDefaultThemeId, SYSTEM_THEME_ID, type ThemeAppearance } from '@shared/themes'
import type { AppInfo, AppSettings } from '@shared/types'
import { settingsSchema } from '@shared/validation'
import type { SettingsApplicationService } from '../application/settings-application-service'
import type { DatabaseService } from '../database'
import type { MainTranslator } from '../localization'
import type { LogFileService } from '../log-file-service'
import { createLogger } from '../observability'
import { ThemeRegistry, ThemeRegistryError } from '../theme-registry'
import type { UpdateService } from '../update-service'
import type { WebDAVBackupService } from '../webdav-backup-service'

function parseInput<T>(parser: { parse: (value: unknown) => T }, value: unknown): T {
  return parser.parse(value)
}

function getServerIconMimeType(filePath: string) {
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

export function registerSystemIpc(options: {
  appInfo: AppInfo
  credentialStorageAvailable: () => Promise<boolean>
  database: DatabaseService
  getMainWindow: () => BrowserWindow | null
  logFileService: LogFileService
  settingsService: SettingsApplicationService
  themeRegistry: ThemeRegistry
  translate: MainTranslator
  updateService: UpdateService
  webdavBackupService: WebDAVBackupService
}) {
  const logger = createLogger('main')
  const {
    appInfo,
    credentialStorageAvailable,
    database,
    getMainWindow,
    logFileService,
    settingsService,
    themeRegistry,
    translate,
    updateService,
    webdavBackupService
  } = options

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

  logger.info('Registering system IPC handlers', {
    data: { scope: 'system' }
  })

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
    const window = getMainWindow()
    const result = window
      ? await dialog.showOpenDialog(window, options)
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
  ipcMain.handle('settings:get', () => settingsService.getSettings())
  ipcMain.handle(
    'settings:update',
    async (_event, input: Partial<AppSettings> & { webdavPassword?: string | null }) => {
      const { webdavPassword, ...settingsInput } = input
      const merged = parseInput(settingsSchema, {
        ...settingsService.getSettings(),
        ...settingsInput
      })

      if (webdavPassword !== undefined) {
        await webdavBackupService.updatePassword(webdavPassword ?? null)
      }

      const result = settingsService.updateSettings(merged)
      await webdavBackupService.syncAutoBackupSettings()
      return result
    }
  )
  ipcMain.handle('logs:getState', () => ({
    logFilePath: settingsService.getSettings().logFilePath ?? logFileService.getLogFilePath()
  }))
  ipcMain.handle('logs:list', () => logFileService.readEntries())
  ipcMain.handle('logs:clear', () => logFileService.clear())
  ipcMain.handle('logs:updatePath', async (_event, logFilePath: string) => {
    const result = settingsService.updateSettings({
      ...settingsService.getSettings(),
      logFilePath
    })

    await logFileService.setLogFilePath(result.logFilePath ?? logFileService.getLogFilePath())

    return {
      logFilePath: logFileService.getLogFilePath()
    }
  })
  ipcMain.handle('logs:write', async (_event, event: AppLogEvent) => {
    await logFileService.writeFromRenderer(event)
  })
  ipcMain.handle('updates:getState', () => updateService.getState())
  ipcMain.handle('updates:check', () => updateService.check())
  ipcMain.handle('updates:download', () => updateService.download())
  ipcMain.handle('updates:quitAndInstall', () => {
    updateService.quitAndInstall()
  })
  ipcMain.handle('backup:list', () => webdavBackupService.list())
  ipcMain.handle('system:getAppInfo', () => appInfo)
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
    const window = getMainWindow()
    const result = window
      ? await dialog.showOpenDialog(window, options)
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
    const window = getMainWindow()
    const result = window
      ? await dialog.showOpenDialog(window, options)
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

    return {
      data: new Uint8Array(await readFile(filePath)),
      mimeType
    }
  })
  ipcMain.handle('system:getKnownHosts', () => database.listKnownHosts())
  ipcMain.handle('system:removeKnownHost', (_event, host: string, port: number) => {
    database.deleteKnownHost(host, port)
  })
  ipcMain.handle('system:getCapabilities', async () => ({
    credentialStorage: await credentialStorageAvailable()
  }))
  ipcMain.handle('system:relaunch', () => {
    app.relaunch()
    app.exit(0)
  })
  ipcMain.handle('system:window:minimize', () => {
    getMainWindow()?.minimize()
  })
  ipcMain.handle('system:window:toggleMaximize', () => {
    const window = getMainWindow()
    if (!window) {
      return
    }

    if (window.isMaximized()) {
      window.unmaximize()
      return
    }

    window.maximize()
  })
  ipcMain.handle('system:window:close', () => {
    getMainWindow()?.close()
  })
  ipcMain.handle('system:window:isMaximized', () => getMainWindow()?.isMaximized() ?? false)

  ipcMain.handle('backup:getState', () => webdavBackupService.getState())
  ipcMain.handle('backup:backupNow', () => webdavBackupService.backupNow())
  ipcMain.handle('backup:delete', (_event, fileName: string) =>
    webdavBackupService.delete(fileName)
  )
  ipcMain.handle('backup:restore', (_event, fileName?: string) =>
    webdavBackupService.restore(fileName)
  )
  ipcMain.handle('backup:testConnection', () => webdavBackupService.testConnection())
}
