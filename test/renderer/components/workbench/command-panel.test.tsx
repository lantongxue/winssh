import { render, screen } from '@testing-library/react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import i18n from '@/i18n'
import { CommandPanel } from '@/components/workbench/command-panel'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'

function renderCommandPanel() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CommandPanel
          scope={{ kind: 'local' }}
          onInsertCommand={() => undefined}
          onClose={() => undefined}
        />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

let originalClientHeight: PropertyDescriptor | undefined
let originalOffsetHeight: PropertyDescriptor | undefined

beforeEach(async () => {
  await i18n.changeLanguage('en-US')

  originalClientHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
  originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight')

  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return 600
    }
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return 600
    }
  })
})

afterEach(() => {
  if (originalClientHeight) {
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight)
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
  }

  if (originalOffsetHeight) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
  }
})

describe('CommandPanel', () => {
  it('renders command history with execution date, time, and execution duration', async () => {
    const listHistory = vi.fn().mockResolvedValue([
      {
        id: '1',
        scopeKind: 'local',
        serverId: null,
        command: 'echo "hello world"',
        executedAt: '2026-05-28T01:45:00.000Z',
        cwd: null,
        exitCode: 0,
        durationMs: 45
      },
      {
        id: '2',
        scopeKind: 'local',
        serverId: null,
        command: 'sleep 2',
        executedAt: '2026-05-28T02:30:15.000Z',
        cwd: null,
        exitCode: 0,
        durationMs: 2500
      }
    ])

    const listCustom = vi.fn().mockResolvedValue([])

    window.winsshApi = {
      ...createWinsshApiMock(),
      commandHistory: {
        list: listHistory,
        search: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        clearAll: vi.fn().mockResolvedValue(undefined),
        deleteEntry: vi.fn().mockResolvedValue(undefined),
        setServerCapture: vi.fn().mockResolvedValue(undefined),
        onCommandAdded: () => () => undefined
      },
      customCommands: {
        list: listCustom,
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      }
    } as any

    renderCommandPanel()

    expect(await screen.findByText('echo "hello world"')).toBeInTheDocument()
    expect(screen.getByText('sleep 2')).toBeInTheDocument()

    // Verify date is displayed
    expect(screen.getAllByText(/2026-05-28/).length).toBe(2)

    // Verify duration is displayed for short duration (< 100ms)
    expect(screen.getByText('45ms')).toBeInTheDocument()

    // Verify duration is displayed for longer duration (>= 1s)
    expect(screen.getByText('2.5s')).toBeInTheDocument()
  })

  it('displays 20 items initially and loads more on scroll', async () => {
    // Generate 50 items
    const entries = Array.from({ length: 50 }, (_, i) => ({
      id: String(i + 1),
      scopeKind: 'local',
      serverId: null,
      command: `command ${i + 1}`,
      executedAt: '2026-05-28T01:45:00.000Z',
      cwd: null,
      exitCode: 0,
      durationMs: 10
    }))

    const listHistory = vi.fn().mockResolvedValue(entries)
    const listCustom = vi.fn().mockResolvedValue([])

    window.winsshApi = {
      ...createWinsshApiMock(),
      commandHistory: {
        list: listHistory,
        search: vi.fn().mockResolvedValue([]),
        clear: vi.fn().mockResolvedValue(undefined),
        clearAll: vi.fn().mockResolvedValue(undefined),
        deleteEntry: vi.fn().mockResolvedValue(undefined),
        setServerCapture: vi.fn().mockResolvedValue(undefined),
        onCommandAdded: () => () => undefined
      },
      customCommands: {
        list: listCustom,
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
      }
    } as any

    renderCommandPanel()

    // It should display "command 1" through "command 20"
    expect(await screen.findByText('command 1')).toBeInTheDocument()
    expect(screen.getByText('command 20')).toBeInTheDocument()
    // It should not display "command 21" initially
    expect(screen.queryByText('command 21')).not.toBeInTheDocument()

    // Trigger scroll event near bottom
    const scrollContainer = screen.getByText('command 1').closest('.overflow-auto')
    expect(scrollContainer).toBeInTheDocument()

    if (scrollContainer) {
      // Mock scrollHeight, scrollTop, clientHeight
      Object.defineProperty(scrollContainer, 'scrollHeight', { value: 2000, configurable: true })
      Object.defineProperty(scrollContainer, 'scrollTop', { value: 1460, configurable: true })
      Object.defineProperty(scrollContainer, 'clientHeight', { value: 500, configurable: true })

      // Dispatch scroll event
      const fireEvent = (await import('@testing-library/react')).fireEvent
      fireEvent.scroll(scrollContainer)

      // Now "command 21" should be displayed, and up to "command 40"
      expect(await screen.findByText('command 21')).toBeInTheDocument()
      expect(screen.getByText('command 40')).toBeInTheDocument()
      expect(screen.queryByText('command 41')).not.toBeInTheDocument()
    }
  })
})

