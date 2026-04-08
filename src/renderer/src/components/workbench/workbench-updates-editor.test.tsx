import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/i18n'
import { WorkbenchUpdatesEditor } from '@/components/workbench/workbench-updates-editor'
import { createWinsshApiMock } from '@/test/create-winssh-api'

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

function renderUpdatesEditor(queryClient = createTestQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkbenchUpdatesEditor />
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
})

describe('WorkbenchUpdatesEditor', () => {
  it('renders current app version details', async () => {
    window.winsshApi = createWinsshApiMock({
      system: {
        getAppInfo: vi.fn().mockResolvedValue({
          name: 'WinSSH',
          platform: 'win32',
          releaseChannel: 'beta',
          version: '0.2.0-beta.1'
        })
      }
    })

    renderUpdatesEditor()

    expect(await screen.findByText('0.2.0-beta.1')).toBeInTheDocument()
    expect(screen.getByText('Windows')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('saves the automatic update check toggle', async () => {
    const queryClient = createTestQueryClient()
    const updateSettings = vi.fn().mockResolvedValue({
      autoUpdateCheckEnabled: false,
      copyOnSelect: true,
      cursorBlink: true,
      cursorStyle: 'block',
      experimentalTerminalWebgl: false,
      language: 'en-US',
      localTerminalShell: 'zsh',
      terminalFontFamily: 'Consolas',
      terminalFontSize: 14,
      theme: 'system',
      windowTitleBarStyle: 'custom'
    })

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({
          autoUpdateCheckEnabled: true,
          copyOnSelect: true,
          cursorBlink: true,
          cursorStyle: 'block',
          experimentalTerminalWebgl: false,
          language: 'en-US',
          localTerminalShell: 'zsh',
          terminalFontFamily: 'Consolas',
          terminalFontSize: 14,
          theme: 'system',
          windowTitleBarStyle: 'custom'
        }),
        update: updateSettings
      }
    })

    queryClient.setQueryData(['settings'], {
      autoUpdateCheckEnabled: true,
      copyOnSelect: true,
      cursorBlink: true,
      cursorStyle: 'block',
      experimentalTerminalWebgl: false,
      language: 'en-US',
      localTerminalShell: 'zsh',
      terminalFontFamily: 'Consolas',
      terminalFontSize: 14,
      theme: 'system',
      windowTitleBarStyle: 'custom'
    })

    renderUpdatesEditor(queryClient)

    fireEvent.click(await screen.findByRole('switch', { name: 'Automatically check for updates' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        autoUpdateCheckEnabled: false
      })
    })
  })

  it('checks for updates and shows the download action', async () => {
    const check = vi.fn().mockResolvedValue({
      autoCheckEnabled: true,
      availableUpdate: {
        releaseDate: '2026-04-08T00:00:00.000Z',
        releaseName: '0.2.0',
        releaseNotes: 'Bug fixes',
        version: '0.2.0'
      },
      currentVersion: '0.1.0',
      downloadProgressPercent: null,
      errorMessage: null,
      phase: 'available',
      supported: true,
      unsupportedReason: null
    })

    window.winsshApi = createWinsshApiMock({
      updates: {
        check,
        getState: vi.fn().mockResolvedValue({
          autoCheckEnabled: true,
          availableUpdate: null,
          currentVersion: '0.1.0',
          downloadProgressPercent: null,
          errorMessage: null,
          phase: 'idle',
          supported: true,
          unsupportedReason: null
        })
      }
    })

    renderUpdatesEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Check for Updates' }))

    await waitFor(() => {
      expect(check).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByRole('button', { name: 'Download Update' })).toBeInTheDocument()
  })

  it('shows install action when the update has been downloaded', async () => {
    const quitAndInstall = vi.fn().mockResolvedValue(undefined)

    window.winsshApi = createWinsshApiMock({
      updates: {
        getState: vi.fn().mockResolvedValue({
          autoCheckEnabled: true,
          availableUpdate: {
            releaseDate: '2026-04-08T00:00:00.000Z',
            releaseName: '0.2.0',
            releaseNotes: 'Bug fixes',
            version: '0.2.0'
          },
          currentVersion: '0.1.0',
          downloadProgressPercent: 100,
          errorMessage: null,
          phase: 'downloaded',
          supported: true,
          unsupportedReason: null
        }),
        quitAndInstall
      }
    })

    renderUpdatesEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Restart to Install' }))

    await waitFor(() => {
      expect(quitAndInstall).toHaveBeenCalledTimes(1)
    })
  })

  it('renders unsupported update state', async () => {
    window.winsshApi = createWinsshApiMock({
      updates: {
        getState: vi.fn().mockResolvedValue({
          autoCheckEnabled: true,
          availableUpdate: null,
          currentVersion: '0.1.0',
          downloadProgressPercent: null,
          errorMessage: null,
          phase: 'unsupported',
          supported: false,
          unsupportedReason: 'platform_not_supported'
        })
      }
    })

    renderUpdatesEditor()

    expect(
      await screen.findByText('Automatic updates are not supported on Linux in this build.')
    ).toBeInTheDocument()
  })

  it('renders update errors', async () => {
    window.winsshApi = createWinsshApiMock({
      updates: {
        getState: vi.fn().mockResolvedValue({
          autoCheckEnabled: true,
          availableUpdate: null,
          currentVersion: '0.1.0',
          downloadProgressPercent: null,
          errorMessage: 'network unavailable',
          phase: 'error',
          supported: true,
          unsupportedReason: null
        })
      }
    })

    renderUpdatesEditor()

    expect(await screen.findByText('network unavailable')).toBeInTheDocument()
  })
})
