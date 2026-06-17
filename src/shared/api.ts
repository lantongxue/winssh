import type {
  AppActivityEvent,
  AppFocusEvent,
  AppInfo,
  AppSettings,
  CommandHistoryEntry,
  CommandHistoryListInput,
  CommandHistoryScope,
  CommandHistorySearchInput,
  CommandRecordedEvent,
  ConnectionRequest,
  Credential,
  CredentialSecret,
  CredentialUpsertInput,
  CustomCommand,
  CustomCommandInput,
  GroupInput,
  HostTrustResult,
  KnownHost,
  LogEntry,
  LogsState,
  LocalTerminalDataEvent,
  LocalTerminalExitEvent,
  LocalTerminalStateEvent,
  LocalTerminalSummary,
  PortForwardInput,
  PortForwardRule,
  PortForwardStateEvent,
  RecentSession,
  RuntimeCapabilities,
  Server,
  ServerSecrets,
  ServerGroup,
  ServerUpsertInput,
  SessionConnectResult,
  SessionCwdEvent,
  SessionDataEvent,
  SessionErrorEvent,
  SessionExitEvent,
  SessionStateEvent,
  SessionResourceSnapshot,
  SessionSummary,
  SftpFileChunkEvent,
  SftpFileReadStreamStart,
  SftpFileStreamStateEvent,
  SftpFileWriteStreamStart,
  SftpListResult,
  SystemMenuAction,
  Tag,
  TagInput,
  TransferProgressEvent,
  UpdateState,
  WebDAVBackupEntry,
  WebDAVBackupState,
  WindowState,
  SftpBookmark
} from './types'
import type { AppLogEvent } from './observability'
import type { TerminalBackpressureEvent, TerminalDegradedEvent } from './ipc-channels'
import type { ServerIconMimeType } from './server-brands'
import type { ThemeDefinition, ThemeDeleteResult, ThemeImportResult } from './themes'

export type Unsubscribe = () => void

