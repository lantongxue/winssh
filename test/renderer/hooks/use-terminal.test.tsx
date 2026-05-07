import { useEffect } from 'react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { createThemeDefinition } from '@shared/themes'
import type { AppSettings } from '@shared/types'
import i18n from '@/i18n'
import type {
  TerminalSearchController,
  TerminalSearchResultsState,
  TerminalTransport
} from '@/hooks/use-terminal'

const terminalInstances: MockTerminal[] = []
const fitAddonInstances: MockFitAddon[] = []
const imageAddonInstances: MockImageAddon[] = []
const progressAddonInstances: MockProgressAddon[] = []
const searchAddonInstances: MockSearchAddon[] = []
const unicode11AddonInstances: MockUnicode11Addon[] = []
const webFontsAddonInstances: MockWebFontsAddon[] = []
const webLinksAddonInstances: MockWebLinksAddon[] = []
const webglAddonInstances: MockWebglAddon[] = []
const clipboard = {
  readText: vi.fn<() => Promise<string>>(),
  writeText: vi.fn<(text: string) => Promise<void>>()
}
const openWindow = vi.fn()
let lastSearchController: TerminalSearchController | null = null
const transportOnData = vi.fn(() => () => undefined)
const transportResize = vi.fn(async () => undefined)
const transportWrite = vi.fn(async () => undefined)
const testTransport: TerminalTransport = {
  onData: transportOnData,
  resize: transportResize,
  write: transportWrite
}
const originalResizeObserver = globalThis.ResizeObserver
const originalClientWidthDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientWidth'
)
const originalClientHeightDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  'clientHeight'
)

const resizeObserverInstances: MockResizeObserver[] = []

class MockTerminal {
  cols = 80
  rows = 24
  initialOptions: Record<string, unknown>
  options: Record<string, unknown>
  unicode = { activeVersion: '6' }

  constructor(options: Record<string, unknown>) {
    this.initialOptions = { ...options }
    this.options = options
  }

  dispose = vi.fn()
  clearSelection = vi.fn()
  clearTextureAtlas = vi.fn()
  focus = vi.fn()
  getSelection = vi.fn(() => '')
  loadAddon = vi.fn()
  onData = vi.fn(() => ({ dispose: vi.fn() }))
  onSelectionChange = vi.fn(() => ({ dispose: vi.fn() }))
  open = vi.fn()
  paste = vi.fn()
  refresh = vi.fn()
  write = vi.fn()
}

class MockFitAddon {
  fit = vi.fn()
}

class MockImageAddon {
  dispose = vi.fn()
}

class MockProgressAddon {
  dispose = vi.fn()
}

class MockSearchAddon {
  private listener: ((event: TerminalSearchResultsState) => void) | null = null

  clearActiveDecoration = vi.fn()
  clearDecorations = vi.fn()
  dispose = vi.fn()
  findNext = vi.fn(() => true)
  findPrevious = vi.fn(() => true)
  onDidChangeResults = vi.fn((listener: (event: TerminalSearchResultsState) => void) => {
    this.listener = listener
    return { dispose: vi.fn() }
  })

  emitResults(event: TerminalSearchResultsState) {
    this.listener?.(event)
  }
}

class MockUnicode11Addon {
  dispose = vi.fn()
}

class MockWebFontsAddon {
  dispose = vi.fn()
  relayout = vi.fn(async () => undefined)
}

class MockWebLinksAddon {
  handler: ((event: MouseEvent, uri: string) => void) | undefined
  options:
    | {
        hover?: (event: MouseEvent, text: string, location: unknown) => void
        leave?: (event: MouseEvent, text: string) => void
      }
    | undefined

  constructor(
    handler?: (event: MouseEvent, uri: string) => void,
    options?: {
      hover?: (event: MouseEvent, text: string, location: unknown) => void
      leave?: (event: MouseEvent, text: string) => void
    }
  ) {
    this.handler = handler
    this.options = options
  }

  dispose = vi.fn()
}

