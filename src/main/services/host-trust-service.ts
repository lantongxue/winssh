import { createHash, randomUUID } from 'node:crypto'
import type { BrowserWindow } from 'electron'
import type { HostTrustRequest, HostTrustResult } from '@shared/types'
import type { DatabaseService } from '../database'
import { createHostTrustRequest } from '../workers/host-trust'

type WindowProvider = () => BrowserWindow | null

export interface HostTrustVerificationInput {
  serverName: string
  host: string
  port: number
  key: Buffer
}

export interface HostTrustServiceOptions {
  database: Pick<DatabaseService, 'getKnownHost' | 'upsertKnownHost'>
  getWindow: WindowProvider
}

export function toFingerprint(key: Buffer): string {
  return `SHA256:${createHash('sha256').update(key).digest('base64')}`
}

export class HostTrustService {
  private readonly resolvers = new Map<string, (result: boolean) => void>()

  constructor(private readonly options: HostTrustServiceOptions) {}

  async verifyHost(input: HostTrustVerificationInput): Promise<boolean> {
    const fingerprint = toFingerprint(input.key)
    const known = this.options.database.getKnownHost(input.host, input.port)

    if (known?.fingerprint === fingerprint) {
      return true
    }

    const window = this.options.getWindow()
    if (!window) {
      return false
    }

    const requestId = randomUUID()
    const request: HostTrustRequest = createHostTrustRequest({
      requestId,
      serverName: input.serverName,
      host: input.host,
      port: input.port,
      fingerprint,
      knownFingerprint: known?.fingerprint
    })

    const trusted = await new Promise<boolean>((resolve) => {
      this.resolvers.set(requestId, resolve)
      window.webContents.send('system:hostTrustRequest', request)
    })

    if (!trusted) {
      return false
    }

    this.options.database.upsertKnownHost({
      host: input.host,
      port: input.port,
      algorithm: 'sha256',
      fingerprint,
      verifiedAt: new Date().toISOString()
    })

    return true
  }

  resolveHostTrust(result: HostTrustResult): void {
    const resolver = this.resolvers.get(result.requestId)
    if (resolver) {
      this.resolvers.delete(result.requestId)
      resolver(result.trusted)
    }
  }
}
