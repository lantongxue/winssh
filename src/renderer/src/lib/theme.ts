import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import {
  getDefaultThemeId,
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
  root.dataset.theme = resolvedTheme.id
  root.dataset.themeAppearance = resolvedTheme.appearance
  root.dataset.themeSelection = selection
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
