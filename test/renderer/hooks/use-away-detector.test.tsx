import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { AppFocusEvent, AppActivityEvent } from '@shared/types'
import type { AppSettings } from '@shared/types'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { queryKeys } from '@/features/shared/query-keys'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'
import { useAwayReminderStore } from '@/store/away-reminder-store'
import { useAwayDetector } from '@/hooks/use-away-detector'

function defaultSettings(overrides: Partial<AppSettings> = {}): AppSettings {
  return {
    ...DEFAULT_APP_SETTINGS,
    language: 'en-US',
    terminalFontId: 'cascadia-mono',
    windowTitleBarStyle: 'custom',
    ...overrides
  }
}

function createWrapperWithCache(settings: AppSettings) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
  queryClient.setQueryData(queryKeys.settings, settings)
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useAwayDetector', () => {
  let focusCallbacks: ((event: AppFocusEvent) => void)[]
  let activityCallbacks: ((event: AppActivityEvent) => void)[]
  let mockSettings: AppSettings

  beforeEach(() => {
    useAwayReminderStore.getState().reset()

    focusCallbacks = []
    activityCallbacks = []
    mockSettings = defaultSettings({ awayReminderEnabled: true, awayReminderTimeoutMs: 30000 })

    window.winsshApi = createWinsshApiMock({
      system: {
        appFocus: {
          onStateChange: vi.fn((cb: (event: AppFocusEvent) => void) => {
            focusCallbacks.push(cb)
            return () => {
              focusCallbacks = focusCallbacks.filter((c) => c !== cb)
            }
          })
        },
        appActivity: {
          onStateChange: vi.fn((cb: (event: AppActivityEvent) => void) => {
            activityCallbacks.push(cb)
            return () => {
              activityCallbacks = activityCallbacks.filter((c) => c !== cb)
            }
          })
        }
      },
      settings: {
        get: async () => mockSettings,
        update: async (input) => ({ ...mockSettings, ...input }) as AppSettings
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function emitFocusEvent(event: AppFocusEvent) {
    for (const cb of [...focusCallbacks]) {
      cb(event)
    }
  }

  function emitActivityEvent(event: AppActivityEvent) {
    for (const cb of [...activityCallbacks]) {
      cb(event)
    }
  }

  async function renderAwayDetector(settings: AppSettings = mockSettings) {
    const result = renderHook(() => useAwayDetector(), {
      wrapper: createWrapperWithCache(settings)
    })
    await waitFor(() => {
      expect(focusCallbacks.length + activityCallbacks.length).toBeGreaterThan(0)
    })
    return result
  }

  it('subscribes to appFocus and appActivity on mount', async () => {
    await renderAwayDetector()

    expect(focusCallbacks.length).toBe(1)
    expect(activityCallbacks.length).toBe(1)
  })

  it('unsubscribes from appFocus and appActivity on unmount', async () => {
    const { unmount } = await renderAwayDetector()

    expect(focusCallbacks.length).toBe(1)
    expect(activityCallbacks.length).toBe(1)

    unmount()

    expect(focusCallbacks.length).toBe(0)
    expect(activityCallbacks.length).toBe(0)
  })

  it('blurred event → markAway()', async () => {
    const { unmount } = await renderAwayDetector()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'))
    useAwayReminderStore.getState().reset()

    emitFocusEvent({ phase: 'blurred' })

    expect(useAwayReminderStore.getState().awayTimestamp).toBe(Date.now())
    expect(useAwayReminderStore.getState().overlayVisible).toBe(false)

    unmount()
  })

  it('focused event → handleFocusReturn(timeoutMs) when away > timeout', async () => {
    const { unmount } = await renderAwayDetector()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'))
    useAwayReminderStore.getState().reset()

    emitFocusEvent({ phase: 'blurred' })
    vi.advanceTimersByTime(60_000)
    emitFocusEvent({ phase: 'focused' })

    expect(useAwayReminderStore.getState().overlayVisible).toBe(true)

    unmount()
  })

  it('focused event → handleFocusReturn(timeoutMs) when away < timeout, clears awayTimestamp', async () => {
    const { unmount } = await renderAwayDetector()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'))
    useAwayReminderStore.getState().reset()

    emitFocusEvent({ phase: 'blurred' })
    vi.advanceTimersByTime(10_000)
    emitFocusEvent({ phase: 'focused' })

    expect(useAwayReminderStore.getState().overlayVisible).toBe(false)
    expect(useAwayReminderStore.getState().awayTimestamp).toBeNull()

    unmount()
  })

  it('sleep event → markAway()', async () => {
    const { unmount } = await renderAwayDetector()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'))
    useAwayReminderStore.getState().reset()

    emitActivityEvent({ phase: 'sleep' })

    expect(useAwayReminderStore.getState().awayTimestamp).toBe(Date.now())

    unmount()
  })

  it('lock-screen event → markAway()', async () => {
    const { unmount } = await renderAwayDetector()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'))
    useAwayReminderStore.getState().reset()

    emitActivityEvent({ phase: 'lock-screen' })

    expect(useAwayReminderStore.getState().awayTimestamp).toBe(Date.now())

    unmount()
  })

  it('wake event → handleFocusReturn(timeoutMs) when away > timeout', async () => {
    const { unmount } = await renderAwayDetector()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'))
    useAwayReminderStore.getState().reset()

    emitActivityEvent({ phase: 'sleep' })
    vi.advanceTimersByTime(60_000)
    emitActivityEvent({ phase: 'wake' })

    expect(useAwayReminderStore.getState().overlayVisible).toBe(true)

    unmount()
  })

  it('unlock-screen event → handleFocusReturn(timeoutMs) when away > timeout', async () => {
    const { unmount } = await renderAwayDetector()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'))
    useAwayReminderStore.getState().reset()

    emitActivityEvent({ phase: 'lock-screen' })
    vi.advanceTimersByTime(60_000)
    emitActivityEvent({ phase: 'unlock-screen' })

    expect(useAwayReminderStore.getState().overlayVisible).toBe(true)

    unmount()
  })

  it('wake event with away < timeout → overlayVisible = false, awayTimestamp cleared', async () => {
    const { unmount } = await renderAwayDetector()

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'))
    useAwayReminderStore.getState().reset()

    emitActivityEvent({ phase: 'sleep' })
    vi.advanceTimersByTime(10_000)
    emitActivityEvent({ phase: 'wake' })

    expect(useAwayReminderStore.getState().overlayVisible).toBe(false)
    expect(useAwayReminderStore.getState().awayTimestamp).toBeNull()

    unmount()
  })

  it('uses awayReminderTimeoutMs from settings for handleFocusReturn', async () => {
    useAwayReminderStore.getState().reset()
    const settings = defaultSettings({ awayReminderEnabled: true, awayReminderTimeoutMs: 5000 })
    const { unmount } = await renderAwayDetector(settings)

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'))
    useAwayReminderStore.getState().reset()

    emitFocusEvent({ phase: 'blurred' })
    vi.advanceTimersByTime(6_000)
    emitFocusEvent({ phase: 'focused' })

    expect(useAwayReminderStore.getState().overlayVisible).toBe(true)

    unmount()
  })

  it('awayReminderEnabled = false → does not subscribe to events', () => {
    const settings = defaultSettings({ awayReminderEnabled: false, awayReminderTimeoutMs: 30000 })
    renderHook(() => useAwayDetector(), {
      wrapper: createWrapperWithCache(settings)
    })

    expect(focusCallbacks.length).toBe(0)
    expect(activityCallbacks.length).toBe(0)
  })
})
