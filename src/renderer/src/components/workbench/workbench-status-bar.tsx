import { useQuery } from '@tanstack/react-query'
import { getWorkbenchActivity } from '@/lib/workbench'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

export function WorkbenchStatusBar() {
  const sessionCount = useSessionsStore((state) => state.tabs.length)
  const activeActivityId = useWorkbenchStore((state) => state.activeActivityId)
  const activePanelId = useWorkbenchStore((state) => state.activePanelId)
  const panelOpen = useWorkbenchStore((state) => state.panelOpen)
  const sidebarOpen = useWorkbenchStore((state) => state.sidebarOpen)

  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.winsshApi.settings.get()
  })

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between bg-[var(--workbench-statusbar)] px-3 text-[11px] text-[var(--workbench-statusbar-foreground)]">
      <div className="flex min-w-0 items-center gap-3 truncate">
        <span className="font-semibold">WinSSH</span>
        <span>{getWorkbenchActivity(activeActivityId).title}</span>
        <span>{sessionCount} sessions</span>
        {panelOpen ? <span>{activePanelId}</span> : null}
      </div>

      <div className="hidden items-center gap-3 md:flex">
        <span>{sidebarOpen ? 'sidebar on' : 'sidebar off'}</span>
        <span>{panelOpen ? 'panel on' : 'panel off'}</span>
        <span>theme {settingsQuery.data?.theme ?? 'system'}</span>
        <span>Ctrl/Cmd+B</span>
        <span>Ctrl/Cmd+J</span>
        <span>Ctrl/Cmd+P</span>
      </div>
    </footer>
  )
}
