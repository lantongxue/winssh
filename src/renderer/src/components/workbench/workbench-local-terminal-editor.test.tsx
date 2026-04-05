import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchLocalTerminalEditor } from '@/components/workbench/workbench-local-terminal-editor'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'

vi.mock('@/hooks/use-prefers-dark', () => ({
  usePrefersDark: () => true
}))

vi.mock('@/components/terminal-surface', () => ({
  TerminalSurface: () => <div data-testid="terminal-surface" />
}))

vi.mock('@/components/workbench/workbench-context', () => ({
  useWorkbenchContext: () => ({
    closeLocalTerminal: vi.fn().mockResolvedValue(undefined)
  })
}))

function renderLocalTerminalEditor() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkbenchLocalTerminalEditor terminalId="local-terminal-1" />
    </QueryClientProvider>
  )
}

describe('WorkbenchLocalTerminalEditor', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en-US')
    useLocalTerminalsStore.getState().clear()
    window.winsshApi = createWinsshApiMock()
  })

  it('renders the local terminal toolbar and terminal surface without SSH aux actions', () => {
    useLocalTerminalsStore.getState().addTerminal({
      cwd: '/Users/tester',
      shell: 'zsh',
      startedAt: new Date().toISOString(),
      status: 'running',
      terminalId: 'local-terminal-1',
      title: 'zsh'
    })

    renderLocalTerminalEditor()

    expect(screen.getByText('zsh')).toBeInTheDocument()
    expect(screen.getByText('zsh · /Users/tester')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByTestId('terminal-surface')).toBeInTheDocument()
    expect(screen.queryByText('Remote Files')).not.toBeInTheDocument()
    expect(screen.queryByText('Port Forwards')).not.toBeInTheDocument()
  })

  it('shows the exited banner while keeping the terminal surface mounted', () => {
    useLocalTerminalsStore.getState().addTerminal({
      cwd: '/Users/tester',
      lastMessage: 'Local terminal exited with code 0.',
      shell: 'zsh',
      startedAt: new Date().toISOString(),
      status: 'exited',
      terminalId: 'local-terminal-1',
      title: 'zsh'
    })

    renderLocalTerminalEditor()

    expect(screen.getByText('Shell exited')).toBeInTheDocument()
    expect(screen.getByText('Local terminal exited with code 0.')).toBeInTheDocument()
    expect(screen.getByTestId('terminal-surface')).toBeInTheDocument()
  })
})
