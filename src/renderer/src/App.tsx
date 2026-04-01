import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ThemeDefinition } from '@shared/themes'
import type { ThemeMode } from '@shared/types'
import { Toaster } from 'sonner'
import { WorkbenchShell } from '@/components/workbench/workbench-shell'
import { usePrefersDark } from '@/hooks/use-prefers-dark'
import { useSessionEvents } from '@/hooks/use-session-events'
import i18n from '@/i18n'
import { resolveAppLanguage } from '@/i18n/format'
import { applyThemeToRoot } from '@/lib/theme'

function applyTheme(theme: ThemeMode, themes: ThemeDefinition[], prefersDark: boolean) {
  applyThemeToRoot(document.documentElement, theme, themes, prefersDark)
}

export default function App() {
  useSessionEvents()
  const prefersDark = usePrefersDark()
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
    if (!settingsQuery.data?.theme || !themesQuery.data) {
      return
    }

    applyTheme(settingsQuery.data.theme, themesQuery.data, prefersDark)
  }, [prefersDark, settingsQuery.data?.theme, themesQuery.data])

  useEffect(() => {
    if (!settingsQuery.data) {
      return
    }

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
  }, [settingsQuery.data])

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
