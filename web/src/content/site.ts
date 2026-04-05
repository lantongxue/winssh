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
            'Summarizes the current desktop theme implementation defined in `docs/theme-dev.md`: selection and resolution, `package.json` format, theme JSON format, renderer application details, and merge and fallback rules.',
          status: 'Technical summary',
          bullets: ['Selection and resolution', '`package.json` and theme JSON', 'Renderer and fallback'],
          details: {
            eyebrow: 'Theme Development',
            title: 'Theme development summary',
            lead:
              'This section is derived from `docs/theme-dev.md` and describes current repository behavior. It does not define a separate web-only theme runtime.',
            sections: [
              {
                title: 'Current theme system overview',
                paragraphs: [
                  'The desktop application loads themes through `ThemeRegistry`. It scans `themes/builtin` and `<userData>/themes`, validates plugin `package.json` files and theme documents, produces normalized `ThemeDefinition` objects, and exposes them to the renderer.',
                  'The website does not load arbitrary themes at runtime. `web/src/home-main.tsx` and `web/src/docs-main.tsx` call `applyLightPlusTheme()`, which imports `themes/builtin/winssh-default-themes/themes/light-plus.json` and applies that document to the site root.'
                ],
                bullets: [
                  '`themes/builtin` is the built-in theme root.',
                  '`<userData>/themes` is the user theme root.',
                  'Editing `light-plus.json` changes the website palette.'
                ]
              },
              {
                title: 'Selection and resolution rules',
                paragraphs: [
                  'The saved `theme` setting contains either a valid theme id or the special value `system`. `system` is not a theme document. It resolves to `winssh.light-plus` or `winssh.dark-plus` according to the current OS appearance.',
                  'Each contribution declares `uiTheme: "vs"` or `uiTheme: "vs-dark"`. The runtime maps them to `appearance = "light"` or `appearance = "dark"`. This choice determines the base token set, the root `.dark` class, and `color-scheme`.'
                ],
                bullets: [
                  'Invalid selections are normalized back to `system`.',
                  '`DEFAULT_LIGHT_THEME_ID = "winssh.light-plus"`.',
                  '`DEFAULT_DARK_THEME_ID = "winssh.dark-plus"`.'
                ]
              },
              {
                title: 'Theme package layout',
                paragraphs: [
                  'A theme package contains a `package.json` and one or more JSON files under `themes/`. User themes must be placed under `<userData>/themes/<plugin-folder>`.',
                  'The plugin id is derived from `publisher.name`. The folder name affects scan order only.'
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
                },
                note:
                  'After adding, removing, or editing a user theme package, restart WinSSH to reload themes.'
              },
              {
                title: '`package.json` format',
                paragraphs: [
                  'The plugin `package.json` declares themes through `contributes.themes[]`. Required fields are `name`, `publisher`, `version`, and, for each theme contribution, `id`, `label`, `uiTheme`, and `path`.',
                  'Each theme id must be globally unique. Reusing a built-in theme id does not override the built-in definition.'
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
                title: 'Theme JSON format',
                paragraphs: [
                  'A theme JSON document uses three top-level fields: `colors`, `terminal`, and optional `terminalDefaults`.',
                  '`colors` keys are defined by `THEME_COLOR_KEYS` in `src/shared/themes.ts`. They cover base UI tokens, sidebar tokens, workbench tokens, toast tokens, glass tokens, terminal overlay tokens, and scanline tokens.',
                  '`terminal` keys are defined by `TERMINAL_COLOR_KEYS` in `src/shared/themes.ts` and map to the xterm.js palette. `terminalDefaults` provides recommended terminal font settings only when the user still uses the application defaults.'
                ],
                bullets: [
                  'Unknown top-level fields are ignored.',
                  'Unknown token names are ignored and logged as warnings.',
                  'An invalid theme document causes that theme to be skipped.'
                ],
                code: {
                  language: 'json',
                  content: `{
  "colors": {
    "background": "#0c1220",
    "foreground": "#d9e7ff",
    "primary": "#73c2fb",
    "primary-foreground": "#07111d",
    "border": "#1b2940",
    "workbench-bg": "#0c1220",
    "workbench-sidebar": "#11192c",
    "workbench-editor": "#0c1220",
    "workbench-panel": "#0a101b",
    "workbench-border": "#1b2940",
    "workbench-active": "#73c2fb",
    "workbench-logo": "#73c2fb",
    "workbench-statusbar": "#11233b",
    "workbench-statusbar-foreground": "#d9e7ff",
    "terminal-surface-bg": "#070c16",
    "terminal-overlay-panel": "rgba(9, 14, 24, 0.96)",
    "terminal-overlay-accent": "#9dd9ff",
    "terminal-overlay-accent-strong": "#73c2fb"
  },
  "terminal": {
    "background": "#070c16",
    "foreground": "#d9e7ff",
    "cursor": "#73c2fb",
    "selectionBackground": "rgba(115, 194, 251, 0.2)",
    "blue": "#73c2fb",
    "brightBlue": "#a7dbff"
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
                title: 'Renderer application details',
                paragraphs: [
                  'When the renderer applies a theme, it writes all UI tokens to CSS variables on `document.documentElement`, toggles `.dark` based on `appearance`, sets `color-scheme`, and updates `data-theme`, `data-theme-appearance`, `data-theme-plugin`, and `data-theme-selection`.',
                  'The class `.theme-liquid-glass` is not a general theme-package feature. It is added only when `resolvedTheme.pluginId === "winssh.liquid-glass-themes"`.'
                ],
                bullets: [
                  'Third-party themes can use glass tokens without receiving `.theme-liquid-glass`.',
                  '`data-theme` stores the resolved theme id.',
                  '`data-theme-selection` stores the saved selection value.'
                ],
                note:
                  'Extending Liquid Glass behavior to third-party themes requires renderer changes in addition to theme JSON changes.'
              },
              {
                title: 'Merge, priority, and fallback rules',
                paragraphs: [
                  'Theme generation uses the appearance-specific base UI tokens, then overlays `colors`, overlays `terminal`, and retains `terminalDefaults`.',
                  'If a theme id is missing, the selection is normalized to `system`. If no valid theme can be loaded, the runtime synthesizes a fallback theme.'
                ],
                bullets: [
                  'Built-in theme roots load before user theme roots.',
                  'Within each root, plugin folders are loaded in sorted order.',
                  'When two themes share an id, the first loaded definition wins.'
                ],
                note:
                  '`contributes.themes[].path` cannot escape the plugin package root. Invalid paths are ignored.'
              },
              {
                title: 'Suggested development flow',
                paragraphs: [
                  'For a new theme, start from `themes/builtin/winssh-default-themes` for conventional light or dark work, or `themes/builtin/winssh-liquid-glass` when studying the built-in glass visual language.',
                  'First cover the primary workbench and terminal tokens, then refine overlay, toast, radius, scanline, and `terminalDefaults`.'
                ],
                bullets: [
                  '`npm run dev` verifies desktop loading, settings integration, and terminal rendering.',
                  '`npm run web:dev` only verifies the fixed Light+ website shell.',
                  'Restart the desktop application after editing a user theme package.'
                ]
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
            '根据 `docs/theme-dev.md` 汇总当前桌面端主题实现，覆盖主题选择与解析、`package.json` 格式、主题 JSON 格式、渲染层应用细节，以及合并与回退规则。',
          status: '技术摘要',
          bullets: ['选择与解析', '`package.json` 与主题 JSON', '渲染与回退'],
          details: {
            eyebrow: '主题开发',
            title: '主题开发摘要',
            lead:
              '本节直接依据 `docs/theme-dev.md`，描述当前仓库的实际行为，不定义独立的 web 主题运行时。',
            sections: [
              {
                title: '当前主题系统概览',
                paragraphs: [
                  '桌面应用通过 `ThemeRegistry` 加载主题。它会扫描 `themes/builtin` 和 `<userData>/themes`，校验插件 `package.json` 与主题文档，生成标准化后的 `ThemeDefinition`，再提供给渲染层。',
                  '官网不会在运行时加载任意主题。`web/src/home-main.tsx` 与 `web/src/docs-main.tsx` 会调用 `applyLightPlusTheme()`，直接导入 `themes/builtin/winssh-default-themes/themes/light-plus.json` 并应用到站点根节点。'
                ],
                bullets: [
                  '`themes/builtin` 是内置主题根目录。',
                  '`<userData>/themes` 是用户主题根目录。',
                  '修改 `light-plus.json` 会直接影响官网配色。'
                ]
              },
              {
                title: '主题选择与解析规则',
                paragraphs: [
                  '设置里的 `theme` 保存的是有效主题 id，或者特殊值 `system`。`system` 不是主题文档，它会根据当前系统深浅色偏好解析到 `winssh.light-plus` 或 `winssh.dark-plus`。',
                  '每个 theme contribution 都要声明 `uiTheme: "vs"` 或 `uiTheme: "vs-dark"`。运行时会把它映射为 `appearance = "light"` 或 `appearance = "dark"`，并据此决定基础 token、根节点 `.dark` class 以及 `color-scheme`。'
                ],
                bullets: [
                  '非法主题选择会被归一化回 `system`。',
                  '`DEFAULT_LIGHT_THEME_ID = "winssh.light-plus"`。',
                  '`DEFAULT_DARK_THEME_ID = "winssh.dark-plus"`。'
                ]
              },
              {
                title: '主题插件包目录',
                paragraphs: [
                  '主题插件包包含一个 `package.json`，以及 `themes/` 目录下的一个或多个 JSON 文件。用户主题必须放在 `<userData>/themes/<plugin-folder>` 下。',
                  '插件 id 由 `publisher.name` 推导得到。文件夹名只影响扫描顺序，不决定插件 id。'
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
                },
                note:
                  '新增、删除或修改用户主题包后，需要重启 WinSSH 才会重新加载主题。'
              },
              {
                title: '`package.json` 格式',
                paragraphs: [
                  '插件 `package.json` 通过 `contributes.themes[]` 声明主题。必填字段包括 `name`、`publisher`、`version`，以及每个 theme contribution 的 `id`、`label`、`uiTheme`、`path`。',
                  '主题 id 必须全局唯一。复用内置主题 id 不会覆盖内置定义。'
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
                title: '主题 JSON 格式',
                paragraphs: [
                  '主题 JSON 只使用三个顶层字段：`colors`、`terminal` 和可选的 `terminalDefaults`。',
                  '`colors` 的键集合由 `src/shared/themes.ts` 中的 `THEME_COLOR_KEYS` 定义，覆盖基础界面、sidebar、workbench、toast、glass、terminal overlay 和 scanline 这些 token。',
                  '`terminal` 的键集合由 `src/shared/themes.ts` 中的 `TERMINAL_COLOR_KEYS` 定义，对应 xterm.js 调色板。`terminalDefaults` 只会在用户仍使用应用默认字体族与字号时提供建议默认值。'
                ],
                bullets: [
                  '未知顶层字段会被忽略。',
                  '未知 token 会被忽略并输出 warning。',
                  '非法主题文档会导致该主题被整体跳过。'
                ],
                code: {
                  language: 'json',
                  content: `{
  "colors": {
    "background": "#0c1220",
    "foreground": "#d9e7ff",
    "primary": "#73c2fb",
    "primary-foreground": "#07111d",
    "border": "#1b2940",
    "workbench-bg": "#0c1220",
    "workbench-sidebar": "#11192c",
    "workbench-editor": "#0c1220",
    "workbench-panel": "#0a101b",
    "workbench-border": "#1b2940",
    "workbench-active": "#73c2fb",
    "workbench-logo": "#73c2fb",
    "workbench-statusbar": "#11233b",
    "workbench-statusbar-foreground": "#d9e7ff",
    "terminal-surface-bg": "#070c16",
    "terminal-overlay-panel": "rgba(9, 14, 24, 0.96)",
    "terminal-overlay-accent": "#9dd9ff",
    "terminal-overlay-accent-strong": "#73c2fb"
  },
  "terminal": {
    "background": "#070c16",
    "foreground": "#d9e7ff",
    "cursor": "#73c2fb",
    "selectionBackground": "rgba(115, 194, 251, 0.2)",
    "blue": "#73c2fb",
    "brightBlue": "#a7dbff"
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
                title: '渲染层应用细节',
                paragraphs: [
                  '渲染层应用主题时，会把全部 UI token 写到 `document.documentElement` 的 CSS 变量上，根据 `appearance` 切换 `.dark`，设置 `color-scheme`，并更新 `data-theme`、`data-theme-appearance`、`data-theme-plugin`、`data-theme-selection`。',
                  '`.theme-liquid-glass` 不是通用主题包能力。只有当 `resolvedTheme.pluginId === "winssh.liquid-glass-themes"` 时，渲染层才会添加这个 class。'
                ],
                bullets: [
                  '第三方主题可以使用 glass token，但不会自动获得 `.theme-liquid-glass`。',
                  '`data-theme` 保存解析后的主题 id。',
                  '`data-theme-selection` 保存设置里的选择值。'
                ],
                note:
                  '如果要把 Liquid Glass 的额外行为扩展到第三方主题，必须同时修改渲染层代码。'
              },
              {
                title: '合并、优先级与回退规则',
                paragraphs: [
                  '主题定义的生成顺序是：先按 `appearance` 选择基础 UI token，再用主题文档的 `colors` 覆盖 UI token，用 `terminal` 覆盖终端调色板，并保留 `terminalDefaults`。',
                  '当主题 id 不存在时，选择值会被归一化为 `system`。如果运行时完全没有可加载主题，会创建一个合成 fallback theme。'
                ],
                bullets: [
                  '内置主题根目录先于用户主题根目录加载。',
                  '每个根目录内部按插件文件夹名排序加载。',
                  '两个主题使用相同 id 时，先加载到的定义生效。'
                ],
                note:
                  '`contributes.themes[].path` 不能跳出插件包根目录。非法路径会被忽略。'
              },
              {
                title: '开发新主题的建议流程',
                paragraphs: [
                  '开发新主题时，常规浅色或深色主题建议从 `themes/builtin/winssh-default-themes` 开始；需要研究内置玻璃视觉语言时，再参考 `themes/builtin/winssh-liquid-glass`。',
                  '第一轮应先覆盖核心 workbench 和 terminal token，再处理 overlay、toast、radius、scanline 和 `terminalDefaults`。'
                ],
                bullets: [
                  '`npm run dev` 用于验证桌面端主题加载、设置页集成和终端渲染。',
                  '`npm run web:dev` 只用于验证固定 Light+ 的官网壳层。',
                  '修改用户主题包后需要重启桌面应用。'
                ]
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
