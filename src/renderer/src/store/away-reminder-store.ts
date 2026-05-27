import { create } from 'zustand'

interface AwayReminderState {
  awayTimestamp: number | null
  overlayVisible: boolean
  dismissedAt: number | null
  markAway: () => void
  handleFocusReturn: (currentTimeoutMs: number) => void
  dismissOverlay: () => void
  reset: () => void
}

const initialState = {
  awayTimestamp: null as number | null,
  overlayVisible: false,
  dismissedAt: null as number | null
}

export const useAwayReminderStore = create<AwayReminderState>()((set) => ({
  ...initialState,
  markAway: () =>
    set({
      awayTimestamp: Date.now()
    }),
  handleFocusReturn: (currentTimeoutMs) =>
    set((state) => {
      if (state.awayTimestamp === null) {
        return { overlayVisible: false }
      }
      const elapsed = Date.now() - state.awayTimestamp
      if (elapsed > currentTimeoutMs) {
        return { overlayVisible: true }
      }
      return { overlayVisible: false, awayTimestamp: null }
    }),
  dismissOverlay: () =>
    set({
      overlayVisible: false,
      dismissedAt: Date.now(),
      awayTimestamp: null
    }),
  reset: () => set(initialState)
}))