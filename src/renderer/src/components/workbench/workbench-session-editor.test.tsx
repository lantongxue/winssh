import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { WorkbenchSessionEditor } from '@/components/workbench/workbench-session-editor'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'

vi.mock('@/hooks/use-prefers-dark', () => ({
  usePrefersDark: () => true
}))

vi.mock('@/components/terminal-pane', () => ({
  TerminalPane: () => <div data-testid="terminal-pane" />
}))

vi.mock('@/components/sftp-panel', () => ({
  SftpPanel: () => <div data-testid="sftp-panel" />
}))

vi.mock('@/components/port-forward-panel', () => ({
  PortForwardPanel: () => <div data-testid="port-forward-panel" />
}))

vi.mock('@/components/workbench/workbench-context', () => ({
  useWorkbenchContext: () => ({
    disconnectSession: vi.fn().mockResolvedValue(undefined),
    reconnectSession: vi.fn().mockResolvedValue(undefined)
  })
}))

function renderSessionEditor() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkbenchSessionEditor sessionId="session-1" />
    </QueryClientProvider>
  )
}

describe('WorkbenchSessionEditor', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en-US')
    useSessionsStore.getState().clear()
    window.winsshApi = createWinsshApiMock()
    useSessionsStore.getState().addSession({
      connectedAt: new Date().toISOString(),
      currentPath: '/root',
      host: '127.0.0.1',
      port: 22,
      serverId: 'server-1',
      serverName: 'alpha',
      sessionId: 'session-1',
      status: 'ready'
    })
  })

  it('renders the SFTP aux view inside a resizable split layout', async () => {
    useSessionsStore.getState().setAuxView('session-1', 'sftp')

    renderSessionEditor()

    expect(screen.getByTestId('terminal-pane')).toBeInTheDocument()
    expect(screen.getByTestId('sftp-panel')).toBeInTheDocument()
    expect(screen.getByRole('separator')).toBeInTheDocument()
  })
})
