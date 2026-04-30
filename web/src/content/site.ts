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
      themeLabel: 'Theme',
      themeSystemLabel: 'System',
      themeLightLabel: 'Light+',
      themeDarkLabel: 'Dark+',
      languageLabel: 'Language',
      tagline: 'Your servers, one window.',
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
        'WinSSH is a cross-platform desktop SSH client with local terminals, jump hosts, SFTP and remote file editing, WebDAV backup and restore, port forwarding, resource monitoring, theme packs, updates, and a structured workbench UI.',
      seoKeywords: [
        'WinSSH',
        'SSH client',
        'desktop SSH client',
        'local terminal',
        'jump server',
        'SFTP client',
        'port forwarding',
        'resource monitor',
        'credential vault',
        'terminal workbench',
        'app updates',
        'remote file editor',
        'WebDAV backup',
        'backup restore',
        'cross-platform SSH',
        'Windows SSH client',
        'macOS SSH client',
        'Linux SSH client'
      ],
      sections: [
        { id: 'overview', label: 'Overview', meta: 'Workbench, not clutter' },
        { id: 'features', label: 'Features', meta: 'SSH, local shell, SFTP' },
        { id: 'preview', label: 'Preview', meta: 'Desk-view snapshot' },
        { id: 'download', label: 'Download', meta: 'Beta runway' },
        { id: 'faq', label: 'FAQ', meta: 'Straight answers' }
      ],
      hero: {
        eyebrow: 'Cross-Platform SSH Client',
        title: 'SSH deserves a proper desk.',
        subtitle:
          'WinSSH brings SSH sessions, local shells, SFTP, jump servers, port forwarding, and resource monitoring into one calm desktop workspace — so the serious stuff stays serious, and the interface keeps its head up.',
        primaryCta: 'See Download Plans',
        secondaryCta: 'Open Docs',
        tertiaryCta: 'Browse GitHub',
        winkCardTitle: 'Why "WinSSH"',
        winkCardBody:
          'The product layer keeps its precision. The brand layer keeps a light touch. WinSSH is built for real infrastructure work — it just refuses to scowl while doing it.',
        signalsLabel: 'Workbench Signals',
        releaseNote: `${APP_VERSION} ${RELEASE_CHANNEL} · Cross-platform desktop preview`,
        bullets: [
          'SSH sessions and local terminals share one workbench instead of splitting across separate tools.',
          'Jump hosts, SFTP transfers, and port forwards stay attached to the same session story.',
          'Themes, fonts, updates, and live resource signals keep the desk operational — not ornamental.'
        ]
      },
      metrics: [
        {
          value: '3',
          label: 'Core platforms',
          description:
            'Windows, macOS, and Linux share the same workbench, the same codebase, and the same desktop manners.'
        },
        {
          value: '12',
          label: 'Capability tracks',
          description:
            'Sessions, local terminals, jump hosts, SFTP, forwarding, themes, updates, brand detection, and more already ship in the desktop app.'
        },
        {
          value: '5',
          label: 'Built-in themes',
          description:
            'Light+, Dark+, Pixel CRT, and both Liquid Glass variants are live in the theme registry right now.'
        }
      ],
      features: {
        eyebrow: 'Capability Map',
        title: 'Serious tooling, less ceremony.',
        subtitle:
          'WinSSH keeps the runtime precise and the interface relaxed. Every capability below is already shipping in the desktop app — not sitting on a roadmap slide.',
        items: [
          {
            id: 'terminal',
            title: 'SSH Sessions',
            description:
              'Connection phases, provisional tabs, reconnect flow, and reusable session identity keep the command line clear and the context easy to follow.',
            tag: 'SSH'
          },
          {
            id: 'local',
            title: 'Local Terminal',
            description:
              'Local shells sit beside SSH sessions on the same TerminalSurface, sharing fonts, renderer options, and shell settings across every tab.',
            tag: 'Local'
          },
          {
            id: 'connections',
            title: 'Connections and Vault',
            description:
              'Saved servers, quick connect, credential references, single-hop jump servers, and the hybrid secret model are all first-class parts of the workbench.',
            tag: 'Security'
          },
          {
            id: 'sftp',
            title: 'SFTP Workspace',
            description:
              'Browse remote directories, open and edit remote text files, create and rename entries, upload folders recursively, delete, multi-select, and track transfers — all inside the workbench.',
            tag: 'SFTP'
          },
          {
            id: 'forwarding',
            title: 'Port Forwarding',
            description:
              'Local and remote forwarding rules live at the session level, with runtime status, public-bind warnings, and automatic recovery after reconnect.',
            tag: 'Networking'
          },
          {
            id: 'observability',
            title: 'Session Signals',
            description:
              'Linux sessions surface best-effort CPU, memory, network, and disk snapshots in the toolbar. Connection phases keep the state machine visible and legible.',
            tag: 'Observability'
          },
          {
            id: 'themes',
            title: 'Themes, Fonts, and Identity',
            description:
              'A full theme registry with built-in and ZIP-imported packs, integrated font settings, brand detection, and custom server icons — so the visuals earn their seat at the table.',
            tag: 'Appearance'
          },
          {
            id: 'updates',
            title: 'Workbench and Updates',
            description:
              'Activity bar, sidebar, tabs, local terminals, command palette, updates editor, status bar, and WebDAV backup — everything SSH work needs, organized on one desk instead of scattered across tool windows.',
            tag: 'UX'
          }
        ]
      },
      preview: {
        eyebrow: 'Workbench Preview',
        title: 'The site borrows the product\'s desk grammar.',
        subtitle:
          'This brand page wears the same titlebar, activity rail, sidebar, editor, and status bar layout that carries SSH sessions, local shells, updates, and session-side tools in the desktop app.',
        quickLabels: ['Quick Open', 'Command Palette', 'Theme Pack', 'Live Metrics'],
        sidebarTitle: 'Workbench Shelf',
        sidebarItems: ['prod-eu-1', 'bastion-hk', 'local: PowerShell', 'updates'],
        sessionTitle: 'session-editor: prod-eu-1',
        sessionMeta: 'SSH connected via bastion-hk · Linux metrics live',
        terminalLines: [
          '$ ssh ops@prod-eu-1',
          'Connected to 10.42.8.17 via bastion-hk',
          'sftp: /srv/releases · uploads idle',
          'resource: cpu 18% · mem 63% · net 1.2 MB/s'
        ],
        panelTitle: 'Bottom Panel',
        panelItems: ['Transfers · 3 landed', 'Port Forwards · 2 restored', 'Updates · 0.1.1 ready']
      },
      download: {
        eyebrow: 'Download',
        title: 'Beta channels mapped. Public installers are up next.',
        subtitle:
          'The desktop app already targets Windows, macOS, and Linux. The in-app updater is Windows-first today. The site keeps the download story honest: platform intent first, public release packaging right after.',
        ctaLabel: 'Open Repository',
        noteEyebrow: 'Docs',
        noteTitle: 'Docs start as a front door, not a placeholder.',
        noteBody:
          'The docs landing already maps quick start, connections, local terminals, SFTP, port forwarding, observability, themes, updates, backup, and security — it opens the room instead of making you wait at the gate.',
        noteCta: 'Open Docs Landing',
        cards: [
          {
            id: 'windows',
            title: 'Windows',
            description:
              'NSIS delivery and the built-in updater are wired up. Public hosting is the remaining distribution step.',
            status: 'Updater path implemented'
          },
          {
            id: 'macos',
            title: 'macOS',
            description: 'DMG and ZIP targets sit alongside the native font-helper pipeline.',
            status: 'Packaging path mapped'
          },
          {
            id: 'linux',
            title: 'Linux',
            description:
              'AppImage and DEB keep Linux in scope while public release hosting catches up.',
            status: 'Packaging path mapped'
          }
        ]
      },
      faq: {
        eyebrow: 'FAQ',
        title: 'What a public site should say — plainly, and with personality.',
        items: [
          {
            question: 'What is WinSSH?',
            answer:
              'WinSSH is a cross-platform desktop SSH client with a workbench layout. It brings together SSH and local terminals, jump servers, SFTP with remote file editing, WebDAV backup and restore, session-level port forwarding, resource monitoring, a credential vault, theming, and settings in one desktop app.'
          },
          {
            question: 'How does website theme switching work?',
            answer:
              'By default, the website follows your system appearance and resolves to Light+ or Dark+. The titlebar also lets you switch manually between those two built-in site themes. The desktop app ships a larger theme registry with ZIP pack support that the website does not replicate.'
          },
          {
            question: 'Are public installers available today?',
            answer:
              'Not yet. The site shows platform intent and the current beta channel while download links point to the repository until release hosting is finalized.'
          },
          {
            question: 'Does WinSSH already support app updates?',
            answer:
              'Yes — currently as a Windows-first desktop feature. The app checks, downloads, and installs updates through its built-in updater flow. macOS and Linux still display as unsupported for automatic updates.'
          },
          {
            question: 'What does the docs section include right now?',
            answer:
              'The docs landing maps every product area and points toward guides that will grow from here: quick start, connections, local terminals, SFTP, port forwarding, observability, themes, updates, backup, and security.'
          }
        ]
      }
    },
    docs: {
      seoTitle: 'WinSSH Docs',
      seoDescription:
        'WinSSH documentation for quick start, saved connections, jump hosts, local terminals, SFTP remote file editing, WebDAV backup and restore, port forwarding, updates, theme development, and the current security model.',
      seoKeywords: [
        'WinSSH docs',
        'SSH documentation',
        'local terminal',
        'jump server',
        'SFTP documentation',
        'port forwarding docs',
        'resource monitor',
        'app updates',
        'remote file editor',
        'WebDAV backup',
        'theme development',
        'SSH client guide',
        'credential vault',
        'security model',
        'known hosts'
      ],
      sections: [
        { id: 'quick-start', label: 'Quick Start', meta: 'Install without guesswork' },
        { id: 'connections', label: 'Connections', meta: 'Saved servers, jump hosts' },
        { id: 'local-terminal', label: 'Local Terminal', meta: 'Shells on the same desk' },
        { id: 'sftp', label: 'SFTP', meta: 'Remote files, fewer detours' },
        { id: 'port-forwarding', label: 'Port Forwarding', meta: 'Session rules, live status' },
        { id: 'observability', label: 'Observability', meta: 'Linux signals, best effort' },
        { id: 'themes', label: 'Themes', meta: 'Registry, plugins, development' },
        { id: 'updates', label: 'Updates', meta: 'Windows-first release flow' },
        { id: 'backup', label: 'Backup', meta: 'WebDAV restore flow' },
        { id: 'security', label: 'Security Model', meta: 'Vault, keytar, known hosts' }
      ],
      hero: {
        eyebrow: 'Docs Landing',
        title: 'Start with the product map. Let the manuals grow from there.',
        subtitle:
          'This docs landing keeps the first pass useful: it shows what WinSSH already does, where the edges are, and which guides should expand next.',
        primaryCta: 'Back to Overview',
        secondaryCta: 'See Download Plans'
      },
      backToTopLabel: 'Top',
      cards: [
        {
          id: 'quick-start',
          title: 'Quick Start',
          summary:
            'Covers installation expectations, first launch, titlebar choices, local shell defaults, and how the workbench avoids the usual desktop sprawl.',
          status: 'Map ready',
          bullets: ['Platform targets', 'Workbench anatomy', 'First-run expectations']
        },
        {
          id: 'connections',
          title: 'Connections',
          summary:
            'Explains saved servers, quick connect, credential references, single-hop jump servers, server identity metadata, connection phases, provisional tabs, and reconnect behavior — without pretending the edges do not exist.',
          status: 'Map ready',
          bullets: ['Saved servers', 'Jump hosts', 'Connection phases']
        },
        {
          id: 'local-terminal',
          title: 'Local Terminal',
          summary:
            'Maps the local shell runtime built on node-pty, the shared terminal surface used by SSH and local tabs, platform-specific shell choices, and shell-setting normalization.',
          status: 'Map ready',
          bullets: ['Shared terminal surface', 'Platform shell choices', 'Settings behavior']
        },
        {
          id: 'sftp',
          title: 'SFTP',
          summary:
            'Maps remote file browsing, remote text file open and save, transfers, current-path actions, multi-select, recursive upload, recursive delete, and path-to-terminal actions — all in one place.',
          status: 'Map ready',
          bullets: ['Directory browsing', 'Remote file editing', 'Recursive operations']
        },
        {
          id: 'port-forwarding',
          title: 'Port Forwarding',
          summary:
            'Documents local and remote forwards, runtime rule states, recovery on reconnect, and public-bind warnings in one pass.',
          status: 'Map ready',
          bullets: ['Local forward', 'Remote forward', 'Runtime recovery']
        },
        {
          id: 'observability',
          title: 'Observability',
          summary:
            'Describes the Linux-only best-effort resource monitor in the session toolbar: CPU, memory, network, and disk snapshots, first-sample caveats, and unavailable-state behavior.',
          status: 'Map ready',
          bullets: ['Toolbar monitor', 'Linux-only scope', 'Sampling caveats']
        },
        {
          id: 'themes',
          title: 'Themes',
          summary:
            'Summarizes the current desktop theme implementation defined in `docs/theme-dev.md`: built-in themes, ZIP theme-pack import and delete, selection and resolution, `package.json` format, theme JSON format, renderer application details, and merge and fallback rules.',
          status: 'Technical summary',
          bullets: [
            'Theme packs and registry',
            '`package.json` and theme JSON',
            'Renderer and fallback'
          ],
          details: {
            eyebrow: 'Theme Development',
            title: 'Theme development summary',
            lead: 'This section is derived from `docs/theme-dev.md` and describes current repository behavior. It does not define a separate web-only theme runtime.',
            sections: [
              {
                title: 'Current theme system overview',
                paragraphs: [
                  'The desktop application loads themes through `ThemeRegistry`. It scans `themes/builtin` and `<userData>/themes`, validates plugin `package.json` files and theme documents, produces normalized `ThemeDefinition` objects, and exposes them to the renderer.',
                  'Built-in themes currently include Light+, Dark+, Pixel CRT, and both Liquid Glass variants. Imported user theme packs can also be added or deleted from the settings surface.',
                  'The website does not load arbitrary themes at runtime. `web/src/home-main.tsx` and `web/src/docs-main.tsx` call `initializeSiteTheme()` before rendering, then the React layer applies Light+ or Dark+ according to system appearance or the persisted manual selection.'
                ],
                bullets: [
                  '`themes/builtin` is the built-in theme root.',
                  '`<userData>/themes` is the user theme root.',
                  'Editing `light-plus.json` or `dark-plus.json` changes the website palette.'
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
                note: 'Theme packs imported or deleted from the settings UI refresh immediately. Restart WinSSH after editing a user theme package directly on disk.'
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
                  '`terminal` keys are defined by `TERMINAL_COLOR_KEYS` in `src/shared/themes.ts` and map to the xterm.js palette. `terminalDefaults.fontId` provides a recommended integrated terminal font only when the user still uses the application defaults.'
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
    "fontId": "cascadia-mono",
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
                note: 'Extending Liquid Glass behavior to third-party themes requires renderer changes in addition to theme JSON changes.'
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
                note: '`contributes.themes[].path` cannot escape the plugin package root. Invalid paths are ignored.'
              },
              {
                title: 'Suggested development flow',
                paragraphs: [
                  'For a new theme, start from `themes/builtin/winssh-default-themes` for conventional light or dark work, or `themes/builtin/winssh-liquid-glass` when studying the built-in glass visual language.',
                  'First cover the primary workbench and terminal tokens, then refine overlay, toast, radius, scanline, and `terminalDefaults`.'
                ],
                bullets: [
                  '`npm run dev` verifies desktop loading, settings integration, and terminal rendering.',
                  '`npm run web:dev` verifies the system-aware website shell and manual Light+/Dark+ switching.',
                  'Restart the desktop application after editing a user theme package directly on disk.'
                ]
              }
            ]
          }
        },
        {
          id: 'updates',
          title: 'Updates',
          summary:
            'Documents the Windows-only updater subsystem: state machine, manual download and install flow, unsupported states on other platforms, and the release-channel information surfaced in the UI.',
          status: 'Map ready',
          bullets: ['Windows-only updater', 'Manual download flow', 'Release channels']
        },
        {
          id: 'backup',
          title: 'Backup',
          summary:
            'Covers WebDAV backup configuration, manual backup, remote backup listing, restore-from-selection, remote backup deletion, and the relaunch behavior after a restore completes.',
          status: 'Map ready',
          bullets: ['WebDAV settings', 'Remote restore list', 'Delete and relaunch']
        },
        {
          id: 'security',
          title: 'Security Model',
          summary:
            'Clarifies the hybrid secret model across keytar, server fields, and the credential vault — including password and private-key credentials plus known-hosts trust behavior — without hand-waving.',
          status: 'Map ready',
          bullets: ['Credential vault', 'Keytar boundaries', 'Known hosts']
        }
      ],
      footerNote:
        'Docs begin as a useful front door, not a decorative promise. The map already covers local shells, updates, and observability — and it can keep growing from here without changing its footing.'
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
      themeLabel: '主题',
      themeSystemLabel: '系统',
      themeLightLabel: 'Light+',
      themeDarkLabel: 'Dark+',
      languageLabel: '语言',
      tagline: '你的服务器，一个窗口就够了。',
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
        'WinSSH 是一款跨平台桌面 SSH 客户端，已经覆盖本地终端、Jump Server、SFTP 与远端文件编辑、WebDAV 备份恢复、端口转发、资源监控、主题包、更新系统和结构化 workbench 界面。',
      seoKeywords: [
        'WinSSH',
        'SSH 客户端',
        '桌面 SSH 客户端',
        '本地终端',
        '跳板机',
        'SFTP 客户端',
        '端口转发',
        '资源监控',
        '凭据库',
        '终端工作台',
        '应用更新',
        '远端文件编辑',
        'WebDAV 备份',
        '备份恢复',
        '跨平台 SSH',
        'Windows SSH',
        'macOS SSH',
        'Linux SSH'
      ],
      sections: [
        { id: 'overview', label: '总览', meta: 'Workbench，不是杂物堆' },
        { id: 'features', label: '能力', meta: 'SSH / 本地终端 / SFTP' },
        { id: 'preview', label: '预览', meta: '桌面快照' },
        { id: 'download', label: '下载', meta: 'Beta 跑道' },
        { id: 'faq', label: 'FAQ', meta: '把话说清' }
      ],
      hero: {
        eyebrow: '跨平台 SSH 客户端',
        title: '你的服务器，一个窗口就够了。',
        subtitle:
          'WinSSH 把 SSH 会话、本地 Shell、SFTP、Jump Server、端口转发和资源监控收进同一个冷静的工作台——严肃的部分继续严肃，界面只管挺直了说话。',
        primaryCta: '查看下载计划',
        secondaryCta: '打开文档入口',
        tertiaryCta: '浏览 GitHub',
        winkCardTitle: '为什么叫 "WinSSH"',
        winkCardBody:
          '产品层保持克制，品牌层留一点轻松。WinSSH 做的是真实的基础设施工作——只是不想跟着板脸而已。',
        signalsLabel: 'Workbench 信号',
        releaseNote: `${APP_VERSION} ${RELEASE_CHANNEL} · 跨平台桌面预览版`,
        bullets: [
          'SSH 会话和本地终端共用一张桌子，不用在多个工具之间跳来跳去。',
          'Jump Server、SFTP 传输和端口转发挂在同一条会话故事线上。',
          '主题、字体、更新和资源信号都已经进场——不只整洁，更会干活。'
        ]
      },
      metrics: [
        {
          value: '3',
          label: '核心平台',
          description: 'Windows、macOS、Linux 共用一套桌面礼貌、一条代码主线。'
        },
        {
          value: '12',
          label: '能力主线',
          description:
            '会话、本地终端、Jump Server、SFTP、转发、主题、更新、品牌识别——都已经在桌面端落地。'
        },
        {
          value: '5',
          label: '内置主题',
          description:
            'Light+、Dark+、Pixel CRT，以及两套 Liquid Glass 主题，已经全部在 theme registry 里跑起来了。'
        }
      ],
      features: {
        eyebrow: '能力地图',
        title: '工具可以严肃，界面不必板着。',
        subtitle: 'WinSSH 把该严肃的部分留给运行时，把轻松的节奏留给界面。下面的每一项能力都已经在桌面端落地——不是路线图上的占位符。',
        items: [
          {
            id: 'terminal',
            title: 'SSH 会话',
            description:
              '连接 phase、临时 tab、重连流转和可复用的 session identity，让命令行工作清晰推进，不再像演事故片。',
            tag: 'SSH'
          },
          {
            id: 'local',
            title: '本地终端',
            description:
              '本地 Shell 已经是正式能力，和 SSH 共用同一套终端渲染面、字体设置和 Shell 选项，无缝切换。',
            tag: 'Local'
          },
          {
            id: 'connections',
            title: '连接与凭据',
            description:
              '保存服务器、快速连接、凭据引用、单跳 Jump Server 和混合 secret 模型，都已经是工作台的核心流程。',
            tag: '安全'
          },
          {
            id: 'sftp',
            title: 'SFTP 工作区',
            description:
              '远端目录浏览、远端文本文件编辑保存、递归上传、递归删除、多选和传输进度——全在 workbench 里完成，不用边干活边找窗。',
            tag: 'SFTP'
          },
          {
            id: 'forwarding',
            title: '端口转发',
            description:
              '本地和远程转发都是会话级能力，状态实时回传，公开监听有 warning 提示，断线后自动恢复已启用规则。',
            tag: '网络'
          },
          {
            id: 'observability',
            title: '会话信号',
            description:
              'Linux 会话在 toolbar 里展示 CPU、内存、网络和磁盘快照。连接 phase 状态机让整个过程一目了然。',
            tag: '观测'
          },
          {
            id: 'themes',
            title: '主题、字体与身份',
            description:
              '完整的主题 registry、ZIP 包导入删除、内置字体设置、品牌识别和自定义图标——视觉层终于不是附属物。',
            tag: '外观'
          },
          {
            id: 'updates',
            title: 'Workbench 与更新',
            description:
              '活动栏、侧边栏、标签区、本地终端、命令面板、更新面板、状态栏和 WebDAV 备份——SSH 工作终于有了一张完整的桌子。',
            tag: '体验'
          }
        ]
      },
      preview: {
        eyebrow: 'Workbench 上桌',
        title: '官网借用了产品本体的桌面腔调。',
        subtitle:
          '这个品牌站穿上了和 WinSSH 同一套 titlebar、activity rail、sidebar、editor 和 status bar 的界面语法，现在也把本地终端、更新和会话侧工具一起摆上桌。',
        quickLabels: ['快速打开', '命令面板', '主题包', '指标在线'],
        sidebarTitle: '工作台侧栏',
        sidebarItems: ['prod-eu-1', 'bastion-hk', 'local: PowerShell', 'updates'],
        sessionTitle: 'session-editor: prod-eu-1',
        sessionMeta: 'SSH 已连接 · 经 bastion-hk 跳转 · Linux 指标在线',
        terminalLines: [
          '$ ssh ops@prod-eu-1',
          '已通过 bastion-hk 连接 10.42.8.17',
          'sftp: /srv/releases · 上传空闲',
          'resource: cpu 18% · mem 63% · net 1.2 MB/s'
        ],
        panelTitle: '底部面板',
        panelItems: ['传输 · 3 项完成', '端口转发 · 2 条已恢复', '更新 · 0.1.1 已就绪']
      },
      download: {
        eyebrow: '下载',
        title: 'Beta 渠道先排好队，公开安装包稍后就到。',
        subtitle:
          '桌面应用已经具备 Windows、macOS、Linux 的打包目标。内置更新链路目前 Windows 先行。官网先把下载故事讲清楚：平台方向在先，公开分发紧随其后。',
        ctaLabel: '打开仓库',
        noteEyebrow: '文档',
        noteTitle: '文档先做前门，不做一句"敬请期待"。',
        noteBody:
          'docs landing 已经把快速开始、连接、本地终端、SFTP、端口转发、资源监控、主题、更新、备份和安全都各自开了入口——不会只剩一句客气的占位。',
        noteCta: '打开文档入口',
        cards: [
          {
            id: 'windows',
            title: 'Windows',
            description: 'NSIS 分发和内置更新流已经接好，剩下主要是公开托管和发布承载。',
            status: '更新链路已实现'
          },
          {
            id: 'macos',
            title: 'macOS',
            description: 'DMG 和 ZIP 目标已具备，同时保留字体 helper 的原生适配路径。',
            status: '打包路径已明确'
          },
          {
            id: 'linux',
            title: 'Linux',
            description: 'AppImage 与 DEB 让 Linux 始终在发布桌上，等公开托管接上。',
            status: '打包路径已明确'
          }
        ]
      },
      faq: {
        eyebrow: 'FAQ',
        title: '官网首版——把正经话说清，也顺手眨一下眼。',
        items: [
          {
            question: 'WinSSH 是什么？',
            answer:
              'WinSSH 是一款跨平台桌面 SSH 客户端，具备 workbench 布局、SSH 与本地终端、Jump Server、带远端文件编辑的 SFTP、WebDAV 备份恢复、会话级端口转发、资源监控、凭据库、主题系统和设置中心。'
          },
          {
            question: '官网主题切换是怎么工作的？',
            answer:
              '官网默认跟随系统外观，解析为 Light+ 或 Dark+。标题栏也提供了手动切换入口，但官网当前只支持这两个站点内置主题；桌面端则有更完整的内置主题集和 ZIP 主题包能力。'
          },
          {
            question: '现在能直接下载正式安装包吗？',
            answer:
              '还不能。官网先展示平台计划和当前 Beta 渠道，下载按钮暂时指向仓库，等公开发布承载方式明确后再接正式安装入口。'
          },
          {
            question: 'WinSSH 现在已经支持应用更新了吗？',
            answer:
              '支持，但当前是 Windows 先行。桌面端已经有检查、下载和安装更新的完整链路，macOS 和 Linux 仍会显示为暂不支持自动更新。'
          },
          {
            question: '文档入口首版包含什么？',
            answer:
              '首版文档页是一张产品地图，围绕快速开始、连接、本地终端、SFTP、端口转发、资源监控、主题、更新、备份和安全模型这些方向，组织后续文档的扩展。'
          }
        ]
      }
    },
    docs: {
      seoTitle: 'WinSSH 文档',
      seoDescription:
        'WinSSH 文档入口，覆盖快速开始、保存连接、Jump Server、本地终端、SFTP 远端文件编辑、WebDAV 备份恢复、端口转发、更新系统、主题开发以及当前安全模型说明。',
      seoKeywords: [
        'WinSSH 文档',
        'SSH 文档',
        '本地终端',
        'Jump Server',
        'SFTP 文档',
        '端口转发文档',
        '资源监控',
        '应用更新',
        '远端文件编辑',
        'WebDAV 备份',
        '主题开发',
        'SSH 客户端指南',
        '凭据库',
        '安全模型',
        'known hosts'
      ],
      sections: [
        { id: 'quick-start', label: '快速开始', meta: '安装别靠猜' },
        { id: 'connections', label: '连接', meta: '保存连接 / Jump Server' },
        { id: 'local-terminal', label: '本地终端', meta: '同桌的本地 shell' },
        { id: 'sftp', label: 'SFTP', meta: '远端文件少绕路' },
        { id: 'port-forwarding', label: '端口转发', meta: '会话规则实时看' },
        { id: 'observability', label: '资源监控', meta: 'Linux 指标，best-effort' },
        { id: 'themes', label: '主题', meta: 'Registry / 插件 / 开发' },
        { id: 'updates', label: '更新', meta: 'Windows-first 发布链路' },
        { id: 'backup', label: '备份', meta: 'WebDAV 远端恢复链路' },
        { id: 'security', label: '安全模型', meta: '凭据与 known hosts' }
      ],
      hero: {
        eyebrow: '文档入口',
        title: '先把产品地图摊开，再让说明书慢慢长。',
        subtitle:
          '这版 docs 先保证实用：告诉你 WinSSH 已经做到哪、边界在哪、下一批说明该往哪个方向延伸。',
        primaryCta: '返回总览',
        secondaryCta: '查看下载计划'
      },
      backToTopLabel: '回顶部',
      cards: [
        {
          id: 'quick-start',
          title: '快速开始',
          summary:
            '说明安装预期、首次启动、标题栏策略、本地 Shell 默认值，以及 workbench 如何避免桌面端常见的散乱感。',
          status: '入口已亮灯',
          bullets: ['平台目标', 'Workbench 架构', '首次启动预期']
        },
        {
          id: 'connections',
          title: '连接',
          summary:
            '覆盖保存服务器、快速连接、凭据引用、单跳 Jump Server、服务器身份元数据、连接 phase、临时 tab 和 reconnect 行为——也不回避现有边界。',
          status: '入口已亮灯',
          bullets: ['保存服务器', 'Jump Server', '连接阶段']
        },
        {
          id: 'local-terminal',
          title: '本地终端',
          summary:
            '整理基于 node-pty 的本地 Shell 运行时、SSH 与本地标签共享的终端表面、按平台的 Shell 选项，以及 Shell 设置归一化规则。',
          status: '入口已亮灯',
          bullets: ['共享终端表面', '平台 Shell 选项', '设置行为']
        },
        {
          id: 'sftp',
          title: 'SFTP',
          summary:
            '组织远端目录浏览、远端文本文件编辑保存、传输、当前路径操作、递归上传、递归删除、多选和路径发送到终端——这些真实能力，不用靠猜翻目录。',
          status: '入口已亮灯',
          bullets: ['目录浏览', '远端文件编辑', '递归操作']
        },
        {
          id: 'port-forwarding',
          title: '端口转发',
          summary: '描述本地与远程转发、运行时状态、重连恢复和公开监听 warning，一页讲清主线。',
          status: '入口已亮灯',
          bullets: ['本地转发', '远程转发', '运行时恢复']
        },
        {
          id: 'observability',
          title: '资源监控',
          summary:
            '说明 session toolbar 里的 Linux-only best-effort 资源监控：CPU、内存、网络和磁盘快照、首次采样 caveat，以及 unavailable 状态的返回方式。',
          status: '入口已亮灯',
          bullets: ['Toolbar 监控', 'Linux-only 限定', '采样 caveat']
        },
        {
          id: 'themes',
          title: '主题',
          summary:
            '根据 `docs/theme-dev.md` 汇总当前桌面端主题实现，覆盖内置主题、ZIP 主题包导入删除、主题选择与解析、`package.json` 格式、主题 JSON 格式、渲染层应用细节，以及合并与回退规则。',
          status: '技术摘要',
          bullets: ['主题包与 registry', '`package.json` 与主题 JSON', '渲染与回退'],
          details: {
            eyebrow: '主题开发',
            title: '主题开发摘要',
            lead: '本节直接依据 `docs/theme-dev.md`，描述当前仓库的实际行为，不定义独立的 web 主题运行时。',
            sections: [
              {
                title: '当前主题系统概览',
                paragraphs: [
                  '桌面应用通过 `ThemeRegistry` 加载主题。它会扫描 `themes/builtin` 和 `<userData>/themes`，校验插件 `package.json` 与主题文档，生成标准化后的 `ThemeDefinition`，再提供给渲染层。',
                  '当前内置主题至少包括 Light+、Dark+、Pixel CRT，以及两套 Liquid Glass。设置页也已经支持导入和删除用户 ZIP 主题包。',
                  '官网不会在运行时加载任意主题。`web/src/home-main.tsx` 与 `web/src/docs-main.tsx` 会先调用 `initializeSiteTheme()`，然后在 React 层根据系统外观或已持久化的手动选择应用 Light+ 或 Dark+。'
                ],
                bullets: [
                  '`themes/builtin` 是内置主题根目录。',
                  '`<userData>/themes` 是用户主题根目录。',
                  '修改 `light-plus.json` 或 `dark-plus.json` 会直接影响官网配色。'
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
                note: '通过设置页导入或删除主题包会立即刷新；如果是直接改磁盘上的用户主题包，则需要重启 WinSSH 重新加载。'
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
                  '`terminal` 的键集合由 `src/shared/themes.ts` 中的 `TERMINAL_COLOR_KEYS` 定义，对应 xterm.js 调色板。`terminalDefaults.fontId` 只会在用户仍使用应用默认值时提供建议内置终端字体。'
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
    "fontId": "cascadia-mono",
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
                note: '如果要把 Liquid Glass 的额外行为扩展到第三方主题，必须同时修改渲染层代码。'
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
                note: '`contributes.themes[].path` 不能跳出插件包根目录。非法路径会被忽略。'
              },
              {
                title: '开发新主题的建议流程',
                paragraphs: [
                  '开发新主题时，常规浅色或深色主题建议从 `themes/builtin/winssh-default-themes` 开始；需要研究内置玻璃视觉语言时，再参考 `themes/builtin/winssh-liquid-glass`。',
                  '第一轮应先覆盖核心 workbench 和 terminal token，再处理 overlay、toast、radius、scanline 和 `terminalDefaults`。'
                ],
                bullets: [
                  '`npm run dev` 用于验证桌面端主题加载、设置页集成和终端渲染。',
                  '`npm run web:dev` 用于验证跟随系统的官网壳层，以及 Light+/Dark+ 手动切换。',
                  '如果是直接修改磁盘上的用户主题包，需要重启桌面应用。'
                ]
              }
            ]
          }
        },
        {
          id: 'updates',
          title: '更新',
          summary:
            '整理当前 Windows-only 更新子系统：状态机、手动下载与安装流程、其他平台的暂不支持状态，以及 UI 里暴露的发布渠道信息。',
          status: '入口已亮灯',
          bullets: ['Windows-only updater', '手动下载流程', '发布渠道']
        },
        {
          id: 'backup',
          title: '备份',
          summary:
            '覆盖 WebDAV 备份配置、手动备份、远端备份列表、按选择恢复、远端备份删除，以及恢复完成后的 relaunch 行为。',
          status: '入口已亮灯',
          bullets: ['WebDAV 设置', '远端恢复列表', '删除与重启']
        },
        {
          id: 'security',
          title: '安全模型',
          summary:
            '解释当前 keytar、服务器字段和 credential vault 并存的混合 secret 模型——明确 password/private key 凭据形态，不拿模糊话术遮边界。',
          status: '入口已亮灯',
          bullets: ['Credential Vault', 'keytar 边界', 'Known hosts']
        }
      ],
      footerNote:
        'Docs 首版先做有用的前门，不做装饰性的承诺。现在本地终端、更新和资源监控也都已经进图，后面的文档树可以继续往上长——不必先推翻导航。'
    }
  }
} as const

export type SiteCopy = (typeof SITE_COPY)[keyof typeof SITE_COPY]
