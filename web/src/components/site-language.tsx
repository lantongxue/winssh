import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { SITE_COPY, type SiteCopy } from '@/content/site'
import { persistLocale, resolveInitialLocale, type SiteLocale } from '@/lib/language'

interface SiteLanguageContextValue {
  copy: SiteCopy
  locale: SiteLocale
  setLocale: (locale: SiteLocale) => void
}

const SiteLanguageContext = createContext<SiteLanguageContextValue | null>(null)

export function SiteLanguageProvider({
  children,
  initialLocale
}: {
  children: React.ReactNode
  initialLocale?: SiteLocale
}) {
  const [locale, setLocale] = useState<SiteLocale>(() => initialLocale ?? resolveInitialLocale())

  useEffect(() => {
    document.documentElement.lang = locale
    persistLocale(locale)
  }, [locale])

  const value = useMemo(
    () => ({
      copy: SITE_COPY[locale],
      locale,
      setLocale
    }),
    [locale]
  )

  return <SiteLanguageContext.Provider value={value}>{children}</SiteLanguageContext.Provider>
}

export function useSiteLanguage() {
  const context = useContext(SiteLanguageContext)

  if (!context) {
    throw new Error('useSiteLanguage must be used inside SiteLanguageProvider')
  }

  return context
}
