import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { TransferProgressEvent } from '@shared/types'
import i18n from '@/i18n'
import { MIN_TRANSFER_PANEL_REVEAL_SIZE_PX } from '@/lib/workbench'
import { useSessionEvents } from '@/hooks/use-session-events'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'

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

function SessionEventsHarness() {
  useSessionEvents()
  return null
}

describe('useSessionEvents', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en-US')
    localStorage.clear()
    useWorkbenchStore.getState().reset()
    useSessionsStore.getState().clear()
    useLocalTerminalsStore.getState().clear()
  })

  it('opens the transfers panel at a usable height when an upload starts', () => {
    let transferListener: ((event: TransferProgressEvent) => void) | null = null

    window.winsshApi = createWinsshApiMock({
      sftp: {
        onTransferProgress: (listener) => {
          transferListener = listener
          return () => undefined
        }
      }
    })

    render(
      <QueryClientProvider client={createTestQueryClient()}>
        <SessionEventsHarness />
      </QueryClientProvider>
    )

    act(() => {
      transferListener?.({
        direction: 'upload',
        fileName: 'build.tar.gz',
        remotePath: '/var/www/build.tar.gz',
        sessionId: 'session-1',
        status: 'running',
        total: 1024,
        transferred: 128
      })
    })

    const state = useWorkbenchStore.getState()
    expect(state.activePanelId).toBe('transfers')
    expect(state.panelOpen).toBe(true)
    expect(state.panelSizePx).toBe(MIN_TRANSFER_PANEL_REVEAL_SIZE_PX)
  })
})
