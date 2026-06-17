import { createHostTrustRequest } from '@main/workers/host-trust'

describe('host trust worker', () => {
  it('creates a renderer-safe trust request', () => {
    const request = createHostTrustRequest({
      sessionId: 'session-1',
      host: 'example.com',
      port: 22,
      fingerprint: 'SHA256:abc'
    })

    expect(request).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        host: 'example.com',
        port: 22,
        fingerprint: 'SHA256:abc'
      })
    )
  })
})
