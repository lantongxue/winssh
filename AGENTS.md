# AGENTS.md

## 目的

这份文件用于给后续协作者和代码代理提供项目快照。内容基于 2026-04-01 对当前仓库的代码、Git 状态和本地命令检查结果整理而成。

## 项目快照

- 项目名：`winssh`
- 当前版本：`0.1.0`
- 目标定位：跨平台桌面 SSH / SFTP 客户端
- 技术栈：Electron 39、React 19、TypeScript 5、Vite 7、TanStack Query、Zustand、xterm.js、ssh2、better-sqlite3、keytar、i18next、shadcn/ui
- 当前工作区状态：`git status --short` 为空，仓库干净，没有未提交改动

## 当前阶段判断

项目已经过了纯脚手架阶段，当前不是“只有壳”的状态，核心主链路已经打通：

- 主进程已经接好数据库、凭据存储、会话管理、SFTP 操作、窗口控制和设置持久化
- 渲染进程已经形成完整的 workbench 交互框架，包含活动栏、侧边栏、编辑区、底部面板、命令中心和快速输入
- SSH 会话和 SFTP 浏览已能联动工作，不再是静态 UI

从最近提交记录看，近期工作重点集中在 workbench 化和稳定性修正：

- `2c14926` `Refactor app to workbench-only shell`
- `f9a3dd4` `Fix GPU command buffer failure`
- `24b4a83` `修复光标样式`
- `d1eba65` `优化改进`

综合判断：当前阶段更像是“可运行的 MVP / Beta 内核”，后续重点应转向质量清理、真实连接验证和功能补全，而不是重新搭骨架。

## 已落地能力

### 1. 主进程与数据层

- `src/main/index.ts` 已注册完整 IPC：
  - `groups:*`
  - `tags:*`
  - `servers:*`
  - `sessions:*`
  - `sftp:*`
  - `settings:*`
  - `system:*`
- `src/main/database.ts` 已使用 SQLite 持久化以下实体：
  - 服务器分组 `server_groups`
  - 标签 `tags`
  - 服务器 `servers`
  - 服务器标签关系 `server_tags`
  - 已知主机 `known_hosts`
  - 最近连接 `recent_sessions`
  - 应用设置 `app_settings`
- `src/main/secure-store.ts` 对接系统凭据存储，密码和私钥口令不直接落 SQLite
- `src/main/localization.ts` 和主进程翻译器已接入语言解析
- `src/main/window-config.ts` / `src/main/gpu-config.ts` 已处理窗口外观和 GPU 兼容配置

### 2. SSH / 会话层

- `src/main/session-manager.ts` 已接入 `ssh2`
- 已实现：
  - SSH 连接
  - shell 通道
  - SFTP 通道
  - 终端写入
  - 终端 resize
  - 会话断开
  - 会话重连
  - 输出事件推送
  - 错误和状态事件推送
- 已实现主机指纹校验与 known hosts 持久化
- 已在连接成功时记录最近会话和最后连接时间

### 3. SFTP 能力

- 已支持：
  - 目录列表
  - 刷新
  - 新建目录
  - 重命名
  - 删除单个文件或空目录
  - 上传文件
  - 下载文件
  - 传输进度事件
- 渲染层已有专门的 `SftpPanel`

### 4. 渲染层 / Workbench

- `src/renderer/src/components/workbench/` 已形成接近 IDE 的工作台结构
- 已有活动区：
  - Explorer
  - Terminal
  - Settings
- 已有文档类型：
  - 服务器编辑器
  - 会话编辑器
  - 设置编辑器
  - 终端欢迎页
- `WorkbenchPrimarySidebar` 已支持：
  - 收藏
  - 最近连接
  - 分组树
  - 标签树
  - 全部服务器
  - 右键菜单操作
- `WorkbenchContext` 已统一封装：
  - 连接
  - 断开
  - 重连
  - 收藏切换
  - 删除服务器
  - 快速输入弹层
  - 工作区数据刷新

### 5. 表单、设置与国际化

