import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchProvider } from '@/components/workbench/workbench-context'
import { WorkbenchPrimarySidebar } from '@/components/workbench/workbench-primary-sidebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

const servers = [
  {
    authType: 'password' as const,
    brandId: null,
    createdAt: '',
    credentialId: null,
    customIconDataUrl: null,
    favorite: false,
    group: null,
    groupId: null,
    hasPassphrase: false,
    hasPassword: false,
    host: '103.205.241.248',
    id: 'server-1',
    jumpServerId: null,
    lastConnectedAt: null,
    name: '103.205.241.248',
    note: null,
    port: 22,
    privateKeyPath: null,
    tags: [],
    updatedAt: '',
    username: 'root'
  },
  {
    authType: 'password' as const,
    brandId: null,
    createdAt: '',
    credentialId: null,
    customIconDataUrl: null,
    favorite: false,
    group: null,
    groupId: null,
    hasPassphrase: false,
    hasPassword: false,
    host: '42.193.138.67',
    id: 'server-2',
    jumpServerId: null,
    lastConnectedAt: null,
    name: '42.193.138.67',
    note: null,
    port: 22,
    privateKeyPath: null,
    tags: [],
    updatedAt: '',
    username: 'root'
  },
  {
    authType: 'password' as const,
    brandId: null,
    createdAt: '',
    credentialId: null,
    customIconDataUrl: null,
    favorite: false,
    group: null,
    groupId: null,
    hasPassphrase: false,
    hasPassword: false,
    host: '156.239.46.90',
    id: 'server-3',
    jumpServerId: null,
    lastConnectedAt: null,
    name: '156.239.46.90',
    note: null,
    port: 22,
    privateKeyPath: null,
    tags: [],
    updatedAt: '',
    username: 'root'
  }
]

function renderPrimarySidebar() {
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
          <WorkbenchPrimarySidebar />
        </WorkbenchProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  useSessionsStore.getState().clear()
  useWorkbenchStore.getState().setSelectedExplorerNode('all-servers')

  window.winsshApi = createWinsshApiMock({
    groups: {
      list: vi.fn().mockResolvedValue([])
    },
    servers: {
      list: vi.fn().mockResolvedValue(servers),
      listRecent: vi.fn().mockResolvedValue([
        {
          connectedAt: new Date().toISOString(),
          host: '103.205.241.248',
          id: 'recent-1',
          serverId: 'server-1',
          serverName: '103.205.241.248'
        },
        {
          connectedAt: new Date().toISOString(),
          host: '42.193.138.67',
          id: 'recent-2',
          serverId: 'server-2',
          serverName: '42.193.138.67'
        }
      ])
    },
    tags: {
      list: vi.fn().mockResolvedValue([])
    }
  })
})

describe('WorkbenchPrimarySidebar', () => {
  it('keeps all servers at the top, recent at the bottom, and hides connected badges in recent', async () => {
    useSessionsStore.getState().addSession({
      connectedAt: new Date().toISOString(),
      currentPath: '/root',
      host: '103.205.241.248',
      port: 22,
      serverId: 'server-1',
      serverName: '103.205.241.248',
      sessionId: 'session-1',
      status: 'ready'
    })
    useSessionsStore.getState().addSession({
      connectedAt: new Date().toISOString(),
      currentPath: '/root',
      host: '42.193.138.67',
      port: 22,
      serverId: 'server-2',
      serverName: '42.193.138.67',
      sessionId: 'session-2',
      status: 'ready'
    })

    const { container } = renderPrimarySidebar()

    await screen.findAllByText('All Servers')
    const sections = Array.from(container.querySelectorAll('section'))
    expect(sections).not.toHaveLength(0)

    const allServersSection = sections[0]
    const recentSection = sections.at(-1)
    expect(allServersSection).toBeTruthy()
    expect(recentSection).toBeTruthy()
    expect(within(allServersSection as HTMLElement).getAllByText('All Servers')).not.toHaveLength(0)
    expect(within(recentSection as HTMLElement).getAllByText('Recent')).not.toHaveLength(0)

    expect(await screen.findAllByText('Connected')).toHaveLength(2)
    expect(
      screen.getAllByText('103.205.241.248')[0]?.closest('[data-active]')
    ).toHaveAttribute('data-active', 'false')
    expect(screen.getAllByText('42.193.138.67')[0]?.closest('[data-active]')).toHaveAttribute(
      'data-active',
      'false'
    )

    expect(within(recentSection as HTMLElement).queryByText('Connected')).not.toBeInTheDocument()
  })
})
