import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchEditorTabs } from '@/components/workbench/workbench-editor-tabs'
import { WorkbenchProvider } from '@/components/workbench/workbench-context'
import { createSessionEditorDocument } from '@/lib/workbench'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

const savedServer = {
  authType: 'password' as const,
  createdAt: '',
  favorite: false,
  group: null,
  groupId: null,
  hasPassphrase: false,
  hasPassword: true,
  host: '127.0.0.1',
  id: 'server-1',
  lastConnectedAt: null,
  name: 'alpha',
  note: null,
  port: 22,
  privateKeyPath: null,
  tags: [],
  updatedAt: '',
  username: 'root'
}

const sessionSummary = {
  connectedAt: new Date().toISOString(),
  currentPath: '/root',
  host: '127.0.0.1',
  port: 22,
  serverId: 'server-1',
  serverName: 'alpha',
  sessionId: 'session-1',
  status: 'ready' as const
}

function renderEditorTabs() {
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
        <WorkbenchEditorTabs />
      </WorkbenchProvider>
    </QueryClientProvider>
  )
}

function seedSessionTab() {
  useSessionsStore.getState().addSession(sessionSummary)
  useWorkbenchStore.getState().openDocument(createSessionEditorDocument(sessionSummary.sessionId))
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  localStorage.clear()
  useWorkbenchStore.getState().reset()
  useSessionsStore.getState().clear()
})

describe('WorkbenchEditorTabs session context menu', () => {
  it('clones the current session by opening a new session for the same server', async () => {
    const sessionsConnect = vi.fn().mockResolvedValue({
      ok: true,
      summary: {
        connectedAt: new Date().toISOString(),
        currentPath: '/root',
        host: '127.0.0.1',
        port: 22,
        serverId: 'server-1',
        serverName: 'alpha',
        sessionId: 'session-2',
        status: 'ready' as const
      }
    })

    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([savedServer])
      },
      sessions: {
        connect: sessionsConnect
      }
    })

    seedSessionTab()
    renderEditorTabs()

    fireEvent.contextMenu(screen.getByText('alpha'))
    fireEvent.click(await screen.findByText('Clone Session'))

    await waitFor(() => {
      expect(sessionsConnect).toHaveBeenCalledWith(
        expect.objectContaining({
          serverId: 'server-1',
          sessionId: expect.any(String)
        })
      )
    })
    expect(useSessionsStore.getState().tabs.map((session) => session.sessionId)).toContain(
      'session-2'
    )
    expect(useWorkbenchStore.getState().openDocuments.map((document) => document.id)).toContain(
      'session-editor:session-2'
    )
  })

  it('renames a session tab without mutating the saved server name', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([savedServer])
      }
    })

    seedSessionTab()
    renderEditorTabs()

    fireEvent.contextMenu(screen.getByText('alpha'))
    fireEvent.click(await screen.findByText('Rename Tab'))

    const input = await screen.findByPlaceholderText('Enter a tab name')
    fireEvent.change(input, { target: { value: 'Prod Shell' } })
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))

    await waitFor(() => {
      expect(screen.getByText('Prod Shell')).toBeInTheDocument()
    })
    expect(useSessionsStore.getState().tabs[0]?.serverName).toBe('alpha')
    expect(useWorkbenchStore.getState().documentTitleOverrides['session-editor:session-1']).toBe(
      'Prod Shell'
    )
  })

  it('closes a session tab through the context menu', async () => {
    const sessionsDisconnect = vi.fn().mockResolvedValue(undefined)

    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([savedServer])
      },
      sessions: {
        disconnect: sessionsDisconnect
      }
    })

    seedSessionTab()
    renderEditorTabs()

    fireEvent.contextMenu(screen.getByText('alpha'))
    fireEvent.click(await screen.findByText('Close Tab'))

    await waitFor(() => {
      expect(sessionsDisconnect).toHaveBeenCalledWith('session-1')
    })
    expect(useSessionsStore.getState().tabs).toHaveLength(0)
    expect(useWorkbenchStore.getState().openDocuments).toEqual([])
  })
})
