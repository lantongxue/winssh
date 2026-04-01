/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { ConnectionRequest, Server } from '@shared/types'
import type { WorkbenchActivityId } from '@/lib/workbench'
import {
  createServerEditorDocument,
  createSessionEditorDocument,
  createSettingsEditorDocument,
  createTerminalWelcomeDocument
} from '@/lib/workbench'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

type EntityQuickInputState = {
  entityId?: string
  entityType: 'group' | 'tag'
  initialColor?: string
  initialName?: string
  mode: 'create' | 'rename'
}

type CredentialsQuickInputState = {
  kind: 'credentials'
  server: Server
}

type EntityQuickInput = EntityQuickInputState & {
  kind: 'entity'
}

export type WorkbenchQuickInputState = CredentialsQuickInputState | EntityQuickInput

interface DisconnectSessionOptions {
  closeDocument?: boolean
}

interface WorkbenchContextValue {
  closeQuickInput: () => void
  connectServer: (server: Server, request?: ConnectionRequest) => Promise<void>
  deleteServer: (serverId: string) => Promise<void>
  disconnectSession: (sessionId: string, options?: DisconnectSessionOptions) => Promise<void>
  focusActivity: (activityId: WorkbenchActivityId) => void
  focusExplorerHome: () => void
  openEntityQuickInput: (input: EntityQuickInputState) => void
  openServerEditor: (serverId?: string | null) => void
  openSettingsEditor: () => void
  quickInput: WorkbenchQuickInputState | null
  reconnectSession: (sessionId: string) => Promise<void>
  refreshWorkspaceData: () => Promise<void>
  requestConnectionSecrets: (server: Server) => void
  toggleFavorite: (serverId: string) => Promise<void>
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null)

const workspaceQueryKeys = [
  ['servers'],
  ['groups'],
  ['tags'],
  ['recent-sessions'],
  ['capabilities'],
  ['known-hosts']
] as const

