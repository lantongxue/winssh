import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { WorkbenchLogsPanel } from '@/components/workbench/workbench-logs-panel'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'

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

describe('WorkbenchLogsPanel', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en-US')
  })

  it('shows log entries and allows clearing and updating the path', async () => {
    const clear = vi.fn(async () => undefined)
    const updatePath = vi.fn(async (logFilePath: string) => ({ logFilePath }))

    window.winsshApi = createWinsshApiMock({
      logs: {
        clear,
        getState: async () => ({ logFilePath: '/tmp/winssh.log' }),
        list: async () => [
          {
            id: 'entry-1',
            level: 'info',
            message: 'renderer booted',
            raw: '{"message":"renderer booted"}',
            source: 'renderer',
            timestamp: '2026-04-30T12:00:00.000Z'
          }
        ],
        updatePath,
        write: async () => undefined
      }
    })

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <WorkbenchLogsPanel />
      </QueryClientProvider>
    )

    expect(await screen.findByText('renderer booted')).toBeInTheDocument()
    expect(screen.getByDisplayValue('/tmp/winssh.log')).toBeInTheDocument()

    fireEvent.change(screen.getByDisplayValue('/tmp/winssh.log'), {
      target: { value: '/tmp/next.log' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Path' }))

    await waitFor(() => {
      expect(updatePath).toHaveBeenCalledWith('/tmp/next.log')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Clear Logs' }))

    await waitFor(() => {
      expect(clear).toHaveBeenCalled()
    })
  })
})
