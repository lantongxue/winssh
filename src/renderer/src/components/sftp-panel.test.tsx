import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RemoteEntry } from '@shared/types'
import i18n from '@/i18n'
import { SftpPanel } from '@/components/sftp-panel'
import type { SessionTab } from '@/store/sessions-store'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'

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
        <SftpPanel session={session} />
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
        <SftpPanel session={{ ...session, status: 'disconnected' }} />
      </QueryClientProvider>
    )

    expect(screen.getByText('No active session')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Start an SSH session first and the SFTP panel will follow the active tab automatically.'
      )
    ).toBeInTheDocument()
  })
})
