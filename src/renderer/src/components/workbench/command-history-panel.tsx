import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Clock, Copy, Folder, History, LoaderCircle, Play, Search, TerminalSquare, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CommandHistoryEntry, CommandHistoryScope } from '@shared/types'
import { Badge } from '@/components/ui/badge'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useCommandHistory } from '@/features/command-history/hooks/use-command-history'

const ROW_HEIGHT = 68

interface CommandHistoryPanelProps {
  scope: CommandHistoryScope
  onInsertCommand: (text: string) => void
  onClose: () => void
  className?: string
  onHeaderDragStart?: (event: React.DragEvent<HTMLDivElement>) => void
  onHeaderDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void
}

export function CommandHistoryPanel({
  scope,
  onInsertCommand,
  onClose,
  className,
  onHeaderDragStart,
  onHeaderDragEnd
}: CommandHistoryPanelProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'success' | 'failed'>('all')
  const { entries, isLoading, isClearing, clear, deleteEntry } = useCommandHistory(scope)
  const [showClearDialog, setShowClearDialog] = useState(false)

  const filtered = useMemo(() => {
    // 1. Filter out internal shell integration commands (e.g. __wsh_post)
    let list = entries.filter((entry) => !entry.command.trim().startsWith('__wsh_'))

    // 2. Filter by status
    if (filter === 'success') {
      list = list.filter((entry) => entry.exitCode === 0)
    } else if (filter === 'failed') {
      list = list.filter((entry) => entry.exitCode !== null && entry.exitCode !== 0)
    }

    // 3. Filter by search query
    if (!query.trim()) return list
    const needle = query.trim().toLowerCase()
    return list.filter((entry) => entry.command.toLowerCase().includes(needle))
  }, [entries, query, filter])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => filtered[index]?.id ?? index
  })

  const handleClear = () => {
    if (entries.length === 0) return
    setShowClearDialog(true)
  }

  const handleConfirmClear = async () => {
    await clear()
    setShowClearDialog(false)
  }

  return (
    <>
      <div className={cn('flex h-full flex-col bg-background', className)}>
      <div className="border-b px-3 py-3">
        <div
          draggable={!!onHeaderDragStart}
          className={cn(
            'flex items-start justify-between gap-3',
            onHeaderDragStart && 'cursor-grab active:cursor-grabbing'
          )}
          onDragStart={onHeaderDragStart}
          onDragEnd={onHeaderDragEnd}
        >
          <div className="min-w-0">
            <div className="text-sm font-semibold">{t('workbench.commandHistory.title')}</div>
            <div className="truncate text-xs text-muted-foreground">
              {t('workbench.commandHistory.subtitle')}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={handleClear}
                  disabled={entries.length === 0}
                  aria-label={t('workbench.commandHistory.clear')}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('workbench.commandHistory.clear')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={onClose}
                  aria-label={t('common.actions.close')}
                >
                  <X className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('common.actions.close')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="mt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('workbench.commandHistory.searchPlaceholder')}
              className="h-8 pl-7 text-sm"
            />
          </div>

          <div className="mt-2 flex gap-1 pt-1">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                'px-2 py-0.5 text-[11px] rounded transition-colors',
                filter === 'all'
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              {t('workbench.commandHistory.filterAll')}
            </button>
            <button
              onClick={() => setFilter('success')}
              className={cn(
                'px-2 py-0.5 text-[11px] rounded transition-colors',
                filter === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              {t('workbench.commandHistory.filterSuccess')}
            </button>
            <button
              onClick={() => setFilter('failed')}
              className={cn(
                'px-2 py-0.5 text-[11px] rounded transition-colors',
                filter === 'failed'
                  ? 'bg-destructive/10 text-destructive font-medium'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              )}
            >
              {t('workbench.commandHistory.filterFailed')}
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto p-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-[52px] rounded-lg" />
            <Skeleton className="h-[52px] rounded-lg" />
            <Skeleton className="h-[52px] rounded-lg" />
            <Skeleton className="h-[52px] rounded-lg" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4 select-none">
            <div className="rounded-full bg-accent/40 p-4 mb-3 border border-border/20 shrink-0">
              <History className="size-8 text-muted-foreground/60" />
            </div>
            <h3 className="text-sm font-semibold text-foreground/90 mb-1">
              {t('workbench.commandHistory.emptyTitle')}
            </h3>
            <p className="text-xs text-muted-foreground max-w-[200px] leading-normal">
              {t('workbench.commandHistory.emptyDescription')}
            </p>
          </div>
        ) : (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = filtered[virtualRow.index]
              if (!entry) return null
              return (
                <CommandHistoryRow
                  key={entry.id}
                  entry={entry}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                    height: `${virtualRow.size}px`
                  }}
                  onInsert={() => onInsertCommand(entry.command)}
                  onRun={() => onInsertCommand(entry.command + '\r')}
                  onDelete={() => deleteEntry(entry.id)}
                />
              )
            })}
          </div>
)}
       </div>
      </div>

      <Dialog open={showClearDialog} onOpenChange={(open) => !open && setShowClearDialog(false)}>
        <DialogContent
          className="max-w-md rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl"
          showCloseButton={false}
        >
          <DialogHeader className="border-b border-[var(--workbench-border)] px-4 py-4">
            <DialogTitle>{t('workbench.commandHistory.clearDialog.title')}</DialogTitle>
            <DialogDescription>
              {t('workbench.commandHistory.clearDialog.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-[var(--workbench-border)] px-4 py-3">
            <Button variant="ghost" disabled={isClearing} onClick={() => setShowClearDialog(false)}>
              <X className="size-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button variant="destructive" disabled={isClearing} onClick={() => void handleConfirmClear()}>
              {isClearing ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {t('workbench.commandHistory.clear')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface CommandHistoryRowProps {
  entry: CommandHistoryEntry
  style: React.CSSProperties
  onInsert: () => void
  onRun: () => void
  onDelete: () => void
}

function CommandHistoryRow({ entry, style, onInsert, onRun, onDelete }: CommandHistoryRowProps) {
  const { t } = useTranslation()
  const timestamp = formatExecutedAt(entry.executedAt)

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(entry.command)
    } catch (err) {
      console.error('Failed to copy', err)
    }
  }

  return (
    <div style={style} className="py-1">
      <div
        className="group relative flex flex-col justify-center rounded-md border border-border/50 px-3 py-2.5 hover:bg-accent/40 cursor-pointer select-none transition-all duration-150"
        onDoubleClick={onInsert}
        title={t('workbench.commandHistory.reRun')}
      >
        <div className="pr-16 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <code className="block truncate font-mono text-[11px] text-foreground/90 font-medium leading-normal">
                {entry.command}
              </code>
            </TooltipTrigger>
            <TooltipContent className="max-w-md font-mono text-xs whitespace-pre-wrap break-all bg-popover text-popover-foreground border shadow-md">
              {entry.command}
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground min-w-0 leading-none">
          <div className="flex items-center gap-2 min-w-0 overflow-hidden">
            <span className="font-mono text-[9px]">{timestamp.full}</span>

            {entry.cwd && (
              <span className="flex items-center gap-0.5 min-w-0 max-w-[120px] truncate" title={entry.cwd}>
                <Folder className="size-3 shrink-0" />
                <span className="truncate">{entry.cwd}</span>
              </span>
            )}

            {entry.durationMs !== null && entry.durationMs >= 100 && (
              <span className="flex items-center gap-0.5 shrink-0">
                <Clock className="size-3 shrink-0" />
                <span>{formatDuration(entry.durationMs)}</span>
              </span>
            )}
          </div>

          {entry.exitCode !== null && (
            <Badge
              variant={entry.exitCode === 0 ? 'default' : 'destructive'}
              className={cn(
                'h-3.5 px-1 py-0 font-mono text-[9px] leading-none shrink-0 border-none font-medium pointer-events-none rounded',
                entry.exitCode === 0
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-destructive/10 text-destructive'
              )}
            >
              {t('workbench.commandHistory.exitCodeLabel')}:{entry.exitCode}
            </Badge>
          )}
        </div>

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-gradient-to-l from-background/95 via-background/95 to-transparent pl-4 opacity-0 group-hover:opacity-100 transition-opacity duration-150 py-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={(event) => {
                  event.stopPropagation()
                  onInsert()
                }}
              >
                <TerminalSquare className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('workbench.commandHistory.insertIntoTerminal')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={handleCopy}
              >
                <Copy className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('workbench.commandHistory.copyToClipboard')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground hover:bg-accent"
                onClick={(event) => {
                  event.stopPropagation()
                  onRun()
                }}
              >
                <Play className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('workbench.commandHistory.runImmediately')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete()
                }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('workbench.commandHistory.deleteEntry')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60_000)
  const seconds = Math.floor((ms % 60_000) / 1000)
  return `${minutes}m${seconds}s`
}

function formatExecutedAt(iso: string): { label: string; full: string } {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return { label: iso, full: iso }
  }
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  const sameYear = yyyy === new Date().getFullYear()
  const label = sameYear
    ? `${mm}-${dd} ${hh}:${mi}:${ss}`
    : `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  const full = `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
  return { label, full }
}

