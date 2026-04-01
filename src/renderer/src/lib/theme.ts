import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import type { AppSettings, ThemeMode } from '@shared/types'

export type ResolvedThemeMode = 'light' | 'dark' | 'pixel'

const defaultTerminalTheme = {
  background: '#09090b',
  foreground: '#e4e4e7',
  cursor: '#38bdf8',
  selectionBackground: 'rgba(14, 165, 233, 0.24)',
  black: '#09090b',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#f4f4f5',
  brightBlack: '#71717a',
  brightRed: '#fb7185',
  brightGreen: '#86efac',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa'
} as const

const pixelTerminalTheme = {
  background: '#050b07',
  foreground: '#9ff6a8',
  cursor: '#7dff9b',
  selectionBackground: 'rgba(125,255,155,0.22)',
  black: '#050b07',
  red: '#ff7a6b',
  green: '#7dff9b',
  yellow: '#d8ff72',
  blue: '#69b7ff',
  magenta: '#e38bff',
  cyan: '#63ffd5',
  white: '#d8ffe1',
  brightBlack: '#4e6954',
  brightRed: '#ff9d91',
  brightGreen: '#a8ffb9',
  brightYellow: '#e7ff9b',
  brightBlue: '#8acaff',
  brightMagenta: '#efb0ff',
  brightCyan: '#8dffe5',
  brightWhite: '#f2fff4'
} as const

const pixelTerminalDefaults = {
  fontFamily: 'Lucida Console, Cascadia Mono, Consolas, monospace',
  fontSize: 13,
  lineHeight: 1.08
} as const

export function resolveThemeMode(theme: ThemeMode, prefersDark: boolean): ResolvedThemeMode {
  if (theme === 'system') {
    return prefersDark ? 'dark' : 'light'
  }

  return theme
}

export function applyThemeToRoot(root: HTMLElement, theme: ThemeMode, prefersDark: boolean) {
  const resolvedTheme = resolveThemeMode(theme, prefersDark)
  root.classList.toggle('dark', resolvedTheme !== 'light')
  root.dataset.theme = resolvedTheme
  return resolvedTheme
}

export function getThemeLabelKey(theme: ThemeMode) {
  return `common.theme.${theme}` as const
}

function shouldUsePixelTerminalDefaults(settings: AppSettings) {
  return (
    settings.theme === 'pixel' &&
    settings.terminalFontFamily === DEFAULT_APP_SETTINGS.terminalFontFamily &&
    settings.terminalFontSize === DEFAULT_APP_SETTINGS.terminalFontSize
  )
}

export function resolveTerminalAppearance(settings: AppSettings) {
  const usePixelDefaults = shouldUsePixelTerminalDefaults(settings)

  return {
    fontFamily: usePixelDefaults ? pixelTerminalDefaults.fontFamily : settings.terminalFontFamily,
    fontSize: usePixelDefaults ? pixelTerminalDefaults.fontSize : settings.terminalFontSize,
    lineHeight: usePixelDefaults ? pixelTerminalDefaults.lineHeight : 1.2,
    theme: settings.theme === 'pixel' ? pixelTerminalTheme : defaultTerminalTheme
  }
}