class MockWebglAddon {
  dispose = vi.fn()
  onContextLoss = vi.fn(() => ({ dispose: vi.fn() }))
}

class MockResizeObserver {
  private observedTargets: Element[] = []

  constructor(private readonly callback: ResizeObserverCallback) {
    resizeObserverInstances.push(this)
  }

  disconnect = vi.fn()

  observe = vi.fn((target: Element) => {
    this.observedTargets.push(target)
  })

  unobserve = vi.fn((target: Element) => {
    this.observedTargets = this.observedTargets.filter((entry) => entry !== target)
  })

  emit() {
    const entries = this.observedTargets.map((target) => ({
      contentRect: target.getBoundingClientRect(),
      target
    }))

    this.callback(entries as ResizeObserverEntry[], this as unknown as ResizeObserver)
  }
}

const {
  imageAddonConstructor,
  progressAddonConstructor,
  searchAddonConstructor,
  unicode11AddonConstructor,
  webFontsAddonConstructor,
  webLinksAddonConstructor,
  webglAddonConstructor
} = vi.hoisted(() => ({
  imageAddonConstructor: vi.fn(),
  progressAddonConstructor: vi.fn(),
  searchAddonConstructor: vi.fn(),
  unicode11AddonConstructor: vi.fn(),
  webFontsAddonConstructor: vi.fn(),
  webLinksAddonConstructor: vi.fn(),
  webglAddonConstructor: vi.fn()
}))

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

vi.mock('@xterm/addon-image', () => ({
  ImageAddon: imageAddonConstructor
}))

vi.mock('@xterm/addon-progress', () => ({
  ProgressAddon: progressAddonConstructor
}))

vi.mock('@xterm/addon-search', () => ({
  SearchAddon: searchAddonConstructor
}))

vi.mock('@xterm/addon-unicode11', () => ({
  Unicode11Addon: unicode11AddonConstructor
}))

vi.mock('@xterm/addon-web-fonts', () => ({
  WebFontsAddon: webFontsAddonConstructor
}))

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: webLinksAddonConstructor
}))

vi.mock('@xterm/addon-webgl', () => ({
  WebglAddon: webglAddonConstructor
}))

import { useTerminal } from '@/hooks/use-terminal'

function TestTerminal({
  settings,
  theme,
  active = true,
  focusKey = null,
  onLinkTooltipChange,
  onSearchResultsChange
}: {
  settings: AppSettings
  theme: ReturnType<typeof createThemeDefinition>
  active?: boolean
  focusKey?: string | null
  onLinkTooltipChange?: (
    state: import('@/hooks/use-terminal').TerminalLinkTooltipState | null
  ) => void
  onSearchResultsChange?: (state: TerminalSearchResultsState | null) => void
}) {
  const { containerRef, search } = useTerminal(
    testTransport,
    settings,
    theme,
    true,
    onLinkTooltipChange,
    onSearchResultsChange,
    active,
    focusKey
  )

  useEffect(() => {
    lastSearchController = search
  }, [search])

  return <div ref={containerRef} />
}

