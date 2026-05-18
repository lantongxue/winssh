<div align="center">
  <img src="resources/icon.png" width="120" alt="WinSSH" />
  <h1>WinSSH</h1>
  <p>跨平台桌面 SSH 客户端，基于 Electron · React · TypeScript</p>

  ![version](https://img.shields.io/badge/version-1.1.5-blue)
  ![platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey)
  ![license](https://img.shields.io/badge/license-MIT-green)
</div>

---

WinSSH 把 SSH 会话、本地终端、SFTP、端口转发、凭据管理和主题系统整合进同一个窗口，不需要在多个工具之间来回切换。

## 功能

- **服务器管理** — 分组、标签、收藏、最近连接、Quick Connect
- **SSH 会话** — 连接 / 断开 / 重连，会话阶段状态追踪，known hosts 管理
- **凭据系统** — Credential Vault，支持密码和私钥鉴权，支持 Jump Server（单跳）
- **终端工作台** — SSH 终端与本地终端统一在同一个 Workbench 视图
- **SFTP** — 目录浏览、远端文件编辑、上传 / 下载、新建 / 重命名 / 删除、拖拽上传、批量选择
- **端口转发** — 本地转发与远程转发，重连后规则自动恢复
- **资源监控** — 远端 Linux 的 CPU / 内存 / 网络 / 磁盘实时采样
- **主题系统** — 内置主题 + ZIP 包导入，支持自定义字体
- **WebDAV 备份** — 远端备份列表、选择恢复、恢复后自动重启
- **应用更新** — Windows 打包版本支持自动检测 / 下载 / 安装

## 安装 & 运行

**环境要求：** Node.js 20+

```bash
git clone https://github.com/yourname/winssh.git
cd winssh
npm install
npm run dev
```

打包发布：

```bash
npm run dist:win    # Windows NSIS + ZIP
npm run dist:mac    # macOS DMG + ZIP
npm run dist:linux  # Linux AppImage + deb
```

## 技术栈

Electron 39 · React 19 · TypeScript 5 · Vite 7 · Tailwind CSS 4  
xterm.js · Monaco Editor · ssh2 · node-pty · better-sqlite3 · electron-updater · keytar

## 目录结构

```
src/
├── main/       主进程 — 数据库、SSH/SFTP/WebDAV、本地终端、更新
├── preload/    contextBridge & typed IPC Bridge
├── renderer/   React Workbench、状态管理、feature API Gateway
└── shared/     共享类型、Zod schema、主题、IPC 常量
themes/         内置主题包
web/            官网 & 文档入口子工程
docs/           主题开发文档等
scripts/        构建脚本 & 本地更新测试工具
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动开发模式 |
| `npm run build` | 类型检查 + 构建 |
| `npm run test` | 运行 Vitest |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run format` | Prettier |
| `npm run web:dev` | 启动 `web/` 子工程 |
| `npm run updates:mock` | 生成本地更新测试元数据 |
| `npm run updates:serve` | 启动本地更新测试服务 |

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `WINSSH_UPDATE_BASE_URL` | Windows 更新 feed 基础 URL |
| `WINSSH_ALLOW_DEV_UPDATES` | 开发模式下启用完整更新流程测试 |
| `WINSSH_HARDWARE_ACCELERATION` | 覆盖 Windows 默认硬件加速策略 |

## 已知限制

- 自动更新仅在 Windows 打包版本下可用，macOS / Linux 及 dev 模式不支持
- Jump Server 目前只支持单跳，暂不支持多级链式代理
- 资源监控依赖远端 Linux `/proc/*` 和 `df`，非 Linux 系统会静默回退
- SFTP 远端文件编辑适用于文本文件，不建议用于二进制或超大文件

## Contributing

欢迎提 Issue 和 PR。提交前请先跑：

```bash
npm run typecheck && npm run test
```

## 文档

- [`AGENTS.md`](AGENTS.md) — 工程快照与架构说明
- [`docs/theme-dev.md`](docs/theme-dev.md) — 主题开发指南
- [`web/`](web/) — 官网与文档入口