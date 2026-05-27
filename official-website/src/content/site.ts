import type { LanguageCode } from '@/lib/language'

/**
 * A single entry of the Capabilities "Walkthrough — Step Detail" showcase.
 *
 * `imageKey` is a logical identifier (e.g. 'home'); home.tsx is responsible
 * for mapping it to an imported asset URL. This keeps `site.ts` decoupled
 * from Vite asset imports.
 *
 * `fileLabel` is rendered like a file name in the simulated editor tab and
 * is intentionally code-shaped (e.g. `home.tsx`, `settings.terminal.tsx`).
 */
export interface FeatureSpotlight {
  id: string
  imageKey: 'home' | 'quick-conn' | 'new' | 'command-panel' | 'settings-xterm' | 'settings-webdav'
  fileLabel: string
  language: 'tsx' | 'json' | 'md'
  title: string
  summary: string
  bullets: string[]
  imageAlt: string
}

export interface FaqItem {
  q: string
  a: string
}

export interface DocsSection {
  id: string
  title: string
  description: string
}

export interface SiteCopy {
  brand: string
  tagline: string
  nav: {
    home: string
    docs: string
    changelog: string
    download: string
    settings: string
  }
  titlebar: {
    title: string
    themeLabel: string
    languageLabel: string
  }
  theme: {
    light: string
    dark: string
    system: string
  }
  status: {
    version: string
    repo: string
    repoLink: string
  }
  hero: {
    eyebrow: string
    headline: string
    subline: string
    primaryCta: string
    secondaryCta: string
    keywords: string[]
    terminalLines: string[]
  }
  features: {
    title: string
    subtitle: string
    introLabel: string
    items: FeatureSpotlight[]
  }
  download: {
    title: string
    subtitle: string
    note: string
    platforms: {
      windows: string
      macos: string
      linux: string
    }
    download: string
    viewAll: string
  }
  faq: {
    title: string
    subtitle: string
    items: FaqItem[]
  }
  docs: {
    title: string
    subtitle: string
    sections: DocsSection[]
    repoCta: string
  }
  changelog: {
    title: string
    subtitle: string
    repoCta: string
  }
  sidebar: {
    outline: string
  }
}

