import lightPlusTheme from '../../../themes/builtin/winssh-default-themes/themes/light-plus.json'
import darkPlusTheme from '../../../themes/builtin/winssh-default-themes/themes/dark-plus.json'

type ThemeDocument = {
  colors: Record<string, string>
}

export const SITE_THEME_STORAGE_KEY = 'winssh-official-theme'
export const SITE_THEME_SYSTEM = 'system'
export const SITE_LIGHT_THEME_ID = 'winssh.light-plus'
export const SITE_DARK_THEME_ID = 'winssh.dark-plus'

export type ThemeAppearance = 'light' | 'dark'
export type ResolvedThemeId = typeof SITE_LIGHT_THEME_ID | typeof SITE_DARK_THEME_ID
export type ThemeSelection =
  | typeof SITE_THEME_SYSTEM
  | typeof SITE_LIGHT_THEME_ID
  | typeof SITE_DARK_THEME_ID

export interface ResolvedTheme {
  appearance: ThemeAppearance
  resolvedThemeId: ResolvedThemeId
  selection: ThemeSelection
}

const themeDocuments: Record<ResolvedThemeId, ThemeDocument> = {
  [SITE_LIGHT_THEME_ID]: lightPlusTheme as ThemeDocument,
  [SITE_DARK_THEME_ID]: darkPlusTheme as ThemeDocument
}

const themeColorKeys = Array.from(
  new Set([
    ...Object.keys((lightPlusTheme as ThemeDocument).colors),
    ...Object.keys((darkPlusTheme as ThemeDocument).colors)
  ])
)

function isValidThemeSelection(value: string | null): value is ThemeSelection {
  return (
    value === SITE_THEME_SYSTEM || value === SITE_LIGHT_THEME_ID || value === SITE_DARK_THEME_ID
  )
}

export function resolveSystemThemeAppearance(): ThemeAppearance {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveInitialThemeSelection(): ThemeSelection {
  if (typeof window === 'undefined') {
    return SITE_THEME_SYSTEM
  }
  const persisted = window.localStorage.getItem(SITE_THEME_STORAGE_KEY)
  return isValidThemeSelection(persisted) ? persisted : SITE_THEME_SYSTEM
}

export function persistThemeSelection(selection: ThemeSelection) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SITE_THEME_STORAGE_KEY, selection)
}

export function resolveTheme(
  selection: ThemeSelection,
  systemAppearance: ThemeAppearance = resolveSystemThemeAppearance()
): ResolvedTheme {
  const resolvedThemeId: ResolvedThemeId =
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

export function applyTheme(
  root: HTMLElement,
  selection: ThemeSelection,
  systemAppearance: ThemeAppearance = resolveSystemThemeAppearance()
): ResolvedTheme {
  const resolved = resolveTheme(selection, systemAppearance)
  const doc = themeDocuments[resolved.resolvedThemeId]

  root.dataset.theme = resolved.resolvedThemeId
  root.dataset.themeAppearance = resolved.appearance
  root.dataset.themeSelection = selection
  root.classList.toggle('dark', resolved.appearance === 'dark')
  root.style.colorScheme = resolved.appearance

  for (const key of themeColorKeys) {
    const value = doc.colors[key]
    if (value === undefined) {
      root.style.removeProperty(`--${key}`)
    } else {
      root.style.setProperty(`--${key}`, value)
    }
  }
  return resolved
}

export function initializeTheme(root: HTMLElement) {
  return applyTheme(root, resolveInitialThemeSelection())
}
