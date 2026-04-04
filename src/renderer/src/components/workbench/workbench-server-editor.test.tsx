import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchProvider } from '@/components/workbench/workbench-context'
import { WorkbenchServerEditor } from '@/components/workbench/workbench-server-editor'
import { createServerEditorDocument } from '@/lib/workbench'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'
import { createWinsshApiMock } from '@/test/create-winssh-api'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

function renderServerEditor() {
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
        <WorkbenchServerEditor document={createServerEditorDocument()} />
      </WorkbenchProvider>
    </QueryClientProvider>
  )
}

const savedServer = {
  authType: 'password' as const,
  createdAt: '',
  credentialId: null,
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
  name: 'Existing Jump'
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

  it('allows selecting an existing jump server', async () => {
    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([savedServer, jumpServer])
      }
    })

    renderServerEditor()

    const jumpServerSelect = (await screen.findAllByRole('combobox'))[2]
    expect(jumpServerSelect).toBeDefined()
    fireEvent.click(jumpServerSelect as HTMLElement)
    fireEvent.click(await screen.findByRole('option', { name: 'Existing Jump' }))

    expect(screen.getByText('root@10.0.0.9:22')).toBeInTheDocument()
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

  it('creates a new tag directly from the inline tag input and selects it', async () => {
    const createTag = vi.fn().mockResolvedValue(databaseTag)

    window.winsshApi = createWinsshApiMock({
      tags: {
        create: createTag,
        list: vi.fn().mockResolvedValue([])
      }
    })

    renderServerEditor()

    const tagInput = await screen.findByLabelText('Add Tag')
    fireEvent.change(tagInput, {
      target: { value: 'Database' }
    })
    fireEvent.keyDown(tagInput, { code: 'Enter', key: 'Enter' })

    await waitFor(() => {
      expect(createTag).toHaveBeenCalledWith({ color: 'slate', name: 'Database' })
    })

    expect(screen.getByText('1 selected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Database' })).toBeInTheDocument()
  })

  it('selects an existing tag from the inline input without creating a duplicate', async () => {
    const createTag = vi.fn()

    window.winsshApi = createWinsshApiMock({
      tags: {
        create: createTag,
        list: vi.fn().mockResolvedValue([databaseTag])
      }
    })

    renderServerEditor()

    await screen.findByRole('button', { name: 'Database' })
    const tagInput = await screen.findByLabelText('Add Tag')
    fireEvent.change(tagInput, {
      target: { value: 'database' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add Tag' }))

    await waitFor(() => {
      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })

    expect(createTag).not.toHaveBeenCalled()
  })

  it('deletes a tag from the hover action button', async () => {
    const deleteTag = vi.fn().mockResolvedValue(undefined)
    const listTags = vi.fn().mockResolvedValueOnce([databaseTag]).mockResolvedValue([])

    window.winsshApi = createWinsshApiMock({
      tags: {
        delete: deleteTag,
        list: listTags
      }
    })

    renderServerEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Database' }))

    await waitFor(() => {
      expect(screen.getByText('1 selected')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete Database' }))

    await waitFor(() => {
      expect(screen.getByText('0 selected')).toBeInTheDocument()
    })

    expect(deleteTag).toHaveBeenCalledWith('tag-db')
    expect(screen.queryByRole('button', { name: 'Database' })).not.toBeInTheDocument()
  })
})
