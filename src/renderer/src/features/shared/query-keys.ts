import type { CommandHistoryScope } from '@shared/types'

export const queryKeys = {
  appInfo: ['app-info'] as const,
  capabilities: ['capabilities'] as const,
  credentials: ['credentials'] as const,
  groups: ['groups'] as const,
  knownHosts: ['known-hosts'] as const,
  logEntries: ['logs', 'entries'] as const,
  logsState: ['logs', 'state'] as const,
  recentSessions: ['recent-sessions'] as const,
  resourceSnapshot: (sessionId: string) => ['session-resource-snapshot', sessionId] as const,
  servers: ['servers'] as const,
  settings: ['settings'] as const,
  tags: ['tags'] as const,
  themes: ['themes'] as const,
  updatesState: ['updates', 'state'] as const,
  backupList: ['backup', 'list'] as const,
  backupState: ['backup', 'state'] as const,
  portForwards: (sessionId: string) => ['port-forwards', sessionId] as const,
  serverSecrets: (serverId: string) => ['server-secrets', serverId] as const,
  sftpFile: (sessionId: string, remotePath: string) =>
    ['sftp', sessionId, 'file', remotePath] as const,
  commandHistory: (scope: CommandHistoryScope) =>
    scope.kind === 'ssh'
      ? (['command-history', 'ssh', scope.serverId] as const)
      : (['command-history', 'local'] as const)
}
