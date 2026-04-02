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

  it('maps the waiting progress to the reported connection phase instead of advancing on a timer', () => {
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

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
  })
})
