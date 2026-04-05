import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n'
import { WorkbenchShell } from '@/components/workbench/workbench-shell'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  createLocalTerminalEditorDocument,
  createServerEditorDocument,
  createSessionEditorDocument
} from '@/lib/workbench'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

const { localTerminalEditorSpy, sessionEditorSpy } = vi.hoisted(() => ({
  localTerminalEditorSpy: vi.fn(),
  sessionEditorSpy: vi.fn()
}))

vi.mock('@/components/workbench/workbench-session-editor', () => ({
  WorkbenchSessionEditor: (props: { active?: boolean; sessionId: string }) => {
    sessionEditorSpy(props)
    return (
      <div
        data-active={String(Boolean(props.active))}
        data-testid={`session-editor:${props.sessionId}`}
      />
    )
  }
}))

vi.mock('@/components/workbench/workbench-local-terminal-editor', () => ({
  WorkbenchLocalTerminalEditor: (props: { active?: boolean; terminalId: string }) => {
    localTerminalEditorSpy(props)
    return (
      <div
        data-active={String(Boolean(props.active))}
        data-testid={`local-terminal-editor:${props.terminalId}`}
      />
    )
  }
}))

function renderWorkbenchShell(initialEntry = '/servers') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WorkbenchShell />
        </TooltipProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
}

const createdServer = {
  authType: 'password' as const,
  createdAt: '',
  credentialId: null,
  favorite: false,
  group: null,
  groupId: null,
  hasPassphrase: false,
  hasPassword: false,
  host: '203.0.113.10',
  id: 'server-1',
  jumpServerId: null,
  lastConnectedAt: null,
  name: 'Shortcut Host',
  note: '',
  port: 22,
  privateKeyPath: null,
  tags: [],
  updatedAt: '',
  username: 'ops'
}

const activeSession = {
  connectedAt: new Date().toISOString(),
  currentPath: '/root',
  host: '203.0.113.10',
  port: 22,
  serverId: 'server-1',
  serverName: 'Shortcut Host',
  sessionId: 'session-1',
  status: 'ready' as const
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  useSessionsStore.getState().clear()
  useLocalTerminalsStore.getState().clear()
  sessionEditorSpy.mockReset()
  localTerminalEditorSpy.mockReset()
})

