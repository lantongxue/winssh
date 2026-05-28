import type { AppSettings } from './types'
import { SYSTEM_THEME_ID } from './themes'
import {
  DEFAULT_EDITOR_FONT_ID,
  DEFAULT_TERMINAL_FONT_ID,
  DEFAULT_UI_FONT_ID
} from './integrated-fonts'

export const APP_ID = 'com.winssh.app'
export const APP_NAME = 'WinSSH'
export const SECURE_STORE_SERVICE = 'winssh.credentials'

export const COMMAND_HISTORY_CAP = 5000
export const COMMAND_HISTORY_LOCAL_SCOPE = 'default'

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
  logFilePath: null,
  theme: SYSTEM_THEME_ID,
  terminalFontSize: 14,
  uiFontId: DEFAULT_UI_FONT_ID,
  terminalFontId: DEFAULT_TERMINAL_FONT_ID,
  editorFontId: DEFAULT_EDITOR_FONT_ID,
  autoUpdateCheckEnabled: true,
  experimentalTerminalWebgl: false,
  cursorStyle: 'block',
  cursorBlink: true,
  copyOnSelect: true,
  localTerminalShell: 'zsh',
  windowTitleBarStyle: 'native',
  webdavBackupEnabled: false,
  webdavUrl: null,
  webdavUsername: null,
  webdavBackupIntervalMinutes: 60,
  webdavBackupPath: '/winssh-backup/',
  resourceMonitorIntervalMs: 2000,
  sftpUploadConcurrency: 3,
  sftpDownloadConcurrency: 3,
  commandHistoryEnabled: true,
  awayReminderEnabled: true,
  awayReminderTimeoutMs: 30000
}
