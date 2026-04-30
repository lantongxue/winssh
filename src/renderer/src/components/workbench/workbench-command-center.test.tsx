import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEFAULT_PIXEL_THEME_ID } from '@shared/themes'
import i18n from '@/i18n'
import { WorkbenchCommandCenter } from '@/components/workbench/workbench-command-center'
import { WorkbenchProvider } from '@/components/workbench/workbench-context'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

function renderCommandCenter() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkbenchProvider>
        <WorkbenchCommandCenter activeDocument={null} />
      </WorkbenchProvider>
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  useSessionsStore.getState().clear()
  useLocalTerminalsStore.getState().clear()
})

describe('WorkbenchCommandCenter quick connect', () => {
  it('opens a local terminal from the command palette workbench group', async () => {
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

    useWorkbenchStore.getState().setCommandPaletteOpen(true)
    renderCommandCenter()

    fireEvent.click(await screen.findByText('Open Local Terminal'))

    await waitFor(() => {
      expect(createLocalTerminal).toHaveBeenCalledTimes(1)
    })
    expect(useWorkbenchStore.getState().activeDocumentId).toBe(
      'local-terminal-editor:local-terminal-1'
    )
  })

  it('shows a synthetic quick-connect action for a valid ssh user@host input', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([])
      }
    })

    useWorkbenchStore.getState().setQuickOpenOpen(true)
    renderCommandCenter()

    const input = await screen.findByPlaceholderText('Type ssh user@host, or jump to a saved item')
    fireEvent.change(input, { target: { value: 'ssh root@127.0.0.1' } })

    await waitFor(() => {
      expect(screen.getAllByText('Quick Connect').length).toBeGreaterThan(0)
    })
    expect(await screen.findByText('Connect to root@127.0.0.1')).toBeInTheDocument()
  })

  it('keeps saved server items on the existing open-editor behavior', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([
          {
            authType: 'password',
            createdAt: '',
            credentialId: null,
            favorite: false,
            group: null,
            groupId: null,
            hasPassphrase: false,
            hasPassword: false,
            host: '127.0.0.1',
            id: 'server-1',
            jumpServerId: null,
            lastConnectedAt: null,
            name: 'alpha',
            note: null,
            port: 22,
            privateKeyPath: null,
            tags: [],
            updatedAt: '',
            username: 'root'
          }
        ])
      }
    })

    useWorkbenchStore.getState().setQuickOpenOpen(true)
    renderCommandCenter()

    fireEvent.click(await screen.findByText('alpha'))

    await waitFor(() => {
      expect(useWorkbenchStore.getState().activeDocumentId).toBe('server-editor:server-1')
    })
    expect(useWorkbenchStore.getState().quickOpenOpen).toBe(false)
  })

  it('lists the pixel theme and saves it through settings.update', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      autoUpdateCheckEnabled: true,
      copyOnSelect: true,
      cursorBlink: true,
      cursorStyle: 'block',
      language: 'en-US',
      localTerminalShell: 'zsh',
      terminalFontId: 'cascadia-mono',
      terminalFontSize: 14,
      theme: DEFAULT_PIXEL_THEME_ID,
      windowTitleBarStyle: 'custom'
    })

    window.winsshApi = createWinsshApiMock({
      settings: {
        update: updateSettings
      }
    })

    useWorkbenchStore.getState().setCommandPaletteOpen(true)
    renderCommandCenter()

    fireEvent.click(await screen.findByText('Pixel CRT'))

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({ theme: DEFAULT_PIXEL_THEME_ID })
    })
  })
})
