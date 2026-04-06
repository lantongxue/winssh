# AGENTS.md

## 说明

这份文件用于给后续协作者和代码代理提供当前项目快照。

本次梳理时间为 `2026-04-06`。内容只基于当前仓库代码、目录结构和关键入口文件阅读完成，没有执行 `test`、`typecheck`、`lint`、`build`、`dist` 等校验命令，因此这里描述的是“代码现状”，不是“已验证结果”。

## 这次梳理的关键结论

当前仓库最值得先知道的，不是“功能列表”，而是几条已经成型、并且会直接影响后续修改方式的主线。

### 1. 凭据库仍然是正式子系统，但当前依旧是混合 secret 模型

- `database.ts` 已有独立 `credentials` 表
- `servers` 表已有 `credential_id`
- 主进程已暴露：
  - `credentials:list`
  - `credentials:getSecret`
  - `credentials:create`
  - `credentials:update`
  - `credentials:delete`
- 设置页已有独立 `Credential Vault` 分区
- `CredentialVault` 组件支持新增、编辑、删除 password / private key 两类凭据
- 服务器编辑器支持选择 `credentialId`
- 选择凭据后，编辑器会自动预填 password / private key / passphrase，并同步 auth type 预览

但当前不是“纯引用式凭据模型”，而是明确的混合态：

- 凭据库 secret 当前直接保存在 SQLite `credentials` 表
- 服务器级 password / passphrase 仍然走 `keytar`
- 服务器私钥内容仍会写入 `servers.private_key`

与前一版说明相比，需要特别修正的一点是：

- 主进程现在已经在部分链路里直接读取凭据库 secret，而不只是渲染层预填
- `servers:getSecrets` 会优先返回 `credentialId` 对应凭据的 secret
- `resolveStoredPrivateKey()` 也会优先读取凭据库中的 `privateKey`

但 `SessionManager.resolveConnectionAuth()` / `establishConnection()` 仍没有直接把 `credentials` 表当成统一 secret provider，这条约束后面还在。

### 2. 私钥模型仍然以“内容入库”为主，旧路径兼容仍保留

- `ServerUpsertInput` 使用 `privateKey?: string | null`
- `servers` 表同时存在：
  - `private_key_path`
  - `private_key`
- `DatabaseService.getServerPrivateKey()` 已能直接读取私钥内容
- 新写入逻辑当前会把 `private_key_path` 置空
- `system:pickPrivateKey` 返回的是文件内容，不是文件路径
- 服务器编辑器和凭据库编辑器都已经是“文本域 + 浏览导入文件内容”的模式

因此当前状态不是“路径模式回退中”，而是：

- 新数据主模型是“私钥文本直接入库”
- `private_key_path` 主要承担旧数据兼容读取职责

### 3. 会话连接 phase 状态机继续贯穿，而且首次 connect 的 `sessionId` 透传已经打通

- `shared/types.ts` 定义了 `SESSION_CONNECTION_PHASES`
- `connectionRequestSchema` 现在已经声明 `sessionId`
- 当前 phase 包括：
  - `validate`
  - `handshake`
  - `prepare`
  - `attach`
- `SessionStateEvent` 带 `phase`
- `sessions-store` 会保存：
  - `connectionPhase`
  - `connectionStartedAt`
- `TerminalPane` 已使用 phase 驱动连接 overlay，而不是只看 loading
- renderer 仍会先创建 provisional session id
- `SessionManager` 继续支持复用传入的 `sessionId`
- `sessions:reconnect(sessionId)` 这条链路也仍然显式按既有 `sessionId` 复用

与上一版快照相比，需要明确修正的一点是：

- 首次 `sessions:connect` 现在已经可以真正沿用 renderer 生成的 provisional session identity
- `replaceSession()` / `replaceDocument()` 仍然保留，但当前主流程不再依赖“schema 漏洞外的真 id 替换”

如果后续要调整 provisional tab / reconnect / phase / session identity 这条链路，至少要一起改：

- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/main/index.ts`
- `src/renderer/src/components/workbench/workbench-context.tsx`
- `src/renderer/src/store/sessions-store.ts`
- 对应 tests

### 4. SSH 连接已经支持单跳 Jump Server，但当前仍不是统一 credential resolver

- `servers` 表已有 `jump_server_id`
- 服务器编辑器已支持选择现有 jump server
- 服务器编辑器也支持在表单里快速新建一个最小化 jump server 配置
- `SessionManager` 会先解析 jump server，再建立目标主机连接
- `request.secrets` 当前按 `server.id` 分桶，因此可以分别为目标机和 jump server 补录 secret

当前需要特别注意的边界是：

- jump server 只支持单跳
- `jumpServer.jumpServerId` 非空会被显式判定为 unsupported
- password / passphrase 当前来自 `request.secrets` 或 `keytar`
- private key 当前来自 `servers.private_key` 或 legacy `private_key_path`
- `credentials` 表当前不直接参与 `SessionManager` 的真实连接 secret 解析

### 5. 终端子系统已经拆成共享 surface，而且本地 shell 已是正式能力

- 主进程已有 `LocalTerminalManager`
- preload 已暴露 `localTerminals:*`
- renderer 已有 `local-terminals-store`
- workbench 已有 `local-terminal-editor`
- `TerminalSurface` / `useTerminal()` 现在同时服务 SSH 会话和本地终端

当前终端能力已经明确包括：

- xterm 搜索
- web link
- Unicode11
- image
- progress
- 可选 WebGL renderer

同时需要注意：

- 本地终端 runtime 依赖 `node-pty`
- 非 Windows 平台会尝试为 `spawn-helper` 修正可执行权限
- `experimentalTerminalWebgl` 当前是设置项控制的实验能力，不是默认硬开

### 6. 会话资源监控已经接进 session toolbar，但当前明确是 Linux-only best-effort

- `shared/types.ts` 已有 `SessionResourceSnapshot`
- 主进程已暴露 `sessions:getResourceSnapshot`
- session editor 顶部 toolbar 已嵌入 `SessionResourceMonitor`
- UI 会展示 CPU / memory / network / disk
- 当前轮询周期是 `2s`

当前实现特征：

- 主进程通过远端执行 Linux snapshot command 读取 `/proc/stat`、`/proc/meminfo`、`/proc/net/dev` 和 `df -P -B1 /`
- 资源监控只在 session `ready` 时可用
- CPU / network 第一次采样由于没有 baseline，速率或占用可能是 `null`
- 非 Linux 或采样失败会明确走：
  - `session_resource_linux_only`
  - `session_resource_unavailable`

### 7. SFTP 面板已经是轻量远端文件管理器，而不只是目录浏览器

当前已实现：

- 目录列表
- 当前路径编辑 / 跳转
- 新建空文件 `sftp:createFile`
- 新建目录
- 重命名
- 删除文件或目录
- 上传文件
- 下载文件
- 传输进度事件
- 多选
- shift 范围选择
- 右键菜单批量操作
- 路径复制
- 路径发送到终端
- 当前路径卡片
- 虚拟列表渲染

权限展示也已经不是单字符串，而是：

- `octal`
- `symbolic`

当前仍需注意的边界是：

- 删除目录仍走 `rmdir`
- 没有递归删除逻辑
- 非空目录仍是需要额外处理的边界

### 8. 端口转发已经是完整的会话级能力

当前代码已覆盖：

- 本地转发 `local`
- 远程转发 `remote`
- 规则创建
- 规则列表
- 启动规则
- 停止规则
- 删除规则
- 状态事件回传
- 会话断开时释放 runtime
- 会话重连后恢复已启用规则

当前实现特征：

- 规则快照保存在 `SessionManager` 内存里
- 没有数据库持久化
- `PortForwardPanel` 已是正式 UI
- UI 对 `0.0.0.0` / `::` 这类公开绑定地址有提示 warning

### 9. 主题系统已经不只是内置插件目录，而且支持 ZIP 主题包导入 / 删除

主题部分依旧是明确的“theme registry + theme document + theme id”模型：

- `ThemeRegistry`
- 内置主题插件目录
- 用户主题目录
- 主题 manifest / theme document schema
- `themes:list`
- `themes:importArchive`
- `themes:deletePlugin`
- 设置页按 theme id 保存
- 命令面板直接切主题
- 状态栏显示当前主题
- 终端跟随主题终端色板与默认字体策略

与上一版快照相比，新的一条主线是：

- 设置页已经支持导入 ZIP 主题包
- 设置页已经支持删除导入的用户主题包
- 内置主题包不可删除
- 删除正在使用的用户主题包后，主进程会把非法 selection 归一化 / 回退

当前内置主题包至少包括：

- `winssh-default-themes`
- `winssh-liquid-glass`

内置主题至少包括：

- `winssh.light-plus`
- `winssh.dark-plus`
- `winssh.pixel-crt`
- `winssh.liquid-glass-light`
- `winssh.liquid-glass-dark`

系统字体能力也仍然接进设置页：

- 主进程暴露了 `system:listFonts`
- `SystemFontService` 会按平台枚举字体
- macOS 优先使用原生 helper，再回退 `system_profiler` / `fc-list`
- `scripts/build-macos-font-helper.mjs` 会构建 `resources/bin/macos-list-fonts`

### 10. 服务器元数据模型已经扩到 Jump Server、品牌识别和自定义图标

- `shared/types.ts` 当前已有：
  - `brandId`
  - `customIconDataUrl`
  - `jumpServerId`
- `ServerUpsertInput` 已支持：
  - `customIconMimeType`
  - `customIconData`
  - `jumpServerId`
- `servers` 表当前已有：
  - `brand_id`
  - `custom_icon_mime_type`
  - `custom_icon`
  - `jump_server_id`

同时，当前已经存在一条新的连接后副作用链路：

- 首次成功 SSH 连接后，主进程会 best-effort 读取 `/etc/os-release` 或 `/usr/lib/os-release`
- `SessionManager` 会根据内容识别 server brand，并把结果持久化到 `servers.brand_id`
- 用户可以通过 `system:pickServerIcon` 选择自定义图标
- 自定义图标存储在 SQLite BLOB 中，并且在展示层覆盖品牌图标，但不会清空 `brand_id`

### 11. Workbench 结构和标题栏交互继续产品化，资源树和标签页都明显更完整了

当前 workbench 已经稳定围绕这些元素组织：

- activity bar
- primary sidebar
- editor tabs
- bottom panel
- status bar
- titlebar
- command palette
- quick open
- quick input

当前文档类型包括：

- `server-editor`
- `session-editor`
- `local-terminal-editor`
- `settings-editor`
- `terminal-welcome`

当前底部面板包括：

- `output`
- `transfers`
- `problems`

当前标题栏能力包括：

- 内置 WinSSH logo SVG
- quick open
- command palette
- toggle sidebar
- toggle panel
- 自定义标题栏下的窗口控制按钮

另外，workbench chrome 状态当前会持久化到浏览器存储：

- active activity
- active panel
- collapsed explorer sections
- selected explorer node
- sidebar / panel 打开状态

同时，最近已经能直接从代码确认这些交互升级：

- primary sidebar 支持服务器搜索
- primary sidebar 支持把服务器拖到分组 / ungrouped
- 分组右键菜单支持直接新建服务器
- editor tabs 支持拖拽重排
- editor tabs 支持重命名 title override
- explorer home / terminal welcome 都已有本地终端入口

### 12. 平台与交付层也已经有明确策略

当前可以直接从代码确认：

- `build/installer.nsh` 已开启 `ManifestDPIAware true`
- Windows 默认会关闭硬件加速
- 可通过环境变量 `WINSSH_HARDWARE_ACCELERATION` 覆盖
- 标题栏样式支持 `native | custom`
- 切换标题栏样式后，设置页会提示重启应用
- 打包脚本已经拆出：
  - `dist:win`
  - `dist:mac`
  - `dist:linux`

## 项目概览

- 项目名：`winssh`
- 版本：`0.1.0`
- 形态：Electron 桌面应用
- 目标：提供面向桌面的 SSH、SFTP、端口转发和工作台式连接管理

主要技术栈：

- Electron 39
- React 19
- TypeScript 5
- Vite 7
- TanStack Query
- Zustand
- xterm.js
- node-pty
- ssh2
- better-sqlite3
- keytar
- adm-zip
- i18next
- shadcn/ui

## 当前阶段判断

当前项目已经不是原型壳，而是工作台结构、主进程能力和配置管理都比较完整的桌面客户端。

按当前代码看，产品已经同时覆盖：

- 服务器配置管理
- 分组 / 标签管理
- 凭据库管理
- Jump Server
- SSH 会话连接 / 断开 / 重连
- 远端会话资源监控
- 终端交互
- 本地 shell / local terminal
- SFTP 浏览与传输
- 会话级端口转发
- 主题系统与用户主题包导入 / 删除
- 服务器品牌识别 / 自定义图标
- 设置中心
- known hosts 管理
- quick connect
- 多语言
- 自定义标题栏
- 系统字体枚举

更准确地说，现在处于“功能骨架已经完成，开始继续补安全策略、平台细节和产品化体验”的 MVP/Beta 阶段。

## 核心架构

### `src/main/`

负责：

- Electron 主进程入口
- SQLite 数据库
- 系统安全存储
- SSH / SFTP / 端口转发运行时
- 本地 shell / `node-pty` 运行时
- 主题包导入 / 删除
- 会话资源采样
- 服务器品牌探测
- 主题注册与解析
- 主进程本地化
- GPU / 窗口配置
- 系统字体枚举

### `src/preload/`

负责：

- `contextBridge`
- 将主进程能力统一暴露为 `window.winsshApi`

### `src/shared/`

负责：

- 共享类型
- Zod 校验
- SFTP 路径工具
- quick connect 解析
- server brand / icon 定义
- 主题定义与 schema
- preload / renderer 共用 API 类型

### `src/renderer/src/`

负责：

- React 应用入口
- Workbench UI
- Zustand store
- React Query 数据流
- SSH 终端 / 本地终端 / SFTP / 端口转发界面
- 会话资源监控
- 服务器品牌 / 自定义图标展示
- 设置页
- i18n 资源

## 主进程现状

`src/main/index.ts` 当前已接入：

- `DatabaseService`
- `SecureStoreService`
- `SessionManager`
- `LocalTerminalManager`
- `ThemeRegistry`
- `SystemFontService`
- 主进程本地化解析
- GPU 配置
- 窗口 chrome 配置

当前 IPC 分组包括：

- `credentials:*`
- `groups:*`
- `tags:*`
- `servers:*`
- `sessions:*`
- `localTerminals:*`
- `sftp:*`
- `portForwards:*`
- `themes:*`
- `settings:*`
- `system:*`

当前比较关键的 IPC 包括：

- `credentials:*`
- `servers:getSecrets`
- `sessions:getResourceSnapshot`
- `localTerminals:*`
- `sftp:createFile`
- `themes:list`
- `themes:importArchive`
- `themes:deletePlugin`
- `system:pickServerIcon`
- `system:listFonts`
- `system:getCapabilities`
- `system:removeKnownHost`
- `system:relaunch`
- `system:window:*`

## 数据层现状

`src/main/database.ts` 当前持久化：

- 服务器分组
- 标签
- 凭据库条目
- 服务器配置
- 服务器到凭据库的引用关系
- 服务器到 jump server 的自引用关系
- 服务器品牌标识与自定义图标
- 服务器与标签关系
- known hosts
- 最近连接记录
- 应用设置

当前没有数据库级的端口转发表，也没有本地终端持久化模型，因此端口转发规则和 local terminal 都仍是运行时内存状态。

### 服务器表现状

`servers` 表当前包括这些关键字段：

- `auth_type`
- `brand_id`
- `custom_icon_mime_type`
- `custom_icon`
- `private_key_path`
- `private_key`
- `credential_id`
- `jump_server_id`
- `group_id`
- `favorite`
- `last_connected_at`

当前写入策略是：

- `private_key` 写入内容本身
- `private_key_path` 新写入时置空
- `credential_id` 通过外键引用 `credentials(id)`
- `jump_server_id` 通过自引用外键指向 `servers(id)`
- `custom_icon_*` 可直接持久化用户选中的图标 bytes
- `brand_id` 初始可能为 `NULL`，首次成功 SSH 连接后会 best-effort 更新

### 凭据表现状

`credentials` 表当前保存：

- `kind`
- `username`
- `password`
- `private_key`
- `passphrase`
- `note`

当前 `credentials:list()` 只返回 metadata：

- `id`
- `name`
- `kind`
- `username`
- `note`
- `createdAt`
- `updatedAt`

secret 需要通过 `credentials:getSecret()` 单独取。

### 最近连接现状

- `recordRecentSession()` 会把最近连接写入 `recent_sessions`
- 数据库层会保留最近 `20` 条
- `listRecentSessions()` 默认返回最近 `8` 条

## 安全存储现状

当前 secret 存储已经明确分成三类：

- 服务器级 password / passphrase：`keytar`
- 服务器私钥内容：SQLite `servers.private_key`
- 凭据库 secret：SQLite `credentials.password / private_key / passphrase`

因此现在不能再假设“所有 secret 都只在系统安全存储里”。

`SecureStoreService` 当前特征：

- 能力探测结果会缓存
- `keytar` 不可用时返回 fail-soft 结果
- 删除 secret 时不会把 keychain 异常抛到主流程
- 当前只负责服务器级 `password` / `passphrase`
- 不负责凭据库表中的 secret

另外需要注意：

- `servers:list()` 返回的 `hasPassword` / `hasPassphrase` 只反映 keytar 状态
- 它们不反映 `credentials` 表中是否存在 secret

## SSH / 会话层现状

`src/main/session-manager.ts` 当前覆盖：

- SSH 连接建立
- 单跳 Jump Server
- shell 通道
- SFTP 通道
- 终端写入
- 终端窗口 resize
- 主机指纹校验
- known hosts 持久化
- 会话断开
- 会话重连
- 最近连接记录
- 会话状态事件
- 输出事件
- 错误事件
- 端口转发状态维护
- 远端资源快照采样
- 首次成功连接后的 server brand 探测

当前连接接口返回结构化结果 `SessionConnectResult`：

- 成功：`{ ok: true, summary }`
- 失败：`{ ok: false, code, message }`

失败码包括：

- `secret_required`
- `auth_failed`
- `connection_failed`

### 当前连接凭据解析规则

`SessionManager.establishConnection()` / `resolveConnectionAuth()` 当前解析 secret 的方式是：

- `request.secrets` 当前按 `server.id` 分桶，可以同时携带 jump server 和目标机的 secret
- `password = request.secrets?.[server.id].password ?? keytar`
- `passphrase = request.secrets?.[server.id].passphrase ?? keytar`
- `privateKey = servers.private_key ?? legacy private_key_path`

也就是说，当前真正的 SSH 连接主流程里：

- password / passphrase 不直接从 `credentials` 表读
- private key 也不直接按 `credential_id` 读
- jump server 和目标机的 recoverable secret 都通过 `request.secrets[server.id]` 区分

但主进程的其他链路已经部分引入凭据库：

- `servers:getSecrets` 会优先返回 `credentialId` 对应凭据的 secret
- `resolveStoredPrivateKey()` 会优先返回 credential vault 中的 `privateKey`

所以当前现状不是“凭据库完全不进主进程”，而是：

- 主进程已在编辑器 secret 读取链路里读取凭据库
- 但 `SessionManager` 还不是统一的 credential resolver

另外当前 jump server 有一个明确约束：

- 只支持单跳
- 如果 jump server 本身还有 `jumpServerId`，会直接视为 unsupported

### 连接 phase 状态

当前主进程会主动发送连接 phase：

- `validate`
- `handshake`
- `prepare`
- `attach`

这套 phase 现在是主进程真实驱动，不是 UI 自己模拟。

### `sessionId` 现状

代码里关于 `sessionId` 的现状需要分开看：

- 类型层 `ConnectionRequest` 支持可选 `sessionId`
- `connectionRequestSchema` 已经声明 `sessionId`
- `SessionManager` 也支持使用传入的 `sessionId`
- renderer 会先创建 provisional session id
- `sessions:reconnect(sessionId)` 明确按既有 `sessionId` 重连

这意味着当前首次连接的 UI 连续性现在已经可以真实建立在同一个 session identity 上：

- 先创建 provisional tab
- 首次 `sessions:connect` 会把这个 provisional `sessionId` 透传到主进程
- `replaceSession()` / `replaceDocument()` 仍会执行，但当前主流程不再依赖“schema 缺口导致的真 id 替换”

如果后续要强化“首次 connect 全链路共用同一个 session identity”，至少要同步改：

- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/main/index.ts`
- `src/renderer/src/components/workbench/workbench-context.tsx`
- `src/renderer/src/store/sessions-store.ts`
- 对应 tests

