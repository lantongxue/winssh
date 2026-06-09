import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { ImageAddon } from '@xterm/addon-image'
import { ProgressAddon } from '@xterm/addon-progress'
import { SearchAddon, type ISearchOptions } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebFontsAddon } from '@xterm/addon-web-fonts'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { WebglAddon } from '@xterm/addon-webgl'
import { Terminal } from '@xterm/xterm'
import { isHighContrastTheme, type ThemeDefinition } from '@shared/themes'
import type { AppSettings } from '@shared/types'
import i18n from '@/i18n'
import {
  canLoadIntegratedFonts,
  getTerminalFontStack,
  loadTerminalFontStack
} from '@/lib/integrated-font-loader'
import { resolveTerminalAppearance } from '@/lib/theme'
import type { TerminalWorkerHostLike } from '@/workers/terminal-worker-types'

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
  write: (data: string) => void
}

export interface TerminalWorkerOptions {
  enabled: boolean
  sessionId: string
  terminalWorkerHost: TerminalWorkerHostLike
  onDegraded?: (sessionId: string, reason: string) => void
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

function parseCssAlpha(alpha: string | undefined) {
  if (!alpha) {
    return 1
  }

  const normalizedAlpha = alpha.trim()

  if (normalizedAlpha.endsWith('%')) {
    const percentAlpha = Number(normalizedAlpha.slice(0, -1))
    return Number.isFinite(percentAlpha) ? percentAlpha / 100 : 1
  }

  const numericAlpha = Number(normalizedAlpha)
  return Number.isFinite(numericAlpha) ? numericAlpha : 1
}

function shouldAllowTerminalTransparency(background: string | undefined) {
  const normalizedBackground = background?.trim().toLowerCase()

  if (!normalizedBackground) {
    return false
  }

  if (normalizedBackground === 'transparent') {
    return true
  }

  const shortHexColor = /^#([0-9a-f]{4})$/u.exec(normalizedBackground)
  if (shortHexColor) {
    return shortHexColor[1]?.[3] !== 'f'
  }

  const longHexColor = /^#([0-9a-f]{8})$/u.exec(normalizedBackground)
  if (longHexColor) {
    return longHexColor[1]?.slice(6) !== 'ff'
  }

  const slashAlphaColor = /^(?:rgb|hsl)a?\([^/]+\/\s*([^)]+)\)$/u.exec(normalizedBackground)
  if (slashAlphaColor) {
    return parseCssAlpha(slashAlphaColor[1]) < 1
  }

  const commaAlphaColor = /^(?:rgb|hsl)a?\((.+)\)$/u.exec(normalizedBackground)
  if (commaAlphaColor) {
    const alpha = commaAlphaColor[1]?.split(',').at(3)
    return parseCssAlpha(alpha) < 1
  }

  return false
}

