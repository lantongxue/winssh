import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CommandHistoryEntry, CommandHistoryScope } from '@shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useCommandHistory } from '@/features/command-history/hooks/use-command-history'

const ROW_HEIGHT = 78

interface CommandHistoryPanelProps {
  scope: CommandHistoryScope
  onInsertCommand: (text: string) => void
  className?: string
  onHeaderDragStart?: (event: React.DragEvent<HTMLDivElement>) => void
  onHeaderDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void
}

export function CommandHistoryPanel({
  scope,
  onInsertCommand,
  className,
  onHeaderDragStart,
  onHeaderDragEnd
}: CommandHistoryPanelProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const { entries, isLoading, clear, deleteEntry } = useCommandHistory(scope)

  const filtered = useMemo(() => {
    if (!query.trim()) return entries
    const needle = query.trim().toLowerCase()
    return entries.filter((entry) => entry.command.toLowerCase().includes(needle))
  }, [entries, query])

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => filtered[index]?.id ?? index
  })

  const handleClear = async () => {
    if (entries.length === 0) return
    const confirmed = window.confirm(t('workbench.commandHistory.clearConfirm'))
    if (!confirmed) return
    await clear()
  }

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      <div
        draggable={!!onHeaderDragStart}
        className={cn(
          'flex items-center justify-between border-b px-3 py-2',
          onHeaderDragStart && 'cursor-grab active:cursor-grabbing'
        )}
        onDragStart={onHeaderDragStart}
        onDragEnd={onHeaderDragEnd}
      >
        <span className="text-sm font-medium">{t('workbench.commandHistory.title')}</span>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleClear}
          disabled={entries.length === 0}
          title={t('workbench.commandHistory.clear')}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('workbench.commandHistory.searchPlaceholder')}
            className="h-8 pl-7 text-sm"
          />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto">
        {isLoading ? null : filtered.length === 0 ? (
          <div className="text-muted-foreground flex h-full items-center justify-center text-xs">
            {t('workbench.commandHistory.empty')}
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
                  onDelete={() => deleteEntry(entry.id)}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface CommandHistoryRowProps {
  entry: CommandHistoryEntry
  style: React.CSSProperties
  onInsert: () => void
  onDelete: () => void
}

function CommandHistoryRow({ entry, style, onInsert, onDelete }: CommandHistoryRowProps) {
  const { t } = useTranslation()
  const timestamp = formatExecutedAt(entry.executedAt)
  const exitBadgeColor = exitCodeColor(entry.exitCode)
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onInsert()
    }
  }

  return (
    <div
      style={style}
      className="group hover:bg-accent/40 flex cursor-pointer flex-col gap-1 px-3 py-2"
      role="button"
      tabIndex={0}
      onClick={onInsert}
      onKeyDown={handleKeyDown}
      title={t('workbench.commandHistory.reRun')}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-muted-foreground font-mono text-[11px]"
        >
          {timestamp.full}
        </span>
        <div className="flex items-center gap-1">
          {entry.exitCode !== null && (
            <span className={cn('rounded px-1.5 py-0.5 font-mono text-[10px]', exitBadgeColor)}>
              {t('workbench.commandHistory.exitCodeLabel')}:{entry.exitCode}
            </span>
          )}
          {entry.durationMs !== null && entry.durationMs >= 100 && (
            <span className="text-muted-foreground text-[10px]">
              {formatDuration(entry.durationMs)}
            </span>
          )}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
            title={t('workbench.commandHistory.deleteEntry')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <code className="block truncate font-mono text-xs">{entry.command}</code>
      {entry.cwd && (
        <span className="text-muted-foreground truncate text-[10px]">
          {t('workbench.commandHistory.cwdLabel')}: {entry.cwd}
        </span>
      )}
    </div>
  )
}

function exitCodeColor(code: number | null): string {
  if (code === null) return 'bg-muted text-muted-foreground'
  if (code === 0) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
  return 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
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
