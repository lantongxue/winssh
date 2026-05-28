import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  Clock,
  Copy,
  Folder,
  Pencil,
  Play,
  Plus,
  Search,
  Star,
  TerminalSquare,
  Trash2,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CommandHistoryEntry, CommandHistoryScope } from '@shared/types'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useCommandHistory } from '@/features/command-history/hooks/use-command-history'
import { useCustomCommands } from '@/features/custom-commands/hooks/use-custom-commands'

const ROW_HEIGHT = 76

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

interface CommandPanelProps {
  scope: CommandHistoryScope
  onInsertCommand: (text: string) => void
  onClose: () => void
  className?: string
  onHeaderDragStart?: (event: React.DragEvent<HTMLDivElement>) => void
  onHeaderDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void
}

export function CommandPanel({
  scope,
  onInsertCommand,
  onClose,
  className,
  onHeaderDragStart,
  onHeaderDragEnd
}: CommandPanelProps) {
  const { t } = useTranslation()

  // Tab & filter state
  const [activeTab, setActiveTab] = useState<'history' | 'custom'>('history')
  const [searchQuery, setSearchQuery] = useState('')
  const [historyFilter, setHistoryFilter] = useState<'all' | 'success' | 'failed'>('all')

  // Data hooks
  const {
    entries,
    isLoading: historyLoading,
    isClearing,
    clear,
    deleteEntry
  } = useCommandHistory(scope)
  const {
    commands,
    isLoading: customLoading,
    create,
    update,
    delete: deleteCommand,
    isCreating,
    isDeleting
  } = useCustomCommands()

  const historyCount = useMemo(() => {
    return entries.filter((entry) => !entry.command.trim().startsWith('__wsh_')).length
  }, [entries])
  const customCount = commands.length

  // Dialogs & drawer
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingCommand, setEditingCommand] = useState<string | null>(null)
  const [drawerFormName, setDrawerFormName] = useState('')
  const [drawerFormCommand, setDrawerFormCommand] = useState('')

  // ──── Filtered lists ────
  const filteredHistory = useMemo(() => {
    let list = entries.filter((entry) => !entry.command.trim().startsWith('__wsh_'))

    if (historyFilter === 'success') {
      list = list.filter((entry) => entry.exitCode === 0)
    } else if (historyFilter === 'failed') {
      list = list.filter((entry) => entry.exitCode !== null && entry.exitCode !== 0)
    }

    if (searchQuery.trim()) {
      const needle = searchQuery.trim().toLowerCase()
      list = list.filter((entry) => entry.command.toLowerCase().includes(needle))
    }

    return list
  }, [entries, historyFilter, searchQuery])

  const filteredCustom = useMemo(() => {
    if (!searchQuery.trim()) return commands

    const needle = searchQuery.trim().toLowerCase()
    return commands.filter(
      (cmd) => cmd.name.toLowerCase().includes(needle) || cmd.command.toLowerCase().includes(needle)
    )
  }, [commands, searchQuery])

  const displayItems = activeTab === 'history' ? filteredHistory : filteredCustom
  const isLoading = activeTab === 'history' ? historyLoading : customLoading

  // ──── Virtualization ────
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: displayItems.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => {
      const item = displayItems[index]
      if (!item) return index
      return 'id' in item ? item.id : `custom-${index}`
    }
  })

  // ──── Drawer helpers ────
  const openAddDrawer = () => {
    setEditingCommand(null)
    setDrawerFormName('')
    setDrawerFormCommand('')
    setDrawerOpen(true)
  }

  const openEditDrawer = (id: string, name: string, command: string) => {
    setEditingCommand(id)
    setDrawerFormName(name)
    setDrawerFormCommand(command)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditingCommand(null)
    setDrawerFormName('')
    setDrawerFormCommand('')
  }

  const handleSaveDrawer = async () => {
    const name = drawerFormName.trim()
    const command = drawerFormCommand.trim()
    if (!name || !command) return

    if (editingCommand) {
      await update(editingCommand, { name, command })
    } else {
      await create({ name, command })
    }
    closeDrawer()
  }

  // ──── Bookmark history → custom ────
  const handleBookmark = (command: string) => {
    setEditingCommand(null)
    setDrawerFormName('')
    setDrawerFormCommand(command)
    setDrawerOpen(true)
  }

  // ──── Clear history ────
  const handleClear = () => {
    if (entries.length === 0) return
    setShowClearDialog(true)
  }

  const handleConfirmClear = async () => {
    await clear()
    setShowClearDialog(false)
  }

  // ──── Actions ────
  const handleInsert = (text: string) => {
    onInsertCommand(text)
  }

  const handleRun = (text: string) => {
    onInsertCommand(text + '\r')
  }

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  // ──── Render helpers ────
  const formatTime = (iso: string): string => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    const yyyy = date.getFullYear()
    const MM = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')
    return `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`
  }

  const emptyState = () => {
    if (isLoading) return null
    if (activeTab === 'history') {
      const hasSearchQuery = searchQuery.trim().length > 0
      return (
        <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6 select-none">
          <div className="rounded-2xl bg-[var(--workbench-hover)] p-5 mb-4 border border-[var(--workbench-border)]/50 shrink-0 shadow-sm">
            <TerminalSquare className="size-10 text-muted-foreground/40" />
          </div>
          <h3 className="text-sm font-bold text-foreground mb-1.5">
            {t('workbench.commandPanel.history.emptyTitle')}
          </h3>
          <p className="text-xs text-muted-foreground/70 max-w-[220px] leading-relaxed">
            {hasSearchQuery
              ? t('workbench.commandCenter.commandPalette.empty')
              : t('workbench.commandPanel.history.emptyDescription')}
          </p>
        </div>
      )
    }
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6 select-none">
        <div className="rounded-2xl bg-[var(--workbench-hover)] p-5 mb-4 border border-[var(--workbench-border)]/50 shrink-0 shadow-sm">
          <Star className="size-10 text-muted-foreground/40" />
        </div>
        <h3 className="text-sm font-bold text-foreground mb-1.5">
          {t('workbench.commandPanel.custom.emptyTitle')}
        </h3>
        <p className="text-xs text-muted-foreground/70 max-w-[220px] leading-relaxed">
          {t('workbench.commandPanel.custom.emptyDescription')}
        </p>
      </div>
    )
  }

  return (
    <>
      <div
        className={cn(
          'relative flex h-full flex-col overflow-hidden bg-[var(--workbench-sidebar)]',
          className
        )}
      >
        {/* ── Header ── */}
        <div
          draggable={!!onHeaderDragStart}
          className={cn(
            'flex items-center justify-between gap-3 px-4 py-3.5 border-b border-[var(--workbench-border)]',
            onHeaderDragStart && 'cursor-grab active:cursor-grabbing'
          )}
          onDragStart={onHeaderDragStart}
          onDragEnd={onHeaderDragEnd}
        >
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold tracking-tight text-foreground">
              {t('workbench.commandPanel.title')}
            </span>
            <span className="text-[11px] text-muted-foreground mt-0.5 opacity-80">
              {t('workbench.commandPanel.subtitle')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <TooltipIconButton
              variant="ghost"
              size="icon-sm"
              label={t('workbench.commandPanel.drawer.title')}
              onClick={openAddDrawer}
              className="size-7 text-[var(--workbench-active)] hover:bg-[var(--workbench-hover)]"
            >
              <Plus className="size-4" />
            </TooltipIconButton>
            <TooltipIconButton
              variant="ghost"
              size="icon-sm"
              label={t('common.actions.close')}
              onClick={onClose}
              className="size-7 text-muted-foreground hover:text-foreground hover:bg-[var(--workbench-hover)]"
            >
              <X className="size-4" />
            </TooltipIconButton>
          </div>
        </div>

        {/* ── Main Tabs ── */}
        <div className="flex gap-5 px-4 ">
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'flex items-center gap-1.5 relative py-2.5 text-[13px] font-medium transition-all focus-visible:outline-none cursor-default',
              activeTab === 'history'
                ? 'text-[var(--workbench-active)] font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>{t('workbench.commandPanel.tabs.history')}</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200',
                activeTab === 'history'
                  ? 'bg-[var(--workbench-active)]/15 text-[var(--workbench-active)]'
                  : 'bg-[var(--workbench-hover)] text-muted-foreground'
              )}
            >
              {historyCount}
            </span>
            {activeTab === 'history' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--workbench-active)] rounded-full transition-all duration-200" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={cn(
              'flex items-center gap-1.5 relative py-2.5 text-[13px] font-medium transition-all focus-visible:outline-none cursor-default',
              activeTab === 'custom'
                ? 'text-[var(--workbench-active)] font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span>{t('workbench.commandPanel.tabs.custom')}</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-all duration-200',
                activeTab === 'custom'
                  ? 'bg-[var(--workbench-active)]/15 text-[var(--workbench-active)]'
                  : 'bg-[var(--workbench-hover)] text-muted-foreground'
              )}
            >
              {customCount}
            </span>
            {activeTab === 'custom' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--workbench-active)] rounded-full transition-all duration-200" />
            )}
          </button>
        </div>

        {/* ── Search & Filters ── */}
        <div className="flex flex-col gap-2 px-4 py-2 border-b border-[var(--workbench-border)]/50">
          <div className="relative group">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground group-focus-within:text-[var(--workbench-active)] transition-colors" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeTab === 'history'
                  ? t('workbench.commandPanel.searchPlaceholder.history')
                  : t('workbench.commandPanel.searchPlaceholder.custom')
              }
              className="pl-9 text-[11px] border-[var(--workbench-border)] bg-[var(--workbench-input)]"
            />
          </div>

          {activeTab === 'history' && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-1 gap-1">
                <button
                  onClick={() => setHistoryFilter('all')}
                  className={cn(
                    'flex-1 text-[11px] py-0.5',
                    historyFilter === 'all'
                      ? 'bg-[var(--workbench-input)]'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('workbench.commandHistory.filterAll')}
                </button>
                <button
                  onClick={() => setHistoryFilter('success')}
                  className={cn(
                    'flex-1 text-[11px] py-0.5t',
                    historyFilter === 'success'
                      ? 'bg-[var(--workbench-input)]'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('workbench.commandHistory.filterSuccess')}
                </button>
                <button
                  onClick={() => setHistoryFilter('failed')}
                  className={cn(
                    'flex-1 text-[11px] py-0.5',
                    historyFilter === 'failed'
                      ? 'bg-[var(--workbench-input)]'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t('workbench.commandHistory.filterFailed')}
                </button>
              </div>

              {entries.length > 0 && (
                <button
                  onClick={handleClear}
                  className="shrink-0 text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors px-1 cursor-default"
                >
                  {t('workbench.commandPanel.clearHistory')}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── List ── */}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
          {isLoading ? (
            <div className="space-y-2 p-4">
              <div className="h-[64px] rounded-lg bg-[var(--workbench-hover)] animate-pulse" />
              <div className="h-[64px] rounded-lg bg-[var(--workbench-hover)] animate-pulse" />
              <div className="h-[64px] rounded-lg bg-[var(--workbench-hover)] animate-pulse" />
              <div className="h-[64px] rounded-lg bg-[var(--workbench-hover)] animate-pulse" />
            </div>
          ) : displayItems.length === 0 ? (
            emptyState()
          ) : (
            <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const item = displayItems[virtualRow.index]
                if (!item) return null

                const style: React.CSSProperties = {
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${virtualRow.size}px`
                }

                if (activeTab === 'history') {
                  const entry = item as CommandHistoryEntry
                  return (
                    <HistoryRow
                      key={entry.id}
                      entry={entry}
                      style={style}
                      onInsert={() => handleInsert(entry.command)}
                      onRun={() => handleRun(entry.command)}
                      onCopy={() => handleCopy(entry.command)}
                      onDelete={() => deleteEntry(entry.id)}
                      onBookmark={() => handleBookmark(entry.command)}
                      formatTime={formatTime}
                    />
                  )
                }

                const cmd = item as (typeof commands)[number]
                return (
                  <CustomRow
                    key={cmd.id}
                    command={cmd}
                    style={style}
                    onInsert={() => handleInsert(cmd.command)}
                    onRun={() => handleRun(cmd.command)}
                    onCopy={() => handleCopy(cmd.command)}
                    onEdit={() => openEditDrawer(cmd.id, cmd.name, cmd.command)}
                    onDelete={() => setShowDeleteDialog(cmd.id)}
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* ── Custom Command Form Dialog ── */}
        <Dialog open={drawerOpen} onOpenChange={(open) => !open && closeDrawer()}>
          <DialogContent className="max-w-md rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl">
            <DialogHeader className="border-b border-[var(--workbench-border)] px-4 py-4">
              <DialogTitle>
                {editingCommand
                  ? t('workbench.commandPanel.drawer.editTitle')
                  : t('workbench.commandPanel.drawer.title')}
              </DialogTitle>
            </DialogHeader>
            <div className="px-4 py-4 space-y-3">
              <div>
                <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                  {t('workbench.commandPanel.drawer.nameLabel')}
                </label>
                <Input
                  value={drawerFormName}
                  onChange={(e) => setDrawerFormName(e.target.value)}
                  placeholder={t('workbench.commandPanel.drawer.namePlaceholder')}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] text-muted-foreground font-medium mb-1">
                  {t('workbench.commandPanel.drawer.commandLabel')}
                </label>
                <Textarea
                  value={drawerFormCommand}
                  onChange={(e) => setDrawerFormCommand(e.target.value)}
                  placeholder={t('workbench.commandPanel.drawer.commandPlaceholder')}
                  className="h-[60px] text-xs font-mono resize-none"
                />
              </div>
            </div>
            <DialogFooter className="border-t border-[var(--workbench-border)] px-4 py-3">
              <Button variant="ghost" onClick={closeDrawer}>
                {t('workbench.commandPanel.drawer.cancel')}
              </Button>
              <Button
                onClick={handleSaveDrawer}
                disabled={isCreating || !drawerFormName.trim() || !drawerFormCommand.trim()}
              >
                {t('workbench.commandPanel.drawer.save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Clear History Dialog ── */}
      <Dialog open={showClearDialog} onOpenChange={(open) => !open && setShowClearDialog(false)}>
        <DialogContent
          className="max-w-md rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl"
          showCloseButton={false}
        >
          <DialogHeader className="border-b border-[var(--workbench-border)] px-4 py-4">
            <DialogTitle>{t('workbench.commandHistory.clearDialog.title')}</DialogTitle>
          </DialogHeader>
          <div className="px-4 py-4">
            <DialogDescription>
              {t('workbench.commandHistory.clearDialog.description')}
            </DialogDescription>
          </div>
          <DialogFooter className="border-t border-[var(--workbench-border)] px-4 py-3">
            <Button variant="ghost" disabled={isClearing} onClick={() => setShowClearDialog(false)}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={isClearing}
              onClick={() => void handleConfirmClear()}
            >
              <Trash2 className="size-4" />
              {t('workbench.commandHistory.clear')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Custom Command Dialog ── */}
      <Dialog
        open={showDeleteDialog !== null}
        onOpenChange={(open) => !open && setShowDeleteDialog(null)}
      >
        <DialogContent
          className="max-w-md rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl"
          showCloseButton={false}
        >
          <DialogHeader className="border-b border-[var(--workbench-border)] px-4 py-4">
            <DialogTitle>{t('workbench.commandPanel.custom.delete')}</DialogTitle>
          </DialogHeader>
          <div className="px-4 py-4">
            <DialogDescription>
              {t('workbench.commandPanel.custom.deleteConfirm')}
            </DialogDescription>
          </div>
          <DialogFooter className="border-t border-[var(--workbench-border)] px-4 py-3">
            <Button variant="ghost" onClick={() => setShowDeleteDialog(null)}>
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                if (showDeleteDialog) {
                  void deleteCommand(showDeleteDialog).then(() => setShowDeleteDialog(null))
                }
              }}
            >
              <Trash2 className="size-4" />
              {t('workbench.commandPanel.custom.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ──── History Row ────
interface HistoryRowProps {
  entry: CommandHistoryEntry
  style: React.CSSProperties
  onInsert: () => void
  onRun: () => void
  onCopy: () => void
  onDelete: () => void
  onBookmark: () => void
  formatTime: (iso: string) => string
}

function HistoryRow({
  entry,
  style,
  onInsert,
  onRun,
  onCopy,
  onDelete,
  onBookmark,
  formatTime
}: HistoryRowProps) {
  const { t } = useTranslation()
  const time = formatTime(entry.executedAt)
  const hasExitCode = entry.exitCode !== null
  const isSuccess = entry.exitCode === 0

  return (
    <div style={style} className="px-3 py-1">
      <div
        className="group relative flex flex-col h-full px-3.5 py-2.5 bg-[var(--workbench-editor)] border border-[var(--workbench-border)]/70 hover:border-[var(--workbench-active)]/50 transition-colors cursor-pointer select-none overflow-hidden"
        onDoubleClick={onInsert}
      >
        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <code className="block truncate font-mono text-[12px] text-foreground w-full leading-relaxed cursor-help pr-10">
                {entry.command}
              </code>
            </TooltipTrigger>
            <TooltipContent className="max-w-[320px] break-all flex flex-col gap-1 px-2.5 py-2">
              <span className="font-mono text-[10.5px] select-text text-foreground leading-normal">
                {entry.command}
              </span>
              <span className="text-[10px] text-muted-foreground border-t border-border/30 pt-1.5 mt-1">
                {t('workbench.commandHistory.reRun')}
              </span>
            </TooltipContent>
          </Tooltip>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground mt-2.5 leading-none pr-2">
            <span className="tabular-nums opacity-85 shrink-0">{time}</span>
            {entry.cwd && (
              <span className="flex items-center gap-1.5 truncate max-w-[200px] shrink">
                <Folder className="size-3.5 shrink-0 text-muted-foreground/75" />
                <span className="truncate opacity-85">{entry.cwd}</span>
              </span>
            )}
            <div className="flex items-center gap-3 ml-auto shrink-0">
              {entry.durationMs !== null && (
                <span className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground/75" />
                  <span className="opacity-85">{formatDuration(entry.durationMs)}</span>
                </span>
              )}
              {hasExitCode && (
                <span className={cn(
                  "px-1.5 py-0.5 rounded-sm font-medium",
                  isSuccess 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                    : "bg-red-500/10 text-red-600 dark:text-red-400"
                )}>
                  {t('workbench.commandHistory.exitCode', { defaultValue: '退出码' })}:{entry.exitCode}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hover actions */}
        <div className="absolute right-0 top-0 bottom-0 flex items-center gap-1.5 px-3 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-150 bg-gradient-to-l from-[var(--workbench-editor)] via-[var(--workbench-editor)] to-transparent pl-12">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center size-7 rounded bg-[var(--workbench-input)] border border-[var(--workbench-border)] text-muted-foreground hover:text-emerald-600 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all shadow-sm focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation()
                  onRun()
                }}
              >
                <Play className="size-3.5 fill-current" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('workbench.commandPanel.runImmediately')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center size-7 rounded bg-[var(--workbench-input)] border border-[var(--workbench-border)] text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-[var(--workbench-hover)] transition-all shadow-sm focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation()
                  onCopy()
                }}
              >
                <Copy className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('workbench.commandPanel.copyToClipboard')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center size-7 rounded bg-[var(--workbench-input)] border border-[var(--workbench-border)] text-muted-foreground hover:text-[var(--workbench-active)] hover:border-[var(--workbench-active)]/50 hover:bg-[color-mix(in_srgb,var(--workbench-active)_10%,transparent)] transition-all shadow-sm focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation()
                  onBookmark()
                }}
              >
                <Star className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('workbench.commandPanel.bookmark')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center size-7 rounded bg-[var(--workbench-input)] border border-[var(--workbench-border)] text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10 transition-all shadow-sm focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('workbench.commandPanel.deleteEntry')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

// ──── Custom Command Row ────
interface CustomRowProps {
  command: { id: string; name: string; command: string }
  style: React.CSSProperties
  onInsert: () => void
  onRun: () => void
  onCopy: () => void
  onEdit: () => void
  onDelete: () => void
}

function CustomRow({ command, style, onInsert, onRun, onCopy, onEdit, onDelete }: CustomRowProps) {
  const { t } = useTranslation()

  return (
    <div style={style} className="px-3 py-1">
      <div
        className="group relative flex flex-col h-full px-3.5 py-2.5 bg-[var(--workbench-editor)] border border-[var(--workbench-border)]/70 hover:border-[var(--workbench-active)]/50 transition-colors cursor-pointer select-none overflow-hidden"
        onDoubleClick={onInsert}
      >
        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-full pr-10">
          <div className="flex items-center gap-2 mb-1.5">
            <Star className="size-3.5 text-[var(--workbench-active)] shrink-0 fill-current opacity-85" />
            <div className="text-xs font-semibold text-foreground truncate">{command.name}</div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <code className="block truncate font-mono text-[11.5px] text-foreground/75 w-full leading-relaxed cursor-help">
                {command.command}
              </code>
            </TooltipTrigger>
            <TooltipContent className="max-w-[320px] break-all flex flex-col gap-1 px-2.5 py-2">
              <span className="font-mono text-[10.5px] select-text text-foreground leading-normal">
                {command.command}
              </span>
              <span className="text-[10px] text-muted-foreground border-t border-border/30 pt-1.5 mt-1">
                {t('workbench.commandHistory.reRun')}
              </span>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Hover actions */}
        <div className="absolute right-0 top-0 bottom-0 flex items-center gap-1.5 px-3 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-150 bg-gradient-to-l from-[var(--workbench-editor)] via-[var(--workbench-editor)] to-transparent pl-12">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center size-7 rounded bg-[var(--workbench-input)] border border-[var(--workbench-border)] text-muted-foreground hover:text-emerald-600 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all shadow-sm focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation()
                  onRun()
                }}
              >
                <Play className="size-3.5 fill-current" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('workbench.commandPanel.runImmediately')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center size-7 rounded bg-[var(--workbench-input)] border border-[var(--workbench-border)] text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-[var(--workbench-hover)] transition-all shadow-sm focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation()
                  onCopy()
                }}
              >
                <Copy className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('workbench.commandPanel.copyToClipboard')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center size-7 rounded bg-[var(--workbench-input)] border border-[var(--workbench-border)] text-muted-foreground hover:text-[var(--workbench-active)] hover:border-[var(--workbench-active)]/50 hover:bg-[color-mix(in_srgb,var(--workbench-active)_10%,transparent)] transition-all shadow-sm focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit()
                }}
              >
                <Pencil className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('common.actions.edit')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex items-center justify-center size-7 rounded bg-[var(--workbench-input)] border border-[var(--workbench-border)] text-muted-foreground hover:text-destructive hover:border-destructive/50 hover:bg-destructive/10 transition-all shadow-sm focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t('workbench.commandPanel.custom.delete')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

// ──── Helpers ────
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  return `${minutes}m${seconds}s`
}
