import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchProvider } from '@/components/workbench/workbench-context'
import { WorkbenchServerEditor } from '@/components/workbench/workbench-server-editor'
import { createServerEditorDocument } from '@/lib/workbench'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

vi.mock('monaco-editor/esm/vs/basic-languages/shell/shell.contribution.js', () => ({}))
vi.mock('monaco-editor/esm/vs/editor/editor.api.js', () => ({
  editor: {
    colorize: vi.fn().mockImplementation((text) => Promise.resolve(`<div>${text}</div>`))
  }
}))

function renderServerEditor(document = createServerEditorDocument()) {
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
        <WorkbenchServerEditor document={document} />
      </WorkbenchProvider>
    </QueryClientProvider>
  )
}

async function openTagsCombobox() {
  fireEvent.click(await screen.findByRole('combobox', { name: 'Tags' }))
  return screen.findByRole('textbox', { name: 'Tags' })
}

const savedServer = {
  authType: 'password' as const,
  brandId: null,
  createdAt: '',
  credentialId: null,
  customIconDataUrl: null,
  favorite: false,
  group: null,
  groupId: null,
  hasPassphrase: false,
  hasPassword: true,
  host: '10.0.0.8',
  id: 'server-1',
  jumpServerId: null,
  lastConnectedAt: null,
  name: 'Production Bastion',
  note: null,
  port: 22,
  privateKeyPath: null,
  tags: [],
  updatedAt: '',
  username: 'root'
}

const privateKeyServer = {
  ...savedServer,
  authType: 'privateKey' as const,
  hasPassphrase: true,
  hasPassword: false,
  id: 'server-2',
  name: 'Key Host'
}

const jumpServer = {
  ...savedServer,
  credentialId: null,
  hasPassword: false,
  host: '10.0.0.9',
  id: 'jump-1',
  name: 'Existing Jump',
  tags: [
    {
      color: 'amber',
      createdAt: '',
      id: 'tag-jump',
      name: 'jumpserver',
      updatedAt: ''
    }
  ]
}

const databaseTag = {
  color: 'slate',
  createdAt: '',
  id: 'tag-db',
  name: 'Database',
  updatedAt: ''
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  useSessionsStore.getState().clear()
  window.winsshApi = createWinsshApiMock()
})

