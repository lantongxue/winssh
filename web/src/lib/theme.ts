import lightPlusTheme from '../../../themes/builtin/winssh-default-themes/themes/light-plus.json'
import darkPlusTheme from '../../../themes/builtin/winssh-default-themes/themes/dark-plus.json'

type ThemeDocument = {
  colors: Record<string, string>
}

export const SITE_THEME_STORAGE_KEY = 'winssh-site-theme'
export const SITE_THEME_SYSTEM = 'system'
export const SITE_LIGHT_THEME_ID = 'winssh.light-plus'
export const SITE_DARK_THEME_ID = 'winssh.dark-plus'
export const SITE_THEME_PLUGIN_ID = 'winssh.default-themes'

export type SiteThemeAppearance = 'light' | 'dark'
export type SiteResolvedThemeId = typeof SITE_LIGHT_THEME_ID | typeof SITE_DARK_THEME_ID
export type SiteThemeSelection =
  | typeof SITE_THEME_SYSTEM
  | typeof SITE_LIGHT_THEME_ID
  | typeof SITE_DARK_THEME_ID

export interface SiteResolvedTheme {
  appearance: SiteThemeAppearance
  resolvedThemeId: SiteResolvedThemeId
  selection: SiteThemeSelection
}

const lightThemeDocument = lightPlusTheme as ThemeDocument
const darkThemeDocument = darkPlusTheme as ThemeDocument

const themeDocuments: Record<SiteResolvedThemeId, ThemeDocument> = {
  [SITE_LIGHT_THEME_ID]: lightThemeDocument,
  [SITE_DARK_THEME_ID]: darkThemeDocument
}

const themeColorKeys = Array.from(
  new Set([...Object.keys(lightThemeDocument.colors), ...Object.keys(darkThemeDocument.colors)])
)

function isValidSiteThemeSelection(value: string | null): value is SiteThemeSelection {
  return value === SITE_THEME_SYSTEM || value === SITE_LIGHT_THEME_ID || value === SITE_DARK_THEME_ID
}

export function resolveSystemThemeAppearance(): SiteThemeAppearance {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveInitialSiteThemeSelection(): SiteThemeSelection {
  if (typeof window === 'undefined') {
    return SITE_THEME_SYSTEM
  }

  const persistedSelection = window.localStorage.getItem(SITE_THEME_STORAGE_KEY)
  return isValidSiteThemeSelection(persistedSelection) ? persistedSelection : SITE_THEME_SYSTEM
}

export function persistSiteThemeSelection(selection: SiteThemeSelection) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(SITE_THEME_STORAGE_KEY, selection)
}

export function resolveSiteTheme(
  selection: SiteThemeSelection,
  systemAppearance: SiteThemeAppearance = resolveSystemThemeAppearance()
): SiteResolvedTheme {
  const resolvedThemeId =
    selection === SITE_LIGHT_THEME_ID
      ? SITE_LIGHT_THEME_ID
      : selection === SITE_DARK_THEME_ID
        ? SITE_DARK_THEME_ID
        : systemAppearance === 'dark'
          ? SITE_DARK_THEME_ID
          : SITE_LIGHT_THEME_ID

  return {
    appearance: resolvedThemeId === SITE_DARK_THEME_ID ? 'dark' : 'light',
    resolvedThemeId,
    selection
  }
}

export function applySiteTheme(
  root: HTMLElement,
  selection: SiteThemeSelection,
  systemAppearance: SiteThemeAppearance = resolveSystemThemeAppearance()
) {
  const resolvedTheme = resolveSiteTheme(selection, systemAppearance)
  const themeDocument = themeDocuments[resolvedTheme.resolvedThemeId]

  root.dataset.theme = resolvedTheme.resolvedThemeId
  root.dataset.themeAppearance = resolvedTheme.appearance
  root.dataset.themePlugin = SITE_THEME_PLUGIN_ID
  root.dataset.themeSelection = selection
  root.classList.toggle('dark', resolvedTheme.appearance === 'dark')
  root.style.colorScheme = resolvedTheme.appearance

  for (const key of themeColorKeys) {
    const value = themeDocument.colors[key]

    if (value === undefined) {
      root.style.removeProperty(`--${key}`)
      continue
    }

    root.style.setProperty(`--${key}`, value)
  }

  return resolvedTheme
}

export function initializeSiteTheme(root: HTMLElement) {
  const selection = resolveInitialSiteThemeSelection()
  return applySiteTheme(root, selection)
}
