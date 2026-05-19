import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'

export const LANGUAGE_STORAGE_KEY = 'winssh-official-language'

export type LanguageCode = 'zh-CN' | 'en-US'

const SUPPORTED: LanguageCode[] = ['zh-CN', 'en-US']

function detectSystemLanguage(): LanguageCode {
  if (typeof navigator === 'undefined') return 'en-US'
  const lang = navigator.language.toLowerCase()
  if (lang.startsWith('zh')) return 'zh-CN'
  return 'en-US'
}

function resolveInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en-US'
  const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
  if (stored && SUPPORTED.includes(stored as LanguageCode)) {
    return stored as LanguageCode
  }
  return detectSystemLanguage()
}

interface LanguageContextValue {
  language: LanguageCode
  setLanguage: (next: LanguageCode) => void
  supported: readonly LanguageCode[]
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => resolveInitialLanguage())

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((next: LanguageCode) => {
    setLanguageState(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
    }
  }, [])

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, supported: SUPPORTED }),
    [language, setLanguage]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return ctx
}
