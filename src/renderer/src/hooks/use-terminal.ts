import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import type { AppSettings } from '@shared/types'
import { resolveTerminalAppearance } from '@/lib/theme'

export function useTerminal(sessionId: string | null, settings: AppSettings, enabled = true) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!enabled || !sessionId || !containerRef.current) {
      return
    }

    const terminalAppearance = resolveTerminalAppearance(settings)
    const terminal = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontFamily: terminalAppearance.fontFamily,
      fontSize: terminalAppearance.fontSize,
      lineHeight: terminalAppearance.lineHeight,
      scrollback: 5000,
      theme: terminalAppearance.theme
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()

    const resize = () => {
      fitAddon.fit()
      void window.winsshApi.sessions.resize(sessionId, terminal.cols, terminal.rows)
    }

    const writeDisposable = terminal.onData((data) => {
      void window.winsshApi.sessions.write(sessionId, data)
    })

    const selectionDisposable = settings.copyOnSelect
      ? terminal.onSelectionChange(() => {
          const selection = terminal.getSelection()
          if (selection) {
            navigator.clipboard.writeText(selection).catch(() => undefined)
          }
        })
      : null

    const unsubscribeData = window.winsshApi.sessions.onData((event) => {
      if (event.sessionId === sessionId) {
        terminal.write(event.data)
      }
    })

    const resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(containerRef.current)
    queueMicrotask(resize)

    return () => {
      resizeObserver.disconnect()
      unsubscribeData()
      selectionDisposable?.dispose()
      writeDisposable.dispose()
      terminal.dispose()
    }
  }, [enabled, sessionId, settings])

  return containerRef
}
