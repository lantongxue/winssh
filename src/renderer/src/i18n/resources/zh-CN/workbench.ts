const workbench = {
  workbench: {
    activity: {
      explorer: {
        description: '浏览已保存的主机、分组、标签和最近连接。',
        title: '资源管理器'
      },
      settings: {
        description: '调整界面、终端行为和信任设置。',
        title: '设置'
      },
      terminal: {
        description: '查看活动 SSH 会话和远程文件系统。',
        title: '终端'
      }
    },
    commandCenter: {
      commandPalette: {
        description: '搜索并执行 WinSSH 命令',
        empty: '没有匹配的命令。',
        groups: {
          currentServer: '当前服务器',
          currentSession: '当前会话',
          layout: '布局',
          theme: '主题',
          workbench: '工作台'
        },
        placeholder: '输入命令',
        title: '命令面板'
      },
      quickOpen: {
        actions: {
          connectTo: '连接到 {{target}}'
        },
        description: '快速连接到服务器，或跳转到会话和设置编辑器',
        empty: '没有匹配的项目。',
        groups: {
          connections: '连接',
          quickConnect: '快速连接',
          sessions: '会话',
          workbench: '工作台'
        },
        placeholder: '输入 ssh user@host，或跳转到连接和会话',
        title: '快速连接'
      }
    },
    documents: {
      serverEditor: {
        newConnection: '未命名连接'
      },
      settings: '设置',
      terminal: '终端',
      terminalWelcome: '终端'
    },
    editorTabs: {
      actions: {
        cloneSession: '会话克隆',
        closeTab: '关闭标签',
        renameTab: '重命名标签'
      },
      dialogs: {
        renameSession: {
          description: '为“{{name}}”设置一个临时标签名，仅当前标签生效，不会持久化保存。',
          placeholder: '请输入标签名称',
          title: '重命名标签'
        }
      }
    },
    explorerHome: {
      actions: {
        clearRecent: '清除',
        focusExplorer: '返回资源管理器',
        focusTerminal: '聚焦终端'
      },
      empty: {
        favorites: '还没有收藏连接。',
        recent: '最近没有连接记录。'
      },
      overview: {
        activeSessions: '活动会话',
        recentConnections: '最近连接',
        savedConnections: '保存的连接',
        title: '工作区概览'
      },
      quickLinks: {
        title: '快捷入口'
      },
      recent: {
        title: '最近连接'
      },
      subtitle: '通过资源管理器、编辑器标签和集成终端管理所有 SSH 工作流。',
      title: 'WinSSH 工作台',
      favorites: {
        title: '收藏连接'
      },
      toasts: {
        recentCleared: '最近连接已清除。'
      }
    },
    panel: {
      clearProblems: '清除问题',
      clearTransfers: '清除传输记录',
      empty: {
        output: '连接日志和工作台输出会显示在这里。',
        problems: '当前没有工作台级问题。',
        transfers: '暂无传输任务。'
      },
      labels: {
        output: '输出',
        problems: '问题',
        transfers: '传输'
      },
      severities: {
        error: '错误',
        warning: '警告'
      },
      transfer: {
        completed: '已完成',
        download: '下载',
        error: '失败',
        running: '进行中',
        unknown: '未知',
        upload: '上传'
      }
    },
    primarySidebar: {
      actions: {
        addToFavorites: '加入收藏',
        clearRecent: '清除最近连接',
        connect: '连接',
        createGroup: '新建分组',
        createTag: '新建标签',
        edit: '编辑',
        removeFromFavorites: '取消收藏',
        rename: '重命名'
      },
      description: '单击打开编辑器，双击建立 SSH 会话。',
      dialogs: {
        deleteServer: {
          description:
            '将永久删除“{{name}}”的服务器配置，以及已保存的密码或私钥口令。此操作无法撤销。',
          title: '删除服务器'
        }
      },
      sections: {
        allServers: '全部服务器',
        favorites: '收藏',
        groups: '分组',
        recent: '最近',
        tags: '标签'
      },
      title: '资源管理器',
      toasts: {
        groupDeleted: '分组已删除。',
        recentCleared: '最近连接已清除。',
        serverDeleteFailed: '删除服务器失败。',
        tagDeleted: '标签已删除。'
      }
    },
    quickInput: {
      credentials: {
        descriptions: {
          passphrase: '如私钥存在口令，请输入后继续连接 {{name}}。',
          password: '继续连接 {{name}} 需要输入密码。'
        },
        emptyPassword: '密码不能为空。',
        keychainDescription: '后续连接可直接复用。',
        keychainTitle: '写入系统钥匙串',
        placeholder: {
          passphrase: '可选，留空表示无口令',
          password: '请输入服务器密码'
        },
        secretLabel: '凭据',
        titles: {
          passphrase: '输入私钥口令',
          password: '输入连接密码'
        }
      },
      entity: {
        descriptions: {
          create: '使用轻量输入流快速维护资源管理器中的组织结构。',
          rename: '使用轻量输入流快速维护资源管理器中的组织结构。'
        },
        placeholders: {
          group: 'Production',
          tag: 'MySQL'
        },
        titles: {
          createGroup: '新建分组',
          createTag: '新建标签',
          renameGroup: '重命名分组',
          renameTag: '重命名标签'
        }
      },
      toasts: {
        groupCreated: '分组已创建。',
        groupUpdated: '分组已更新。',
        saveFailed: '保存失败。',
        tagCreated: '标签已创建。',
        tagUpdated: '标签已更新。'
      }
    },
    serverEditor: {
      actions: {
        hideSecret: '隐藏凭据',
        showSecret: '显示凭据'
      },
      auth: {
        password: '密码认证',
        privateKey: '私钥认证'
      },
      descriptions: {
        existing: '{{username}}@{{host}}:{{port}}',
        new: '新的 SSH 连接'
      },
      empty: {
        tags: '还没有标签，可在资源管理器中创建。'
      },
      fields: {
        authType: '认证方式',
        connectNote: '连接说明',
        credential: '引用凭据',
        credentials: '凭据策略',
        favoriteDescription: '收藏后会在资源管理器中优先展示。',
        favoriteTitle: '收藏该服务器',
        group: '分组',
        host: '主机地址',
        name: '名称',
        note: '备注',
        password: '密码',
        passphrase: '私钥口令',
        port: '端口',
        privateKeyFile: '私钥内容',
        rememberPassphrase: '记住口令',
        rememberPassword: '记住密码',
        tags: '标签',
        username: '用户名'
      },
      placeholders: {
        credential: '选择已有凭据（可选）',
        host: '192.168.1.10 或 demo.example.com',
        name: 'Production Bastion',
        note: '记录环境说明、跳板关系或维护信息。',
        privateKeyFile: '粘贴私钥内容，或从 PEM / KEY / PPK 文件导入',
        privateKeySecret: '留空表示无口令',
        savedPassword: '留空则沿用已保存密码',
        ungrouped: '未分组',
        username: 'root / ubuntu / admin'
      },
      sections: {
        basic: '基础信息',
        connection: '连接参数',
        credentials: '凭据策略',
        note: '备注',
        privateKey: '私钥文件',
        strategy: '连接策略',
        tags: '标签'
      },
      systemKeychain: {
        available: '保存到系统钥匙串，后续连接可直接复用。',
        unavailable: '当前环境没有可用的系统钥匙串。'
      },
      toasts: {
        created: '服务器已创建。',
        updated: '服务器已更新。'
      },
      validation: {
        failed: '服务器表单校验失败。'
      }
    },
    sessionEditor: {
      closed: {
        description: '如果需要继续工作，请在资源管理器中重新连接对应服务器。',
        title: '该会话已经关闭'
      },
      portForwards: '端口转发',
      remoteFiles: '远程文件',
      cancel: '取消连接'
    },
    portForward: {
      actions: {
        newRule: '新建规则'
      },
      dialog: {
        create: '新建端口转发规则',
        description: '规则只属于当前会话标签，保存后会立即启动。'
      },
      directions: {
        local: '本地监听，流量转发到远端目标。',
        remote: '远端监听，流量转发到本地目标。'
      },
      empty: {
        rules: '当前会话还没有端口转发规则。'
      },
      fields: {
        bindHost: '监听地址',
        bindPort: '监听端口',
        kind: '转发类型',
        targetHost: '目标地址',
        targetPort: '目标端口'
      },
      kinds: {
        local: '本地转发',
        remote: '远程转发'
      },
      statuses: {
        active: '活动中',
        error: '错误',
        starting: '启动中',
        stopped: '已停止'
      },
      subtitle: '跟随当前会话标签的临时端口转发规则。',
      title: '端口转发',
      unavailableHint: '当前会话不可用。重新连接后才能创建、启动、停止或删除规则。',
      warnings: {
        publicBind: '监听地址 {{host}} 会暴露给回环地址之外的网络接口，请确认这是你想要的行为。'
      }
    },
    settings: {
      cursorStyles: {
        bar: '竖线',
        block: '方块',
        underline: '下划线'
      },
      descriptions: {
        appearance: '调整语言、主题和窗口标题栏模式。',
        credentialVault: '集中管理可复用的密码、私钥与口令记录。',
        security: '查看凭据存储能力与已信任主机列表。',
        terminal: '调整终端字体、光标和复制行为。'
      },
      form: {
        copyOnSelect: {
          description: '更接近常见终端行为。',
          title: '选中即复制'
        },
        cursorBlink: {
          description: '更容易定位当前输入位置。',
          title: '光标闪烁'
        },
        cursorStyle: '光标样式',
        language: '界面语言',
        terminalFontFamily: '终端字体',
        terminalFontSize: '终端字号',
        theme: '主题模式',
        titleBarStyle: '窗口标题栏'
      },
      knownHosts: {
        actions: '操作',
        algorithm: '算法',
        empty: '当前没有已信任主机记录。',
        fingerprint: '指纹',
        host: '主机',
        title: '已信任主机',
        verified: '验证时间'
      },
      sections: {
        appearance: '界面',
        credentialVault: '保险柜',
        security: '安全',
        terminal: '终端'
      },
      security: {
        available: '当前环境支持系统钥匙串，密码和私钥口令会优先写入系统安全存储。',
        unavailable: '当前环境未检测到系统钥匙串，应用不会持久化保存密码或私钥口令。'
      },
      subtitle: '调整主题、语言、终端参数和安全相关设置。',
      title: '设置编辑器',
      titleBar: {
        restartDescription: '切换窗口标题栏模式需要重启应用。',
        restartTitle: '标题栏模式已保存'
      },
      toasts: {
        knownHostDeleted: '已删除已信任主机 {{host}}。',
        knownHostDeleteFailed: '删除已信任主机失败。',
        saved: '设置已保存。'
      },
      validation: {
        failed: '设置表单校验失败。'
      }
    },
    shell: {
      terminalWelcome: {
        description: '在资源管理器中选择一台服务器，或直接创建一个新的连接配置并发起连接。',
        title: '还没有活动会话'
      }
    },
    sftp: {
      actions: {
        backToParent: '返回上级目录',
        copyPath: '复制路径',
        copyPathToTerminal: '复制路径到终端',
        openDirectory: '打开目录'
      },
      dialogs: {
        createFile: '新建文件',
        createFolder: '新建文件夹',
        rename: '重命名'
      },
      empty: {
        directory: '当前目录为空。',
        noSessionDescription: '先发起 SSH 连接，SFTP 面板会自动跟随当前标签加载。',
        noSessionTitle: '没有活动会话'
      },
      explorer: 'SFTP 资源管理器',
      kinds: {
        directory: '目录',
        symlink: '符号链接'
      },
      labels: {
        currentPath: '当前路径'
      },
      placeholders: {
        fileName: '请输入文件名称',
        directoryName: '请输入目录名称',
        rename: '新名称'
      },
      toasts: {
        pathCopied: '路径已复制。',
        pathCopyFailed: '复制路径失败。',
        pathSendToTerminalFailed: '复制路径到终端失败。',
        pathSentToTerminal: '路径已发送到终端。'
      }
    },
    statusBar: {
      panelOff: '面板关闭',
      panelOn: '面板开启',
      sessions: '{{count}} 个会话',
      sidebarOff: '侧栏关闭',
      sidebarOn: '侧栏开启',
      theme: '主题 {{value}}'
    },
    terminal: {
      connected: {
        defaultMessage: 'SSH 会话已准备就绪，正在把焦点切换到终端。',
        title: '已连接到 {{name}}'
      },
      connecting: {
        currentStage: '当前阶段',
        defaultMessage: '连接已发起，正在准备会话标签页与终端环境。',
        title: '正在连接 {{name}}'
      },
      stages: {
        attach: '正在附加 Shell 并切换到会话',
        handshake: '验证主机并协商 SSH 握手',
        prepare: '建立终端通道并准备远程环境',
        validate: '校验凭据与连接参数'
      },
      unavailable: {
        defaultMessage: '可以尝试重新连接该标签。',
        title: '会话当前不可用'
      }
    },
    titleBar: {
      commandPaletteTitle: '命令面板',
      closeWindow: '关闭窗口',
      maximizeWindow: '最大化窗口',
      minimizeWindow: '最小化窗口',
      restoreWindow: '还原窗口',
      quickOpenTitle: '快速连接'
    },
    toasts: {
      connectionFailed: '连接失败。',
      reconnected: '已重新连接 {{name}}。',
      reconnectFailed: '重新连接失败。',
      serverDeleted: '服务器已删除。',
      serverConfigMissing: '未找到对应的服务器配置。',
      sessionConnected: '已连接到 {{name}}。'
    },
    output: {
      connectedTo: '已连接到 {{name}}',
      connectingTo: '正在连接 {{name}}',
      downloadCompleted: '下载完成：{{fileName}}',
      portForwardActive: '端口转发已启动',
      portForwardStopped: '端口转发已停止',
      reconnecting: '正在重新连接 {{name}}',
      sessionDisconnected: '会话已断开',
      sessionExited: '会话已退出：{{sessionId}}',
      sessionStateChanged: '会话状态已变更为 {{status}}',
      uploadCompleted: '上传完成：{{fileName}}'
    },
    credentialVault: {
      title: '凭据保险柜',
      actions: {
        new: '新建凭据'
      },
      dialog: {
        createTitle: '新建凭据',
        editTitle: '编辑凭据',
        deleteTitle: '删除凭据',
        deleteDescription: '将永久删除凭据"{{name}}"，已引用此凭据的服务器将回退到内联凭据。此操作无法撤销。'
      },
      empty: '还没有保存的凭据。点击「新建凭据」添加第一条记录。',
      fields: {
        kind: '凭据类型',
        name: '凭据名称',
        note: '备注',
        passphrase: '私钥口令',
        password: '密码',
        privateKey: '私钥内容',
        username: '用户名'
      },
      kinds: {
        password: '账号密码',
        privateKey: '私钥'
      },
      placeholders: {
        name: '如：生产环境密钥、跳板机账号',
        note: '可选说明',
        passphrase: '留空表示无口令',
        password: '请输入密码',
        privateKey: '粘贴私钥内容，或点击浏览按钮从文件导入',
        username: '如：root、ubuntu'
      },
      privateKeyAuth: '私钥认证',
      toasts: {
        created: '凭据已创建。',
        deleted: '凭据已删除。',
        updated: '凭据已更新。'
      }
    }
  }
}

export default workbench
