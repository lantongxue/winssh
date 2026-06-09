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

  it('accepts command history mode on connect control messages', () => {
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
        commandHistory: true,
        terminal: { cols: 120, rows: 34 }
      }
    })

    expect(result.config.commandHistory).toBe(true)
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

  it('accepts sftp file stream control messages', () => {
    expect(
      sshCoreInboundSchema.parse({
        type: 'sftp:openFileReadStream',
        requestId: 'req-read',
        sessionId: 'session-1',
        correlationId: 'session-1',
        remotePath: '/etc/app.conf'
      }).type
    ).toBe('sftp:openFileReadStream')

    expect(
      sshCoreInboundSchema.parse({
        type: 'sftp:openFileWriteStream',
        requestId: 'req-open-write',
        sessionId: 'session-1',
        correlationId: 'session-1',
        remotePath: '/etc/app.conf',
        encoding: 'utf8'
      }).type
    ).toBe('sftp:openFileWriteStream')

    expect(
      sshCoreInboundSchema.parse({
        type: 'sftp:writeFileChunk',
        requestId: 'req-chunk',
        streamId: 'worker-write-1',
        chunk: 'alpha'
      }).type
    ).toBe('sftp:writeFileChunk')

    expect(
      sshCoreInboundSchema.parse({
        type: 'sftp:closeFileWriteStream',
        requestId: 'req-close',
        streamId: 'worker-write-1'
      }).type
    ).toBe('sftp:closeFileWriteStream')

    expect(
      sshCoreInboundSchema.parse({
        type: 'sftp:cancelFileStream',
        requestId: 'req-cancel',
        streamId: 'worker-write-1'
      }).type
    ).toBe('sftp:cancelFileStream')
  })

  it('accepts retained sftp directory and file operation messages', () => {
    expect(
      sshCoreInboundSchema.parse({
        type: 'sftp:listDirectory',
        requestId: 'req-list',
        sessionId: 'session-1',
        correlationId: 'session-1',
        remotePath: '/etc'
      }).type
    ).toBe('sftp:listDirectory')

    expect(
      sshCoreInboundSchema.parse({
        type: 'sftp:createFile',
        requestId: 'req-create',
        sessionId: 'session-1',
        correlationId: 'session-1',
        remotePath: '/etc/app.conf'
      }).type
    ).toBe('sftp:createFile')

    expect(
      sshCoreInboundSchema.parse({
        type: 'sftp:makeDirectory',
        requestId: 'req-mkdir',
        sessionId: 'session-1',
        correlationId: 'session-1',
        remotePath: '/etc/app.d'
      }).type
    ).toBe('sftp:makeDirectory')

    expect(
      sshCoreInboundSchema.parse({
        type: 'sftp:rename',
        requestId: 'req-rename',
        sessionId: 'session-1',
        correlationId: 'session-1',
        sourcePath: '/etc/app.conf',
        targetPath: '/etc/app.conf.bak'
      }).type
    ).toBe('sftp:rename')

    expect(
      sshCoreInboundSchema.parse({
        type: 'sftp:remove',
        requestId: 'req-remove',
        sessionId: 'session-1',
        correlationId: 'session-1',
        remotePath: '/etc/app.conf.bak'
      }).type
    ).toBe('sftp:remove')
  })

  it('rejects legacy sftp whole-file editor messages', () => {
    expect(() =>
      sshCoreInboundSchema.parse({
        type: 'sftp:readFile',
        requestId: 'req-read',
        sessionId: 'session-1',
        correlationId: 'session-1',
        remotePath: '/etc/app.conf'
      })
    ).toThrow()

    expect(() =>
      sshCoreInboundSchema.parse({
        type: 'sftp:writeFile',
        requestId: 'req-write',
        sessionId: 'session-1',
        correlationId: 'session-1',
        remotePath: '/etc/app.conf',
        contents: 'alpha',
        encoding: 'utf8'
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

  it('accepts a shell integration install outbound message', () => {
    const result = sshCoreOutboundSchema.parse({
      type: 'shellIntegrationInstall',
      sessionId: 'session-1',
      correlationId: 'session-1'
    })

    expect(result.type).toBe('shellIntegrationInstall')
  })

  it('accepts sftp file stream outbound messages', () => {
    expect(
      sshCoreOutboundSchema.parse({
        type: 'sftp:fileChunk',
        streamId: 'worker-read-1',
        sessionId: 'session-1',
        correlationId: 'session-1',
        remotePath: '/etc/app.conf',
        chunk: 'alpha',
        transferred: 5,
        total: 11
      }).type
    ).toBe('sftp:fileChunk')

    expect(
      sshCoreOutboundSchema.parse({
        type: 'sftp:fileStreamState',
        streamId: 'worker-read-1',
        sessionId: 'session-1',
        correlationId: 'session-1',
        remotePath: '/etc/app.conf',
        direction: 'download',
        status: 'completed',
        transferred: 11,
        total: 11
      }).type
    ).toBe('sftp:fileStreamState')
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
