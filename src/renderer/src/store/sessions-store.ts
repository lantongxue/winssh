import { create } from 'zustand'
import type {
  SessionConnectionPhase,
  SessionStateEvent,
  SessionStatus,
  SessionSummary
} from '@shared/types'

export type SessionAuxView = 'sftp' | 'port-forward' | 'command-history'

export interface SessionTab extends SessionSummary {
  auxView?: SessionAuxView | null
  auxPanelSide?: 'left' | 'right'
  connectionPhase?: SessionConnectionPhase
  connectionStartedAt?: string
  lastMessage?: string
  provisional?: boolean
  focusNonce?: number
  terminalCwd?: string
}

export interface TerminalHealthState {
  degradedReason?: string
  backpressureCount: number
}

export interface PendingSessionInput {
  connectionPhase?: SessionConnectionPhase
  host: string
  lastMessage?: string
  port: number
  serverId: string
  serverName: string
  sessionId: string
}

interface SessionsState {
  tabs: SessionTab[]
  activeSessionId: string | null
  terminalHealth: Record<string, TerminalHealthState>
  addSession: (summary: SessionSummary) => void
  addPendingSession: (session: PendingSessionInput) => void
  replaceSession: (oldSessionId: string, summary: SessionSummary) => void
  removeSession: (sessionId: string) => void
  setActiveSession: (sessionId: string | null) => void
  setAuxView: (sessionId: string, auxView: SessionAuxView | null) => void
  setAuxPanelSide: (sessionId: string, side: 'left' | 'right') => void
  setSessionState: (
    sessionId: string,
    status: SessionStatus,
    lastMessage?: string,
    connectionPhase?: SessionConnectionPhase
  ) => void
  updateSessionState: (event: SessionStateEvent) => void
  setCurrentPath: (sessionId: string, path: string) => void
  setTerminalCwd: (sessionId: string, cwd: string) => void
  markTerminalDegraded: (sessionId: string, reason: string) => void
  markTerminalBackpressure: (sessionId: string) => void
  requestTerminalFocus: (sessionId: string) => void
  clear: () => void
}

function setStatus(
  tab: SessionTab,
  status: SessionStatus,
  lastMessage?: string,
  connectionPhase?: SessionConnectionPhase
): SessionTab {
  const nextConnectionStartedAt =
    status === 'connecting' && tab.status !== 'connecting'
      ? new Date().toISOString()
      : tab.connectionStartedAt

  return {
    ...tab,
    connectionPhase: connectionPhase ?? tab.connectionPhase,
    connectionStartedAt: nextConnectionStartedAt,
    status,
    lastMessage
  }
}

export const useSessionsStore = create<SessionsState>((set) => ({
  tabs: [],
  activeSessionId: null,
  terminalHealth: {},
  addSession: (summary) =>
    set((state) => {
      const existing = state.tabs.some((tab) => tab.sessionId === summary.sessionId)
      const tabs = existing
        ? state.tabs.map((tab) =>
            tab.sessionId === summary.sessionId ? { ...tab, ...summary } : tab
          )
        : [...state.tabs, summary]

      return {
        tabs,
        activeSessionId: summary.sessionId
      }
    }),
  addPendingSession: (session) =>
    set((state) => {
      const nextSession: SessionTab = {
        connectedAt: new Date().toISOString(),
        connectionPhase: session.connectionPhase,
        connectionStartedAt: new Date().toISOString(),
        currentPath: '/',
        host: session.host,
        lastMessage: session.lastMessage,
        port: session.port,
        provisional: true,
        serverId: session.serverId,
        serverName: session.serverName,
        sessionId: session.sessionId,
        status: 'connecting'
      }

      const existing = state.tabs.some((tab) => tab.sessionId === session.sessionId)
      const tabs = existing
        ? state.tabs.map((tab) => (tab.sessionId === session.sessionId ? nextSession : tab))
        : [...state.tabs, nextSession]

      return {
        tabs,
        activeSessionId: session.sessionId
      }
    }),
  replaceSession: (oldSessionId, summary) =>
    set((state) => {
      return {
        tabs: state.tabs.map((tab) =>
          tab.sessionId === oldSessionId
            ? {
                auxView: tab.auxView ?? null,
                auxPanelSide: tab.auxPanelSide,
                connectionPhase: tab.connectionPhase,
                ...summary,
                // 重连成功后刷新 connectionStartedAt，确保 TerminalPane 识别为新连接周期
                connectionStartedAt:
                  summary.status === 'ready' ? new Date().toISOString() : tab.connectionStartedAt,
                lastMessage: summary.status === 'ready' ? undefined : tab.lastMessage
              }
            : tab
        ),
        activeSessionId: summary.sessionId
      }
    }),
  removeSession: (sessionId) =>
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab.sessionId !== sessionId)
      const activeSessionId =
        state.activeSessionId === sessionId
          ? (tabs.at(-1)?.sessionId ?? null)
          : state.activeSessionId

      return {
        tabs,
        activeSessionId
      }
    }),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  setAuxView: (sessionId, auxView) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.sessionId === sessionId ? { ...tab, auxView } : tab))
    })),
  setAuxPanelSide: (sessionId, side) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.sessionId === sessionId ? { ...tab, auxPanelSide: side } : tab
      )
    })),
  setSessionState: (sessionId, status, lastMessage, connectionPhase) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.sessionId === sessionId ? setStatus(tab, status, lastMessage, connectionPhase) : tab
      )
    })),
  updateSessionState: (event) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.sessionId === event.sessionId
          ? setStatus(tab, event.status, event.message, event.phase)
          : tab
      )
    })),
  setCurrentPath: (sessionId, path) =>
    set((state) => {
      const tab = state.tabs.find((t) => t.sessionId === sessionId)
      if (!tab || tab.currentPath === path) return state
      return {
        tabs: state.tabs.map((t) => (t.sessionId === sessionId ? { ...t, currentPath: path } : t))
      }
    }),
  setTerminalCwd: (sessionId, cwd) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.sessionId === sessionId ? { ...t, terminalCwd: cwd } : t))
    })),
  markTerminalDegraded: (sessionId, reason) =>
    set((state) => ({
      terminalHealth: {
        ...state.terminalHealth,
        [sessionId]: {
          backpressureCount: state.terminalHealth[sessionId]?.backpressureCount ?? 0,
          degradedReason: reason
        }
      }
    })),
  markTerminalBackpressure: (sessionId) =>
    set((state) => ({
      terminalHealth: {
        ...state.terminalHealth,
        [sessionId]: {
          ...state.terminalHealth[sessionId],
          backpressureCount: (state.terminalHealth[sessionId]?.backpressureCount ?? 0) + 1
        }
      }
    })),
  requestTerminalFocus: (sessionId) =>
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.sessionId === sessionId ? { ...tab, focusNonce: (tab.focusNonce ?? 0) + 1 } : tab
      )
    })),
  clear: () =>
    set({
      tabs: [],
      activeSessionId: null,
      terminalHealth: {}
    })
}))
