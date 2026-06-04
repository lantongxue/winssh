export const translations = {
  en: {
    nav: {
      features: "Features",
      sync: "Sync",
      download: "Download",
      changelog: "Changelog"
    },
    hero: {
      tagline: "Next-Gen Terminal Experience",
      title: ["Terminal, As It Should Be", "Minimal, Elegant & Powerful"],
      desc: "WinSSH is designed for ops and dev geeks who pursue workflow aesthetics. Porting modern IDE experiences and seamlessly scheduling multiple sessions to make every login effortless."
    },
    features: {
      titleLevel1: "Engineered for",
      titleLevel2: "absolute power.",
      items: [
        {
          title: "Electron & GPU Rendering",
          desc: "Built on the Electron framework with hardware-accelerated GPU rendering for native-like speeds and zero input lag."
        },
        {
          title: "WebDAV & SFTP Support",
          desc: "Seamless file transfer and management. Integrated WebDAV and SFTP support to keep your local and remote environments synchronized."
        },
        {
          title: "Resource Monitoring",
          desc: "Real-time visibility into your infrastructure. Monitor CPU, memory, and network usage directly from the dashboard."
        },
        {
          title: "Security Alerts",
          desc: "Smart idle detection. Automatically locks the terminal and alerts you after a period of inactivity to prevent accidental operations."
        },
        {
          title: "Grouping & History",
          desc: "Effortlessly organize servers into logical groups. Powerful session history allows you to quickly replay previous interactions."
        },
        {
          title: "100% Open Source",
          desc: "Fully open-source and community-driven. Transparent architecture ensuring your keys are strictly within your control."
        }
      ]
    },
    sync: {
      titleLevel1: "Secure Data Sync",
      titleLevel2: "via WebDAV.",
      desc: "Seamlessly backup and synchronize your connection profiles, key pairs, and custom configurations across all your desktop workstations using your own WebDAV server with end-to-end encryption.",
      desktop: "Available for Windows, macOS, and Linux",
      webdav: "100% private data sync via WebDAV"
    },
    download: {
      titleLevel1: "Ready to upgrade your",
      titleLevel2: "terminal experience?",
      desc: "Download WinSSH today. Completely free and open-source forever, with no paid services.",
      modalMacTitle: "Choose Mac processor",
      modalLinuxTitle: "Choose package format",
      modalMacAppleSilicon: "Apple Silicon (M1/M2/M3)",
      modalMacAppleSiliconDesc: "For Macs with M1, M2, or M3 chips",
      modalMacIntel: "Intel",
      modalMacIntelDesc: "For Macs with Intel processors",
      modalLinuxDeb: "Debian / Ubuntu (.deb)",
      modalLinuxDebDesc: "For Debian, Ubuntu, Mint",
      modalLinuxAppImage: "Universal (AppImage)",
      modalLinuxAppImageDesc: "Standalone executable, works everywhere",
      modalCancel: "Cancel",
      platforms: {
        macos: { desc: "Requires macOS 11.0 or later.", arch: "Universal (Intel / Apple Silicon)", btn: "Download for macOS" },
        windows: { desc: "Requires Windows 10 or later.", arch: "x64 Installer", btn: "Download for Windows" },
        linux: { desc: "Tested on Ubuntu, Debian, Mint.", arch: ".deb / AppImage", btn: "Download for Linux" }
      }
    },
    changelogSection: {
      titleLevel1: "Release",
      titleLevel2: "Notes.",
      desc: "Stay up to date with the latest features, improvements, and bug fixes.",
      showMore: "Read full notes",
      showLess: "Show less",
      loadMore: "Load more releases",
      viewAllOnGithub: "View all on GitHub",
      versions: [
        {
          version: "v2.0.0",
          date: "October 2023",
          isMajor: true,
          changes: [
             "Added cross-platform sync across macOS, Windows, and Linux.",
             "Introduced zero-knowledge encryption for connection profiles.",
             "Major overhaul of the terminal rendering engine utilizing WebGL."
          ]
        },
        {
          version: "v1.5.0",
          date: "August 2023",
          isMajor: false,
          changes: [
             "Added multi-session management and grouping.",
             "Improved auto-reconnect reliability.",
             "Fixed connection drop issues under poor network conditions."
          ]
        },
        {
          version: "v1.0.0",
          date: "May 2023",
          isMajor: true,
          changes: [
             "Initial public release of WinSSH.",
             "Basic SSH terminal emulation with custom themes.",
             "Public key authentication support."
          ]
        }
      ]
    },
    footer: {
      desc: "Redefining remote access tailored for modern developers. High-performance terminal emulation and intelligent connection management.",
      product: "Product",
      dl: "Download",
      pricing: "Pricing",
      changelog: "Changelog",
      resources: "Resources",
      docs: "Documentation",
      community: "Community",
      github: "GitHub",
      legal: "Legal",
      privacy: "Privacy",
      terms: "Terms",
      copyright: "© {year} WinSSH. All rights reserved.",
      slogan: "Designed for speed."
    }
  },
  zh: {
    nav: {
      features: "功能",
      sync: "跨端",
      download: "下载",
      changelog: "日志"
    },
    hero: {
      tagline: "下一代终端体验",
      title: ["终端，本该如此", "极简、优雅与高能"],
      desc: "WinSSH 专为追求工作流美感的设计型运维与开发极客打造。移植现代 IDE 体验，完美调度多路会话，让每一次登录都畅行无阻。"
    },
    features: {
      titleLevel1: "生而强悍，",
      titleLevel2: "全能终端体验。",
      items: [
        {
          title: "Electron 与 GPU 渲染",
          desc: "基于 Electron 框架构建，支持 GPU 硬件加速渲染，带来告别卡顿的丝滑终端体验。"
        },
        {
          title: "WebDAV 与 SFTP 支持",
          desc: "内置强大的文件管理，支持 WebDAV 与 SFTP，让本地与服务器间的文件交互顺畅无阻。"
        },
        {
          title: "服务器资源监控",
          desc: "直观的云端仪表盘，实时监控所连接服务器的 CPU、内存和网络资源消耗情况。"
        },
        {
          title: "安全提醒",
          desc: "智能空闲检测机制。当离开一段时间无操作后，自动锁定终端并进行安全提醒，有效避免误操作与防范安全风险。"
        },
        {
          title: "分组管理与历史记录",
          desc: "支持按项目进行服务器分组管理。自动保存连接与命令历史，随时回溯复盘过往操作。"
        },
        {
          title: "100% 开源，社区驱动",
          desc: "百分百开源透明，无需担心暗门，允许个人及团队进行深度定制与本地化私有部署。"
        }
      ]
    },
    sync: {
      titleLevel1: "通过 WebDAV 实现",
      titleLevel2: "安全数据同步。",
      desc: "在您的所有桌面工作站之间无缝备份与同步连接配置、密钥对和自定义设置。采用端到端加密，通过您自己的 WebDAV 服务器进行全平台同步，让您的数据绝对私有。",
      desktop: "全面支持 Windows, macOS 和 Linux",
      webdav: "100% 私有化的 WebDAV 数据同步"
    },
    download: {
      titleLevel1: "准备好升级您的",
      titleLevel2: "终端体验了吗？",
      desc: "立即下载 WinSSH。完全免费且永久开源，无任何付费服务。",
      modalMacTitle: "选择 Mac 处理器",
      modalLinuxTitle: "选择安装包格式",
      modalMacAppleSilicon: "Apple Silicon (M1/M2/M3)",
      modalMacAppleSiliconDesc: "适用于搭载 M1, M2 或 M3 芯片的 Mac",
      modalMacIntel: "Intel 芯片",
      modalMacIntelDesc: "适用于搭载 Intel 处理器的 Mac",
      modalLinuxDeb: "Debian / Ubuntu (.deb)",
      modalLinuxDebDesc: "适用于 Debian, Ubuntu, Mint",
      modalLinuxAppImage: "通用版 (AppImage)",
      modalLinuxAppImageDesc: "独立可执行文件，免安装",
      modalCancel: "取消",
      platforms: {
        macos: { desc: "需要 macOS 11.0 或更高版本。", arch: "Universal (Intel / 苹果芯片)", btn: "下载 macOS 版" },
        windows: { desc: "需要 Windows 10 或更高版本。", arch: "x64 安装包", btn: "下载 Windows 版" },
        linux: { desc: "已在 Ubuntu, Debian, Mint 验证。", arch: ".deb / AppImage", btn: "下载 Linux 版" }
      }
    },
    changelogSection: {
      titleLevel1: "版本",
      titleLevel2: "更新日志。",
      desc: "了解 WinSSH 的最新功能、优化以及问题修复。",
      showMore: "展开完整日志",
      showLess: "收起",
      loadMore: "加载更多版本",
      viewAllOnGithub: "在 GitHub 上查看全部",
      versions: [
        {
          version: "v2.0.0",
          date: "2023年10月",
          isMajor: true,
          changes: [
             "新增跨平台同步功能（macOS、Windows 和 Linux）。",
             "引入针对连接配置和凭据信息的零知识加密。",
             "基于 WebGL 大幅重构终端渲染引擎，性能提升 300%。"
          ]
        },
        {
          version: "v1.5.0",
          date: "2023年8月",
          isMajor: false,
          changes: [
             "新增多路会话管理与服务器分组功能。",
             "优化了心跳保活与自动重连机制。",
             "修复了弱网环境下连接突然中断的问题。"
          ]
        },
        {
          version: "v1.0.0",
          date: "2023年5月",
          isMajor: true,
          changes: [
             "WinSSH 第一个公开可用版本正式发布。",
             "提供基础 SSH 终端模拟和自定义主题支持。",
             "支持公钥和密码方式的身份验证。"
          ]
        }
      ]
    },
    footer: {
      desc: "为现代开发者量身定制的下一代远程访问工具。高性能终端模拟与智能连接管理。",
      product: "产品",
      dl: "下载客户端",
      pricing: "产品定价",
      changelog: "更新日志",
      resources: "资源",
      docs: "技术文档",
      community: "开发者社区",
      github: "GitHub",
      legal: "法律法规",
      privacy: "隐私政策",
      terms: "服务条款",
      copyright: "© {year} WinSSH. 保留所有权利。",
      slogan: "为速度而生。"
    }
  }
};
