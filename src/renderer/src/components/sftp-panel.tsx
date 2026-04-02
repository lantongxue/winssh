import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { File, Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getParentRemotePath } from '@shared/sftp'
import type { RemoteEntry } from '@shared/types'
import { formatFileSize } from '@/i18n/format'
import { actionIcons } from '@/lib/action-icons'
import type { SessionTab } from '@/store/sessions-store'
import { cn } from '@/lib/utils'
import { useSessionsStore } from '@/store/sessions-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

interface SftpPanelProps {
  session: SessionTab | null
  className?: string
}

export function SftpPanel({ session, className }: SftpPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const setCurrentPath = useSessionsStore((state) => state.setCurrentPath)
  const [selectedEntryPaths, setSelectedEntryPaths] = useState<string[]>([])
  const [selectionAnchorPath, setSelectionAnchorPath] = useState<string | null>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameTarget, setRenameTarget] = useState<RemoteEntry | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const RefreshIcon = actionIcons.refresh
  const UploadIcon = actionIcons.upload
  const NewFolderIcon = actionIcons.newFolder
  const DownloadIcon = actionIcons.download
  const RenameIcon = actionIcons.rename
  const DeleteIcon = actionIcons.delete
  const CancelIcon = actionIcons.cancel
  const CreateIcon = actionIcons.newFolder
  const SaveIcon = actionIcons.save
  const CopyIcon = actionIcons.clone

  const listingQuery = useQuery({
    queryKey: ['sftp', session?.sessionId, session?.currentPath],
    queryFn: () => window.winsshApi.sftp.list(session!.sessionId, session!.currentPath),
    enabled: Boolean(session && session.status === 'ready')
  })

  useEffect(() => {
    if (session && listingQuery.data?.path && listingQuery.data.path !== session.currentPath) {
      setCurrentPath(session.sessionId, listingQuery.data.path)
    }
  }, [listingQuery.data?.path, session, setCurrentPath])

  useEffect(() => {
    if (!listingQuery.data?.entries) {
      return
    }

    const availablePaths = new Set(listingQuery.data.entries.map((entry) => entry.path))

    setSelectedEntryPaths((current) => current.filter((path) => availablePaths.has(path)))
    setSelectionAnchorPath((current) => (current && availablePaths.has(current) ? current : null))
  }, [listingQuery.data?.entries])

  const segments = useMemo(() => {
    const currentPath = listingQuery.data?.path ?? session?.currentPath ?? '/'
    if (currentPath === '/') {
      return ['/']
    }

    const parts = currentPath.split('/').filter(Boolean)
    return ['/', ...parts]
  }, [listingQuery.data?.path, session?.currentPath])

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20">
        <div className="max-w-xs text-center">
          <div className="mb-2 text-base font-medium">
            {t('workbench.sftp.empty.noSessionTitle')}
          </div>
          <div className="text-sm text-muted-foreground">
            {t('workbench.sftp.empty.noSessionDescription')}
          </div>
        </div>
      </div>
    )
  }

  if (session.status !== 'ready') {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20">
        <div className="max-w-xs text-center">
          <div className="mb-2 text-base font-medium">
            {t('workbench.sftp.empty.noSessionTitle')}
          </div>
          <div className="text-sm text-muted-foreground">
            {t('workbench.sftp.empty.noSessionDescription')}
          </div>
        </div>
      </div>
    )
  }

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['sftp', session.sessionId] })
  }

  const currentPath = listingQuery.data?.path ?? session.currentPath
  const entries = listingQuery.data?.entries ?? []
  const selectedEntrySet = useMemo(() => new Set(selectedEntryPaths), [selectedEntryPaths])
  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedEntrySet.has(entry.path)),
    [entries, selectedEntrySet]
  )

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path)
      toast.success(t('workbench.sftp.toasts.pathCopied'))
    } catch {
      toast.error(t('workbench.sftp.toasts.pathCopyFailed'))
    }
  }

  const openDirectory = (path: string) => {
    setCurrentPath(session.sessionId, path)
  }

  const clearSelection = () => {
    setSelectedEntryPaths([])
    setSelectionAnchorPath(null)
  }

  const selectSingleEntry = (path: string) => {
    setSelectedEntryPaths([path])
    setSelectionAnchorPath(path)
  }

  const toggleEntrySelection = (path: string) => {
    setSelectedEntryPaths((current) => {
      if (current.includes(path)) {
        return current.filter((currentPath) => currentPath !== path)
      }

      return [...current, path]
    })
    setSelectionAnchorPath(path)
  }

  const selectEntryRange = (path: string) => {
    const anchorPath = selectionAnchorPath ?? selectedEntryPaths.at(-1) ?? path
    const anchorIndex = entries.findIndex((entry) => entry.path === anchorPath)
    const targetIndex = entries.findIndex((entry) => entry.path === path)

    if (anchorIndex === -1 || targetIndex === -1) {
      selectSingleEntry(path)
      return
    }

    const [start, end] =
      anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]

    setSelectedEntryPaths(entries.slice(start, end + 1).map((entry) => entry.path))
    setSelectionAnchorPath(anchorPath)
  }

  const handleEntrySelection = (
    entryPath: string,
    options: {
      additive: boolean
      range: boolean
    }
  ) => {
    if (options.range) {
      selectEntryRange(entryPath)
      return
    }

    if (options.additive) {
      toggleEntrySelection(entryPath)
      return
    }

    selectSingleEntry(entryPath)
  }

  const resolveContextMenuTargets = (entry: RemoteEntry) => {
    if (selectedEntrySet.has(entry.path) && selectedEntries.length > 0) {
      return selectedEntries
    }

    return [entry]
  }

  const copyEntryPaths = async (entriesToCopy: RemoteEntry[]) => {
    await copyPath(entriesToCopy.map((entry) => entry.path).join('\n'))
  }

  const removeEntries = async (entriesToRemove: RemoteEntry[]) => {
    for (const entry of entriesToRemove) {
      await window.winsshApi.sftp.remove(session.sessionId, entry.path)
    }

    clearSelection()
    await refresh()
  }

  const getEntryMeta = (entry: RemoteEntry) => {
    const permissionText = entry.permissions
      ? `${entry.permissions.octal} / ${entry.permissions.symbolic}`
      : t('common.labels.none')

    if (entry.kind === 'directory') {
      return `${permissionText} · ${t('workbench.sftp.kinds.directory')}`
    }

    if (entry.kind === 'symlink') {
      return `${permissionText} · ${t('workbench.sftp.kinds.symlink')}`
    }

    return `${permissionText} · ${formatFileSize(Math.max(entry.size, 0))}`
  }

  return (
    <>
      <div className={cn('flex h-full flex-col bg-background', className)}>
        <div className="border-b px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t('workbench.sftp.explorer')}</div>
              <div className="truncate text-xs text-muted-foreground">{session.serverName}</div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon-sm"
                title={t('common.actions.refresh')}
                onClick={() => void refresh()}
              >
                <RefreshIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                title={t('common.actions.upload')}
                onClick={() =>
                  void window.winsshApi.sftp
                    .uploadFiles(session.sessionId, currentPath)
                    .then(refresh)
                }
              >
                <UploadIcon className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                title={t('common.actions.newFolder')}
                onClick={() => setNewFolderOpen(true)}
              >
                <NewFolderIcon className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mt-3 rounded-md border bg-muted/20 p-2.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                  {t('workbench.sftp.labels.currentPath')}
                </div>
                <div className="mt-1 break-all font-mono text-[11px] leading-4 text-foreground">
                  {currentPath}
                </div>
              </div>
              <Button
                variant="outline"
                size="icon-xs"
                title={t('workbench.sftp.actions.copyPath')}
                onClick={() => void copyPath(currentPath)}
              >
                <CopyIcon className="size-3.5" />
              </Button>
            </div>
          </div>

          <ScrollArea className="mt-3 w-full">
            <div className="flex w-max items-center gap-1 pr-3">
              {segments.map((segment, index) => {
                const target = index === 0 ? '/' : `/${segments.slice(1, index + 1).join('/')}`
                const active = target === currentPath

                return (
                  <Button
                    key={`${segment}-${index}`}
                    type="button"
                    variant={active ? 'secondary' : 'ghost'}
                    size="xs"
                    className="max-w-36 justify-start"
                    onClick={() => setCurrentPath(session.sessionId, target)}
                  >
                    <span className="truncate">
                      {segment === '/' ? t('common.labels.root') : segment}
                    </span>
                  </Button>
                )
              })}
            </div>
          </ScrollArea>

          <Button
            variant="ghost"
            size="sm"
            className="mt-2 justify-start px-2"
            onClick={() => {
              clearSelection()
              setCurrentPath(session.sessionId, getParentRemotePath(currentPath))
            }}
          >
            <Folder className="size-4" />
            {t('workbench.sftp.actions.backToParent')}
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div
            className="divide-y"
            onClick={(event) => event.target === event.currentTarget && clearSelection()}
          >
            {listingQuery.isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-9 rounded-md" />
                <Skeleton className="h-9 rounded-md" />
                <Skeleton className="h-9 rounded-md" />
              </div>
            ) : null}

            {entries.map((entry) => {
              const contextMenuTargets = resolveContextMenuTargets(entry)
              const isSelected = selectedEntrySet.has(entry.path)
              const hasSingleContextTarget = contextMenuTargets.length === 1
              const singleContextTarget = hasSingleContextTarget ? contextMenuTargets[0] : null

              return (
                <ContextMenu key={entry.path}>
                  <ContextMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-start gap-3 border-l-2 px-3 py-2 text-left transition-colors',
                        isSelected
                          ? 'border-l-[var(--workbench-active)] bg-[var(--workbench-hover)] text-foreground'
                          : 'border-l-transparent hover:border-l-[var(--workbench-border)] hover:bg-[var(--workbench-hover)] hover:text-foreground'
                      )}
                      onClick={(event) =>
                        handleEntrySelection(entry.path, {
                          additive: event.metaKey || event.ctrlKey,
                          range: event.shiftKey
                        })
                      }
                      onContextMenu={() => {
                        if (!selectedEntrySet.has(entry.path)) {
                          selectSingleEntry(entry.path)
                        }
                      }}
                      onDoubleClick={(event) => {
                        handleEntrySelection(entry.path, {
                          additive: event.metaKey || event.ctrlKey,
                          range: event.shiftKey
                        })
                        if (entry.kind === 'directory') {
                          openDirectory(entry.path)
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === ' ') {
                          event.preventDefault()
                          handleEntrySelection(entry.path, {
                            additive: event.metaKey || event.ctrlKey,
                            range: event.shiftKey
                          })
                          return
                        }

                        if (event.key === 'Escape') {
                          event.preventDefault()
                          clearSelection()
                          return
                        }

                        if (event.key === 'Enter' && entry.kind === 'directory') {
                          event.preventDefault()
                          selectSingleEntry(entry.path)
                          openDirectory(entry.path)
                        }
                      }}
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm transition-colors',
                          isSelected
                            ? 'bg-[var(--workbench-hover)] text-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {entry.kind === 'directory' ? (
                          <Folder className="size-3.5" />
                        ) : (
                          <File className="size-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] leading-5 font-medium text-foreground">
                          {entry.name}
                        </div>
                        <div className="truncate font-mono text-[11px] leading-4 text-muted-foreground">
                          {getEntryMeta(entry)}
                        </div>
                      </div>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {singleContextTarget?.kind === 'directory' ? (
                      <ContextMenuItem onClick={() => openDirectory(singleContextTarget.path)}>
                        <Folder className="size-4" />
                        {t('workbench.sftp.actions.openDirectory')}
                      </ContextMenuItem>
                    ) : null}

                    {singleContextTarget && singleContextTarget.kind !== 'directory' ? (
                      <ContextMenuItem
                        onClick={() =>
                          void window.winsshApi.sftp.downloadFile(
                            session.sessionId,
                            singleContextTarget.path
                          )
                        }
                      >
                        <DownloadIcon className="size-4" />
                        {t('common.actions.download')}
                      </ContextMenuItem>
                    ) : null}

                    <ContextMenuItem onClick={() => void copyEntryPaths(contextMenuTargets)}>
                      <CopyIcon className="size-4" />
                      {t('workbench.sftp.actions.copyPath')}
                    </ContextMenuItem>

                    {hasSingleContextTarget ? <ContextMenuSeparator /> : null}

                    {singleContextTarget ? (
                      <ContextMenuItem
                        onClick={() => {
                          setRenameTarget(singleContextTarget)
                          setRenameValue(singleContextTarget.name)
                        }}
                      >
                        <RenameIcon className="size-4" />
                        {t('common.actions.rename')}
                      </ContextMenuItem>
                    ) : null}

                    <ContextMenuItem
                      variant="destructive"
                      onClick={() => void removeEntries(contextMenuTargets)}
                    >
                      <DeleteIcon className="size-4" />
                      {t('common.actions.delete')}
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )
            })}

            {!listingQuery.isLoading && entries.length === 0 ? (
              <div className="m-3 rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                {t('workbench.sftp.empty.directory')}
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('workbench.sftp.dialogs.createFolder')}</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder={t('workbench.sftp.placeholders.directoryName')}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>
              <CancelIcon className="size-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={async () => {
                await window.winsshApi.sftp.mkdir(session.sessionId, currentPath, newFolderName)
                setNewFolderName('')
                setNewFolderOpen(false)
                await refresh()
              }}
            >
              <CreateIcon className="size-4" />
              {t('common.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('workbench.sftp.dialogs.rename')}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            placeholder={t('workbench.sftp.placeholders.rename')}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              <CancelIcon className="size-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={async () => {
                if (!renameTarget) {
                  return
                }

                await window.winsshApi.sftp.rename(
                  session.sessionId,
                  renameTarget.path,
                  renameValue
                )
                setRenameTarget(null)
                await refresh()
              }}
            >
              <SaveIcon className="size-4" />
              {t('common.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
