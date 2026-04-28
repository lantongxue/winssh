import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { RemoteEntry } from '@shared/types'
import i18n from '@/i18n'
import { SftpPanel } from '@/components/sftp-panel'
import type { SessionTab } from '@/store/sessions-store'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TERMINAL_PATH_DRAG_MIME } from '@/lib/terminal-path-dnd'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })
}

function renderSftpPanel(session: SessionTab | null) {
  const queryClient = createTestQueryClient()

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SftpPanel session={session} />
        </TooltipProvider>
      </QueryClientProvider>
    )
  }
}

function ConnectedSftpPanel({ sessionId }: { sessionId: string }) {
  const session =
    useSessionsStore((state) => state.tabs.find((tab) => tab.sessionId === sessionId)) ?? null

  return <SftpPanel session={session} />
}

function renderConnectedSftpPanel(sessionId: string) {
  const queryClient = createTestQueryClient()

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ConnectedSftpPanel sessionId={sessionId} />
        </TooltipProvider>
      </QueryClientProvider>
    )
  }
}

describe('SftpPanel', () => {
  const session = {
    connectedAt: new Date().toISOString(),
    currentPath: '/var/www',
    host: '127.0.0.1',
    port: 22,
    serverId: 'server-1',
    serverName: 'alpha',
    sessionId: 'session-1',
    status: 'ready' as const
  }

  const entries: RemoteEntry[] = [
    {
      kind: 'file',
      modifiedAt: null,
      name: 'config.json',
      path: '/var/www/config.json',
      permissions: null,
      size: 32
    }
  ]

  beforeEach(async () => {
    await i18n.changeLanguage('en-US')
    useSessionsStore.getState().clear()
  })

  it('sends the selected entry path to the terminal from the context menu', async () => {
    const sessionsWrite = vi.fn().mockResolvedValue(undefined)

    window.winsshApi = createWinsshApiMock({
      sessions: {
        write: sessionsWrite
      },
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries,
          path: '/var/www'
        })
      }
    })

    renderSftpPanel(session)

    fireEvent.contextMenu(await screen.findByText('config.json'))
    fireEvent.click(await screen.findByText('Send Path to Terminal'))

    await waitFor(() => {
      expect(sessionsWrite).toHaveBeenCalledWith('session-1', '/var/www/config.json')
    })
  })

  it('keeps rendering when a loaded session becomes disconnected', async () => {
    window.winsshApi = createWinsshApiMock({
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries,
          path: '/var/www'
        })
      }
    })

    const { queryClient, rerender } = renderSftpPanel(session)

    await screen.findByText('config.json')

    rerender(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SftpPanel session={{ ...session, status: 'disconnected' }} />
        </TooltipProvider>
      </QueryClientProvider>
    )

    expect(screen.getByText('No active session')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Start an SSH session first and the SFTP panel will follow the active tab automatically.'
      )
    ).toBeInTheDocument()
  })

  it('closes the aux panel from the header close button', async () => {
    useSessionsStore.getState().addSession(session)
    useSessionsStore.getState().setAuxView('session-1', 'sftp')

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries,
          path: '/var/www'
        })
      }
    })

    renderSftpPanel(session)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(useSessionsStore.getState().tabs[0]?.auxView).toBeNull()
  })

  it('jumps to an edited path when pressing enter in the current path field', async () => {
    const list = vi.fn().mockImplementation(async (_sessionId: string, path: string) => ({
      entries,
      path
    }))

    useSessionsStore.getState().addSession(session)
    window.winsshApi = createWinsshApiMock({
      sftp: {
        list
      }
    })

    renderConnectedSftpPanel('session-1')

    const pathField = await screen.findByLabelText('Current Path')

    fireEvent.change(pathField, { target: { value: '/etc/nginx/sites-enabled' } })
    fireEvent.keyDown(pathField, { key: 'Enter' })

    await waitFor(() => {
      expect(useSessionsStore.getState().tabs[0]?.currentPath).toBe('/etc/nginx/sites-enabled')
    })
    await waitFor(() => {
      expect(list).toHaveBeenLastCalledWith('session-1', '/etc/nginx/sites-enabled')
    })
  })

  it('uploads dropped files and folders into the current directory', async () => {
    const list = vi.fn().mockResolvedValue({
      entries,
      path: '/var/www'
    })
    const uploadPaths = vi.fn().mockResolvedValue(undefined)
    const getPathForFile = vi.fn((file: File) => (file as { path?: string }).path ?? null)

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list,
        uploadPaths
      },
      system: {
        getPathForFile
      }
    })

    renderSftpPanel(session)

    const region = screen.getByRole('region', { name: 'SFTP Explorer' })
    const droppedFile = { path: 'C:\\Users\\tester\\notes.txt' } as unknown as File
    const droppedFolder = { path: 'C:\\Users\\tester\\project' } as unknown as File
    const dataTransfer = {
      dropEffect: 'none',
      files: [droppedFile, droppedFolder],
      items: [
        {
          getAsFile: () => droppedFile,
          kind: 'file'
        },
        {
          getAsFile: () => droppedFolder,
          kind: 'file'
        }
      ],
      types: ['Files']
    }

    fireEvent.dragEnter(region, { dataTransfer })
    expect(screen.getByText('Drop files or folders to upload')).toBeInTheDocument()

    fireEvent.drop(region, { dataTransfer })

    await waitFor(() => {
      expect(uploadPaths).toHaveBeenCalledWith('session-1', '/var/www', [
        'C:\\Users\\tester\\notes.txt',
        'C:\\Users\\tester\\project'
      ])
    })
    expect(getPathForFile).toHaveBeenCalledTimes(4)
    await waitFor(() => {
      expect(screen.queryByText('Drop files or folders to upload')).not.toBeInTheDocument()
    })
  })

  it('confirms before deleting and then shows a removing transition state', async () => {
    const remove = vi.fn(() => new Promise<void>(() => undefined))

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries,
          path: '/var/www'
        }),
        remove
      }
    })

    renderSftpPanel(session)

    const entryLabel = await screen.findByText('config.json')
    const entryButton = entryLabel.closest('button')

    expect(entryButton).not.toBeNull()

    fireEvent.contextMenu(entryLabel)
    fireEvent.click(await screen.findByText('Delete'))

    expect(remove).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Are you sure you want to delete this item? This action cannot be undone.')
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(entryButton).toHaveAttribute('data-removing', 'true')
    })
  })

  it('writes the dragged entry path into terminal drag data', async () => {
    window.winsshApi = createWinsshApiMock({
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries,
          path: '/var/www'
        })
      }
    })

    renderSftpPanel(session)

    const entryButton = (await screen.findByText('config.json')).closest('button')
    const setData = vi.fn()
    const dataTransfer = {
      effectAllowed: 'none',
      setData
    }

    expect(entryButton).not.toBeNull()

    fireEvent.dragStart(entryButton as HTMLElement, { dataTransfer })

    expect(dataTransfer.effectAllowed).toBe('copy')
    expect(setData).toHaveBeenCalledWith(TERMINAL_PATH_DRAG_MIME, '/var/www/config.json')
    expect(setData).toHaveBeenCalledWith('text/plain', '/var/www/config.json')
  })
})
