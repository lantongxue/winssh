import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type CSSProperties
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { File, Folder, LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { RemoteEntry, SftpListResult } from '@shared/types'
import { sftpClient } from '@/features/sftp/api/sftp-client'
import { actionIcons } from '@/lib/action-icons'
import { writeTerminalPathDragData } from '@/lib/terminal-path-dnd'
import type { SessionTab } from '@/store/sessions-store'
import { cn } from '@/lib/utils'
import { SftpEntryContextMenu } from '@/components/sftp-entry-context-menu'
import { Skeleton } from '@/components/ui/skeleton'

const ENTRY_ITEM_HEIGHT = 56

export type SftpViewMode = 'flat' | 'tree'

interface FlatTreeNode {
  entry: RemoteEntry
  depth: number
  isExpanded: boolean
  isLoading: boolean
}

interface SftpTreeEntryRowProps {
  node: FlatTreeNode
  wrapperStyle?: CSSProperties
  sessionId: string
  currentPath: string
  selectedEntrySet: Set<string>
  removingEntrySet: Set<string>
  onToggleExpanded: (path: string) => void
  onSelectSingleEntry: (path: string) => void
  onHandleEntrySelection: (
    entryPath: string,
    options: { additive: boolean; range: boolean }
  ) => void
  onClearSelection: () => void
  onOpenCreateFileDialog: (targetPath: string) => void
  onOpenCreateFolderDialog: (targetPath: string) => void
  onOpenDeleteDialog: (entries: RemoteEntry[]) => void
  onSetRenameTarget: (entry: RemoteEntry) => void
  onRefresh: () => void
  onCopyEntryPaths: (entries: RemoteEntry[]) => void
  onSendPathToTerminal: (path: string) => void
  onResolveContextMenuTargets: (entry: RemoteEntry) => RemoteEntry[]
  onGetEntryMeta: (entry: RemoteEntry) => string
  onEditFile?: (remotePath: string) => void
}

function SftpTreeEntryRow({
  node,
  wrapperStyle,
  sessionId,
  currentPath,
  selectedEntrySet,
  removingEntrySet,
  onToggleExpanded,
  onSelectSingleEntry,
  onHandleEntrySelection,
  onClearSelection,
  onOpenCreateFileDialog,
  onOpenCreateFolderDialog,
  onOpenDeleteDialog,
  onSetRenameTarget,
  onRefresh,
  onCopyEntryPaths,
  onSendPathToTerminal,
  onResolveContextMenuTargets,
  onGetEntryMeta,
  onEditFile
}: SftpTreeEntryRowProps) {
  const ExpandIcon = actionIcons.expand
  const CollapseIcon = actionIcons.collapse

  if (node.isLoading) {
    return (
      <div style={wrapperStyle ?? { height: `${ENTRY_ITEM_HEIGHT}px` }} className="">
        <div
          style={{ paddingLeft: `${node.depth * 16 + 12}px` }}
          className="flex h-full items-center gap-3 border-b px-3 py-2"
        >
          <Skeleton className="size-6 rounded-sm" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-3/5 rounded-sm" />
            <Skeleton className="h-3 w-2/5 rounded-sm" />
          </div>
        </div>
      </div>
    )
  }

  const { entry, depth, isExpanded } = node
  const isDirectory = entry.kind === 'directory'
  const isSelected = selectedEntrySet.has(entry.path)
  const isRemoving = removingEntrySet.has(entry.path)
  const contextMenuTargets = onResolveContextMenuTargets(entry)
  const hasSingleContextTarget = contextMenuTargets.length === 1
  const singleContextTarget = hasSingleContextTarget ? contextMenuTargets[0] : null
  const createTargetPath =
    singleContextTarget?.kind === 'directory' ? singleContextTarget.path : currentPath

  const entryButton = (
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
      style={{ paddingLeft: `${depth * 16 + 12}px` }}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) {
          onHandleEntrySelection(entry.path, {
            additive: event.metaKey || event.ctrlKey,
            range: event.shiftKey
          })
          return
        }
        onSelectSingleEntry(entry.path)
      }}
      onContextMenu={(event) => {
        if (!isSelected) {
          event.preventDefault()
        }
      }}
      onDoubleClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) return
        if (isDirectory) {
          onToggleExpanded(entry.path)
        } else if (entry.kind === 'file') {
          onEditFile?.(entry.path)
        }
      }}
      onKeyDown={(event) => {
        if (event.key === ' ') {
          event.preventDefault()
          onHandleEntrySelection(entry.path, {
            additive: event.metaKey || event.ctrlKey,
            range: event.shiftKey
          })
          return
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          onClearSelection()
          return
        }

        if (event.key === 'Enter' && entry.kind === 'directory') {
          event.preventDefault()
          onToggleExpanded(entry.path)
        }
      }}
      onDragStart={(event) => {
        writeTerminalPathDragData(event.dataTransfer, entry.path)
      }}
    >
      <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center">
        {isDirectory ? (
          <span
            role="button"
            tabIndex={0}
            className="flex size-5 items-center justify-center rounded-sm hover:bg-[var(--workbench-hover)]"
            onClick={(event) => {
              event.stopPropagation()
              onToggleExpanded(entry.path)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.stopPropagation()
                event.preventDefault()
                onToggleExpanded(entry.path)
              }
            }}
          >
            {isExpanded ? (
              <CollapseIcon className="size-3.5" />
            ) : (
              <ExpandIcon className="size-3.5" />
            )}
          </span>
        ) : (
          <span className="size-5" />
        )}
      </div>
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
          {onGetEntryMeta(entry)}
        </div>
      </div>
    </button>
  )

  return (
    <div style={wrapperStyle ?? { height: `${ENTRY_ITEM_HEIGHT}px` }}>
      {isSelected ? (
        <SftpEntryContextMenu
          sessionId={sessionId}
          singleContextTarget={singleContextTarget}
          hasSingleContextTarget={hasSingleContextTarget}
          contextMenuTargets={contextMenuTargets}
          createTargetPath={createTargetPath}
          onOpenDirectory={onToggleExpanded}
          onEditFile={onEditFile}
          onRename={onSetRenameTarget}
          onRefresh={onRefresh}
          onCopyEntryPaths={onCopyEntryPaths}
          onSendPathToTerminal={onSendPathToTerminal}
          onOpenCreateFileDialog={onOpenCreateFileDialog}
          onOpenCreateFolderDialog={onOpenCreateFolderDialog}
          onOpenDeleteDialog={onOpenDeleteDialog}
        >
          {entryButton}
        </SftpEntryContextMenu>
      ) : (
        entryButton
      )}
    </div>
  )
}

