import { readFile } from 'node:fs/promises'
import type { ServerUpsertInput } from '@shared/types'
import type { DatabaseService } from '../database'
import { createLogger, createOperationContext, toAppError } from '../observability'
import type { SecureStoreService } from '../secure-store'

export class ServersApplicationService {
  private readonly logger = createLogger('main')

  constructor(
    private readonly database: DatabaseService,
    private readonly secureStore: SecureStoreService
  ) {}

  async listServers() {
    const context = createOperationContext('main', 'servers', 'list')
    this.logger.info('Listing servers', { context })
    const servers = this.database.listServers()
    const statuses = await this.secureStore.listStatuses(servers.map((server) => server.id))

    return servers.map((server) => {
      const status = statuses.get(server.id)
      return {
        ...server,
        hasPassword: status?.hasPassword ?? false,
        hasPassphrase: status?.hasPassphrase ?? false
      }
    })
  }

  async getSecrets(id: string) {
    const context = createOperationContext('main', 'servers', 'getSecrets', {
      serverId: id
    })
    this.logger.info('Resolving server secrets', { context })
    const server = this.database.getServerById(id)
    if (!server) {
      return {
        password: null,
        passphrase: null,
        privateKey: null
      }
    }

    if (server.credentialId) {
      const credentialSecret = this.database.getCredentialSecret(server.credentialId)
      if (credentialSecret) {
        return {
          password: credentialSecret.password,
          passphrase: credentialSecret.passphrase,
          privateKey: credentialSecret.privateKey
        }
      }
    }

    const [password, passphrase, privateKey] = await Promise.all([
      this.secureStore.getSecret(id, 'password'),
      this.secureStore.getSecret(id, 'passphrase'),
      this.resolveStoredPrivateKey(id)
    ])

    return {
      password,
      passphrase,
      privateKey
    }
  }

  async create(payload: ServerUpsertInput) {
    const context = createOperationContext('main', 'servers', 'create')
    this.logger.info('Creating server', { context, data: { authType: payload.authType } })
    const server = this.database.createServer(payload)
    await this.persistSecrets(server.id, payload)
    return (await this.listServers()).find((item) => item.id === server.id) ?? server
  }

  async update(id: string, payload: ServerUpsertInput) {
    const context = createOperationContext('main', 'servers', 'update', { serverId: id })
    this.logger.info('Updating server', { context, data: { authType: payload.authType } })
    const server = this.database.updateServer(id, payload)
    await this.persistSecrets(server.id, payload)
    return (await this.listServers()).find((item) => item.id === server.id) ?? server
  }

  async delete(id: string) {
    const context = createOperationContext('main', 'servers', 'delete', { serverId: id })
    this.logger.info('Deleting server', { context })
    await this.secureStore.deleteSecret(id, 'password')
    await this.secureStore.deleteSecret(id, 'passphrase')
    this.database.deleteServer(id)
  }

  async toggleFavorite(id: string) {
    const context = createOperationContext('main', 'servers', 'toggleFavorite', {
      serverId: id
    })
    this.logger.info('Toggling server favorite', { context })
    this.database.toggleFavorite(id)
    return (await this.listServers()).find((item) => item.id === id) ?? null
  }

  listRecentSessions() {
    return this.database.listRecentSessions()
  }

  clearRecentSessions() {
    this.database.clearRecentSessions()
  }

  private async persistSecrets(serverId: string, payload: ServerUpsertInput) {
    try {
      if (payload.authType === 'password') {
        if (!payload.rememberPassword) {
          await this.secureStore.deleteSecret(serverId, 'password')
        } else if (payload.password) {
          await this.secureStore.setSecret(serverId, 'password', payload.password)
        }

        await this.secureStore.deleteSecret(serverId, 'passphrase')
      }

      if (payload.authType === 'privateKey') {
        if (!payload.rememberPassphrase) {
          await this.secureStore.deleteSecret(serverId, 'passphrase')
        } else if (payload.passphrase) {
          await this.secureStore.setSecret(serverId, 'passphrase', payload.passphrase)
        }

        await this.secureStore.deleteSecret(serverId, 'password')
      }
    } catch (error) {
      throw toAppError(error, {
        code: 'server_secret_persist_failed',
        details: { serverId },
        recoverable: false
      })
    }
  }

  private async resolveStoredPrivateKey(id: string) {
    const server = this.database.getServerById(id)
    if (!server) {
      return null
    }

    if (server.credentialId) {
      const secret = this.database.getCredentialSecret(server.credentialId)
      if (secret?.privateKey?.trim()) {
        return secret.privateKey
      }
    }

    const storedPrivateKey = this.database.getServerPrivateKey(id)
    if (storedPrivateKey?.trim()) {
      return storedPrivateKey
    }

    if (!server.privateKeyPath) {
      return null
    }

    try {
      return await readFile(server.privateKeyPath, 'utf8')
    } catch {
      return null
    }
  }
}