const zhCN: SiteCopy = {
  brand: 'WinSSH',
  tagline: '让 SSH 也拥有正经的工作台',
  nav: {
    home: '首页',
    docs: '文档',
    changelog: '更新',
    download: '下载',
    settings: '设置'
  },
  titlebar: {
    title: 'WinSSH · 官方网站',
    themeLabel: '主题',
    languageLabel: '语言'
  },
  theme: {
    light: '浅色',
    dark: '深色',
    system: '跟随系统'
  },
  status: {
    version: '版本',
    repo: '仓库',
    repoLink: 'GitHub'
  },
  hero: {
    eyebrow: '跨平台 SSH / SFTP 客户端',
    headline: 'SSH，本该有张正经工作台',
    subline: 'SSH 会话、双面板 SFTP、端口转发、跳板机、主题市场、备份恢复 —— 都在同一张工作台上。',
    primaryCta: '下载 WinSSH',
    secondaryCta: '查看 GitHub',
    keywords: ['SSH 工作台', '跨平台', '开源'],
    terminalLines: [
      '$ ssh user@bastion.example.com',
      '✓ 通过跳板机一跳直连内网',
      '$ sftp -P 22 user@10.0.1.42',
      '✓ 双面板同步浏览,拖拽传输',
      '$ port-forward -L 5432:db.internal:5432',
      '✓ 端口转发已就绪'
    ]
  },
  features: {
    title: '一张工作台,覆盖日常运维全流程',
    subtitle: '所有能力围绕同一个会话上下文展开,免去工具之间切换的疲劳。',
    introLabel: '功能演示',
    items: [
      {
        id: 'workbench-home',
        imageKey: 'home',
        fileLabel: 'workbench.tsx',
        language: 'tsx',
        title: '工作台首页',
        summary:
          '左侧活动栏 + 服务器目录树 + 多标签编辑区,一眼可见全部会话与近期连接,熟悉得就像 VS Code 本身。',
        bullets: [
          '活动栏切换服务器 / SFTP / 终端 / 设置',
          '资源管理器支持分组、收藏、拖拽排序',
          '状态栏汇总活动连接、传输速率与版本号'
        ],
        imageAlt: 'WinSSH 工作台首页,展示活动栏、服务器列表与欢迎页'
      },
      {
        id: 'quick-connect',
        imageKey: 'quick-conn',
        fileLabel: 'quick-connect.tsx',
        language: 'tsx',
        title: '极速直连',
        summary: '不想保存?贴一条 `ssh user@host:port` 直接进会话。常用主机自动记忆,下次回车继续。',
        bullets: [
          '支持 ssh:// 与命令式两种粘贴格式',
          '历史直连入口可一键转存为永久服务器',
          '凭据可直接复用钥匙串中的已存条目'
        ],
        imageAlt: 'WinSSH 快速连接面板'
      },
      {
        id: 'new-server',
        imageKey: 'new',
        fileLabel: 'new-server.tsx',
        language: 'tsx',
        title: '新建服务器',
        summary:
          '一张表单完成 SSH 连接所需的一切:协议、跳板、密钥、密码、超时与代理,字段都带行内校验。',
        bullets: [
          '密码 / 公钥 / 凭据库三种鉴权方式自由切换',
          '单跳跳板机自动复用父连接凭据',
          '保存时自动写入钥匙串,数据库只存密文'
        ],
        imageAlt: 'WinSSH 新建服务器的配置表单'
      },
      {
        id: 'command-palette',
        imageKey: 'command-panel',
        fileLabel: 'command.tsx',
        language: 'tsx',
        title: '命令面板',
        summary: 'Ctrl/⌘ + Shift + P 拉起全局命令面板,所有动作、设置、主题、最近会话都一搜即达。',
        bullets: [
          '模糊搜索支持拼音首字母与命令别名',
          '所有快捷键绑定都可在此就地修改',
          '配合标签历史快速回到上一次的远端会话'
        ],
        imageAlt: 'WinSSH 命令面板'
      },
      {
        id: 'terminal-settings',
        imageKey: 'settings-xterm',
        fileLabel: 'settings.terminal.tsx',
        language: 'tsx',
        title: '终端精细调校',
        summary:
          '字体连字、光标样式、滚动回写、WebGL 渲染、铃声策略 —— 把 xterm 调到完全符合手感。',
        bullets: [
          '字体支持 fallback 链与连字开关',
          '滚动回写最高 10 万行,搜索定位仍流畅',
          'WebGL / Canvas 渲染器可一键切换以适配旧显卡'
        ],
        imageAlt: 'WinSSH 终端设置页'
      },
      {
        id: 'webdav-backup',
        imageKey: 'settings-webdav',
        fileLabel: 'settings.backup.tsx',
        language: 'tsx',
        title: 'WebDAV 备份与同步',
        summary:
          '接入任意 WebDAV 服务(坚果云 / Nextcloud / 自建),一键备份服务器目录、凭据与主题,换设备秒级恢复。',
        bullets: [
          '客户端密钥派生,服务端只看见密文',
          '支持自动定时备份与冲突合并',
          '恢复后自动重启应用以加载新配置'
        ],
        imageAlt: 'WinSSH WebDAV 备份设置页'
      }
    ]
  },
  download: {
    title: '获取 WinSSH',
    subtitle: '支持 Windows、macOS、Linux,提供多种安装格式。',
    note: '所有安装包均来自 GitHub Releases,源代码完全开放。',
    platforms: {
      windows: 'Windows',
      macos: 'macOS',
      linux: 'Linux'
    },
    download: '下载',
    viewAll: '查看全部历史版本'
  },
  faq: {
    title: '常见问题',
    subtitle: '没找到答案?到文档或 GitHub 提一个 issue。',
    items: [
      {
        q: 'WinSSH 支持哪些平台?',
        a: 'Windows、macOS 与主流 Linux 发行版。Windows 提供 NSIS 安装版与免安装 ZIP;macOS 提供 DMG 与 ZIP;Linux 提供 AppImage 与 DEB 包。'
      },
      {
        q: '凭据/密码会存储在哪里?',
        a: '服务器密码、私钥短语通过系统钥匙串(keytar)保存;凭据库密文与私钥内容存放在本地 SQLite 数据库中,从不上传。'
      },
      {
        q: '是否支持跳板机链路?',
        a: '支持单跳跳板机配置,可复用主连接的凭据。出于安全与可维护性考虑,暂未支持多级嵌套跳板。'
      },
      {
        q: '主题可以自定义吗?',
        a: '可以。主题以 JSON 格式描述,可以直接放在 themes 目录加载,也可以打包成插件分享。'
      },
      {
        q: '资源监控为什么只在 Linux 上工作?',
        a: '当前基于 /proc 与 df 实现,这是 Linux 独有的接口。Windows 与 macOS 的等价能力在规划中。'
      }
    ]
  },
  docs: {
    title: '使用指南',
    subtitle: '从安装到高级技巧,选择一个章节开始。',
    sections: [
      { id: 'quick-start', title: '快速上手', description: '从下载到第一次连接,只需 3 分钟。' },
      { id: 'connections', title: '会话管理', description: '服务器、分组、跳板与连接重试策略。' },
      { id: 'local-terminal', title: '本地终端', description: '内置 node-pty 终端,跨平台 shell。' },
      { id: 'sftp', title: 'SFTP 文件传输', description: '双面板视图、批量传输、移动与重命名。' },
      { id: 'port-forwarding', title: '端口转发', description: '本地 / 远程 / 动态三类规则。' },
      { id: 'observability', title: '资源监控', description: '可视化的 CPU / 内存 / 磁盘指标。' },
      { id: 'themes', title: '主题与字体', description: '内建主题、加载自定义主题与字体替换。' },
      { id: 'updates', title: '自动更新', description: '更新通道、回滚与离线安装。' },
      { id: 'backup', title: '备份与同步', description: 'WebDAV 备份、恢复与多端同步。' },
      { id: 'security', title: '安全模型', description: '凭据、密钥、加密与隐私边界。' }
    ],
    repoCta: '在 GitHub 上阅读完整文档'
  },
  changelog: {
    title: '更新日志',
    subtitle: '按版本时间线列出新特性、修复与改进。',
    repoCta: '在 GitHub 上查看完整历史'
  },
  sidebar: {
    outline: '本页大纲'
  }
}

