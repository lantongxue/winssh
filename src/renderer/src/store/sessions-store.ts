import { create } from 'zustand'
import type {
  SessionConnectionPhase,
  SessionStateEvent,
  SessionStatus,
  SessionSummary
} from '@shared/types'

export type SessionAuxView = 'sftp' | 'port-forward'

export interface SessionTab extends SessionSummary {
  auxView?: SessionAuxView | null
  connectionPhase?: SessionConnectionPhase
  connectionStartedAt?: string
  lastMessage?: string
  provisional?: boolean
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
  addSession: (summary: SessionSummary) => void
  addPendingSession: (session: PendingSessionInput) => void
  replaceSession: (oldSessionId: string, summary: SessionSummary) => void
  removeSession: (sessionId: string) => void
  setActiveSession: (sessionId: string | null) => void
  setAuxView: (sessionId: string, auxView: SessionAuxView | null) => void
  setSessionState: (
    sessionId: string,
    status: SessionStatus,
    lastMessage?: string,
    connectionPhase?: SessionConnectionPhase
  ) => void
  updateSessionState: (event: SessionStateEvent) => void
  setCurrentPath: (sessionId: string, path: string) => void
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
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.sessionId === oldSessionId
          ? {
              auxView: tab.auxView ?? null,
              connectionStartedAt: tab.connectionStartedAt,
              connectionPhase: tab.connectionPhase,
              ...summary,
              lastMessage: summary.status === 'ready' ? undefined : tab.lastMessage
            }
          : tab
      ),
      activeSessionId: summary.sessionId
    })),
  removeSession: (sessionId) =>
    set((state) => {
      const tabs = state.tabs.filter((tab) => tab.sessionId !== sessionId)
      const activeSessionId =
        state.activeSessionId === sessionId
          ? (tabs.at(-1)?.sessionId ?? null)
          : state.activeSessionId

      return { tabs, activeSessionId }
    }),
  setActiveSession: (sessionId) => set({ activeSessionId: sessionId }),
  setAuxView: (sessionId, auxView) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.sessionId === sessionId ? { ...tab, auxView } : tab))
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
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.sessionId === sessionId ? { ...tab, currentPath: path } : tab
      )
    })),
  clear: () => set({ tabs: [], activeSessionId: null })
}))
