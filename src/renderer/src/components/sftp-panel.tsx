import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { File, Folder, LoaderCircle, Undo2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getParentRemotePath } from '@shared/sftp'
import type { RemoteEntry } from '@shared/types'
import { sessionsClient } from '@/features/sessions/api/sessions-client'
import { sftpClient } from '@/features/sftp/api/sftp-client'
import { systemClient } from '@/features/system/api/system-client'
import { formatFileSize, getResolvedLocale } from '@/i18n/format'
import { actionIcons } from '@/lib/action-icons'
import { writeTerminalPathDragData } from '@/lib/terminal-path-dnd'
import type { SessionTab } from '@/store/sessions-store'
import { cn } from '@/lib/utils'
import { useSessionsStore } from '@/store/sessions-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SftpPanelProps {
  session: SessionTab | null
  className?: string
  onEditFile?: (remotePath: string) => void
}

type FileWithPath = File & {
  path?: string
}

function TooltipIconButton({
  children,
  label,
  ...props
}: React.ComponentProps<typeof Button> & {
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// 每个文件条目的固定高度（px-3 py-2 两行文字，约 56px）
const ENTRY_ITEM_HEIGHT = 56
// Typical directories scroll more smoothly without transform-based virtualization.
const VIRTUALIZED_ENTRY_THRESHOLD = 200
const REMOVE_EXIT_ANIMATION_MS = 180

function hasLocalFileTransfer(dataTransfer: DataTransfer | null | undefined) {
  return Array.from(dataTransfer?.types ?? []).includes('Files')
}

function resolveDroppedFilePath(file: File | null | undefined) {
  if (!file) {
    return null
  }

  const localPath =
    systemClient.getPathForFile(file) ?? (file as FileWithPath | null | undefined)?.path ?? null

  if (!localPath?.trim()) {
    return null
  }

  return localPath.trim()
}

function getDroppedLocalPaths(dataTransfer: DataTransfer | null | undefined) {
  const localPaths = new Set<string>()

  for (const item of Array.from(dataTransfer?.items ?? [])) {
    if (item.kind !== 'file' || typeof item.getAsFile !== 'function') {
      continue
    }

    const localPath = resolveDroppedFilePath(item.getAsFile())
    if (localPath) {
      localPaths.add(localPath)
    }
  }

  for (const file of Array.from(dataTransfer?.files ?? [])) {
    const localPath = resolveDroppedFilePath(file)
    if (localPath) {
      localPaths.add(localPath)
    }
  }

  return [...localPaths]
}

export function SftpPanel({ session, className, onEditFile }: SftpPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const setCurrentPath = useSessionsStore((state) => state.setCurrentPath)
  const setAuxView = useSessionsStore((state) => state.setAuxView)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const dragDepthRef = useRef(0)
  const mountedRef = useRef(true)
  const [selectedEntryPaths, setSelectedEntryPaths] = useState<string[]>([])
  const [selectionAnchorPath, setSelectionAnchorPath] = useState<string | null>(null)
  const [newFileOpen, setNewFileOpen] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [newFileTargetPath, setNewFileTargetPath] = useState<string | null>(null)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderTargetPath, setNewFolderTargetPath] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<RemoteEntry | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [pendingDeleteEntries, setPendingDeleteEntries] = useState<RemoteEntry[] | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [removingEntryPaths, setRemovingEntryPaths] = useState<string[]>([])
  const RefreshIcon = actionIcons.refresh
  const UploadIcon = actionIcons.upload
  const NewFileIcon = actionIcons.newFile
  const NewFolderIcon = actionIcons.newFolder
  const DownloadIcon = actionIcons.download
  const EditIcon = actionIcons.edit
  const RenameIcon = actionIcons.rename
  const DeleteIcon = actionIcons.delete
  const CancelIcon = actionIcons.cancel
  const CreateFileIcon = actionIcons.newFile
  const CreateFolderIcon = actionIcons.newFolder
  const SaveIcon = actionIcons.save
  const CopyIcon = actionIcons.clone
  const SendToTerminalIcon = actionIcons.openTerminal

  const listingQuery = useQuery({
    queryKey: ['sftp', session?.sessionId, session?.currentPath],
    queryFn: () => sftpClient.list(session!.sessionId, session!.currentPath),
    enabled: Boolean(session && session.status === 'ready')
  })
  const currentPath = listingQuery.data?.path ?? session?.currentPath ?? '/'
  const [pathInputValue, setPathInputValue] = useState(currentPath)

  useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (session && listingQuery.data?.path && listingQuery.data.path !== session.currentPath) {
      setCurrentPath(session.sessionId, listingQuery.data.path)
    }
  }, [listingQuery.data?.path, session, setCurrentPath])

  useEffect(() => {
    setPathInputValue(currentPath)
  }, [currentPath])

  useEffect(() => {
    if (!listingQuery.data?.entries) {
      return
    }

    const availablePaths = new Set(listingQuery.data.entries.map((entry) => entry.path))

    setSelectedEntryPaths((current) => current.filter((path) => availablePaths.has(path)))
    setSelectionAnchorPath((current) => (current && availablePaths.has(current) ? current : null))
  }, [listingQuery.data?.entries])

  const entries = listingQuery.data?.entries ?? []
  const selectedEntrySet = useMemo(() => new Set(selectedEntryPaths), [selectedEntryPaths])
  const removingEntrySet = useMemo(() => new Set(removingEntryPaths), [removingEntryPaths])
  const selectedEntries = useMemo(
    () => entries.filter((entry) => selectedEntrySet.has(entry.path)),
    [entries, selectedEntrySet]
  )
  const shouldVirtualizeEntries = entries.length >= VIRTUALIZED_ENTRY_THRESHOLD

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ENTRY_ITEM_HEIGHT,
    overscan: 10,
    enabled: shouldVirtualizeEntries,
    getItemKey: (index) => entries[index]?.path ?? index
  })
  const virtualItems = virtualizer.getVirtualItems()
  const shouldRenderStaticRows =
    !shouldVirtualizeEntries ||
    (entries.length > 0 &&
      virtualItems.length === 0 &&
      (scrollContainerRef.current?.clientHeight ?? 0) === 0)
  const totalVirtualListHeight = virtualizer.getTotalSize()

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

  const resetDragState = () => {
    dragDepthRef.current = 0
    setIsDragActive(false)
  }

  const runUpload = async (uploadAction: () => Promise<void>) => {
    try {
      await uploadAction()
      await refresh()
    } catch {
      toast.error(t('workbench.sftp.toasts.uploadFailed'))
    }
  }

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasLocalFileTransfer(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    dragDepthRef.current += 1
    setIsDragActive(true)
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasLocalFileTransfer(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'

    if (!isDragActive) {
      setIsDragActive(true)
    }
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasLocalFileTransfer(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)

    if (dragDepthRef.current === 0) {
      setIsDragActive(false)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasLocalFileTransfer(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    const localPaths = getDroppedLocalPaths(event.dataTransfer)
    resetDragState()

    if (localPaths.length === 0) {
      toast.error(t('workbench.sftp.toasts.uploadFailed'))
      return
    }

    void runUpload(() => sftpClient.uploadPaths(session.sessionId, currentPath, localPaths))
  }

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path)
      toast.success(t('workbench.sftp.toasts.pathCopied'))
    } catch {
      toast.error(t('workbench.sftp.toasts.pathCopyFailed'))
    }
  }

  const sendPathToTerminal = async (path: string) => {
    try {
      await sessionsClient.write(session.sessionId, path)
      toast.success(t('workbench.sftp.toasts.pathSentToTerminal'))
    } catch {
      toast.error(t('workbench.sftp.toasts.pathSendToTerminalFailed'))
    }
  }

  const openDirectory = (path: string) => {
    clearSelection()
    setCurrentPath(session.sessionId, path)
  }

  const jumpToPath = () => {
    const nextPath = pathInputValue.replace(/\r?\n/g, '').trim()

    if (!nextPath) {
      setPathInputValue(currentPath)
      return
    }

    openDirectory(nextPath)
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

  const openCreateFileDialog = (targetPath: string) => {
    setNewFileName('')
    setNewFileTargetPath(targetPath)
    setNewFileOpen(true)
  }

  const openCreateFolderDialog = (targetPath: string) => {
    setNewFolderName('')
    setNewFolderTargetPath(targetPath)
    setNewFolderOpen(true)
  }

  const openDeleteDialog = (entriesToRemove: RemoteEntry[]) => {
    const uniqueEntries = entriesToRemove.filter(
      (entry, index, current) => current.findIndex((item) => item.path === entry.path) === index
    )

    if (uniqueEntries.length === 0) {
      return
    }

    setPendingDeleteEntries(uniqueEntries)
  }

  const removeEntries = async (entriesToRemove: RemoteEntry[]) => {
    const targetPaths = [...new Set(entriesToRemove.map((entry) => entry.path))]
    if (targetPaths.length === 0) {
      return
    }

    setRemovingEntryPaths((current) => [...new Set([...current, ...targetPaths])])
    clearSelection()

    try {
      await new Promise((resolve) => window.setTimeout(resolve, REMOVE_EXIT_ANIMATION_MS))

      for (const targetPath of targetPaths) {
        await sftpClient.remove(session.sessionId, targetPath)
      }

      await refresh()
    } catch {
      if (mountedRef.current) {
        toast.error(t('workbench.sftp.toasts.deleteFailed'))
      }
    } finally {
      if (mountedRef.current) {
        setRemovingEntryPaths((current) =>
          current.filter((currentPath) => !targetPaths.includes(currentPath))
        )
      }
    }
  }

  const getEntryMeta = (entry: RemoteEntry) => {
    const permissionText = entry.permissions
      ? `${entry.permissions.octal} / ${entry.permissions.symbolic}`
      : t('common.labels.none')

    const modifiedText = entry.modifiedAt
      ? new Intl.DateTimeFormat(getResolvedLocale(), {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        }).format(new Date(entry.modifiedAt))
      : null
    const kindText =
      entry.kind === 'directory'
        ? t('workbench.sftp.kinds.directory')
        : entry.kind === 'symlink'
          ? t('workbench.sftp.kinds.symlink')
          : null

    const sizeText = entry.kind === 'file' ? formatFileSize(Math.max(entry.size, 0)) : null

    const parts = [permissionText]
    if (modifiedText) parts.push(modifiedText)
    if (kindText) parts.push(kindText)
    if (sizeText) parts.push(sizeText)

    return parts.join(' · ')
  }

  const renderEntryRow = (entry: RemoteEntry, wrapperStyle?: CSSProperties) => {
    const contextMenuTargets = resolveContextMenuTargets(entry)
    const isSelected = selectedEntrySet.has(entry.path)
    const isDirectory = entry.kind === 'directory'
    const isRemoving = removingEntrySet.has(entry.path)
    const hasSingleContextTarget = contextMenuTargets.length === 1
    const singleContextTarget = hasSingleContextTarget ? contextMenuTargets[0] : null
    const createTargetPath =
      singleContextTarget?.kind === 'directory' ? singleContextTarget.path : currentPath

    return (
      <div
        key={entry.path}
        style={
          wrapperStyle ?? {
            height: `${ENTRY_ITEM_HEIGHT}px`
          }
        }
      >
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              type="button"
              aria-busy={isRemoving || undefined}
              data-removing={isRemoving ? 'true' : 'false'}
              disabled={isRemoving}
              draggable={!isRemoving}
              className={cn(
                'flex h-full w-full items-start gap-3 border-b px-3 py-2 text-left transition-[opacity,transform,background-color,color] duration-200 ease-out',
                isSelected
                  ? 'bg-[var(--workbench-hover)] text-foreground'
                  : 'hover:bg-[var(--workbench-hover)] hover:text-foreground',
                isRemoving && 'translate-x-1 scale-[0.985] opacity-35'
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
                if (isDirectory) {
                  openDirectory(entry.path)
                  return
                }

                if (entry.kind === 'file') {
                  onEditFile?.(entry.path)
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
              onDragStart={(event) => {
                writeTerminalPathDragData(event.dataTransfer, entry.path)
              }}
            >
              <div
                className={cn(
                  'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm transition-colors',
                  isDirectory
                    ? 'bg-[color-mix(in_srgb,var(--workbench-active)_14%,transparent)] text-[var(--workbench-active)] ring-1 ring-[color-mix(in_srgb,var(--workbench-active)_28%,transparent)]'
                    : isSelected
                      ? 'bg-[var(--workbench-hover)] text-foreground'
                      : 'bg-muted text-muted-foreground'
                )}
                data-entry-icon={isDirectory ? 'directory' : 'file'}
              >
                {isRemoving ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : isDirectory ? (
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
              onEditFile && singleContextTarget.kind === 'file' ? (
                <ContextMenuItem onClick={() => onEditFile(singleContextTarget.path)}>
                  <EditIcon className="size-4" />
                  {t('common.actions.edit')}
                </ContextMenuItem>
              ) : null
            ) : null}

            {singleContextTarget && singleContextTarget.kind !== 'directory' ? (
              <ContextMenuItem
                onClick={() =>
                  void sftpClient.downloadFile(session.sessionId, singleContextTarget.path)
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

            {singleContextTarget ? (
              <ContextMenuItem onClick={() => void sendPathToTerminal(singleContextTarget.path)}>
                <SendToTerminalIcon className="size-4" />
                {t('workbench.sftp.actions.copyPathToTerminal')}
              </ContextMenuItem>
            ) : null}

            <ContextMenuItem onClick={() => void refresh()}>
              <RefreshIcon className="size-4" />
              {t('common.actions.refresh')}
            </ContextMenuItem>

            <ContextMenuItem onClick={() => openCreateFileDialog(createTargetPath)}>
              <NewFileIcon className="size-4" />
              {t('common.actions.newFile')}
            </ContextMenuItem>

            <ContextMenuItem onClick={() => openCreateFolderDialog(createTargetPath)}>
              <NewFolderIcon className="size-4" />
              {t('common.actions.newFolder')}
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
              onClick={() => openDeleteDialog(contextMenuTargets)}
            >
              <DeleteIcon className="size-4" />
              {t('common.actions.delete')}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
    )
  }

  return (
    <>
      <div
        role="region"
        aria-label={t('workbench.sftp.explorer')}
        className={cn('relative flex h-full flex-col bg-background', className)}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="border-b px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t('workbench.sftp.explorer')}</div>
              <div className="truncate text-xs text-muted-foreground">{session.serverName}</div>
            </div>
            <div className="flex items-center gap-1">
              <TooltipIconButton
                variant="outline"
                size="icon-sm"
                label={t('common.actions.close')}
                onClick={() => setAuxView(session.sessionId, null)}
              >
                <X className="size-4" />
              </TooltipIconButton>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                {t('workbench.sftp.labels.currentPath')}
              </div>
              <TooltipIconButton
                variant="ghost"
                size="icon-xs"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                label={t('workbench.sftp.actions.copyPath')}
                onClick={() => void copyPath(currentPath)}
              >
                <CopyIcon className="size-3.5" />
              </TooltipIconButton>
            </div>

            <Textarea
              aria-label={t('workbench.sftp.labels.currentPath')}
              className="mt-2 min-h-[72px] resize-none overflow-y-auto border-border/60 bg-background font-mono text-[12px] leading-5 shadow-none [overflow-wrap:anywhere]"
              rows={3}
              spellCheck={false}
              value={pathInputValue}
              onChange={(event) => setPathInputValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) {
                  return
                }

                event.preventDefault()
                jumpToPath()
              }}
            />
          </div>

          <div className="mt-2 flex items-center gap-1 pt-2">
            <TooltipIconButton
              variant="ghost"
              size="icon-sm"
              label={t('workbench.sftp.actions.backToParent')}
              onClick={() => {
                clearSelection()
                setCurrentPath(session.sessionId, getParentRemotePath(currentPath))
              }}
            >
              <Undo2 className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              variant="ghost"
              size="icon-sm"
              label={t('common.actions.newFile')}
              onClick={() => openCreateFileDialog(currentPath)}
            >
              <NewFileIcon className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              variant="ghost"
              size="icon-sm"
              label={t('common.actions.newFolder')}
              onClick={() => openCreateFolderDialog(currentPath)}
            >
              <NewFolderIcon className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              variant="ghost"
              size="icon-sm"
              label={t('common.actions.upload')}
              onClick={() =>
                void runUpload(() => sftpClient.uploadFiles(session.sessionId, currentPath))
              }
            >
              <UploadIcon className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              variant="ghost"
              size="icon-sm"
              label={t('common.actions.refresh')}
              onClick={() => void refresh()}
            >
              <RefreshIcon className="size-4" />
            </TooltipIconButton>
          </div>
        </div>

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={scrollContainerRef}
              className="min-h-0 flex-1 overflow-y-auto"
              onClick={(event) => event.target === event.currentTarget && clearSelection()}
            >
              {listingQuery.isLoading ? (
                <div className="space-y-2 p-3">
                  <Skeleton className="h-9 rounded-md" />
                  <Skeleton className="h-9 rounded-md" />
                  <Skeleton className="h-9 rounded-md" />
                </div>
              ) : null}

              {!listingQuery.isLoading && entries.length === 0 ? (
                <div className="m-3 rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('workbench.sftp.empty.directory')}
                </div>
              ) : null}

              {!listingQuery.isLoading && entries.length > 0 ? (
                shouldRenderStaticRows ? (
                  <div data-testid="sftp-entry-list" data-render-mode="static">
                    {entries.map((entry) => renderEntryRow(entry))}
                  </div>
                ) : (
                  <div
                    data-testid="sftp-entry-list"
                    data-render-mode="virtual"
                    style={{ height: `${totalVirtualListHeight}px`, position: 'relative' }}
                  >
                    {virtualItems.map((virtualItem) =>
                      renderEntryRow(entries[virtualItem.index], {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualItem.size}px`,
                        transform: `translateY(${virtualItem.start}px)`
                      })
                    )}
                  </div>
                )
              ) : null}
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => void refresh()}>
              <RefreshIcon className="size-4" />
              {t('common.actions.refresh')}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => void sendPathToTerminal(currentPath)}>
              <SendToTerminalIcon className="size-4" />
              {t('workbench.sftp.actions.copyPathToTerminal')}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => openCreateFileDialog(currentPath)}>
              <NewFileIcon className="size-4" />
              {t('common.actions.newFile')}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => openCreateFolderDialog(currentPath)}>
              <NewFolderIcon className="size-4" />
              {t('common.actions.newFolder')}
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {isDragActive ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[color-mix(in_srgb,var(--workbench-editor)_72%,transparent)] p-4 backdrop-blur-sm">
            <div className="max-w-sm rounded-xl border border-dashed border-[var(--workbench-accent)] bg-[color-mix(in_srgb,var(--workbench-sidebar)_92%,transparent)] px-5 py-4 text-center shadow-xl">
              <div className="text-sm font-semibold text-foreground">
                {t('workbench.sftp.dropzone.title')}
              </div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                {t('workbench.sftp.dropzone.description', { path: currentPath })}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog
        open={newFileOpen}
        onOpenChange={(open) => {
          setNewFileOpen(open)
          if (!open) {
            setNewFileName('')
            setNewFileTargetPath(null)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('workbench.sftp.dialogs.createFile')}</DialogTitle>
          </DialogHeader>
          <Input
            value={newFileName}
            onChange={(event) => setNewFileName(event.target.value)}
            placeholder={t('workbench.sftp.placeholders.fileName')}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFileOpen(false)}>
              <CancelIcon className="size-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={async () => {
                await sftpClient.createFile(
                  session.sessionId,
                  newFileTargetPath ?? currentPath,
                  newFileName
                )
                setNewFileName('')
                setNewFileTargetPath(null)
                setNewFileOpen(false)
                await refresh()
              }}
            >
              <CreateFileIcon className="size-4" />
              {t('common.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newFolderOpen}
        onOpenChange={(open) => {
          setNewFolderOpen(open)
          if (!open) {
            setNewFolderName('')
            setNewFolderTargetPath(null)
          }
        }}
      >
        <DialogContent className="max-w-sm">
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
                await sftpClient.mkdir(
                  session.sessionId,
                  newFolderTargetPath ?? currentPath,
                  newFolderName
                )
                setNewFolderName('')
                setNewFolderTargetPath(null)
                setNewFolderOpen(false)
                await refresh()
              }}
            >
              <CreateFolderIcon className="size-4" />
              {t('common.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="max-w-sm">
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

                await sftpClient.rename(session.sessionId, renameTarget.path, renameValue)
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

      <Dialog
        open={Boolean(pendingDeleteEntries)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteEntries(null)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('workbench.sftp.deleteDialog.title')}</DialogTitle>
            <DialogDescription>{t('workbench.sftp.deleteDialog.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingDeleteEntries(null)}>
              <CancelIcon className="size-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pendingDeleteEntries?.length) {
                  return
                }

                const entriesToRemove = pendingDeleteEntries
                setPendingDeleteEntries(null)
                void removeEntries(entriesToRemove)
              }}
            >
              <DeleteIcon className="size-4" />
              {t('common.actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
