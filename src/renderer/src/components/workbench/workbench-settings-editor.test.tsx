import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchSettingsEditor } from '@/components/workbench/workbench-settings-editor'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useWorkbenchStore } from '@/store/workbench-store'

function renderSettingsEditor() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <WorkbenchSettingsEditor />
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
})

describe('WorkbenchSettingsEditor theme selection', () => {
  it('loads, allows selecting Pixel CRT, and saves the updated theme', async () => {
    const updateSettings = vi.fn().mockResolvedValue({
      copyOnSelect: true,
      cursorBlink: true,
      cursorStyle: 'block',
      language: 'en-US',
      terminalFontFamily: 'Consolas',
      terminalFontSize: 14,
      theme: 'pixel',
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
          theme: 'pixel'
        })
      )
    })
  })
})
