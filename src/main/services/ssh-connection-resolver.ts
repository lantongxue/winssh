import { promises as fs } from 'node:fs'
import type { ConnectionRequest, Server } from '@shared/types'
import type { DatabaseService } from '../database'
import type { MainTranslator } from '../localization'
import { ConnectionFailure } from './ssh-connection-errors'

export interface ResolvedConnectionAuth {
  password?: string
  passphrase?: string
  privateKey?: string
}

export class SshConnectionResolver {
  constructor(
    private readonly database: Pick<
      DatabaseService,
      'getServerById' | 'getServerPassword' | 'getServerPassphrase' | 'getServerPrivateKey'
    >,
    private readonly t: MainTranslator
  ) {}

  resolveJumpServer(server: Server): Server | null {
    if (!server.jumpServerId) {
      return null
    }

    const jumpServer = this.database.getServerById(server.jumpServerId)
    if (!jumpServer) {
      throw new ConnectionFailure('connection_failed', this.t('errors.jumpServerNotFound'))
    }

    if (jumpServer.id === server.id || jumpServer.jumpServerId) {
      throw new ConnectionFailure('connection_failed', this.t('errors.jumpServerChainUnsupported'))
    }

    return jumpServer
  }

  async resolveAuth(server: Server, request: ConnectionRequest): Promise<ResolvedConnectionAuth> {
    const requestSecrets = request.secrets?.[server.id]
    const password =
      requestSecrets?.password ?? this.database.getServerPassword(server.id) ?? undefined
    const passphrase =
      requestSecrets?.passphrase ?? this.database.getServerPassphrase(server.id) ?? undefined

    if (server.authType === 'password' && !password) {
      throw new ConnectionFailure(
        'secret_required',
        this.t('errors.passwordRequired'),
        server.id,
        'password'
      )
    }

    let privateKey: string | undefined
    if (server.authType === 'privateKey') {
      const storedPrivateKey = this.database.getServerPrivateKey(server.id)
      if (storedPrivateKey?.trim()) {
        privateKey = storedPrivateKey
      } else if (server.privateKeyPath) {
        privateKey = await fs.readFile(server.privateKeyPath, 'utf8')
      }

      if (!privateKey) {
        throw new ConnectionFailure('connection_failed', this.t('errors.privateKeyMissing'))
      }
    }

    return {
      password,
      passphrase,
      privateKey
    }
  }
}
