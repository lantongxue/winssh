import { useQuery } from '@tanstack/react-query'
import { Command, PanelBottom, PanelLeft, Search } from 'lucide-react'
import type { WorkbenchDocument } from '@/lib/workbench'
import { getDocumentDescription, getDocumentFallbackTitle } from '@/lib/workbench'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'
import { ThemeToggle } from '@/components/theme-toggle'
import { Button } from '@/components/ui/button'

export function WorkbenchTitlebar({ activeDocument }: { activeDocument: WorkbenchDocument }) {
  const sessions = useSessionsStore((state) => state.tabs)
  const togglePanel = useWorkbenchStore((state) => state.togglePanel)
  const toggleSidebar = useWorkbenchStore((state) => state.toggleSidebar)
  const setCommandPaletteOpen = useWorkbenchStore((state) => state.setCommandPaletteOpen)
  const setQuickOpenOpen = useWorkbenchStore((state) => state.setQuickOpenOpen)

  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => window.winsshApi.servers.list()
  })

  const resolvedTitle =
    activeDocument.kind === 'session-editor'
      ? sessions.find((session) => session.sessionId === activeDocument.sessionId)?.serverName ??
        getDocumentFallbackTitle(activeDocument)
      : activeDocument.kind === 'server-editor' && activeDocument.serverId
        ? (serversQuery.data ?? []).find((server) => server.id === activeDocument.serverId)?.name ??
          getDocumentFallbackTitle(activeDocument)
        : getDocumentFallbackTitle(activeDocument)

  return (
    <header className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--workbench-border)] bg-[var(--workbench-titlebar)] px-2 text-xs">
      <div className="flex min-w-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 rounded-sm text-[var(--workbench-muted)] hover:bg-[var(--workbench-hover)] hover:text-foreground"
          onClick={toggleSidebar}
        >
          <PanelLeft className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="h-7 w-7 rounded-sm text-[var(--workbench-muted)] hover:bg-[var(--workbench-hover)] hover:text-foreground"
          onClick={togglePanel}
        >
          <PanelBottom className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 h-7 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 text-[var(--workbench-muted)] hover:bg-[var(--workbench-hover)] hover:text-foreground"
          onClick={() => setQuickOpenOpen(true)}
        >
          <Search className="size-3.5" />
          Quick Open
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 text-[var(--workbench-muted)] hover:bg-[var(--workbench-hover)] hover:text-foreground"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Command className="size-3.5" />
          Command Palette
        </Button>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <div className="hidden min-w-0 text-right md:block">
          <div className="truncate text-[11px] font-medium text-foreground">{resolvedTitle}</div>
          <div className="truncate text-[10px] text-[var(--workbench-muted)]">
            {getDocumentDescription(activeDocument)}
          </div>
        </div>
        <ThemeToggle />
      </div>
    </header>
  )
}
