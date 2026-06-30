import { readFile } from 'node:fs/promises'
import type { ServerUpsertInput } from '@shared/types'
import type { DatabaseService } from '../database'
import { createLogger, createOperationContext } from '../observability'
import type { SecureStoreService } from '../secure-store'

export class ServersApplicationService {
  private readonly logger = createLogger('main')

  constructor(
    private readonly database: DatabaseService,
    _secureStore: SecureStoreService
  ) {}

  async listServers() {
    const context = createOperationContext('main', 'servers', 'list')
    this.logger.info('Listing servers', { context })
    return this.database.listServers()
  }

  async findById(id: string) {
    const context = createOperationContext('main', 'servers', 'findById', { serverId: id })
    this.logger.info('Finding server by id', { context })
    return this.database.getServerById(id)
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
      this.database.getServerPassword(id),
      this.database.getServerPassphrase(id),
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
    return (await this.listServers()).find((item) => item.id === server.id) ?? server
  }

  async update(id: string, payload: ServerUpsertInput) {
    const context = createOperationContext('main', 'servers', 'update', { serverId: id })
    this.logger.info('Updating server', { context, data: { authType: payload.authType } })
    this.database.updateServer(id, payload)
    return (await this.listServers()).find((item) => item.id === id) ?? null
  }

  async delete(id: string) {
    const context = createOperationContext('main', 'servers', 'delete', { serverId: id })
    this.logger.info('Deleting server', { context })
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
