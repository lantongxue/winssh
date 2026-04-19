export const queryKeys = {
  appInfo: ['app-info'] as const,
  capabilities: ['capabilities'] as const,
  credentials: ['credentials'] as const,
  groups: ['groups'] as const,
  knownHosts: ['known-hosts'] as const,
  recentSessions: ['recent-sessions'] as const,
  servers: ['servers'] as const,
  settings: ['settings'] as const,
  tags: ['tags'] as const,
  themes: ['themes'] as const,
  updatesState: ['updates', 'state'] as const,
  portForwards: (sessionId: string) => ['port-forwards', sessionId] as const,
  serverSecrets: (serverId: string) => ['server-secrets', serverId] as const
}

