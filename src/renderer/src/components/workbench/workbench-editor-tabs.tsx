import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import type { WorkbenchDocument } from '@/lib/workbench'
import { getDocumentFallbackTitle } from '@/lib/workbench'
import { cn } from '@/lib/utils'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

function getDocumentTitle(
  document: WorkbenchDocument,
  sessionNameMap: Map<string, string>,
  serverNameMap: Map<string, string>
) {
  if (document.kind === 'session-editor') {
    return sessionNameMap.get(document.sessionId) ?? getDocumentFallbackTitle(document)
  }

  if (document.kind === 'server-editor' && document.serverId) {
    return serverNameMap.get(document.serverId) ?? getDocumentFallbackTitle(document)
  }

  return getDocumentFallbackTitle(document)
}

export function WorkbenchEditorTabs() {
  const { disconnectSession } = useWorkbenchContext()
  const activeDocumentId = useWorkbenchStore((state) => state.activeDocumentId)
  const openDocuments = useWorkbenchStore((state) => state.openDocuments)
  const closeDocument = useWorkbenchStore((state) => state.closeDocument)
  const setActiveDocument = useWorkbenchStore((state) => state.setActiveDocument)
  const sessions = useSessionsStore((state) => state.tabs)
  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => window.winsshApi.servers.list()
  })

  const sessionNameMap = new Map(sessions.map((session) => [session.sessionId, session.serverName]))
  const serverNameMap = new Map((serversQuery.data ?? []).map((server) => [server.id, server.name]))

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-[var(--workbench-border)] bg-[var(--workbench-tabs)]">
      <div className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        {openDocuments.map((document) => {
          const active = document.id === activeDocumentId
          const title = getDocumentTitle(document, sessionNameMap, serverNameMap)
          const closable = document.kind !== 'explorer-home'

          return (
            <button
              key={document.id}
              type="button"
              className={cn(
                'group relative flex h-full min-w-[150px] max-w-[260px] shrink-0 items-center gap-2 border-r border-[var(--workbench-border)] px-3 text-xs transition-colors',
                active
                  ? 'bg-[var(--workbench-editor)] text-foreground shadow-[inset_0_1px_0_0_var(--workbench-active)]'
                  : 'bg-[var(--workbench-tabs)] text-[var(--workbench-muted)] hover:bg-[var(--workbench-hover)] hover:text-foreground'
              )}
              onClick={() => setActiveDocument(document.id)}
            >
              <span className="truncate">{title}</span>
              {closable ? (
                <span
                  role="button"
                  tabIndex={0}
                  className={cn(
                    'ml-auto flex size-4 shrink-0 items-center justify-center rounded-sm text-[var(--workbench-muted)] transition-colors hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10',
                    !active && 'opacity-0 group-hover:opacity-100'
                  )}
                  onClick={async (event) => {
                    event.preventDefault()
                    event.stopPropagation()

                    if (document.kind === 'session-editor') {
                      await disconnectSession(document.sessionId)
                      return
                    }

                    closeDocument(document.id)
                  }}
                  onKeyDown={async (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') {
                      return
                    }

                    event.preventDefault()
                    event.stopPropagation()

                    if (document.kind === 'session-editor') {
                      await disconnectSession(document.sessionId)
                      return
                    }

                    closeDocument(document.id)
                  }}
                >
                  <X className="size-3" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
