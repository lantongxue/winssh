import type {
  AppSettings,
  ConnectionRequest,
  GroupInput,
  KnownHost,
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
  SessionDataEvent,
  SessionErrorEvent,
  SessionExitEvent,
  SessionStateEvent,
  SessionSummary,
  SftpListResult,
  Tag,
  TagInput,
  TransferProgressEvent,
  WindowState
} from './types'
import type { ThemeDefinition } from './themes'

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
  servers: {
    list: () => Promise<Server[]>
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
    write: (sessionId: string, data: string) => Promise<void>
    resize: (sessionId: string, columns: number, rows: number) => Promise<void>
    onData: (callback: (event: SessionDataEvent) => void) => Unsubscribe
    onExit: (callback: (event: SessionExitEvent) => void) => Unsubscribe
    onStateChange: (callback: (event: SessionStateEvent) => void) => Unsubscribe
    onError: (callback: (event: SessionErrorEvent) => void) => Unsubscribe
  }
  sftp: {
    list: (sessionId: string, path: string) => Promise<SftpListResult>
    createFile: (sessionId: string, path: string, name: string) => Promise<void>
    mkdir: (sessionId: string, path: string, name: string) => Promise<void>
    rename: (sessionId: string, path: string, newName: string) => Promise<void>
    remove: (sessionId: string, path: string) => Promise<void>
    uploadFiles: (sessionId: string, targetPath: string) => Promise<void>
    downloadFile: (sessionId: string, remotePath: string) => Promise<void>
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
  settings: {
    get: () => Promise<AppSettings>
    update: (input: Partial<AppSettings>) => Promise<AppSettings>
  }
  themes: {
    list: () => Promise<ThemeDefinition[]>
  }
  system: {
    pickPrivateKey: () => Promise<string | null>
    listFonts: () => Promise<string[]>
    getKnownHosts: () => Promise<KnownHost[]>
    removeKnownHost: (host: string, port: number) => Promise<void>
    getCapabilities: () => Promise<RuntimeCapabilities>
    relaunch: () => Promise<void>
    window: {
      minimize: () => Promise<void>
      toggleMaximize: () => Promise<void>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
      onStateChange: (callback: (state: WindowState) => void) => Unsubscribe
    }
  }
}
