import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { actionIcons } from '@/lib/action-icons'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import type { WorkbenchDocument, WorkbenchDocumentId } from '@/lib/workbench'
import { cn } from '@/lib/utils'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

function getDocumentTitle(
  document: WorkbenchDocument,
  sessionNameMap: Map<string, string>,
  serverNameMap: Map<string, string>,
  t: ReturnType<typeof useTranslation>['t']
) {
  if (document.kind === 'session-editor') {
    return sessionNameMap.get(document.sessionId) ?? t('workbench.documents.terminal')
  }

  if (document.kind === 'server-editor') {
    if (!document.serverId) {
      return t('workbench.documents.serverEditor.newConnection')
    }

    return serverNameMap.get(document.serverId) ?? t('common.actions.edit')
  }

  if (document.kind === 'settings-editor') {
    return t('workbench.documents.settings')
  }

  return t('workbench.documents.terminalWelcome')
}

export function WorkbenchEditorTabs() {
  const { t } = useTranslation()
  const { disconnectSession } = useWorkbenchContext()
  const activeDocumentId = useWorkbenchStore((state) => state.activeDocumentId)
  const moveDocument = useWorkbenchStore((state) => state.moveDocument)
  const openDocuments = useWorkbenchStore((state) => state.openDocuments)
  const closeDocument = useWorkbenchStore((state) => state.closeDocument)
  const setActiveDocument = useWorkbenchStore((state) => state.setActiveDocument)
  const sessions = useSessionsStore((state) => state.tabs)
  const [draggedDocumentId, setDraggedDocumentId] = useState<WorkbenchDocumentId | null>(null)
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null)
  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => window.winsshApi.servers.list()
  })
  const CloseIcon = actionIcons.close

  const sessionNameMap = useMemo(
    () => new Map(sessions.map((session) => [session.sessionId, session.serverName])),
    [sessions]
  )
  const serverNameMap = useMemo(
    () => new Map((serversQuery.data ?? []).map((server) => [server.id, server.name])),
    [serversQuery.data]
  )

  const resetDragState = () => {
    setDraggedDocumentId(null)
    setDropIndicatorIndex(null)
  }

  return (
    <div
      className="flex h-9 shrink-0 items-stretch border-b border-[var(--workbench-border)] bg-[var(--workbench-tabs)]"
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDropIndicatorIndex(null)
        }
      }}
    >
      <div className="flex min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
        {openDocuments.map((document, index) => {
          const active = document.id === activeDocumentId
          const title = getDocumentTitle(document, sessionNameMap, serverNameMap, t)

          return (
            <div key={document.id} className="relative flex shrink-0">
              {dropIndicatorIndex === index ? (
                <span className="absolute inset-y-1 left-0 z-10 w-px rounded-full bg-[var(--workbench-active)]" />
              ) : null}
              <button
                draggable
                type="button"
                className={cn(
                  'group relative flex h-full min-w-[150px] max-w-[260px] shrink-0 items-center gap-2 border-r border-[var(--workbench-border)] px-3 text-xs transition-colors',
                  active
                    ? 'bg-[var(--workbench-editor)] text-foreground shadow-[inset_0_1px_0_0_var(--workbench-active)]'
                    : 'bg-[var(--workbench-tabs)] text-[var(--workbench-muted)] hover:bg-[var(--workbench-hover)] hover:text-foreground'
                )}
                onClick={() => setActiveDocument(document.id)}
                onDragEnd={resetDragState}
                onDragOver={(event) => {
                  event.preventDefault()
                  const bounds = event.currentTarget.getBoundingClientRect()
                  const nextIndex =
                    event.clientX < bounds.left + bounds.width / 2 ? index : index + 1
                  setDropIndicatorIndex(nextIndex)
                }}
                onDragStart={(event) => {
                  setDraggedDocumentId(document.id)
                  setDropIndicatorIndex(index)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', document.id)
                }}
                onDrop={(event) => {
                  event.preventDefault()

                  if (!draggedDocumentId || dropIndicatorIndex === null) {
                    resetDragState()
                    return
                  }

                  moveDocument(draggedDocumentId, dropIndicatorIndex)
                  resetDragState()
                }}
              >
                <span className="truncate">{title}</span>
                <span
                  role="button"
                  tabIndex={0}
                  title={t('common.actions.close')}
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
                  <CloseIcon className="size-3" />
                </span>
              </button>
            </div>
          )
        })}
        {dropIndicatorIndex === openDocuments.length ? (
          <span className="relative flex shrink-0">
            <span className="absolute inset-y-1 left-0 w-px rounded-full bg-[var(--workbench-active)]" />
          </span>
        ) : null}
      </div>
    </div>
  )
}
