import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import { CredentialVault } from '@/components/credential-vault'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'
import { TooltipProvider } from '@/components/ui/tooltip'

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

const mockCredentials = [
  {
    id: 'cred-1',
    name: 'Test Pass',
    kind: 'password' as const,
    username: 'user-1',
    note: 'note-1',
    createdAt: '2026-06-30T15:41:30Z',
    updatedAt: '2026-06-30T15:41:30Z'
  },
  {
    id: 'cred-2',
    name: 'Test Key',
    kind: 'privateKey' as const,
    username: '',
    note: 'note-2',
    createdAt: '2026-06-30T15:41:30Z',
    updatedAt: '2026-06-30T15:41:30Z'
  }
]

const mockSecrets: Record<
  string,
  { password: string | null; passphrase: string | null; privateKey: string | null }
> = {
  'cred-1': { password: 'pass-val', passphrase: null, privateKey: null },
  'cred-2': { password: null, passphrase: 'phrase-val', privateKey: 'key-val' }
}

beforeEach(async () => {
  vi.clearAllMocks()
  await i18n.changeLanguage('en-US')
})

describe('CredentialVault', () => {
  it('pre-fills correct values when opening the edit dialog', async () => {
    const api = createWinsshApiMock({
      credentials: {
        list: async () => mockCredentials,
        getSecret: async (id) =>
          mockSecrets[id] ?? { password: null, passphrase: null, privateKey: null }
      }
    })
    window.winsshApi = api

    const queryClient = createTestQueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <CredentialVault />
        </TooltipProvider>
      </QueryClientProvider>
    )

    // Wait for credentials list to render
    expect(await screen.findByText('Test Pass')).toBeInTheDocument()
    expect(screen.getByText('Test Key')).toBeInTheDocument()

    // 1. Click edit on "Test Pass" (password type)
    const passRow = screen.getByText('Test Pass').closest('.group')!
    const passEditBtn = passRow.querySelector('button')! // Edit is first, delete is second
    fireEvent.click(passEditBtn)

    // Wait for Dialog to open and values to be filled
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    // Name input should contain "Test Pass"
    const nameInput = screen.getByLabelText('Name') as HTMLInputElement
    expect(nameInput.value).toBe('Test Pass')

    // Username input should contain "user-1"
    const usernameInput = screen.getByLabelText('Username') as HTMLInputElement
    expect(usernameInput.value).toBe('user-1')

    // Note input should contain "note-1"
    const noteInput = screen.getByLabelText('Notes') as HTMLTextAreaElement
    expect(noteInput.value).toBe('note-1')

    // Password input should contain "pass-val" (loaded via query)
    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement
    await waitFor(() => {
      expect(passwordInput.value).toBe('pass-val')
    })

    // 2. Click cancel
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' })
    fireEvent.click(cancelBtn)

    // Wait for Dialog to close
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    // 3. Click edit on "Test Key" (private key type)
    const keyRow = screen.getByText('Test Key').closest('.group')!
    const keyEditBtn = keyRow.querySelector('button')!
    fireEvent.click(keyEditBtn)

    // Wait for Dialog to open
    expect(await screen.findByRole('dialog')).toBeInTheDocument()

    // Name input should contain "Test Key"
    const nameInput2 = screen.getByLabelText('Name') as HTMLInputElement
    expect(nameInput2.value).toBe('Test Key')

    // Since kind is privateKey, Username/Password inputs should NOT be visible
    expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()

    // Private key and passphrase fields should be visible and populated
    const privateKeyInput = screen.getByLabelText('Private Key') as HTMLTextAreaElement
    const passphraseInput = screen.getByLabelText('Passphrase') as HTMLInputElement
    const noteInput2 = screen.getByLabelText('Notes') as HTMLTextAreaElement

    expect(noteInput2.value).toBe('note-2')
    await waitFor(() => {
      expect(privateKeyInput.value).toBe('key-val')
      expect(passphraseInput.value).toBe('phrase-val')
    })
  })
})
