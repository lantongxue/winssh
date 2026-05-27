import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { AppSettings } from '@shared/types'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import i18n from '@/i18n'
import { WorkbenchSettingsEditor } from '@/components/workbench/workbench-settings-editor'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'
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

const baseSettings: AppSettings = {
  ...DEFAULT_APP_SETTINGS,
  awayReminderEnabled: true,
  awayReminderTimeoutMs: 30000
}

beforeEach(async () => {
  vi.clearAllMocks()
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  Object.defineProperty(window.navigator, 'platform', {
    configurable: true,
    value: 'Linux x86_64'
  })
})

describe('WorkbenchSettingsEditor away reminder settings', () => {
  it('renders the away reminder enable switch and timeout input in the security section', async () => {
    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue(baseSettings)
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Security' }))

    expect(screen.getByRole('switch', { name: 'Enable Away Reminder' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Away Timeout' })).toBeInTheDocument()
  })

  it('saves awayReminderEnabled when toggling the switch', async () => {
    const updateSettings = vi.fn().mockImplementation(async (input) => ({
      ...baseSettings,
      awayReminderEnabled:
        typeof input.awayReminderEnabled === 'boolean'
          ? input.awayReminderEnabled
          : baseSettings.awayReminderEnabled
    }))

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue(baseSettings),
        update: updateSettings
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Security' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Away Reminder' }))

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        awayReminderEnabled: false
      })
    })
  })

  it('saves awayReminderTimeoutMs in milliseconds when the timeout input blurs with seconds value', async () => {
    const updateSettings = vi.fn().mockImplementation(async (input) => ({
      ...baseSettings,
      awayReminderTimeoutMs: input.awayReminderTimeoutMs ?? baseSettings.awayReminderTimeoutMs
    }))

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue(baseSettings),
        update: updateSettings
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Security' }))

    const timeoutInput = screen.getByRole('spinbutton', { name: 'Away Timeout' })
    fireEvent.change(timeoutInput, { target: { value: '60' } })
    fireEvent.blur(timeoutInput)

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith({
        awayReminderTimeoutMs: 60000
      })
    })
  })

  it('displays the timeout value in seconds (dividing ms by 1000)', async () => {
    const settingsWithTimeout: AppSettings = {
      ...baseSettings,
      awayReminderTimeoutMs: 60000
    }

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue(settingsWithTimeout)
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Security' }))

    const timeoutInput = screen.getByRole('spinbutton', { name: 'Away Timeout' })
    expect(timeoutInput).toHaveValue(60)
  })

  it('hides the timeout input when awayReminderEnabled is false', async () => {
    const disabledSettings: AppSettings = {
      ...baseSettings,
      awayReminderEnabled: false
    }

    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue(disabledSettings)
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Security' }))

    expect(screen.getByRole('switch', { name: 'Enable Away Reminder' })).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: 'Away Timeout' })).not.toBeInTheDocument()
  })

  it('shows the timeout description text when the timeout input is visible', async () => {
    window.winsshApi = createWinsshApiMock({
      settings: {
        get: vi.fn().mockResolvedValue(baseSettings)
      }
    })

    renderSettingsEditor()

    fireEvent.click(await screen.findByRole('button', { name: 'Security' }))

    expect(
      screen.getByText('After this duration of inactivity, the overlay will appear.')
    ).toBeInTheDocument()
  })
})