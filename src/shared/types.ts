import type { ThemeSelection } from './themes'
import type { ServerBrandId, ServerIconMimeType } from './server-brands'
import type { LogLevel, ObservableSource } from './observability'
import type { IntegratedFontId } from './integrated-fonts'

export type AuthType = 'password' | 'privateKey'
export type CredentialKind = 'password' | 'privateKey'
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
export type SessionConnectFailureCode = 'secret_required' | 'auth_failed' | 'connection_failed'
export type LocalTerminalStatus = 'running' | 'exited' | 'error'
export type LocalTerminalShell = 'cmd' | 'powershell' | 'bash' | 'zsh'
export type ReleaseChannel = 'alpha' | 'beta' | 'latest'
export const UPDATE_PHASES = [
  'unsupported',
  'idle',
  'checking',
  'available',
  'not-available',
  'downloading',
  'downloaded',
  'error'
] as const
export type UpdatePhase = (typeof UPDATE_PHASES)[number]
export const UPDATE_UNSUPPORTED_REASONS = [
  'platform_not_supported',
  'app_not_packaged',
  'feed_url_missing'
] as const
export type UpdateUnsupportedReason = (typeof UPDATE_UNSUPPORTED_REASONS)[number]
export const SESSION_RESOURCE_MONITOR_LINUX_ONLY = 'session_resource_linux_only'
export const SESSION_RESOURCE_MONITOR_UNAVAILABLE = 'session_resource_unavailable'

export interface ServerGroup {
  id: string
  name: string
  parentId: string | null
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
  brandId: ServerBrandId | null
  customIconDataUrl: string | null
  privateKeyPath: string | null
  note: string | null
  groupId: string | null
  credentialId: string | null
  jumpServerId: string | null
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
  logFilePath: string | null
  theme: ThemeMode
  terminalFontSize: number
  uiFontId: IntegratedFontId
  terminalFontId: IntegratedFontId
  editorFontId: IntegratedFontId | null
  autoUpdateCheckEnabled: boolean
  experimentalTerminalWebgl: boolean
  cursorStyle: CursorStyle
  cursorBlink: boolean
  copyOnSelect: boolean
  localTerminalShell: LocalTerminalShell
  windowTitleBarStyle: WindowTitleBarStyle
  webdavBackupEnabled: boolean
  webdavUrl: string | null
  webdavUsername: string | null
  webdavBackupIntervalMinutes: number
  webdavBackupPath: string | null
  resourceMonitorIntervalMs: number
}

export interface WebDAVBackupState {
  lastBackupAt: string | null
  lastBackupError: string | null
  nextBackupAt: string | null
}

export interface WebDAVBackupEntry {
  fileName: string
  modifiedAt: string
}

export interface AppInfo {
  name: string
  version: string
  platform: string
  releaseChannel: ReleaseChannel
}

export interface LogsState {
  logFilePath: string
}

export interface LogEntry {
  id: string
  level: LogLevel | null
  message: string
  raw: string
  source: ObservableSource | null
  timestamp: string | null
}

export interface UpdateVersionInfo {
  version: string
  releaseDate: string | null
  releaseName: string | null
  releaseNotes: string | null
}

export interface UpdateState {
  phase: UpdatePhase
  supported: boolean
  currentVersion: string
  autoCheckEnabled: boolean
  availableUpdate: UpdateVersionInfo | null
  downloadProgressPercent: number | null
  errorMessage: string | null
  unsupportedReason: UpdateUnsupportedReason | null
}

export interface GroupInput {
  name: string
  color: string
  parentId?: string | null
}

export interface TagInput {
  name: string
  color: string
}

export interface Credential {
  id: string
  name: string
  kind: CredentialKind
  username: string | null
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface CredentialSecret {
  password: string | null
  privateKey: string | null
  passphrase: string | null
}

export interface CredentialUpsertInput {
  name: string
  kind: CredentialKind
  username?: string | null
  password?: string | null
  privateKey?: string | null
  passphrase?: string | null
  note?: string | null
}

export interface ServerUpsertInput {
  id?: string
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  privateKey?: string | null
  customIconMimeType?: ServerIconMimeType | null
  customIconData?: Uint8Array | null
  note?: string
  groupId?: string | null
  jumpServerId?: string | null
  tagIds: string[]
  favorite: boolean
  password?: string
  passphrase?: string
  rememberPassword: boolean
  rememberPassphrase: boolean
  credentialId?: string | null
}

export interface ConnectionSecretInput {
  password?: string
  passphrase?: string
  rememberPassword?: boolean
  rememberPassphrase?: boolean
}

export interface ConnectionRequest {
  serverId: string
  sessionId?: string
  secrets?: Record<string, ConnectionSecretInput>
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
      serverId?: string
      secretKind?: SecretKind
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

export interface ObservableEventMetadata {
  correlationId?: string
  source?: ObservableSource
  timestamp?: string
}

export interface SessionStateEvent extends ObservableEventMetadata {
  sessionId: string
  status: SessionStatus
  phase?: SessionConnectionPhase
  message?: string
  code?: string
  recoverable?: boolean
}

export interface SessionDataEvent extends ObservableEventMetadata {
  sessionId: string
  data: string
}

export interface SessionExitEvent extends ObservableEventMetadata {
  sessionId: string
  code?: number
  signal?: string
}

export interface SessionErrorEvent extends ObservableEventMetadata {
  sessionId: string
  message: string
  code?: string
  recoverable?: boolean
}

export interface SessionResourceSnapshot {
  sessionId: string
  sampledAt: string
  platform: 'linux'
  cpu: {
    usagePercent: number | null
  }
  memory: {
    usedBytes: number
    totalBytes: number
    usagePercent: number
  }
  network: {
    rxBytesPerSecond: number | null
    txBytesPerSecond: number | null
  }
  disk: {
    mountPath: '/'
    usedBytes: number
    totalBytes: number
    usagePercent: number
  }
}

export interface LocalTerminalSummary {
  terminalId: string
  title: string
  shell: string
  cwd: string
  startedAt: string
  status: LocalTerminalStatus
  lastMessage?: string
}

export interface LocalTerminalStateEvent extends ObservableEventMetadata {
  terminalId: string
  status: LocalTerminalStatus
  message?: string
  code?: string
  recoverable?: boolean
}

export interface LocalTerminalDataEvent extends ObservableEventMetadata {
  terminalId: string
  data: string
}

export interface LocalTerminalExitEvent extends ObservableEventMetadata {
  terminalId: string
  exitCode: number
  signal?: number
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

export interface TransferProgressEvent extends ObservableEventMetadata {
  sessionId: string
  direction: 'upload' | 'download'
  fileName: string
  localPath?: string
  remotePath: string
  transferred: number
  total: number
  status: 'running' | 'completed' | 'error'
  error?: string
  batchId?: string
  batchTotal?: number
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

export interface PortForwardStateEvent extends ObservableEventMetadata {
  sessionId: string
  rule: PortForwardRule
}

export interface RuntimeCapabilities {
  credentialStorage: boolean
}

export type SystemMenuAction =
  | 'closeActiveDocument'
  | 'openCommandPalette'
  | 'openLocalTerminal'
  | 'openNewConnection'
  | 'openQuickOpen'
  | 'openSettings'
  | 'openUpdates'
  | 'saveActiveDocument'
  | 'togglePanel'
  | 'toggleSidebar'

export interface WindowState {
  isMaximized: boolean
}

export interface QuickConnectTarget {
  authType: 'password'
  host: string
  port: 22
  username: string
}
