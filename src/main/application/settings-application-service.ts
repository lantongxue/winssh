import type { AppSettings } from '@shared/types'
import type { DatabaseService } from '../database'
import { createLogger, createOperationContext } from '../observability'
import type { ThemeRegistry } from '../theme-registry'
import type { UpdateService } from '../update-service'

export class SettingsApplicationService {
  private readonly logger = createLogger('main')

  constructor(
    private readonly database: DatabaseService,
    private readonly themeRegistry: ThemeRegistry,
    private readonly updateService: UpdateService,
    private readonly normalizeSettingsForPlatform: (settings: AppSettings) => AppSettings,
    private readonly syncApplicationShell: (
      settings: Pick<AppSettings, 'language' | 'theme' | 'windowTitleBarStyle'>
    ) => void
  ) {}

  getSettings() {
    return this.themeRegistry.normalizeSettings(
      this.normalizeSettingsForPlatform(this.database.getSettings())
    )
  }

  updateSettings(nextSettings: AppSettings) {
    const context = createOperationContext('main', 'settings', 'update')
    this.logger.info('Updating settings', { context })
    if (!this.themeRegistry.isValidSelection(nextSettings.theme)) {
      throw new Error(`unknown theme "${nextSettings.theme}"`)
    }

    const normalizedSettings = this.themeRegistry.normalizeSettings(
      this.database.updateSettings(this.normalizeSettingsForPlatform(nextSettings))
    )

    this.updateService.setAutoCheckEnabled(normalizedSettings.autoUpdateCheckEnabled)
    this.syncApplicationShell(normalizedSettings)

    return normalizedSettings
  }
}
