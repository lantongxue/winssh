export const SITE_LOCALES = ['en-US', 'zh-CN'] as const
export const SITE_LOCALE_STORAGE_KEY = 'winssh.web.locale'

export type SiteLocale = (typeof SITE_LOCALES)[number]

export function normalizeLocale(input?: string | null): SiteLocale {
  if (!input) {
    return 'en-US'
  }

  return input.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function resolveInitialLocale(): SiteLocale {
  if (typeof window === 'undefined') {
    return 'en-US'
  }

  const persisted = window.localStorage.getItem(SITE_LOCALE_STORAGE_KEY)

  if (persisted) {
    return normalizeLocale(persisted)
  }

  return normalizeLocale(window.navigator.language)
}

export function persistLocale(locale: SiteLocale) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(SITE_LOCALE_STORAGE_KEY, locale)
}
