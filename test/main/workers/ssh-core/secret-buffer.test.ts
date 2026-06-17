import { SecretBuffer } from '@main/workers/ssh-core/secret-buffer'

describe('SecretBuffer', () => {
  it('zeros stored bytes on dispose', () => {
    const secret = new SecretBuffer('hunter2')
    const buffer = secret.unwrap()

    expect(buffer.toString('utf8')).toBe('hunter2')

    secret.dispose()

    expect([...buffer]).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('throws when unwrapped after dispose', () => {
    const secret = new SecretBuffer('secret')
    secret.dispose()

    expect(() => secret.unwrap()).toThrow('SecretBuffer has been disposed')
  })
})
