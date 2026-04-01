import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { WorkbenchShell } from '@/components/workbench/workbench-shell'
import { useSessionEvents } from '@/hooks/use-session-events'
import i18n from '@/i18n'
import { resolveAppLanguage } from '@/i18n/format'

function applyTheme(theme: 'system' | 'light' | 'dark') {
  const root = document.documentElement
  const resolvedTheme =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme

  root.classList.toggle('dark', resolvedTheme === 'dark')
}

export default function App() {
  useSessionEvents()
  const [bootstrapped, setBootstrapped] = useState(false)

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.winsshApi.settings.get()
  })

  useEffect(() => {
    if (!settingsQuery.data) {
      setBootstrapped(false)
      return
    }

    applyTheme(settingsQuery.data.theme)

    let cancelled = false

    void i18n.changeLanguage(resolveAppLanguage(settingsQuery.data.language)).then(() => {
      if (!cancelled) {
        setBootstrapped(true)
      }
    })

    return () => {
      cancelled = true
    }
  }, [settingsQuery.data])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (settingsQuery.data?.theme === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [settingsQuery.data?.theme])

  if (!settingsQuery.data || !bootstrapped) {
    return <div className="h-full bg-[var(--workbench-bg)]" />
  }

  return (
    <>
      <WorkbenchShell />
      <Toaster richColors position="top-right" />
    </>
  )
}
