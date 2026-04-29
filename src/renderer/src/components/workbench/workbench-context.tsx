/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatQuickConnectTarget } from '@shared/quick-connect'
import type {
  ConnectionSecretInput,
  ConnectionRequest,
  QuickConnectTarget,
  RuntimeCapabilities,
  SecretKind,
  Server,
  ServerUpsertInput
} from '@shared/types'
import { localTerminalsClient } from '@/features/local-terminals/api/local-terminals-client'
import { queryKeys } from '@/features/shared/query-keys'
import { serversClient } from '@/features/servers/api/servers-client'
import { sessionsClient } from '@/features/sessions/api/sessions-client'
import { systemClient } from '@/features/system/api/system-client'
import type { WorkbenchActivityId } from '@/lib/workbench'
import {
  createLocalTerminalEditorDocument,
  createServerEditorDocument,
  createSessionEditorDocument,
  createSftpFileEditorDocument,
  createSettingsEditorDocument,
  createUpdatesEditorDocument,
  createTerminalWelcomeDocument
} from '@/lib/workbench'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

type EntityQuickInputState = {
  entityId?: string
  entityType: 'group' | 'tag'
  initialColor?: string
  initialName?: string
  mode: 'create' | 'rename'
  parentId?: string | null
}

type CredentialsQuickInputBaseState = {
  canRemember: boolean
  kind: 'credentials'
  lastErrorMessage?: string
  pendingSessionId?: string
  rememberByDefault: boolean
  secretKind: SecretKind
}

type ServerCredentialsQuickInputState = CredentialsQuickInputBaseState & {
  rootServerId: string
  server: Server
  source: 'server'
}

type QuickConnectCredentialsQuickInputState = CredentialsQuickInputBaseState & {
  source: 'quick-connect'
  target: QuickConnectTarget
}

type CredentialsQuickInputState =
  | ServerCredentialsQuickInputState
  | QuickConnectCredentialsQuickInputState

type EntityQuickInput = EntityQuickInputState & {
  kind: 'entity'
}

export type WorkbenchQuickInputState = CredentialsQuickInputState | EntityQuickInput

type PendingConnectionState = {
  request: ConnectionRequest
  rootServerId: string
}

interface DisconnectSessionOptions {
  closeDocument?: boolean
}

interface ConnectServerOptions {
  pendingSessionId?: string
}

interface OpenServerEditorOptions {
  initialGroupId?: string | null
}

interface ConnectionSecretsRequestOptions {
  lastErrorMessage?: string
  pendingSessionId?: string
  rememberByDefault?: boolean
  rootServerId?: string
  secretKind: SecretKind
}

interface WorkbenchContextValue {
  beginQuickConnect: (target: QuickConnectTarget) => Promise<void>
  closeQuickInput: () => void
  connectQuickConnectTarget: (
    target: QuickConnectTarget,
    password: string,
    remember: boolean,
    pendingSessionId?: string
  ) => Promise<void>
  connectServer: (
    server: Server,
    request?: ConnectionRequest,
    options?: ConnectServerOptions
  ) => Promise<void>
  deleteServer: (serverId: string) => Promise<void>
  disconnectSession: (sessionId: string, options?: DisconnectSessionOptions) => Promise<void>
  focusActivity: (activityId: WorkbenchActivityId) => void
  focusExplorerHome: () => void
  moveServerToGroup: (server: Server, groupId: string | null, groupName?: string) => Promise<void>
  openLocalTerminal: () => Promise<void>
  openEntityQuickInput: (input: EntityQuickInputState) => void
  openServerEditor: (serverId?: string | null, options?: OpenServerEditorOptions) => void
  openSftpFileEditor: (sessionId: string, remotePath: string) => void
  openSettingsEditor: () => void
  openUpdatesEditor: () => void
  quickInput: WorkbenchQuickInputState | null
  reconnectSession: (sessionId: string) => Promise<void>
  refreshWorkspaceData: () => Promise<void>
  requestConnectionSecrets: (
    server: Server,
    options?: ConnectionSecretsRequestOptions
  ) => Promise<void>
  closeLocalTerminal: (terminalId: string) => Promise<void>
  submitConnectionSecret: (
    rootServerId: string,
    serverId: string,
    secretKind: SecretKind,
    secret: string,
    remember: boolean,
    pendingSessionId?: string
  ) => Promise<void>
  toggleFavorite: (serverId: string) => Promise<void>
}

