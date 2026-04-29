import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchProvider } from '@/components/workbench/workbench-context'
import { WorkbenchPrimarySidebar } from '@/components/workbench/workbench-primary-sidebar'
import { WorkbenchQuickInput } from '@/components/workbench/workbench-quick-input'
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

function createDragDataTransfer() {
  const store = new Map<string, string>()

  return {
    dropEffect: 'move',
    effectAllowed: 'move',
    getData: (type: string) => store.get(type) ?? '',
    setData: (type: string, value: string) => {
      store.set(type, value)
    }
  }
}

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
          <WorkbenchQuickInput />
        </WorkbenchProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  useSessionsStore.getState().clear()
  useWorkbenchStore.getState().setSelectedExplorerNode('home')

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
  it('shows ungrouped servers directly under server management and hides connected badges in recent', async () => {
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

    await screen.findByText('Server Management')
    const sections = Array.from(container.querySelectorAll('section'))
    expect(sections).not.toHaveLength(0)

    const managementSection = sections[0]
    const recentSection = sections.at(-1)
    expect(managementSection).toBeTruthy()
    expect(recentSection).toBeTruthy()
    expect(within(managementSection as HTMLElement).getAllByText('Server Management')).toHaveLength(
      1
    )
    expect(within(managementSection as HTMLElement).queryByText('Ungrouped')).not.toBeInTheDocument()
    expect(within(recentSection as HTMLElement).getAllByText('Recent')).toHaveLength(1)
    expect(await screen.findAllByText('103.205.241.248')).toHaveLength(2)
    expect(await screen.findAllByText('Connected')).toHaveLength(2)

    expect(screen.getAllByText('103.205.241.248')[0]?.closest('[data-active]')).toHaveAttribute(
      'data-active',
      'false'
    )
    expect(screen.getAllByText('42.193.138.67')[0]?.closest('[data-active]')).toHaveAttribute(
      'data-active',
      'false'
    )

    expect(within(recentSection as HTMLElement).queryByText('Connected')).not.toBeInTheDocument()
  })

  it('lets top-level server management and tags headers enter the selected state', async () => {
    window.winsshApi = createWinsshApiMock({
      groups: {
        list: vi.fn().mockResolvedValue([
          {
            color: 'red',
            createdAt: '',
            id: 'group-1',
            name: 'AA',
            updatedAt: ''
          }
        ])
      },
      servers: {
        list: vi.fn().mockResolvedValue(servers),
        listRecent: vi.fn().mockResolvedValue([])
      },
      tags: {
        list: vi.fn().mockResolvedValue([
          {
            color: 'blue',
            createdAt: '',
            id: 'tag-1',
            name: 'HK-CN2',
            updatedAt: ''
          }
        ])
      }
    })

    renderPrimarySidebar()

    const managementLabel = await screen.findByText('Server Management')
    const tagsLabel = await screen.findByText('Tags')

    const managementHeader = managementLabel.closest('[data-active]')
    const tagsHeader = tagsLabel.closest('[data-active]')

    expect(managementHeader).toHaveAttribute('data-active', 'false')
    expect(tagsHeader).toHaveAttribute('data-active', 'false')

    fireEvent.click(managementLabel)
    expect(managementHeader).toHaveAttribute('data-active', 'true')

    fireEvent.click(tagsLabel)
    expect(tagsHeader).toHaveAttribute('data-active', 'true')
  })

  it('collapses top-level sections on double click', async () => {
    // Clear favorites to simplify test (ungrouped servers only)
    const noFavoritesServers = [
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
        host: '10.0.0.1',
        id: 'ungrouped-only',
        jumpServerId: null,
        lastConnectedAt: null,
        name: 'Ungrouped Only',
        note: null,
        port: 22,
        privateKeyPath: null,
        tags: [],
        updatedAt: '',
        username: 'root'
      }
    ]

    window.winsshApi = createWinsshApiMock({
      groups: {
        list: vi.fn().mockResolvedValue([])
      },
      servers: {
        list: vi.fn().mockResolvedValue(noFavoritesServers),
        listRecent: vi.fn().mockResolvedValue([])
      },
      tags: {
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderPrimarySidebar()

    const managementLabel = await screen.findByText('Server Management')
    const serverLabel = await screen.findByText('Ungrouped Only')
    expect(serverLabel).toBeInTheDocument()

    fireEvent.doubleClick(managementLabel)
    expect(screen.queryByText('Ungrouped Only')).not.toBeInTheDocument()
  })

  it('toggles grouped children on double click', async () => {
    window.winsshApi = createWinsshApiMock({
      groups: {
        list: vi.fn().mockResolvedValue([
          {
            color: 'red',
            createdAt: '',
            id: 'group-1',
            name: 'AA',
            updatedAt: ''
          }
        ])
      },
      servers: {
        list: vi.fn().mockResolvedValue([
          {
            ...servers[0],
            group: {
              color: 'red',
              createdAt: '',
              id: 'group-1',
              name: 'AA',
              updatedAt: ''
            },
            groupId: 'group-1'
          }
        ]),
        listRecent: vi.fn().mockResolvedValue([])
      },
      tags: {
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderPrimarySidebar()

    const groupLabel = await screen.findByText('AA')
    expect(screen.queryByText('103.205.241.248')).not.toBeInTheDocument()

    fireEvent.doubleClick(groupLabel)
    expect(await screen.findByText('103.205.241.248')).toBeInTheDocument()

    fireEvent.doubleClick(groupLabel)
    expect(screen.queryByText('103.205.241.248')).not.toBeInTheDocument()
  })

  it('always shows server tags when a server has tags', async () => {
    window.winsshApi = createWinsshApiMock({
      groups: {
        list: vi.fn().mockResolvedValue([])
      },
      servers: {
        list: vi.fn().mockResolvedValue([
          {
            ...servers[0],
            tags: [
              {
                color: 'blue',
                createdAt: '',
                id: 'tag-1',
                name: 'HK-CN2',
                updatedAt: ''
              }
            ]
          }
        ]),
        listRecent: vi.fn().mockResolvedValue([])
      },
      tags: {
        list: vi.fn().mockResolvedValue([
          {
            color: 'blue',
            createdAt: '',
            id: 'tag-1',
            name: 'HK-CN2',
            updatedAt: ''
          }
        ])
      }
    })

    renderPrimarySidebar()

    const serverName = await screen.findByText('103.205.241.248')
    const serverRow = serverName.closest('[role="button"]')

    expect(serverRow).toBeTruthy()
    expect(within(serverRow as HTMLElement).getByText('HK-CN2')).toBeInTheDocument()
  })

  it('moves a server to another group when dropped on a group node', async () => {
    const updateServer = vi.fn().mockImplementation(async (id, input) => ({
      ...servers[0],
      ...input,
      group: {
        color: 'red',
        createdAt: '',
        id: 'group-1',
        name: 'AA',
        updatedAt: ''
      },
      groupId: 'group-1',
      id,
      tags: []
    }))

    window.winsshApi = createWinsshApiMock({
      groups: {
        list: vi.fn().mockResolvedValue([
          {
            color: 'red',
            createdAt: '',
            id: 'group-1',
            name: 'AA',
            updatedAt: ''
          }
        ])
      },
      servers: {
        list: vi.fn().mockResolvedValue([servers[0]]),
        listRecent: vi.fn().mockResolvedValue([]),
        update: updateServer
      },
      tags: {
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderPrimarySidebar()

    const serverRow = (await screen.findByText('103.205.241.248')).closest('[role="button"]')
    const groupRow = (await screen.findByText('AA')).closest('[role="button"]')

    expect(serverRow).toBeTruthy()
    expect(groupRow).toBeTruthy()

    const dataTransfer = createDragDataTransfer()

    fireEvent.dragStart(serverRow as HTMLElement, { dataTransfer })
    fireEvent.dragOver(groupRow as HTMLElement, { dataTransfer })
    fireEvent.drop(groupRow as HTMLElement, { dataTransfer })

    await waitFor(() => {
      expect(updateServer).toHaveBeenCalledWith(
        'server-1',
        expect.objectContaining({
          authType: 'password',
          groupId: 'group-1',
          host: '103.205.241.248',
          name: '103.205.241.248',
          tagIds: [],
          username: 'root'
        })
      )
    })
  })

  it('moves a server from the context menu group submenu', async () => {
    const updateServer = vi.fn().mockImplementation(async (id, input) => ({
      ...servers[0],
      ...input,
      group: {
        color: 'red',
        createdAt: '',
        id: 'group-1',
        name: 'AA',
        updatedAt: ''
      },
      groupId: 'group-1',
      id,
      tags: []
    }))

    window.winsshApi = createWinsshApiMock({
      groups: {
        list: vi.fn().mockResolvedValue([
          {
            color: 'red',
            createdAt: '',
            id: 'group-1',
            name: 'AA',
            updatedAt: ''
          }
        ])
      },
      servers: {
        list: vi.fn().mockResolvedValue([servers[0]]),
        listRecent: vi.fn().mockResolvedValue([]),
        update: updateServer
      },
      tags: {
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderPrimarySidebar()

    const serverRow = (await screen.findByText('103.205.241.248')).closest('[role="button"]')
    expect(serverRow).toBeTruthy()

    fireEvent.contextMenu(serverRow as HTMLElement)

    const moveTrigger = await screen.findByText('Move to Group')
    fireEvent.pointerMove(moveTrigger)
    fireEvent.click(moveTrigger)

    await waitFor(() => {
      expect(document.querySelector('[data-slot="context-menu-sub-content"]')).toBeTruthy()
    })

    const mainMenu = document.querySelector('[data-slot="context-menu-content"]')
    const groupMenu = document.querySelector('[data-slot="context-menu-sub-content"]')
    expect(mainMenu).toBeTruthy()
    expect(groupMenu).toBeTruthy()
    expect(mainMenu?.contains(groupMenu as Node)).toBe(false)

    fireEvent.click(within(groupMenu as HTMLElement).getByText('AA'))

    await waitFor(() => {
      expect(updateServer).toHaveBeenCalledWith(
        'server-1',
        expect.objectContaining({
          groupId: 'group-1'
        })
      )
    })
  })

  it('opens a grouped new connection from the group context menu', async () => {
    window.winsshApi = createWinsshApiMock({
      groups: {
        list: vi.fn().mockResolvedValue([
          {
            color: 'red',
            createdAt: '',
            id: 'group-1',
            name: 'AA',
            updatedAt: ''
          }
        ])
      },
      servers: {
        list: vi.fn().mockResolvedValue([]),
        listRecent: vi.fn().mockResolvedValue([])
      },
      tags: {
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderPrimarySidebar()

    const groupRow = (await screen.findByText('AA')).closest('[role="button"]')
    expect(groupRow).toBeTruthy()

    fireEvent.contextMenu(groupRow as HTMLElement)
    fireEvent.click(await screen.findByText('New Connection'))

    const state = useWorkbenchStore.getState()
    expect(state.activeDocumentId).toBe('server-editor:new:group-1')
    expect(state.openDocuments).toEqual([
      expect.objectContaining({
        id: 'server-editor:new:group-1',
        initialGroupId: 'group-1',
        kind: 'server-editor',
        serverId: null
      })
    ])
    expect(state.selectedExplorerNode).toBe('group:group-1')
  })

  it('renders nested groups and servers assigned to a subgroup', async () => {
    window.winsshApi = createWinsshApiMock({
      groups: {
        list: vi.fn().mockResolvedValue([
          {
            color: 'red',
            createdAt: '',
            id: 'group-parent',
            name: 'Production',
            parentId: null,
            updatedAt: ''
          },
          {
            color: 'blue',
            createdAt: '',
            id: 'group-child',
            name: 'API',
            parentId: 'group-parent',
            updatedAt: ''
          }
        ])
      },
      servers: {
        list: vi.fn().mockResolvedValue([
          {
            ...servers[0],
            group: {
              color: 'blue',
              createdAt: '',
              id: 'group-child',
              name: 'API',
              parentId: 'group-parent',
              updatedAt: ''
            },
            groupId: 'group-child',
            name: 'API Host'
          }
        ]),
        listRecent: vi.fn().mockResolvedValue([])
      },
      tags: {
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderPrimarySidebar()

    const parentLabel = await screen.findByText('Production')
    expect(screen.queryByText('API')).not.toBeInTheDocument()

    fireEvent.doubleClick(parentLabel)
    const childLabel = await screen.findByText('API')
    expect(screen.queryByText('API Host')).not.toBeInTheDocument()

    fireEvent.doubleClick(childLabel)
    expect(await screen.findByText('API Host')).toBeInTheDocument()
  })

  it('opens the new subgroup quick input from a group context menu', async () => {
    const createGroup = vi.fn().mockResolvedValue({
      color: 'blue',
      createdAt: '',
      id: 'group-child',
      name: 'API',
      parentId: 'group-1',
      updatedAt: ''
    })

    window.winsshApi = createWinsshApiMock({
      groups: {
        create: createGroup,
        list: vi.fn().mockResolvedValue([
          {
            color: 'red',
            createdAt: '',
            id: 'group-1',
            name: 'Production',
            parentId: null,
            updatedAt: ''
          }
        ])
      },
      servers: {
        list: vi.fn().mockResolvedValue([]),
        listRecent: vi.fn().mockResolvedValue([])
      },
      tags: {
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderPrimarySidebar()

    const groupRow = (await screen.findByText('Production')).closest('[role="button"]')
    expect(groupRow).toBeTruthy()

    fireEvent.contextMenu(groupRow as HTMLElement)
    fireEvent.click(await screen.findByText('New Subgroup'))
    fireEvent.change(await screen.findByPlaceholderText('Production'), {
      target: { value: 'API' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(createGroup).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'API', parentId: 'group-1' })
      )
    })
  })

  it('filters servers by name and host from the quick search input', async () => {
    window.winsshApi = createWinsshApiMock({
      groups: {
        list: vi.fn().mockResolvedValue([])
      },
      servers: {
        list: vi.fn().mockResolvedValue([
          {
            ...servers[0],
            host: '10.0.0.5',
            name: 'Hong Kong Prod'
          },
          {
            ...servers[1],
            host: '192.168.1.10',
            name: 'Tokyo Jump'
          }
        ]),
        listRecent: vi.fn().mockResolvedValue([])
      },
      tags: {
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderPrimarySidebar()

    const searchInput = await screen.findByRole('textbox', { name: 'Quick server search' })

    fireEvent.change(searchInput, { target: { value: 'hong' } })

    expect(await screen.findByText('Search Results')).toBeInTheDocument()
    expect(screen.getByText('Hong Kong Prod')).toBeInTheDocument()
    expect(screen.getByText('10.0.0.5')).toBeInTheDocument()
    expect(screen.queryByText('Tokyo Jump')).not.toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: '192.168' } })

    expect(await screen.findByText('Tokyo Jump')).toBeInTheDocument()
    expect(screen.getByText('192.168.1.10')).toBeInTheDocument()
    expect(screen.queryByText('Hong Kong Prod')).not.toBeInTheDocument()
  })

  it('shows an empty search state when no server matches the query', async () => {
    renderPrimarySidebar()

    const searchInput = await screen.findByRole('textbox', { name: 'Quick server search' })
    fireEvent.change(searchInput, { target: { value: 'missing-server' } })

    expect(await screen.findByText('Search Results')).toBeInTheDocument()
    expect(screen.getByText('No servers match "missing-server".')).toBeInTheDocument()
  })
})
