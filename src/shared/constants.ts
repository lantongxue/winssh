import type { AppSettings } from './types'
import { SYSTEM_THEME_ID } from './themes'

export const APP_ID = 'com.winssh.app'
export const APP_NAME = 'WinSSH'
export const SECURE_STORE_SERVICE = 'winssh.credentials'

export const COLOR_PRESETS = [
  'slate',
  'stone',
  'red',
  'orange',
  'amber',
  'yellow',
  'lime',
  'green',
  'emerald',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'violet',
  'pink',
  'rose'
] as const

export const DEFAULT_APP_SETTINGS: AppSettings = {
  language: 'system',
  theme: SYSTEM_THEME_ID,
  terminalFontSize: 14,
  terminalFontFamily: 'JetBrains Mono, Consolas, monospace',
  autoUpdateCheckEnabled: true,
  experimentalTerminalWebgl: false,
  cursorStyle: 'block',
  cursorBlink: true,
  copyOnSelect: true,
  localTerminalShell: 'zsh',
  windowTitleBarStyle: 'native'
}
