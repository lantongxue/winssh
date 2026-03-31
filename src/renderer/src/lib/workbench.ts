import type { TransferProgressEvent } from '@shared/types'
import type { LucideIcon } from 'lucide-react'
import { Files, Settings2, TerminalSquare } from 'lucide-react'

export type WorkbenchActivityId = 'explorer' | 'terminal' | 'settings'
export type WorkbenchPanelId = 'output' | 'transfers' | 'problems'
export type WorkbenchLegacyPath = '/servers' | '/sessions' | '/settings'
export type WorkbenchExplorerSectionId =
  | 'favorites'
  | 'recent'
  | 'groups'
  | 'tags'
  | 'all-servers'

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
  | 'explorer-home'
  | 'settings-editor'
  | 'terminal-welcome'
  | `server-editor:${string}`
  | `session-editor:${string}`

export interface ExplorerHomeDocument {
  id: 'explorer-home'
  kind: 'explorer-home'
}

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
  | ExplorerHomeDocument
  | SettingsEditorDocument
  | TerminalWelcomeDocument
  | ServerEditorDocument
  | SessionEditorDocument

export interface WorkbenchActivityMeta {
  activityId: WorkbenchActivityId
  description: string
  icon: LucideIcon
  title: string
}

export interface WorkbenchPanelMeta {
  id: WorkbenchPanelId
  label: string
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
    description: 'Browse saved hosts, groups, tags, and recent connections.',
    icon: Files,
    title: 'Explorer'
  },
  {
    activityId: 'terminal',
    description: 'Inspect active SSH sessions and remote file systems.',
    icon: TerminalSquare,
    title: 'Terminal'
  },
  {
    activityId: 'settings',
    description: 'Adjust appearance, terminal behavior, and trust settings.',
    icon: Settings2,
    title: 'Settings'
  }
]

export const workbenchPanels: WorkbenchPanelMeta[] = [
  { id: 'output', label: 'OUTPUT' },
  { id: 'transfers', label: 'TRANSFERS' },
  { id: 'problems', label: 'PROBLEMS' }
]

export const defaultWorkbenchDocument: ExplorerHomeDocument = {
  id: 'explorer-home',
  kind: 'explorer-home'
}

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

export function createSessionEditorDocument(sessionId: string): SessionEditorDocument {
  return {
    id: `session-editor:${sessionId}`,
    kind: 'session-editor',
    sessionId
  }
}

export function isPinnedDocument(documentId: WorkbenchDocumentId) {
  return documentId === defaultWorkbenchDocument.id
}

export function getWorkbenchActivity(activityId: WorkbenchActivityId): WorkbenchActivityMeta {
  return (
    workbenchActivities.find((activity) => activity.activityId === activityId) ??
    workbenchActivities[0]
  )
}

export function getDocumentActivity(document: WorkbenchDocument): WorkbenchActivityId {
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

export function getDocumentFallbackTitle(document: WorkbenchDocument): string {
  switch (document.kind) {
    case 'explorer-home':
      return 'Explorer'
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
    case 'explorer-home':
      return 'Workspace overview and recent activity.'
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
