import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import {
  createThemeDefinition,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_PIXEL_THEME_ID
} from '@shared/themes'
import type { AppSettings } from '@shared/types'
import { toast } from 'sonner'
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
  autoUpdateCheckEnabled: true,
  copyOnSelect: true,
  cursorBlink: true,
  cursorStyle: 'block',
  experimentalTerminalWebgl: false,
  language: 'system',
  localTerminalShell: 'zsh',
  terminalFontFamily: 'JetBrains Mono, Consolas, monospace',
  terminalFontSize: 14,
  theme: DEFAULT_DARK_THEME_ID,
  webdavBackupEnabled: false,
  webdavBackupIntervalMinutes: 60,
  webdavBackupPath: '/winssh-backup/',
  webdavUrl: null,
  webdavUsername: null,
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
  vi.clearAllMocks()
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
          autoUpdateCheckEnabled: true,
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
          autoUpdateCheckEnabled: true,
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

  it('loads and saves the updated theme immediately after selection', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      autoUpdateCheckEnabled: true,
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

    renderSettingsEditor()

    const themeSelect = await screen.findByRole('combobox', { name: 'Theme mode' })
    fireEvent.click(themeSelect)
    const pixelOptions = await screen.findAllByText('Pixel CRT')
    fireEvent.click(pixelOptions[pixelOptions.length - 1] as HTMLElement)

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        theme: DEFAULT_PIXEL_THEME_ID
      })
    })
  })

  it('does not render a save button for application settings', async () => {
    window.winsshApi = createWinsshApiMock()

    renderSettingsEditor()

    await screen.findByRole('combobox', { name: 'Theme mode' })
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
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

  it('uses a searchable combobox to save terminal font settings immediately', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      autoUpdateCheckEnabled: true,
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
          autoUpdateCheckEnabled: true,
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

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        terminalFontFamily: 'IBM Plex Mono'
      })
    })
  })

  it('shows Windows shell options and saves the selected local terminal shell', async () => {
    Object.defineProperty(window.navigator, 'platform', {
      configurable: true,
      value: 'Win32'
    })

    const updateSettings = vi.fn().mockResolvedValue({
      autoUpdateCheckEnabled: true,
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
          autoUpdateCheckEnabled: true,
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

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        localTerminalShell: 'powershell'
      })
    })
  })

  it('saves terminal toggles and cursor style immediately', async () => {
    const updateSettings = vi.fn().mockImplementation(async (input) => ({
      autoUpdateCheckEnabled: true,
      copyOnSelect:
        typeof input.copyOnSelect === 'boolean'
          ? input.copyOnSelect
          : persistedDarkSettings.copyOnSelect,
      cursorBlink:
        typeof input.cursorBlink === 'boolean'
          ? input.cursorBlink
          : persistedDarkSettings.cursorBlink,
      cursorStyle: input.cursorStyle ?? persistedDarkSettings.cursorStyle,
      experimentalTerminalWebgl:
        typeof input.experimentalTerminalWebgl === 'boolean'
          ? input.experimentalTerminalWebgl
          : persistedDarkSettings.experimentalTerminalWebgl,
      language: persistedDarkSettings.language,
      localTerminalShell: persistedDarkSettings.localTerminalShell,
      terminalFontFamily: persistedDarkSettings.terminalFontFamily,
      terminalFontSize: persistedDarkSettings.terminalFontSize,
      theme: persistedDarkSettings.theme,
      windowTitleBarStyle: persistedDarkSettings.windowTitleBarStyle
    }))

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue(persistedDarkSettings),
        update: updateSettings
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Terminal' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Blinking cursor' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Copy on select' }))
    fireEvent.click(screen.getByRole('combobox', { name: 'Cursor style' }))
    fireEvent.click(await screen.findByText('Underline'))

    await waitFor(() => {
      expect(updateSettings).toHaveBeenNthCalledWith(1, {
        cursorBlink: false
      })
      expect(updateSettings).toHaveBeenNthCalledWith(2, {
        copyOnSelect: false
      })
      expect(updateSettings).toHaveBeenNthCalledWith(3, {
        cursorStyle: 'underline'
      })
    })
  })

  it('saves the experimental WebGL renderer toggle from the terminal settings section', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      autoUpdateCheckEnabled: true,
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
          autoUpdateCheckEnabled: true,
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

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        experimentalTerminalWebgl: true
      })
    })
  })

  it('saves the terminal font size on blur only', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      ...persistedDarkSettings,
      terminalFontSize: 16
    })

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue(persistedDarkSettings),
        update: updateSettings
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Terminal' }))

    const fontSizeInput = screen.getByRole('spinbutton', { name: 'Terminal font size' })
    fireEvent.change(fontSizeInput, { target: { value: '16' } })

    expect(updateSettings).not.toHaveBeenCalled()

    fireEvent.blur(fontSizeInput)

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        terminalFontSize: 16
      })
    })
  })

  it('rolls back an invalid terminal font size on blur and shows an error toast', async () => {
    const updateSettings = vi.fn()

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue(persistedDarkSettings),
        update: updateSettings
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Terminal' }))

    const fontSizeInput = screen.getByRole('spinbutton', { name: 'Terminal font size' })
    fireEvent.change(fontSizeInput, { target: { value: '99' } })
    fireEvent.blur(fontSizeInput)

    await waitFor(() => {
      expect(fontSizeInput).toHaveValue(14)
    })
    expect(updateSettings).not.toHaveBeenCalled()
    expect(toast.error).toHaveBeenCalledWith('Settings form validation failed.')
  })

  it('shows the saved value again when an automatic save fails', async () => {
    const updateSettings = vi.fn().mockRejectedValue(new Error('Unable to persist settings'))

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue(persistedDarkSettings),
        update: updateSettings
      }
    })

    renderSettingsEditor()

    const themeSelect = await screen.findByRole('combobox', { name: 'Theme mode' })
    fireEvent.click(themeSelect)
    const pixelOptions = await screen.findAllByText('Pixel CRT')
    fireEvent.click(pixelOptions[pixelOptions.length - 1] as HTMLElement)

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        theme: DEFAULT_PIXEL_THEME_ID
      })
    })
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Theme mode' })).toHaveTextContent('Dark+')
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

  it('opens a restore dialog, lists WebDAV backups, and relaunches after restoring the selected backup', async () => {
    const listBackups = vi.fn().mockResolvedValue([
      {
        fileName: 'winssh-win32-2026-04-24T08-00-00-000Z.db',
        modifiedAt: '2026-04-24T08:00:00.000Z'
      },
      {
        fileName: 'winssh-win32-2026-04-23T08-00-00-000Z.db',
        modifiedAt: '2026-04-23T08:00:00.000Z'
      }
    ])
    const restore = vi.fn().mockResolvedValue(undefined)
    const relaunch = vi.fn().mockResolvedValue(undefined)

    window.winsshApi = createWinsshApiMock({
      backup: {
        list: listBackups,
        restore
      },
      system: {
        relaunch
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Backup' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore from WebDAV' }))

    expect(await screen.findByText('Choose a Backup to Restore')).toBeInTheDocument()
    expect(listBackups).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('winssh-win32-2026-04-24T08-00-00-000Z.db')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restore Selected Backup' })).toBeDisabled()

    fireEvent.click(screen.getByText('winssh-win32-2026-04-23T08-00-00-000Z.db'))
    fireEvent.click(screen.getByRole('button', { name: 'Restore Selected Backup' }))

    await waitFor(() => {
      expect(restore).toHaveBeenCalledWith('winssh-win32-2026-04-23T08-00-00-000Z.db')
    })
    await waitFor(() => {
      expect(relaunch).toHaveBeenCalledTimes(1)
    })
    await waitFor(() => {
      expect(screen.queryByText('Choose a Backup to Restore')).not.toBeInTheDocument()
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('confirms before deleting a WebDAV backup and refreshes the backup list', async () => {
    const firstBackup = {
      fileName: 'winssh-win32-2026-04-24T08-00-00-000Z.db',
      modifiedAt: '2026-04-24T08:00:00.000Z'
    }
    const secondBackup = {
      fileName: 'winssh-win32-2026-04-23T08-00-00-000Z.db',
      modifiedAt: '2026-04-23T08:00:00.000Z'
    }
    const listBackups = vi
      .fn()
      .mockResolvedValueOnce([firstBackup, secondBackup])
      .mockResolvedValueOnce([secondBackup])
    const deleteBackup = vi.fn().mockResolvedValue(undefined)

    window.winsshApi = createWinsshApiMock({
      backup: {
        delete: deleteBackup,
        list: listBackups
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Backup' }))
    fireEvent.click(screen.getByRole('button', { name: 'Restore from WebDAV' }))

    expect(await screen.findByText('Choose a Backup to Restore')).toBeInTheDocument()
    expect(await screen.findByText(firstBackup.fileName)).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: `Delete backup ${firstBackup.fileName}`
      })
    )

    expect(deleteBackup).not.toHaveBeenCalled()
    expect(await screen.findByText('Delete WebDAV Backup')).toBeInTheDocument()

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' }).at(-1) as HTMLElement)

    await waitFor(() => {
      expect(deleteBackup).toHaveBeenCalledWith(firstBackup.fileName)
    })
    await waitFor(() => {
      expect(listBackups).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(screen.queryByText(firstBackup.fileName)).not.toBeInTheDocument()
    })
    expect(screen.getByText(secondBackup.fileName)).toBeInTheDocument()
  })

  it('renders app version details in the about section', async () => {
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

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'About' }))

    expect(await screen.findByText('0.2.0-beta.1')).toBeInTheDocument()
    expect(screen.getByText('Windows')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('does not render an updates section in the settings navigation anymore', async () => {
    window.winsshApi = createWinsshApiMock()

    renderSettingsEditor()

    expect(await screen.findByRole('button', { name: 'Appearance' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Updates' })).not.toBeInTheDocument()
  })
})
