import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThemeDefinition } from '@shared/themes'
import type { AppSettings } from '@shared/types'
import i18n from '@/i18n'
import type { SessionTab } from '@/store/sessions-store'
import { TerminalPane } from '@/components/terminal-pane'

vi.mock('@/hooks/use-terminal', () => ({
  useTerminal: vi.fn(() => ({ current: null }))
}))

describe('TerminalPane', () => {
  const settings: AppSettings = {
    copyOnSelect: false,
    cursorBlink: true,
    cursorStyle: 'block',
    language: 'en-US',
    terminalFontFamily: 'Consolas',
    terminalFontSize: 14,
    theme: 'system',
    windowTitleBarStyle: 'custom'
  }

  const theme = createThemeDefinition({
    appearance: 'dark',
    id: 'test.dark',
    label: 'Dark',
    pluginDisplayName: 'Tests',
    pluginId: 'tests',
    source: 'builtin',
    version: '0.1.0'
  })

  const session: SessionTab = {
    connectedAt: new Date().toISOString(),
    connectionPhase: 'handshake',
    connectionStartedAt: new Date().toISOString(),
    currentPath: '/',
    host: '127.0.0.1',
    port: 22,
    serverId: 'server-1',
    serverName: 'alpha',
    sessionId: 'session-1',
    status: 'connecting'
  }

  beforeEach(async () => {
    await i18n.changeLanguage('en-US')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('only advances the visible phase after the reported connection phase moves forward', () => {
    vi.useFakeTimers()

    const { rerender } = render(
      <TerminalPane
        session={session}
        settings={settings}
        theme={theme}
        onReconnect={async () => undefined}
      />
    )

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50')

    act(() => {
      vi.advanceTimersByTime(5_000)
    })

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50')

    rerender(
      <TerminalPane
        session={{ ...session, connectionPhase: 'attach' }}
        settings={settings}
        theme={theme}
        onReconnect={async () => undefined}
      />
    )

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50')

    act(() => {
      vi.advanceTimersByTime(220)
    })

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('75')

    act(() => {
      vi.advanceTimersByTime(220)
    })

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
  })

  it('replays skipped phases before showing the completed state when a connection finishes too fast', () => {
    vi.useFakeTimers()
    const fastSession: SessionTab = {
      ...session,
      connectionPhase: 'validate'
    }

    const { rerender } = render(
      <TerminalPane
        session={fastSession}
        settings={settings}
        theme={theme}
        onReconnect={async () => undefined}
      />
    )

    rerender(
      <TerminalPane
        session={{ ...fastSession, connectionPhase: 'attach', status: 'ready' }}
        settings={settings}
        theme={theme}
        onReconnect={async () => undefined}
      />
    )

    expect(screen.getByText('Connecting to alpha')).toBeInTheDocument()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('25')

    act(() => {
      vi.advanceTimersByTime(220)
    })

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50')

    act(() => {
      vi.advanceTimersByTime(220)
    })

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('75')

    act(() => {
      vi.advanceTimersByTime(220)
    })

    expect(screen.getByText('Connected to alpha')).toBeInTheDocument()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')

    act(() => {
      vi.advanceTimersByTime(620)
    })

    expect(screen.queryByText('Connected to alpha')).not.toBeInTheDocument()
  })

  it('keeps terminal padding off the xterm mount node so fit calculations stay accurate', () => {
    const readySession: SessionTab = {
      ...session,
      connectionPhase: 'attach',
      status: 'ready'
    }

    const { container } = render(
      <TerminalPane
        session={readySession}
        settings={settings}
        theme={theme}
        onReconnect={async () => undefined}
      />
    )

    const surface = container.querySelector('.terminal-surface')
    expect(surface).toBeTruthy()
    expect(surface?.className).toContain('p-2')

    const terminalMount = surface?.firstElementChild
    expect(terminalMount).toBeTruthy()
    expect(terminalMount?.className).not.toContain('p-2')
  })
})
