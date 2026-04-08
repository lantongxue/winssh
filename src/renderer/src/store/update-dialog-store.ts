import { create } from 'zustand'

type UpdateDialogMode = 'closed' | 'auto' | 'manual'

interface UpdateDialogState {
  close: () => void
  mode: UpdateDialogMode
  openAuto: () => void
  openManual: () => void
}

export const useUpdateDialogStore = create<UpdateDialogState>((set) => ({
  close: () => set({ mode: 'closed' }),
  mode: 'closed',
  openAuto: () => set({ mode: 'auto' }),
  openManual: () => set({ mode: 'manual' })
}))