const enUS: SiteCopy = {
  brand: 'WinSSH',
  tagline: 'SSH deserves a proper desk.',
  nav: {
    home: 'Home',
    docs: 'Docs',
    changelog: 'Changelog',
    download: 'Download',
    settings: 'Settings'
  },
  titlebar: {
    title: 'WinSSH · Official Site',
    themeLabel: 'Theme',
    languageLabel: 'Language'
  },
  theme: {
    light: 'Light',
    dark: 'Dark',
    system: 'System'
  },
  status: {
    version: 'Version',
    repo: 'Repository',
    repoLink: 'GitHub'
  },
  hero: {
    eyebrow: 'Cross-platform SSH / SFTP client',
    headline: 'SSH deserves a proper desk.',
    subline:
      'SSH sessions, dual-panel SFTP, port forwarding, jump host, theme marketplace, backup & restore — all on one workbench.',
    primaryCta: 'Download WinSSH',
    secondaryCta: 'View on GitHub',
    keywords: ['SSH workbench', 'Cross-platform', 'Open source'],
    terminalLines: [
      '$ ssh user@bastion.example.com',
      '✓ Reached internal host through a single jump',
      '$ sftp -P 22 user@10.0.1.42',
      '✓ Dual panels synced, drag-and-drop transfer',
      '$ port-forward -L 5432:db.internal:5432',
      '✓ Tunnel ready'
    ]
  },
  features: {
    title: 'One workbench, the whole operations loop',
    subtitle: 'Every capability orbits the same session context — no more tool-juggling.',
    introLabel: 'Feature tour',
    items: [
      {
        id: 'workbench-home',
        imageKey: 'home',
        fileLabel: 'workbench.tsx',
        language: 'tsx',
        title: 'Workbench home',
        summary:
          'Activity bar, server explorer, and a multi-tab editor area — every session in one familiar VS Code-shaped surface.',
        bullets: [
          'Activity bar switches between servers, SFTP, terminal, settings',
          'Explorer supports groups, favorites, drag-and-drop ordering',
          'Status bar surfaces live sessions, transfer speed, version'
        ],
        imageAlt: 'WinSSH workbench home with activity bar, server list, and welcome page'
      },
      {
        id: 'quick-connect',
        imageKey: 'quick-conn',
        fileLabel: 'quick-connect.tsx',
        language: 'tsx',
        title: 'Quick connect',
        summary:
          "Don't feel like saving? Paste `ssh user@host:port` and you're in. Frequent hosts are remembered for the next ⏎.",
        bullets: [
          'Accepts ssh:// URIs or command-style strings',
          'Promote any ad-hoc entry to a permanent server in one click',
          'Reuses credentials from the OS keychain when available'
        ],
        imageAlt: 'WinSSH quick connect panel'
      },
      {
        id: 'new-server',
        imageKey: 'new',
        fileLabel: 'new-server.tsx',
        language: 'tsx',
        title: 'Create a server',
        summary:
          'One form, everything you need: protocol, jump host, keys, password, timeout, proxy — all inline-validated.',
        bullets: [
          'Switch freely between password, key, and credential vault auth',
          'Single-hop bastion automatically reuses parent credentials',
          'Secrets go through keytar; the database only stores ciphertext'
        ],
        imageAlt: 'WinSSH new-server configuration form'
      },
      {
        id: 'command-palette',
        imageKey: 'command-panel',
        fileLabel: 'command.tsx',
        language: 'tsx',
        title: 'Command palette',
        summary:
          'Ctrl/⌘ + Shift + P opens a global palette — every action, setting, theme, and recent session is one fuzzy search away.',
        bullets: [
          'Fuzzy search supports pinyin initials and command aliases',
          'Every keybinding can be rebound in place from the palette',
          'Jump back to the last remote session via tab history'
        ],
        imageAlt: 'WinSSH command palette'
      },
      {
        id: 'terminal-settings',
        imageKey: 'settings-xterm',
        fileLabel: 'settings.terminal.tsx',
        language: 'tsx',
        title: 'Terminal preferences',
        summary:
          'Ligatures, cursor shape, scrollback, WebGL rendering, bell policy — tune xterm until it feels right under your fingers.',
        bullets: [
          'Font fallback chain with ligature toggle',
          'Scrollback up to 100,000 lines, search stays snappy',
          'Flip between WebGL and Canvas renderers for older GPUs'
        ],
        imageAlt: 'WinSSH terminal settings page'
      },
      {
        id: 'webdav-backup',
        imageKey: 'settings-webdav',
        fileLabel: 'settings.backup.tsx',
        language: 'tsx',
        title: 'WebDAV backup & sync',
        summary:
          'Point it at any WebDAV server (Nutstore / Nextcloud / self-hosted): back up servers, credentials, and themes, restore on a new device in seconds.',
        bullets: [
          'Client-side key derivation — the server only sees ciphertext',
          'Scheduled backups with conflict merging',
          'Restore triggers an automatic relaunch to load the new state'
        ],
        imageAlt: 'WinSSH WebDAV backup settings page'
      }
    ]
  },
  download: {
    title: 'Get WinSSH',
    subtitle: 'Windows, macOS, Linux — multiple install formats.',
    note: 'All packages come from GitHub Releases. Source is fully open.',
    platforms: {
      windows: 'Windows',
      macos: 'macOS',
      linux: 'Linux'
    },
    download: 'Download',
    viewAll: 'View all releases'
  },
  faq: {
    title: 'Frequently asked',
    subtitle: "Didn't find it? Check the docs or open an issue on GitHub.",
    items: [
      {
        q: 'Which platforms does WinSSH support?',
        a: 'Windows, macOS, and major Linux distros. Windows ships NSIS installer + portable ZIP; macOS ships DMG + ZIP; Linux ships AppImage + DEB.'
      },
      {
        q: 'Where are credentials stored?',
        a: 'Server passwords and passphrases go through the OS keychain (keytar). Credential vault secrets and private keys are encrypted in a local SQLite database — never uploaded.'
      },
      {
        q: 'Does WinSSH support jump host chains?',
        a: 'Single-hop bastion only, reusing the parent connection’s credentials. Nested multi-hop chains are intentionally not supported for security and maintainability.'
      },
      {
        q: 'Can I theme it?',
        a: 'Yes. Themes are JSON documents you can drop into the themes folder, or share as plugins.'
      },
      {
        q: 'Why is resource monitoring Linux-only?',
        a: 'It is built on /proc and df. Windows / macOS equivalents are on the roadmap.'
      }
    ]
  },
  docs: {
    title: 'User guide',
    subtitle: 'From install to advanced tricks — pick a section.',
    sections: [
      {
        id: 'quick-start',
        title: 'Quick start',
        description: 'Download to first connection in 3 minutes.'
      },
      {
        id: 'connections',
        title: 'Connections',
        description: 'Servers, groups, jump hosts, retries.'
      },
      {
        id: 'local-terminal',
        title: 'Local terminal',
        description: 'Built on node-pty. Cross-platform shells.'
      },
      {
        id: 'sftp',
        title: 'SFTP transfer',
        description: 'Dual-panel view, batch transfer, move, rename.'
      },
      {
        id: 'port-forwarding',
        title: 'Port forwarding',
        description: 'Local / remote / dynamic tunnels.'
      },
      {
        id: 'observability',
        title: 'Resource monitor',
        description: 'CPU / memory / disk dashboards.'
      },
      {
        id: 'themes',
        title: 'Themes & fonts',
        description: 'Built-in themes, custom JSON, font swap.'
      },
      {
        id: 'updates',
        title: 'Auto-update',
        description: 'Update channels, rollback, offline install.'
      },
      {
        id: 'backup',
        title: 'Backup & sync',
        description: 'WebDAV backup, restore, multi-device sync.'
      },
      {
        id: 'security',
        title: 'Security model',
        description: 'Credentials, keys, encryption, privacy.'
      }
    ],
    repoCta: 'Read the full docs on GitHub'
  },
  changelog: {
    title: 'Changelog',
    subtitle: 'Versioned timeline of new features, fixes, and improvements.',
    repoCta: 'See the full history on GitHub'
  },
  sidebar: {
    outline: 'On this page'
  }
}

export const SITE_COPY: Record<LanguageCode, SiteCopy> = {
  'zh-CN': zhCN,
  'en-US': enUS
}
