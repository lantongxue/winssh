import { describe, expect, it } from 'vitest'
import { portForwardSchema, serverSchema } from './validation'

describe('portForwardSchema', () => {
  it('accepts valid local and remote forwarding inputs', () => {
    expect(
      portForwardSchema.parse({
        kind: 'local',
        bindHost: '127.0.0.1',
        bindPort: 15432,
        targetHost: 'db.internal',
        targetPort: 5432
      })
    ).toMatchObject({
      kind: 'local',
      bindPort: 15432,
      targetPort: 5432
    })

    expect(
      portForwardSchema.parse({
        kind: 'remote',
        bindHost: '0.0.0.0',
        bindPort: 8080,
        targetHost: '127.0.0.1',
        targetPort: 3000
      })
    ).toMatchObject({
      kind: 'remote',
      bindPort: 8080,
      targetPort: 3000
    })
  })

  it('rejects empty hosts, out-of-range ports, and invalid kinds', () => {
    expect(
      portForwardSchema.safeParse({
        kind: 'local',
        bindHost: '',
        bindPort: 15432,
        targetHost: '127.0.0.1',
        targetPort: 5432
      }).success
    ).toBe(false)

    expect(
      portForwardSchema.safeParse({
        kind: 'remote',
        bindHost: '127.0.0.1',
        bindPort: 0,
        targetHost: '127.0.0.1',
        targetPort: 5432
      }).success
    ).toBe(false)

    expect(
      portForwardSchema.safeParse({
        kind: 'remote',
        bindHost: '127.0.0.1',
        bindPort: 65536,
        targetHost: '127.0.0.1',
        targetPort: 5432
      }).success
    ).toBe(false)

    expect(
      portForwardSchema.safeParse({
        kind: 'dynamic',
        bindHost: '127.0.0.1',
        bindPort: 1080,
        targetHost: '127.0.0.1',
        targetPort: 80
      }).success
    ).toBe(false)
  })
})

describe('serverSchema', () => {
  it('accepts null private keys for password-based servers', () => {
    expect(
      serverSchema.parse({
        authType: 'password',
        favorite: false,
        groupId: null,
        host: '10.0.0.8',
        jumpServerId: null,
        name: 'Production Bastion',
        note: '',
        port: 22,
        privateKey: null,
        rememberPassphrase: false,
        rememberPassword: true,
        tagIds: [],
        username: 'root'
      })
    ).toMatchObject({
      authType: 'password',
      privateKey: null
    })
  })

  it('allows credential-backed private key servers to omit inline private key content', () => {
    expect(
      serverSchema.parse({
        authType: 'privateKey',
        credentialId: 'credential-1',
        favorite: false,
        groupId: null,
        host: '10.0.0.9',
        jumpServerId: null,
        name: 'Vault Host',
        note: '',
        port: 22,
        privateKey: null,
        rememberPassphrase: false,
        rememberPassword: false,
        tagIds: [],
        username: 'deploy'
      })
    ).toMatchObject({
      authType: 'privateKey',
      credentialId: 'credential-1',
      privateKey: null
    })
  })

  it('still requires a private key when private key auth has no credential reference', () => {
    expect(
      serverSchema.safeParse({
        authType: 'privateKey',
        favorite: false,
        groupId: null,
        host: '10.0.0.10',
        jumpServerId: null,
        name: 'Key Host',
        note: '',
        port: 22,
        privateKey: null,
        rememberPassphrase: false,
        rememberPassword: false,
        tagIds: [],
        username: 'deploy'
      }).success
    ).toBe(false)
  })

  it('rejects selecting the current server as its own jump server', () => {
    expect(
      serverSchema.safeParse({
        authType: 'password',
        favorite: false,
        groupId: null,
        host: '10.0.0.11',
        id: 'server-1',
        jumpServerId: 'server-1',
        name: 'Loop Host',
        note: '',
        port: 22,
        privateKey: null,
        rememberPassphrase: false,
        rememberPassword: true,
        tagIds: [],
        username: 'root'
      }).success
    ).toBe(false)
  })
})
