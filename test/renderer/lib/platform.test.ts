import { describe, expect, it } from 'vitest'
import { isWindowsPlatform } from '@/lib/platform'

describe('isWindowsPlatform', () => {
  it.each(['win32', 'Win32', 'Windows', 'Win64'])('detects %s as Windows', (platform) => {
    expect(isWindowsPlatform(platform.toLowerCase())).toBe(true)
  })

  it.each(['darwin', 'macintel', 'linux x86_64'])('does not detect %s as Windows', (platform) => {
    expect(isWindowsPlatform(platform)).toBe(false)
  })
})
