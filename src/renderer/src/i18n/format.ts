import i18n from './index'

export function getSystemLanguage(languages = navigator.languages): 'zh-CN' | 'en-US' {
  return languages.some((language) => language.toLowerCase().startsWith('zh')) ? 'zh-CN' : 'en-US'
}

export function resolveAppLanguage(language: 'system' | 'zh-CN' | 'en-US'): 'zh-CN' | 'en-US' {
  return language === 'system' ? getSystemLanguage() : language
}

export function getResolvedLocale(): string {
  const language = i18n.resolvedLanguage ?? i18n.language
  if (language === 'zh-CN' || language === 'en-US') {
    return language
  }

  return getSystemLanguage()
}

export function formatDateTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(getResolvedLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...options
  }).format(new Date(value))
}

export function formatTime(
  value: Date | string | number,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(getResolvedLocale(), {
    timeStyle: 'medium',
    ...options
  }).format(new Date(value))
}
