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
  | 'recent'
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
  serverId: string | null
}

export interface SessionEditorDocument {
  id: `session-editor:${string}`
  kind: 'session-editor'
  sessionId: string
}

export type WorkbenchDocument =
  | SettingsEditorDocument
  | TerminalWelcomeDocument
  | ServerEditorDocument
  | SessionEditorDocument

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

export function createServerEditorDocument(serverId?: string | null): ServerEditorDocument {
  return {
    id: `server-editor:${serverId ?? 'new'}`,
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

  if (document.kind === 'session-editor' || document.kind === 'terminal-welcome') {
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
