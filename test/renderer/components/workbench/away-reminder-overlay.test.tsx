import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchAwayReminderOverlay } from '@/components/workbench/workbench-away-reminder-overlay'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'
import { useAwayReminderStore } from '@/store/away-reminder-store'
import { useSessionsStore } from '@/store/sessions-store'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'
import { useWorkbenchStore } from '@/store/workbench-store'
import { createLocalTerminalEditorDocument, createSessionEditorDocument } from '@/lib/workbench'
import type { Server } from '@shared/types'

const createdServer: Server = {
  authType: 'password',
  createdAt: '',
  credentialId: null,
  customIconDataUrl: null,
  favorite: false,
  groupId: null,
  hasPassphrase: false,
  hasPassword: false,
  host: '203.0.113.10',
  id: 'server-1',
  jumpServerId: null,
  lastConnectedAt: null,
  name: 'Test Host',
  note: null,
  port: 22,
  privateKeyPath: null,
  tags: [],
  updatedAt: '',
  username: 'ops',
  captureCommandHistory: false,
  brandId: null,
  group: null
}

function renderOverlay() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkbenchAwayReminderOverlay />
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useAwayReminderStore.getState().reset()
  useSessionsStore.getState().clear()
  useLocalTerminalsStore.getState().clear()
  useWorkbenchStore.getState().reset()
})