### 资源监控现状

- `sessions:getResourceSnapshot` 只在 session `ready` 时可用
- 当前主进程通过远端执行 Linux snapshot command 读取：
  - `/proc/stat`
  - `/proc/meminfo`
  - `/proc/net/dev`
  - `df -P -B1 /`
- 返回结构化 `SessionResourceSnapshot`
- CPU / network 第一次采样由于没有 baseline，速率或占用可能为 `null`
- 非 Linux 或采样失败时，主进程会明确返回：
  - `session_resource_linux_only`
  - `session_resource_unavailable`

## 本地终端现状

当前项目已经有正式的本地终端能力，不再只是 SSH session 的附属视图。

已实现内容：

- `LocalTerminalManager`
- `localTerminals:create`
- `localTerminals:close`
- `localTerminals:write`
- `localTerminals:resize`
- 本地终端 data / state / exit 事件
- `local-terminals-store`
- `local-terminal-editor`
- terminal welcome / explorer home / command entrypoint 打开本地终端

当前关键特征：

- 本地终端和 SSH terminal 共享 `TerminalSurface` / `useTerminal()` 渲染栈
- 终端能力当前已统一覆盖 search / web-links / Unicode11 / image / progress / 可选 WebGL
- 终端主题、字体、光标、copy-on-select 等设置会同时影响 SSH terminal 和 local terminal
- `LocalTerminalManager` 会按平台选择 shell，并在非 Windows 平台 best-effort 修正 `node-pty` 的 `spawn-helper` 可执行权限
- 本地终端当前没有数据库持久化模型，生命周期绑定在本次应用运行期

