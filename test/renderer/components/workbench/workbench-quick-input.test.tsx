import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchProvider, useWorkbenchContext } from '@/components/workbench/workbench-context'
import { WorkbenchQuickInput } from '@/components/workbench/workbench-quick-input'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void

  return {
    promise: new Promise<T>((nextResolve) => {
      resolve = nextResolve
    }),
    resolve
  }
}

function QuickConnectHarness() {
  const { beginQuickConnect } = useWorkbenchContext()

  return (
    <>
      <button
        type="button"
        onClick={() =>
          void beginQuickConnect({
            authType: 'password',
            host: '127.0.0.1',
            port: 22,
            username: 'root'
          })
        }
      >
        Start Quick Connect
      </button>
      <WorkbenchQuickInput />
    </>
  )
}

function renderQuickInput() {
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
        <QuickConnectHarness />
      </WorkbenchProvider>
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  useSessionsStore.getState().clear()
})

describe('WorkbenchQuickInput quick connect flow', () => {
  it('opens a password prompt, creates one saved server, and reuses the provisional session on retry', async () => {
    const createdServer = {
      authType: 'password' as const,
      createdAt: '',
      credentialId: null,
      favorite: false,
      group: null,
      groupId: null,
      hasPassphrase: false,
      hasPassword: false,
      host: '127.0.0.1',
      id: 'server-1',
      jumpServerId: null,
      lastConnectedAt: null,
      name: 'root@127.0.0.1',
      note: null,
      port: 22,
      privateKeyPath: null,
      tags: [],
      updatedAt: '',
      username: 'root'
    }
    const secondConnect = createDeferredPromise<{
      ok: true
      summary: {
        connectedAt: string
        currentPath: string
        host: string
        port: number
        serverId: string
        serverName: string
        sessionId: string
        status: 'ready'
      }
    }>()
    const serversList = vi.fn().mockResolvedValue([])
    const serversCreate = vi.fn().mockResolvedValue(createdServer)
    const sessionsConnect = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        code: 'auth_failed',
        message: 'Wrong password',
        secretKind: 'password',
        serverId: 'server-1'
      })
      .mockImplementationOnce(() => secondConnect.promise)

    window.winsshApi = createWinsshApiMock({
      servers: {
        create: serversCreate,
        list: serversList
      },
      sessions: {
        connect: sessionsConnect
      },
      system: {
        getCapabilities: vi.fn().mockResolvedValue({ credentialStorage: true })
      }
    })

    renderQuickInput()

    fireEvent.click(screen.getByRole('button', { name: 'Start Quick Connect' }))

    expect(await screen.findByText('Enter Connection Password')).toBeInTheDocument()
    expect(
      screen.getByText('Enter the password to continue connecting to root@127.0.0.1.')
    ).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Enter the server password'), {
      target: { value: 'wrong-password' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => {
      expect(serversCreate).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText('Wrong password')).toBeInTheDocument()
    expect(sessionsConnect).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        serverId: 'server-1',
        sessionId: expect.any(String),
        secrets: {
          'server-1': {
            password: 'wrong-password',
            rememberPassword: true
          }
        }
      })
    )

    const pendingSessionId = useSessionsStore.getState().tabs[0]?.sessionId
    expect(pendingSessionId).toEqual(expect.any(String))

    fireEvent.change(screen.getByPlaceholderText('Enter the server password'), {
      target: { value: 'correct-password' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    expect(useSessionsStore.getState().tabs).toHaveLength(1)
    expect(useSessionsStore.getState().tabs[0]?.sessionId).toBe(pendingSessionId)

    secondConnect.resolve({
      ok: true,
      summary: {
        connectedAt: new Date().toISOString(),
        currentPath: '/root',
        host: '127.0.0.1',
        port: 22,
        serverId: 'server-1',
        serverName: 'root@127.0.0.1',
        sessionId: 'session-1',
        status: 'ready'
      }
    })

    await waitFor(() => {
      expect(useSessionsStore.getState().activeSessionId).toBe('session-1')
      expect(
        useSessionsStore.getState().tabs.some((tab) => tab.sessionId === 'session-1')
      ).toBe(true)
    })

    expect(serversCreate).toHaveBeenCalledTimes(1)
    expect(sessionsConnect).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        serverId: 'server-1',
        sessionId: pendingSessionId,
        secrets: {
          'server-1': {
            password: 'correct-password',
            rememberPassword: true
          }
        }
      })
    )
  })
})
