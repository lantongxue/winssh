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
      localTerminal: '本地终端',
      remoteFile: '远程文件',
      serverEditor: {
        newConnection: '未命名连接'
      },
      settings: '设置',
      updates: '更新',
      terminal: '终端',
      terminalWelcome: '终端'
    },
    editorTabs: {
      actions: {
        cloneSession: '会话克隆',
        closeTab: '关闭标签',
        copyIp: '复制 IP',
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
      clearOutput: '清除输出记录',
      clearProblems: '清除问题',
      clearTransfers: '清除传输记录',
      empty: {
        logs: '暂无日志记录。',
        output: '连接日志和工作台输出会显示在这里。',
        problems: '当前没有工作台级问题。',
        transfers: '暂无传输任务。'
      },
      labels: {
        logs: '日志',
        output: '输出',
        problems: '问题',
        transfers: '传输'
      },
      logs: {
        actions: {
          clear: '清空日志',
          savePath: '保存路径'
        },
        description: '查看最近的应用日志、清空当前日志文件，或把后续日志写到新的文件路径。',
        pathPlaceholder: 'C:\\path\\to\\winssh.log',
        title: '应用日志',
        toasts: {
          cleared: '日志已清空。',
          clearFailed: '清空日志失败。',
          pathUpdated: '日志文件路径已更新。',
          pathUpdateFailed: '更新日志文件路径失败。'
        }
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
        upload: '上传',
        batchProgress: '{{completed}} / {{total}} 个文件'
      }
    },
    primarySidebar: {
      actions: {
        addToFavorites: '加入收藏',
        clearRecent: '清除最近连接',
        connect: '连接',
        createGroup: '新建分组',
        createSubgroup: '新建子分组',
        createTag: '新建标签',
        edit: '编辑',
        moveToGroup: '移动到分组',
        removeFromFavorites: '取消收藏',
        rename: '重命名'
      },
      description: '单击打开编辑器，双击建立 SSH 会话。',
      labels: {
        connected: '已连接',
        ungrouped: '未分组'
      },
      search: {
        clear: '清除搜索',
        empty: '未找到与“{{query}}”匹配的服务器。',
        label: '快捷搜索服务器',
        placeholder: '搜索服务器名称或 IP',
        results: '匹配结果'
      },
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
        groups: '服务器管理',
        recent: '最近',
        tags: '标签'
      },
      title: '资源管理器',
      toasts: {
        groupDeleted: '分组已删除。',
        recentCleared: '最近连接已清除。',
        serverDeleteFailed: '删除服务器失败。',
        serverMoveFailed: '移动服务器失败。',
        serverMoved: '已将“{{name}}”移动到“{{group}}”。',
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
        addTag: '添加标签',
        createJumpServer: '新建 Jump Server',
        deleteTag: '删除 {{name}}',
        hideSecret: '隐藏凭据',
        removeCustomIcon: '移除自定义图标',
        showSecret: '显示凭据'
      },
      auth: {
        password: '密码认证',
        privateKey: '私钥认证'
      },
      brands: {
        archlinux: 'Arch Linux',
        centos: 'CentOS',
        debian: 'Debian',
        fedora: 'Fedora',
        linux: 'Linux',
        redhat: 'Red Hat',
        suse: 'SUSE',
        ubuntu: 'Ubuntu'
      },
      descriptions: {
        brand:
          '内置品牌图标会在首次成功连接后自动识别。自定义图标会覆盖展示，但不会清空已识别的品牌。',
        brandCustomIcon: '当前服务器正在使用自定义图标。',
        brandDetected: '该品牌是在首次成功连接时从服务器自动识别得到的。',
        brandPending: '该服务器会在首次成功连接后自动识别品牌。',
        existing: '{{username}}@{{host}}:{{port}}',
        jumpServer: '选择已有跳板机，或快速新建一个最小化 Jump Server 配置。',
        new: '新的 SSH 连接',
        tagsInput: '输入标签名后按 Enter，命中已有标签会直接选中，不存在则立即创建。'
      },
      empty: {
        tags: '还没有标签，可直接在这里输入创建，也可以在资源管理器中创建。'
      },
      fields: {
        authType: '认证方式',
        brand: '品牌',
        connectNote: '连接说明',
        credential: '引用凭据',
        credentials: '凭据策略',
        favoriteDescription: '收藏后会在资源管理器中优先展示。',
        favoriteTitle: '收藏该服务器',
        group: '分组',
        host: '主机地址',
        jumpServer: 'Jump Server',
        name: '名称',
        note: '备注',
        password: '密码',
        passphrase: '私钥口令',
        port: '端口',
        privateKeyFile: '私钥内容',
        rememberPassphrase: '记住口令',
        rememberPassword: '记住密码',
        tagInput: '添加标签',
        tags: '标签',
        username: '用户名'
      },
      placeholders: {
        credential: '选择已有凭据（可选）',
        host: '192.168.1.10 或 demo.example.com',
        jumpServer: '不使用 jumpserver，直接连接目标主机',
        name: '我的服务器',
        note: '记录环境说明、跳板关系或维护信息。',
        privateKeyFile: '粘贴私钥内容，或从 PEM / KEY / PPK 文件导入',
        privateKeySecret: '留空表示无口令',
        savedPassword: '留空则沿用已保存密码',
        tag: '输入标签名称后按 Enter',
        ungrouped: '未分组',
        username: 'root / ubuntu / admin'
      },
      jumpServer: {
        dialog: {
          description: '创建一个最小化 jumpserver 配置，保存后会立即打上 jumpserver 标签。',
          title: '新建 Jump Server'
        },
        placeholders: {
          name: '生产跳板机',
          password: '请输入 jumpserver 密码'
        }
      },
      sections: {
        basic: '基础信息',
        brand: '品牌',
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
        jumpServerCreated: 'Jump Server {{name}} 已创建。',
        saveFailed: '无法保存服务器。',
        tagDeleteFailed: '无法删除标签。',
        tagCreateFailed: '无法创建标签。',
        updated: '服务器已更新。'
      },
      validation: {
        failed: '服务器表单校验失败。'
      }
    },
    sessionEditor: {
      actions: {
        copyIp: '复制 IP'
      },
      closed: {
        description: '如果需要继续工作，请在资源管理器中重新连接对应服务器。',
        title: '该会话已经关闭'
      },
      portForwards: '端口转发',
      serverAddress: '服务器地址',
      serverName: '服务器名称',
      resourceMonitor: {
        linuxOnly: '仅支持 Linux',
        metrics: {
          cpu: 'CPU',
          disk: '磁盘(/)',
          memory: '内存',
          network: '网络'
        },
        title: '资源监控',
        toggle: '切换资源监控',
        unavailable: '不可用',
        usage: '使用率'
      },
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
        about: '查看应用介绍和版本信息。',
        appearance: '调整语言、主题和窗口标题栏模式。',
        backup: '配置 WebDAV 定时备份，将数据安全同步到远程存储。',
        credentialVault: '集中管理可复用的密码、私钥与口令记录。',
        security: '查看凭据存储能力与已信任主机列表。',
        updates: '查看当前更新状态，并决定何时下载或安装新版本。',
        terminal: '调整本地终端 shell、终端字体、光标、复制行为与实验性渲染选项。'
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
        experimentalTerminalWebgl: {
          description:
            '实验性支持，需要可用 GPU 加速。在部分 Windows 和 Electron 环境下，可能导致终端字体发虚、字重异常或其他字体渲染问题；如果终端字体显示异常，建议关闭。',
          title: '实验性 WebGL 渲染'
        },
        resourceMonitorInterval: '资源监控间隔（毫秒）',
        resourceMonitorIntervalDescription:
          '会话资源监控采样 CPU、内存、网络和磁盘数据的频率。最小 500 ms，最大 30000 ms。',
        cursorStyle: '光标样式',
        language: '界面语言',
        localTerminalShell: '本地终端 shell',
        localTerminalShellDescription: '仅对新打开的本地终端标签生效。',
        uiFont: '界面字体',
        terminalFont: '终端字体',
        editorFont: '编辑器字体',
        editorFontFollowTerminal: '跟随终端字体',
        terminalFontSize: '终端字号',
        theme: '主题模式',
        titleBarStyle: '窗口标题栏',
        webdavBackupEnabled: {
          description: '按设定间隔自动将数据库备份上传到 WebDAV。',
          title: '启用 WebDAV 自动备份'
        },
        webdavBackupInterval: '备份间隔（分钟）',
        webdavBackupIntervalDescription: '最小 15 分钟，最大 10080 分钟（7 天）。',
        webdavBackupPath: '远程备份路径',
        webdavPassword: 'WebDAV 密码',
        webdavPasswordDescription: '密码仅保存在系统安全存储中，不会写入配置文件。',
        webdavPasswordPlaceholder: '输入新密码以更新',
        webdavUrl: 'WebDAV 服务器地址',
        webdavUsername: 'WebDAV 用户名'
      },
      localTerminalShells: {
        bash: 'Bash',
        cmd: '命令提示符 (cmd)',
        powershell: 'PowerShell',
        zsh: 'Zsh'
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
        about: '关于',
        appearance: '界面',
        backup: '备份',
        credentialVault: '保险柜',
        security: '安全',
        updates: '更新',
        terminal: '终端'
      },
      backup: {
        actions: {
          backupNow: '立即备份',
          restore: '从 WebDAV 恢复',
          testConnection: '测试连接'
        },
        backupFailed: '备份失败',
        backupSuccess: '备份已成功上传到 WebDAV。',
        deleteDialog: {
          description:
            '要删除远端 WebDAV 备份“{{fileName}}”吗？这只会删除 WebDAV 上所选的备份文件。',
          title: '删除 WebDAV 备份'
        },
        deleteFailed: '删除 WebDAV 备份失败。',
        deleteSuccess: '已删除 WebDAV 备份“{{fileName}}”。',
        restoreFailed: '恢复失败',
        restoreDialog: {
          confirm: '恢复所选备份',
          deleteLabel: '删除备份 {{fileName}}',
          description: '请选择当前保存在 WebDAV 上的一份备份，然后按该数据库快照执行恢复。',
          empty: '当前还没有可恢复的 WebDAV 备份。',
          loadFailed: '加载备份列表失败。',
          loading: '正在加载可用的 WebDAV 备份...',
          modifiedAt: '修改时间',
          title: '选择要恢复的备份'
        },
        status: {
          lastBackup: '上次备份',
          lastError: '上次错误',
          nextBackup: '下次备份',
          noBackupYet: '暂无备份记录',
          title: '备份状态'
        },
        testFailed: '连接测试失败',
        testFailedMessage: '连接测试失败：{{message}}',
        testSuccess: '连接测试成功：{{message}}'
      },
      about: {
        channels: {
          alpha: 'Alpha',
          beta: '预览通道',
          latest: '正式版'
        },
        intro: {
          description:
            'WinSSH 是一个正式版桌面 SSH 工作台，围绕终端、文件、端口转发和可复用连接管理构建。更新、平台细节和工作台体验会沿着正式发布线继续完善。',
          title: '关于 WinSSH'
        },
        version: {
          channelLabel: '发布通道',
          nameLabel: '应用名称',
          platformLabel: '平台',
          title: '版本信息',
          versionLabel: '版本号'
        }
      },
      updates: {
        actions: {
          check: '立即检查更新',
          download: '下载更新',
          install: '重启并安装'
        },
        autoCheck: {
          description: '应用启动时自动检查更新，但不会自动下载更新包。',
          title: '自动检查更新'
        },
        description: 'Windows 构建会检查已配置的更新源，并由你决定何时下载和安装新版本。',
        status: {
          available: '发现新版本 {{version}}。',
          buildUnsupported: '当前构建不支持自动更新。',
          checking: '正在检查更新...',
          downloaded: '更新已下载完成，等待安装。',
          downloading: '正在下载更新... {{percent}}%',
          error: '更新失败。',
          feedMissing: '当前构建没有配置更新源。',
          idle: '你可以随时手动检查更新。',
          notAvailable: '当前已经是最新版本。',
          platformUnsupported: '当前构建暂不支持在 {{platform}} 上自动更新。'
        },
        statusLabel: '更新状态',
        title: '自动更新',
        toasts: {
          checkFailed: '检查更新失败。',
          downloadFailed: '下载更新失败。',
          installFailed: '启动安装失败。'
        }
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
      themeManagement: {
        deleteDescription: '这会删除导入的主题包“{{name}}”及其中包含的所有主题，不会影响内置主题。',
        deleteTitle: '删除导入主题包',
        empty: '还没有导入主题包。导入 ZIP 主题包后，新的主题会出现在列表中。',
        importDescription:
          '以 ZIP 压缩包形式导入 WinSSH 主题包，导入成功后会立即出现在主题列表中。',
        importedThemes: '包含的主题',
        title: '主题包'
      },
      toasts: {
        themeDeleteFailed: '删除导入主题包失败。',
        themeDeleted: '已删除主题包“{{name}}”。',
        themeImportFailed: '导入主题包失败。',
        themeImported: '已导入主题包“{{name}}”。',
        knownHostDeleted: '已删除已信任主机 {{host}}。',
        knownHostDeleteFailed: '删除已信任主机失败。',
        saved: '设置已保存。'
      },
      validation: {
        failed: '设置表单校验失败。'
      }
    },
    updateDialog: {
      actions: {
        download: '下载更新',
        install: '重启并安装',
        later: '稍后'
      },
      description: '发现新版本 WinSSH {{version}}。你可以现在下载，也可以稍后处理。',
      descriptions: {
        checking: '正在检查更新源。',
        downloaded: '更新已下载完成，可以立即安装。',
        downloading: '正在下载更新... {{percent}}%',
        error: '检查或下载更新时发生错误。',
        idle: '正在准备更新流程。',
        notAvailable: '当前已经是最新版本。',
        unsupported: '当前环境暂不支持自动更新。'
      },
      title: '发现可用更新',
      titles: {
        checking: '正在检查更新',
        downloaded: '可以安装更新',
        downloading: '正在下载更新',
        error: '更新失败',
        notAvailable: '当前已是最新版本',
        unsupported: '当前无法更新'
      }
    },
    updatesEditor: {
      releaseDate: '发布日期'
    },
    shell: {
      terminalWelcome: {
        description: '在资源管理器中选择一台服务器，或直接创建一个新的连接配置并发起连接。',
        title: '还没有活动会话'
      }
    },
    localTerminal: {
      closed: {
        description: '这个本地终端标签已经被关闭。',
        title: '本地终端已关闭'
      },
      exited: {
        description: 'Shell 已退出，你仍然可以保留这个标签查看历史输出。',
        title: 'Shell 已退出'
      },
      status: {
        error: '错误',
        exited: '已退出',
        running: '运行中'
      }
    },
    sftp: {
      actions: {
        backToParent: '返回上级目录',
        copyPath: '复制路径',
        copyPathToTerminal: '复制路径到终端',
        openDirectory: '打开目录'
      },
      dropzone: {
        description: '会上传到 {{path}}。',
        title: '拖放文件或文件夹以上传'
      },
      dialogs: {
        createFile: '新建文件',
        createFolder: '新建文件夹',
        rename: '重命名'
      },
      deleteDialog: {
        description: '是否确认删除，删除后无法恢复。',
        title: '确认删除'
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
        deleteFailed: '删除所选项目失败。',
        pathCopied: '路径已复制。',
        pathCopyFailed: '复制路径失败。',
        pathSendToTerminalFailed: '复制路径到终端失败。',
        pathSentToTerminal: '路径已发送到终端。',
        uploadFailed: '上传所选项目失败。'
      }
    },
    sftpFileEditor: {
      empty: {
        description: '无法加载该文件内容进行编辑。',
        title: '无法打开文件'
      },
      labels: {
        dirty: '未保存',
        fileName: '文件名称',
        language: '语言',
        path: '远程路径',
        saved: '已保存'
      },
      loading: '正在加载远程文件...',
      toasts: {
        saveFailed: '保存远程文件失败。',
        saved: '远程文件已保存。'
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
      dropPath: {
        fallback: '松开后会把远程路径写入当前终端。',
        title: '松开以写入远程路径'
      },
      linkHint: '按 Cmd+点击打开链接',
      search: {
        close: '关闭终端搜索',
        label: '搜索终端输出',
        next: '查找下一个结果',
        noMatches: '没有匹配结果',
        placeholder: '在终端中查找',
        previous: '查找上一个结果',
        results: '{{current}} / {{total}}',
        shortcut: 'Cmd/Ctrl+F'
      },
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
      openTerminalTitle: '打开本地终端',
      restoreWindow: '还原窗口',
      quickOpenTitle: '快速连接'
    },
    toasts: {
      connectionFailed: '连接失败。',
      ipCopied: 'IP 已复制。',
      ipCopyFailed: '复制 IP 失败。',
      localTerminalOpenFailed: '打开本地终端失败。',
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
      localTerminalClosed: '本地终端已关闭',
      localTerminalExited: '本地终端已退出：{{terminalId}}',
      localTerminalOpened: '已打开本地终端 {{name}}',
      localTerminalStateChanged: '本地终端状态已变更为 {{status}}',
      portForwardActive: '端口转发已启动',
      portForwardStopped: '端口转发已停止',
      reconnecting: '正在重新连接 {{name}}',
      sessionDisconnected: '会话已断开',
      sessionExited: '会话已退出：{{sessionId}}',
      sessionStateChanged: '会话状态已变更为 {{status}}',
      uploadCompleted: '上传完成：{{fileName}}',
      batchUploadCompleted: '上传完成：{{count}} 个文件'
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
        deleteDescription:
          '将永久删除凭据"{{name}}"，已引用此凭据的服务器将回退到内联凭据。此操作无法撤销。'
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