## SFTP 现状

当前已实现：

- 目录列表
- 刷新
- 当前路径编辑 / 跳转
- 返回上一级
- 新建空文件
- 新建目录
- 重命名
- 删除文件或目录
- 上传文件
- 下载文件
- 传输进度事件
- 多选
- shift 范围选择
- 路径复制
- 路径发送到终端
- 当前路径卡片
- 虚拟列表

### SFTP 元数据

`RemoteEntry.permissions` 当前结构是：

- `octal`
- `symbolic`

主进程有明确的权限格式化逻辑，覆盖：

- 普通文件
- 目录
- 符号链接
- 特殊位

### SFTP 面板交互

当前 `SftpPanel` 已支持：

- 项目单选
- ctrl/cmd 多选
- shift 范围选择
- 右键菜单批量操作
- 目录双击进入
- 空白区域清除选择
- header 关闭 aux panel

仍需注意的边界：

- 非空目录删除未做递归
- 删除批量操作当前是逐项串行调用

## 端口转发现状

项目当前已经具备完整的会话级端口转发能力。

已实现内容：

- 规则创建
- 规则列表
- 启动规则
- 停止规则
- 删除规则
- 本地转发 `local`
- 远程转发 `remote`
- 状态事件回传
- 会话重连后迁移并恢复已启用规则

