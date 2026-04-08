import type { BrowserWindowConstructorOptions } from 'electron'
import type { AppSettings } from '@shared/types'

export function getWindowChromeOptions(
  settings: Pick<AppSettings, 'windowTitleBarStyle'>,
  platform: NodeJS.Platform
): Partial<BrowserWindowConstructorOptions> {
  if (settings.windowTitleBarStyle !== 'custom') {
    return {
      titleBarStyle: 'default'
    }
  }

  if (platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset'
    }
  }

  if (platform === 'win32') {
    return {
      titleBarStyle: 'hidden',
      titleBarOverlay: true
    }
  }

  return {
    titleBarStyle: 'hidden'
  }
}