export interface WinsshApi {
  groups: {
    list: () => Promise<ServerGroup[]>
    create: (input: GroupInput) => Promise<ServerGroup>
    update: (id: string, input: GroupInput) => Promise<ServerGroup>
    delete: (id: string) => Promise<void>
  }
  tags: {
    list: () => Promise<Tag[]>
    create: (input: TagInput) => Promise<Tag>
    update: (id: string, input: TagInput) => Promise<Tag>
    delete: (id: string) => Promise<void>
  }
  credentials: {
    list: () => Promise<Credential[]>
    getSecret: (id: string) => Promise<CredentialSecret>
    create: (input: CredentialUpsertInput) => Promise<Credential>
    update: (id: string, input: CredentialUpsertInput) => Promise<Credential>
    delete: (id: string) => Promise<void>
  }
  servers: {
    list: () => Promise<Server[]>
    findById: (id: string) => Promise<Server | null>
    getSecrets: (id: string) => Promise<ServerSecrets>
    create: (input: ServerUpsertInput) => Promise<Server>
    update: (id: string, input: ServerUpsertInput) => Promise<Server>
    delete: (id: string) => Promise<void>
    toggleFavorite: (id: string) => Promise<Server>
    listRecent: () => Promise<RecentSession[]>
    clearRecent: () => Promise<void>
  }
  sessions: {
    connect: (request: ConnectionRequest) => Promise<SessionConnectResult>
    disconnect: (sessionId: string) => Promise<void>
    reconnect: (sessionId: string) => Promise<SessionSummary>
    getResourceSnapshot: (sessionId: string) => Promise<SessionResourceSnapshot>
    write: (sessionId: string, data: string) => void
    resize: (sessionId: string, columns: number, rows: number) => Promise<void>
    createDataChannel: (sessionId: string) => Promise<MessagePort>
    onData: (sessionId: string, callback: (event: SessionDataEvent) => void) => Unsubscribe
    onExit: (callback: (event: SessionExitEvent) => void) => Unsubscribe
    onStateChange: (callback: (event: SessionStateEvent) => void) => Unsubscribe
    onError: (callback: (event: SessionErrorEvent) => void) => Unsubscribe
    onCwdChanged: (callback: (event: SessionCwdEvent) => void) => Unsubscribe
    onTerminalBackpressure: (callback: (event: TerminalBackpressureEvent) => void) => Unsubscribe
    onTerminalDegraded: (callback: (event: TerminalDegradedEvent) => void) => Unsubscribe
  }
  localTerminals: {
    create: () => Promise<LocalTerminalSummary>
    close: (terminalId: string) => Promise<void>
    write: (terminalId: string, data: string) => void
    resize: (terminalId: string, columns: number, rows: number) => Promise<void>
    onData: (terminalId: string, callback: (event: LocalTerminalDataEvent) => void) => Unsubscribe
    onExit: (callback: (event: LocalTerminalExitEvent) => void) => Unsubscribe
    onStateChange: (callback: (event: LocalTerminalStateEvent) => void) => Unsubscribe
  }
  sftp: {
    list: (sessionId: string, path: string) => Promise<SftpListResult>
    createFile: (sessionId: string, path: string, name: string) => Promise<void>
    openFileReadStream: (
      sessionId: string,
      remotePath: string
    ) => Promise<SftpFileReadStreamStart>
    startFileReadStream: (streamId: string) => void
    openFileWriteStream: (
      sessionId: string,
      remotePath: string,
      encoding: string
    ) => Promise<SftpFileWriteStreamStart>
    writeFileChunk: (streamId: string, chunk: string) => Promise<void>
    closeFileWriteStream: (streamId: string) => Promise<void>
    cancelFileStream: (streamId: string) => void
    onFileChunk: (callback: (event: SftpFileChunkEvent) => void) => Unsubscribe
    onFileStreamState: (callback: (event: SftpFileStreamStateEvent) => void) => Unsubscribe
    mkdir: (sessionId: string, path: string, name: string) => Promise<void>
    rename: (sessionId: string, path: string, newName: string) => Promise<void>
    move: (sessionId: string, sourcePath: string, destinationDirPath: string) => Promise<void>
    remove: (sessionId: string, path: string) => Promise<void>
    uploadFiles: (sessionId: string, targetPath: string) => Promise<void>
    uploadPaths: (sessionId: string, targetPath: string, localPaths: string[]) => Promise<void>
    downloadFile: (sessionId: string, remotePath: string) => Promise<void>
    cancelTransfer: (batchId: string) => void
    cancelAllTransfers: () => void
    refresh: (sessionId: string, path: string) => Promise<SftpListResult>
    onTransferProgress: (callback: (event: TransferProgressEvent) => void) => Unsubscribe
  }
  portForwards: {
    list: (sessionId: string) => Promise<PortForwardRule[]>
    create: (sessionId: string, input: PortForwardInput) => Promise<PortForwardRule>
    start: (sessionId: string, ruleId: string) => Promise<PortForwardRule>
    stop: (sessionId: string, ruleId: string) => Promise<PortForwardRule>
    remove: (sessionId: string, ruleId: string) => Promise<void>
    onStateChange: (callback: (event: PortForwardStateEvent) => void) => Unsubscribe
  }
  commandHistory: {
    list: (input: CommandHistoryListInput) => Promise<CommandHistoryEntry[]>
    search: (input: CommandHistorySearchInput) => Promise<CommandHistoryEntry[]>
    clear: (scope: CommandHistoryScope) => Promise<void>
    clearAll: () => Promise<void>
    deleteEntry: (id: string) => Promise<void>
    setServerCapture: (serverId: string, enabled: boolean) => Promise<void>
    onCommandAdded: (callback: (event: CommandRecordedEvent) => void) => Unsubscribe
  }
  customCommands: {
    list: () => Promise<CustomCommand[]>
    create: (input: CustomCommandInput) => Promise<CustomCommand>
    update: (id: string, input: Partial<CustomCommandInput>) => Promise<CustomCommand>
    delete: (id: string) => Promise<void>
  }
  sftpBookmarks: {
    list: (serverId: string) => Promise<SftpBookmark[]>
    add: (serverId: string, path: string) => Promise<SftpBookmark>
    delete: (id: string) => Promise<void>
    deleteByPath: (serverId: string, path: string) => Promise<void>
  }
  settings: {
    get: () => Promise<AppSettings>
    update: (input: Partial<AppSettings>) => Promise<AppSettings>
  }
  logs: {
    clear: () => Promise<void>
    getState: () => Promise<LogsState>
    list: () => Promise<LogEntry[]>
    updatePath: (logFilePath: string) => Promise<LogsState>
    write: (event: AppLogEvent) => Promise<void>
  }
  updates: {
    getState: () => Promise<UpdateState>
    check: () => Promise<UpdateState>
    download: () => Promise<UpdateState>
    quitAndInstall: () => Promise<void>
    onStateChange: (callback: (state: UpdateState) => void) => Unsubscribe
  }
  themes: {
    list: () => Promise<ThemeDefinition[]>
    importArchive: () => Promise<ThemeImportResult | null>
    deletePlugin: (pluginId: string) => Promise<ThemeDeleteResult>
  }
  backup: {
    getState: () => Promise<WebDAVBackupState>
    list: () => Promise<WebDAVBackupEntry[]>
    backupNow: () => Promise<void>
    delete: (fileName: string) => Promise<void>
    restore: (fileName?: string) => Promise<void>
    testConnection: () => Promise<{ ok: boolean; message: string }>
  }
  system: {
    getAppInfo: () => Promise<AppInfo>
    getPathForFile: (file: File) => string | null
    pickPrivateKey: () => Promise<string | null>
    pickServerIcon: () => Promise<{ mimeType: ServerIconMimeType; data: Uint8Array } | null>
    getKnownHosts: () => Promise<KnownHost[]>
    removeKnownHost: (host: string, port: number) => Promise<void>
    getCapabilities: () => Promise<RuntimeCapabilities>
    relaunch: () => Promise<void>
    respondHostTrust: (result: HostTrustResult) => Promise<void>
    getShellIntegrationScript: () => Promise<string>
    menu: {
      onAction: (callback: (action: SystemMenuAction) => void) => Unsubscribe
    }
    window: {
      minimize: () => Promise<void>
      toggleMaximize: () => Promise<void>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
      onStateChange: (callback: (state: WindowState) => void) => Unsubscribe
    }
    appFocus: {
      onStateChange: (callback: (event: AppFocusEvent) => void) => Unsubscribe
    }
    appActivity: {
      onStateChange: (callback: (event: AppActivityEvent) => void) => Unsubscribe
    }
    onHostTrustRequest: (
      callback: (request: import('./types').HostTrustRequest) => void
    ) => Unsubscribe
  }
}
