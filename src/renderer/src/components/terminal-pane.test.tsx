import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createThemeDefinition } from '@shared/themes'
import type { AppSettings } from '@shared/types'
import i18n from '@/i18n'
import type { SessionTab } from '@/store/sessions-store'
import { TerminalPane } from '@/components/terminal-pane'

const { searchControllerMock, useTerminalMock } = vi.hoisted(() => ({
  searchControllerMock: {
    clear: vi.fn(),
    clearActiveDecoration: vi.fn(),
    findNext: vi.fn(() => true),
    findPrevious: vi.fn(() => true)
  },
  useTerminalMock: vi.fn()
}))

vi.mock('@/hooks/use-terminal', () => ({
  useTerminal: useTerminalMock
}))

describe('TerminalPane', () => {
  const settings: AppSettings = {
    copyOnSelect: false,
    cursorBlink: true,
    cursorStyle: 'block',
    experimentalTerminalWebgl: false,
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
    searchControllerMock.clear.mockReset()
    searchControllerMock.clearActiveDecoration.mockReset()
    searchControllerMock.findNext.mockReset()
    searchControllerMock.findNext.mockReturnValue(true)
    searchControllerMock.findPrevious.mockReset()
    searchControllerMock.findPrevious.mockReturnValue(true)
    useTerminalMock.mockReset()
    useTerminalMock.mockReturnValue({
      containerRef: { current: null },
      search: searchControllerMock
    })
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

  it('opens the terminal search panel with ctrl+f and sends incremental queries to the search addon', async () => {
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

    fireEvent.keyDown(container.querySelector('.terminal-surface') as HTMLElement, {
      ctrlKey: true,
      key: 'f'
    })

    const searchInput = screen.getByRole('textbox', { name: 'Search terminal output' })
    expect(searchInput).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: 'error' } })

    await waitFor(() => {
      expect(searchControllerMock.findNext).toHaveBeenCalledWith('error', {
        incremental: true
      })
    })

    fireEvent.keyDown(searchInput, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Search terminal output' })).not.toBeInTheDocument()
    })

    expect(searchControllerMock.clear).toHaveBeenCalled()
  })
})