function requiresSecretPrompt(server: Server) {
  return (
    (server.authType === 'password' && !server.hasPassword) ||
    (server.authType === 'privateKey' && !server.hasPassphrase)
  )
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [quickInput, setQuickInput] = useState<WorkbenchQuickInputState | null>(null)
  const tabs = useSessionsStore((state) => state.tabs)
  const activeSessionId = useSessionsStore((state) => state.activeSessionId)
  const addPendingSession = useSessionsStore((state) => state.addPendingSession)
  const removeSession = useSessionsStore((state) => state.removeSession)
  const replaceSession = useSessionsStore((state) => state.replaceSession)
  const setSessionState = useSessionsStore((state) => state.setSessionState)
  const appendOutput = useWorkbenchStore((state) => state.appendOutput)
  const closeDocument = useWorkbenchStore((state) => state.closeDocument)
  const openDocument = useWorkbenchStore((state) => state.openDocument)
  const pushProblem = useWorkbenchStore((state) => state.pushProblem)
  const replaceDocument = useWorkbenchStore((state) => state.replaceDocument)
  const setActiveActivity = useWorkbenchStore((state) => state.setActiveActivity)
  const setSelectedExplorerNode = useWorkbenchStore((state) => state.setSelectedExplorerNode)

  const refreshWorkspaceData = async () => {
    await Promise.all(
      workspaceQueryKeys.map((queryKey) =>
        queryClient.invalidateQueries({ queryKey: [...queryKey] })
      )
    )
  }

  const focusExplorerHome = () => {
    setActiveActivity('explorer')
    setSelectedExplorerNode('home')
  }

  const openSettingsEditor = () => {
    setActiveActivity('settings')
    openDocument(createSettingsEditorDocument())
  }

  const openServerEditor = (serverId?: string | null) => {
    setActiveActivity('explorer')

    if (serverId) {
      setSelectedExplorerNode(`server:${serverId}`)
    }

    openDocument(createServerEditorDocument(serverId))
  }

  const focusActivity = (activityId: WorkbenchActivityId) => {
    setActiveActivity(activityId)

    if (activityId === 'settings') {
      openSettingsEditor()
      return
    }

    if (activityId === 'terminal') {
      const preferredSessionId = activeSessionId ?? tabs.at(-1)?.sessionId

      if (preferredSessionId) {
        openDocument(createSessionEditorDocument(preferredSessionId))
        closeDocument('terminal-welcome')
        return
      }

      openDocument(createTerminalWelcomeDocument())
      return
    }

    focusExplorerHome()
  }

  const requestConnectionSecrets = (server: Server) => {
    setQuickInput({
      kind: 'credentials',
      server
    })
  }

  const startConnection = async (
    server: Server,
    request?: ConnectionRequest,
    existingPendingSessionId?: string
  ) => {
    if (!request && requiresSecretPrompt(server)) {
      requestConnectionSecrets(server)
      return
    }

    const pendingSessionId =
      existingPendingSessionId ?? `pending:${server.id}:${Date.now().toString(36)}`

    addPendingSession({
      host: server.host,
      lastMessage: t('workbench.terminal.stages.validate'),
      port: server.port,
      serverId: server.id,
      serverName: server.name,
      sessionId: pendingSessionId
    })
    setActiveActivity('terminal')
    openDocument(createSessionEditorDocument(pendingSessionId))
    closeDocument('terminal-welcome')
    setQuickInput(null)

    appendOutput({
      detail: `${server.username}@${server.host}:${server.port}`,
      level: 'info',
      message: t('workbench.output.connectingTo', { name: server.name })
    })

    try {
      const summary = await window.winsshApi.sessions.connect(request ?? { serverId: server.id })
      replaceSession(pendingSessionId, summary)
      replaceDocument(
        `session-editor:${pendingSessionId}`,
        createSessionEditorDocument(summary.sessionId)
      )
      toast.success(t('workbench.toasts.sessionConnected', { name: server.name }))
      appendOutput({
        detail: `${server.username}@${server.host}:${server.port}`,
        level: 'success',
        message: t('workbench.output.connectedTo', { name: server.name })
      })
      await refreshWorkspaceData()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('workbench.toasts.connectionFailed')
      setSessionState(pendingSessionId, 'error', message)
      appendOutput({
        detail: `${server.username}@${server.host}:${server.port}`,
        level: 'error',
        message
      })
      pushProblem({
        detail: `${server.name} · ${server.host}:${server.port}`,
        documentId: `server-editor:${server.id}`,
        id: `connect:${server.id}:${Date.now()}`,
        severity: 'error',
        title: message
      })
      toast.error(message)
    }
  }

  const connectServer = async (server: Server, request?: ConnectionRequest) => {
    await startConnection(server, request)
  }

  const disconnectSession = async (
    sessionId: string,
    options: DisconnectSessionOptions = { closeDocument: true }
  ) => {
    const session = useSessionsStore.getState().tabs.find((tab) => tab.sessionId === sessionId)

    if (!session?.provisional) {
      await window.winsshApi.sessions.disconnect(sessionId)
    }
    removeSession(sessionId)

    if (options.closeDocument !== false) {
      closeDocument(`session-editor:${sessionId}`)
    }

    appendOutput({
      detail: session ? `${session.serverName} · ${session.host}:${session.port}` : sessionId,
      level: 'info',
      message: t('workbench.output.sessionDisconnected')
    })

    await refreshWorkspaceData()
  }

  const reconnectSession = async (sessionId: string) => {
    const session = useSessionsStore.getState().tabs.find((tab) => tab.sessionId === sessionId)

    if (!session) {
      return
    }

    if (session.provisional) {
      const cachedServers = queryClient.getQueryData<Server[]>(['servers']) ?? []
      const server =
        cachedServers.find((item) => item.id === session.serverId) ??
        (await window.winsshApi.servers.list()).find((item) => item.id === session.serverId)

      if (!server) {
        toast.error(t('workbench.toasts.serverConfigMissing'))
        return
      }

      await startConnection(server, undefined, session.sessionId)
      return
    }

    appendOutput({
      detail: `${session.serverName} · ${session.host}:${session.port}`,
      level: 'info',
      message: t('workbench.output.reconnecting', { name: session.serverName })
    })

    try {
      const nextSession = await window.winsshApi.sessions.reconnect(sessionId)
      replaceSession(sessionId, nextSession)
      replaceDocument(
        `session-editor:${sessionId}`,
        createSessionEditorDocument(nextSession.sessionId)
      )
      toast.success(t('workbench.toasts.reconnected', { name: nextSession.serverName }))
      appendOutput({
        detail: `${nextSession.serverName} · ${nextSession.host}:${nextSession.port}`,
        level: 'success',
        message: t('workbench.toasts.reconnected', { name: nextSession.serverName })
      })
      await refreshWorkspaceData()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('workbench.toasts.reconnectFailed')
      pushProblem({
        detail: `${session.serverName} · ${session.host}:${session.port}`,
        documentId: `session-editor:${sessionId}`,
        id: `reconnect:${sessionId}:${Date.now()}`,
        severity: 'error',
        title: message
      })
      toast.error(message)
    }
  }

  const toggleFavorite = async (serverId: string) => {
    await window.winsshApi.servers.toggleFavorite(serverId)
    await refreshWorkspaceData()
  }

  const deleteServer = async (serverId: string) => {
    await window.winsshApi.servers.delete(serverId)
    closeDocument(`server-editor:${serverId}`)
    await refreshWorkspaceData()
    toast.success(t('workbench.toasts.serverDeleted'))
  }

  const openEntityQuickInput = (input: EntityQuickInputState) => {
    setQuickInput({
      ...input,
      kind: 'entity'
    })
  }

  const closeQuickInput = () => {
    setQuickInput(null)
  }

  return (
    <WorkbenchContext.Provider
      value={{
        closeQuickInput,
        connectServer,
        deleteServer,
        disconnectSession,
        focusActivity,
        focusExplorerHome,
        openEntityQuickInput,
        openServerEditor,
        openSettingsEditor,
        quickInput,
        reconnectSession,
        refreshWorkspaceData,
        requestConnectionSecrets,
        toggleFavorite
      }}
    >
      {children}
    </WorkbenchContext.Provider>
  )
}

export function useWorkbenchContext() {
  const context = useContext(WorkbenchContext)

  if (!context) {
    throw new Error('useWorkbenchContext must be used within WorkbenchProvider')
  }

  return context
}
