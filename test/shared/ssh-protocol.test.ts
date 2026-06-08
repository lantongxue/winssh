import { sshCoreInboundSchema, sshCoreOutboundSchema } from '@shared/ssh-protocol'

describe('ssh protocol schemas', () => {
  it('accepts a connect control message', () => {
    const result = sshCoreInboundSchema.parse({
      type: 'connect',
      requestId: 'req-1',
      correlationId: 'session-1',
      config: {
        sessionId: 'session-1',
        target: {
          id: 'server-1',
          name: 'Example',
          host: 'example.com',
          port: 22,
          username: 'alice',
          authType: 'password',
          auth: { password: 'secret' }
        },
        terminal: { cols: 120, rows: 34 }
      }
    })

    expect(result.type).toBe('connect')
    expect(result.config.target.host).toBe('example.com')
  })

  it('rejects a write control message without binary data', () => {
    expect(() =>
      sshCoreInboundSchema.parse({
        type: 'write',
        sessionId: 'session-1',
        correlationId: 'session-1'
      })
    ).toThrow()
  })

  it('accepts a state outbound message', () => {
    const result = sshCoreOutboundSchema.parse({
      type: 'state',
      sessionId: 'session-1',
      correlationId: 'session-1',
      phase: 'attach'
    })

    expect(result.phase).toBe('attach')
  })

  it('accepts a worker host trust request', () => {
    const result = sshCoreOutboundSchema.parse({
      type: 'hostTrust',
      requestId: 'host-1',
      sessionId: 'session-1',
      correlationId: 'session-1',
      serverName: 'Example',
      host: 'example.com',
      port: 22,
      key: new ArrayBuffer(8)
    })

    expect(result.type).toBe('hostTrust')
    expect(result.host).toBe('example.com')
  })
})