当前关键特征：

- 生命周期绑定在 session
- 规则快照保存在 `SessionManager` 内存中
- 会话断开后，启用中的规则会被标记为错误状态
- 不是数据库持久化模型
- UI 会对公开监听地址给出 warning

## 主题与外观现状

主题系统已经是正式能力，不再只是 light/dark 布尔切换。

### 主题模型

`src/shared/themes.ts` 当前定义了：

- `ThemeSelection`
- `ThemeAppearance`
- `ThemeSource`
- workbench 颜色 token
- terminal 颜色 token
- terminal 默认字体 / 字号 / 行高
- 主题插件 manifest schema
- theme document schema
- theme import / delete 结果类型

`ThemeMode` 当前本质上就是 theme selection string。

### 主题注册

`src/main/theme-registry.ts` 当前负责：

- 加载内置主题目录
- 加载用户主题目录
- 解析主题插件 `package.json`
- 解析主题 JSON
- 去重主题 id
- ZIP 主题包导入
- 用户主题包删除
- archive 路径安全校验
- 校验主题选择是否合法
- 把非法主题选择归一化为 `system`
- 计算窗口背景色

当前主题目录：

- 内置主题：`themes/builtin`
- 用户主题：`app.getPath('userData')/themes`

### 当前内置主题

当前内置主题至少包括：

- `winssh.light-plus`
- `winssh.dark-plus`
- `winssh.pixel-crt`
- `winssh.liquid-glass-light`
- `winssh.liquid-glass-dark`

其中：

- `Pixel CRT` 带终端默认字体策略
- `Liquid Glass` 系列引入更明确的玻璃和 overlay token

### 渲染层主题应用

`src/renderer/src/App.tsx` 当前会：

- 读取 settings
- 读取 themes 列表
- 根据系统深浅色偏好解析最终主题
- 将主题 token 写入 `document.documentElement`
- 在语言和主题都准备好之后再渲染 workbench

主题切换入口当前包括：

- `WorkbenchSettingsEditor`
- `WorkbenchCommandCenter`
- `WorkbenchStatusBar`

设置页当前还直接承担这些主题包管理能力：

- 列出 imported user theme packs
- 导入 ZIP 主题包
- 删除 imported theme pack
- 删除后刷新 theme list 和当前 selection

## System Font / 平台能力现状

`SystemFontService` 当前已经是正式主进程服务。

跨平台策略大致如下：

- Windows：PowerShell 枚举字体，失败时回退注册表
- Linux：使用 `fc-list`
- macOS：优先原生 helper，失败后回退 `system_profiler`，再回退 `fc-list`

当前相关文件包括：

- `src/main/system-fonts.ts`
- `src/native/macos/list-fonts.m`
- `scripts/build-macos-font-helper.mjs`
- `resources/bin/macos-list-fonts`

另外平台相关策略还包括：

- `windowTitleBarStyle = native | custom`
- Windows 默认关闭硬件加速
- 环境变量 `WINSSH_HARDWARE_ACCELERATION` 可覆盖

## Workbench 现状

当前渲染层已经是明确的 workbench 结构，而不是传统多页面表单应用。

核心布局在 `src/renderer/src/components/workbench/workbench-shell.tsx`，包含：

- 标题栏
- 活动栏
- 主侧边栏
- 编辑区
- 底部面板
- 命令面板
- 快速输入
- 状态栏

当前活动区：

- `explorer`
- `terminal`
- `settings`

当前文档类型：

- `server-editor`
- `session-editor`
- `local-terminal-editor`
- `settings-editor`
- `terminal-welcome`

当前底部面板：

- `output`
- `transfers`
- `problems`

### workbench store 现状

`workbench-store` 当前会持久化这些 UI 状态：

- `activeActivityId`
- `activePanelId`
- `collapsedSections`
- `panelOpen`
- `selectedExplorerNode`
- `sidebarOpen`

不持久化的主要是：

- open documents
- output entries
- transfer entries
- problems

### 资源树与标签页现状

