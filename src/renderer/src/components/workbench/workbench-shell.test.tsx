import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n'
import { WorkbenchShell } from '@/components/workbench/workbench-shell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createServerEditorDocument } from '@/lib/workbench'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

function renderWorkbenchShell() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <MemoryRouter initialEntries={['/servers']}>
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
  lastConnectedAt: null,
  name: 'Shortcut Host',
  note: '',
  port: 22,
  privateKeyPath: null,
  tags: [],
  updatedAt: '',
  username: 'ops'
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  useSessionsStore.getState().clear()
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
})
