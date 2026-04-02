import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { actionIcons } from '@/lib/action-icons'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { WorkbenchDocument, WorkbenchDocumentId } from '@/lib/workbench'
import { cn } from '@/lib/utils'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

function getBaseDocumentTitle(
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

function getDocumentTitle(
  document: WorkbenchDocument,
  sessionNameMap: Map<string, string>,
  serverNameMap: Map<string, string>,
  documentTitleOverrides: Partial<Record<WorkbenchDocumentId, string>>,
  t: ReturnType<typeof useTranslation>['t']
) {
  return (
    documentTitleOverrides[document.id] ??
    getBaseDocumentTitle(document, sessionNameMap, serverNameMap, t)
  )
}

export function WorkbenchEditorTabs() {
  const { t } = useTranslation()
  const { connectServer, disconnectSession } = useWorkbenchContext()
  const activeDocumentId = useWorkbenchStore((state) => state.activeDocumentId)
  const documentTitleOverrides = useWorkbenchStore((state) => state.documentTitleOverrides)
  const moveDocument = useWorkbenchStore((state) => state.moveDocument)
  const openDocuments = useWorkbenchStore((state) => state.openDocuments)
  const closeDocument = useWorkbenchStore((state) => state.closeDocument)
  const clearDocumentTitleOverride = useWorkbenchStore((state) => state.clearDocumentTitleOverride)
  const setActiveDocument = useWorkbenchStore((state) => state.setActiveDocument)
  const setDocumentTitleOverride = useWorkbenchStore((state) => state.setDocumentTitleOverride)
  const sessions = useSessionsStore((state) => state.tabs)
  const [draggedDocumentId, setDraggedDocumentId] = useState<WorkbenchDocumentId | null>(null)
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null)
  const [renameTargetDocumentId, setRenameTargetDocumentId] = useState<WorkbenchDocumentId | null>(
    null
  )
  const [renameValue, setRenameValue] = useState('')
  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => window.winsshApi.servers.list()
  })
  const CancelIcon = actionIcons.cancel
  const CloneIcon = actionIcons.clone
  const CloseIcon = actionIcons.close
  const RenameIcon = actionIcons.rename
  const closeLabel = t('common.actions.close')

  const sessionNameMap = useMemo(
    () => new Map(sessions.map((session) => [session.sessionId, session.serverName])),
    [sessions]
  )
  const serverNameMap = useMemo(
    () => new Map((serversQuery.data ?? []).map((server) => [server.id, server.name])),
    [serversQuery.data]
  )
  const renameTargetDocument = useMemo(
    () => openDocuments.find((document) => document.id === renameTargetDocumentId) ?? null,
    [openDocuments, renameTargetDocumentId]
  )

  const getTitle = (document: WorkbenchDocument) =>
    getDocumentTitle(document, sessionNameMap, serverNameMap, documentTitleOverrides, t)

  const getBaseTitle = (document: WorkbenchDocument) =>
    getBaseDocumentTitle(document, sessionNameMap, serverNameMap, t)

  const resetDragState = () => {
    setDraggedDocumentId(null)
    setDropIndicatorIndex(null)
  }

  const closeRenameDialog = () => {
    setRenameTargetDocumentId(null)
    setRenameValue('')
  }

  const handleCloseDocument = async (document: WorkbenchDocument) => {
    if (document.kind === 'session-editor') {
      await disconnectSession(document.sessionId)
      return
    }

    closeDocument(document.id)
  }

  const handleCloneSession = async (sessionId: string) => {
    const session = sessions.find((tab) => tab.sessionId === sessionId)
    if (!session) {
      return
    }

    const server =
      (serversQuery.data ?? []).find((item) => item.id === session.serverId) ??
      (await window.winsshApi.servers.list()).find((item) => item.id === session.serverId)

    if (!server) {
      toast.error(t('workbench.toasts.serverConfigMissing'))
      return
    }

    await connectServer(server)
  }

  const openRenameDialog = (document: WorkbenchDocument) => {
    setRenameTargetDocumentId(document.id)
    setRenameValue(getTitle(document))
  }

  const handleRenameSubmit = () => {
    if (!renameTargetDocument) {
      return
    }

    const nextTitle = renameValue.trim()
    if (!nextTitle) {
      return
    }

    const defaultTitle = getBaseTitle(renameTargetDocument)
    if (nextTitle === defaultTitle) {
      clearDocumentTitleOverride(renameTargetDocument.id)
    } else {
      setDocumentTitleOverride(renameTargetDocument.id, nextTitle)
    }

    closeRenameDialog()
  }

  return (
    <>
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
            const title = getTitle(document)
            const tabButton = (
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
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label={closeLabel}
                      className={cn(
                        'ml-auto flex size-4 shrink-0 items-center justify-center rounded-sm text-[var(--workbench-muted)] transition-colors hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10',
                        !active && 'opacity-0 group-hover:opacity-100'
                      )}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        void handleCloseDocument(document)
                      }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter' && event.key !== ' ') {
                          return
                        }

                        event.preventDefault()
                        event.stopPropagation()
                        void handleCloseDocument(document)
                      }}
                    >
                      <CloseIcon className="size-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{closeLabel}</TooltipContent>
                </Tooltip>
              </button>
            )

            return (
              <div key={document.id} className="relative flex shrink-0">
                {dropIndicatorIndex === index ? (
                  <span className="absolute inset-y-1 left-0 z-10 w-px rounded-full bg-[var(--workbench-active)]" />
                ) : null}
                {document.kind === 'session-editor' ? (
                  <ContextMenu>
                    <ContextMenuTrigger asChild>{tabButton}</ContextMenuTrigger>
                    <ContextMenuContent>
                      <ContextMenuItem onClick={() => void handleCloneSession(document.sessionId)}>
                        <CloneIcon className="size-4" />
                        {t('workbench.editorTabs.actions.cloneSession')}
                      </ContextMenuItem>
                      <ContextMenuItem onClick={() => openRenameDialog(document)}>
                        <RenameIcon className="size-4" />
                        {t('workbench.editorTabs.actions.renameTab')}
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        variant="destructive"
                        onClick={() => void handleCloseDocument(document)}
                      >
                        <CloseIcon className="size-4" />
                        {t('workbench.editorTabs.actions.closeTab')}
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ) : (
                  tabButton
                )}
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

      <Dialog
        open={renameTargetDocument !== null}
        onOpenChange={(open) => !open && closeRenameDialog()}
      >
        <DialogContent
          className="max-w-md rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl"
          showCloseButton={false}
        >
          <DialogHeader className="border-b border-[var(--workbench-border)] px-4 py-4">
            <DialogTitle>{t('workbench.editorTabs.dialogs.renameSession.title')}</DialogTitle>
            <DialogDescription>
              {renameTargetDocument
                ? t('workbench.editorTabs.dialogs.renameSession.description', {
                    name: getBaseTitle(renameTargetDocument)
                  })
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="px-4 py-4">
            <Input
              autoFocus
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  handleRenameSubmit()
                }
              }}
              placeholder={t('workbench.editorTabs.dialogs.renameSession.placeholder')}
            />
          </div>
          <DialogFooter className="border-t border-[var(--workbench-border)] px-4 py-3">
            <Button variant="ghost" onClick={closeRenameDialog}>
              <CancelIcon className="size-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button disabled={!renameValue.trim()} onClick={handleRenameSubmit}>
              <RenameIcon className="size-4" />
              {t('common.actions.rename')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