describe('WorkbenchAwayReminderOverlay', () => {
  it('does not render when overlay is not visible', () => {
    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({ awayReminderEnabled: true })
      }
    })
    useWorkbenchStore.getState().openDocument(createSessionEditorDocument('session-1'))

    useAwayReminderStore.setState({ overlayVisible: false })
    renderOverlay()

    expect(screen.queryByText('Safety Reminder')).not.toBeInTheDocument()
  })

  it('does not render when awayReminderEnabled is false', async () => {
    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({ awayReminderEnabled: false })
      }
    })
    useWorkbenchStore.getState().openDocument(createSessionEditorDocument('session-1'))
    useAwayReminderStore.setState({ overlayVisible: true })

    renderOverlay()

    await waitFor(() => {
      expect(screen.queryByText('Safety Reminder')).not.toBeInTheDocument()
    })
  })

  it('does not render when there are no open documents', () => {
    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({ awayReminderEnabled: true })
      }
    })
    useAwayReminderStore.setState({ overlayVisible: true })

    renderOverlay()

    expect(screen.queryByText('Safety Reminder')).not.toBeInTheDocument()
  })

  it('renders overlay with title and description when visible with open documents', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([createdServer])
      },
      settings: {
        get: vi.fn().mockResolvedValue({ awayReminderEnabled: true })
      }
    })

    useSessionsStore.getState().addSession({
      connectedAt: new Date().toISOString(),
      currentPath: '/root',
      host: '203.0.113.10',
      port: 22,
      serverId: 'server-1',
      serverName: 'Test Host',
      sessionId: 'session-1',
      status: 'ready'
    })
    useWorkbenchStore.getState().openDocument(createSessionEditorDocument('session-1'))
    useAwayReminderStore.setState({ overlayVisible: true })

    renderOverlay()

    await waitFor(() => {
      expect(screen.getByText('Safety Reminder')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Confirm that you are still present to continue the current connection.')
    ).toBeInTheDocument()
    expect(screen.getByText('Confirm Continue')).toBeInTheDocument()
  })

  it('displays SSH session identity with username from servers cache', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([createdServer])
      },
      settings: {
        get: vi.fn().mockResolvedValue({ awayReminderEnabled: true })
      }
    })

    useSessionsStore.getState().addSession({
      connectedAt: new Date().toISOString(),
      currentPath: '/root',
      host: '203.0.113.10',
      port: 22,
      serverId: 'server-1',
      serverName: 'Test Host',
      sessionId: 'session-1',
      status: 'ready'
    })
    useWorkbenchStore.getState().openDocument(createSessionEditorDocument('session-1'))
    useAwayReminderStore.setState({ overlayVisible: true })

    renderOverlay()

    await waitFor(() => {
      expect(screen.getByText('SSH Session')).toBeInTheDocument()
      expect(screen.getByText('ops')).toBeInTheDocument()
    })
  })

  it('displays local terminal identity with shell type', async () => {
    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({ awayReminderEnabled: true })
      }
    })

    useLocalTerminalsStore.getState().addTerminal({
      cwd: '/Users/tester',
      shell: 'zsh',
      startedAt: new Date().toISOString(),
      status: 'running',
      terminalId: 'local-terminal-1',
      title: 'zsh'
    })
    useWorkbenchStore.getState().openDocument(createLocalTerminalEditorDocument('local-terminal-1'))
    useAwayReminderStore.setState({ overlayVisible: true })

    renderOverlay()

    await waitFor(() => {
      expect(screen.getByText('Local Terminal')).toBeInTheDocument()
    })
    expect(screen.getByText('zsh')).toBeInTheDocument()
  })

  it('calls dismissOverlay when confirm button is clicked', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([createdServer])
      },
      settings: {
        get: vi.fn().mockResolvedValue({ awayReminderEnabled: true })
      }
    })

    useSessionsStore.getState().addSession({
      connectedAt: new Date().toISOString(),
      currentPath: '/root',
      host: '203.0.113.10',
      port: 22,
      serverId: 'server-1',
      serverName: 'Test Host',
      sessionId: 'session-1',
      status: 'ready'
    })
    useWorkbenchStore.getState().openDocument(createSessionEditorDocument('session-1'))
    useAwayReminderStore.setState({ overlayVisible: true })

    renderOverlay()

    await waitFor(() => {
      expect(screen.getByText('Confirm Continue')).toBeInTheDocument()
    })

    expect(useAwayReminderStore.getState().overlayVisible).toBe(true)

    fireEvent.click(screen.getByText('Confirm Continue'))

    expect(useAwayReminderStore.getState().overlayVisible).toBe(false)
  })

  it('calls dismissOverlay when Enter key is pressed', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([createdServer])
      },
      settings: {
        get: vi.fn().mockResolvedValue({ awayReminderEnabled: true })
      }
    })

    useSessionsStore.getState().addSession({
      connectedAt: new Date().toISOString(),
      currentPath: '/root',
      host: '203.0.113.10',
      port: 22,
      serverId: 'server-1',
      serverName: 'Test Host',
      sessionId: 'session-1',
      status: 'ready'
    })
    useWorkbenchStore.getState().openDocument(createSessionEditorDocument('session-1'))
    useAwayReminderStore.setState({ overlayVisible: true })

    renderOverlay()

    await waitFor(() => {
      expect(screen.getByText('Safety Reminder')).toBeInTheDocument()
    })

    expect(useAwayReminderStore.getState().overlayVisible).toBe(true)

    fireEvent.keyDown(screen.getByRole('button', { name: 'Confirm Continue' }).closest('[class*="z-40"]')!, { key: 'Enter' })

    expect(useAwayReminderStore.getState().overlayVisible).toBe(false)
  })

  it('shows server identity section label', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([createdServer])
      },
      settings: {
        get: vi.fn().mockResolvedValue({ awayReminderEnabled: true })
      }
    })

    useSessionsStore.getState().addSession({
      connectedAt: new Date().toISOString(),
      currentPath: '/root',
      host: '203.0.113.10',
      port: 22,
      serverId: 'server-1',
      serverName: 'Test Host',
      sessionId: 'session-1',
      status: 'ready'
    })
    useWorkbenchStore.getState().openDocument(createSessionEditorDocument('session-1'))
    useAwayReminderStore.setState({ overlayVisible: true })

    renderOverlay()

    await waitFor(() => {
      expect(screen.getByText('Server Identity')).toBeInTheDocument()
    })
  })

  it('shows shell type label for local terminals', async () => {
    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({ awayReminderEnabled: true })
      }
    })

    useLocalTerminalsStore.getState().addTerminal({
      cwd: '/Users/tester',
      shell: 'powershell',
      startedAt: new Date().toISOString(),
      status: 'running',
      terminalId: 'local-terminal-1',
      title: 'powershell'
    })
    useWorkbenchStore.getState().openDocument(createLocalTerminalEditorDocument('local-terminal-1'))
    useAwayReminderStore.setState({ overlayVisible: true })

    renderOverlay()

    await waitFor(() => {
      expect(screen.getByText('Shell Type')).toBeInTheDocument()
    })
    expect(screen.getByText('powershell')).toBeInTheDocument()
  })

  it('does not call dismissOverlay on other key presses', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([createdServer])
      },
      settings: {
        get: vi.fn().mockResolvedValue({ awayReminderEnabled: true })
      }
    })

    useSessionsStore.getState().addSession({
      connectedAt: new Date().toISOString(),
      currentPath: '/root',
      host: '203.0.113.10',
      port: 22,
      serverId: 'server-1',
      serverName: 'Test Host',
      sessionId: 'session-1',
      status: 'ready'
    })
    useWorkbenchStore.getState().openDocument(createSessionEditorDocument('session-1'))
    useAwayReminderStore.setState({ overlayVisible: true })

    renderOverlay()

    await waitFor(() => {
      expect(screen.getByText('Safety Reminder')).toBeInTheDocument()
    })

    expect(useAwayReminderStore.getState().overlayVisible).toBe(true)

    fireEvent.keyDown(screen.getByRole('button', { name: 'Confirm Continue' }).closest('[class*="z-40"]')!, { key: 'Escape' })

    expect(useAwayReminderStore.getState().overlayVisible).toBe(true)
  })
})