describe('useTerminal', () => {
  const settings: AppSettings = {
    autoUpdateCheckEnabled: true,
    copyOnSelect: false,
    cursorBlink: true,
    cursorStyle: 'block',
    experimentalTerminalWebgl: false,
    language: 'en-US',
    logFilePath: '/tmp/winssh.log',
    localTerminalShell: 'zsh',
    uiFontId: 'inter',
    terminalFontId: 'cascadia-mono',
    editorFontId: null,
    terminalFontSize: 14,
    theme: 'system',
    webdavBackupEnabled: false,
    webdavBackupIntervalMinutes: 60,
    webdavBackupPath: '/winssh-backup/',
    resourceMonitorIntervalMs: 2000,
    webdavUrl: null,
    webdavUsername: null,
    windowTitleBarStyle: 'custom'
  }

  const darkTheme = createThemeDefinition({
    appearance: 'dark',
    id: 'test.dark',
    label: 'Dark',
    pluginDisplayName: 'Tests',
    pluginId: 'tests',
    source: 'builtin',
    version: '1.0.0'
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
    version: '1.0.0'
  })

  const highContrastTheme = createThemeDefinition({
    appearance: 'dark',
    id: 'acme.accessible-dark',
    label: 'High Contrast Dark',
    pluginDisplayName: 'Tests',
    pluginId: 'tests',
    source: 'builtin',
    terminal: {
      background: '#000000',
      foreground: '#ffffff',
      cursor: '#ffff00',
      selectionBackground: '#ffff00'
    },
    uiTheme: 'hc-black',
    version: '1.0.0'
  })

  const translucentTheme = createThemeDefinition({
    appearance: 'dark',
    id: 'test.translucent',
    label: 'Translucent',
    pluginDisplayName: 'Tests',
    pluginId: 'tests',
    source: 'builtin',
    terminal: {
      background: 'rgba(24, 26, 31, 0.72)'
    },
    version: '1.0.0'
  })

  beforeEach(() => {
    terminalInstances.length = 0
    fitAddonInstances.length = 0
    imageAddonInstances.length = 0
    progressAddonInstances.length = 0
    searchAddonInstances.length = 0
    unicode11AddonInstances.length = 0
    webFontsAddonInstances.length = 0
    webLinksAddonInstances.length = 0
    webglAddonInstances.length = 0
    resizeObserverInstances.length = 0
    lastSearchController = null
    clipboard.readText.mockReset()
    clipboard.writeText.mockReset()
    clipboard.readText.mockResolvedValue('')
    clipboard.writeText.mockResolvedValue()
    imageAddonConstructor.mockReset()
    imageAddonConstructor.mockImplementation(() => {
      const instance = new MockImageAddon()
      imageAddonInstances.push(instance)
      return instance
    })
    progressAddonConstructor.mockReset()
    progressAddonConstructor.mockImplementation(() => {
      const instance = new MockProgressAddon()
      progressAddonInstances.push(instance)
      return instance
    })
    searchAddonConstructor.mockReset()
    searchAddonConstructor.mockImplementation(() => {
      const instance = new MockSearchAddon()
      searchAddonInstances.push(instance)
      return instance
    })
    unicode11AddonConstructor.mockReset()
    unicode11AddonConstructor.mockImplementation(() => {
      const instance = new MockUnicode11Addon()
      unicode11AddonInstances.push(instance)
      return instance
    })
    webFontsAddonConstructor.mockReset()
    webFontsAddonConstructor.mockImplementation(() => {
      const instance = new MockWebFontsAddon()
      webFontsAddonInstances.push(instance)
      return instance
    })
    webLinksAddonConstructor.mockReset()
    webLinksAddonConstructor.mockImplementation(
      (
        handler?: (event: MouseEvent, uri: string) => void,
        options?: {
          hover?: (event: MouseEvent, text: string, location: unknown) => void
          leave?: (event: MouseEvent, text: string) => void
        }
      ) => {
        const instance = new MockWebLinksAddon(handler, options)
        webLinksAddonInstances.push(instance)
        return instance
      }
    )
    webglAddonConstructor.mockReset()
    webglAddonConstructor.mockImplementation(() => {
      const instance = new MockWebglAddon()
      webglAddonInstances.push(instance)
      return instance
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard
    })
    Object.defineProperty(window, 'open', {
      configurable: true,
      value: openWindow
    })
    openWindow.mockReset()
    transportOnData.mockReset()
    transportOnData.mockImplementation(() => () => undefined)
    transportResize.mockReset()
    transportResize.mockResolvedValue(undefined)
    transportWrite.mockReset()
    transportWrite.mockResolvedValue(undefined)
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: MockResizeObserver
    })
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get() {
        return 960
      }
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return 540
      }
    })
  })

  afterAll(() => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: originalResizeObserver
    })

    if (originalClientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidthDescriptor)
    }

    if (originalClientHeightDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeightDescriptor)
    }
  })

  it('updates terminal theme without recreating the instance', async () => {
    const { rerender } = render(<TestTerminal settings={settings} theme={darkTheme} />)

    expect(terminalInstances).toHaveLength(1)
    expect(imageAddonInstances).toHaveLength(1)
    expect(progressAddonInstances).toHaveLength(1)
    expect(searchAddonInstances).toHaveLength(1)
    expect(unicode11AddonInstances).toHaveLength(1)
    expect(webFontsAddonInstances).toHaveLength(1)
    expect(webLinksAddonInstances).toHaveLength(1)
    expect(terminalInstances[0]?.loadAddon).toHaveBeenCalledWith(imageAddonInstances[0])
    expect(terminalInstances[0]?.loadAddon).toHaveBeenCalledWith(progressAddonInstances[0])
    expect(terminalInstances[0]?.loadAddon).toHaveBeenCalledWith(searchAddonInstances[0])
    expect(terminalInstances[0]?.loadAddon).toHaveBeenCalledWith(webFontsAddonInstances[0])
    expect(terminalInstances[0]?.loadAddon).toHaveBeenCalledWith(webLinksAddonInstances[0])
    expect(terminalInstances[0]?.loadAddon).toHaveBeenCalledWith(unicode11AddonInstances[0])
    expect(terminalInstances[0]?.initialOptions.allowTransparency).toBe(false)
    expect(terminalInstances[0]?.initialOptions.allowProposedApi).toBe(true)
    expect(terminalInstances[0]?.initialOptions.fontFamily).toBe(
      '"WinSSH Cascadia Mono", monospace'
    )
    expect(terminalInstances[0]?.unicode.activeVersion).toBe('11')
    expect(terminalInstances[0]?.options.theme).toMatchObject({
      background: darkTheme.terminal.background
    })

    rerender(<TestTerminal settings={settings} theme={pixelTheme} />)

    expect(terminalInstances).toHaveLength(1)
    expect(terminalInstances[0]?.options.theme).toMatchObject({
      background: pixelTheme.terminal.background
    })
    await waitFor(() => {
      expect(fitAddonInstances[0]?.fit).toHaveBeenCalled()
    })
  })

  it('enables xterm minimum contrast for high contrast themes', () => {
    render(<TestTerminal settings={settings} theme={highContrastTheme} />)

    expect(terminalInstances[0]?.initialOptions.minimumContrastRatio).toBe(4.5)
  })

  it('only enables xterm transparent rendering for transparent terminal backgrounds', () => {
    render(<TestTerminal settings={settings} theme={translucentTheme} />)

    expect(terminalInstances[0]?.initialOptions.allowTransparency).toBe(true)
  })

  it('reformats the font stack and refreshes xterm glyph caches when typography changes', async () => {
    const { rerender } = render(<TestTerminal settings={settings} theme={darkTheme} />)

    await waitFor(() => {
      expect(webFontsAddonInstances[0]?.relayout).toHaveBeenCalled()
    })

    terminalInstances[0]?.clearTextureAtlas.mockClear()
    terminalInstances[0]?.refresh.mockClear()
    webFontsAddonInstances[0]?.relayout.mockClear()

    rerender(
      <TestTerminal
        settings={{ ...settings, terminalFontId: 'ibm-plex-mono', terminalFontSize: 16 }}
        theme={darkTheme}
      />
    )

    expect(terminalInstances).toHaveLength(1)
    expect(terminalInstances[0]?.options.fontFamily).toBe(
      '"WinSSH IBM Plex Mono", monospace'
    )
    expect(terminalInstances[0]?.options.fontSize).toBe(16)
    await waitFor(() => {
      expect(webFontsAddonInstances[0]?.relayout).toHaveBeenCalled()
      expect(terminalInstances[0]?.clearTextureAtlas).toHaveBeenCalled()
      expect(terminalInstances[0]?.refresh).toHaveBeenCalledWith(0, 23)
    })
  })

  it('recreates the terminal and loads the WebGL addon when experimental WebGL rendering is enabled', () => {
    const { rerender } = render(<TestTerminal settings={settings} theme={darkTheme} />)

    expect(terminalInstances).toHaveLength(1)
    expect(webglAddonInstances).toHaveLength(0)

    rerender(
      <TestTerminal settings={{ ...settings, experimentalTerminalWebgl: true }} theme={darkTheme} />
    )

    expect(terminalInstances).toHaveLength(2)
    expect(imageAddonInstances).toHaveLength(2)
    expect(progressAddonInstances).toHaveLength(2)
    expect(searchAddonInstances).toHaveLength(2)
    expect(unicode11AddonInstances).toHaveLength(2)
    expect(webFontsAddonInstances).toHaveLength(2)
    expect(webLinksAddonInstances).toHaveLength(2)
    expect(webglAddonInstances).toHaveLength(1)
    expect(terminalInstances[1]?.loadAddon).toHaveBeenCalledWith(webFontsAddonInstances[1])
    expect(terminalInstances[1]?.loadAddon).toHaveBeenCalledWith(webglAddonInstances[0])
  })

  it('skips geometry sync while inactive and resumes it once when reactivated', async () => {
    const { rerender } = render(
      <TestTerminal active={false} settings={settings} theme={darkTheme} />
    )

    expect(terminalInstances).toHaveLength(1)
    expect(resizeObserverInstances).toHaveLength(1)

    resizeObserverInstances[0]?.emit()
    expect(transportResize).not.toHaveBeenCalled()

    rerender(<TestTerminal active settings={settings} theme={darkTheme} />)

    await waitFor(() => {
      expect(transportResize).toHaveBeenCalledTimes(1)
    })

    expect(terminalInstances).toHaveLength(1)
    expect(terminalInstances[0]?.focus).toHaveBeenCalledTimes(1)

    resizeObserverInstances[0]?.emit()

    await waitFor(() => {
      expect(transportResize).toHaveBeenCalledTimes(1)
    })
  })

  it('focuses the existing terminal when a ready-state focus key is requested', async () => {
    const { rerender } = render(<TestTerminal settings={settings} theme={darkTheme} />)

    expect(terminalInstances).toHaveLength(1)
    terminalInstances[0]?.focus.mockClear()

    rerender(
      <TestTerminal focusKey="ready:session-1:cycle-1" settings={settings} theme={darkTheme} />
    )

    await waitFor(() => {
      expect(terminalInstances[0]?.focus).toHaveBeenCalledTimes(1)
    })

    expect(terminalInstances).toHaveLength(1)
  })

  it('keeps the default renderer when the experimental WebGL addon cannot be initialized', () => {
    webglAddonConstructor.mockImplementationOnce(() => {
      throw new Error('WebGL unavailable')
    })

    render(
      <TestTerminal settings={{ ...settings, experimentalTerminalWebgl: true }} theme={darkTheme} />
    )

    expect(terminalInstances).toHaveLength(1)
    expect(imageAddonInstances).toHaveLength(1)
    expect(progressAddonInstances).toHaveLength(1)
    expect(searchAddonInstances).toHaveLength(1)
    expect(unicode11AddonInstances).toHaveLength(1)
    expect(webFontsAddonInstances).toHaveLength(1)
    expect(webLinksAddonInstances).toHaveLength(1)
    expect(terminalInstances[0]?.loadAddon).toHaveBeenCalledTimes(7)
    expect(webglAddonInstances).toHaveLength(0)
  })

  it('loads the search addon and exposes search helpers', () => {
    const onSearchResultsChange = vi.fn()
    render(
      <TestTerminal
        settings={settings}
        theme={darkTheme}
        onSearchResultsChange={onSearchResultsChange}
      />
    )

    expect(searchAddonInstances).toHaveLength(1)

    lastSearchController?.findNext('error', { incremental: true })
    expect(searchAddonInstances[0]?.findNext).toHaveBeenCalledWith('error', { incremental: true })

    lastSearchController?.findPrevious('error')
    expect(searchAddonInstances[0]?.findPrevious).toHaveBeenCalledWith('error', undefined)

    searchAddonInstances[0]?.emitResults({ resultCount: 3, resultIndex: 1 })
    expect(onSearchResultsChange).toHaveBeenLastCalledWith({ resultCount: 3, resultIndex: 1 })

    lastSearchController?.clearActiveDecoration()
    expect(searchAddonInstances[0]?.clearActiveDecoration).toHaveBeenCalledOnce()

    lastSearchController?.clear()
    expect(searchAddonInstances[0]?.clearDecorations).toHaveBeenCalledOnce()
  })

  it('opens detected web links only when cmd-click is used', () => {
    const onLinkTooltipChange = vi.fn()
    render(
      <TestTerminal
        settings={settings}
        theme={darkTheme}
        onLinkTooltipChange={onLinkTooltipChange}
      />
    )

    const webLinksAddon = webLinksAddonInstances[0]
    expect(webLinksAddon?.handler).toBeTypeOf('function')
    expect(webLinksAddon?.options?.hover).toBeTypeOf('function')
    expect(webLinksAddon?.options?.leave).toBeTypeOf('function')

    const hoverEvent = new MouseEvent('mousemove', {
      bubbles: true,
      clientX: 140,
      clientY: 80
    })
    webLinksAddon?.options?.hover?.(hoverEvent, 'https://example.com', {})

    expect(onLinkTooltipChange).toHaveBeenCalledWith({
      open: true,
      text: i18n.t('workbench.terminal.linkHint'),
      x: 140,
      y: 80
    })

    const plainClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    webLinksAddon?.handler?.(plainClick, 'https://example.com')

    expect(plainClick.defaultPrevented).toBe(true)
    expect(openWindow).not.toHaveBeenCalled()

    const cmdClick = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true })
    webLinksAddon?.handler?.(cmdClick, 'https://example.com')

    expect(cmdClick.defaultPrevented).toBe(true)
    expect(openWindow).toHaveBeenCalledWith('https://example.com', '_blank', 'noopener,noreferrer')

    const leaveEvent = new MouseEvent('mouseleave', { bubbles: true })
    webLinksAddon?.options?.leave?.(leaveEvent, 'https://example.com')

    expect(onLinkTooltipChange).toHaveBeenLastCalledWith(null)
  })

  it('copies the current selection on right click and clears the selection afterwards', async () => {
    const { container } = render(<TestTerminal settings={settings} theme={darkTheme} />)
    const terminal = terminalInstances[0]

    terminal?.getSelection.mockReturnValue('ssh user@host')

    const canceled = !fireEvent(
      container.firstChild as HTMLElement,
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    )

    expect(canceled).toBe(true)

    await waitFor(() => {
      expect(clipboard.writeText).toHaveBeenCalledWith('ssh user@host')
    })

    expect(terminal?.clearSelection).toHaveBeenCalledOnce()
    expect(terminal?.paste).not.toHaveBeenCalled()
    expect(clipboard.readText).not.toHaveBeenCalled()
    expect(terminal?.focus).toHaveBeenCalled()
  })

  it('pastes plain text from the clipboard on right click when nothing is selected', async () => {
    const { container } = render(<TestTerminal settings={settings} theme={darkTheme} />)
    const terminal = terminalInstances[0]

    terminal?.getSelection.mockReturnValue('')
    clipboard.readText.mockResolvedValue('line 1\nline 2')

    fireEvent(
      container.firstChild as HTMLElement,
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    )

    await waitFor(() => {
      expect(clipboard.readText).toHaveBeenCalledOnce()
    })

    expect(terminal?.paste).toHaveBeenCalledWith('line 1\nline 2')
    expect(clipboard.writeText).not.toHaveBeenCalled()
    expect(terminal?.clearSelection).not.toHaveBeenCalled()
    expect(terminal?.focus).toHaveBeenCalled()
  })
})
