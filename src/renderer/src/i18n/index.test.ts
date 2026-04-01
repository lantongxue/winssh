import { afterEach, describe, expect, it } from 'vitest'
import i18n from './index'

describe('i18n resources', () => {
  afterEach(async () => {
    await i18n.changeLanguage('zh-CN')
  })

  it('resolves common, workbench, and validation keys from the translation namespace', async () => {
    await i18n.changeLanguage('zh-CN')
    expect(i18n.t('common.actions.quickOpen')).toBe('快速打开')
    expect(i18n.t('workbench.settings.title')).toBe('设置编辑器')
    expect(i18n.t('validation.server.name.required')).toBe('请输入服务器名称。')

    await i18n.changeLanguage('en-US')
    expect(i18n.t('common.actions.quickOpen')).toBe('Quick Open')
    expect(i18n.t('workbench.settings.title')).toBe('Settings Editor')
    expect(i18n.t('validation.server.name.required')).toBe('Enter a server name.')
  })
})