const WorkbenchContext = createContext<WorkbenchContextValue | null>(null)

const workspaceQueryKeys = [
  queryKeys.servers,
  queryKeys.groups,
  queryKeys.tags,
  queryKeys.recentSessions,
  queryKeys.capabilities,
  queryKeys.knownHosts
] as const

function buildQuickConnectServerName(target: QuickConnectTarget) {
  return formatQuickConnectTarget(target)
}

function createClientSessionId(serverId: string) {
  return globalThis.crypto?.randomUUID?.() ?? `session:${serverId}:${Date.now().toString(36)}`
}

function buildConnectionRequest(
  serverId: string,
  sessionId: string,
  request?: ConnectionRequest
): ConnectionRequest {
  return {
    ...request,
    serverId,
    sessionId,
    secrets: request?.secrets ? { ...request.secrets } : undefined
  }
}

function getRememberPreference(
  request: ConnectionRequest | undefined,
  serverId: string,
  secretKind: SecretKind
) {
  const secrets = request?.secrets?.[serverId]
  return secretKind === 'password' ? secrets?.rememberPassword : secrets?.rememberPassphrase
}

function buildServerGroupUpdatePayload(
  server: Server,
  groupId: string | null,
  options: { privateKey?: string | null } = {}
): ServerUpsertInput {
  return {
    authType: server.authType,
    credentialId: server.credentialId ?? null,
    favorite: server.favorite,
    groupId,
    host: server.host,
    jumpServerId: server.jumpServerId,
    name: server.name,
    note: server.note ?? '',
    port: server.port,
    privateKey:
      server.authType === 'privateKey' && !server.credentialId
        ? options.privateKey?.trim()
          ? options.privateKey
          : null
        : undefined,
    rememberPassphrase: server.authType === 'privateKey' ? server.hasPassphrase : false,
    rememberPassword: server.authType === 'password' ? server.hasPassword : false,
    tagIds: server.tags.map((tag) => tag.id),
    username: server.username
  }
}

