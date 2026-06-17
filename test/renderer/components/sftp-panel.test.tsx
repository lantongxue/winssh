import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { RemoteEntry } from '@shared/types'
import i18n from '@/i18n'
import { SftpPanel } from '@/components/sftp-panel'
import type { SessionTab } from '@/store/sessions-store'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { SFTP_MOVE_DRAG_MIME, TERMINAL_PATH_DRAG_MIME } from '@/lib/terminal-path-dnd'

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

function renderSftpPanel(
  session: SessionTab | null,
  options: { onEditFile?: (remotePath: string) => void } = {}
) {
  const queryClient = createTestQueryClient()

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SftpPanel session={session} onEditFile={options.onEditFile} />
        </TooltipProvider>
      </QueryClientProvider>
    )
  }
}

function ConnectedSftpPanel({ sessionId }: { sessionId: string }) {
  const session =
    useSessionsStore((state) => state.tabs.find((tab) => tab.sessionId === sessionId)) ?? null

  return <SftpPanel session={session} />
}

function renderConnectedSftpPanel(sessionId: string) {
  const queryClient = createTestQueryClient()

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ConnectedSftpPanel sessionId={sessionId} />
        </TooltipProvider>
      </QueryClientProvider>
    )
  }
}

function createMutableDragDataTransfer() {
  const store = new Map<string, string>()
  const types: string[] = []
  const setData = vi.fn((type: string, value: string) => {
    store.set(type, value)
    if (!types.includes(type)) {
      types.push(type)
    }
  })

  return {
    dropEffect: 'none',
    effectAllowed: 'none',
    getData: (type: string) => store.get(type) ?? '',
    setData,
    types
  }
}

async function selectEntryByName(name: string) {
  const entryLabel = await screen.findByText(name)
  const entryButton = entryLabel.closest('button')

  expect(entryButton).not.toBeNull()

  fireEvent.click(entryButton as HTMLElement)

  await waitFor(() => {
    expect(screen.getByText(name).closest('button')?.className).toContain(
      'bg-[var(--workbench-hover)]'
    )
  })

  return screen.getByText(name).closest('button') as HTMLElement
}

async function openSelectedEntryContextMenu(name: string) {
  const entryButton = await selectEntryByName(name)
  fireEvent.contextMenu(entryButton)
}

