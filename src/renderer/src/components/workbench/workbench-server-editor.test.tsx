import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  favorite: false,
  group: null,
  groupId: null,
  hasPassphrase: false,
  hasPassword: true,
  host: '10.0.0.8',
  id: 'server-1',
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
})
