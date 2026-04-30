import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode
} from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { isHighContrastTheme, type ThemeDefinition } from '@shared/themes'
import type { AppSettings } from '@shared/types'
import {
  useTerminal,
  type TerminalLinkTooltipState,
  type TerminalSearchResultsState,
  type TerminalTransport
} from '@/hooks/use-terminal'
import { getTerminalFontStack } from '@/lib/integrated-font-loader'
import { hasTerminalPathDragData, readTerminalPathDragData } from '@/lib/terminal-path-dnd'
import { resolveTerminalAppearance } from '@/lib/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface TerminalSurfaceProps {
  transport: TerminalTransport | null
  settings: AppSettings
  theme: ThemeDefinition | null
  enabled?: boolean
  active?: boolean
  focusKey?: string | null
  children?: ReactNode
}

export function TerminalSurface({
  transport,
  settings,
  theme,
  enabled = true,
  active = true,
  focusKey = null,
  children
}: TerminalSurfaceProps) {
  const { t } = useTranslation()
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [linkTooltip, setLinkTooltip] = useState<TerminalLinkTooltipState | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<TerminalSearchResultsState | null>(null)
  const [draggedPath, setDraggedPath] = useState<string | null>(null)
  const [isPathDropActive, setIsPathDropActive] = useState(false)
  const {
    containerRef: terminalRef,
    search,
    focus: focusTerminal = () => undefined
  } = useTerminal(
    transport,
    settings,
    theme,
    enabled,
    setLinkTooltip,
    setSearchResults,
    active,
    focusKey
  )
  const searchResultSummary =
    searchQuery.length === 0
      ? t('workbench.terminal.search.shortcut')
      : (searchResults?.resultCount ?? 0) > 0
        ? t('workbench.terminal.search.results', {
            current: Math.max((searchResults?.resultIndex ?? 0) + 1, 1),
            total: searchResults?.resultCount ?? 0
          })
        : t('workbench.terminal.search.noMatches')
  const surfaceStyle = useMemo<CSSProperties | undefined>(() => {
    if (!theme) {
      return undefined
    }

    const terminalAppearance = resolveTerminalAppearance(settings, theme)
    const highContrast = isHighContrastTheme(theme)

    if (highContrast) {
      return {
        '--terminal-drop-border': theme.terminal.cursor,
        '--terminal-drop-glow': 'none',
        '--terminal-drop-muted': theme.colors['workbench-muted'],
        '--terminal-drop-panel': theme.terminal.background,
        '--terminal-drop-surface': theme.terminal.background,
        '--terminal-font-family': getTerminalFontStack(terminalAppearance.fontId),
        '--terminal-drop-text': theme.terminal.foreground,
        backgroundColor: theme.terminal.background
      } as CSSProperties
    }

    return {
      '--terminal-drop-border': `color-mix(in srgb, ${theme.terminal.cursor} 70%, ${theme.terminal.foreground} 30%)`,
      '--terminal-drop-glow': `0 0 0 1px color-mix(in srgb, ${theme.terminal.selectionBackground} 72%, transparent), 0 22px 54px color-mix(in srgb, ${theme.terminal.cursor} 18%, transparent)`,
      '--terminal-drop-muted': `color-mix(in srgb, ${theme.terminal.foreground} 72%, ${theme.colors['workbench-muted']} 28%)`,
      '--terminal-drop-panel': `color-mix(in srgb, ${theme.terminal.background} 86%, ${theme.colors['workbench-editor']} 14%)`,
      '--terminal-drop-surface': `color-mix(in srgb, ${theme.terminal.background} 76%, transparent)`,
      '--terminal-font-family': getTerminalFontStack(terminalAppearance.fontId),
      '--terminal-drop-text': theme.terminal.foreground,
      backgroundColor: theme.terminal.background
    } as CSSProperties
  }, [settings, theme])

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults(null)
    search.clear()
  }

  const resetPathDropState = () => {
    setIsPathDropActive(false)
    setDraggedPath(null)
  }

  const openSearch = () => {
    setSearchOpen(true)
  }

  useEffect(() => {
    if (!searchOpen) {
      return
    }

    const focusFrame = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    })

    return () => {
      window.cancelAnimationFrame(focusFrame)
    }
  }, [searchOpen])

  useEffect(() => {
    if (!searchOpen) {
      return
    }

    if (searchQuery.length === 0) {
      search.clear()
      setSearchResults(null)
      return
    }

    search.findNext(searchQuery, { incremental: true })
  }, [search, searchOpen, searchQuery])

  useEffect(() => {
    return () => {
      search.clear()
    }
  }, [search])

  useEffect(() => {
    if (enabled && transport) {
      return
    }

    resetPathDropState()
  }, [enabled, transport])

  const handlePaneKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const isSearchShortcut =
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'f'

    if (isSearchShortcut) {
      event.preventDefault()
      event.stopPropagation()
      openSearch()
      return
    }

    if (searchOpen && event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeSearch()
    }
  }

  const handleSearchInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()

      if (searchQuery.length === 0) {
        return
      }

      if (event.shiftKey) {
        search.findPrevious(searchQuery)
        return
      }

      search.findNext(searchQuery)
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      closeSearch()
    }
  }

  const handleTerminalPathDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!transport || !enabled || !hasTerminalPathDragData(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDraggedPath(readTerminalPathDragData(event.dataTransfer))
    setIsPathDropActive(true)
  }

  const handleTerminalPathDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!hasTerminalPathDragData(event.dataTransfer)) {
      return
    }

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }

    resetPathDropState()
  }

  const handleTerminalPathDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!transport || !enabled || !hasTerminalPathDragData(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    const droppedPath = readTerminalPathDragData(event.dataTransfer)
    resetPathDropState()

    if (!droppedPath) {
      return
    }

    void transport
      .write(droppedPath)
      .then(focusTerminal)
      .catch(() => {
        resetPathDropState()
      })
  }

  return (
    <div
      className="relative h-full p-2 terminal-surface"
      style={surfaceStyle}
      onDragLeave={handleTerminalPathDragLeave}
      onDragOver={handleTerminalPathDragOver}
      onDrop={handleTerminalPathDrop}
      onKeyDownCapture={handlePaneKeyDownCapture}
    >
      <div ref={terminalRef} className="h-full w-full overflow-hidden" />
      {isPathDropActive ? (
        <div
          className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-[var(--workbench-panel-frame-radius)] border border-dashed px-6 py-5 text-center backdrop-blur-sm"
          style={{
            background:
              'linear-gradient(180deg, color-mix(in srgb, var(--terminal-drop-surface) 94%, transparent), color-mix(in srgb, var(--terminal-drop-panel) 92%, transparent))',
            borderColor: 'var(--terminal-drop-border)',
            boxShadow: 'var(--terminal-drop-glow)'
          }}
        >
          <div className="max-w-lg space-y-1">
            <div className="text-sm font-semibold" style={{ color: 'var(--terminal-drop-text)' }}>
              {t('workbench.terminal.dropPath.title')}
            </div>
            <div
              className="font-mono text-xs leading-5 [overflow-wrap:anywhere]"
              style={{ color: 'var(--terminal-drop-muted)' }}
            >
              {draggedPath ?? t('workbench.terminal.dropPath.fallback')}
            </div>
          </div>
        </div>
      ) : null}
      {searchOpen ? (
        <div className="absolute right-4 top-4 z-20 w-[min(26rem,calc(100%-2rem))]">
          <div className="terminal-search-overlay flex items-center gap-1.5 rounded-lg border border-[var(--workbench-border)] bg-[color-mix(in_srgb,var(--workbench-editor)_88%,transparent)] px-2 py-2 shadow-lg backdrop-blur-sm">
            <Search className="size-4 shrink-0 text-[var(--workbench-muted)]" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onBlur={() => search.clearActiveDecoration()}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={handleSearchInputKeyDown}
              aria-label={t('workbench.terminal.search.label')}
              placeholder={t('workbench.terminal.search.placeholder')}
              className="h-8 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
            <span className="min-w-14 text-right text-[11px] text-[var(--workbench-muted)]">
              {searchResultSummary}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => search.findPrevious(searchQuery)}
              aria-label={t('workbench.terminal.search.previous')}
              disabled={searchQuery.length === 0}
            >
              <ChevronUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => search.findNext(searchQuery)}
              aria-label={t('workbench.terminal.search.next')}
              disabled={searchQuery.length === 0}
            >
              <ChevronDown className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={closeSearch}
              aria-label={t('workbench.terminal.search.close')}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
      <TooltipProvider delayDuration={0}>
        <Tooltip open={Boolean(linkTooltip?.open)}>
          <TooltipTrigger asChild>
            <span
              aria-hidden
              className="pointer-events-none absolute size-0"
              style={{
                left: `${linkTooltip?.x ?? 0}px`,
                top: `${linkTooltip?.y ?? 0}px`
              }}
            />
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={10}>
            {linkTooltip?.text}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {children}
    </div>
  )
}