export function WorkbenchProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [quickInput, setQuickInput] = useState<WorkbenchQuickInputState | null>(null)
  const [pendingConnections, setPendingConnections] = useState<
    Record<string, PendingConnectionState>
  >({})
  const localTerminalTabs = useLocalTerminalsStore((state) => state.tabs)
  const activeLocalTerminalId = useLocalTerminalsStore((state) => state.activeTerminalId)
  const addLocalTerminal = useLocalTerminalsStore((state) => state.addTerminal)
  const removeLocalTerminal = useLocalTerminalsStore((state) => state.removeTerminal)
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

  const getCredentialStorageAvailable = async () => {
    const cached = queryClient.getQueryData<RuntimeCapabilities>(queryKeys.capabilities)
    if (cached) {
      return cached.credentialStorage
    }

    const capabilities = await queryClient.fetchQuery({
      queryKey: queryKeys.capabilities,
      queryFn: () => systemClient.getCapabilities()
    })

    return capabilities.credentialStorage
  }

  const getServers = async (options?: { force?: boolean }) => {
    const cached = !options?.force ? queryClient.getQueryData<Server[]>(queryKeys.servers) : undefined
    if (cached) {
      return cached
    }

    return queryClient.fetchQuery({
      queryKey: queryKeys.servers,
      queryFn: () => serversClient.list()
    })
  }

  const getServerById = async (serverId: string) => {
    const servers = await getServers()
    const cachedMatch = servers.find((server) => server.id === serverId)
    if (cachedMatch) {
      return cachedMatch
    }

    const freshServers = await getServers({ force: true })
    return freshServers.find((server) => server.id === serverId) ?? null
  }

  const focusExplorerHome = () => {
    setActiveActivity('explorer')
    setSelectedExplorerNode('home')
  }

  const openSettingsEditor = () => {
    setActiveActivity('settings')
    openDocument(createSettingsEditorDocument())
  }

  const openUpdatesEditor = () => {
    setActiveActivity('settings')
    openDocument(createUpdatesEditorDocument())
  }

  const openServerEditor = (serverId?: string | null, options: OpenServerEditorOptions = {}) => {
    setActiveActivity('explorer')

    if (serverId) {
      setSelectedExplorerNode(`server:${serverId}`)
    } else if (options.initialGroupId) {
      setSelectedExplorerNode(`group:${options.initialGroupId}`)
    }

    openDocument(createServerEditorDocument(serverId, options))
  }

  const openSftpFileEditor = (sessionId: string, remotePath: string) => {
    setActiveActivity('terminal')
    openDocument(createSftpFileEditorDocument(sessionId, remotePath))
    closeDocument('terminal-welcome')
  }

  const openLocalTerminal = async () => {
    try {
      const terminal = await localTerminalsClient.create()
      addLocalTerminal(terminal)
      setActiveActivity('terminal')
      openDocument(createLocalTerminalEditorDocument(terminal.terminalId))
      closeDocument('terminal-welcome')
      appendOutput({
        detail: `${terminal.shell} · ${terminal.cwd}`,
        level: 'success',
        message: t('workbench.output.localTerminalOpened', { name: terminal.title })
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('workbench.toasts.localTerminalOpenFailed')
      pushProblem({
        detail: t('common.actions.openTerminal'),
        documentId: 'terminal-welcome',
        id: `local-terminal:create:${Date.now()}`,
        severity: 'error',
        title: message
      })
      toast.error(message)
    }
  }

  const focusActivity = (activityId: WorkbenchActivityId) => {
    setActiveActivity(activityId)

    if (activityId === 'settings') {
      openSettingsEditor()
      return
    }

    if (activityId === 'terminal') {
      const preferredSessionId = activeSessionId ?? tabs.at(-1)?.sessionId
      const preferredLocalTerminalId = activeLocalTerminalId ?? localTerminalTabs.at(-1)?.terminalId

      if (preferredSessionId) {
        openDocument(createSessionEditorDocument(preferredSessionId))
        closeDocument('terminal-welcome')
        return
      }

      if (preferredLocalTerminalId) {
        openDocument(createLocalTerminalEditorDocument(preferredLocalTerminalId))
        closeDocument('terminal-welcome')
        return
      }

      openDocument(createTerminalWelcomeDocument())
      return
    }

    focusExplorerHome()
  }

  const requestConnectionSecrets = async (
    server: Server,
    options?: ConnectionSecretsRequestOptions
  ) => {
    const canRemember = await getCredentialStorageAvailable()
    const secretKind =
      options?.secretKind ?? (server.authType === 'password' ? 'password' : 'passphrase')
    setQuickInput({
      canRemember,
      kind: 'credentials',
      lastErrorMessage: options?.lastErrorMessage,
      pendingSessionId: options?.pendingSessionId,
      rememberByDefault: options?.rememberByDefault ?? canRemember,
      rootServerId: options?.rootServerId ?? server.id,
      secretKind,
      server,
      source: 'server'
    })
  }

  const requestQuickConnectSecrets = async (target: QuickConnectTarget) => {
    const canRemember = await getCredentialStorageAvailable()
    setQuickInput({
      canRemember,
      kind: 'credentials',
      rememberByDefault: canRemember,
      secretKind: 'password',
      source: 'quick-connect',
      target
    })
  }

  const findMatchingQuickConnectServer = async (target: QuickConnectTarget) => {
    const servers = await getServers()

    return (
      servers.find(
        (server) =>
          server.authType === 'password' &&
          server.host === target.host &&
          server.port === target.port &&
          server.username === target.username
      ) ?? null
    )
  }

  const ensureQuickConnectServer = async (target: QuickConnectTarget) => {
    const existing = await findMatchingQuickConnectServer(target)
    if (existing) {
      return existing
    }

    const created = await serversClient.create({
      authType: 'password',
      favorite: false,
      groupId: null,
      jumpServerId: null,
      host: target.host,
      name: buildQuickConnectServerName(target),
      note: '',
      port: target.port,
      privateKey: null,
      rememberPassphrase: false,
      rememberPassword: false,
      tagIds: [],
      username: target.username
    })

    queryClient.setQueryData<Server[]>(queryKeys.servers, (current) => {
      const servers = current ?? []
      return servers.some((server) => server.id === created.id) ? servers : [...servers, created]
    })
    await refreshWorkspaceData()
    return created
  }

  const resolveFailureServer = async (rootServer: Server, serverId?: string) => {
    if (!serverId || serverId === rootServer.id) {
      return rootServer
    }

    return (await getServerById(serverId)) ?? rootServer
  }

  const startConnection = async (
    server: Server,
    request?: ConnectionRequest,
    options: ConnectServerOptions = {}
  ) => {
    const pendingSessionId =
      options.pendingSessionId ?? request?.sessionId ?? createClientSessionId(server.id)
    const nextRequest = buildConnectionRequest(server.id, pendingSessionId, request)

    setPendingConnections((current) => ({
      ...current,
      [pendingSessionId]: {
        request: nextRequest,
        rootServerId: server.id
      }
    }))

    addPendingSession({
      connectionPhase: 'validate',
      host: server.host,
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

    const result = await sessionsClient.connect(nextRequest)
    if (result.ok) {
      setPendingConnections((current) => {
        const next = { ...current }
        delete next[pendingSessionId]
        return next
      })
      replaceSession(pendingSessionId, result.summary)
      replaceDocument(
        `session-editor:${pendingSessionId}`,
        createSessionEditorDocument(result.summary.sessionId)
      )
      toast.success(t('workbench.toasts.sessionConnected', { name: server.name }))
      appendOutput({
        detail: `${server.username}@${server.host}:${server.port}`,
        level: 'success',
        message: t('workbench.output.connectedTo', { name: server.name })
      })
      await refreshWorkspaceData()
      return
    }

    setSessionState(pendingSessionId, 'error', result.message)
    appendOutput({
      detail: `${server.username}@${server.host}:${server.port}`,
      level: 'error',
      message: result.message
    })

    const recoverableServerId = result.serverId
    const recoverableSecretKind = result.secretKind
    const isRecoverableFailure =
      (result.code === 'secret_required' || result.code === 'auth_failed') &&
      Boolean(recoverableServerId) &&
      Boolean(recoverableSecretKind)

    if (isRecoverableFailure && recoverableServerId && recoverableSecretKind) {
      const failingServer = await resolveFailureServer(server, recoverableServerId)
      await requestConnectionSecrets(failingServer, {
        lastErrorMessage: result.message,
        pendingSessionId,
        rememberByDefault:
          getRememberPreference(nextRequest, failingServer.id, recoverableSecretKind) ?? undefined,
        rootServerId: server.id,
        secretKind: recoverableSecretKind
      })
      return
    }

    setPendingConnections((current) => {
      const next = { ...current }
      delete next[pendingSessionId]
      return next
    })

    pushProblem({
      detail: `${server.name} · ${server.host}:${server.port}`,
      documentId: `server-editor:${server.id}`,
      id: `connect:${server.id}:${Date.now()}`,
      severity: 'error',
      title: result.message
    })
    toast.error(result.message)
  }

  const beginQuickConnect = async (target: QuickConnectTarget) => {
    const existing = await findMatchingQuickConnectServer(target)
    if (existing) {
      await startConnection(existing)
      return
    }

    await requestQuickConnectSecrets(target)
  }

  const connectQuickConnectTarget = async (
    target: QuickConnectTarget,
    password: string,
    remember: boolean,
    pendingSessionId?: string
  ) => {
    const server = await ensureQuickConnectServer(target)
    const canRemember = await getCredentialStorageAvailable()

    await startConnection(
      server,
      {
        secrets: {
          [server.id]: {
            password,
            rememberPassword: canRemember ? remember : false
          }
        },
        serverId: server.id
      },
      { pendingSessionId }
    )
  }

  const submitConnectionSecret = async (
    rootServerId: string,
    serverId: string,
    secretKind: SecretKind,
    secret: string,
    remember: boolean,
    pendingSessionId?: string
  ) => {
    const rootServer = await getServerById(rootServerId)
    if (!rootServer) {
      toast.error(t('workbench.toasts.serverConfigMissing'))
      return
    }

    const nextSessionId = pendingSessionId ?? createClientSessionId(rootServerId)
    const existingPending = pendingConnections[nextSessionId]
    const baseRequest = buildConnectionRequest(
      rootServer.id,
      nextSessionId,
      existingPending?.request
    )
    const currentSecret = baseRequest.secrets?.[serverId] ?? {}
    const nextSecret: ConnectionSecretInput =
      secretKind === 'password'
        ? {
            ...currentSecret,
            password: secret,
            rememberPassword: remember
          }
        : {
            ...currentSecret,
            passphrase: secret,
            rememberPassphrase: remember
          }

    await startConnection(
      rootServer,
      {
        ...baseRequest,
        secrets: {
          ...(baseRequest.secrets ?? {}),
          [serverId]: nextSecret
        }
      },
      {
        pendingSessionId: nextSessionId
      }
    )
  }

  const connectServer = async (
    server: Server,
    request?: ConnectionRequest,
    options?: ConnectServerOptions
  ) => {
    await startConnection(server, request, options)
  }

  const disconnectSession = async (
    sessionId: string,
    options: DisconnectSessionOptions = { closeDocument: true }
  ) => {
    const session = useSessionsStore.getState().tabs.find((tab) => tab.sessionId === sessionId)

    if (!session?.provisional) {
      await sessionsClient.disconnect(sessionId)
    }
    setPendingConnections((current) => {
      const next = { ...current }
      delete next[sessionId]
      return next
    })
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

  const closeLocalTerminal = async (terminalId: string) => {
    const terminal = useLocalTerminalsStore
      .getState()
      .tabs.find((tab) => tab.terminalId === terminalId)

    await localTerminalsClient.close(terminalId)
    removeLocalTerminal(terminalId)
    closeDocument(`local-terminal-editor:${terminalId}`)

    appendOutput({
      detail: terminal ? `${terminal.title} · ${terminal.cwd}` : terminalId,
      level: 'info',
      message: t('workbench.output.localTerminalClosed')
    })
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
        (await serversClient.list()).find((item) => item.id === session.serverId)

      if (!server) {
        toast.error(t('workbench.toasts.serverConfigMissing'))
        return
      }

      await startConnection(server, pendingConnections[session.sessionId]?.request, {
        pendingSessionId: session.sessionId
      })
      return
    }

    appendOutput({
      detail: `${session.serverName} · ${session.host}:${session.port}`,
      level: 'info',
      message: t('workbench.output.reconnecting', { name: session.serverName })
    })

    try {
      setSessionState(sessionId, 'connecting', undefined, 'validate')
      const nextSession = await sessionsClient.reconnect(sessionId)
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
      setSessionState(sessionId, 'error', message)
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
    await serversClient.toggleFavorite(serverId)
    await refreshWorkspaceData()
  }

  const deleteServer = async (serverId: string) => {
    await serversClient.delete(serverId)
    closeDocument(`server-editor:${serverId}`)
    await refreshWorkspaceData()
    toast.success(t('workbench.toasts.serverDeleted'))
  }

  const moveServerToGroup = async (server: Server, groupId: string | null, groupName?: string) => {
    const currentServer = (await getServerById(server.id)) ?? server
    if (currentServer.groupId === groupId) {
      return
    }

    try {
      let privateKey: string | null | undefined

      if (currentServer.authType === 'privateKey' && !currentServer.credentialId) {
        const secrets = await serversClient.getSecrets(currentServer.id)
        privateKey = secrets.privateKey

        if (!privateKey?.trim()) {
          throw new Error(t('workbench.primarySidebar.toasts.serverMoveFailed'))
        }
      }

      await serversClient.update(
        currentServer.id,
        buildServerGroupUpdatePayload(currentServer, groupId, { privateKey })
      )
      await refreshWorkspaceData()
      toast.success(
        t('workbench.primarySidebar.toasts.serverMoved', {
          group: groupName ?? t('workbench.primarySidebar.labels.ungrouped'),
          name: currentServer.name
        })
      )
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : t('workbench.primarySidebar.toasts.serverMoveFailed')
      toast.error(message)
      throw error
    }
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
        beginQuickConnect,
        closeQuickInput,
        connectQuickConnectTarget,
        connectServer,
        closeLocalTerminal,
        deleteServer,
        disconnectSession,
        focusActivity,
        focusExplorerHome,
        moveServerToGroup,
        openLocalTerminal,
        openEntityQuickInput,
        openServerEditor,
        openSftpFileEditor,
        openSettingsEditor,
        openUpdatesEditor,
        quickInput,
        reconnectSession,
        refreshWorkspaceData,
        requestConnectionSecrets,
        submitConnectionSecret,
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
