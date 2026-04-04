import { APP_VERSION, RELEASE_CHANNEL, REPOSITORY_URL } from '@/lib/constants'

export type SitePage = 'home' | 'docs'

const sharedPlatforms = [
  { id: 'windows', label: 'Windows' },
  { id: 'macos', label: 'macOS' },
  { id: 'linux', label: 'Linux' }
] as const

export const SITE_COPY = {
  'en-US': {
    meta: {
      appName: 'WinSSH',
      winkMeaning: 'win = wink',
      repoUrl: REPOSITORY_URL,
      version: APP_VERSION,
      releaseChannel: RELEASE_CHANNEL,
      platforms: sharedPlatforms
    },
    shell: {
      homeLabel: 'Overview',
      featuresLabel: 'Features',
      downloadLabel: 'Download',
      docsLabel: 'Docs',
      githubLabel: 'GitHub',
      sectionLabel: 'Sections',
      languageLabel: 'Language',
      tagline: 'The SSH workbench with a wink.',
      statusVersionLabel: 'Version',
      statusPlatformLabel: 'Platforms',
      statusLanguageLabel: 'Language',
      statusChannelLabel: 'Channel',
      railHome: 'Overview',
      railFeatures: 'Features',
      railDownload: 'Download',
      railDocs: 'Docs',
      railGithub: 'GitHub'
    },
    home: {
      sections: [
        { id: 'overview', label: 'Overview', meta: 'Workbench shell' },
        { id: 'features', label: 'Features', meta: 'SSH, SFTP, vault' },
        { id: 'preview', label: 'Preview', meta: 'Layout snapshot' },
        { id: 'download', label: 'Download', meta: 'Beta channels' },
        { id: 'faq', label: 'FAQ', meta: 'Expectations' }
      ],
      hero: {
        eyebrow: 'Brand Site',
        title: 'WinSSH is the SSH workbench with a wink.',
        subtitle:
          'A desktop-first SSH client that keeps terminals, SFTP, port forwarding, credential vaults, and theme control in one calm workspace.',
        primaryCta: 'See Download Plans',
        secondaryCta: 'Open Docs',
        tertiaryCta: 'Browse GitHub',
        winkCardTitle: 'Why “win” means “wink”',
        winkCardBody:
          'The product voice stays precise and practical, but the brand carries a small wink: a desktop tool that feels alert, friendly, and a little lighter than the usual infrastructure console.',
        releaseNote: `${APP_VERSION} ${RELEASE_CHANNEL} · Cross-platform desktop preview`,
        bullets: [
          'SSH sessions with a workbench layout instead of floating panels.',
          'SFTP, transfers, and port forwards as first-class session tools.',
          'Theme-aware UI that keeps Light+ clarity front and center.'
        ]
      },
      metrics: [
        {
          value: '3',
          label: 'Core runtimes',
          description: 'Windows, macOS, and Linux targets ship from the same desktop codebase.'
        },
        {
          value: '6',
          label: 'First-class surfaces',
          description: 'Terminal, explorer, tabs, panel, settings, and session side tools align inside one shell.'
        },
        {
          value: '0',
          label: 'Dark-theme detours',
          description: 'The brand site intentionally stays on the default Light+ palette for launch.'
        }
      ],
      features: {
        eyebrow: 'Capability Map',
        title: 'Everything important stays inside the session flow.',
        subtitle:
          'WinSSH treats desktop SSH work like a product surface, not a pile of modal dialogs.',
        items: [
          {
            id: 'terminal',
            title: 'Terminal Sessions',
            description:
              'Structured connection phases, reconnection flows, and tabbed session editing keep command work readable.',
            tag: 'SSH'
          },
          {
            id: 'sftp',
            title: 'SFTP Workspace',
            description:
              'Browse remote files, create and rename entries, upload, download, and track transfers without leaving the workbench.',
            tag: 'SFTP'
          },
          {
            id: 'forwarding',
            title: 'Port Forwarding',
            description:
              'Local and remote forwarding rules live at the session level, with runtime status and recovery after reconnect.',
            tag: 'Networking'
          },
          {
            id: 'vault',
            title: 'Credential Vault',
            description:
              'Passwords and private keys already have a dedicated management surface, ready for a clearer long-term security model.',
            tag: 'Security'
          },
          {
            id: 'themes',
            title: 'Themes and Fonts',
            description:
              'Theme registry, built-in theme plugins, and system font enumeration give the desktop client a real look-and-feel layer.',
            tag: 'Appearance'
          },
          {
            id: 'workbench',
            title: 'Workbench Structure',
            description:
              'Activity bar, primary sidebar, tabs, bottom panel, and status bar give infrastructure work a dependable desktop frame.',
            tag: 'UX'
          }
        ]
      },
      preview: {
        eyebrow: 'Workbench Preview',
        title: 'A homepage built from the product’s own layout grammar.',
        subtitle:
          'The brand site borrows the same titlebar, activity rail, sidebar, editor, and status bar hierarchy that defines WinSSH itself.',
        quickLabels: ['Quick Open', 'Command Palette', 'Light+', 'Terminal Ready'],
        sidebarTitle: 'Connection Vault',
        sidebarItems: ['prod-eu-1', 'stage-us-2', 'pixel-lab', 'quick connect'],
        sessionTitle: 'session-editor: prod-eu-1',
        sessionMeta: 'SSH connected · SFTP attached · Port forward rules active',
        terminalLines: [
          '$ ssh ops@prod-eu-1',
          'Connected to 10.42.8.17',
          'sftp: /srv/releases',
          'forward: localhost:8080 -> 127.0.0.1:80'
        ],
        panelTitle: 'Bottom Panel',
        panelItems: ['Transfers · 3 completed', 'Port Forwards · 2 active', 'Problems · 0']
      },
      download: {
        eyebrow: 'Download',
        title: 'Beta channels are defined, even before the public installer page is.',
        subtitle:
          'The desktop app already builds for Windows, macOS, and Linux. The website launch keeps the download area honest: platform intent is visible, public release packaging comes next.',
        ctaLabel: 'Open Repository',
        noteTitle: 'Docs also start as a landing surface',
        noteBody:
          'The first docs page is an index for quick start, connections, SFTP, port forwarding, themes, and the security model. It is designed as the front door, not a dead placeholder.',
        noteCta: 'Open Docs Landing',
        cards: [
          {
            id: 'windows',
            title: 'Windows',
            description: 'NSIS and ZIP targets are already part of the desktop distribution pipeline.',
            status: 'Beta packaging planned'
          },
          {
            id: 'macos',
            title: 'macOS',
            description: 'DMG and ZIP targets exist alongside the native font helper workflow.',
            status: 'Beta packaging planned'
          },
          {
            id: 'linux',
            title: 'Linux',
            description: 'AppImage and DEB targets keep Linux in the first release conversation.',
            status: 'Beta packaging planned'
          }
        ]
      },
      faq: {
        eyebrow: 'FAQ',
        title: 'What the first public site should set clearly.',
        items: [
          {
            question: 'What is WinSSH?',
            answer:
              'WinSSH is a cross-platform desktop SSH client with a workbench layout, SFTP tooling, session-level port forwarding, a credential vault, theming, and settings surfaces.'
          },
          {
            question: 'Why does the site only use Light+?',
            answer:
              'The desktop product has multiple themes, but the brand site locks to the default Light+ palette so the public identity starts from the clearest and most recognizable visual baseline.'
          },
          {
            question: 'Are public installers available today?',
            answer:
              'Not yet. The site shows platform intent and the current beta channel while download links stay pointed at the repository until release hosting is finalized.'
          },
          {
            question: 'What does the docs section include first?',
            answer:
              'The first docs surface is a landing page that maps the product areas and points visitors toward the material that will expand next: quick start, connections, SFTP, port forwarding, themes, and security.'
          }
        ]
      }
    },
    docs: {
      sections: [
        { id: 'quick-start', label: 'Quick Start', meta: 'Install and launch' },
        { id: 'connections', label: 'Connections', meta: 'Servers and quick connect' },
        { id: 'sftp', label: 'SFTP', meta: 'Remote files and transfers' },
        { id: 'port-forwarding', label: 'Port Forwarding', meta: 'Session runtime rules' },
        { id: 'themes', label: 'Themes', meta: 'Light+, plugins, fonts' },
        { id: 'security', label: 'Security Model', meta: 'Vault, keytar, known hosts' }
      ],
      hero: {
        eyebrow: 'Docs Landing',
        title: 'Start with the product map, then expand the manuals.',
        subtitle:
          'This first docs surface organizes what WinSSH already does, which areas are ready for deeper guidance, and where the public documentation set should grow next.',
        primaryCta: 'Back to Overview',
        secondaryCta: 'See Download Plans'
      },
      cards: [
        {
          id: 'quick-start',
          title: 'Quick Start',
          summary:
            'Covers installation path expectations, first launch, titlebar setup, and how the workbench layout is organized.',
          status: 'Landing ready',
          bullets: ['Platform targets', 'Workbench anatomy', 'First-run expectations']
        },
        {
          id: 'connections',
          title: 'Connections',
          summary:
            'Explains saved servers, quick connect, connection phases, provisional tabs, and reconnect behavior.',
          status: 'Landing ready',
          bullets: ['Saved servers', 'Quick connect', 'Connection phases']
        },
        {
          id: 'sftp',
          title: 'SFTP',
          summary:
            'Maps remote file browsing, transfers, current path actions, multi-select, and the current non-recursive delete boundary.',
          status: 'Landing ready',
          bullets: ['Directory browsing', 'Uploads and downloads', 'Deletion edge cases']
        },
        {
          id: 'port-forwarding',
          title: 'Port Forwarding',
          summary:
            'Documents local and remote forwards, runtime rule states, recovery on reconnect, and public bind warnings.',
          status: 'Landing ready',
          bullets: ['Local forward', 'Remote forward', 'Runtime recovery']
        },
        {
          id: 'themes',
          title: 'Themes',
          summary:
            'Introduces the theme registry, built-in theme plugins, Light+ defaults, and how system fonts join the rendering layer.',
          status: 'Landing ready',
          bullets: ['Theme registry', 'Built-in themes', 'Font enumeration']
        },
        {
          id: 'security',
          title: 'Security Model',
          summary:
            'Clarifies the current hybrid secret model across keytar, server fields, and the credential vault, plus known hosts trust behavior.',
          status: 'Landing ready',
          bullets: ['Credential vault', 'Keytar boundaries', 'Known hosts']
        }
      ],
      footerNote:
        'Docs begin as a clear index instead of an empty promise. Each entry is ready to expand into full documentation without rethinking the navigation model.'
    }
  },
  'zh-CN': {
    meta: {
      appName: 'WinSSH',
      winkMeaning: 'win = wink',
      repoUrl: REPOSITORY_URL,
      version: APP_VERSION,
      releaseChannel: RELEASE_CHANNEL,
      platforms: sharedPlatforms
    },
    shell: {
      homeLabel: '总览',
      featuresLabel: '能力',
      downloadLabel: '下载',
      docsLabel: '文档',
      githubLabel: 'GitHub',
      sectionLabel: '分区',
      languageLabel: '语言',
      tagline: '带一点 wink 的 SSH workbench。',
      statusVersionLabel: '版本',
      statusPlatformLabel: '平台',
      statusLanguageLabel: '语言',
      statusChannelLabel: '渠道',
      railHome: '总览',
      railFeatures: '能力',
      railDownload: '下载',
      railDocs: '文档',
      railGithub: 'GitHub'
    },
    home: {
      sections: [
        { id: 'overview', label: '总览', meta: 'Workbench 外壳' },
        { id: 'features', label: '能力', meta: 'SSH / SFTP / 凭据' },
        { id: 'preview', label: '预览', meta: '布局快照' },
        { id: 'download', label: '下载', meta: 'Beta 渠道' },
        { id: 'faq', label: 'FAQ', meta: '公开说明' }
      ],
      hero: {
        eyebrow: '品牌官网',
        title: 'WinSSH 是一个带一点 wink 的 SSH workbench。',
        subtitle:
          '它把桌面端 SSH、SFTP、端口转发、凭据管理和主题控制放进同一个冷静清晰的工作台，而不是拆成一堆零散弹窗。',
        primaryCta: '查看下载计划',
        secondaryCta: '打开文档入口',
        tertiaryCta: '浏览 GitHub',
        winkCardTitle: '为什么说 “win” 代表 “wink”',
        winkCardBody:
          'WinSSH 的产品语气仍然专业、克制，但品牌表达里保留一个小小的 wink：它不是冷冰冰的基础设施面板，而是一个更机敏、更有桌面感的工作区。',
        releaseNote: `${APP_VERSION} ${RELEASE_CHANNEL} · 跨平台桌面预览版`,
        bullets: [
          'SSH 会话以 workbench 组织，而不是浮动弹窗拼装。',
          'SFTP、传输和端口转发都作为正式会话能力存在。',
          '主题和字体能力已经进入桌面产品，不只是浅深色开关。'
        ]
      },
      metrics: [
        {
          value: '3',
          label: '核心平台',
          description: 'Windows、macOS、Linux 都在同一套桌面代码和分发策略里。'
        },
        {
          value: '6',
          label: '正式工作区表面',
          description: '终端、资源区、标签、底部面板、设置和会话辅助能力已经形成统一结构。'
        },
        {
          value: '0',
          label: '品牌站暗色分支',
          description: '官网首版刻意锁定默认 Light+，先把公共品牌基线建立清楚。'
        }
      ],
      features: {
        eyebrow: '能力地图',
        title: '重要能力都留在同一条会话流里。',
        subtitle: 'WinSSH 把桌面 SSH 视为产品界面，而不是系统对话框的集合。',
        items: [
          {
            id: 'terminal',
            title: '终端会话',
            description:
              '连接 phase、重连流转和 session tab 已经形成稳定结构，命令行工作不会再被临时弹层打断。',
            tag: 'SSH'
          },
          {
            id: 'sftp',
            title: 'SFTP 工作区',
            description:
              '远端目录浏览、创建、重命名、上传、下载和传输进度都在 workbench 里完成。',
            tag: 'SFTP'
          },
          {
            id: 'forwarding',
            title: '端口转发',
            description:
              '本地与远程转发都是会话级能力，带状态回传，并且支持重连后的 runtime 恢复。',
            tag: '网络'
          },
          {
            id: 'vault',
            title: 'Credential Vault',
            description:
              '密码和私钥已经有独立管理界面，后续也方便继续演进成更清晰的安全模型。',
            tag: '安全'
          },
          {
            id: 'themes',
            title: '主题与字体',
            description:
              'Theme registry、内置主题插件和系统字体枚举都已经接入，视觉层不是附属品。',
            tag: '外观'
          },
          {
            id: 'workbench',
            title: 'Workbench 结构',
            description:
              '活动栏、侧边栏、标签区、底部面板和状态栏，让桌面 SSH 工作拥有稳定的空间秩序。',
            tag: '体验'
          }
        ]
      },
      preview: {
        eyebrow: 'Workbench 预览',
        title: '官网也沿用产品自己的布局语法。',
        subtitle:
          '这个品牌站直接借用了 WinSSH 的 titlebar、activity rail、sidebar、editor 和 status bar 层级。',
        quickLabels: ['Quick Open', 'Command Palette', 'Light+', 'Terminal Ready'],
        sidebarTitle: '连接仓库',
        sidebarItems: ['prod-eu-1', 'stage-us-2', 'pixel-lab', 'quick connect'],
        sessionTitle: 'session-editor: prod-eu-1',
        sessionMeta: 'SSH 已连接 · SFTP 已附加 · 端口转发已启用',
        terminalLines: [
          '$ ssh ops@prod-eu-1',
          '已连接 10.42.8.17',
          'sftp: /srv/releases',
          'forward: localhost:8080 -> 127.0.0.1:80'
        ],
        panelTitle: '底部面板',
        panelItems: ['Transfers · 3 项完成', 'Port Forwards · 2 条生效', 'Problems · 0']
      },
      download: {
        eyebrow: '下载',
        title: 'Beta 渠道先说清楚，公开安装包随后接上。',
        subtitle:
          '桌面应用已经具备 Windows、macOS、Linux 的打包目标。官网首版不伪装成“已正式发布”，而是把平台方向和当前阶段如实展示出来。',
        ctaLabel: '打开仓库',
        noteTitle: '文档也先从入口层开始',
        noteBody:
          '第一版文档页先承担导览职责，把快速开始、连接、SFTP、端口转发、主题和安全模型组织成清晰入口，而不是空壳跳转。',
        noteCta: '打开文档入口',
        cards: [
          {
            id: 'windows',
            title: 'Windows',
            description: 'NSIS 和 ZIP 已经在桌面端分发脚本范围内。',
            status: 'Beta 打包规划中'
          },
          {
            id: 'macos',
            title: 'macOS',
            description: 'DMG 和 ZIP 已就位，同时保留字体 helper 的平台适配路径。',
            status: 'Beta 打包规划中'
          },
          {
            id: 'linux',
            title: 'Linux',
            description: 'AppImage 与 DEB 让 Linux 从一开始就进入发布讨论。',
            status: 'Beta 打包规划中'
          }
        ]
      },
      faq: {
        eyebrow: 'FAQ',
        title: '官网首版应该先讲清楚的事。',
        items: [
          {
            question: 'WinSSH 是什么？',
            answer:
              'WinSSH 是一款跨平台桌面 SSH 客户端，已经具备 workbench 布局、SFTP、会话级端口转发、凭据库、主题系统和设置中心。'
          },
          {
            question: '为什么官网只使用 Light+？',
            answer:
              '桌面端已有多个主题，但品牌站首版锁定默认 Light+，目的是先建立最清晰、最可识别的公共视觉基线。'
          },
          {
            question: '现在能直接下载正式安装包吗？',
            answer:
              '还不能。官网会先展示平台计划和当前 Beta 渠道，下载按钮暂时指向仓库，等公开发布承载方式明确后再接正式安装入口。'
          },
          {
            question: '文档入口首版包含什么？',
            answer:
              '首版文档页是一个产品地图，围绕快速开始、连接、SFTP、端口转发、主题和安全模型六个方向组织后续文档扩展。'
          }
        ]
      }
    },
    docs: {
      sections: [
        { id: 'quick-start', label: '快速开始', meta: '安装与启动' },
        { id: 'connections', label: '连接', meta: '服务器与 quick connect' },
        { id: 'sftp', label: 'SFTP', meta: '远端文件与传输' },
        { id: 'port-forwarding', label: '端口转发', meta: '会话级规则' },
        { id: 'themes', label: '主题', meta: 'Light+ / 插件 / 字体' },
        { id: 'security', label: '安全模型', meta: '凭据与 known hosts' }
      ],
      hero: {
        eyebrow: '文档入口',
        title: '先把产品地图立起来，再把说明书逐步补齐。',
        subtitle:
          '这版 docs 先回答 WinSSH 已经覆盖了哪些产品面、哪些内容适合继续展开、以及公开文档接下来应该如何增长。',
        primaryCta: '返回总览',
        secondaryCta: '查看下载计划'
      },
      cards: [
        {
          id: 'quick-start',
          title: '快速开始',
          summary: '说明安装预期、首次启动、标题栏策略以及 workbench 基本结构。',
          status: '入口已就绪',
          bullets: ['平台目标', 'Workbench 架构', '首次启动预期']
        },
        {
          id: 'connections',
          title: '连接',
          summary: '覆盖保存服务器、quick connect、连接 phase、临时 tab 和 reconnect 行为。',
          status: '入口已就绪',
          bullets: ['保存服务器', 'Quick connect', '连接阶段']
        },
        {
          id: 'sftp',
          title: 'SFTP',
          summary: '组织远端目录浏览、传输、当前路径操作和非递归删除这类真实边界。',
          status: '入口已就绪',
          bullets: ['目录浏览', '上传下载', '删除边界']
        },
        {
          id: 'port-forwarding',
          title: '端口转发',
          summary: '描述本地与远程转发、运行时状态、重连恢复和公开监听 warning。',
          status: '入口已就绪',
          bullets: ['本地转发', '远程转发', '运行时恢复']
        },
        {
          id: 'themes',
          title: '主题',
          summary: '介绍主题注册表、内置主题插件、Light+ 默认值和系统字体能力。',
          status: '入口已就绪',
          bullets: ['Theme registry', '内置主题', '字体枚举']
        },
        {
          id: 'security',
          title: '安全模型',
          summary: '解释当前 keytar、服务器字段和 credential vault 并存的混合 secret 模型。',
          status: '入口已就绪',
          bullets: ['Credential Vault', 'keytar 边界', 'Known hosts']
        }
      ],
      footerNote:
        'Docs 首版不是空白页，而是一个可以继续长出完整文档树的稳定入口。'
    }
  }
} as const

export type SiteCopy = (typeof SITE_COPY)[keyof typeof SITE_COPY]
