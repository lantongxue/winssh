import { HostTrustService } from '@main/services/host-trust-service'
import type { DatabaseService } from '@main/database'

describe('HostTrustService', () => {
  it('trusts a host when the stored fingerprint matches', async () => {
    const database = {
      getKnownHost: vi.fn(() => ({
        fingerprint: 'SHA256:CfEOS9w3pHE4KlqjcQFwWyWMmyRvvPoehydyMhTxpzg='
      }))
    } as unknown as DatabaseService
    const service = new HostTrustService({
      database,
      getWindow: () => null
    })

    await expect(
      service.verifyHost({
        serverName: 'alpha',
        host: 'example.com',
        port: 22,
        key: Buffer.from('host-key')
      })
    ).resolves.toBe(true)
  })

  it('prompts for unknown hosts and stores trusted fingerprints', async () => {
    const send = vi.fn()
    const database = {
      getKnownHost: vi.fn(() => null),
      upsertKnownHost: vi.fn()
    } as unknown as DatabaseService
    const service = new HostTrustService({
      database,
      getWindow: () => ({ webContents: { send } }) as never
    })

    const promise = service.verifyHost({
      serverName: 'alpha',
      host: 'example.com',
      port: 22,
      key: Buffer.from('host-key')
    })
    const request = send.mock.calls[0]?.[1]

    service.resolveHostTrust({ requestId: request.requestId, trusted: true })

    await expect(promise).resolves.toBe(true)
    expect(send).toHaveBeenCalledWith(
      'system:hostTrustRequest',
      expect.objectContaining({ host: 'example.com', kind: 'hostFirstSeen' })
    )
    expect(database.upsertKnownHost).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'example.com', port: 22 })
    )
  })
})
