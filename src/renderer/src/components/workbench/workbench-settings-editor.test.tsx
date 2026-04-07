import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  createThemeDefinition,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_PIXEL_THEME_ID
} from '@shared/themes'
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
  localTerminalShell: 'zsh',
  terminalFontFamily: 'JetBrains Mono, Consolas, monospace',
  terminalFontSize: 14,
  theme: DEFAULT_DARK_THEME_ID,
  windowTitleBarStyle: 'custom'
}

const importedTheme = createThemeDefinition({
  appearance: 'dark',
  id: 'acme.nebula',
  label: 'Nebula',
  pluginDisplayName: 'Nebula Pack',
  pluginId: 'acme.nebula-pack',
  source: 'user',
  version: '1.2.0'
})

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: 'Linux x86_64'
  })
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
          localTerminalShell: 'zsh',
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
          localTerminalShell: 'zsh',
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
      localTerminalShell: 'zsh',
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
          localTerminalShell: 'zsh',
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

  it('imports a ZIP theme pack and refreshes the available theme list', async () => {
    const baseApi = createWinsshApiMock()
    const initialThemes = await baseApi.themes.list()
    const listThemes = vi
      .fn()
      .mockResolvedValueOnce(initialThemes)
      .mockResolvedValue([...initialThemes, importedTheme])
    const importArchive = vi.fn().mockResolvedValue({
      pluginDisplayName: 'Nebula Pack',
      pluginId: 'acme.nebula-pack',
      themes: [
        {
          id: importedTheme.id,
          label: importedTheme.label
        }
      ]
    })

    window.winsshApi = createWinsshApiMock({
      themes: {
        importArchive,
        list: listThemes
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Import' }))

    await waitFor(() => {
      expect(importArchive).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText('Nebula Pack')).toBeInTheDocument()
    expect((await screen.findAllByText('Nebula')).length).toBeGreaterThan(0)
  })

  it('deletes an imported theme pack and refreshes the selected theme', async () => {
    const baseApi = createWinsshApiMock()
    const initialThemes = [...(await baseApi.themes.list()), importedTheme]
    const listThemes = vi
      .fn()
      .mockResolvedValueOnce(initialThemes)
      .mockResolvedValue(initialThemes.filter((theme) => theme.id !== importedTheme.id))
    const getSettings = vi
      .fn()
      .mockResolvedValueOnce({
        ...persistedDarkSettings,
        theme: importedTheme.id
      })
      .mockResolvedValue({
        ...persistedDarkSettings,
        theme: DEFAULT_DARK_THEME_ID
      })
    const deletePlugin = vi.fn().mockResolvedValue({
      deletedThemeIds: [importedTheme.id],
      nextThemeSelection: DEFAULT_DARK_THEME_ID,
      pluginDisplayName: 'Nebula Pack',
      pluginId: 'acme.nebula-pack'
    })

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: getSettings
      },
      themes: {
        deletePlugin,
        list: listThemes
      }
    })

    renderSettingsEditor()

    expect(await screen.findByText('Nebula Pack')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0] as HTMLElement)
    expect(await screen.findByText('Delete Imported Theme Pack')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1) as HTMLElement)

    await waitFor(() => {
      expect(deletePlugin).toHaveBeenCalledWith('acme.nebula-pack')
    })
    await waitFor(() => {
      expect(screen.queryByText('Nebula Pack')).not.toBeInTheDocument()
    })
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Theme mode' })).toHaveTextContent('Dark+')
    })
  })

  it('uses a searchable combobox to save terminal font settings', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      copyOnSelect: true,
      cursorBlink: true,
      cursorStyle: 'block',
      experimentalTerminalWebgl: false,
      language: 'en-US',
      localTerminalShell: 'zsh',
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
          localTerminalShell: 'zsh',
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

  it('shows Windows shell options and saves the selected local terminal shell', async () => {
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'Win32'
    })

    const updateSettings = vi.fn().mockResolvedValue({
      copyOnSelect: true,
      cursorBlink: true,
      cursorStyle: 'block',
      experimentalTerminalWebgl: false,
      language: 'en-US',
      localTerminalShell: 'powershell',
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
          localTerminalShell: 'cmd',
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

    const shellSelect = screen.getByRole('combobox', { name: 'Local terminal shell' })
    fireEvent.click(shellSelect)
    expect((await screen.findAllByText('Command Prompt (cmd)')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('PowerShell').length).toBeGreaterThan(0)
    expect(screen.queryByText('Bash')).not.toBeInTheDocument()
    expect(screen.queryByText('Zsh')).not.toBeInTheDocument()

    fireEvent.click(screen.getAllByText('PowerShell').at(-1) as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          localTerminalShell: 'powershell'
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
      localTerminalShell: 'zsh',
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
          localTerminalShell: 'zsh',
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