当前代码已经可以直接确认这些交互：

- primary sidebar 支持服务器搜索和 deferred filtering
- primary sidebar 支持把 server 拖到 group / ungrouped
- server / group / tag 都有右键菜单
- group 右键菜单可以直接新建 server
- editor tabs 支持拖拽重排
- editor tabs 支持 rename title override
- 关闭 session tab / local terminal tab 会触发真实 disconnect / close，而不是只关 UI

### 标题栏与导航现状

`WorkbenchTitlebar` 当前支持：

- WinSSH logo
- quick open
- command palette
- sidebar / panel toggle
- 自定义标题栏下的窗口控制

`WorkbenchShell` 当前支持：

- 快捷键处理
- explorer / terminal / settings legacy route 同步
- terminal activity 在 session / local terminal / terminal welcome 之间切换
- panel / sidebar resizable layout

## 会话编辑器现状

`src/renderer/src/components/workbench/workbench-session-editor.tsx` 当前支持：

- 终端主视图
- session toolbar 资源监控
- SFTP 辅助侧栏
- 端口转发辅助侧栏
- 会话重连
- 会话断开
- 复制当前服务器 IP / host
- 基于当前主题渲染终端外观

`sessions-store` 当前还记录：

- `auxView`
- `connectionPhase`
- `connectionStartedAt`
- `lastMessage`
- `provisional`

说明当前会话 UI 已经明确管理连接生命周期和临时 tab 状态。

## 本地终端编辑器现状

`src/renderer/src/components/workbench/workbench-local-terminal-editor.tsx` 当前支持：

- 共享 terminal theme / settings
- shell 与 cwd 头部展示
- running / exited / error 状态展示
- 关闭本地终端
- 复用 `TerminalSurface`

`local-terminals-store` 当前记录：

- `tabs`
- `activeTerminalId`
- `lastMessage`
- `status`

## 服务器管理现状

服务器编辑器当前支持：

- 名称、主机、端口、用户名
- 密码认证
- 私钥认证
- 记住密码 / 记住口令
- 分组
- 标签
- 收藏
- 备注
- `credentialId`
- `jumpServerId`
- 自定义图标

### 私钥编辑器现状

当前私钥输入方式已经从“路径”转成“文本内容”：

- UI 使用 `Textarea`
- 浏览按钮会读取文件内容并写入文本域
- 编辑器会通过 `servers:getSecrets` 回填保存内容

### Jump Server 现状

当前服务器编辑器里：

- 可以绑定一个现有 `jumpServerId`
- 也可以直接在表单里快速新建一个 jump server
- jump server 创建成功后会自动回填到当前表单

当前运行时约束：

- 只支持单跳
- jump server 本身不能继续引用 jump server
- recoverable secret prompt 可能针对 jump server 或目标机分别出现

### 品牌和自定义图标现状

当前服务器元数据已经不只是 name / host / auth：

- 首次成功连接后会 best-effort 自动识别 server brand
- 编辑器会展示当前 brand 状态
- 用户可以导入自定义图标
- 自定义图标展示优先级高于 brand icon，但不会清掉 `brandId`

展示层当前至少这些位置已经统一使用 `ServerBrandIcon`：

- 服务器编辑器
- primary sidebar
- explorer home
- command center
- editor tabs

### 凭据选择器现状

当前服务器编辑器里：

- 可以绑定一个 `credentialId`
- 选择 password 凭据时会预填 password 并把 auth type 切到 `password`
- 选择 private key 凭据时会预填 private key / passphrase 并切到 `privateKey`

但要特别注意一个现实约束：

- 这些 secret 预填后仍然会进入表单值
- `toPayload()` 当前会把 `privateKey` 直接写入 `servers.private_key`

这意味着当前不是“服务器只引用凭据、不再保存 secret”，而是很容易形成复制写入。

## Quick Connect 现状

项目当前已经有 quick connect 流程。

关键点：

- `WorkbenchCommandCenter` 的 quick open 支持 quick connect
- `src/shared/quick-connect.ts` 当前只接受精确语法：`ssh user@host`
- 当前 quick connect 只面向密码认证
- 默认端口固定为 `22`
- 如果已存在匹配服务器配置，会直接复用
- 如果不存在，会自动创建一个 password 类型服务器配置再连接
- 密码通过 quick input 补录

当前 quick connect 和 provisional session 的关系是：

- renderer 会先创建 provisional tab
- 失败时可以在 quick input 里补录 password 重试
- 当前首次 connect 的 `sessionId` 已经可以真正透传到主进程
- quick connect 的补录与重试可以继续沿用同一个 provisional session identity

## 设置与安全现状

设置页当前支持：

- 语言
- 主题选择
- 主题包导入 / 删除
- 标题栏样式
- 终端字体大小
- 终端字体族
- experimental terminal WebGL
- 光标样式
- 光标闪烁
- 选中即复制
- known hosts 列表查看
- known hosts 删除
- 凭据库管理

设置页当前分区包括：

- `appearance`
- `terminal`
- `security`
- `credentialVault`

安全相关能力当前包括：

- 系统凭据存储可用性探测
- known hosts 指纹信任
- known hosts 管理
- 主机指纹变更 warning
- 私钥内容回填与旧路径兼容

## 凭据库现状

当前凭据库是明确的产品能力，不再只是预留字段。

已实现内容：

- 凭据列表
- 新增凭据
- 编辑凭据
- 删除凭据
- password 型凭据
- private key 型凭据
- 私钥文件内容导入

当前入口位于：

- 设置页 `Credential Vault`
- 服务器编辑器 `credentialId` 选择器

当前行为特征：

