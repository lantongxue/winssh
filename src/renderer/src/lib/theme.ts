import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import {
  getDefaultThemeId,
  isHighContrastTheme,
  SYSTEM_THEME_ID,
  THEME_COLOR_KEYS,
  type ThemeAppearance,
  type ThemeDefinition
} from '@shared/themes'
import type { AppSettings, ThemeMode } from '@shared/types'

export interface ResolvedThemeState {
  selection: ThemeMode
  theme: ThemeDefinition
}

const GENERIC_FONT_FAMILIES = new Set([
  'cursive',
  'emoji',
  'fangsong',
  'fantasy',
  'math',
  'monospace',
  'sans-serif',
  'serif',
  'system-ui',
  'ui-monospace',
  'ui-rounded',
  'ui-sans-serif',
  'ui-serif'
])

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim()

  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

function formatTerminalFontFamilyToken(value: string) {
  const normalizedValue = stripWrappingQuotes(value)

  if (!normalizedValue) {
    return null
  }

  if (GENERIC_FONT_FAMILIES.has(normalizedValue.toLowerCase())) {
    return normalizedValue.toLowerCase()
  }

  if (/^[A-Za-z0-9_-]+$/.test(normalizedValue)) {
    return normalizedValue
  }

  return `"${normalizedValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

export function formatTerminalFontFamily(fontFamily: string) {
  const resolvedFamilies = fontFamily
    .split(',')
    .map((token) => formatTerminalFontFamilyToken(token))
    .filter((token): token is string => Boolean(token))

  if (resolvedFamilies.length === 0) {
    return 'monospace'
  }

  if (
    !resolvedFamilies.some((token) =>
      GENERIC_FONT_FAMILIES.has(stripWrappingQuotes(token).toLowerCase())
    )
  ) {
    resolvedFamilies.push('monospace')
  }

  return [...new Set(resolvedFamilies)].join(', ')
}

function getThemeById(themes: ThemeDefinition[], themeId: string) {
  return themes.find((theme) => theme.id === themeId) ?? null
}

function getFallbackTheme(themes: ThemeDefinition[], appearance: ThemeAppearance) {
  return (
    getThemeById(themes, getDefaultThemeId(appearance)) ??
    getThemeById(themes, getDefaultThemeId('light')) ??
    themes[0] ??
    null
  )
}

export function resolveThemeDefinition(
  selection: ThemeMode,
  themes: ThemeDefinition[],
  prefersDark: boolean
): ThemeDefinition | null {
  const appearance = prefersDark ? 'dark' : 'light'
  const themeId = selection === SYSTEM_THEME_ID ? getDefaultThemeId(appearance) : selection

  return getThemeById(themes, themeId) ?? getFallbackTheme(themes, appearance)
}

export function applyThemeToRoot(
  root: HTMLElement,
  selection: ThemeMode,
  themes: ThemeDefinition[],
  prefersDark: boolean
) {
  const resolvedTheme = resolveThemeDefinition(selection, themes, prefersDark)

  if (!resolvedTheme) {
    return null
  }

  root.classList.toggle('dark', resolvedTheme.appearance === 'dark')
  root.classList.toggle('theme-liquid-glass', resolvedTheme.pluginId === 'winssh.liquid-glass-themes')
  root.classList.toggle('theme-high-contrast', isHighContrastTheme(resolvedTheme))
  root.dataset.theme = resolvedTheme.id
  root.dataset.themeAppearance = resolvedTheme.appearance
  root.dataset.themePlugin = resolvedTheme.pluginId
  root.dataset.themeSelection = selection
  root.dataset.themeUi = resolvedTheme.uiTheme
  root.style.colorScheme = resolvedTheme.appearance

  for (const key of THEME_COLOR_KEYS) {
    root.style.setProperty(`--${key}`, resolvedTheme.colors[key])
  }

  return resolvedTheme
}

export function getThemeSelectionLabel(selection: ThemeMode, themes: ThemeDefinition[], systemLabel: string) {
  if (selection === SYSTEM_THEME_ID) {
    return systemLabel
  }

  return getThemeById(themes, selection)?.label ?? selection
}

function shouldUseThemeTerminalDefaults(settings: AppSettings, theme: ThemeDefinition) {
  return (
    Boolean(theme.terminalDefaults) &&
    settings.terminalFontFamily === DEFAULT_APP_SETTINGS.terminalFontFamily &&
    settings.terminalFontSize === DEFAULT_APP_SETTINGS.terminalFontSize
  )
}

export function resolveTerminalAppearance(settings: AppSettings, theme: ThemeDefinition) {
  const useThemeDefaults = shouldUseThemeTerminalDefaults(settings, theme)

  return {
    fontFamily: useThemeDefaults
      ? theme.terminalDefaults?.fontFamily ?? settings.terminalFontFamily
      : settings.terminalFontFamily,
    fontSize: useThemeDefaults
      ? theme.terminalDefaults?.fontSize ?? settings.terminalFontSize
      : settings.terminalFontSize,
    lineHeight: useThemeDefaults ? theme.terminalDefaults?.lineHeight ?? 1.2 : 1.2,
    theme: theme.terminal
  }
}
