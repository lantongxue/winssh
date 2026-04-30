import type { AppSettings } from '@shared/types'
import { SettingsApplicationService } from './settings-application-service'

function createSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  const settings: AppSettings = {
    autoUpdateCheckEnabled: true,
    copyOnSelect: true,
    cursorBlink: true,
    cursorStyle: 'block',
    editorFontId: null,
    experimentalTerminalWebgl: false,
    language: 'en-US',
    logFilePath: '/tmp/winssh.log',
    localTerminalShell: 'zsh',
    uiFontId: 'inter',
    terminalFontId: 'cascadia-mono',
    terminalFontSize: 14,
    theme: 'system',
    webdavBackupEnabled: false,
    webdavBackupIntervalMinutes: 60,
    webdavBackupPath: '/winssh-backup/',
    webdavUrl: null,
    webdavUsername: null,
    windowTitleBarStyle: 'custom'
  }

  return {
    ...settings,
    ...overrides
  }
}

describe('SettingsApplicationService', () => {
  it('normalizes settings for reads', () => {
    const database = {
      getSettings: vi.fn(() => createSettings({ localTerminalShell: 'bash' }))
    } as unknown as ConstructorParameters<typeof SettingsApplicationService>[0]
    const themeRegistry = {
      normalizeSettings: vi.fn((settings: AppSettings) => ({
        ...settings,
        theme: 'system'
      }))
    } as unknown as ConstructorParameters<typeof SettingsApplicationService>[1]
    const updateService = {
      setAutoCheckEnabled: vi.fn()
    } as unknown as ConstructorParameters<typeof SettingsApplicationService>[2]
    const normalizeSettingsForPlatform = vi.fn(
      (settings: AppSettings): AppSettings => ({
        ...settings,
        localTerminalShell: 'zsh'
      })
    )
    const syncMainWindowTheme = vi.fn()

    const service = new SettingsApplicationService(
      database,
      themeRegistry,
      updateService,
      normalizeSettingsForPlatform,
      syncMainWindowTheme
    )

    const settings = service.getSettings()

    expect(normalizeSettingsForPlatform).toHaveBeenCalled()
    expect(settings.localTerminalShell).toBe('zsh')
  })

  it('updates settings and synchronizes dependent services', () => {
    const nextSettings = createSettings({ autoUpdateCheckEnabled: false, theme: 'system' })
    const database = {
      updateSettings: vi.fn(() => nextSettings)
    } as unknown as ConstructorParameters<typeof SettingsApplicationService>[0]
    const themeRegistry = {
      isValidSelection: vi.fn(() => true),
      normalizeSettings: vi.fn((settings: AppSettings) => settings)
    } as unknown as ConstructorParameters<typeof SettingsApplicationService>[1]
    const updateService = {
      setAutoCheckEnabled: vi.fn()
    } as unknown as ConstructorParameters<typeof SettingsApplicationService>[2]
    const normalizeSettingsForPlatform = vi.fn((settings: AppSettings): AppSettings => settings)
    const syncMainWindowTheme = vi.fn()

    const service = new SettingsApplicationService(
      database,
      themeRegistry,
      updateService,
      normalizeSettingsForPlatform,
      syncMainWindowTheme
    )

    const result = service.updateSettings(nextSettings)

    expect(database.updateSettings).toHaveBeenCalledWith(nextSettings)
    expect(updateService.setAutoCheckEnabled).toHaveBeenCalledWith(false)
    expect(syncMainWindowTheme).toHaveBeenCalledWith(nextSettings)
    expect(result).toEqual(nextSettings)
  })
})
