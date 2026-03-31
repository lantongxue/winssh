import { useEffect, useRef } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import type { AppSettings } from '@shared/types'

const terminalTheme = {
  background: '#09090b',
  foreground: '#e4e4e7',
  cursor: '#38bdf8',
  selectionBackground: 'rgba(14, 165, 233, 0.24)',
  black: '#09090b',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#f4f4f5',
  brightBlack: '#71717a',
  brightRed: '#fb7185',
  brightGreen: '#86efac',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa'
}

export function useTerminal(sessionId: string | null, settings: AppSettings, enabled = true) {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!enabled || !sessionId || !containerRef.current) {
      return
    }

    const terminal = new Terminal({
      allowTransparency: true,
      convertEol: true,
      cursorBlink: settings.cursorBlink,
      cursorStyle: settings.cursorStyle,
      fontFamily: settings.terminalFontFamily,
      fontSize: settings.terminalFontSize,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: terminalTheme
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
  }, [
    enabled,
    sessionId,
    settings.copyOnSelect,
    settings.cursorBlink,
    settings.cursorStyle,
    settings.terminalFontFamily,
    settings.terminalFontSize
  ])

  return containerRef
}