describe('WorkbenchServerEditor credentials field', () => {
  it('toggles password visibility from the eye button', async () => {
    renderServerEditor()

    const passwordInput = await screen.findByLabelText('Password')
    expect(passwordInput).toHaveAttribute('type', 'password')

    fireEvent.click(screen.getByRole('button', { name: 'Show secret' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide secret' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    fireEvent.click(screen.getByRole('button', { name: 'Hide secret' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('keeps credential policy in basic information', async () => {
    renderServerEditor()

    const basicSection = (await screen.findByText('Basic')).closest('section')

    expect(basicSection).not.toBeNull()
    expect(
      within(basicSection as HTMLElement).getByRole('combobox', { name: 'Authentication' })
    ).toBeInTheDocument()
    expect(
      within(basicSection as HTMLElement).getByRole('combobox', { name: 'Use Credential' })
    ).toBeInTheDocument()
    expect((await screen.findByText('Credentials')).closest('section')).toBe(basicSection)
  })

  it('does not show favorite controls in the server editor', async () => {
    renderServerEditor()

    await screen.findByText('Basic')

    expect(screen.queryByText('Favorite this server')).not.toBeInTheDocument()
  })

  it('places command history outside basic information as a top-level section', async () => {
    renderServerEditor()

    const basicSection = (await screen.findByText('Basic')).closest('section')
    const commandHistoryToggle = await screen.findByText('Record command history for this server')
    const commandHistorySection = commandHistoryToggle.closest('section')
    const jumpServerSection = (
      await screen.findByRole('combobox', { name: 'Jump Server' })
    ).closest('section')

    expect(basicSection).not.toBeNull()
    expect(commandHistorySection).not.toBeNull()
    expect(jumpServerSection).not.toBeNull()
    expect(basicSection?.contains(commandHistoryToggle)).toBe(false)
    expect(commandHistorySection).not.toBe(basicSection)
    expect(commandHistorySection?.parentElement).toBe(jumpServerSection?.parentElement)
  })

  it('prefills the stored password when editing an existing server', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        getSecrets: vi.fn().mockResolvedValue({
          password: 'hunter2',
          passphrase: null,
          privateKey: null
        }),
        list: vi.fn().mockResolvedValue([savedServer])
      }
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    })

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchProvider>
          <WorkbenchServerEditor document={createServerEditorDocument(savedServer.id)} />
        </WorkbenchProvider>
      </QueryClientProvider>
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Password')).toHaveValue('hunter2')
    })
  })

  it('imports private key content from the file picker into the textarea', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        getSecrets: vi.fn().mockResolvedValue({
          password: null,
          passphrase: null,
          privateKey: null
        }),
        list: vi.fn().mockResolvedValue([privateKeyServer])
      },
      system: {
        pickPrivateKey: vi
          .fn()
          .mockResolvedValue('-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----')
      }
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    })

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchProvider>
          <WorkbenchServerEditor document={createServerEditorDocument(privateKeyServer.id)} />
        </WorkbenchProvider>
      </QueryClientProvider>
    )

    await screen.findByText('Key Host')
    await screen.findByLabelText('Private Key')
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }))

    await waitFor(() => {
      expect(screen.getByLabelText('Private Key')).toHaveValue(
        '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----'
      )
    })
  })

  it('uploads a custom server icon and saves its binary payload', async () => {
    const updateServer = vi.fn().mockResolvedValue({
      ...savedServer,
      customIconDataUrl: 'data:image/png;base64,AQID'
    })

    window.winsshApi = createWinsshApiMock({
      servers: {
        getSecrets: vi.fn().mockResolvedValue({
          password: 'hunter2',
          passphrase: null,
          privateKey: null
        }),
        list: vi.fn().mockResolvedValue([savedServer]),
        update: updateServer
      },
      system: {
        pickServerIcon: vi.fn().mockResolvedValue({
          data: Uint8Array.from([1, 2, 3]),
          mimeType: 'image/png'
        })
      }
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    })

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchProvider>
          <WorkbenchServerEditor document={createServerEditorDocument(savedServer.id)} />
        </WorkbenchProvider>
      </QueryClientProvider>
    )

    await screen.findByText('Production Bastion')
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }))
    await waitFor(() => {
      expect(document.querySelector('img[src="data:image/png;base64,AQID"]')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateServer).toHaveBeenCalledWith(
        savedServer.id,
        expect.objectContaining({
          customIconData: expect.any(Uint8Array),
          customIconMimeType: 'image/png'
        })
      )
    })
    const payload = updateServer.mock.calls[0]?.[1] as { customIconData: Uint8Array }
    expect(Array.from(payload.customIconData)).toEqual([1, 2, 3])
  })

  it('removes an existing custom icon without clearing the detected brand', async () => {
    const brandedServer = {
      ...savedServer,
      brandId: 'ubuntu' as const,
      customIconDataUrl: 'data:image/png;base64,AQID'
    }
    const updateServer = vi.fn().mockResolvedValue({
      ...brandedServer,
      customIconDataUrl: null
    })

    window.winsshApi = createWinsshApiMock({
      servers: {
        getSecrets: vi.fn().mockResolvedValue({
          password: 'hunter2',
          passphrase: null,
          privateKey: null
        }),
        list: vi.fn().mockResolvedValue([brandedServer]),
        update: updateServer
      }
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    })

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchProvider>
          <WorkbenchServerEditor document={createServerEditorDocument(brandedServer.id)} />
        </WorkbenchProvider>
      </QueryClientProvider>
    )

    await screen.findByText('Production Bastion')
    fireEvent.click(screen.getByRole('button', { name: 'Remove Custom Icon' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateServer).toHaveBeenCalledWith(
        brandedServer.id,
        expect.objectContaining({
          customIconData: null,
          customIconMimeType: null
        })
      )
    })
  })

  it('allows selecting an existing jump server', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([savedServer, jumpServer])
      }
    })

    renderServerEditor()

    const jumpServerSelect = await screen.findByRole('combobox', { name: 'Jump Server' })
    fireEvent.click(jumpServerSelect)

    const jumpServerOption = await screen.findByRole('option', { name: /Existing Jump/i })
    expect(within(jumpServerOption).getByText('jumpserver')).toBeInTheDocument()

    fireEvent.click(jumpServerOption)

    expect(screen.getByText('root@10.0.0.9:22')).toBeInTheDocument()
    expect(screen.getAllByText('jumpserver').length).toBeGreaterThan(0)
  })

  it('persists the source group for a grouped new connection document', async () => {
    const createServer = vi.fn().mockResolvedValue({
      ...savedServer,
      group: {
        color: 'red',
        createdAt: '',
        id: 'group-1',
        name: 'Production',
        updatedAt: ''
      },
      groupId: 'group-1'
    })

    window.winsshApi = createWinsshApiMock({
      groups: {
        list: vi.fn().mockResolvedValue([
          {
            color: 'red',
            createdAt: '',
            id: 'group-1',
            name: 'Production',
            updatedAt: ''
          }
        ])
      },
      servers: {
        create: createServer
      }
    })

    renderServerEditor(createServerEditorDocument(null, { initialGroupId: 'group-1' }))

    fireEvent.change(await screen.findByLabelText('Name'), {
      target: { value: 'Grouped Draft' }
    })
    fireEvent.change(screen.getByLabelText('Host'), {
      target: { value: '10.0.0.10' }
    })
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'root' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(createServer).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: 'group-1',
          host: '10.0.0.10',
          name: 'Grouped Draft',
          username: 'root'
        })
      )
    })
  })

  it('creates a minimal jump server, tags it, and selects it in the form', async () => {
    const listServers = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue([{ ...jumpServer, name: 'Fresh Jump', id: 'jump-new' }])
    const createTag = vi.fn().mockResolvedValue({
      color: 'amber',
      createdAt: '',
      id: 'tag-jump',
      name: 'jumpserver',
      updatedAt: ''
    })
    const createServer = vi.fn().mockResolvedValue({
      ...jumpServer,
      id: 'jump-new',
      name: 'Fresh Jump'
    })

    window.winsshApi = createWinsshApiMock({
      servers: {
        create: createServer,
        list: listServers
      },
      tags: {
        create: createTag,
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderServerEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'New Jump Server' }))

    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByPlaceholderText('Production Jump Server'), {
      target: { value: 'Fresh Jump' }
    })
    fireEvent.change(within(dialog).getByLabelText('Host'), {
      target: { value: '10.0.0.9' }
    })
    fireEvent.change(within(dialog).getByLabelText('Username'), {
      target: { value: 'jump' }
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create' }))

    await waitFor(() => {
      expect(createTag).toHaveBeenCalledWith({ color: 'amber', name: 'jumpserver' })
    })
    expect(createServer).toHaveBeenCalledWith(
      expect.objectContaining({
        host: '10.0.0.9',
        jumpServerId: null,
        name: 'Fresh Jump',
        tagIds: ['tag-jump'],
        username: 'jump'
      })
    )
  })

  it('shows nested group paths in the group selector and saves a subgroup assignment', async () => {
    const createServer = vi.fn().mockResolvedValue({
      ...savedServer,
      groupId: 'group-child'
    })

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
        create: createServer
      }
    })

    renderServerEditor()

    const groupCombobox = await screen.findByRole('combobox', { name: 'Group' })
    fireEvent.click(groupCombobox)
    fireEvent.click(await screen.findByRole('option', { name: 'Production / API' }))

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'API Host' } })
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: '10.0.0.10' } })
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'root' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(createServer).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'group-child' }))
    })
  })

  it('creates a new tag from the tags combobox and selects it', async () => {
    const createTag = vi.fn().mockResolvedValue(databaseTag)

    window.winsshApi = createWinsshApiMock({
      tags: {
        create: createTag,
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderServerEditor()

    const tagInput = await openTagsCombobox()
    fireEvent.change(tagInput, {
      target: { value: 'Database' }
    })
    fireEvent.click(await screen.findByRole('option', { name: 'Create "Database"' }))

    await waitFor(() => {
      expect(createTag).toHaveBeenCalledWith({ color: 'slate', name: 'Database' })
    })

    expect(screen.getByRole('button', { name: 'Remove Database' })).toBeInTheDocument()
  })

  it('creates a new tag from the tags combobox when pressing Enter', async () => {
    const createTag = vi.fn().mockResolvedValue(databaseTag)

    window.winsshApi = createWinsshApiMock({
      tags: {
        create: createTag,
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderServerEditor()

    const tagInput = await openTagsCombobox()
    fireEvent.change(tagInput, {
      target: { value: 'Database' }
    })
    fireEvent.keyDown(tagInput, { key: 'Enter', code: 'Enter', charCode: 13 })

    await waitFor(() => {
      expect(createTag).toHaveBeenCalledWith({ color: 'slate', name: 'Database' })
    })

    await waitFor(() => {
      expect(tagInput).toHaveValue('')
    })

    expect(screen.getByRole('button', { name: 'Remove Database' })).toBeInTheDocument()
  })

  it('selects an existing tag from the tags combobox without creating a duplicate', async () => {
    const createTag = vi.fn()

    window.winsshApi = createWinsshApiMock({
      tags: {
        create: createTag,
        list: vi.fn().mockResolvedValue([databaseTag])
      }
    })

    renderServerEditor()

    const tagInput = await openTagsCombobox()
    fireEvent.change(tagInput, {
      target: { value: 'database' }
    })
    fireEvent.click(await screen.findByRole('option', { name: 'Database' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove Database' })).toBeInTheDocument()
    })

    expect(createTag).not.toHaveBeenCalled()
  })

  it('deletes a tag from the tags combobox option action', async () => {
    const deleteTag = vi.fn().mockResolvedValue(undefined)
    const listTags = vi.fn().mockResolvedValueOnce([databaseTag]).mockResolvedValue([])

    window.winsshApi = createWinsshApiMock({
      tags: {
        delete: deleteTag,
        list: listTags
      }
    })

    renderServerEditor()

    const tagInput = await openTagsCombobox()
    fireEvent.change(tagInput, {
      target: { value: 'database' }
    })
    fireEvent.click(await screen.findByRole('option', { name: 'Database' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Remove Database' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete Database' }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Remove Database' })).not.toBeInTheDocument()
    })

    expect(deleteTag).toHaveBeenCalledWith('tag-db')
    expect(screen.queryByText('Database')).not.toBeInTheDocument()
  })

  it('displays shell integration warning and script when command history is enabled for server', async () => {
    const getShellIntegrationScript = vi
      .fn()
      .mockResolvedValue('__wsh_emit() { printf "\\033]%s\\033\\134" "$1"; };')
    window.winsshApi = createWinsshApiMock({
      servers: {
        getSecrets: vi.fn().mockResolvedValue({
          password: 'hunter2',
          passphrase: null,
          privateKey: null
        }),
        list: vi.fn().mockResolvedValue([
          {
            ...savedServer,
            captureCommandHistory: true
          }
        ])
      },
      system: {
        getShellIntegrationScript
      }
    })

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        }
      }
    })

    render(
      <QueryClientProvider client={queryClient}>
        <WorkbenchProvider>
          <WorkbenchServerEditor document={createServerEditorDocument(savedServer.id)} />
        </WorkbenchProvider>
      </QueryClientProvider>
    )

    expect(
      await screen.findByText(/automatically inject the following integration script/i)
    ).toBeInTheDocument()
    expect(await screen.findByText(/__wsh_emit/)).toBeInTheDocument()
    expect(getShellIntegrationScript).toHaveBeenCalled()
  })
})