export interface SftpTreeViewHandle {
  collapsePaths: (paths: string[]) => void
  expandPath: (path: string) => void
  renameExpandedPath: (oldPath: string, newPath: string) => void
  getNodeCount: () => number
  selectEntryRange: (
    path: string,
    anchorPath: string | null,
    lastSelectedPath: string | null
  ) => {
    paths: string[]
    anchorPath: string
  }
}

interface SftpTreeViewProps {
  session: SessionTab
  entries: RemoteEntry[]
  viewMode: SftpViewMode
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  selectedEntrySet: Set<string>
  removingEntrySet: Set<string>
  onSelectSingleEntry: (path: string) => void
  onHandleEntrySelection: (
    entryPath: string,
    options: { additive: boolean; range: boolean }
  ) => void
  onClearSelection: () => void
  onOpenCreateFileDialog: (targetPath: string) => void
  onOpenCreateFolderDialog: (targetPath: string) => void
  onOpenDeleteDialog: (entries: RemoteEntry[]) => void
  onSetRenameTarget: (entry: RemoteEntry) => void
  onRefresh: () => void
  onCopyEntryPaths: (entries: RemoteEntry[]) => void
  onSendPathToTerminal: (path: string) => void
  onResolveContextMenuTargets: (entry: RemoteEntry) => RemoteEntry[]
  onGetEntryMeta: (entry: RemoteEntry) => string
  onEditFile?: (remotePath: string) => void
}

