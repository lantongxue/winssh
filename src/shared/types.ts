export type AuthType = 'password' | 'privateKey'
export type ThemeMode = 'system' | 'light' | 'dark'
export type CursorStyle = 'block' | 'underline' | 'bar'
export type SessionStatus = 'connecting' | 'ready' | 'error' | 'disconnected'
export type RemoteEntryKind = 'file' | 'directory' | 'symlink'
export type SecretKind = 'password' | 'passphrase'

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
  theme: ThemeMode
  terminalFontSize: number
  terminalFontFamily: string
  cursorStyle: CursorStyle
  cursorBlink: boolean
  copyOnSelect: boolean
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
  privateKeyPath?: string | null
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
  password?: string
  passphrase?: string
  rememberPassword?: boolean
  rememberPassphrase?: boolean
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

export interface RemoteEntry {
  path: string
  name: string
  kind: RemoteEntryKind
  size: number
  modifiedAt: string | null
  permissions: string | null
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

export interface RuntimeCapabilities {
  credentialStorage: boolean
}
