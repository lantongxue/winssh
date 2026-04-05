import { create } from 'zustand'
import type {
  LocalTerminalStateEvent,
  LocalTerminalStatus,
  LocalTerminalSummary
} from '@shared/types'

export interface LocalTerminalTab extends LocalTerminalSummary {}

interface LocalTerminalsState {
  tabs: LocalTerminalTab[]
  activeTerminalId: string | null
  addTerminal: (summary: LocalTerminalSummary) => void
  removeTerminal: (terminalId: string) => void
  setActiveTerminal: (terminalId: string | null) => void
  setTerminalState: (terminalId: string, status: LocalTerminalStatus, lastMessage?: string) => void
  updateTerminalState: (event: LocalTerminalStateEvent) => void
  clear: () => void
}

export const useLocalTerminalsStore = create<LocalTerminalsState>((set) => ({
  tabs: [],
  activeTerminalId: null,
  addTerminal: (summary) =>
    set((state) => {
      const existing = state.tabs.some((tab) => tab.terminalId === summary.terminalId)
      const tabs = existing
        ? state.tabs.map((tab) =>
            tab.terminalId === summary.terminalId ? { ...tab, ...summary } : tab
          )
        : [...state.tabs, summary]

      return {
        activeTerminalId: summary.terminalId,
        tabs
      }
    }),
  removeTerminal: (terminalId) =>
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab.terminalId !== terminalId)
      const activeTerminalId =
        state.activeTerminalId === terminalId
          ? (tabs.at(-1)?.terminalId ?? null)
          : state.activeTerminalId

      return { activeTerminalId, tabs }
    }),
  setActiveTerminal: (terminalId) => set({ activeTerminalId: terminalId }),
  setTerminalState: (terminalId, status, lastMessage) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.terminalId === terminalId ? { ...tab, lastMessage, status } : tab
      )
    })),
  updateTerminalState: (event) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.terminalId === event.terminalId
          ? {
              ...tab,
              lastMessage: event.message,
              status: event.status
            }
          : tab
      )
    })),
  clear: () => set({ activeTerminalId: null, tabs: [] })
}))
