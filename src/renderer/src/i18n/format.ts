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

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const

export function formatFileSize(value: number): string {
  const safeValue = Number.isFinite(value) && value > 0 ? value : 0

  if (safeValue === 0) {
    return '0 B'
  }

  let size = safeValue
  let unitIndex = 0

  while (size >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  if (unitIndex === 0) {
    return `${new Intl.NumberFormat(getResolvedLocale(), {
      maximumFractionDigits: 0
    }).format(size)} ${FILE_SIZE_UNITS[unitIndex]}`
  }

  return `${new Intl.NumberFormat(getResolvedLocale(), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(size)} ${FILE_SIZE_UNITS[unitIndex]}`
}