- 服务器可以绑定一个 `credentialId`
- 编辑器选择凭据后会把 secret 预填进当前表单
- `servers:getSecrets` 会优先从凭据库返回 secret
- 删除凭据后，`servers.credential_id` 通过 `ON DELETE SET NULL` 自动清空

但当前仍然是混合模型，不是纯引用模型：

- `SessionManager` 连接主流程不直接从凭据库解析 password / passphrase / private key
- 服务器表单保存或连接时，private key 很容易继续落到 `servers.private_key`
- `hasPassword` / `hasPassphrase` 状态仍主要反映 keytar，而不是凭据库

## 国际化现状

当前至少存在：

- `zh-CN`
- `en-US`

并且本地化不是只作用于 renderer：

- 主进程会用当前语言生成系统对话文案
- 渲染层会根据设置和系统语言切换资源

主进程当前已覆盖的本地化文案包括：

- 私钥选择对话框
- 上传 / 下载对话框
- 主机指纹首次信任 / 变更提示
- 常见连接错误
- 会话状态文案

## 测试版图现状

虽然本次没有执行测试，但从文件分布看，当前测试面已经覆盖这些方向：

- `database`
- `session-manager`
- `session-manager.connect`
- `local-terminal-manager`
- `theme-registry`
- `window-config`
- `gpu-config`
- `system-fonts`
- `localization`
- `sftp` 工具
- `quick-connect`
- `validation`
- `theme` helper
- `use-terminal`
- `terminal-surface`
- `use-prefers-dark`
- `terminal-pane`
- `session-resource-monitor`
- `sftp-panel`
- `server-brand-icon`
- `workbench-primary-sidebar`
- `workbench-explorer-home`
- `workbench-titlebar`
- `workbench-settings-editor`
- `workbench-server-editor`
- `workbench-quick-input`
- `workbench-command-center`
- `workbench-editor-tabs`
- `workbench-session-editor`
- `workbench-local-terminal-editor`
- `workbench-shell`
- `sessions-store`
- `local-terminals-store`
- `workbench-store`
- `workbench-shortcuts`
- i18n format / index

说明代码库已经在持续补充回归面，不再只是人工联调。

## 关键数据流

多数功能改动会同时影响以下几层：

1. `src/shared/types.ts`
2. `src/shared/validation.ts`
3. `src/shared/api.ts`
4. `src/main/index.ts` 或 `src/main/session-manager.ts`
5. `src/preload/index.ts`
6. `src/renderer/src/*`

如果只改主进程或只改渲染层，很容易出现接口失配。

主题相关改动还会多牵涉：

- `src/shared/themes.ts`
- `src/main/theme-registry.ts`
- `themes/builtin/*`
- `src/renderer/src/lib/theme.ts`
- `src/renderer/src/components/workbench/workbench-settings-editor.tsx`

私钥、凭据和连接流程相关改动还会多牵涉：

- `src/main/database.ts`
- `src/main/index.ts`
- `src/main/session-manager.ts`
- `src/main/secure-store.ts`
- `src/renderer/src/components/credential-vault.tsx`
- `src/renderer/src/components/workbench/workbench-server-editor.tsx`
- `src/renderer/src/components/workbench/workbench-quick-input.tsx`
- `src/renderer/src/store/sessions-store.ts`
- `src/renderer/src/components/terminal-pane.tsx`

本地终端与共享 terminal surface 相关改动还会多牵涉：

- `src/main/local-terminal-manager.ts`
- `src/preload/index.ts`
- `src/shared/types.ts`
- `src/shared/api.ts`
- `src/renderer/src/components/terminal-surface.tsx`
- `src/renderer/src/hooks/use-terminal.ts`
- `src/renderer/src/components/workbench/workbench-local-terminal-editor.tsx`
- `src/renderer/src/store/local-terminals-store.ts`
- `src/renderer/src/hooks/use-session-events.ts`

资源监控相关改动还会多牵涉：

- `src/shared/types.ts`
- `src/shared/api.ts`
- `src/main/session-manager.ts`
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/renderer/src/components/session-resource-monitor.tsx`
- `src/renderer/src/components/workbench/workbench-session-editor.tsx`

Jump Server、server brand、自定义图标相关改动还会多牵涉：

- `src/shared/server-brands.ts`
- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/main/database.ts`
- `src/main/session-manager.ts`
- `src/main/index.ts`
- `src/renderer/src/components/server-brand-icon.tsx`
- `src/renderer/src/components/workbench/workbench-server-editor.tsx`
- `src/renderer/src/components/workbench/workbench-editor-tabs.tsx`
- `src/renderer/src/components/workbench/workbench-primary-sidebar.tsx`
- `src/renderer/src/components/workbench/workbench-command-center.tsx`
- `src/renderer/src/components/workbench/workbench-explorer-home.tsx`

如果要调整 `sessionId` / provisional session identity 链路，还必须同步改：

- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/main/index.ts`
- `src/renderer/src/components/workbench/workbench-context.tsx`
- `src/renderer/src/store/sessions-store.ts`
- 对应 tests

## 建议优先阅读的文件

第一次接手仓库，建议先看：

- `package.json`
- `src/main/index.ts`
- `src/main/session-manager.ts`
- `src/main/local-terminal-manager.ts`
- `src/main/database.ts`
- `src/main/secure-store.ts`
- `src/main/system-fonts.ts`
- `src/main/theme-registry.ts`
- `src/main/window-config.ts`
- `src/main/gpu-config.ts`
- `src/preload/index.ts`
- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/shared/api.ts`
- `src/shared/server-brands.ts`
- `src/shared/themes.ts`
- `src/shared/quick-connect.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/components/server-brand-icon.tsx`
- `src/renderer/src/components/session-resource-monitor.tsx`
- `src/renderer/src/components/credential-vault.tsx`
- `src/renderer/src/components/terminal-surface.tsx`
- `src/renderer/src/lib/theme.ts`
- `src/renderer/src/components/workbench/workbench-shell.tsx`
- `src/renderer/src/components/workbench/workbench-context.tsx`
- `src/renderer/src/store/sessions-store.ts`
- `src/renderer/src/store/local-terminals-store.ts`

