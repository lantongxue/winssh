import { type CSSProperties } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { File, Folder, LoaderCircle } from 'lucide-react'
import type { RemoteEntry } from '@shared/types'
import { writeTerminalPathDragData } from '@/lib/terminal-path-dnd'
import type { SessionTab } from '@/store/sessions-store'
import { cn } from '@/lib/utils'
import { SftpEntryContextMenu } from '@/components/sftp-entry-context-menu'

const ENTRY_ITEM_HEIGHT = 56
const VIRTUALIZED_ENTRY_THRESHOLD = 200

interface FlatEntryRowProps {
  entry: RemoteEntry
  wrapperStyle?: CSSProperties
  sessionId: string
  currentPath: string
  selectedEntrySet: Set<string>
  removingEntrySet: Set<string>
  onSelectSingleEntry: (path: string) => void
  onHandleEntrySelection: (entryPath: string, options: { additive: boolean; range: boolean }) => void
  onClearSelection: () => void
  onOpenDirectory: (path: string) => void
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

function FlatEntryRow({
  entry,
  wrapperStyle,
  sessionId,
  currentPath,
  selectedEntrySet,
  removingEntrySet,
  onSelectSingleEntry,
  onHandleEntrySelection,
  onClearSelection,
  onOpenDirectory,
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
}: FlatEntryRowProps) {
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
      onClick={(event) =>
        onHandleEntrySelection(entry.path, {
          additive: event.metaKey || event.ctrlKey,
          range: event.shiftKey
        })
      }
      onContextMenu={(event) => {
        if (!isSelected) {
          event.preventDefault()
        }
      }}
      onDoubleClick={(event) => {
        onHandleEntrySelection(entry.path, {
          additive: event.metaKey || event.ctrlKey,
          range: event.shiftKey
        })
        if (isDirectory) {
          onOpenDirectory(entry.path)
          return
        }

        if (entry.kind === 'file') {
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
          onSelectSingleEntry(entry.path)
          onOpenDirectory(entry.path)
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
          {onGetEntryMeta(entry)}
        </div>
      </div>
    </button>
  )

  return (
    <div
      key={entry.path}
      style={
        wrapperStyle ?? {
          height: `${ENTRY_ITEM_HEIGHT}px`
        }
      }
    >
      {isSelected ? (
        <SftpEntryContextMenu
          sessionId={sessionId}
          singleContextTarget={singleContextTarget}
          hasSingleContextTarget={hasSingleContextTarget}
          contextMenuTargets={contextMenuTargets}
          createTargetPath={createTargetPath}
          onOpenDirectory={onOpenDirectory}
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

export interface SftpFlatViewProps {
  session: SessionTab
  entries: RemoteEntry[]
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
  selectedEntrySet: Set<string>
  removingEntrySet: Set<string>
  onSelectSingleEntry: (path: string) => void
  onHandleEntrySelection: (entryPath: string, options: { additive: boolean; range: boolean }) => void
  onClearSelection: () => void
  onOpenDirectory: (path: string) => void
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

export function SftpFlatView({
  session,
  entries,
  scrollContainerRef,
  selectedEntrySet,
  removingEntrySet,
  onSelectSingleEntry,
  onHandleEntrySelection,
  onClearSelection,
  onOpenDirectory,
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
}: SftpFlatViewProps) {
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

  const commonProps = {
    sessionId: session.sessionId,
    currentPath: session.currentPath,
    selectedEntrySet,
    removingEntrySet,
    onSelectSingleEntry,
    onHandleEntrySelection,
    onClearSelection,
    onOpenDirectory,
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
  }

  if (shouldRenderStaticRows) {
    return (
      <div data-testid="sftp-entry-list" data-render-mode="static">
        {entries.map((entry) => (
          <FlatEntryRow key={entry.path} entry={entry} {...commonProps} />
        ))}
      </div>
    )
  }

  return (
    <div
      data-testid="sftp-entry-list"
      data-render-mode="virtual"
      style={{ height: `${totalVirtualListHeight}px`, position: 'relative' }}
    >
      {virtualItems.map((virtualItem) => (
        <FlatEntryRow
          key={entries[virtualItem.index]?.path ?? virtualItem.index}
          entry={entries[virtualItem.index]}
          {...commonProps}
          wrapperStyle={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${virtualItem.size}px`,
            transform: `translateY(${virtualItem.start}px)`
          }}
        />
      ))}
    </div>
  )
}