describe('SftpPanel', () => {
  const session = {
    connectedAt: new Date().toISOString(),
    currentPath: '/var/www',
    host: '127.0.0.1',
    port: 22,
    serverId: 'server-1',
    serverName: 'alpha',
    sessionId: 'session-1',
    status: 'ready' as const
  }

  const entries: RemoteEntry[] = [
    {
      kind: 'file',
      modifiedAt: null,
      name: 'config.json',
      path: '/var/www/config.json',
      permissions: null,
      size: 32
    }
  ]
  const directoryEntry: RemoteEntry = {
    kind: 'directory',
    modifiedAt: null,
    name: 'assets',
    path: '/var/www/assets',
    permissions: null,
    size: 0
  }

  beforeEach(async () => {
    await i18n.changeLanguage('en-US')
    useSessionsStore.getState().clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends the selected entry path to the terminal from the context menu', async () => {
    const sessionsWrite = vi.fn().mockResolvedValue(undefined)

    window.winsshApi = createWinsshApiMock({
      sessions: {
        write: sessionsWrite
      },
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries,
          path: '/var/www'
        })
      }
    })

    renderSftpPanel(session)

    await openSelectedEntryContextMenu('config.json')
    fireEvent.click(await screen.findByText('Send Path to Terminal'))

    await waitFor(() => {
      expect(sessionsWrite).toHaveBeenCalledWith('session-1', '/var/www/config.json')
    })
  })

  it('opens a remote file editor from the context menu', async () => {
    const onEditFile = vi.fn()

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries,
          path: '/var/www'
        })
      }
    })

    renderSftpPanel(session, { onEditFile })

    await openSelectedEntryContextMenu('config.json')
    fireEvent.click(await screen.findByText('Edit'))

    expect(onEditFile).toHaveBeenCalledWith('/var/www/config.json')
  })

  it('downloads a selected directory from the context menu', async () => {
    const downloadFile = vi.fn().mockResolvedValue(undefined)

    window.winsshApi = createWinsshApiMock({
      sftp: {
        downloadFile,
        list: vi.fn().mockResolvedValue({
          entries: [directoryEntry, ...entries],
          path: '/var/www'
        })
      }
    })

    renderSftpPanel(session)

    await openSelectedEntryContextMenu('assets')
    fireEvent.click(await screen.findByText('Download'))

    await waitFor(() => {
      expect(downloadFile).toHaveBeenCalledWith('session-1', '/var/www/assets')
    })
  })

  it('renders directory icons with a stronger highlighted treatment than files', async () => {
    window.winsshApi = createWinsshApiMock({
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries: [directoryEntry, ...entries],
          path: '/var/www'
        })
      }
    })

    renderSftpPanel(session)

    const directoryButton = (await screen.findByText('assets')).closest('button')
    const fileButton = (await screen.findByText('config.json')).closest('button')
    const directoryIcon = directoryButton?.querySelector('[data-entry-icon="directory"]')
    const fileIcon = fileButton?.querySelector('[data-entry-icon="file"]')

    expect(directoryIcon).not.toBeNull()
    expect(fileIcon).not.toBeNull()
    expect(directoryIcon?.getAttribute('class')).toContain('var(--workbench-active)')
    expect(fileIcon?.getAttribute('class')).toContain('bg-muted')
  })

  it('opens a remote file editor when double-clicking a file', async () => {
    const onEditFile = vi.fn()

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries,
          path: '/var/www'
        })
      }
    })

    renderSftpPanel(session, { onEditFile })

    fireEvent.doubleClick(await screen.findByText('config.json'))

    expect(onEditFile).toHaveBeenCalledWith('/var/www/config.json')
  })

  it('continues opening directories when double-clicking a directory', async () => {
    useSessionsStore.getState().addSession(session)
    window.winsshApi = createWinsshApiMock({
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries: [directoryEntry, ...entries],
          path: '/var/www'
        })
      }
    })

    renderConnectedSftpPanel('session-1')

    fireEvent.doubleClick(await screen.findByText('assets'))

    await waitFor(() => {
      expect(useSessionsStore.getState().tabs[0]?.currentPath).toBe('/var/www/assets')
    })
  })

  it('keeps rendering when a loaded session becomes disconnected', async () => {
    window.winsshApi = createWinsshApiMock({
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries,
          path: '/var/www'
        })
      }
    })

    const { queryClient, rerender } = renderSftpPanel(session)

    await screen.findByText('config.json')

    rerender(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SftpPanel session={{ ...session, status: 'disconnected' }} />
        </TooltipProvider>
      </QueryClientProvider>
    )

    expect(screen.getByText('No active session')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Start an SSH session first and the SFTP panel will follow the active tab automatically.'
      )
    ).toBeInTheDocument()
  })

  it('closes the aux panel from the header close button', async () => {
    useSessionsStore.getState().addSession(session)
    useSessionsStore.getState().setAuxView('session-1', 'sftp')

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries,
          path: '/var/www'
        })
      }
    })

    renderSftpPanel(session)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(useSessionsStore.getState().tabs[0]?.auxView).toBeNull()
  })

  it('jumps to an edited path when pressing enter in the current path field', async () => {
    const list = vi.fn().mockImplementation(async (_sessionId: string, path: string) => ({
      entries,
      path
    }))

    useSessionsStore.getState().addSession(session)
    window.winsshApi = createWinsshApiMock({
      sftp: {
        list
      }
    })

    renderConnectedSftpPanel('session-1')

    const pathField = await screen.findByLabelText('Current Path')

    fireEvent.change(pathField, { target: { value: '/etc/nginx/sites-enabled' } })
    fireEvent.keyDown(pathField, { key: 'Enter' })

    await waitFor(() => {
      expect(useSessionsStore.getState().tabs[0]?.currentPath).toBe('/etc/nginx/sites-enabled')
    })
    await waitFor(() => {
      expect(list).toHaveBeenLastCalledWith('session-1', '/etc/nginx/sites-enabled')
    })
  })

  it('uploads dropped files and folders into the current directory', async () => {
    const list = vi.fn().mockResolvedValue({
      entries,
      path: '/var/www'
    })
    const uploadPaths = vi.fn().mockResolvedValue(undefined)
    const getPathForFile = vi.fn((file: File) => (file as { path?: string }).path ?? null)

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list,
        uploadPaths
      },
      system: {
        getPathForFile
      }
    })

    renderSftpPanel(session)

    const region = screen.getByRole('region', { name: 'SFTP Explorer' })
    const droppedFile = { path: 'C:\\Users\\tester\\notes.txt' } as unknown as File
    const droppedFolder = { path: 'C:\\Users\\tester\\project' } as unknown as File
    const dataTransfer = {
      dropEffect: 'none',
      files: [droppedFile, droppedFolder],
      items: [
        {
          getAsFile: () => droppedFile,
          kind: 'file'
        },
        {
          getAsFile: () => droppedFolder,
          kind: 'file'
        }
      ],
      types: ['Files']
    }

    fireEvent.dragEnter(region, { dataTransfer })
    expect(screen.getByText('Drop files or folders to upload')).toBeInTheDocument()

    fireEvent.drop(region, { dataTransfer })

    await waitFor(() => {
      expect(uploadPaths).toHaveBeenCalledWith('session-1', '/var/www', [
        'C:\\Users\\tester\\notes.txt',
        'C:\\Users\\tester\\project'
      ])
    })
    expect(getPathForFile).toHaveBeenCalledTimes(4)
    await waitFor(() => {
      expect(screen.queryByText('Drop files or folders to upload')).not.toBeInTheDocument()
    })
  })

  it('confirms before deleting and then shows a removing transition state', async () => {
    const remove = vi.fn(() => new Promise<void>(() => undefined))

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries,
          path: '/var/www'
        }),
        remove
      }
    })

    renderSftpPanel(session)

    const entryLabel = await screen.findByText('config.json')
    const entryButton = entryLabel.closest('button')

    expect(entryButton).not.toBeNull()

    await openSelectedEntryContextMenu('config.json')
    fireEvent.click(await screen.findByText('Delete'))

    expect(remove).not.toHaveBeenCalled()

    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(
        'Are you sure you want to delete this item? This action cannot be undone.'
      )
    ).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByText('config.json').closest('button')).toHaveAttribute(
        'data-removing',
        'true'
      )
    })
  })

  it('writes the dragged entry path into terminal drag data', async () => {
    window.winsshApi = createWinsshApiMock({
      sftp: {
        list: vi.fn().mockResolvedValue({
          entries,
          path: '/var/www'
        })
      }
    })

    renderSftpPanel(session)

    const entryButton = (await screen.findByText('config.json')).closest('button')
    const dataTransfer = createMutableDragDataTransfer()

    expect(entryButton).not.toBeNull()

    fireEvent.dragStart(entryButton as HTMLElement, { dataTransfer })

    expect(dataTransfer.effectAllowed).toBe('copyMove')
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      TERMINAL_PATH_DRAG_MIME,
      '/var/www/config.json'
    )
    expect(dataTransfer.setData).toHaveBeenCalledWith('text/plain', '/var/www/config.json')
    expect(dataTransfer.setData).toHaveBeenCalledWith(
      SFTP_MOVE_DRAG_MIME,
      JSON.stringify({
        path: '/var/www/config.json',
        kind: 'file'
      })
    )
    expect(dataTransfer.types).toContain(TERMINAL_PATH_DRAG_MIME)
    expect(dataTransfer.types).toContain('text/plain')
    expect(dataTransfer.types).toContain(SFTP_MOVE_DRAG_MIME)
    expect(dataTransfer.getData(TERMINAL_PATH_DRAG_MIME)).toBe('/var/www/config.json')
    expect(dataTransfer.getData('text/plain')).toBe('/var/www/config.json')
  })

  it('moves a file entry into a directory when dropped on that directory', async () => {
    const list = vi.fn().mockResolvedValue({
      entries: [directoryEntry, ...entries],
      path: '/var/www'
    })
    const move = vi.fn().mockResolvedValue(undefined)

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list,
        move
      }
    })

    renderSftpPanel(session)

    const sourceButton = (await screen.findByText('config.json')).closest('button')
    const targetButton = (await screen.findByText('assets')).closest('button')
    const dataTransfer = createMutableDragDataTransfer()

    expect(sourceButton).not.toBeNull()
    expect(targetButton).not.toBeNull()

    fireEvent.dragStart(sourceButton as HTMLElement, { dataTransfer })
    fireEvent.dragEnter(targetButton as HTMLElement, { dataTransfer })
    fireEvent.dragOver(targetButton as HTMLElement, { dataTransfer })
    fireEvent.drop(targetButton as HTMLElement, { dataTransfer })

    await waitFor(() => {
      expect(move).toHaveBeenCalledWith('session-1', '/var/www/config.json', '/var/www/assets')
    })
  })

  it('refreshes an expanded tree target directory after moving a file into it', async () => {
    const movedEntry: RemoteEntry = {
      ...entries[0],
      path: '/var/www/assets/config.json'
    }
    const list = vi.fn().mockImplementation(async (_sessionId: string, path: string) => {
      if (path === '/var/www/assets') {
        const targetDirectoryCallCount = list.mock.calls.filter(
          (call) => call[1] === '/var/www/assets'
        ).length

        return {
          entries: targetDirectoryCallCount >= 2 ? [movedEntry] : [],
          path
        }
      }

      return {
        entries: [directoryEntry, ...entries],
        path
      }
    })
    const move = vi.fn().mockResolvedValue(undefined)

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list,
        move
      }
    })

    renderSftpPanel(session)

    fireEvent.click(await screen.findByRole('button', { name: 'Tree View' }))
    await screen.findByText('assets')

    const targetButton = screen.getByText('assets').closest('button')
    expect(targetButton).not.toBeNull()

    fireEvent.doubleClick(targetButton as HTMLElement)

    await waitFor(() => {
      expect(list).toHaveBeenCalledWith('session-1', '/var/www/assets')
    })

    const sourceButton = (await screen.findByText('config.json')).closest('button')
    const dataTransfer = createMutableDragDataTransfer()

    expect(sourceButton).not.toBeNull()

    fireEvent.dragStart(sourceButton as HTMLElement, { dataTransfer })
    fireEvent.dragEnter(targetButton as HTMLElement, { dataTransfer })
    fireEvent.dragOver(targetButton as HTMLElement, { dataTransfer })
    fireEvent.drop(targetButton as HTMLElement, { dataTransfer })

    await waitFor(() => {
      expect(move).toHaveBeenCalledWith('session-1', '/var/www/config.json', '/var/www/assets')
    })
    await waitFor(() => {
      expect(list.mock.calls.filter((call) => call[1] === '/var/www/assets')).toHaveLength(2)
    })
    await waitFor(() => {
      expect(screen.getAllByText('config.json')).toHaveLength(2)
    })
  })

  it('refreshes the selected directory from the tree context menu', async () => {
    const refreshedEntry: RemoteEntry = {
      kind: 'file',
      modifiedAt: null,
      name: 'refreshed.txt',
      path: '/var/www/assets/refreshed.txt',
      permissions: null,
      size: 12
    }
    const list = vi.fn().mockImplementation(async (_sessionId: string, path: string) => {
      if (path === '/var/www/assets') {
        const targetDirectoryCallCount = list.mock.calls.filter(
          (call) => call[1] === '/var/www/assets'
        ).length

        return {
          entries: targetDirectoryCallCount >= 2 ? [refreshedEntry] : [],
          path
        }
      }

      return {
        entries: [directoryEntry, ...entries],
        path
      }
    })

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list
      }
    })

    renderSftpPanel(session)

    fireEvent.click(await screen.findByRole('button', { name: 'Tree View' }))

    const targetButton = (await screen.findByText('assets')).closest('button')
    expect(targetButton).not.toBeNull()

    fireEvent.doubleClick(targetButton as HTMLElement)

    await waitFor(() => {
      expect(list).toHaveBeenCalledWith('session-1', '/var/www/assets')
    })

    fireEvent.contextMenu(await selectEntryByName('assets'))
    fireEvent.click(await screen.findByText('Refresh'))

    await waitFor(() => {
      expect(list.mock.calls.filter((call) => call[1] === '/var/www/assets')).toHaveLength(2)
    })
    expect(await screen.findByText('refreshed.txt')).toBeInTheDocument()
  })

  it('refreshes the parent directory for a selected tree file from the context menu', async () => {
    const staleEntry: RemoteEntry = {
      kind: 'file',
      modifiedAt: null,
      name: 'stale.txt',
      path: '/var/www/assets/stale.txt',
      permissions: null,
      size: 8
    }
    const refreshedEntry: RemoteEntry = {
      kind: 'file',
      modifiedAt: null,
      name: 'fresh.txt',
      path: '/var/www/assets/fresh.txt',
      permissions: null,
      size: 16
    }
    const list = vi.fn().mockImplementation(async (_sessionId: string, path: string) => {
      if (path === '/var/www/assets') {
        const targetDirectoryCallCount = list.mock.calls.filter(
          (call) => call[1] === '/var/www/assets'
        ).length

        return {
          entries: targetDirectoryCallCount >= 2 ? [refreshedEntry] : [staleEntry],
          path
        }
      }

      return {
        entries: [directoryEntry],
        path
      }
    })

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list
      }
    })

    renderSftpPanel(session)

    fireEvent.click(await screen.findByRole('button', { name: 'Tree View' }))

    const targetButton = (await screen.findByText('assets')).closest('button')
    expect(targetButton).not.toBeNull()

    fireEvent.doubleClick(targetButton as HTMLElement)

    expect(await screen.findByText('stale.txt')).toBeInTheDocument()

    fireEvent.contextMenu(await selectEntryByName('stale.txt'))
    fireEvent.click(await screen.findByText('Refresh'))

    await waitFor(() => {
      expect(list.mock.calls.filter((call) => call[1] === '/var/www/assets')).toHaveLength(2)
    })
    expect(await screen.findByText('fresh.txt')).toBeInTheDocument()
    expect(screen.queryByText('stale.txt')).not.toBeInTheDocument()
  })

  it('uses static rows for typical directories and keeps virtualization for large lists', async () => {
    const largeEntries = Array.from({ length: 240 }, (_, index) => ({
      kind: 'file' as const,
      modifiedAt: null,
      name: `file-${index}.txt`,
      path: `/var/www/file-${index}.txt`,
      permissions: null,
      size: index + 1
    }))
    const list = vi
      .fn()
      .mockResolvedValueOnce({
        entries,
        path: '/var/www'
      })
      .mockResolvedValueOnce({
        entries: largeEntries,
        path: '/var/www'
      })

    window.winsshApi = createWinsshApiMock({
      sftp: {
        list
      }
    })

    const smallRender = renderSftpPanel(session)

    await screen.findByText('config.json')
    expect(screen.getByTestId('sftp-entry-list')).toHaveAttribute('data-render-mode', 'static')

    smallRender.unmount()

    const originalClientHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientHeight'
    )
    const originalOffsetHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetHeight'
    )
    const originalOffsetWidth = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'offsetWidth'
    )

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get() {
        return 480
      }
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      get() {
        return 480
      }
    })
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() {
        return 320
      }
    })

    try {
      renderSftpPanel(session)

      await screen.findByText('file-0.txt')
      await waitFor(() => {
        expect(screen.getByTestId('sftp-entry-list')).toHaveAttribute('data-render-mode', 'virtual')
      })
    } finally {
      if (originalClientHeight) {
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeight)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'clientHeight')
      }

      if (originalOffsetHeight) {
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight')
      }

      if (originalOffsetWidth) {
        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth)
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth')
      }
    }
  })

  it('follows the terminal CWD when the follow toggle is active', async () => {
    const list = vi.fn().mockImplementation(async (_sessionId: string, path: string) => ({
      entries: [
        {
          kind: 'file',
          modifiedAt: null,
          name: 'nginx.conf',
          path: '/var/log/nginx/nginx.conf',
          permissions: null,
          size: 1024
        }
      ],
      path
    }))

    useSessionsStore.getState().addSession(session)
    window.winsshApi = createWinsshApiMock({
      sftp: {
        list
      }
    })

    renderConnectedSftpPanel('session-1')

    const followButton = await screen.findByRole('button', { name: 'Follow Terminal Directory' })
    expect(followButton).toBeInTheDocument()

    fireEvent.click(followButton)

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Stop Following Terminal Directory' })
      ).toBeInTheDocument()
    })

    act(() => {
      useSessionsStore.getState().setTerminalCwd('session-1', '/var/log/nginx')
    })

    await waitFor(() => {
      expect(useSessionsStore.getState().tabs[0]?.currentPath).toBe('/var/log/nginx')
    })

    await waitFor(() => {
      expect(list).toHaveBeenLastCalledWith('session-1', '/var/log/nginx')
    })
  })
})
