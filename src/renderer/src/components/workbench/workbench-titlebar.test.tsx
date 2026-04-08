import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchProvider } from '@/components/workbench/workbench-context'
import { WorkbenchTitlebar } from '@/components/workbench/workbench-titlebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'
import { useWorkbenchStore } from '@/store/workbench-store'

vi.mock('@/lib/platform', () => ({
  getPlatform: () => 'win32'
}))

function renderTitlebar() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <WorkbenchProvider>
        <TooltipProvider>
          <WorkbenchTitlebar />
        </TooltipProvider>
      </WorkbenchProvider>
    </QueryClientProvider>
  )

  return {
    queryClient,
    ...view
  }
}

function installWindowControlsOverlayMock({
  visible = true,
  width = 884,
  x = 0
}: {
  visible?: boolean
  width?: number
  x?: number
} = {}) {
  Object.defineProperty(window.navigator, 'windowControlsOverlay', {
    configurable: true,
    value: {
      visible,
      getTitlebarAreaRect: () => ({
        x,
        width
      }),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }
  })
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  useLocalTerminalsStore.getState().clear()
  window.winsshApi = createWinsshApiMock()
  Reflect.deleteProperty(window.navigator, 'windowControlsOverlay')
})

describe('WorkbenchTitlebar', () => {
  it('renders the app logo on the left side of the title bar with theme-driven color', () => {
    renderTitlebar()

    expect(screen.getByRole('img', { name: 'WinSSH' })).toHaveStyle('color: var(--workbench-logo)')
    expect(screen.getByRole('button', { name: 'Quick Connect' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open Local Terminal' })).toBeInTheDocument()
  })

  it('opens a local terminal from the title bar button', async () => {
    const createLocalTerminal = vi.fn().mockResolvedValue({
      cwd: '/Users/tester',
      shell: 'zsh',
      startedAt: new Date().toISOString(),
      status: 'running' as const,
      terminalId: 'local-terminal-1',
      title: 'zsh'
    })

    window.winsshApi = createWinsshApiMock({
      localTerminals: {
        create: createLocalTerminal
      }
    })

    renderTitlebar()
    fireEvent.click(screen.getByRole('button', { name: 'Open Local Terminal' }))

    await waitFor(() => {
      expect(createLocalTerminal).toHaveBeenCalledTimes(1)
      expect(useWorkbenchStore.getState().activeDocumentId).toBe(
        'local-terminal-editor:local-terminal-1'
      )
    })
  })

  it('renders custom window controls with explicit hover tones', async () => {
    renderTitlebar()

    const minimizeButton = await screen.findByRole('button', { name: 'Minimize Window' })
    const maximizeButton = await screen.findByRole('button', { name: 'Maximize Window' })
    const closeButton = await screen.findByRole('button', { name: 'Close Window' })

    expect(minimizeButton).toHaveClass('window-control-button')
    expect(maximizeButton).toHaveClass('window-control-button')
    expect(closeButton).toHaveClass('window-control-button')

    expect(minimizeButton).toHaveAttribute('data-window-control-tone', 'default')
    expect(maximizeButton).toHaveAttribute('data-window-control-tone', 'default')
    expect(closeButton).toHaveAttribute('data-window-control-tone', 'close')

    expect(minimizeButton.className).not.toContain('hover:bg-[var(--workbench-hover)]')
    expect(closeButton.className).not.toContain('hover:bg-destructive')
  })

  it('uses the native Windows caption button lane when window controls overlay is available', async () => {
    installWindowControlsOverlayMock()
    const isMaximized = vi.fn().mockResolvedValue(false)
    window.winsshApi = createWinsshApiMock({
      system: {
        window: {
          isMaximized
        }
      }
    })

    const { container } = renderTitlebar()
    const expectedPaddingRight = `${Math.max(138, Math.round(window.innerWidth - 884)) + 8}px`

    await waitFor(() => {
      expect(isMaximized).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(
        screen.queryByRole('button', {
          name: 'Maximize Window'
        })
      ).not.toBeInTheDocument()
    })

    await waitFor(() => {
      const header = container.querySelector('header')
      expect(header?.getAttribute('style') ?? '').toContain(
        `padding-right: ${expectedPaddingRight}`
      )
    })
  })

  it('keeps the currently applied title bar mode until restart after settings change', async () => {
    const { queryClient } = renderTitlebar()

    expect(await screen.findByRole('button', { name: 'Minimize Window' })).toBeInTheDocument()

    await act(async () => {
      queryClient.setQueryData(['settings'], {
        autoUpdateCheckEnabled: true,
        copyOnSelect: true,
        cursorBlink: true,
        cursorStyle: 'block',
        experimentalTerminalWebgl: false,
        language: 'en-US',
        localTerminalShell: 'powershell',
        terminalFontFamily: 'Consolas',
        terminalFontSize: 14,
        theme: 'system',
        windowTitleBarStyle: 'native'
      })
    })

    expect(screen.getByRole('button', { name: 'Minimize Window' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Maximize Window' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close Window' })).toBeInTheDocument()
  })
})
