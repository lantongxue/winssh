import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchExplorerHome } from '@/components/workbench/workbench-explorer-home'
import { WorkbenchProvider } from '@/components/workbench/workbench-context'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'
import { useWorkbenchStore } from '@/store/workbench-store'

function renderExplorerHome() {
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
        <WorkbenchExplorerHome />
      </WorkbenchProvider>
    </QueryClientProvider>
  )
}

describe('WorkbenchExplorerHome', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en-US')
    useLocalTerminalsStore.getState().clear()
    useWorkbenchStore.getState().reset()
  })

  it('opens a real local terminal tab from the hero action', async () => {
    const createLocalTerminal = vi.fn().mockResolvedValue({
      cwd: '/Users/tester',
      shell: 'zsh',
      startedAt: new Date().toISOString(),
      status: 'running' as const,
      terminalId: 'local-terminal-1',
      title: 'zsh'
    })

    window.winsshApi = createWinsshApiMock({
      localTerminals: {
        create: createLocalTerminal
      }
    })

    renderExplorerHome()
    fireEvent.click(screen.getByRole('button', { name: 'Open Local Terminal' }))

    await waitFor(() => {
      expect(createLocalTerminal).toHaveBeenCalledTimes(1)
    })
    expect(useWorkbenchStore.getState().activeDocumentId).toBe(
      'local-terminal-editor:local-terminal-1'
    )
  })
})
