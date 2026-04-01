import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getThemeSelectionLabel } from '@/lib/theme'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

export function WorkbenchStatusBar() {
  const { t } = useTranslation()
  const sessionCount = useSessionsStore((state) => state.tabs.length)
  const activeActivityId = useWorkbenchStore((state) => state.activeActivityId)
  const activePanelId = useWorkbenchStore((state) => state.activePanelId)
  const panelOpen = useWorkbenchStore((state) => state.panelOpen)
  const sidebarOpen = useWorkbenchStore((state) => state.sidebarOpen)

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.winsshApi.settings.get()
  })
  const themesQuery = useQuery({
    queryKey: ['themes'],
    queryFn: () => window.winsshApi.themes.list()
  })
  const themeLabel = getThemeSelectionLabel(
    settingsQuery.data?.theme ?? 'system',
    themesQuery.data ?? [],
    t('common.theme.system')
  )

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between bg-[var(--workbench-statusbar)] px-3 text-[11px] text-[var(--workbench-statusbar-foreground)]">
      <div className="flex min-w-0 items-center gap-3 truncate">
        <span className="font-semibold">{t('common.appName')}</span>
        <span>{t(`workbench.activity.${activeActivityId}.title`)}</span>
        <span>{t('workbench.statusBar.sessions', { count: sessionCount })}</span>
        {panelOpen ? <span>{t(`workbench.panel.labels.${activePanelId}`)}</span> : null}
      </div>

      <div className="hidden items-center gap-3 md:flex">
        <span>{t(sidebarOpen ? 'workbench.statusBar.sidebarOn' : 'workbench.statusBar.sidebarOff')}</span>
        <span>{t(panelOpen ? 'workbench.statusBar.panelOn' : 'workbench.statusBar.panelOff')}</span>
        <span>{t('workbench.statusBar.theme', { value: themeLabel })}</span>
        <span>{t('common.shortcuts.toggleSidebar')}</span>
        <span>{t('common.shortcuts.togglePanel')}</span>
        <span>{t('common.shortcuts.quickOpen')}</span>
      </div>
    </footer>
  )
}
