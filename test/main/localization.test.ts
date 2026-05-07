import { describe, expect, it } from 'vitest'
import { createMainTranslator, resolveMainLanguage } from '@main/localization'

describe('main localization', () => {
  it('resolves system and explicit languages', () => {
    expect(resolveMainLanguage('system', 'zh-CN')).toBe('zh-CN')
    expect(resolveMainLanguage('system', 'en-US')).toBe('en-US')
    expect(resolveMainLanguage('zh-CN', 'en-US')).toBe('zh-CN')
    expect(resolveMainLanguage('en-US', 'zh-CN')).toBe('en-US')
  })

  it('translates native dialog strings and interpolates variables', () => {
    const zh = createMainTranslator(() => 'zh-CN')
    const en = createMainTranslator(() => 'en-US')

    expect(zh('dialogs.pickPrivateKey.title')).toBe('选择 SSH 私钥文件')
    expect(en('dialogs.pickPrivateKey.title')).toBe('Choose SSH Private Key')
    expect(zh('dialogs.pickServerIcon.title')).toBe('选择服务器图标')
    expect(en('dialogs.pickServerIcon.title')).toBe('Choose Server Icon')
    expect(zh('dialogs.importThemeArchive.title')).toBe('导入主题包')
    expect(en('dialogs.importThemeArchive.filters.zip')).toBe('ZIP Archives')
    expect(zh('menu.file.newConnection')).toBe('新建连接')
    expect(en('menu.view.commandPalette')).toBe('Command Palette')
    expect(
      zh('dialogs.hostFirstSeen.detail', {
        fingerprint: 'SHA256:demo',
        host: '127.0.0.1',
        port: 22
      })
    ).toContain('127.0.0.1:22')
    expect(
      en('dialogs.hostChanged.message', {
        serverName: 'prod-bastion'
      })
    ).toContain('prod-bastion')
    expect(en('errors.themePluginDeleteBuiltin')).toBe('Built-in themes cannot be deleted.')
    expect(
      zh('errors.themeBuiltinConflict', {
        value: 'winssh.dark-plus'
      })
    ).toContain('winssh.dark-plus')
  })
})
