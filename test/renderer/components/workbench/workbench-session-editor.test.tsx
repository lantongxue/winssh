import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WorkbenchSessionEditor } from '@/components/workbench/workbench-session-editor'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

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

const clipboard = {
  writeText: vi.fn()
}

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
      <TooltipProvider>
        <WorkbenchSessionEditor sessionId="session-1" />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

describe('WorkbenchSessionEditor', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en-US')
    useSessionsStore.getState().clear()
    window.winsshApi = createWinsshApiMock()
    clipboard.writeText.mockReset()
    clipboard.writeText.mockResolvedValue(undefined)
    vi.mocked(toast.error).mockReset()
    vi.mocked(toast.success).mockReset()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: clipboard
    })
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

  it('shows the resource monitor cards and lets users collapse the toolbar overview', async () => {
    renderSessionEditor()

    expect(await screen.findByText('CPU')).toBeInTheDocument()
    expect(screen.getByText('Memory')).toBeInTheDocument()
    expect(screen.getByText('Network')).toBeInTheDocument()
    expect(screen.getByText('Disk (/)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Resource Monitor' }))

    await waitFor(() => {
      expect(screen.getByTestId('session-resource-monitor')).toHaveAttribute(
        'data-state',
        'collapsed'
      )
    })

    expect(screen.queryByText('Memory')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resource Monitor' })).toBeInTheDocument()
  })

  it('copies the session host when the header summary is clicked', async () => {
    renderSessionEditor()

    fireEvent.click(screen.getByRole('button', { name: 'Copy IP' }))

    await waitFor(() => {
      expect(clipboard.writeText).toHaveBeenCalledWith('127.0.0.1')
    })
    expect(toast.success).toHaveBeenCalledWith('IP copied.')
  })
})
