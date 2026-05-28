import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAwayReminderStore } from '@/store/away-reminder-store'

describe('away-reminder store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-28T12:00:00Z'))
    useAwayReminderStore.getState().reset()
  })

  it('markAway() sets awayTimestamp to current time', () => {
    useAwayReminderStore.getState().markAway()

    const state = useAwayReminderStore.getState()
    expect(state.awayTimestamp).toBe(Date.now())
    expect(state.overlayVisible).toBe(false)
    expect(state.dismissedAt).toBeNull()
  })

  it('handleFocusReturn(30000) with away > 30s → overlayVisible = true', () => {
    useAwayReminderStore.getState().markAway()
    // Advance time by 60 seconds (> 30s threshold)
    vi.advanceTimersByTime(60_000)

    useAwayReminderStore.getState().handleFocusReturn(30_000)

    const state = useAwayReminderStore.getState()
    expect(state.overlayVisible).toBe(true)
    expect(state.awayTimestamp).toBe(Date.now() - 60_000)
  })

  it('handleFocusReturn(30000) with away < 30s → overlayVisible = false, awayTimestamp = null', () => {
    useAwayReminderStore.getState().markAway()
    // Advance time by only 10 seconds (< 30s threshold)
    vi.advanceTimersByTime(10_000)

    useAwayReminderStore.getState().handleFocusReturn(30_000)

    const state = useAwayReminderStore.getState()
    expect(state.overlayVisible).toBe(false)
    expect(state.awayTimestamp).toBeNull()
  })

  it('handleFocusReturn(30000) with awayTimestamp = null → no overlay, awayTimestamp stays null', () => {
    // Do NOT call markAway — awayTimestamp is null
    useAwayReminderStore.getState().handleFocusReturn(30_000)

    const state = useAwayReminderStore.getState()
    expect(state.overlayVisible).toBe(false)
    expect(state.awayTimestamp).toBeNull()
  })

  it('dismissOverlay() → overlayVisible = false, dismissedAt set, awayTimestamp = null', () => {
    useAwayReminderStore.getState().markAway()
    vi.advanceTimersByTime(60_000)
    useAwayReminderStore.getState().handleFocusReturn(30_000)

    // Overlay is visible now
    expect(useAwayReminderStore.getState().overlayVisible).toBe(true)

    // Advance a bit more before dismissing so dismissedAt differs
    vi.advanceTimersByTime(5_000)
    useAwayReminderStore.getState().dismissOverlay()

    const state = useAwayReminderStore.getState()
    expect(state.overlayVisible).toBe(false)
    expect(state.dismissedAt).toBe(Date.now())
    expect(state.awayTimestamp).toBeNull()
  })

  it('reset() clears all state to initial values', () => {
    useAwayReminderStore.getState().markAway()
    vi.advanceTimersByTime(60_000)
    useAwayReminderStore.getState().handleFocusReturn(30_000)
    useAwayReminderStore.getState().dismissOverlay()

    // State has been modified
    expect(useAwayReminderStore.getState().dismissedAt).not.toBeNull()

    useAwayReminderStore.getState().reset()

    const state = useAwayReminderStore.getState()
    expect(state.awayTimestamp).toBeNull()
    expect(state.overlayVisible).toBe(false)
    expect(state.dismissedAt).toBeNull()
  })

  it('feature disabled case: reset() clears everything including overlayVisible', () => {
    // Simulate feature being disabled mid-overlay
    useAwayReminderStore.getState().markAway()
    vi.advanceTimersByTime(60_000)
    useAwayReminderStore.getState().handleFocusReturn(30_000)

    expect(useAwayReminderStore.getState().overlayVisible).toBe(true)

    // Feature disabled — reset clears everything
    useAwayReminderStore.getState().reset()

    const state = useAwayReminderStore.getState()
    expect(state.awayTimestamp).toBeNull()
    expect(state.overlayVisible).toBe(false)
    expect(state.dismissedAt).toBeNull()
  })

  it('handleFocusReturn uses exact boundary: away === timeout does NOT show overlay', () => {
    useAwayReminderStore.getState().markAway()
    // Advance exactly 30 seconds (equal to threshold)
    vi.advanceTimersByTime(30_000)

    useAwayReminderStore.getState().handleFocusReturn(30_000)

    const state = useAwayReminderStore.getState()
    // Away duration equals threshold exactly — must NOT trigger overlay
    expect(state.overlayVisible).toBe(false)
    expect(state.awayTimestamp).toBeNull()
  })

  it('handleFocusReturn with away 1ms over threshold shows overlay', () => {
    useAwayReminderStore.getState().markAway()
    // Advance 30_001ms — just barely over threshold
    vi.advanceTimersByTime(30_001)

    useAwayReminderStore.getState().handleFocusReturn(30_000)

    const state = useAwayReminderStore.getState()
    expect(state.overlayVisible).toBe(true)
  })

  it('handleFocusReturn() does not dismiss overlay if overlayVisible is already true', () => {
    useAwayReminderStore.getState().markAway()
    vi.advanceTimersByTime(60_000)
    useAwayReminderStore.getState().handleFocusReturn(30_000)
    expect(useAwayReminderStore.getState().overlayVisible).toBe(true)

    // Simulate switching applications again, triggering markAway and handleFocusReturn (<30s)
    useAwayReminderStore.getState().markAway()
    vi.advanceTimersByTime(5_000)
    useAwayReminderStore.getState().handleFocusReturn(30_000)

    // The overlay must still be visible
    expect(useAwayReminderStore.getState().overlayVisible).toBe(true)
  })
})