export const SftpTreeView = forwardRef<SftpTreeViewHandle, SftpTreeViewProps>(function SftpTreeView(
  {
    session,
    entries,
    viewMode,
    scrollContainerRef,
    selectedEntrySet,
    removingEntrySet,
    onSelectSingleEntry,
    onHandleEntrySelection,
    onClearSelection,
    onOpenCreateFileDialog,
    onOpenCreateFolderDialog,
    onOpenDeleteDialog,
    onSetRenameTarget,
    onRefresh,
    onCopyEntryPaths,
    onSendPathToTerminal,
    onResolveContextMenuTargets,
    onGetEntryMeta,
    onEditFile
  },
  ref
) {
  const queryClient = useQueryClient()
  const { t } = useTranslation()

  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [recentlyLoadedPaths, setRecentlyLoadedPaths] = useState<Set<string>>(new Set())

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((current) => {
      const next = new Set(current)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const flatTreeNodes = useMemo<FlatTreeNode[]>(() => {
    if (viewMode !== 'tree') return []

    const nodes: FlatTreeNode[] = []

    const walk = (items: RemoteEntry[], depth: number) => {
      for (const entry of items) {
        const isDirectory = entry.kind === 'directory'
        const isExpanded = isDirectory && expandedPaths.has(entry.path)

        nodes.push({ entry, depth, isExpanded, isLoading: false })

        if (isDirectory && isExpanded) {
          const cached = queryClient.getQueryData<SftpListResult>([
            'sftp',
            session.sessionId,
            entry.path
          ])

          if (cached?.entries) {
            walk(cached.entries, depth + 1)
          } else {
            nodes.push({ entry, depth: depth + 1, isExpanded: false, isLoading: true })
          }
        }
      }
    }

    walk(entries, 0)
    return nodes
  }, [viewMode, entries, expandedPaths, recentlyLoadedPaths, queryClient, session.sessionId])

  useEffect(() => {
    if (viewMode !== 'tree') return

    for (const path of expandedPaths) {
      const cached = queryClient.getQueryData<SftpListResult>(['sftp', session.sessionId, path])

      if (!cached) {
        queryClient
          .fetchQuery({
            queryKey: ['sftp', session.sessionId, path],
            queryFn: () => sftpClient.list(session.sessionId, path)
          })
          .then(() => {
            setRecentlyLoadedPaths((current) => {
              const next = new Set(current)
              next.add(path)
              return next
            })
            window.setTimeout(() => {
              setRecentlyLoadedPaths((current) => {
                const next = new Set(current)
                next.delete(path)
                return next
              })
            }, 300)
          })
          .catch(() => {
            setExpandedPaths((current) => {
              const next = new Set(current)
              next.delete(path)
              return next
            })
            toast.error(t('workbench.sftp.toasts.listFailed'))
          })
      }
    }
  }, [expandedPaths, viewMode, session, queryClient, t])

  const treeVirtualizer = useVirtualizer({
    count: flatTreeNodes.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ENTRY_ITEM_HEIGHT,
    overscan: 10,
    enabled: viewMode === 'tree',
    getItemKey: (index) => {
      const node = flatTreeNodes[index]
      return node.isLoading ? `loading:${node.entry.path}` : node.entry.path
    }
  })

  const shouldRenderStaticTreeRows =
    flatTreeNodes.length > 0 &&
    treeVirtualizer.getVirtualItems().length === 0 &&
    (scrollContainerRef.current?.clientHeight ?? 0) === 0

  useImperativeHandle(
    ref,
    () => ({
      collapsePaths(paths: string[]) {
        setExpandedPaths((current) => {
          const next = new Set(current)
          for (const targetPath of paths) {
            next.delete(targetPath)
            for (const expandedPath of next) {
              if (expandedPath.startsWith(targetPath + '/')) {
                next.delete(expandedPath)
              }
            }
          }
          return next
        })
      },
      expandPath(path: string) {
        setExpandedPaths((current) => new Set([...current, path]))
      },
      renameExpandedPath(oldPath: string, newPath: string) {
        setExpandedPaths((current) => {
          const next = new Set<string>()
          for (const expandedPath of current) {
            if (expandedPath === oldPath) {
              next.add(newPath)
            } else if (expandedPath.startsWith(oldPath + '/')) {
              next.add(expandedPath.replace(oldPath, newPath))
            } else {
              next.add(expandedPath)
            }
          }
          return next
        })
      },
      getNodeCount() {
        return flatTreeNodes.length
      },
      selectEntryRange(path, anchorPath, lastSelectedPath) {
        const resolvedAnchor = anchorPath ?? lastSelectedPath ?? path
        const anchorIndex = flatTreeNodes.findIndex((node) => node.entry.path === resolvedAnchor)
        const targetIndex = flatTreeNodes.findIndex((node) => node.entry.path === path)

        if (anchorIndex === -1 || targetIndex === -1) {
          return { paths: [path], anchorPath: path }
        }

        const [start, end] =
          anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex]

        return {
          paths: flatTreeNodes.slice(start, end + 1).map((node) => node.entry.path),
          anchorPath: resolvedAnchor
        }
      }
    }),
    [flatTreeNodes]
  )

  const currentPath = session.currentPath

  const renderTreeEntry = (node: FlatTreeNode, wrapperStyle?: CSSProperties) => (
    <SftpTreeEntryRow
      key={node.isLoading ? `loading:${node.entry.path}` : node.entry.path}
      node={node}
      wrapperStyle={wrapperStyle}
      sessionId={session.sessionId}
      currentPath={currentPath}
      selectedEntrySet={selectedEntrySet}
      removingEntrySet={removingEntrySet}
      onToggleExpanded={toggleExpanded}
      onSelectSingleEntry={onSelectSingleEntry}
      onHandleEntrySelection={onHandleEntrySelection}
      onClearSelection={onClearSelection}
      onOpenCreateFileDialog={onOpenCreateFileDialog}
      onOpenCreateFolderDialog={onOpenCreateFolderDialog}
      onOpenDeleteDialog={onOpenDeleteDialog}
      onSetRenameTarget={onSetRenameTarget}
      onRefresh={onRefresh}
      onCopyEntryPaths={onCopyEntryPaths}
      onSendPathToTerminal={onSendPathToTerminal}
      onResolveContextMenuTargets={onResolveContextMenuTargets}
      onGetEntryMeta={onGetEntryMeta}
      onEditFile={onEditFile}
    />
  )

  return shouldRenderStaticTreeRows ? (
    <div data-testid="sftp-tree-list" data-render-mode="static">
      {flatTreeNodes.map((node) => renderTreeEntry(node))}
    </div>
  ) : (
    <div
      data-testid="sftp-tree-list"
      data-render-mode="virtual"
      style={{ height: `${treeVirtualizer.getTotalSize()}px`, position: 'relative' }}
    >
      {treeVirtualizer.getVirtualItems().map((virtualItem) =>
        renderTreeEntry(flatTreeNodes[virtualItem.index], {
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
})
