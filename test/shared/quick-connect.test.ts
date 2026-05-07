import { describe, expect, it } from 'vitest'
import { parseQuickConnectInput } from '@shared/quick-connect'

describe('parseQuickConnectInput', () => {
  it('accepts the exact ssh user@host format', () => {
    expect(parseQuickConnectInput('ssh root@127.0.0.1')).toEqual({
      authType: 'password',
      host: '127.0.0.1',
      port: 22,
      username: 'root'
    })
  })

  it('rejects values that are not the supported quick-connect syntax', () => {
    expect(parseQuickConnectInput('root@127.0.0.1')).toBeNull()
    expect(parseQuickConnectInput('ssh @127.0.0.1')).toBeNull()
    expect(parseQuickConnectInput('ssh -p 2222 root@127.0.0.1')).toBeNull()
    expect(parseQuickConnectInput('ssh root@127.0.0.1:22')).toBeNull()
    expect(parseQuickConnectInput('ssh root@127.0.0.1 extra')).toBeNull()
  })
})
