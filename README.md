# WinSSH

WinSSH 是一个基于 Electron、React 和 TypeScript 的跨平台桌面 SSH 工作台。它把保存的服务器、SSH 会话、本地终端、SFTP 文件管理 / 编辑、端口转发、主题系统、WebDAV 备份恢复和应用更新放进同一个桌面应用里；仓库同时包含 `web/` 品牌站与文档入口页。

## 项目概览

- 形态：Electron 桌面应用 + `web/` 官网 / docs landing 子工程
- 当前版本：`1.0.0`
- 当前阶段：MVP / Beta，已经不是原型壳
- 桌面端主栈：Electron 39、React 19、TypeScript 5、Vite 7、Tailwind CSS 4
- 核心运行时：xterm.js、Monaco Editor、ssh2、node-pty、better-sqlite3、electron-updater、keytar

## 主要能力

- 服务器管理：保存连接、分组、标签、收藏、最近连接、Quick Connect
- SSH 会话：连接、断开、重连、连接 phase 状态、known hosts 持久化
- 凭据能力：password / private key 鉴权、Credential Vault、服务器级 secret 记忆
- Jump Server：支持单跳 jump host
- 终端工作台：SSH 终端与本地终端共用一套 workbench / terminal surface
- SFTP：目录浏览、远端文本文件编辑 / 保存、上传、下载、新建文件、重命名、删除、拖拽上传、多选
- 端口转发：本地转发与远程转发，支持会话重连后的已启用规则恢复
- 资源监控：CPU / memory / network / disk 采样，当前为 Linux-only best-effort
- 主题系统：内置主题、ZIP 主题包导入 / 删除、系统字体枚举
- 备份恢复：WebDAV 远端备份、远端列表恢复、远端备份删除
- 产品化能力：更新检查 / 下载 / 安装、品牌识别、自定义图标、多语言、自定义标题栏

## 当前实现边界

- 自动更新当前只有 Windows 打包产物支持；`darwin` / `linux` 会进入 unsupported
- Jump Server 当前只支持单跳，不支持链式 jump host
- 会话资源监控依赖远端 Linux `/proc/*` 与 `df`，非 Linux 会明确回退为不可用
- SFTP 远端文件编辑基于 `sftp:readFile` / `sftp:writeFile` 和 Monaco Editor，当前主要面向文本文件
- 新的私钥主模型是“私钥内容直接入库”，`private_key_path` 主要用于旧数据兼容
- 当前 secret 模型是混合态：
  - 服务器级 password / passphrase 使用 `keytar`
  - 凭据库 secret 保存在 SQLite `credentials` 表
  - 服务器私钥内容可保存在 SQLite `servers.private_key`
- WebDAV 恢复当前是“从远端备份列表里显式选择一项后恢复”，恢复成功后会直接 relaunch 应用

## 仓库结构

