import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEFAULT_DARK_THEME_ID, DEFAULT_PIXEL_THEME_ID } from '@shared/themes'
import type { AppSettings } from '@shared/types'
import i18n from '@/i18n'
import { WorkbenchSettingsEditor } from '@/components/workbench/workbench-settings-editor'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useWorkbenchStore } from '@/store/workbench-store'

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

function renderSettingsEditor(queryClient = createTestQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <WorkbenchSettingsEditor />
    </QueryClientProvider>
  )
}

const persistedDarkSettings: AppSettings = {
  copyOnSelect: true,
  cursorBlink: true,
  cursorStyle: 'block',
  experimentalTerminalWebgl: false,
  language: 'system',
  terminalFontFamily: 'JetBrains Mono, Consolas, monospace',
  terminalFontSize: 14,
  theme: DEFAULT_DARK_THEME_ID,
  windowTitleBarStyle: 'custom'
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
})

describe('WorkbenchSettingsEditor theme selection', () => {
  it('uses cached settings on the first render when the workbench has already bootstrapped', async () => {
    const api = createWinsshApiMock()
    const queryClient = createTestQueryClient()

    queryClient.setQueryData(['settings'], persistedDarkSettings)
    queryClient.setQueryData(['themes'], await api.themes.list())

    window.winsshApi = api

    renderSettingsEditor(queryClient)

    expect(screen.getByRole('combobox', { name: 'Theme mode' })).toHaveTextContent('Dark+')
    expect(screen.getByRole('combobox', { name: 'Window title bar' })).toHaveTextContent(
      'Custom Title Bar'
    )
  })

  it('shows the persisted built-in dark theme and custom title bar selections', async () => {
    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({
          copyOnSelect: true,
          cursorBlink: true,
          cursorStyle: 'block',
          experimentalTerminalWebgl: false,
          language: 'system',
          terminalFontFamily: 'JetBrains Mono, Consolas, monospace',
          terminalFontSize: 14,
          theme: DEFAULT_DARK_THEME_ID,
          windowTitleBarStyle: 'custom'
        })
      }
    })

    renderSettingsEditor()

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Theme mode' })).toHaveTextContent('Dark+')
    })

    expect(screen.getByRole('combobox', { name: 'Window title bar' })).toHaveTextContent(
      'Custom Title Bar'
    )
  })

  it('shows the persisted theme and title bar selections after loading settings', async () => {
    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({
          copyOnSelect: true,
          cursorBlink: true,
          cursorStyle: 'block',
          experimentalTerminalWebgl: false,
          language: 'en-US',
          terminalFontFamily: 'Consolas',
          terminalFontSize: 14,
          theme: DEFAULT_PIXEL_THEME_ID,
          windowTitleBarStyle: 'custom'
        })
      }
    })

    renderSettingsEditor()

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Theme mode' })).toHaveTextContent('Pixel CRT')
    })

    const themeSelect = screen.getByRole('combobox', { name: 'Theme mode' })
    const titleBarSelect = screen.getByRole('combobox', { name: 'Window title bar' })

    expect(themeSelect).toHaveTextContent('Pixel CRT')
    expect(titleBarSelect).toHaveTextContent('Custom Title Bar')
  })

  it('loads, allows selecting Pixel CRT, and saves the updated theme', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      copyOnSelect: true,
      cursorBlink: true,
      cursorStyle: 'block',
      experimentalTerminalWebgl: false,
      language: 'en-US',
      terminalFontFamily: 'Consolas',
      terminalFontSize: 14,
      theme: DEFAULT_PIXEL_THEME_ID,
      windowTitleBarStyle: 'custom'
    })

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({
          copyOnSelect: true,
          cursorBlink: true,
          cursorStyle: 'block',
          experimentalTerminalWebgl: false,
          language: 'en-US',
          terminalFontFamily: 'Consolas',
          terminalFontSize: 14,
          theme: 'system',
          windowTitleBarStyle: 'custom'
        }),
        update: updateSettings
      }
    })

    renderSettingsEditor()

    const themeSelect = await screen.findByRole('combobox', { name: 'Theme mode' })
    fireEvent.click(themeSelect)
    const pixelOptions = await screen.findAllByText('Pixel CRT')
    fireEvent.click(pixelOptions[pixelOptions.length - 1] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          theme: DEFAULT_PIXEL_THEME_ID
        })
      )
    })
  })

  it('uses a searchable combobox to save terminal font settings', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      copyOnSelect: true,
      cursorBlink: true,
      cursorStyle: 'block',
      experimentalTerminalWebgl: false,
      language: 'en-US',
      terminalFontFamily: 'IBM Plex Mono',
      terminalFontSize: 14,
      theme: DEFAULT_DARK_THEME_ID,
      windowTitleBarStyle: 'custom'
    })

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({
          copyOnSelect: true,
          cursorBlink: true,
          cursorStyle: 'block',
          experimentalTerminalWebgl: false,
          language: 'en-US',
          terminalFontFamily: 'Consolas',
          terminalFontSize: 14,
          theme: DEFAULT_DARK_THEME_ID,
          windowTitleBarStyle: 'custom'
        }),
        update: updateSettings
      },
      system: {
        listFonts: vi.fn().mockResolvedValue(['Consolas', 'IBM Plex Mono'])
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Terminal' }))

    const fontSelect = screen.getByRole('combobox', { name: 'Terminal font' })
    fireEvent.click(fontSelect)
    fireEvent.change(screen.getByPlaceholderText('Search system fonts or type a custom stack'), {
      target: { value: 'IBM Plex Mono' }
    })
    fireEvent.click(await screen.findByText('IBM Plex Mono'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          terminalFontFamily: 'IBM Plex Mono'
        })
      )
    })
  })

  it('saves the experimental WebGL renderer toggle from the terminal settings section', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      copyOnSelect: true,
      cursorBlink: true,
      cursorStyle: 'block',
      experimentalTerminalWebgl: true,
      language: 'en-US',
      terminalFontFamily: 'Consolas',
      terminalFontSize: 14,
      theme: DEFAULT_DARK_THEME_ID,
      windowTitleBarStyle: 'custom'
    })

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue({
          copyOnSelect: true,
          cursorBlink: true,
          cursorStyle: 'block',
          experimentalTerminalWebgl: false,
          language: 'en-US',
          terminalFontFamily: 'Consolas',
          terminalFontSize: 14,
          theme: DEFAULT_DARK_THEME_ID,
          windowTitleBarStyle: 'custom'
        }),
        update: updateSettings
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Terminal' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Experimental WebGL renderer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          experimentalTerminalWebgl: true
        })
      )
    })
  })

  it('deletes a trusted host from the security section', async () => {
    const getKnownHosts = vi
      .fn()
      .mockResolvedValueOnce([
        {
          algorithm: 'ssh-ed25519',
          fingerprint: 'SHA256:example',
          host: 'alpha.example.com',
          port: 22,
          verifiedAt: '2026-04-02T01:23:45.000Z'
        }
      ])
      .mockResolvedValueOnce([])
    const removeKnownHost = vi.fn().mockResolvedValue(undefined)

    window.winsshApi = createWinsshApiMock({
      system: {
        getKnownHosts,
        removeKnownHost
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Security' }))
    expect(await screen.findByText('alpha.example.com:22')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(removeKnownHost).toHaveBeenCalledWith('alpha.example.com', 22)
    })
    await waitFor(() => {
      expect(screen.queryByText('alpha.example.com:22')).not.toBeInTheDocument()
    })
  })
})
