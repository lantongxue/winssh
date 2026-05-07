import { afterEach, describe, expect, it } from 'vitest'
import i18n from '@/i18n'
import { formatFileSize } from '@/i18n/format'

describe('formatFileSize', () => {
  afterEach(async () => {
    await i18n.changeLanguage('zh-CN')
  })

  it('formats byte sizes with readable units', async () => {
    await i18n.changeLanguage('en-US')
    expect(formatFileSize(0)).toBe('0 B')
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(1024)).toBe('1.00 KB')
    expect(formatFileSize(1536)).toBe('1.50 KB')
    expect(formatFileSize(1557)).toBe('1.52 KB')
  })

  it('uses the active locale for number formatting', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(formatFileSize(10 * 1024)).toBe('10.00 KB')
    expect(formatFileSize(1536)).toBe('1.50 KB')
  })
})
