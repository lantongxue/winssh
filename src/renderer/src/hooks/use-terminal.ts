import { useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { ImageAddon } from '@xterm/addon-image'
import { ProgressAddon } from '@xterm/addon-progress'
import { SearchAddon, type ISearchOptions } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import type { ThemeDefinition } from '@shared/themes'
import type { AppSettings } from '@shared/types'
import i18n from '@/i18n'
import { resolveTerminalAppearance } from '@/lib/theme'

type TerminalDisposable = { dispose: () => void }
type Unsubscribe = () => void

export interface TerminalLinkTooltipState {
  open: boolean
  text: string
  x: number
  y: number
}

export interface TerminalSearchResultsState {
  resultCount: number
  resultIndex: number
}

export interface TerminalSearchController {
  clear: () => void
  clearActiveDecoration: () => void
  findNext: (term: string, searchOptions?: ISearchOptions) => boolean
  findPrevious: (term: string, searchOptions?: ISearchOptions) => boolean
}

export interface TerminalTransport {
  onData: (callback: (data: string) => void) => Unsubscribe
  resize: (columns: number, rows: number) => Promise<void>
  write: (data: string) => Promise<void>
}

function enableExperimentalWebglRenderer(terminal: Terminal) {
  let webglAddon: WebglAddon | null = null
  let contextLossDisposable: TerminalDisposable | null = null

  try {
    webglAddon = new WebglAddon()
    contextLossDisposable = webglAddon.onContextLoss(() => {
      webglAddon?.dispose()
      webglAddon = null
      contextLossDisposable?.dispose()
      contextLossDisposable = null
    })
    terminal.loadAddon(webglAddon)
  } catch {
    // WebGL is experimental, so unsupported environments quietly keep the default renderer.
    contextLossDisposable?.dispose()
    webglAddon?.dispose()
  }

  return () => {
    contextLossDisposable?.dispose()
    webglAddon?.dispose()
  }
}

function enableOscProgressTracking(terminal: Terminal) {
  const progressAddon = new ProgressAddon()
  terminal.loadAddon(progressAddon)

  return () => {
    progressAddon.dispose()
  }
}

function enableInlineImageRendering(terminal: Terminal) {
  const imageAddon = new ImageAddon()
  terminal.loadAddon(imageAddon)

  return () => {
    imageAddon.dispose()
  }
}

function enableTerminalSearch(
  terminal: Terminal,
  onSearchResultsChange?: (state: TerminalSearchResultsState | null) => void
) {
  const searchAddon = new SearchAddon()
  const searchResultsDisposable = onSearchResultsChange
    ? searchAddon.onDidChangeResults((event) => {
        onSearchResultsChange({
          resultCount: event.resultCount,
          resultIndex: event.resultIndex
        })
      })
    : null
  terminal.loadAddon(searchAddon)

  return {
    searchAddon,
    dispose: () => {
      onSearchResultsChange?.(null)
      searchResultsDisposable?.dispose()
      searchAddon.dispose()
    }
  }
}

function enableWebLinks(
  terminal: Terminal,
  container: HTMLDivElement,
  onLinkTooltipChange?: (state: TerminalLinkTooltipState | null) => void
) {
  const hint = i18n.t('workbench.terminal.linkHint')
  const webLinksAddon = new WebLinksAddon(
    (event, uri) => {
      event.preventDefault()
      if (!event.metaKey) {
        return
      }
      window.open(uri, '_blank', 'noopener,noreferrer')
    },
    {
      hover: (event) => {
        const bounds = container.getBoundingClientRect()
        onLinkTooltipChange?.({
          open: true,
          text: hint,
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top
        })
      },
      leave: () => {
        onLinkTooltipChange?.(null)
      }
    }
  )
  terminal.loadAddon(webLinksAddon)

  return () => {
    onLinkTooltipChange?.(null)
    webLinksAddon.dispose()
  }
}

function enableUnicode11Support(terminal: Terminal) {
  const unicode11Addon = new Unicode11Addon()
  terminal.loadAddon(unicode11Addon)
  terminal.unicode.activeVersion = '11'

  return () => {
    unicode11Addon.dispose()
  }
}

export function useTerminal(
  transport: TerminalTransport | null,
  settings: AppSettings,
  theme: ThemeDefinition | null,
  enabled = true,
  onLinkTooltipChange?: (state: TerminalLinkTooltipState | null) => void,
  onSearchResultsChange?: (state: TerminalSearchResultsState | null) => void
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const selectionDisposableRef = useRef<TerminalDisposable | null>(null)
  const searchController = useMemo<TerminalSearchController>(
    () => ({
      clear: () => {
        searchAddonRef.current?.clearDecorations()
      },
      clearActiveDecoration: () => {
        searchAddonRef.current?.clearActiveDecoration()
      },
      findNext: (term, searchOptions) => {
        if (!term) {
          searchAddonRef.current?.clearDecorations()
          return false
        }

        return searchAddonRef.current?.findNext(term, searchOptions) ?? false
      },
      findPrevious: (term, searchOptions) => {
        if (!term) {
          searchAddonRef.current?.clearDecorations()
          return false
        }

        return searchAddonRef.current?.findPrevious(term, searchOptions) ?? false
      }
    }),
    []
  )
  const hasTheme = Boolean(theme)
  const terminalOptions = useMemo(() => {
    if (!theme) {
      return null
    }

    const terminalAppearance = resolveTerminalAppearance(settings, theme)

    return {
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontFamily: terminalAppearance.fontFamily,
      fontSize: terminalAppearance.fontSize,
      lineHeight: terminalAppearance.lineHeight,
      theme: { ...terminalAppearance.theme }
    }
  }, [settings, theme])
  const readTerminalOptions = useEffectEvent(() => terminalOptions)

  useEffect(() => {
    const initialTerminalOptions = readTerminalOptions()

    if (!enabled || !transport || !containerRef.current || !initialTerminalOptions) {
      return
    }

    const container = containerRef.current
    const terminal = new Terminal({
      allowProposedApi: true,
      allowTransparency: true,
      convertEol: true,
      scrollback: 5000,
      ...initialTerminalOptions
    })

    const fitAddon = new FitAddon()
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    terminal.loadAddon(fitAddon)
    const disposeProgressAddon = enableOscProgressTracking(terminal)
    const disposeImageAddon = enableInlineImageRendering(terminal)
    const { searchAddon, dispose: disposeSearchAddon } = enableTerminalSearch(
      terminal,
      onSearchResultsChange
    )
    searchAddonRef.current = searchAddon
    const disposeWebLinksAddon = enableWebLinks(terminal, container, onLinkTooltipChange)
    const disposeUnicode11Addon = enableUnicode11Support(terminal)
    terminal.open(container)
    const disposeWebglRenderer = settings.experimentalTerminalWebgl
      ? enableExperimentalWebglRenderer(terminal)
      : () => undefined
    fitAddon.fit()

    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()

      void (async () => {
        const selection = terminal.getSelection()

        if (selection) {
          try {
            await navigator.clipboard.writeText(selection)
            terminal.clearSelection()
          } catch {
            // Ignore clipboard permission/runtime failures and keep terminal input usable.
          } finally {
            terminal.focus()
          }
          return
        }

        try {
          const clipboardText = await navigator.clipboard.readText()
          if (clipboardText) {
            terminal.paste(clipboardText)
          }
        } catch {
          // Ignore clipboard permission/runtime failures and keep terminal input usable.
        } finally {
          terminal.focus()
        }
      })()
    }

    container.addEventListener('contextmenu', handleContextMenu, true)

    const resize = () => {
      fitAddon.fit()
      void transport.resize(terminal.cols, terminal.rows)
    }

    const writeDisposable = terminal.onData((data) => {
      void transport.write(data)
    })

    const unsubscribeData = transport.onData((data) => {
      terminal.write(data)
    })

    const resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(container)
    queueMicrotask(resize)

    return () => {
      resizeObserver.disconnect()
      container.removeEventListener('contextmenu', handleContextMenu, true)
      unsubscribeData()
      selectionDisposableRef.current?.dispose()
      selectionDisposableRef.current = null
      writeDisposable.dispose()
      disposeWebglRenderer()
      disposeUnicode11Addon()
      disposeWebLinksAddon()
      disposeSearchAddon()
      disposeImageAddon()
      disposeProgressAddon()
      terminal.dispose()
      if (terminalRef.current === terminal) {
        terminalRef.current = null
      }
      if (fitAddonRef.current === fitAddon) {
        fitAddonRef.current = null
      }
      if (searchAddonRef.current === searchAddon) {
        searchAddonRef.current = null
      }
    }
  }, [
    enabled,
    hasTheme,
    onLinkTooltipChange,
    onSearchResultsChange,
    settings.experimentalTerminalWebgl,
    transport
  ])

  useEffect(() => {
    if (!terminalOptions) {
      return
    }

    const terminal = terminalRef.current

    if (!terminal) {
      return
    }

    terminal.options = terminalOptions

    fitAddonRef.current?.fit()
  }, [terminalOptions])

  useEffect(() => {
    const terminal = terminalRef.current

    if (!terminal) {
      return
    }

    selectionDisposableRef.current?.dispose()
    selectionDisposableRef.current = null

    if (!settings.copyOnSelect) {
      return
    }

    selectionDisposableRef.current = terminal.onSelectionChange(() => {
      const selection = terminal.getSelection()
      if (selection) {
        navigator.clipboard.writeText(selection).catch(() => undefined)
      }
    })

    return () => {
      selectionDisposableRef.current?.dispose()
      selectionDisposableRef.current = null
    }
  }, [enabled, hasTheme, settings.copyOnSelect, transport])

  return {
    containerRef,
    search: searchController
  }
}