如果要改会话辅助能力，再看：

- `src/renderer/src/components/sftp-panel.tsx`
- `src/renderer/src/components/port-forward-panel.tsx`
- `src/renderer/src/components/workbench/workbench-session-editor.tsx`
- `src/renderer/src/components/workbench/workbench-local-terminal-editor.tsx`
- `src/renderer/src/components/terminal-pane.tsx`
- `src/renderer/src/hooks/use-session-events.ts`

如果要改主题，再看：

- `themes/builtin/winssh-default-themes/package.json`
- `themes/builtin/winssh-liquid-glass/package.json`
- `themes/builtin/winssh-default-themes/themes/*.json`
- `themes/builtin/winssh-liquid-glass/themes/*.json`

如果要改字体和平台适配，再看：

- `src/main/system-fonts.ts`
- `scripts/build-macos-font-helper.mjs`
- `src/native/macos/list-fonts.m`
- `src/main/window-config.ts`
- `src/main/gpu-config.ts`
- `build/installer.nsh`

## 当前协作注意事项

- 不要再假设所有 secret 都只走系统安全存储，当前 secret 已分散在 keytar、`servers.private_key` 和 `credentials` 表
- 私钥现在会保存内容本身，修改前先确认是否接受这一安全模型
- `private_key_path` 目前仍承担旧数据兼容职责，不要直接删除兼容逻辑
- 凭据库 secret 当前直接持久化在 SQLite，调整前先确认是否要加密、迁移或改回系统安全存储
- 主进程已经在 `servers:getSecrets` 和 `resolveStoredPrivateKey()` 里读取凭据库 secret，但 `SessionManager` 还不是统一的 credential resolver
- 当前服务器表单保存 / 连接流程可能把凭据库里的 private key 再次写入 `servers.private_key`，如果要做“纯引用模型”，这条链路必须一起改
- `servers:list()` 的 `hasPassword` / `hasPassphrase` 只反映 keytar 状态，不反映凭据库是否有 secret
- `ConnectionRequest.sessionId` 现在已经贯穿 shared validation、主进程和 renderer；如果要动 provisional session identity，必须一起改 `types / validation / main / workbench-context / sessions-store / tests`
- 连接结果当前依赖结构化失败码，以及 recoverable failure 上的 `serverId + secretKind`，不要随意改回纯异常流或丢掉这两个字段
- jump server 当前只支持单跳，嵌套 jump server chain 是显式不支持的
- 连接 phase 和资源监控现在都是真实主进程驱动的数据流，不要只改 terminal overlay 文案而忽略真实事件或采样链路
- 资源监控当前是 Linux-only best-effort，不要把它误当成全平台能力
- 端口转发当前是 session 级内存状态，不要误以为已有数据库模型
- quick connect 当前只支持严格的 `ssh user@host` 和密码认证
- 本地终端当前依赖 `node-pty`，非 Windows 平台还依赖 `spawn-helper` 可执行权限修复链路
- 主题系统当前是“theme id + theme registry + theme plugin document”的结构，不是简单 dark mode 开关
- 用户主题包当前通过 ZIP 导入到 `app.getPath('userData')/themes`，built-in theme pack 不可删除
- `servers` 表现在已经带 `brand_id`、`custom_icon_*`、`jump_server_id`，修改 server payload 或 mapper 时要一起考虑
- 标题栏样式切换当前要求重启应用生效
- Windows 默认关闭硬件加速，如果遇到平台渲染问题，先确认这条策略和环境变量覆盖是否相关
- 系统字体能力在 macOS 上依赖 helper + fallback 组合，改动前先确认脚本、资源和运行时搜索路径是否一起兼容

## 当前脚本

这些脚本在 `package.json` 中已定义：

```bash
npm run build:macos-font-helper
npm run format
npm run lint
npm run typecheck:node
npm run typecheck:web
npm run typecheck
npm run prestart
npm run predev
npm run prebuild
npm run start
npm run dev
npm run build
npm run test
npm run web:dev
npm run web:build
npm run web:test
npm run postinstall
npm run dist
npm run dist:win
npm run dist:mac
npm run dist:linux
```

这里只说明脚本存在，不代表本次已执行。

## 下一步建议

基于当前代码结构，后续优先级建议如下：

1. 先明确凭据库的长期模型，决定它是继续走 SQLite 直接持久化，还是迁移到加密存储 / 系统安全存储
2. 再决定是否让 `SessionManager` 直接接管凭据库解析，结束“凭据库 + 服务器内联 + keytar”并存状态，并把 target / jump server 的 secret 解析统一起来
3. 继续做真实 SSH / SFTP / 端口转发 / Jump Server 联调，重点确认凭据引用、recoverable secret prompt、端口转发恢复和 SFTP 非空目录边界
4. 继续做本地终端与终端渲染层的跨平台验证，重点确认 `node-pty` packaging、`spawn-helper`、`experimentalTerminalWebgl` 和焦点行为
5. 继续完善主题和平台层，尤其是用户主题包导入 / 删除、server brand / custom icon 体验、系统字体策略、Windows GPU 策略和标题栏切换体验
