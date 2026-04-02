import type { ThemeSelection } from './themes'

export type AuthType = 'password' | 'privateKey'
export type ThemeMode = ThemeSelection
export type AppLanguage = 'system' | 'zh-CN' | 'en-US'
export type CursorStyle = 'block' | 'underline' | 'bar'
export type SessionStatus = 'connecting' | 'ready' | 'error' | 'disconnected'
export const SESSION_CONNECTION_PHASES = ['validate', 'handshake', 'prepare', 'attach'] as const
export type SessionConnectionPhase = (typeof SESSION_CONNECTION_PHASES)[number]
export type RemoteEntryKind = 'file' | 'directory' | 'symlink'
export type SecretKind = 'password' | 'passphrase'
export type WindowTitleBarStyle = 'native' | 'custom'
export type PortForwardKind = 'local' | 'remote'
export type PortForwardStatus = 'starting' | 'active' | 'stopped' | 'error'
export type SessionConnectFailureCode = 'password_required' | 'auth_failed' | 'connection_failed'

export interface ServerGroup {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface Tag {
  id: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

export interface Server {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  privateKeyPath: string | null
  note: string | null
  groupId: string | null
  favorite: boolean
  createdAt: string
  updatedAt: string
  lastConnectedAt: string | null
  group: ServerGroup | null
  tags: Tag[]
  hasPassword: boolean
  hasPassphrase: boolean
}

export interface ServerSecrets {
  password: string | null
  passphrase: string | null
  privateKey: string | null
}

export interface RecentSession {
  id: string
  serverId: string
  serverName: string
  host: string
  connectedAt: string
}

export interface KnownHost {
  host: string
  port: number
  algorithm: string
  fingerprint: string
  verifiedAt: string
}

export interface AppSettings {
  language: AppLanguage
  theme: ThemeMode
  terminalFontSize: number
  terminalFontFamily: string
  cursorStyle: CursorStyle
  cursorBlink: boolean
  copyOnSelect: boolean
  windowTitleBarStyle: WindowTitleBarStyle
}

export interface GroupInput {
  name: string
  color: string
}

export interface TagInput {
  name: string
  color: string
}

export interface ServerUpsertInput {
  id?: string
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  privateKey?: string | null
  note?: string
  groupId?: string | null
  tagIds: string[]
  favorite: boolean
  password?: string
  passphrase?: string
  rememberPassword: boolean
  rememberPassphrase: boolean
}

export interface ConnectionRequest {
  serverId: string
  sessionId?: string
  password?: string
  passphrase?: string
  rememberPassword?: boolean
  rememberPassphrase?: boolean
}

export type SessionConnectResult =
  | {
      ok: true
      summary: SessionSummary
    }
  | {
      ok: false
      code: SessionConnectFailureCode
      message: string
    }

export interface SessionSummary {
  sessionId: string
  serverId: string
  serverName: string
  host: string
  port: number
  status: SessionStatus
  connectedAt: string
  currentPath: string
}

export interface SessionStateEvent {
  sessionId: string
  status: SessionStatus
  phase?: SessionConnectionPhase
  message?: string
}

export interface SessionDataEvent {
  sessionId: string
  data: string
}

export interface SessionExitEvent {
  sessionId: string
  code?: number
  signal?: string
}

export interface SessionErrorEvent {
  sessionId: string
  message: string
}

export interface RemoteEntryPermissions {
  octal: string
  symbolic: string
}

export interface RemoteEntry {
  path: string
  name: string
  kind: RemoteEntryKind
  size: number
  modifiedAt: string | null
  permissions: RemoteEntryPermissions | null
}

export interface SftpListResult {
  path: string
  entries: RemoteEntry[]
}

export interface TransferProgressEvent {
  sessionId: string
  direction: 'upload' | 'download'
  fileName: string
  localPath?: string
  remotePath: string
  transferred: number
  total: number
  status: 'running' | 'completed' | 'error'
  error?: string
}

export interface PortForwardInput {
  kind: PortForwardKind
  bindHost: string
  bindPort: number
  targetHost: string
  targetPort: number
}

export interface PortForwardRule extends PortForwardInput {
  id: string
  sessionId: string
  enabled: boolean
  status: PortForwardStatus
  createdAt: string
  updatedAt: string
  lastError?: string
}

export interface PortForwardStateEvent {
  sessionId: string
  rule: PortForwardRule
}

export interface RuntimeCapabilities {
  credentialStorage: boolean
}

export interface WindowState {
  isMaximized: boolean
}

export interface QuickConnectTarget {
  authType: 'password'
  host: string
  port: 22
  username: string
}
