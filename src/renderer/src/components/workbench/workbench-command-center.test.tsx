import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchCommandCenter } from '@/components/workbench/workbench-command-center'
import { WorkbenchProvider } from '@/components/workbench/workbench-context'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

function renderCommandCenter() {
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
        <WorkbenchCommandCenter activeDocument={null} />
      </WorkbenchProvider>
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  useSessionsStore.getState().clear()
})

describe('WorkbenchCommandCenter quick connect', () => {
  it('shows a synthetic quick-connect action for a valid ssh user@host input', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([])
      }
    })

    useWorkbenchStore.getState().setQuickOpenOpen(true)
    renderCommandCenter()

    const input = await screen.findByPlaceholderText('Type ssh user@host, or jump to a saved item')
    fireEvent.change(input, { target: { value: 'ssh root@127.0.0.1' } })

    await waitFor(() => {
      expect(screen.getAllByText('Quick Connect').length).toBeGreaterThan(0)
    })
    expect(await screen.findByText('Connect to root@127.0.0.1')).toBeInTheDocument()
  })

  it('keeps saved server items on the existing open-editor behavior', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([
          {
            authType: 'password',
            createdAt: '',
            favorite: false,
            group: null,
            groupId: null,
            hasPassphrase: false,
            hasPassword: false,
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
        ])
      }
    })

    useWorkbenchStore.getState().setQuickOpenOpen(true)
    renderCommandCenter()

    fireEvent.click(await screen.findByText('alpha'))

    await waitFor(() => {
      expect(useWorkbenchStore.getState().activeDocumentId).toBe('server-editor:server-1')
    })
    expect(useWorkbenchStore.getState().quickOpenOpen).toBe(false)
  })
})
