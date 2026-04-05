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
      tagline: 'The SSH workbench with a knowing wink.',
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
      seoTitle: 'WinSSH',
      seoDescription:
        'WinSSH is a cross-platform desktop SSH client with SFTP, port forwarding, credential vault workflows, theming, and a structured workbench UI.',
      seoKeywords: [
        'WinSSH',
        'SSH client',
        'desktop SSH client',
        'SFTP client',
        'port forwarding',
        'credential vault',
        'terminal workbench',
        'cross-platform SSH',
        'Windows SSH client',
        'macOS SSH client',
        'Linux SSH client'
      ],
      sections: [
        { id: 'overview', label: 'Overview', meta: 'Workbench, not clutter' },
        { id: 'features', label: 'Features', meta: 'SSH, SFTP, vault' },
        { id: 'preview', label: 'Preview', meta: 'Desk-view snapshot' },
        { id: 'download', label: 'Download', meta: 'Beta runway' },
        { id: 'faq', label: 'FAQ', meta: 'Straight answers' }
      ],
      hero: {
        eyebrow: 'Brand Site',
        title: 'WinSSH is the SSH workbench with a knowing wink.',
        subtitle:
          'A desktop-first SSH client that keeps terminals, SFTP, port forwarding, credential vaults, and theme control in one calm workspace, so serious work feels a little less like infrastructure punishment.',
        primaryCta: 'See Download Plans',
        secondaryCta: 'Open Docs',
        tertiaryCta: 'Browse GitHub',
        winkCardTitle: 'Why “win” quietly means “wink”',
        winkCardBody:
          'The product stays precise. The brand loosens the tie one notch. WinSSH is built for real SSH work, but it refuses to pretend every infrastructure tool has to scowl.',
        signalsLabel: 'Workbench Signals',
        releaseNote: `${APP_VERSION} ${RELEASE_CHANNEL} · Cross-platform desktop preview`,
        bullets: [
          'Workbench sessions instead of popup whack-a-mole.',
          'SFTP, transfers, and port forwards stay in the same conversation.',
          'Theme control keeps the desk sharp without drifting into theme theater.'
        ]
      },
      metrics: [
        {
          value: '3',
          label: 'Core runtimes',
          description: 'Windows, macOS, and Linux all get the same desktop manners from one codebase.'
        },
        {
          value: '6',
          label: 'First-class surfaces',
          description: 'Terminal, explorer, tabs, panel, settings, and session side tools live in one composed shell.'
        },
        {
          value: '0',
          label: 'Dark-theme detours',
          description: 'The public site stays on Light+ on purpose, so the first impression lands cleanly.'
        }
      ],
      features: {
        eyebrow: 'Capability Map',
        title: 'Serious tooling, less ceremony.',
        subtitle:
          'WinSSH keeps the operational parts sober and lets the interface relax its shoulders.',
        items: [
          {
            id: 'terminal',
            title: 'Terminal Sessions',
            description:
              'Structured connection phases, reconnect flow, and tabbed session editing keep command work readable instead of dramatic.',
            tag: 'SSH'
          },
          {
            id: 'sftp',
            title: 'SFTP Workspace',
            description:
              'Browse remote files, create and rename entries, upload, download, and track transfers without playing window-juggling.',
            tag: 'SFTP'
          },
          {
            id: 'forwarding',
            title: 'Port Forwarding',
            description:
              'Local and remote forwarding rules stay at the session level, with runtime status and a polite recovery after reconnect.',
            tag: 'Networking'
          },
          {
            id: 'vault',
            title: 'Credential Vault',
            description:
              'Passwords and private keys already have a dedicated management surface, ready for a stricter long-term security story.',
            tag: 'Security'
          },
          {
            id: 'themes',
            title: 'Themes and Fonts',
            description:
              'Theme registry, built-in theme plugins, and system font enumeration give the desktop client real visual manners.',
            tag: 'Appearance'
          },
          {
            id: 'workbench',
            title: 'Workbench Structure',
            description:
              'Activity bar, primary sidebar, tabs, bottom panel, and status bar give SSH work a proper desk instead of a toolbox spill.',
            tag: 'UX'
          }
        ]
      },
      preview: {
        eyebrow: 'Workbench, In Public',
        title: 'The homepage borrows the product’s own desk manners.',
        subtitle:
          'The site wears the same titlebar, activity rail, sidebar, editor, and status bar grammar that gives WinSSH its shape.',
        quickLabels: ['Quick Open', 'Command Palette', 'Light+', 'Wink Enabled'],
        sidebarTitle: 'Connection Shelf',
        sidebarItems: ['prod-eu-1', 'stage-us-2', 'pixel-lab', 'quick connect'],
        sessionTitle: 'session-editor: prod-eu-1',
        sessionMeta: 'SSH connected · SFTP attached · Forwards humming',
        terminalLines: [
          '$ ssh ops@prod-eu-1',
          'Connected to 10.42.8.17',
          'sftp: /srv/releases',
          'forward: localhost:8080 -> 127.0.0.1:80'
        ],
        panelTitle: 'Bottom Panel',
        panelItems: ['Transfers · 3 landed', 'Port Forwards · 2 humming', 'Problems · 0']
      },
      download: {
        eyebrow: 'Download',
        title: 'Beta channels are mapped. The installer parade comes next.',
        subtitle:
          'The desktop app already builds for Windows, macOS, and Linux. The site keeps the download story honest: platform intent first, public release packaging right after.',
        ctaLabel: 'Open Repository',
        noteEyebrow: 'Docs',
        noteTitle: 'Docs start as a front door, not a shrug.',
        noteBody:
          'The first docs page is already a useful map for quick start, connections, SFTP, port forwarding, themes, and security. It opens the room instead of apologizing for being early.',
        noteCta: 'Open Docs Landing',
        cards: [
          {
            id: 'windows',
            title: 'Windows',
            description: 'NSIS and ZIP are already waiting backstage in the desktop distribution pipeline.',
            status: 'Beta runway planned'
          },
          {
            id: 'macos',
            title: 'macOS',
            description: 'DMG and ZIP are in place beside the native font-helper workflow.',
            status: 'Beta runway planned'
          },
          {
            id: 'linux',
            title: 'Linux',
            description: 'AppImage and DEB keep Linux in the release conversation from day one.',
            status: 'Beta runway planned'
          }
        ]
      },
      faq: {
        eyebrow: 'FAQ',
        title: 'What the first public site should say, plainly and with a wink.',
        items: [
          {
            question: 'What is WinSSH?',
            answer:
              'WinSSH is a cross-platform desktop SSH client with a workbench layout, SFTP tooling, session-level port forwarding, a credential vault, theming, and settings surfaces.'
          },
          {
            question: 'Why does the site only use Light+?',
            answer:
              'The desktop product has multiple themes, but the public site keeps Light+ as the cleanest handshake and the most recognizable first impression.'
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
      seoTitle: 'WinSSH Docs',
      seoDescription:
        'WinSSH documentation for quick start, saved connections, SFTP, port forwarding, theme development, and the current security model.',
      seoKeywords: [
        'WinSSH docs',
        'SSH documentation',
        'SFTP documentation',
        'port forwarding docs',
        'theme development',
        'SSH client guide',
        'credential vault',
        'security model',
        'known hosts'
      ],
      sections: [
        { id: 'quick-start', label: 'Quick Start', meta: 'Install without guesswork' },
        { id: 'connections', label: 'Connections', meta: 'Saved servers, quick connect' },
        { id: 'sftp', label: 'SFTP', meta: 'Remote files, fewer detours' },
        { id: 'port-forwarding', label: 'Port Forwarding', meta: 'Session rules, live' },
        { id: 'themes', label: 'Themes', meta: 'Registry, plugins, dev' },
        { id: 'security', label: 'Security Model', meta: 'Vault, keytar, known hosts' }
      ],
      hero: {
        eyebrow: 'Docs Landing',
        title: 'Start with the product map, then let the manuals stretch their legs.',
        subtitle:
          'This docs landing page keeps the first pass useful: it shows what WinSSH already does, where the sharp edges are, and which guides should grow next.',
        primaryCta: 'Back to Overview',
        secondaryCta: 'See Download Plans'
      },
      backToTopLabel: 'Top',
      cards: [
        {
          id: 'quick-start',
          title: 'Quick Start',
          summary:
            'Covers installation expectations, first launch, titlebar choices, and how the workbench avoids the usual desktop sprawl.',
          status: 'Map ready',
          bullets: ['Platform targets', 'Workbench anatomy', 'First-run expectations']
        },
        {
          id: 'connections',
          title: 'Connections',
          summary:
            'Explains saved servers, quick connect, connection phases, provisional tabs, and reconnect behavior without pretending the edges do not exist.',
          status: 'Map ready',
          bullets: ['Saved servers', 'Quick connect', 'Connection phases']
        },
        {
          id: 'sftp',
          title: 'SFTP',
          summary:
            'Maps remote file browsing, transfers, current path actions, multi-select, and the current non-recursive delete boundary, minus the usual scavenger hunt.',
          status: 'Map ready',
          bullets: ['Directory browsing', 'Uploads and downloads', 'Deletion edge cases']
        },
        {
          id: 'port-forwarding',
          title: 'Port Forwarding',
          summary:
            'Documents local and remote forwards, runtime rule states, recovery on reconnect, and public bind warnings in one pass.',
          status: 'Map ready',
          bullets: ['Local forward', 'Remote forward', 'Runtime recovery']
        },
        {
          id: 'themes',
          title: 'Themes',
          summary:
            'Covers the desktop theme registry, plugin manifest shape, theme JSON structure, token sources, and how the website keeps Light+ as its public shell.',
          status: 'Guide live',
          bullets: ['Plugin manifest', 'Theme JSON', 'Preview workflow'],
          details: {
            eyebrow: 'Theme Development',
            title: 'Build desktop themes against the registry, not the marketing-site runtime.',
            lead:
              'WinSSH desktop themes are plugin packages loaded by `ThemeRegistry`. The web project does not host arbitrary themes at runtime: `web/src/lib/theme.ts` imports `themes/builtin/winssh-default-themes/themes/light-plus.json` and applies that document as CSS variables for the public site.',
            sections: [
              {
                title: 'Know the two theme surfaces',
                paragraphs: [
                  'Desktop app: the main process scans `themes/builtin` and `<userData>/themes`, validates plugin manifests and theme documents, then exposes normalized `ThemeDefinition` objects to the renderer.',
                  'Website: `web/src/home-main.tsx` and `web/src/docs-main.tsx` both call `applyLightPlusTheme()`. That makes the site a Light+ snapshot for public branding, not a theme picker or a plugin host.'
                ],
                bullets: [
                  'Editing `light-plus.json` updates the website palette.',
                  'Adding a new desktop theme does not make the website switch themes automatically.'
                ]
              },
              {
                title: 'Create a plugin package',
                paragraphs: [
                  'For repository development, start from an existing built-in package under `themes/builtin`. For a user-installed theme, place a plugin folder under `<userData>/themes`.'
                ],
                code: {
                  language: 'text',
                  content: `themes/
  builtin/
    my-theme-pack/
      package.json
      themes/
        nebula.json

<userData>/themes/
  my-theme-pack/
    package.json
    themes/
      nebula.json`
                }
              },
              {
                title: 'Declare the manifest',
                paragraphs: [
                  'The plugin `package.json` contributes one or more themes. `publisher` + `name` becomes the plugin id, while each contributed theme keeps its own unique theme id.'
                ],
                code: {
                  language: 'json',
                  content: `{
  "name": "nebula-themes",
  "displayName": "Nebula Themes",
  "publisher": "acme",
  "version": "1.0.0",
  "contributes": {
    "themes": [
      {
        "id": "acme.nebula",
        "label": "Nebula",
        "description": "A blue-black theme for WinSSH.",
        "uiTheme": "vs-dark",
        "path": "./themes/nebula.json"
      }
    ]
  }
}`
                }
              },
              {
                title: 'Write the theme document',
                paragraphs: [
                  'The theme JSON uses `colors`, `terminal`, and optional `terminalDefaults`. Develop against the shared token lists in `src/shared/themes.ts`; unknown tokens are ignored with a warning.'
                ],
                bullets: [
                  '`uiTheme: "vs"` maps to the light base tokens.',
                  '`uiTheme: "vs-dark"` maps to the dark base tokens.',
                  '`terminalDefaults` only suggests defaults; user terminal settings still win.'
                ],
                code: {
                  language: 'json',
                  content: `{
  "colors": {
    "background": "#0c1220",
    "foreground": "#d9e7ff",
    "workbench-bg": "#0c1220",
    "workbench-sidebar": "#11192c",
    "workbench-editor": "#0c1220",
    "workbench-panel": "#0a101b",
    "workbench-border": "#1b2940",
    "workbench-active": "#73c2fb",
    "workbench-statusbar": "#11233b"
  },
  "terminal": {
    "background": "#070c16",
    "foreground": "#d9e7ff",
    "cursor": "#73c2fb",
    "selectionBackground": "rgba(115, 194, 251, 0.2)"
  },
  "terminalDefaults": {
    "fontFamily": "Cascadia Mono, Consolas, monospace",
    "fontSize": 13,
    "lineHeight": 1.1
  }
}`
                }
              },
              {
                title: 'Preview and verify',
                paragraphs: [
                  'Use the desktop app to validate the full registry flow, settings integration, and terminal rendering. Use the web site only to confirm how the current Light+ document presents the public shell.'
                ],
                bullets: [
                  '`npm run dev` for the Electron app and runtime theme loading.',
                  '`npm run web:dev` for the marketing/docs site with the fixed Light+ theme.',
                  'Restart the desktop app after adding or editing a user theme package.'
                ],
                note:
                  'If you expect Liquid Glass-specific chrome, note that the renderer still special-cases `pluginId === "winssh.liquid-glass-themes"`.'
              }
            ]
          }
        },
        {
          id: 'security',
          title: 'Security Model',
          summary:
            'Clarifies the current hybrid secret model across keytar, server fields, and the credential vault, plus known hosts trust behavior without hand-waving.',
          status: 'Map ready',
          bullets: ['Credential vault', 'Keytar boundaries', 'Known hosts']
        }
      ],
      footerNote:
        'Docs begin as a useful front door, not a decorative promise. The tree can keep growing from here without changing its footing.'
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
      tagline: '认真做 SSH，顺手眨一下眼。',
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
      seoTitle: 'WinSSH',
      seoDescription:
        'WinSSH 是一款跨平台桌面 SSH 客户端，包含 SFTP、端口转发、凭据库、主题系统和结构化 workbench 界面。',
      seoKeywords: [
        'WinSSH',
        'SSH 客户端',
        '桌面 SSH 客户端',
        'SFTP 客户端',
        '端口转发',
        '凭据库',
        '终端工作台',
        '跨平台 SSH',
        'Windows SSH',
        'macOS SSH',
        'Linux SSH'
      ],
      sections: [
        { id: 'overview', label: '总览', meta: 'Workbench，不是杂物堆' },
        { id: 'features', label: '能力', meta: 'SSH / SFTP / 凭据' },
        { id: 'preview', label: '预览', meta: '桌面快照' },
        { id: 'download', label: '下载', meta: 'Beta 跑道' },
        { id: 'faq', label: 'FAQ', meta: '把话说清' }
      ],
      hero: {
        eyebrow: '品牌官网',
        title: 'WinSSH 是一个会眨一下眼的 SSH workbench。',
        subtitle:
          '它把桌面端 SSH、SFTP、端口转发、凭据管理和主题控制收进同一个冷静清晰的工作台，让严肃工作不必再配上一张冷脸。',
        primaryCta: '查看下载计划',
        secondaryCta: '打开文档入口',
        tertiaryCta: '浏览 GitHub',
        winkCardTitle: '为什么说 “win” 其实是在 “wink”',
        winkCardBody:
          '产品层面继续保持专业和克制，品牌层面只把领口松开半格。WinSSH 做的仍然是严肃的 SSH 工作，只是不想假装每个基础设施工具都必须板着脸。',
        signalsLabel: 'Workbench 信号',
        releaseNote: `${APP_VERSION} ${RELEASE_CHANNEL} · 跨平台桌面预览版`,
        bullets: [
          'SSH 会话进 workbench，不再玩弹窗打地鼠。',
          'SFTP、传输和端口转发留在同一条工作流里。',
          '主题控制让桌面更利落，而不是把精力浪费在换皮表演上。'
        ]
      },
      metrics: [
        {
          value: '3',
          label: '核心平台',
          description: 'Windows、macOS、Linux 共用一套桌面礼貌和同一条代码主线。'
        },
        {
          value: '6',
          label: '正式工作区表面',
          description: '终端、资源区、标签、面板、设置和会话辅助能力，终于住进同一张桌子。'
        },
        {
          value: '0',
          label: '品牌站暗色分支',
          description: '官网刻意锁定 Light+，让第一次见面先干净落地。'
        }
      ],
      features: {
        eyebrow: '能力地图',
        title: '工具可以严肃，界面不必板着。',
        subtitle: 'WinSSH 把该严肃的部分留给运行时，把更轻一点的节奏留给界面。',
        items: [
          {
            id: 'terminal',
            title: '终端会话',
            description:
              '连接 phase、重连流转和 session tab 让命令行工作清楚推进，不再像演事故片。',
            tag: 'SSH'
          },
          {
            id: 'sftp',
            title: 'SFTP 工作区',
            description:
              '远端目录浏览、创建、重命名、上传、下载和传输进度都留在 workbench 里，不用边干活边找窗。',
            tag: 'SFTP'
          },
          {
            id: 'forwarding',
            title: '端口转发',
            description:
              '本地与远程转发都是会话级能力，状态回传清楚，断线后也会尽量把规则接回来。',
            tag: '网络'
          },
          {
            id: 'vault',
            title: 'Credential Vault',
            description:
              '密码和私钥已经有正式管理界面，后续也更方便继续收紧长期安全策略。',
            tag: '安全'
          },
          {
            id: 'themes',
            title: '主题与字体',
            description:
              'Theme registry、内置主题插件和系统字体枚举都已经接入，视觉层终于不是附属物。',
            tag: '外观'
          },
          {
            id: 'workbench',
            title: 'Workbench 结构',
            description:
              '活动栏、侧边栏、标签区、底部面板和状态栏，给 SSH 工作一张真正的桌子，而不是一堆散开的工具盒。',
            tag: '体验'
          }
        ]
      },
      preview: {
        eyebrow: 'Workbench 上桌',
        title: '官网借用了产品自己的桌面腔调。',
        subtitle:
          '这个品牌站穿上了和 WinSSH 本体同一套 titlebar、activity rail、sidebar、editor 与 status bar 语法。',
        quickLabels: ['快速打开', '命令面板', 'Light+', '已就绪'],
        sidebarTitle: '连接架',
        sidebarItems: ['prod-eu-1', 'stage-us-2', 'pixel-lab', 'quick connect'],
        sessionTitle: 'session-editor: prod-eu-1',
        sessionMeta: 'SSH 已连接 · SFTP 已附加 · 转发在工作',
        terminalLines: [
          '$ ssh ops@prod-eu-1',
          '已连接 10.42.8.17',
          'sftp: /srv/releases',
          'forward: localhost:8080 -> 127.0.0.1:80'
        ],
        panelTitle: '底部面板',
        panelItems: ['传输 · 3 项完成', '端口转发 · 2 条在跑', '问题 · 0']
      },
      download: {
        eyebrow: '下载',
        title: 'Beta 渠道先排好队，安装器稍后登场。',
        subtitle:
          '桌面应用已经具备 Windows、macOS、Linux 的打包目标。官网先把下载故事讲诚实：先讲平台方向，再接公开分发。',
        ctaLabel: '打开仓库',
        noteEyebrow: '文档',
        noteTitle: '文档先做前门，不做一句“敬请期待”。',
        noteBody:
          '第一版文档页已经是可用地图，快速开始、连接、SFTP、端口转发、主题和安全都各自有门，不会只剩一句客气占位。',
        noteCta: '打开文档入口',
        cards: [
          {
            id: 'windows',
            title: 'Windows',
            description: 'NSIS 和 ZIP 已经在桌面端分发流水线后台排队。',
            status: 'Beta 跑道规划中'
          },
          {
            id: 'macos',
            title: 'macOS',
            description: 'DMG 和 ZIP 已就位，同时保留字体 helper 的原生适配路径。',
            status: 'Beta 跑道规划中'
          },
          {
            id: 'linux',
            title: 'Linux',
            description: 'AppImage 与 DEB 让 Linux 从第一天起就留在发布桌上。',
            status: 'Beta 跑道规划中'
          }
        ]
      },
      faq: {
        eyebrow: 'FAQ',
        title: '官网首版要把正经话说清，也顺手眨一下眼。',
        items: [
          {
            question: 'WinSSH 是什么？',
            answer:
              'WinSSH 是一款跨平台桌面 SSH 客户端，已经具备 workbench 布局、SFTP、会话级端口转发、凭据库、主题系统和设置中心。'
          },
          {
            question: '为什么官网只使用 Light+？',
            answer:
              '桌面端已有多个主题，但官网把 Light+ 作为最干净的一次握手，也作为最容易被记住的第一印象。'
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
      seoTitle: 'WinSSH 文档',
      seoDescription:
        'WinSSH 文档入口，覆盖快速开始、保存连接、SFTP、端口转发、主题开发以及当前安全模型说明。',
      seoKeywords: [
        'WinSSH 文档',
        'SSH 文档',
        'SFTP 文档',
        '端口转发文档',
        '主题开发',
        'SSH 客户端指南',
        '凭据库',
        '安全模型',
        'known hosts'
      ],
      sections: [
        { id: 'quick-start', label: '快速开始', meta: '安装别靠猜' },
        { id: 'connections', label: '连接', meta: '保存连接 / quick connect' },
        { id: 'sftp', label: 'SFTP', meta: '远端文件少绕路' },
        { id: 'port-forwarding', label: '端口转发', meta: '会话规则实时看' },
        { id: 'themes', label: '主题', meta: 'Registry / 插件 / 开发' },
        { id: 'security', label: '安全模型', meta: '凭据与 known hosts' }
      ],
      hero: {
        eyebrow: '文档入口',
        title: '先把产品地图摊开，再让说明书慢慢长出来。',
        subtitle:
          '这版 docs 先保证有用：告诉你 WinSSH 已经做到哪、边界在哪、下一批说明该往哪里长。',
        primaryCta: '返回总览',
        secondaryCta: '查看下载计划'
      },
      backToTopLabel: '回顶部',
      cards: [
        {
          id: 'quick-start',
          title: '快速开始',
          summary: '说明安装预期、首次启动、标题栏策略以及 workbench 如何避免桌面端常见的散乱感。',
          status: '入口已亮灯',
          bullets: ['平台目标', 'Workbench 架构', '首次启动预期']
        },
        {
          id: 'connections',
          title: '连接',
          summary: '覆盖保存服务器、quick connect、连接 phase、临时 tab 和 reconnect 行为，也不回避现有边界。',
          status: '入口已亮灯',
          bullets: ['保存服务器', 'Quick connect', '连接阶段']
        },
        {
          id: 'sftp',
          title: 'SFTP',
          summary: '组织远端目录浏览、传输、当前路径操作和非递归删除这类真实边界，不让你靠猜测翻目录。',
          status: '入口已亮灯',
          bullets: ['目录浏览', '上传下载', '删除边界']
        },
        {
          id: 'port-forwarding',
          title: '端口转发',
          summary: '描述本地与远程转发、运行时状态、重连恢复和公开监听 warning，一页先把主线讲清。',
          status: '入口已亮灯',
          bullets: ['本地转发', '远程转发', '运行时恢复']
        },
        {
          id: 'themes',
          title: '主题',
          summary:
            '覆盖桌面端 theme registry、插件 manifest、主题 JSON 结构、token 来源，以及官网如何把 Light+ 固定成公开壳层。',
          status: '开发文档已上线',
          bullets: ['插件 manifest', '主题 JSON', '预览流程'],
          details: {
            eyebrow: '主题开发',
            title: '主题要对着桌面端 registry 开发，而不是把官网站点当成运行时宿主。',
            lead:
              'WinSSH 的桌面主题是由 `ThemeRegistry` 扫描的插件包。`web` 项目当前不会在运行时加载任意主题：`web/src/lib/theme.ts` 直接导入 `themes/builtin/winssh-default-themes/themes/light-plus.json`，并把这个文档写成官网根节点 CSS 变量。',
            sections: [
              {
                title: '先分清两个主题表面',
                paragraphs: [
                  '桌面应用会扫描 `themes/builtin` 和 `<userData>/themes`，校验 manifest 与主题文档，然后把标准化后的 `ThemeDefinition` 提供给渲染层。',
                  '官网首页和文档页都在 `web/src/home-main.tsx`、`web/src/docs-main.tsx` 里调用 `applyLightPlusTheme()`。它只是公开站点的 Light+ 快照，不是主题切换器，也不是插件宿主。'
                ],
                bullets: [
                  '改动 `light-plus.json` 会直接影响 web 站点配色。',
                  '新增桌面主题并不会让官网自动切到那个主题。'
                ]
              },
              {
                title: '创建主题插件包',
                paragraphs: [
                  '仓库内开发内置主题时，直接参考 `themes/builtin` 下现有包。做用户主题时，把插件文件夹放到 `<userData>/themes`。'
                ],
                code: {
                  language: 'text',
                  content: `themes/
  builtin/
    my-theme-pack/
      package.json
      themes/
        nebula.json

<userData>/themes/
  my-theme-pack/
    package.json
    themes/
      nebula.json`
                }
              },
              {
                title: '声明 manifest',
                paragraphs: [
                  '插件 `package.json` 通过 `contributes.themes` 声明一个或多个主题。`publisher` 与 `name` 会组合成插件 id，而每个 theme contribution 仍然需要自己的唯一主题 id。'
                ],
                code: {
                  language: 'json',
                  content: `{
  "name": "nebula-themes",
  "displayName": "Nebula Themes",
  "publisher": "acme",
  "version": "1.0.0",
  "contributes": {
    "themes": [
      {
        "id": "acme.nebula",
        "label": "Nebula",
        "description": "A blue-black theme for WinSSH.",
        "uiTheme": "vs-dark",
        "path": "./themes/nebula.json"
      }
    ]
  }
}`
                }
              },
              {
                title: '编写主题 JSON',
                paragraphs: [
                  '主题文件只使用 `colors`、`terminal` 和可选的 `terminalDefaults`。开发时以 `src/shared/themes.ts` 里的 token 清单为准，未知 token 会被忽略并输出 warning。'
                ],
                bullets: [
                  '`uiTheme: "vs"` 会走浅色基础 token。',
                  '`uiTheme: "vs-dark"` 会走深色基础 token。',
                  '`terminalDefaults` 只是建议默认值，用户自定义终端设置仍然优先。'
                ],
                code: {
                  language: 'json',
                  content: `{
  "colors": {
    "background": "#0c1220",
    "foreground": "#d9e7ff",
    "workbench-bg": "#0c1220",
    "workbench-sidebar": "#11192c",
    "workbench-editor": "#0c1220",
    "workbench-panel": "#0a101b",
    "workbench-border": "#1b2940",
    "workbench-active": "#73c2fb",
    "workbench-statusbar": "#11233b"
  },
  "terminal": {
    "background": "#070c16",
    "foreground": "#d9e7ff",
    "cursor": "#73c2fb",
    "selectionBackground": "rgba(115, 194, 251, 0.2)"
  },
  "terminalDefaults": {
    "fontFamily": "Cascadia Mono, Consolas, monospace",
    "fontSize": 13,
    "lineHeight": 1.1
  }
}`
                }
              },
              {
                title: '预览与校验',
                paragraphs: [
                  '真正的主题回归要在桌面应用里看 registry 加载、设置页集成和终端渲染。web 站点只适合确认当前 Light+ 文档如何映射到公开品牌壳层。'
                ],
                bullets: [
                  '`npm run dev` 运行 Electron 应用，验证真实主题加载链路。',
                  '`npm run web:dev` 运行官网与 docs 站点，验证固定 Light+ 外观。',
                  '新增或修改用户主题包后，当前建议重启桌面应用再看结果。'
                ],
                note:
                  '如果你期待 Liquid Glass 那类额外 chrome，当前渲染层仍然对 `pluginId === "winssh.liquid-glass-themes"` 做了特殊分支。'
              }
            ]
          }
        },
        {
          id: 'security',
          title: '安全模型',
          summary: '解释当前 keytar、服务器字段和 credential vault 并存的混合 secret 模型，不拿模糊话术遮边界。',
          status: '入口已亮灯',
          bullets: ['Credential Vault', 'keytar 边界', 'Known hosts']
        }
      ],
      footerNote:
        'Docs 首版先做有用的前门，不做装饰性的承诺。后面的文档树可以继续往上长，不必先推翻导航。'
    }
  }
} as const

export type SiteCopy = (typeof SITE_COPY)[keyof typeof SITE_COPY]
