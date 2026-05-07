import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import i18n from '@/i18n'
import { WorkbenchUpdatesEditor } from '@/components/workbench/workbench-updates-editor'
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

function renderUpdatesEditor(queryClient = createTestQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkbenchUpdatesEditor />
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  vi.clearAllMocks()
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

  it('saves the automatic update check toggle immediately', async () => {
    const queryClient = createTestQueryClient()
    const updateSettings = vi.fn().mockResolvedValue({
      autoUpdateCheckEnabled: false,
      copyOnSelect: true,
      cursorBlink: true,
      cursorStyle: 'block',
      experimentalTerminalWebgl: false,
      language: 'en-US',
      localTerminalShell: 'zsh',
      terminalFontId: 'cascadia-mono',
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
          terminalFontId: 'cascadia-mono',
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
      terminalFontId: 'cascadia-mono',
      terminalFontSize: 14,
      theme: 'system',
      windowTitleBarStyle: 'custom'
    })

    renderUpdatesEditor(queryClient)

    fireEvent.click(await screen.findByRole('switch', { name: 'Automatically check for updates' }))

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        autoUpdateCheckEnabled: false
      })
    })
  })

  it('does not render a save button for updates settings', async () => {
    window.winsshApi = createWinsshApiMock()

    renderUpdatesEditor()

    await screen.findByRole('switch', { name: 'Automatically check for updates' })
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('rolls back the auto-check toggle when saving fails', async () => {
    const queryClient = createTestQueryClient()
    const updateSettings = vi.fn().mockRejectedValue(new Error('Unable to persist settings'))

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
          terminalFontId: 'cascadia-mono',
          terminalFontSize: 14,
          theme: 'system',
          windowTitleBarStyle: 'custom'
        }),
        update: updateSettings
      },
      updates: {
        getState: vi.fn().mockResolvedValue({
          autoCheckEnabled: true,
          availableUpdate: null,
          currentVersion: '1.0.0',
          downloadProgressPercent: null,
          errorMessage: null,
          phase: 'idle',
          supported: true,
          unsupportedReason: null
        })
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
      terminalFontId: 'cascadia-mono',
      terminalFontSize: 14,
      theme: 'system',
      windowTitleBarStyle: 'custom'
    })
    queryClient.setQueryData(['updates', 'state'], {
      autoCheckEnabled: true,
      availableUpdate: null,
      currentVersion: '1.0.0',
      downloadProgressPercent: null,
      errorMessage: null,
      phase: 'idle',
      supported: true,
      unsupportedReason: null
    })

    renderUpdatesEditor(queryClient)

    const autoCheckSwitch = await screen.findByRole('switch', {
      name: 'Automatically check for updates'
    })
    fireEvent.click(autoCheckSwitch)

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        autoUpdateCheckEnabled: false
      })
    })
    await waitFor(() => {
      expect(autoCheckSwitch).toHaveAttribute('aria-checked', 'true')
    })

    expect(queryClient.getQueryData(['updates', 'state'])).toMatchObject({
      autoCheckEnabled: true
    })
    expect(toast.error).toHaveBeenCalledWith('Unable to persist settings')
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
      currentVersion: '1.0.0',
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
          currentVersion: '1.0.0',
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
          currentVersion: '1.0.0',
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
          currentVersion: '1.0.0',
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
          currentVersion: '1.0.0',
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
