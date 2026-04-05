import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  applySiteTheme,
  persistSiteThemeSelection,
  resolveInitialSiteThemeSelection,
  resolveSiteTheme,
  resolveSystemThemeAppearance,
  type SiteResolvedTheme,
  type SiteThemeAppearance,
  type SiteThemeSelection
} from '@/lib/theme'

interface SiteThemeContextValue extends SiteResolvedTheme {
  setSelection: (selection: SiteThemeSelection) => void
}

const SiteThemeContext = createContext<SiteThemeContextValue | null>(null)

export function SiteThemeProvider({
  children,
  initialSelection
}: {
  children: React.ReactNode
  initialSelection?: SiteThemeSelection
}) {
  const [selection, setSelection] = useState<SiteThemeSelection>(
    () => initialSelection ?? resolveInitialSiteThemeSelection()
  )
  const [systemAppearance, setSystemAppearance] = useState<SiteThemeAppearance>(
    () => resolveSystemThemeAppearance()
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      setSystemAppearance(mediaQuery.matches ? 'dark' : 'light')
    }

    handleChange()
    mediaQuery.addEventListener?.('change', handleChange)

    return () => {
      mediaQuery.removeEventListener?.('change', handleChange)
    }
  }, [])

  const resolvedTheme = useMemo(
    () => resolveSiteTheme(selection, systemAppearance),
    [selection, systemAppearance]
  )

  useEffect(() => {
    applySiteTheme(document.documentElement, selection, systemAppearance)
    persistSiteThemeSelection(selection)
  }, [selection, systemAppearance])

  const value = useMemo(
    () => ({
      ...resolvedTheme,
      setSelection
    }),
    [resolvedTheme]
  )

  return <SiteThemeContext.Provider value={value}>{children}</SiteThemeContext.Provider>
}

export function useSiteTheme() {
  const context = useContext(SiteThemeContext)

  if (!context) {
    throw new Error('useSiteTheme must be used inside SiteThemeProvider')
  }

  return context
}