- 服务器编辑器已支持密码和私钥两种认证方式
- 已支持凭据记住策略、分组、标签、备注、收藏
- 设置页已支持：
  - 语言
  - 主题
  - 标题栏样式
  - 终端字体大小和字体族
  - 光标样式和闪烁
  - 选中即复制
  - known hosts 查看
- 已有 `zh-CN` / `en-US` 资源，并支持跟随系统语言

## 架构速览

- `src/main/`
  - Electron 主进程入口、数据库、会话管理、本地化、窗口和 GPU 配置
- `src/preload/`
  - `contextBridge` 暴露 `window.winsshApi`
- `src/shared/`
  - 跨进程共享类型、校验 schema、SFTP 路径工具、API 类型
- `src/renderer/src/`
  - React 应用、Workbench UI、store、hooks、i18n、终端与 SFTP 面板

多数组件级功能修改会同时影响 4 层：

1. `src/shared/types.ts`
2. `src/main/index.ts` 或 `src/main/session-manager.ts`
3. `src/preload/index.ts`
4. `src/renderer/src/*`

如果后续改动只动了其中一层，通常要检查是不是漏了接口同步。

## 已验证状态

以下结果已在 2026-04-01 本地执行验证：

- `npm test`
  - 通过，`8` 个测试文件、`26` 个测试全部通过
- `npm run typecheck`
  - 通过
- `npm run lint`
  - 未通过

当前 lint 失败的已确认错误有 4 个：

- `src/renderer/src/App.tsx`
  - `react-hooks/set-state-in-effect`
- `src/renderer/src/components/terminal-pane.tsx`
  - `react-hooks/set-state-in-effect`
- `src/renderer/src/components/workbench/workbench-titlebar.tsx`
  - `react-hooks/set-state-in-effect`
- `src/renderer/src/components/workbench/workbench-settings-editor.tsx`
  - `react-hooks/purity`，`Date.now()` 被认为是 impure call

除此之外，还有大量 Prettier 格式警告，当前 lint 基线不干净。

## 已知问题与风险

以下内容分为“已确认”与“工程判断”两类。

### 已确认

- 仓库当前 lint 不通过，后续较大改动前最好先把规则基线清理干净
- 当前测试以单元测试为主，没有覆盖真实 SSH / SFTP 连接链路
- 当前 SFTP 删除逻辑只区分文件和目录，目录删除走 `rmdir`，因此非空目录删除大概率会失败

### 工程判断

- 当前产品核心链路已经可用，但稳定性仍更依赖人工联调，而不是自动化回归
- 发布脚本已经配置好，但本轮没有执行 `dist` 或跨平台打包验证，产物链路是否完全稳定仍需单独确认
- Workbench 交互框架已成型，接下来新增功能更适合在现有文档/面板模型上扩展，而不是再改回多页面结构

## 下一步优先级建议

建议按下面顺序推进：

1. 清理 lint 错误和格式警告，恢复基础质量门禁
2. 做一轮真实服务器联调，覆盖密码登录、私钥登录、known hosts 首次信任、上传、下载、重连
3. 补强 SFTP 边界能力，优先看非空目录删除、失败提示和传输反馈
4. 视产品目标决定是否补充远程文件查看/编辑、批量传输或更完整的终端会话体验
5. 执行打包验证，至少确认 Windows 主链路稳定

## 协作约定

后续代理进入仓库后，建议先看这些文件：

- `package.json`
- `src/main/index.ts`
- `src/main/session-manager.ts`
- `src/main/database.ts`
- `src/preload/index.ts`
- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/renderer/src/components/workbench/workbench-shell.tsx`
- `src/renderer/src/components/workbench/workbench-context.tsx`

常用命令：

```bash
npm test
npm run typecheck
npm run lint
npm run dev
```

改动时要注意：

- 凭据不要写入 SQLite，密码和 passphrase 应继续走安全存储
- 连接、SFTP、设置类改动通常需要同时维护共享类型、IPC、preload API 和渲染层调用
- 如果改动 workbench 文档模型，优先沿用现有的 `activity + document + panel` 结构
- 当前仓库没有未提交改动，后续如果工作树变脏，应先区分是用户改动还是本轮任务改动，再决定如何处理