function enableWebFontLoading(terminal: Terminal) {
  let webFontsAddon: WebFontsAddon | null = null

  try {
    webFontsAddon = new WebFontsAddon(false)
    terminal.loadAddon(webFontsAddon)
  } catch {
    // Font relayout is best-effort; a failure should not prevent the terminal from mounting.
    webFontsAddon?.dispose()
    webFontsAddon = null
  }

  return {
    webFontsAddon,
    dispose: () => {
      webFontsAddon?.dispose()
    }
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
      if (!event.metaKey && !event.ctrlKey) {
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
  onSearchResultsChange?: (state: TerminalSearchResultsState | null) => void,
  active = true,
  focusKey: string | null = null,
  terminalWorkerOptions?: TerminalWorkerOptions,
  fontSizeOverride?: number
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const webFontsAddonRef = useRef<WebFontsAddon | null>(null)
  const selectionDisposableRef = useRef<TerminalDisposable | null>(null)
  const lastSentGeometryRef = useRef<{ cols: number; rows: number } | null>(null)
  const lastActiveRef = useRef(active)
  const [workerDegraded, setWorkerDegraded] = useState(false)
  const workerActive =
    Boolean(
      terminalWorkerOptions?.enabled &&
        terminalWorkerOptions.terminalWorkerHost &&
        terminalWorkerOptions.sessionId
    ) && !workerDegraded
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
      allowTransparency: shouldAllowTerminalTransparency(terminalAppearance.theme.background),
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontFamily: getTerminalFontStack(terminalAppearance.fontId),
      fontSize: fontSizeOverride ?? terminalAppearance.fontSize,
      lineHeight: terminalAppearance.lineHeight,
      minimumContrastRatio: isHighContrastTheme(theme) ? 4.5 : 1,
      theme: { ...terminalAppearance.theme }
    }
  }, [fontSizeOverride, settings, theme])
  const terminalFontId = useMemo(() => {
    if (!theme) {
      return settings.terminalFontId
    }

    return resolveTerminalAppearance(settings, theme).fontId
  }, [settings, theme])
  const readTerminalOptions = useEffectEvent(() => terminalOptions)
  const readTerminalFontId = useEffectEvent(() => terminalFontId)
  const focusTerminal = useEffectEvent(() => {
    const terminal = terminalRef.current

    if (!active || !enabled || !terminal) {
      return
    }

    terminal.focus()
  })
  const syncGeometry = useEffectEvent(() => {
    const container = containerRef.current
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current

    if (!active || !transport || !container || !terminal || !fitAddon) {
      return
    }

    if (container.clientWidth <= 0 || container.clientHeight <= 0) {
      return
    }

    fitAddon.fit()

    const nextGeometry = {
      cols: terminal.cols,
      rows: terminal.rows
    }

    if (
      lastSentGeometryRef.current?.cols === nextGeometry.cols &&
      lastSentGeometryRef.current?.rows === nextGeometry.rows
    ) {
      return
    }

    lastSentGeometryRef.current = nextGeometry
    void transport.resize(nextGeometry.cols, nextGeometry.rows)
  })
  const relayoutWebFonts = useEffectEvent(
    (terminal: Terminal, webFontsAddon: WebFontsAddon | null) => {
      const refreshTerminal = () => {
        if (terminalRef.current !== terminal) {
          return
        }

        terminal.clearTextureAtlas?.()
        terminal.refresh?.(0, terminal.rows - 1)
        syncGeometry()
      }

      if (!webFontsAddon) {
        refreshTerminal()
        return
      }

      void webFontsAddon
        .relayout()
        .catch(() => undefined)
        .finally(refreshTerminal)
    }
  )

  useEffect(() => {
    if (!enabled || !workerActive || !containerRef.current || !terminalWorkerOptions) {
      return
    }

    let disposed = false
    const host = terminalWorkerOptions.terminalWorkerHost
    const sessionId = terminalWorkerOptions.sessionId

    void host
      .attach({ sessionId, container: containerRef.current })
      .catch(() => {
        if (disposed) {
          return
        }
        setWorkerDegraded(true)
        terminalWorkerOptions.onDegraded?.(sessionId, 'worker_init_failed')
      })

    return () => {
      disposed = true
      host.detach()
    }
  }, [enabled, terminalWorkerOptions, workerActive])

  useEffect(() => {
    const initialTerminalOptions = readTerminalOptions()
    const initialTerminalFontId = readTerminalFontId()
    let disposed = false
    let cleanup: (() => void) | null = null

    if (
      !enabled ||
      workerActive ||
      !transport ||
      !containerRef.current ||
      !initialTerminalOptions
    ) {
      return
    }

    const mountTerminal = () => {
      if (disposed || !containerRef.current) {
        return
      }

      const container = containerRef.current
      const shouldFocusOnMount = active && focusKey === null
      const terminal = new Terminal({
        allowProposedApi: true,
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
      const { webFontsAddon, dispose: disposeWebFontsAddon } = enableWebFontLoading(terminal)
      webFontsAddonRef.current = webFontsAddon
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

      const writeDisposable = terminal.onData((data) => {
        transport.write(data)
      })

      const unsubscribeData = transport.onData((data) => {
        terminal.write(data)
      })

      const resizeObserver = new ResizeObserver(() => {
        syncGeometry()
      })
      resizeObserver.observe(container)
      queueMicrotask(() => {
        syncGeometry()

        if (shouldFocusOnMount) {
          focusTerminal()
        }
      })

      cleanup = () => {
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
        disposeWebFontsAddon()
        disposeImageAddon()
        disposeProgressAddon()
        terminal.dispose()
        lastSentGeometryRef.current = null
        if (terminalRef.current === terminal) {
          terminalRef.current = null
        }
        if (fitAddonRef.current === fitAddon) {
          fitAddonRef.current = null
        }
        if (searchAddonRef.current === searchAddon) {
          searchAddonRef.current = null
        }
        if (webFontsAddonRef.current === webFontsAddon) {
          webFontsAddonRef.current = null
        }
      }
    }

    if (canLoadIntegratedFonts()) {
      void loadTerminalFontStack(initialTerminalFontId).then(mountTerminal)
    } else {
      mountTerminal()
    }

    return () => {
      disposed = true
      cleanup?.()
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

    let cancelled = false
    const applyTerminalOptions = () => {
      if (cancelled || terminalRef.current !== terminal) {
        return
      }

      terminal.options = terminalOptions
      relayoutWebFonts(terminal, webFontsAddonRef.current)
    }

    if (canLoadIntegratedFonts()) {
      void loadTerminalFontStack(terminalFontId).then(applyTerminalOptions)
    } else {
      applyTerminalOptions()
    }

    return () => {
      cancelled = true
    }
  }, [terminalFontId, terminalOptions])

  useEffect(() => {
    if (active && !lastActiveRef.current) {
      if (workerActive) {
        terminalWorkerOptions?.terminalWorkerHost.focus()
      } else {
        syncGeometry()
        focusTerminal()
      }
    }

    lastActiveRef.current = active
  }, [active, workerActive, terminalWorkerOptions])

  useEffect(() => {
    if (focusKey === null) {
      return
    }

    if (workerActive) {
      terminalWorkerOptions?.terminalWorkerHost.focus()
      return
    }

    focusTerminal()
  }, [focusKey, workerActive, terminalWorkerOptions])

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
    focus: () => focusTerminal(),
    search: searchController
  }
}
