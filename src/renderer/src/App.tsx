import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { WorkbenchShell } from '@/components/workbench/workbench-shell'
import { useSessionEvents } from '@/hooks/use-session-events'

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

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.winsshApi.settings.get(),
    initialData: DEFAULT_APP_SETTINGS
  })

  useEffect(() => {
    applyTheme(settingsQuery.data.theme)
  }, [settingsQuery.data.theme])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (settingsQuery.data.theme === 'system') {
        applyTheme('system')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [settingsQuery.data.theme])

  return (
    <>
      <WorkbenchShell />
      <Toaster richColors position="top-right" />
    </>
  )
}
