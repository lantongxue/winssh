import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ThemeDefinition } from '@shared/themes'
import type { ThemeMode } from '@shared/types'
import { Toaster } from 'sonner'
import { WorkbenchShell } from '@/components/workbench/workbench-shell'
import { useSessionEvents } from '@/hooks/use-session-events'
import i18n from '@/i18n'
import { resolveAppLanguage } from '@/i18n/format'
import { applyThemeToRoot } from '@/lib/theme'

function applyTheme(theme: ThemeMode, themes: ThemeDefinition[]) {
  applyThemeToRoot(
    document.documentElement,
    theme,
    themes,
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

export default function App() {
  useSessionEvents()
  const [bootstrappedLanguage, setBootstrappedLanguage] = useState<string | null>(null)

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.winsshApi.settings.get()
  })
  const themesQuery = useQuery({
    queryKey: ['themes'],
    queryFn: () => window.winsshApi.themes.list()
  })
  const resolvedLanguage = settingsQuery.data
    ? resolveAppLanguage(settingsQuery.data.language)
    : null

  useEffect(() => {
    if (!settingsQuery.data || !themesQuery.data) {
      return
    }

    applyTheme(settingsQuery.data.theme, themesQuery.data)

    let cancelled = false
    const nextLanguage = resolveAppLanguage(settingsQuery.data.language)

    void i18n.changeLanguage(nextLanguage).then(() => {
      if (!cancelled) {
        setBootstrappedLanguage(nextLanguage)
      }
    })

    return () => {
      cancelled = true
    }
  }, [settingsQuery.data, themesQuery.data])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (settingsQuery.data?.theme === 'system' && themesQuery.data) {
        applyTheme('system', themesQuery.data)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [settingsQuery.data?.theme, themesQuery.data])

  if (!settingsQuery.data || !themesQuery.data || resolvedLanguage !== bootstrappedLanguage) {
    return <div className="h-full bg-[var(--workbench-bg)]" />
  }

  return (
    <>
      <WorkbenchShell />
      <Toaster
        position="bottom-right"
        offset={16}
        mobileOffset={12}
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: 'winssh-toast',
            content: 'winssh-toast__content',
            title: 'winssh-toast__title',
            description: 'winssh-toast__description',
            icon: 'winssh-toast__icon',
            closeButton: 'winssh-toast__close',
            actionButton: 'winssh-toast__action',
            cancelButton: 'winssh-toast__cancel',
            default: 'winssh-toast--default',
            info: 'winssh-toast--info',
            success: 'winssh-toast--success',
            warning: 'winssh-toast--warning',
            error: 'winssh-toast--error',
            loading: 'winssh-toast--loading'
          }
        }}
      />
    </>
  )
}
