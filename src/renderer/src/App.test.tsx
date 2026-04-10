import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { UpdateState } from '@shared/types'
import { HashRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from '@/App'
import i18n from '@/i18n'
import { useUpdateDialogStore } from '@/store/update-dialog-store'
import { createWinsshApiMock } from '@/test/create-winssh-api'

vi.mock('@/components/workbench/workbench-shell', () => ({
  WorkbenchShell: () => <div>Workbench</div>
}))

vi.mock('@/hooks/use-session-events', () => ({
  useSessionEvents: () => undefined
}))

vi.mock('@/hooks/use-prefers-dark', () => ({
  usePrefersDark: () => false
}))

vi.mock('@/lib/theme', () => ({
  applyThemeToRoot: vi.fn()
}))

vi.mock('sonner', () => ({
  Toaster: () => null
}))

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <App />
      </HashRouter>
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useUpdateDialogStore.getState().close()
})

describe('App update dialog', () => {
  it('opens a dialog when an update becomes available', async () => {
    const stateChangeCallbacks: Array<(state: UpdateState) => void> = []

    window.winsshApi = createWinsshApiMock({
      updates: {
        getState: vi.fn().mockResolvedValue({
          autoCheckEnabled: true,
          availableUpdate: null,
          currentVersion: '0.1.0',
          downloadProgressPercent: null,
          errorMessage: null,
          phase: 'idle',
          supported: true,
          unsupportedReason: null
        }),
        onStateChange: (callback) => {
          stateChangeCallbacks.push(callback)
          return () => undefined
        }
      }
    })

    renderApp()

    await screen.findByText('Workbench')
    await waitFor(() => {
      expect(stateChangeCallbacks).toHaveLength(1)
    })

    if (stateChangeCallbacks[0]) {
      stateChangeCallbacks[0]({
        autoCheckEnabled: true,
        availableUpdate: {
          releaseDate: '2026-04-09T00:00:00.000Z',
          releaseName: '0.1.1',
          releaseNotes: 'Bug fixes and polish.',
          version: '0.1.1'
        },
        currentVersion: '0.1.0',
        downloadProgressPercent: null,
        errorMessage: null,
        phase: 'available',
        supported: true,
        unsupportedReason: null
      })
    }

    expect(await screen.findByText('Update Available')).toBeInTheDocument()
    expect(screen.getByText('Bug fixes and polish.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Download Update' })).toBeInTheDocument()
  })

  it('downloads the update from the dialog action', async () => {
    const download = vi.fn().mockResolvedValue({
      autoCheckEnabled: true,
      availableUpdate: {
        releaseDate: '2026-04-09T00:00:00.000Z',
        releaseName: '0.1.1',
        releaseNotes: 'Bug fixes and polish.',
        version: '0.1.1'
      },
      currentVersion: '0.1.0',
      downloadProgressPercent: 10,
      errorMessage: null,
      phase: 'downloading',
      supported: true,
      unsupportedReason: null
    })

    window.winsshApi = createWinsshApiMock({
      updates: {
        download,
        getState: vi.fn().mockResolvedValue({
          autoCheckEnabled: true,
          availableUpdate: {
            releaseDate: '2026-04-09T00:00:00.000Z',
            releaseName: '0.1.1',
            releaseNotes: 'Bug fixes and polish.',
            version: '0.1.1'
          },
          currentVersion: '0.1.0',
          downloadProgressPercent: null,
          errorMessage: null,
          phase: 'available',
          supported: true,
          unsupportedReason: null
        })
      }
    })

    renderApp()

    fireEvent.click(await screen.findByRole('button', { name: 'Download Update' }))

    await waitFor(() => {
      expect(download).toHaveBeenCalledTimes(1)
    })
  })

  it('does not reopen the same version after the user dismisses it', async () => {
    const stateChangeCallbacks: Array<(state: UpdateState) => void> = []

    window.winsshApi = createWinsshApiMock({
      updates: {
        getState: vi.fn().mockResolvedValue({
          autoCheckEnabled: true,
          availableUpdate: null,
          currentVersion: '0.1.0',
          downloadProgressPercent: null,
          errorMessage: null,
          phase: 'idle',
          supported: true,
          unsupportedReason: null
        }),
        onStateChange: (callback) => {
          stateChangeCallbacks.push(callback)
          return () => undefined
        }
      }
    })

    renderApp()
    await screen.findByText('Workbench')
    await waitFor(() => {
      expect(stateChangeCallbacks).toHaveLength(1)
    })

    const availableState: UpdateState = {
      autoCheckEnabled: true,
      availableUpdate: {
        releaseDate: '2026-04-09T00:00:00.000Z',
        releaseName: '0.1.1',
        releaseNotes: 'Bug fixes and polish.',
        version: '0.1.1'
      },
      currentVersion: '0.1.0',
      downloadProgressPercent: null,
      errorMessage: null,
      phase: 'available',
      supported: true,
      unsupportedReason: null
    }

    if (stateChangeCallbacks[0]) {
      stateChangeCallbacks[0](availableState)
    }
    expect(await screen.findByText('Update Available')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Later' }))
    await waitFor(() => {
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
    })

    if (stateChangeCallbacks[0]) {
      stateChangeCallbacks[0](availableState)
    }

    await waitFor(() => {
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument()
    })
  })

  it('shows manual check progress and the up-to-date result in the dialog', async () => {
    const stateChangeCallbacks: Array<(state: UpdateState) => void> = []

    window.winsshApi = createWinsshApiMock({
      updates: {
        getState: vi.fn().mockResolvedValue({
          autoCheckEnabled: true,
          availableUpdate: null,
          currentVersion: '0.1.0',
          downloadProgressPercent: null,
          errorMessage: null,
          phase: 'checking',
          supported: true,
          unsupportedReason: null
        }),
        onStateChange: (callback) => {
          stateChangeCallbacks.push(callback)
          return () => undefined
        }
      }
    })

    useUpdateDialogStore.getState().openManual()
    renderApp()
    await waitFor(() => {
      expect(stateChangeCallbacks).toHaveLength(1)
    })

    expect(await screen.findByText('Checking for Updates')).toBeInTheDocument()

    if (stateChangeCallbacks[0]) {
      stateChangeCallbacks[0]({
        autoCheckEnabled: true,
        availableUpdate: null,
        currentVersion: '0.1.0',
        downloadProgressPercent: null,
        errorMessage: null,
        phase: 'not-available',
        supported: true,
        unsupportedReason: null
      })
    }

    expect(await screen.findByText('You Are Up to Date')).toBeInTheDocument()
    expect(screen.getByText('You are already on the latest available version.')).toBeInTheDocument()
  })
})
