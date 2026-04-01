import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { DEFAULT_DARK_THEME_ID, DEFAULT_PIXEL_THEME_ID } from '@shared/themes'
import type { AppSettings } from '@shared/types'
import i18n from '@/i18n'
import { WorkbenchSettingsEditor } from '@/components/workbench/workbench-settings-editor'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useWorkbenchStore } from '@/store/workbench-store'

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
})
