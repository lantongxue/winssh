import type { AppLanguage } from '@shared/types'

type ResolvedMainLanguage = 'zh-CN' | 'en-US'

export type MainTranslationKey =
  | 'dialogs.pickPrivateKey.title'
  | 'dialogs.pickPrivateKey.filters.privateKey'
  | 'dialogs.pickPrivateKey.filters.allFiles'
  | 'dialogs.pickServerIcon.title'
  | 'dialogs.pickServerIcon.filters.images'
  | 'dialogs.pickServerIcon.filters.allFiles'
  | 'dialogs.importThemeArchive.title'
  | 'dialogs.importThemeArchive.filters.zip'
  | 'dialogs.importThemeArchive.filters.allFiles'
  | 'dialogs.uploadFiles.title'
  | 'dialogs.downloadFile.title'
  | 'errors.serverNotFound'
  | 'errors.passwordRequired'
  | 'errors.authFailed'
  | 'errors.privateKeyMissing'
  | 'errors.jumpServerNotFound'
  | 'errors.jumpServerChainUnsupported'
  | 'errors.connectionFailed'
  | 'errors.reconnectUnavailable'
  | 'errors.sessionUnavailable'
  | 'errors.portForwardNotFound'
  | 'errors.themeImportFailed'
  | 'errors.themeArchiveLayoutInvalid'
  | 'errors.themeBuiltinConflict'
  | 'errors.themePluginDeleteBuiltin'
  | 'errors.themePluginNotFound'
  | 'menu.app.about'
  | 'menu.app.checkForUpdates'
  | 'menu.app.hide'
  | 'menu.app.hideOthers'
  | 'menu.app.quit'
  | 'menu.app.services'
  | 'menu.app.settings'
  | 'menu.app.showAll'
  | 'menu.edit.copy'
  | 'menu.edit.cut'
  | 'menu.edit.paste'
  | 'menu.edit.redo'
  | 'menu.edit.selectAll'
  | 'menu.edit.title'
  | 'menu.edit.undo'
  | 'menu.file.closeTab'
  | 'menu.file.newConnection'
  | 'menu.file.openLocalTerminal'
  | 'menu.file.quickConnect'
  | 'menu.file.save'
  | 'menu.file.title'
  | 'menu.help.title'
  | 'menu.view.actualSize'
  | 'menu.view.commandPalette'
  | 'menu.view.forceReload'
  | 'menu.view.reload'
  | 'menu.view.title'
  | 'menu.view.toggleDeveloperTools'
  | 'menu.view.toggleFullScreen'
  | 'menu.view.togglePanel'
  | 'menu.view.toggleSidebar'
  | 'menu.view.zoomIn'
  | 'menu.view.zoomOut'
  | 'menu.window.bringAllToFront'
  | 'menu.window.minimize'
  | 'menu.window.title'
  | 'menu.window.zoom'
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
      pickServerIcon: {
        title: 'Choose Server Icon',
        filters: {
          images: 'Images',
          allFiles: 'All Files'
        }
      },
      importThemeArchive: {
        title: 'Import Theme Pack',
        filters: {
          zip: 'ZIP Archives',
          allFiles: 'All Files'
        }
      },
