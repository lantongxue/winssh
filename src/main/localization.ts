import type { AppLanguage } from '@shared/types'

type ResolvedMainLanguage = 'zh-CN' | 'en-US'

export type MainTranslationKey =
  | 'dialogs.pickPrivateKey.title'
  | 'dialogs.pickPrivateKey.filters.privateKey'
  | 'dialogs.pickPrivateKey.filters.allFiles'
  | 'dialogs.uploadFiles.title'
  | 'dialogs.downloadFile.title'
  | 'dialogs.hostChanged.buttons.cancel'
  | 'dialogs.hostChanged.buttons.trust'
  | 'dialogs.hostChanged.title'
  | 'dialogs.hostChanged.message'
  | 'dialogs.hostChanged.detail'
  | 'dialogs.hostFirstSeen.buttons.reject'
  | 'dialogs.hostFirstSeen.buttons.trust'
  | 'dialogs.hostFirstSeen.title'
  | 'dialogs.hostFirstSeen.message'
  | 'dialogs.hostFirstSeen.detail'
  | 'errors.serverNotFound'
  | 'errors.passwordRequired'
  | 'errors.authFailed'
  | 'errors.privateKeyMissing'
  | 'errors.connectionFailed'
  | 'errors.reconnectUnavailable'
  | 'errors.sessionUnavailable'
  | 'errors.portForwardNotFound'
  | 'session.connecting'
  | 'session.connected'
  | 'session.closed'
  | 'session.disconnected'

type MessageTree = {
  [key: string]: string | MessageTree
}

export type MainTranslator = (
  key: MainTranslationKey,
  variables?: Record<string, string | number>
) => string

const messages: Record<ResolvedMainLanguage, MessageTree> = {
  'en-US': {
    dialogs: {
      pickPrivateKey: {
        title: 'Choose SSH Private Key',
        filters: {
          privateKey: 'Private Keys',
          allFiles: 'All Files'
        }
      },
      uploadFiles: {
        title: 'Choose Files to Upload'
      },
      downloadFile: {
        title: 'Save Remote File'
      },
      hostChanged: {
        buttons: {
          cancel: 'Cancel Connection',
          trust: 'Trust New Fingerprint'
        },
        title: 'Host Fingerprint Changed',
        message: 'The host fingerprint for {{serverName}} does not match the previous record.',
        detail:
          'Old fingerprint: {{knownFingerprint}}\nNew fingerprint: {{fingerprint}}\n\nIf you cannot verify the change, cancel the connection.'
      },
      hostFirstSeen: {
        buttons: {
          reject: 'Reject',
          trust: 'Trust and Continue'
        },
        title: 'First-Time Host Connection',
        message: 'Trust the host fingerprint for {{serverName}}?',
        detail: 'Address: {{host}}:{{port}}\nFingerprint: {{fingerprint}}'
      }
    },
    errors: {
      serverNotFound: 'The selected server could not be found.',
      passwordRequired: 'No saved password is available for this server. Enter a password first.',
      authFailed: 'Authentication failed. Check the password and try again.',
      privateKeyMissing: 'This server does not have a private key file configured.',
      connectionFailed: 'Connection failed.',
      reconnectUnavailable: 'This tab does not have reusable connection parameters.',
      sessionUnavailable: 'This session does not exist or has already closed.',
      portForwardNotFound: 'The selected port forwarding rule could not be found.'
    },
    session: {
      connecting: 'Establishing connection',
      connected: 'Connection established',
      closed: 'Connection closed',
      disconnected: 'Connection lost'
    }
  },
  'zh-CN': {
    dialogs: {
      pickPrivateKey: {
        title: '选择 SSH 私钥文件',
        filters: {
          privateKey: '私钥文件',
          allFiles: '所有文件'
        }
      },
      uploadFiles: {
        title: '选择要上传的文件'
      },
      downloadFile: {
        title: '保存远程文件'
      },
      hostChanged: {
        buttons: {
          cancel: '取消连接',
          trust: '信任新指纹'
        },
        title: '主机指纹已变更',
        message: '{{serverName}} 的主机指纹与上次记录不一致',
        detail:
          '旧指纹: {{knownFingerprint}}\n新指纹: {{fingerprint}}\n\n如果你无法确认变更来源，请取消连接。'
      },
      hostFirstSeen: {
        buttons: {
          reject: '拒绝',
          trust: '信任并继续'
        },
        title: '首次连接主机',
        message: '是否信任 {{serverName}} 的主机指纹？',
        detail: '地址: {{host}}:{{port}}\n指纹: {{fingerprint}}'
      }
    },
    errors: {
      serverNotFound: '目标服务器不存在',
      passwordRequired: '该服务器未保存密码，请先输入密码后再连接',
      authFailed: '身份验证失败，请检查密码后重试',
      privateKeyMissing: '该服务器未配置私钥文件',
      connectionFailed: '连接失败',
      reconnectUnavailable: '当前标签缺少可复用的连接参数',
      sessionUnavailable: '当前会话不存在或已经关闭',
      portForwardNotFound: '目标端口转发规则不存在'
    },
    session: {
      connecting: '正在建立连接',
      connected: '连接成功',
      closed: '连接已关闭',
      disconnected: '连接已断开'
    }
  }
}

function lookupMessage(tree: MessageTree, key: MainTranslationKey): string | null {
  let current: string | MessageTree | undefined = tree

  for (const segment of key.split('.')) {
    if (!current || typeof current === 'string') {
      return null
    }

    current = current[segment]
  }

  return typeof current === 'string' ? current : null
}

function interpolate(template: string, variables?: Record<string, string | number>): string {
  if (!variables) {
    return template
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => {
    const value = variables[token]
    return value === undefined ? '' : String(value)
  })
}

export function resolveMainLanguage(
  language: AppLanguage,
  systemLocale: string
): ResolvedMainLanguage {
  if (language === 'zh-CN' || language === 'en-US') {
    return language
  }

  return systemLocale.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en-US'
}

export function createMainTranslator(getLanguage: () => ResolvedMainLanguage): MainTranslator {
  return (key, variables) => {
    const language = getLanguage()
    const template =
      lookupMessage(messages[language], key) ?? lookupMessage(messages['en-US'], key) ?? key

    return interpolate(template, variables)
  }
}
