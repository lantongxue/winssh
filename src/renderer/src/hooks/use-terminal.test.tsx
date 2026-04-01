import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createThemeDefinition } from '@shared/themes'
import type { AppSettings } from '@shared/types'
import { createWinsshApiMock } from '@/test/create-winssh-api'

const terminalInstances: MockTerminal[] = []
const fitAddonInstances: MockFitAddon[] = []

class MockTerminal {
  cols = 80
  rows = 24
  options: Record<string, unknown>

  constructor(options: Record<string, unknown>) {
    this.options = options
  }

  dispose = vi.fn()
  getSelection = vi.fn(() => '')
  loadAddon = vi.fn()
  onData = vi.fn(() => ({ dispose: vi.fn() }))
  onSelectionChange = vi.fn(() => ({ dispose: vi.fn() }))
  open = vi.fn()
  write = vi.fn()
}

class MockFitAddon {
  fit = vi.fn()
}

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation((options: Record<string, unknown>) => {
    const instance = new MockTerminal(options)
    terminalInstances.push(instance)
    return instance
  })
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => {
    const instance = new MockFitAddon()
    fitAddonInstances.push(instance)
    return instance
  })
}))

import { useTerminal } from '@/hooks/use-terminal'

function TestTerminal({
  settings,
  theme
}: {
  settings: AppSettings
  theme: ReturnType<typeof createThemeDefinition>
}) {
  const terminalRef = useTerminal('session-1', settings, theme)
  return <div ref={terminalRef} />
}

describe('useTerminal', () => {
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

  const darkTheme = createThemeDefinition({
    appearance: 'dark',
    id: 'test.dark',
    label: 'Dark',
    pluginDisplayName: 'Tests',
    pluginId: 'tests',
    source: 'builtin',
    version: '0.1.0'
  })

  const pixelTheme = createThemeDefinition({
    appearance: 'dark',
    id: 'test.pixel',
    label: 'Pixel',
    pluginDisplayName: 'Tests',
    pluginId: 'tests',
    source: 'builtin',
    terminal: {
      background: '#0b1811'
    },
    version: '0.1.0'
  })

  beforeEach(() => {
    terminalInstances.length = 0
    fitAddonInstances.length = 0
    window.winsshApi = createWinsshApiMock()
  })

  it('updates terminal theme without recreating the instance', () => {
    const { rerender } = render(<TestTerminal settings={settings} theme={darkTheme} />)

    expect(terminalInstances).toHaveLength(1)
    expect(terminalInstances[0]?.options.theme).toMatchObject({
      background: darkTheme.terminal.background
    })

    rerender(<TestTerminal settings={settings} theme={pixelTheme} />)

    expect(terminalInstances).toHaveLength(1)
    expect(terminalInstances[0]?.options.theme).toMatchObject({
      background: pixelTheme.terminal.background
    })
    expect(fitAddonInstances[0]?.fit).toHaveBeenCalled()
  })
})
