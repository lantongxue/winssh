import type { TransferProgressEvent } from '@shared/types'
import type { LucideIcon } from 'lucide-react'
import { Files, Settings2, Terminal } from 'lucide-react'

export type WorkbenchActivityId = 'explorer' | 'terminal' | 'settings'
export type WorkbenchPanelId = 'output' | 'transfers' | 'problems'
export type WorkbenchLegacyPath = '/servers' | '/sessions' | '/settings'
export type WorkbenchExplorerSectionId = 'favorites' | 'recent' | 'groups' | 'tags' | 'all-servers'

export type WorkbenchExplorerNodeId =
  | 'home'
  | 'favorites'
  | 'groups'
  | 'recent'
  | 'tags'
  | 'all-servers'
  | `group:${string}`
  | `tag:${string}`
  | `server:${string}`
  | `recent-server:${string}`

export type WorkbenchDocumentId =
  | 'settings-editor'
  | 'terminal-welcome'
  | `server-editor:${string}`
  | `session-editor:${string}`
  | `local-terminal-editor:${string}`

export interface SettingsEditorDocument {
  id: 'settings-editor'
  kind: 'settings-editor'
}

export interface TerminalWelcomeDocument {
  id: 'terminal-welcome'
  kind: 'terminal-welcome'
}

export interface ServerEditorDocument {
  id: `server-editor:${string}`
  kind: 'server-editor'
  initialGroupId?: string | null
  serverId: string | null
}

export interface SessionEditorDocument {
  id: `session-editor:${string}`
  kind: 'session-editor'
  sessionId: string
}

export interface LocalTerminalEditorDocument {
  id: `local-terminal-editor:${string}`
  kind: 'local-terminal-editor'
  terminalId: string
}

export type WorkbenchDocument =
  | SettingsEditorDocument
  | TerminalWelcomeDocument
  | ServerEditorDocument
  | SessionEditorDocument
  | LocalTerminalEditorDocument

export interface WorkbenchActivityMeta {
  activityId: WorkbenchActivityId
  icon: LucideIcon
}

export interface WorkbenchPanelMeta {
  id: WorkbenchPanelId
}

export interface WorkbenchOutputEntry {
  id: string
  createdAt: string
  detail?: string
  level: 'info' | 'success' | 'warning' | 'error'
  message: string
}

export interface WorkbenchProblemEntry {
  createdAt: string
  detail?: string
  documentId?: WorkbenchDocumentId
  id: string
  severity: 'warning' | 'error'
  title: string
}

export interface WorkbenchTransferEntry extends TransferProgressEvent {
  id: string
  updatedAt: string
}

export const workbenchActivities: WorkbenchActivityMeta[] = [
  {
    activityId: 'explorer',
    icon: Files
  },
  {
    activityId: 'terminal',
    icon: Terminal
  },
  {
    activityId: 'settings',
    icon: Settings2
  }
]

export const workbenchPanels: WorkbenchPanelMeta[] = [
  { id: 'output' },
  { id: 'transfers' },
  { id: 'problems' }
]

export function createSettingsEditorDocument(): SettingsEditorDocument {
  return { id: 'settings-editor', kind: 'settings-editor' }
}

export function createTerminalWelcomeDocument(): TerminalWelcomeDocument {
  return { id: 'terminal-welcome', kind: 'terminal-welcome' }
}

function createNewServerEditorDocumentId(initialGroupId?: string | null) {
  return `server-editor:${initialGroupId ? `new:${initialGroupId}` : 'new'}` as const
}

export function createServerEditorDocument(
  serverId?: string | null,
  options: { initialGroupId?: string | null } = {}
): ServerEditorDocument {
  const initialGroupId = serverId ? undefined : options.initialGroupId

  return {
    id: serverId ? `server-editor:${serverId}` : createNewServerEditorDocumentId(initialGroupId),
    initialGroupId,
    kind: 'server-editor',
    serverId: serverId ?? null
  }
}

export function getServerEditorFormId(documentId: ServerEditorDocument['id']) {
  return `${documentId}:form`
}

export function createSessionEditorDocument(sessionId: string): SessionEditorDocument {
  return {
    id: `session-editor:${sessionId}`,
    kind: 'session-editor',
    sessionId
  }
}

export function createLocalTerminalEditorDocument(terminalId: string): LocalTerminalEditorDocument {
  return {
    id: `local-terminal-editor:${terminalId}`,
    kind: 'local-terminal-editor',
    terminalId
  }
}

export function getWorkbenchActivity(activityId: WorkbenchActivityId): WorkbenchActivityMeta {
  return (
    workbenchActivities.find((activity) => activity.activityId === activityId) ??
    workbenchActivities[0]
  )
}

export function getDocumentActivity(document: WorkbenchDocument | null): WorkbenchActivityId {
  if (!document) {
    return 'explorer'
  }

  if (document.kind === 'settings-editor') {
    return 'settings'
  }

  if (
    document.kind === 'session-editor' ||
    document.kind === 'local-terminal-editor' ||
    document.kind === 'terminal-welcome'
  ) {
    return 'terminal'
  }

  return 'explorer'
}

export function getLegacyPathForActivity(activityId: WorkbenchActivityId): WorkbenchLegacyPath {
  if (activityId === 'settings') {
    return '/settings'
  }

  if (activityId === 'terminal') {
    return '/sessions'
  }

  return '/servers'
}

export function getLegacyPathForDocument(document: WorkbenchDocument | null): WorkbenchLegacyPath {
  return getLegacyPathForActivity(getDocumentActivity(document))
}

export function getDocumentFallbackTitle(document: WorkbenchDocument): string {
  switch (document.kind) {
    case 'settings-editor':
      return 'Settings'
    case 'terminal-welcome':
      return 'Terminal'
    case 'server-editor':
      return document.serverId ? 'Connection' : 'Untitled Connection'
    case 'session-editor':
      return 'Terminal'
    case 'local-terminal-editor':
      return 'Local Terminal'
    default:
      return 'Workbench'
  }
}

export function getDocumentDescription(document: WorkbenchDocument): string {
  switch (document.kind) {
    case 'settings-editor':
      return 'Application preferences.'
    case 'terminal-welcome':
      return 'No active terminal session.'
    case 'server-editor':
      return document.serverId ? 'Edit saved SSH connection.' : 'Create a new SSH connection.'
    case 'session-editor':
      return 'Interactive SSH terminal.'
    case 'local-terminal-editor':
      return 'Interactive local terminal.'
    default:
      return ''
  }
}

export function createTransferEntryId(event: TransferProgressEvent): string {
  return [
    event.sessionId,
    event.direction,
    event.remotePath,
    event.localPath ?? '',
    event.fileName
  ].join('::')
}