describe('WorkbenchShell shortcuts', () => {
  it('saves the active server editor with Cmd+S', async () => {
    const createServer = vi.fn().mockResolvedValue(createdServer)

    window.winsshApi = createWinsshApiMock({
      servers: {
        create: createServer,
        list: vi.fn().mockResolvedValue([])
      }
    })

    useWorkbenchStore.getState().openDocument(createServerEditorDocument())
    renderWorkbenchShell()

    fireEvent.change(await screen.findByLabelText('Name'), {
      target: { value: 'Shortcut Host' }
    })
    fireEvent.change(screen.getByLabelText('Host'), {
      target: { value: '203.0.113.10' }
    })
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'ops' }
    })

    fireEvent.keyDown(window, { key: 's', metaKey: true })

    await waitFor(() => {
      expect(createServer).toHaveBeenCalledWith(
        expect.objectContaining({
          host: '203.0.113.10',
          name: 'Shortcut Host',
          username: 'ops'
        })
      )
    })
  })

  it('opens the settings editor with Cmd+,', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderWorkbenchShell()

    fireEvent.keyDown(window, { key: ',', metaKey: true })

    await waitFor(() => {
      const state = useWorkbenchStore.getState()
      expect(state.activeActivityId).toBe('settings')
      expect(state.activeDocumentId).toBe('settings-editor')
    })
  })

  it('closes the active server editor with Cmd+W', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([])
      }
    })

    useWorkbenchStore.getState().openDocument(createServerEditorDocument())
    renderWorkbenchShell()

    fireEvent.keyDown(window, { key: 'w', metaKey: true })

    await waitFor(() => {
      const state = useWorkbenchStore.getState()
      expect(state.openDocuments).toEqual([])
      expect(state.activeDocumentId).toBeNull()
    })
  })

  it('disconnects the active session with Cmd+W', async () => {
    const disconnect = vi.fn().mockResolvedValue(undefined)

    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([createdServer])
      },
      sessions: {
        disconnect
      }
    })

    useSessionsStore.getState().addSession(activeSession)
    useWorkbenchStore.getState().openDocument(createSessionEditorDocument(activeSession.sessionId))
    renderWorkbenchShell('/sessions')

    fireEvent.keyDown(window, { key: 'w', metaKey: true })

    await waitFor(() => {
      expect(disconnect).toHaveBeenCalledWith(activeSession.sessionId)
      expect(useSessionsStore.getState().tabs).toEqual([])
      expect(useWorkbenchStore.getState().openDocuments).toEqual([])
    })
  })

  it('closes the active local terminal with Cmd+W', async () => {
    const closeLocalTerminal = vi.fn().mockResolvedValue(undefined)

    window.winsshApi = createWinsshApiMock({
      localTerminals: {
        close: closeLocalTerminal
      },
      servers: {
        list: vi.fn().mockResolvedValue([])
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
    renderWorkbenchShell('/sessions')

    fireEvent.keyDown(window, { key: 'w', metaKey: true })

    await waitFor(() => {
      expect(closeLocalTerminal).toHaveBeenCalledWith('local-terminal-1')
      expect(useLocalTerminalsStore.getState().tabs).toEqual([])
      expect(useWorkbenchStore.getState().openDocuments).toEqual([])
    })
  })
})

describe('WorkbenchShell terminal document visibility', () => {
  it('keeps inactive terminal documents mounted and updates their active state', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([createdServer])
      }
    })

    useSessionsStore.getState().addSession(activeSession)
    useLocalTerminalsStore.getState().addTerminal({
      cwd: '/Users/tester',
      shell: 'zsh',
      startedAt: new Date().toISOString(),
      status: 'running',
      terminalId: 'local-terminal-1',
      title: 'zsh'
    })

    useWorkbenchStore.getState().openDocument(createSessionEditorDocument(activeSession.sessionId))
    useWorkbenchStore.getState().openDocument(createLocalTerminalEditorDocument('local-terminal-1'))
    useWorkbenchStore.getState().setActiveDocument(`session-editor:${activeSession.sessionId}`)

    renderWorkbenchShell('/sessions')

    const sessionEditor = await screen.findByTestId(`session-editor:${activeSession.sessionId}`)
    const localTerminalEditor = await screen.findByTestId('local-terminal-editor:local-terminal-1')

    expect(sessionEditor).toHaveAttribute('data-active', 'true')
    expect(localTerminalEditor).toHaveAttribute('data-active', 'false')
    expect(sessionEditorSpy).toHaveBeenCalledWith({
      active: true,
      sessionId: activeSession.sessionId
    })
    expect(localTerminalEditorSpy).toHaveBeenCalledWith({
      active: false,
      terminalId: 'local-terminal-1'
    })

    const sessionWrapper = sessionEditor.parentElement
    const localTerminalWrapper = localTerminalEditor.parentElement
    expect(sessionWrapper).toHaveClass('relative')
    expect(sessionWrapper).not.toHaveClass('hidden')
    expect(localTerminalWrapper).toHaveClass('absolute')
    expect(localTerminalWrapper).toHaveClass('invisible')
    expect(localTerminalWrapper).not.toHaveClass('hidden')

    act(() => {
      useWorkbenchStore.getState().setActiveDocument('local-terminal-editor:local-terminal-1')
    })

    await waitFor(() => {
      expect(sessionEditor).toHaveAttribute('data-active', 'false')
      expect(localTerminalEditor).toHaveAttribute('data-active', 'true')
    })

    expect(sessionEditor.parentElement).toHaveClass('absolute')
    expect(sessionEditor.parentElement).toHaveClass('invisible')
    expect(localTerminalEditor.parentElement).toHaveClass('relative')
  })
})