uploadFiles: {
        title: 'Choose Files to Upload'
      },
      downloadFile: {
        title: 'Save Remote File'
      }
    },
    errors: {
      serverNotFound: 'The selected server could not be found.',
      passwordRequired: 'No saved password is available for this server. Enter a password first.',
      authFailed: 'Authentication failed. Check the password and try again.',
      privateKeyMissing: 'This server does not have a private key configured.',
      jumpServerNotFound: 'The selected jump server could not be found.',
      jumpServerChainUnsupported: 'Only one jump server hop is supported right now.',
      connectionFailed: 'Connection failed.',
      reconnectUnavailable: 'This tab does not have reusable connection parameters.',
      sessionUnavailable: 'This session does not exist or has already closed.',
      portForwardNotFound: 'The selected port forwarding rule could not be found.',
      themeImportFailed: 'The selected ZIP file is not a valid WinSSH theme pack.',
      themeArchiveLayoutInvalid:
        'The ZIP file must contain a WinSSH theme plugin folder with a package.json manifest.',
      themeBuiltinConflict:
        'The imported theme pack conflicts with the built-in theme "{{value}}" and cannot be installed.',
      themePluginDeleteBuiltin: 'Built-in themes cannot be deleted.',
      themePluginNotFound: 'The selected theme pack could not be found.'
    },
    menu: {
      app: {
        about: 'About {{appName}}',
        checkForUpdates: 'Check for Updates...',
        hide: 'Hide {{appName}}',
        hideOthers: 'Hide Others',
        quit: 'Quit {{appName}}',
        services: 'Services',
        settings: 'Settings...',
        showAll: 'Show All'
      },
      edit: {
        copy: 'Copy',
        cut: 'Cut',
        paste: 'Paste',
        redo: 'Redo',
        selectAll: 'Select All',
        title: 'Edit',
        undo: 'Undo'
      },
      file: {
        closeTab: 'Close Tab',
        newConnection: 'New Connection',
        openLocalTerminal: 'Open Local Terminal',
        quickConnect: 'Quick Connect',
        save: 'Save',
        title: 'File'
      },
      help: {
        title: 'Help'
      },
      view: {
        actualSize: 'Actual Size',
        commandPalette: 'Command Palette',
        forceReload: 'Force Reload',
        reload: 'Reload',
        title: 'View',
        toggleDeveloperTools: 'Toggle Developer Tools',
        toggleFullScreen: 'Toggle Full Screen',
        togglePanel: 'Toggle Panel',
        toggleSidebar: 'Toggle Sidebar',
        zoomIn: 'Zoom In',
        zoomOut: 'Zoom Out'
      },
      window: {
        bringAllToFront: 'Bring All to Front',
        minimize: 'Minimize',
        title: 'Window',
        zoom: 'Zoom'
      }
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
      pickServerIcon: {
        title: '选择服务器图标',
        filters: {
          images: '图片文件',
          allFiles: '所有文件'
        }
      },
      importThemeArchive: {
        title: '导入主题包',
        filters: {
          zip: 'ZIP 压缩包',
          allFiles: '所有文件'
        }
      },
      uploadFiles: {
        title: '选择要上传的文件'
      },
downloadFile: {
        title: '保存远程文件'
      }
    },
    errors: {
      serverNotFound: '目标服务器不存在',
      passwordRequired: '该服务器未保存密码，请先输入密码后再连接',
      authFailed: '身份验证失败，请检查密码后重试',
      privateKeyMissing: '该服务器未配置私钥',
      jumpServerNotFound: '所选 jumpserver 不存在',
      jumpServerChainUnsupported: '当前只支持单跳 jumpserver',
      connectionFailed: '连接失败',
      reconnectUnavailable: '当前标签缺少可复用的连接参数',
      sessionUnavailable: '当前会话不存在或已经关闭',
      portForwardNotFound: '目标端口转发规则不存在',
      themeImportFailed: '所选 ZIP 文件不是有效的 WinSSH 主题包',
      themeArchiveLayoutInvalid: 'ZIP 文件中必须包含带有 package.json 的 WinSSH 主题插件目录',
      themeBuiltinConflict: '导入的主题包与内置主题 "{{value}}" 冲突，无法安装',
      themePluginDeleteBuiltin: '内置主题不能删除',
      themePluginNotFound: '找不到所选主题包'
    },
    menu: {
      app: {
        about: '关于 {{appName}}',
        checkForUpdates: '检查更新...',
        hide: '隐藏 {{appName}}',
        hideOthers: '隐藏其他',
        quit: '退出 {{appName}}',
        services: '服务',
        settings: '设置...',
        showAll: '全部显示'
      },
      edit: {
        copy: '复制',
        cut: '剪切',
        paste: '粘贴',
        redo: '重做',
        selectAll: '全选',
        title: '编辑',
        undo: '撤销'
      },
      file: {
        closeTab: '关闭标签',
        newConnection: '新建连接',
        openLocalTerminal: '打开本地终端',
        quickConnect: '快速连接',
        save: '保存',
        title: '文件'
      },
      help: {
        title: '帮助'
      },
      view: {
        actualSize: '实际大小',
        commandPalette: '命令面板',
        forceReload: '强制重新载入',
        reload: '重新载入',
        title: '显示',
        toggleDeveloperTools: '切换开发者工具',
        toggleFullScreen: '切换全屏',
        togglePanel: '切换底部面板',
        toggleSidebar: '切换侧栏',
        zoomIn: '放大',
        zoomOut: '缩小'
      },
      window: {
        bringAllToFront: '前置全部窗口',
        minimize: '最小化',
        title: '窗口',
        zoom: '缩放'
      }
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
