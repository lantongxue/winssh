import keytar from 'keytar'
import { SECURE_STORE_SERVICE } from '@shared/constants'
import type { SecretKind } from '@shared/types'

function toAccount(serverId: string, kind: SecretKind): string {
  return `${serverId}:${kind}`
}

export class SecureStoreService {
  private capability: boolean | null = null

  async isAvailable(): Promise<boolean> {
    if (this.capability !== null) {
      return this.capability
    }

    try {
      await keytar.findCredentials(SECURE_STORE_SERVICE)
      this.capability = true
    } catch {
      this.capability = false
    }

    return this.capability
  }

  async getSecret(serverId: string, kind: SecretKind): Promise<string | null> {
    if (!(await this.isAvailable())) {
      return null
    }

    try {
      return await keytar.getPassword(SECURE_STORE_SERVICE, toAccount(serverId, kind))
    } catch {
      return null
    }
  }

  async setSecret(serverId: string, kind: SecretKind, value: string): Promise<boolean> {
    if (!(await this.isAvailable()) || !value) {
      return false
    }

    try {
      await keytar.setPassword(SECURE_STORE_SERVICE, toAccount(serverId, kind), value)
      return true
    } catch {
      return false
    }
  }

  async deleteSecret(serverId: string, kind: SecretKind): Promise<void> {
    if (!(await this.isAvailable())) {
      return
    }

    try {
      await keytar.deletePassword(SECURE_STORE_SERVICE, toAccount(serverId, kind))
    } catch {
      // Ignore keychain failures and keep the rest of the app functional.
    }
  }

  async listStatuses(
    serverIds: string[]
  ): Promise<Map<string, { hasPassword: boolean; hasPassphrase: boolean }>> {
    const statuses = new Map<string, { hasPassword: boolean; hasPassphrase: boolean }>()
    if (!(await this.isAvailable())) {
      return statuses
    }

    try {
      const credentials = await keytar.findCredentials(SECURE_STORE_SERVICE)
      const serverIdSet = new Set(serverIds)
      for (const credential of credentials) {
        const [serverId, kind] = credential.account.split(':')
        if (!serverIdSet.has(serverId)) {
          continue
        }

        const current = statuses.get(serverId) ?? { hasPassword: false, hasPassphrase: false }
        if (kind === 'password') {
          current.hasPassword = true
        }
        if (kind === 'passphrase') {
          current.hasPassphrase = true
        }
        statuses.set(serverId, current)
      }
    } catch {
      return statuses
    }

    return statuses
  }
}
