import type { SecretKind, Server, SessionConnectFailureCode } from '@shared/types'

export class ConnectionFailure extends Error {
  constructor(
    readonly code: SessionConnectFailureCode,
    message: string,
    readonly serverId?: string,
    readonly secretKind?: SecretKind
  ) {
    super(message)
    this.name = 'ConnectionFailure'
  }
}

export function getSecretKindForServer(server: Server): SecretKind {
  return server.authType === 'password' ? 'password' : 'passphrase'
}

export function isAuthenticationFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const level = (error as Error & { level?: string }).level
  if (level === 'client-authentication') {
    return true
  }

  return /all configured authentication methods failed|permission denied/i.test(error.message)
}
