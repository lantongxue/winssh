import { useEffect, useEffectEvent, useMemo, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import type { ThemeDefinition } from '@shared/themes'
import type { AppSettings } from '@shared/types'
import { resolveTerminalAppearance } from '@/lib/theme'

export function useTerminal(
  sessionId: string | null,
  settings: AppSettings,
  theme: ThemeDefinition | null,
  enabled = true
) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const selectionDisposableRef = useRef<{ dispose: () => void } | null>(null)
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

    if (!enabled || !sessionId || !containerRef.current || !initialTerminalOptions) {
      return
    }

    const container = containerRef.current
    const terminal = new Terminal({
      allowTransparency: true,
      convertEol: true,
      scrollback: 5000,
      ...initialTerminalOptions
    })

    const fitAddon = new FitAddon()
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    terminal.loadAddon(fitAddon)
    terminal.open(container)
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
      void window.winsshApi.sessions.resize(sessionId, terminal.cols, terminal.rows)
    }

    const writeDisposable = terminal.onData((data) => {
      void window.winsshApi.sessions.write(sessionId, data)
    })

    const unsubscribeData = window.winsshApi.sessions.onData((event) => {
      if (event.sessionId === sessionId) {
        terminal.write(event.data)
      }
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
      terminal.dispose()
      if (terminalRef.current === terminal) {
        terminalRef.current = null
      }
      if (fitAddonRef.current === fitAddon) {
        fitAddonRef.current = null
      }
    }
  }, [enabled, hasTheme, sessionId])

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
  }, [enabled, hasTheme, sessionId, settings.copyOnSelect])

  return containerRef
}
