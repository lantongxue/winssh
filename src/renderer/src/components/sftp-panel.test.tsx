import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { RemoteEntry } from '@shared/types'
import i18n from '@/i18n'
import { SftpPanel } from '@/components/sftp-panel'
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

function renderSftpPanel(session: {
  connectedAt: string
  currentPath: string
  host: string
  port: number
  serverId: string
  serverName: string
  sessionId: string
  status: 'ready'
}) {
  const queryClient = createTestQueryClient()

  return render(
    <QueryClientProvider client={queryClient}>
      <SftpPanel session={session} />
    </QueryClientProvider>
  )
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
})
