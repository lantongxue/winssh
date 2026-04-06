import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { WorkbenchEditorTabs } from '@/components/workbench/workbench-editor-tabs'
import { WorkbenchProvider } from '@/components/workbench/workbench-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  createServerEditorDocument,
  createSessionEditorDocument,
  createSettingsEditorDocument
} from '@/lib/workbench'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

const clipboard = {
  writeText: vi.fn()
}

const savedServer = {
  authType: 'password' as const,
  brandId: 'ubuntu' as const,
  createdAt: '',
  credentialId: null,
  customIconDataUrl: null,
  favorite: false,
  group: null,
  groupId: null,
  hasPassphrase: false,
  hasPassword: true,
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

function createDragDataTransfer() {
  const store = new Map<string, string>()

  return {
    dropEffect: 'move',
    effectAllowed: 'move',
    getData: (type: string) => store.get(type) ?? '',
    setData: (type: string, value: string) => {
      store.set(type, value)
    }
  }
}

function createRect(left: number, width: number): DOMRect {
  return {
    bottom: 36,
    height: 36,
    left,
    right: left + width,
    top: 0,
    width,
    x: left,
    y: 0,
    toJSON: () => ({})
  } as DOMRect
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
      <TooltipProvider>
        <WorkbenchProvider>
          <WorkbenchEditorTabs />
        </WorkbenchProvider>
      </TooltipProvider>
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
  clipboard.writeText.mockReset()
  clipboard.writeText.mockResolvedValue(undefined)
  vi.mocked(toast.error).mockReset()
  vi.mocked(toast.success).mockReset()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: clipboard
  })
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

  it('copies the current session host through the context menu', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([savedServer])
      }
    })

    seedSessionTab()
    renderEditorTabs()

    fireEvent.contextMenu(screen.getByText('alpha'))
    fireEvent.click(await screen.findByText('Copy IP'))

    await waitFor(() => {
      expect(clipboard.writeText).toHaveBeenCalledWith('127.0.0.1')
    })
    expect(toast.success).toHaveBeenCalledWith('IP copied.')
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

  it('shows the server brand icon in both session and server editor tabs', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([savedServer])
      }
    })

    seedSessionTab()
    useWorkbenchStore.getState().openDocument(createServerEditorDocument(savedServer.id))
    const { container } = renderEditorTabs()

    await waitFor(() => {
      expect(container.querySelectorAll('svg[data-icon="ubuntu"]')).toHaveLength(2)
    })
  })

  it('moves the left tab to the right when dropped on the trailing half of the target tab', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([savedServer])
      }
    })

    useWorkbenchStore.getState().openDocument(createSettingsEditorDocument())
    useWorkbenchStore.getState().openDocument(createServerEditorDocument(savedServer.id))
    renderEditorTabs()

    const settingsTab = (await screen.findByText('Settings')).closest('button')
    const serverTab = (await screen.findByText('alpha')).closest('button')

    expect(settingsTab).toBeTruthy()
    expect(serverTab).toBeTruthy()

    Object.defineProperty(serverTab as HTMLElement, 'getBoundingClientRect', {
      configurable: true,
      value: () => createRect(100, 100)
    })

    const dataTransfer = createDragDataTransfer()

    fireEvent.dragStart(settingsTab as HTMLElement, { dataTransfer })
    fireEvent.drop(serverTab as HTMLElement, { clientX: 190, dataTransfer })

    expect(useWorkbenchStore.getState().openDocuments.map((document) => document.id)).toEqual([
      'server-editor:server-1',
      'settings-editor'
    ])
  })
})
