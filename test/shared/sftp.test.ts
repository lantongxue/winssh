import { describe, expect, it } from 'vitest'
import {
  getParentRemotePath,
  joinRemotePath,
  normalizeRemotePath,
  sortRemoteEntries
} from '@shared/sftp'

describe('sftp path helpers', () => {
  it('normalizes empty and nested paths', () => {
    expect(normalizeRemotePath('')).toBe('/')
    expect(normalizeRemotePath('/etc/../var/log')).toBe('/var/log')
    expect(normalizeRemotePath('home/admin')).toBe('/home/admin')
  })

  it('joins and resolves parent paths', () => {
    expect(joinRemotePath('/srv', 'app')).toBe('/srv/app')
    expect(getParentRemotePath('/srv/app')).toBe('/srv')
    expect(getParentRemotePath('/')).toBe('/')
  })

  it('sorts directories before files', () => {
    const entries = sortRemoteEntries([
      { kind: 'file', name: 'b.txt' },
      { kind: 'directory', name: 'zeta' },
      { kind: 'file', name: 'a.txt' }
    ])

    expect(entries.map((entry) => entry.name)).toEqual(['zeta', 'a.txt', 'b.txt'])
  })
})