```text
.
|-- src/
|   |-- main/        Electron 主进程、数据库、SSH/SFTP/更新/WebDAV 等运行时
|   |-- preload/     contextBridge 与 typed IPC bridge
|   |-- renderer/    React workbench、状态管理、feature API gateway
|   |-- shared/      共享类型、Zod 校验、主题 / 终端 / 更新等公共模型
|   `-- native/      原生辅助代码
|-- themes/
|   `-- builtin/     内置主题插件包
|-- web/             官网首页与 docs landing
|-- docs/            补充文档，当前包含主题开发文档
|-- scripts/         构建、更新模拟、平台 helper 脚本
|-- build/           打包资源与安装器配置
`-- AGENTS.md        详细工程快照与协作说明
```

## 架构摘要

- `src/main/index.ts` 现在是薄入口，只负责 `app.whenReady().then(bootstrap)`
- `src/main/bootstrap.ts` 负责主进程装配、生命周期和 IPC 注册
- `src/main/application/` 已拆出 `servers / sessions / settings` 用例编排层
- `src/main/ipc/` 已按 `server / session / system` 三组注册器拆分
- `src/renderer/src/features/*/api` 是 renderer 访问 preload bridge 的建议入口
- `window.winsshApi` 仍存在，但组件层不应直接访问它

## 环境要求

- 建议使用 Node.js 22 LTS 与 npm 10+
- 需要可运行 Electron 的桌面系统：Windows、macOS 或 Linux
- 仓库包含 `better-sqlite3`、`node-pty`、`keytar` 等原生依赖
- 如果对应平台没有可用的预编译二进制，需要安装本机原生构建工具链

## 快速开始

安装依赖：

```bash
npm install
```

启动桌面应用开发环境：

```bash
npm run dev
```

启动 `web/` 子工程开发环境：

```bash
npm run web:dev
```

预览已构建桌面应用：

```bash
npm run start
```

说明：

- `postinstall` 会自动执行 `build-macos-font-helper` 和 `electron-builder install-app-deps`
- 首次安装如果卡在原生依赖阶段，优先检查本机构建环境是否完整

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 启动桌面应用开发模式 |
| `npm run start` | 预览已构建桌面应用 |
| `npm run build` | 执行 typecheck 并构建桌面应用 |
| `npm run test` | 运行桌面端 Vitest 测试 |
| `npm run typecheck` | 执行 Node + Web TypeScript 检查 |
| `npm run lint` | 执行 ESLint |
| `npm run format` | 用 Prettier 格式化仓库 |
| `npm run web:dev` | 启动 `web/` 子工程开发模式 |
| `npm run web:build` | 构建 `web/` 子工程 |
| `npm run web:test` | 运行 `web/` 子工程测试 |
| `npm run dist` | 构建并打包当前平台产物 |
| `npm run dist:win` | 构建 Windows 安装包与 ZIP |
| `npm run dist:mac` | 构建 macOS DMG 与 ZIP |
| `npm run dist:linux` | 构建 Linux AppImage 与 DEB |
| `npm run updates:mock` | 生成本地更新测试用 release 元数据 |
| `npm run updates:serve` | 启动本地更新测试服务 |

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `WINSSH_UPDATE_BASE_URL` | Windows 自动更新 generic feed 的基础地址 |
| `WINSSH_ALLOW_DEV_UPDATES` | 允许开发态写出 `dev-app-update.yml` 并测试更新链路 |
| `WINSSH_HARDWARE_ACCELERATION` | 覆盖 Windows 默认关闭硬件加速的策略 |

## 开发现状

- 根据仓库内 `AGENTS.md` 的快照，最近一次明确通过的基础验证是 `2026-04-25` 的 `npm run typecheck`、指定 Vitest 测试和 `npm run build`
- `npm run lint` 当前仍存在仓库级历史问题，不应把“lint 全绿”当作默认基线
- WebDAV 备份 / 恢复链路已经产品化，当前恢复入口来自远端备份列表，而不是“自动恢复最新”
- SFTP 已经从远端目录管理扩展到基于 Monaco 的远端文本文件编辑器
- renderer 正在持续从直接消费 bridge 迁向 `features/*/api` 与更清晰的 command / view-model 分层

## 文档

- 详细工程快照：[`AGENTS.md`](./AGENTS.md)
- 主题开发文档：[`docs/theme-dev.md`](./docs/theme-dev.md)
- 官网与文档入口源码：[`web/`](./web)

## 适合先读的入口文件

- [`src/main/index.ts`](./src/main/index.ts)
- [`src/main/bootstrap.ts`](./src/main/bootstrap.ts)
- [`src/preload/index.ts`](./src/preload/index.ts)
- [`src/shared/types.ts`](./src/shared/types.ts)
- [`src/renderer/src/lib/workbench.ts`](./src/renderer/src/lib/workbench.ts)
- [`src/renderer/src/App.tsx`](./src/renderer/src/App.tsx)

