# WinSSH

<div align="center">
  <img src="resources/icon.png" width="200" alt="WinSSH Logo" />
</div>

WinSSH 是 Electron + React + TypeScript 做的一个桌面 SSH 工具。起因很简单——市面上的 SSH 客户端要么功能残缺，要么界面老旧，要么需要同时开好几个窗口才能干完一件事。WinSSH 的目标是把常用的那些东西都塞进一个窗口里：SSH 会话、本地终端、SFTP、端口转发、凭据管理，以及一个能看着舒服的主题系统。

---

## 当前版本

`1.1.2`

---

## 功能一览

**服务器管理**  
支持分组、标签、收藏和最近连接记录，还有 Quick Connect 快速入口，连过的服务器不用每次手打。

**SSH 会话**  
连接、断开、重连都有，会话状态有明确的阶段提示，known hosts 也在应用内统一管理。

**凭据系统**  
内置 Credential Vault，支持密码和私钥两种鉴权方式，可以给每台服务器单独记住凭据。

**Jump Server**  
支持单跳代理，通过跳板机连内网服务器不用绕弯子。

**终端工作台**  
SSH 终端和本地终端共用同一套界面，切换起来很顺手，不用开多个窗口。

**SFTP**  
可以浏览远端目录、直接编辑远端文件（主要面向文本文件）、上传下载、新建重命名删除，支持拖拽上传和批量选择。

**端口转发**  
本地转发和远程转发都支持，会话断线重连后转发规则会自动恢复。

**资源监控**  
可以看远端 Linux 服务器的 CPU、内存、网络、磁盘实时数据，基于 `/proc/*` 和 `df` 实现，非 Linux 系统会自动回退。

**主题系统**  
内置了几套主题，也可以自己打包 ZIP 导入，字体也可以自定义。

**WebDAV 备份**  
支持把配置备份到 WebDAV 远端，可以查看备份列表、选择某个版本恢复，恢复完会自动重启应用。

**应用更新**  
Windows 打包版本支持自动检测更新、下载、安装，一套走完。

---

## 技术栈

| 层级 | 用的东西 |
|------|----------|
| 桌面框架 | Electron 39 |
| 前端 | React 19 + TypeScript 5 |
| 构建工具 | Vite 7 |
| 样式 | Tailwind CSS 4 |
| 终端 / 编辑器 | xterm.js / Monaco Editor |
| 底层能力 | ssh2 / node-pty / better-sqlite3 / electron-updater / keytar |

---

## 目录结构

```text
.
├── src/
│   ├── main/        主进程：数据库、SSH/SFTP/WebDAV/更新/本地终端运行时
│   ├── preload/     contextBridge 与 typed IPC Bridge
│   ├── renderer/    React Workbench、状态管理、feature API Gateway
│   └── shared/      共享类型、Zod 校验、主题、终端、更新、IPC 常量
├── themes/          内置主题包
├── web/             官网与 docs landing 子工程
├── docs/            额外文档（如主题开发指南）
├── scripts/         工具脚本与本地更新测试工具
├── build/           打包配置与安装器资源
└── AGENTS.md        工程快照与协作说明
```
---

## 快速开始

```bash
npm install
npm run dev
```

开发官网子工程：

```bash
npm run web:dev
```
---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Electron 开发模式 |
| `npm run dist:win` | 构建 Windows NSIS + ZIP |
| `npm run dist:mac` | 构建 macOS DMG + ZIP |
| `npm run dist:linux` | 构建 Linux AppImage + deb |

---

## 环境变量

| 变量 | 说明 |
|------|------|
| `WINSSH_UPDATE_BASE_URL` | Windows 更新 generic feed 的基础 URL |
| `WINSSH_ALLOW_DEV_UPDATES` | 允许开发态写出 `dev-app-update.yml` 并测试完整更新流程 |
| `WINSSH_HARDWARE_ACCELERATION` | 覆盖 Windows 默认的硬件加速策略 |

---

## 参与贡献

欢迎提 Issue 和 PR。提交前建议先跑一下：

```bash
npm run lint
npm run typecheck
npm run test
```

---

## 文档

- `AGENTS.md` — 工程快照与架构说明
- `docs/theme-dev.md` — 主题开发文档
- `web/` — 官网与 docs landing 代码