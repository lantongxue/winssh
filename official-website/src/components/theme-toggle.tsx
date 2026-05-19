import { useEffect, useState } from 'react'
import {
  applyTheme,
  persistThemeSelection,
  resolveInitialThemeSelection,
  resolveSystemThemeAppearance,
  SITE_DARK_THEME_ID,
  SITE_LIGHT_THEME_ID,
  SITE_THEME_SYSTEM,
  type ThemeSelection
} from '@/lib/theme'
import { useLanguage } from '@/lib/language'
import { SITE_COPY } from '@/content/site'

export function ThemeToggle() {
  const { language } = useLanguage()
  const copy = SITE_COPY[language]
  const [selection, setSelection] = useState<ThemeSelection>(() => resolveInitialThemeSelection())

  useEffect(() => {
    applyTheme(document.documentElement, selection)
    persistThemeSelection(selection)
  }, [selection])

  useEffect(() => {
    if (selection !== SITE_THEME_SYSTEM) return
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      applyTheme(document.documentElement, SITE_THEME_SYSTEM, resolveSystemThemeAppearance())
    }
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [selection])

  const items: { id: ThemeSelection; label: string }[] = [
    { id: SITE_LIGHT_THEME_ID, label: copy.theme.light },
    { id: SITE_DARK_THEME_ID, label: copy.theme.dark },
    { id: SITE_THEME_SYSTEM, label: copy.theme.system }
  ]

  return (
    <div className="vsc-toggle-group" role="radiogroup" aria-label={copy.titlebar.themeLabel}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="radio"
          aria-checked={selection === item.id}
          className={selection === item.id ? 'is-active' : ''}
          onClick={() => setSelection(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
