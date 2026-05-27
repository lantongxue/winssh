import { describe, expect, it } from 'vitest'
import i18n from '@/i18n'

const requiredKeys = [
  'workbench.awayReminder.title',
  'workbench.awayReminder.description',
  'workbench.awayReminder.confirmButton',
  'workbench.awayReminder.serverIdentity',
  'workbench.awayReminder.localTerminal',
  'workbench.awayReminder.sshSession',
  'workbench.awayReminder.shellType',
  'workbench.awayReminder.timeoutSetting',
  'workbench.awayReminder.enableSetting',
  'workbench.awayReminder.timeoutDescription',
  'workbench.awayReminder.secondsUnit',
] as const

describe('workbench.awayReminder i18n keys', () => {
  it('has all required keys in en-US', async () => {
    await i18n.changeLanguage('en-US')
    for (const key of requiredKeys) {
      const value = i18n.t(key)
      expect(value, `Missing en-US key: ${key}`).not.toBe(key)
      expect(value, `Untranslated en-US key: ${key}`).toBeTruthy()
    }
  })

  it('has all required keys in zh-CN', async () => {
    await i18n.changeLanguage('zh-CN')
    for (const key of requiredKeys) {
      const value = i18n.t(key)
      expect(value, `Missing zh-CN key: ${key}`).not.toBe(key)
      expect(value, `Untranslated zh-CN key: ${key}`).toBeTruthy()
    }
  })

  it('zh-CN translations are actual Chinese, not English placeholders', async () => {
    await i18n.changeLanguage('zh-CN')
    const englishOnlyKeys = [
      'workbench.awayReminder.title',
      'workbench.awayReminder.description',
      'workbench.awayReminder.confirmButton',
      'workbench.awayReminder.enableSetting',
      'workbench.awayReminder.timeoutSetting',
      'workbench.awayReminder.timeoutDescription',
      'workbench.awayReminder.secondsUnit',
    ] as const

    const latinPattern = /^[A-Za-z\s]+$/
    for (const key of englishOnlyKeys) {
      const value = i18n.t(key)
      expect(
        latinPattern.test(value),
        `zh-CN key ${key} looks like an English placeholder: "${value}"`,
      ).toBe(false)
    }
  })
})