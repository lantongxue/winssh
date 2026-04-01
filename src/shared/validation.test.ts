import { describe, expect, it } from 'vitest'
import { portForwardSchema } from './validation'

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
