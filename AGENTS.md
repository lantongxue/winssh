# AGENTS.md

## 说明

这份文件用于给后续协作者和代码代理提供当前项目快照。

本次梳理时间为 `2026-04-10`。本次补充除了继续基于当前仓库代码、目录结构和关键入口文件阅读，还实际执行了 `npm run typecheck`、`npm run test`，并观察了 `npm run lint` 的现状；`lint` 当前仍有仓库级历史问题，`build`、`dist` 没有执行。因此这里描述的是“当前代码现状 + 已跑过的基础校验”，不是“完整交付验证结果”。

### 补充记录（`2026-04-25`）

本次又基于当前仓库代码补了一轮增量快照，重点覆盖的是 WebDAV 备份 / 恢复链路最近的产品化改动，而不是重写整份快照。

这次补充实际执行了：

- `npm run typecheck`
- `npx vitest run "src/main/webdav-backup-service.test.ts" "src/renderer/src/components/workbench/workbench-settings-editor.test.tsx"`
- `npm run build`

并且三者都通过。

### 补充记录（`2026-04-29`）

本次基于当前仓库代码做了一轮文档增量更新，目标是让 `README.md` 和本文件更贴近现有功能面，而不是重跑完整验证。

这次重点补齐的是：

- SFTP 已经不只是远端目录管理，还支持通过 `sftp:readFile` / `sftp:writeFile` 打开和保存远端文本文件
- workbench 现在已有 `sftp-file-editor` 文档类型
- 远端文件编辑器基于 Monaco Editor，并会按远端文件名 / 扩展名做基础语言识别
- 主进程 app menu / renderer menu action 已经有 `saveActiveDocument`，可触发当前远端文件编辑器保存

本次文档更新没有重新执行 `npm run typecheck`、`npm run test` 或 `npm run build`；最近一次明确记录的通过结果仍以前面 `2026-04-25` 的补充记录为准。

### 补充记录（`2026-05-10`）

本次按当前仓库状态做了一轮自动刷新，重点修正明显过期或已经和磁盘状态不一致的信息，而不是完整重写项目快照。

这次重点刷新的是：

- 根 `package.json` 当前版本已是 `1.1.0`
- 当前内置主题目录实际包括 `winssh-default-themes`、`winssh-cyber-retro`、`winssh-dashed-border`、`winssh-high-contrast`
- 当前内置主题 id 实际包括 `winssh.light-plus`、`winssh.dark-plus`、`winssh.pixel-crt`、`winssh.cyber-retro-light`、`winssh.cyber-retro-dark`、`winssh.dashed-border-light`、`winssh.dashed-border-dark`、`winssh.high-contrast-light`、`winssh.high-contrast-dark`
- `src/main/gpu-config.ts` 当前不存在，相关索引不应再指向这个文件
- `build/installer.nsh` 当前存在，并继续承担 NSIS installer DPI awareness 自定义头
- `release/0.1.x` 本地模拟 feed 目录当前不在仓库工作树中，仍应以 `updates:mock` / `updates:serve` 脚本为本地更新测试入口

本次刷新前确认 `git status --short` 为空；文档修改后执行了 `npm run typecheck` 与 `npm run lint`：`typecheck` 通过，`lint` 仍未通过，失败项属于当前仓库既有 React hooks / fast refresh / IPC 直连约束问题，不是本次文档修改引入。

## 这次梳理的关键结论

当前仓库最值得先知道的，不是“功能列表”，而是几条已经成型、并且会直接影响后续修改方式的主线。

### 架构重构主线

- `src/main/index.ts` 现在已经退化为薄入口，只负责 `app.whenReady().then(bootstrap)` 和 `window-all-closed` 收尾
- 主进程新增 `src/main/bootstrap.ts`，负责依赖装配、窗口创建、生命周期绑定和 IPC 注册
- 主进程新增 `src/main/application/`，当前已落地：
  - `ServersApplicationService`
  - `SessionsApplicationService`
  - `SettingsApplicationService`
- 主进程新增 `src/main/ipc/`，当前已拆出：
  - `register-server-ipc.ts`
  - `register-session-ipc.ts`
  - `register-system-ipc.ts`
- 主进程新增 `src/main/observability.ts`
- 共享层新增 `src/shared/observability.ts`
- renderer 新增 `src/renderer/src/features/*/api`，组件侧已经不再直接读取 `window.winsshApi`
- renderer 新增 `src/renderer/src/features/shared/query-keys.ts`，开始集中维护 React Query key
- `App.tsx` 已接入 `AppErrorBoundary`，`src/renderer/src/lib/logger.ts` 已承担 renderer 侧基础结构化日志
- `eslint.config.mjs` 已新增约束，默认禁止 `src/renderer/src` 的组件直接访问 `window.winsshApi`

当前需要明确的是，这条重构主线已经落地到了“主进程装配拆分、API gateway 收敛、基础可观测和护栏”这一层，但还没有完成全部 renderer command / view-model 化：

- `WorkbenchProvider` 仍然承担较多交互编排
- `useSessionEvents()` 仍然同时处理 store 更新、toast、problem 和 query 失效
- `WorkbenchServerEditor`、`WorkbenchSettingsEditor`、`WorkbenchPrimarySidebar` 等大组件虽然已经切到 feature client，但仍未完全拆成纯展示 UI + 独立 command/hook 层

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
- `src/main/ipc/register-session-ipc.ts`
- `src/main/session-manager.ts`
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
- 设置页现在已经支持 `localTerminalShell` 选择
- `src/shared/local-terminal-shells.ts` 已抽出平台相关 shell 归一化逻辑

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
- 本地终端 shell 当前按平台提供不同选项：
  - Windows：`cmd` / `powershell`
  - 非 Windows：`bash` / `zsh`
- 主进程会对 `localTerminalShell` 做平台归一化，避免跨平台残留配置直接写坏本地终端启动
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
- 远端文本文件读取 `sftp:readFile`
- 远端文本文件保存 `sftp:writeFile`
- 基于 Monaco Editor 的远端文件编辑器
- 新建目录
- 重命名
- 删除文件或目录
- 上传文件
- 拖拽上传本地文件 / 目录
- 下载文件
- 传输进度事件
- 多选
- shift 范围选择
- 右键菜单批量操作
- 路径复制
- 路径发送到终端
- 当前路径卡片
- 虚拟列表渲染

远端文件编辑链路当前已经进入 workbench：

- `SftpPanel` 右键文件可以打开远端文件编辑器
- workbench 文档类型里已有 `sftp-file-editor`
- `WorkbenchSftpFileEditor` 懒加载 Monaco 和对应 NLS 资源
- `WorkbenchSftpFileMonacoEditor` 通过 React Query 读取 / 缓存远端文件内容
- 保存时会调用 `sftpClient.writeFile()`，并失效对应 session 下的 SFTP query
- 编辑器会复用当前主题色、终端字体族和终端字号
- `src/renderer/src/lib/remote-file-language.ts` 会根据文件名 / 扩展名识别基础语言

权限展示也已经不是单字符串，而是：

- `octal`
- `symbolic`

当前仍需注意的边界是：

- 远端目录删除当前已经走递归删除，不再是“只删空目录”
- 本地目录上传当前也已有递归上传逻辑
- 批量删除当前仍是逐项串行调用，不是并发批处理

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
- `winssh-cyber-retro`
- `winssh-dashed-border`
- `winssh-high-contrast`

内置主题至少包括：

- `winssh.light-plus`
- `winssh.dark-plus`
- `winssh.pixel-crt`
- `winssh.cyber-retro-light`
- `winssh.cyber-retro-dark`
- `winssh.dashed-border-light`
- `winssh.dashed-border-dark`
- `winssh.high-contrast-light`
- `winssh.high-contrast-dark`

字体能力现在改为内置受控字体 registry：

- `src/shared/integrated-fonts.ts` 维护 UI / terminal / editor 可选字体 id
- 设置项拆为 `uiFontId`、`terminalFontId`、`editorFontId`
- `editorFontId = null` 表示远端文件编辑器跟随终端字体
- renderer 通过 `src/renderer/src/lib/integrated-font-loader.ts` 注册内置 FontFace
- 主进程不再枚举系统字体，也不再暴露 `system:listFonts`

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
- `sftp-file-editor`
- `local-terminal-editor`
- `settings-editor`
- `updates-editor`
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
- activity bar 底部 settings 按钮已经是 dropdown，并支持直接触发检查更新
- editor tabs 支持拖拽重排
- editor tabs 支持重命名 title override
- 远端文件编辑器 toolbar 会展示 saved / dirty 状态
- explorer home / terminal welcome 都已有本地终端入口

另外，当前 `session-editor` / `local-terminal-editor` 在 inactive 时会保持 mounted，只通过可见性切换隐藏，目的是避免 xterm 因标签切换或面板收起而重新挂载。

### 12. 应用更新已经形成独立子系统，但当前是 Windows-only + 手动下载/安装模型

- `src/main/update-service.ts` 已封装 `electron-updater` 的 `NsisUpdater`
- 主进程已暴露：
  - `updates:getState`
  - `updates:check`
  - `updates:download`
  - `updates:quitAndInstall`
- 主进程会把 `UpdateService` 的状态变化通过 `updates:state` 主动推送到 renderer
- `system:getAppInfo` 已返回：
  - `name`
  - `version`
  - `platform`
  - `releaseChannel`
- `shared/types.ts` 当前已有：
  - `ReleaseChannel`
  - `UpdateVersionInfo`
  - `UpdateState`
  - `UpdatePhase`
  - `UpdateUnsupportedReason`
- `AppSettings` 已新增 `autoUpdateCheckEnabled`
- activity bar 设置菜单已支持“检查更新”
- workbench 已有独立 `updates-editor`
- `App.tsx` 已有自动弹出的更新对话框
- `package.json` 已引入 `electron-updater`
- `electron-builder.yml` 的 Windows 目标已配置 generic publish feed

当前实现特征：

- 仅 `win32` 支持自动更新；`darwin` / `linux` 当前会直接进入 `unsupported`
- Windows unpackaged build 默认也会进入 `unsupported`
- 缺少 `WINSSH_UPDATE_BASE_URL` 时也会进入 `unsupported`
- `autoDownload = false`，当前只自动检查，不自动下载
- 下载和安装都由用户显式触发
- 应用启动后的自动检查受 `autoUpdateCheckEnabled` 控制
- `releaseChannel` 当前按版本号后缀解析：
  - `-alpha` -> `alpha`
  - `-beta` -> `beta`
  - 其他 -> `latest`
- 显式设置 `WINSSH_ALLOW_DEV_UPDATES` 后，开发态会生成 `dev-app-update.yml` 并允许测试更新源

另外，仓库里已经有本地更新测试基础设施：

- `updates:mock`
- `updates:serve`
- `electron-builder.env`
- `dev-app-update.yml`

当前仓库工作树里没有固定提交 `release/0.1.x` 模拟 feed 目录；需要本地联调时，应优先通过 `updates:mock` 生成模拟 release 数据，再通过 `updates:serve` 启动测试 feed。

### 13. 平台与交付层也已经有明确策略

当前可以直接从代码确认：

- `build/installer.nsh` 已开启 `ManifestDPIAware true`
- 当前主进程没有独立 `gpu-config` 模块；硬件加速策略如果后续恢复或调整，需要重新确认入口位置
- 标题栏样式支持 `native | custom`
- 切换标题栏样式后，设置页会提示重启应用
- Windows 打包当前已配置 generic 更新源：
  - `electron-builder.yml` 在 `win.publish` 下读取 `WINSSH_UPDATE_BASE_URL`
  - `electronUpdaterCompatibility` 当前为 `>=2.16`
- `electron-builder.yml` 当前只在 mac 目标下注入 `resources/bin` 下的字体 helper，不再作为全平台 extra resource
- 打包脚本已经拆出：
  - `dist:win`
  - `dist:mac`
  - `dist:linux`

### 14. WebDAV 备份恢复已经从“直接恢复最新”演进到“可选远端备份 + 单项删除”

- `backup:restore` 当前已经支持按指定远端备份文件恢复，而不再只支持“内部自动挑最新”
- 设置页点击恢复时，当前会先弹出远端 WebDAV 备份列表，而不是直接触发恢复
- 恢复弹窗当前会列出已有 `winssh-*.db` 远端备份，用户必须显式选择一项后才能恢复
- 备份列表项右侧当前已有删除动作，点击后会先弹出确认对话框，确认后才会真正删除远端备份文件
- 主进程当前已经新增 `backup:list` 与 `backup:delete`
- `WebDAVBackupService` 当前除了 `backupNow()` / `restore()` / `testConnection()`，还承担远端备份列举与删除
- 恢复成功后，renderer 当前不会再只弹“稍后重启”提示，而是直接走 `system:relaunch` 触发整应用刷新 / 重载

当前需要特别注意的是，这条链路的数据源仍然是 WebDAV 远端目录，不是本地文件系统：

- restore dialog 当前展示的是远端 `PROPFIND` 结果
- delete 当前发的是 WebDAV `DELETE`
- restore 当前下载的是用户选中的远端备份文件
- 远端目录不存在时，列表当前返回 empty，而不是顺手创建目录

## 项目概览

- 项目名：`winssh`
- 版本：`1.1.0`
- 形态：Electron 桌面应用 + `web/` 品牌站 / docs landing 子工程
- 目标：提供面向桌面的 SSH、SFTP、端口转发和工作台式连接管理，并配套官网首页与文档入口页

主要技术栈：

- Electron 39
- React 19
- TypeScript 5
- Vite 7
- Tailwind CSS 4
- TanStack Query
- Zustand
- xterm.js
- Monaco Editor
- node-pty
- ssh2
- better-sqlite3
- electron-updater
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
- SFTP 浏览 / 传输 / 远端文本文件编辑
- 会话级端口转发
- 主题系统与用户主题包导入 / 删除
- WebDAV 备份 / 远端备份恢复 / 远端备份删除
- 服务器品牌识别 / 自定义图标
- 设置中心
- 应用更新检查 / 下载 / 安装（Windows）
- known hosts 管理
- quick connect
- 多语言
- 自定义标题栏
- 内置字体三路设置

更准确地说，现在处于“功能骨架已经完成，开始继续补安全策略、平台细节和产品化体验”的 MVP/Beta 阶段。

## 核心架构

### `src/main/`

负责：

- Electron 主进程薄入口
- `bootstrap.ts` 应用启动、依赖装配、窗口生命周期
- `application/` 用例编排层
- `ipc/` IPC 注册层
- `observability.ts` 主进程日志 / operation context / app error 辅助
- SQLite 数据库
- 系统安全存储
- SSH / SFTP / 端口转发运行时
- 本地 shell / `node-pty` 运行时
- 主题包导入 / 删除
- 会话资源采样
- 服务器品牌探测
- 应用更新服务
- 应用版本 / 发布通道信息
- 主题注册与解析
- 主进程本地化
- GPU / 窗口配置
- 内置字体 registry / renderer 字体加载

当前需要特别注意：

- 这次重构并没有把 `database.ts`、`session-manager.ts`、`local-terminal-manager.ts` 再拆成更细的基础设施目录，它们仍然是 `src/main/` 根下的重要运行时实现
- `application/` 目前只先覆盖了 `servers / sessions / settings` 三个最复杂的编排点，不代表全仓已经完全按同一粒度拆分

### `src/preload/`

负责：

- `contextBridge`
- 将主进程能力统一暴露为 `window.winsshApi`
- 继续维护手写 typed bridge
- 暴露基于 `webUtils.getPathForFile()` 的本地拖拽文件路径解析

当前需要特别注意：

- `window.winsshApi` 仍然存在，但它现在更偏向“renderer 基础设施层入口”
- renderer 组件应通过 `src/renderer/src/features/*/api` 访问这些能力，而不是直接在组件里碰 `window.winsshApi`

### `src/shared/`

负责：

- 共享类型
- Zod 校验
- SFTP 路径工具
- quick connect 解析
- 本地终端 shell 平台归一化
- 应用更新 / 应用版本信息类型
- 可观测性共享类型
- server brand / icon 定义
- 主题定义与 schema
- preload / renderer 共用 API 类型

这次新增的共享主线包括：

- `AppError`
- `OperationContext`
- `ObservableEvent<T>`
- `DomainResult<T>`
- 事件元数据字段：
  - `correlationId`
  - `source`
  - `timestamp`
  - 部分状态 / 错误事件上的 `code` / `recoverable`

### `src/renderer/src/features/`

负责：

- 每个 feature 的 API gateway
- query key 收敛
- 作为组件访问 preload bridge 的唯一建议入口

当前已能确认的目录至少包括：

- `credentials/api`
- `groups/api`
- `local-terminals/api`
- `port-forwards/api`
- `servers/api`
- `sessions/api`
- `settings/api`
- `sftp/api`
- `system/api`
- `tags/api`
- `themes/api`
- `updates/api`
- `shared/api`
- `shared/query-keys.ts`

### `src/renderer/src/`

负责：

- React 应用入口
- `AppErrorBoundary`
- Workbench UI
- feature gateway 消费层
- Zustand store
- React Query 数据流
- SSH 终端 / 本地终端 / SFTP / 远端文件编辑 / 端口转发界面
- 会话资源监控
- 服务器品牌 / 自定义图标展示
- 设置页
- 更新对话框 / updates editor
- i18n 资源

### `web/`

负责：

- 官网首页
- docs landing 页面
- 多入口 Vite 站点构建
- 网站侧语言与主题状态
- 复用根 `package.json` 的版本号和仓库地址
- 复用内置 `light-plus` / `dark-plus` 主题 JSON

## 主进程现状

`src/main/index.ts` 当前只负责：

- `app.whenReady().then(bootstrap)`
- `window-all-closed` 下的跨平台退出策略

真正的主进程装配当前已经迁到 `src/main/bootstrap.ts`，其中负责：

- 创建 `DatabaseService`
- 创建 `SecureStoreService`
- 创建 `SessionManager`
- 创建 `LocalTerminalManager`
- 创建 `ThemeRegistry`
- 创建 `UpdateService`
- 创建主进程本地化和 app info
- 创建：
  - `ServersApplicationService`
  - `SessionsApplicationService`
  - `SettingsApplicationService`
- 注册 IPC
- 创建主窗口、同步窗口主题、绑定 before-quit / activate / did-finish-load 等生命周期

当前 IPC 当前已经按 3 个注册器装配：

- `register-server-ipc.ts`
  - `credentials:*`
  - `groups:*`
  - `tags:*`
  - `servers:*`
- `register-session-ipc.ts`
  - `sessions:*`
  - `localTerminals:*`
  - `sftp:*`
  - `portForwards:*`
- `register-system-ipc.ts`
  - `themes:*`
  - `settings:*`
  - `backup:*`
  - `updates:*`
  - `system:*`

因此从逻辑分组上看，当前 IPC 能力仍然包括：

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
- `backup:*`
- `updates:*`
- `system:*`

### 可观测性现状

- `src/main/observability.ts` 当前已提供：
  - `createLogger()`
  - `createOperationContext()`
  - `toAppError()`
- `src/shared/observability.ts` 当前已提供：
  - `AppError`
  - `OperationContext`
  - `ObservableEvent<T>`
  - `DomainResult<T>`
  - `createObservableEvent()`
  - `createRequestId()`
- `SessionManager` 和 `LocalTerminalManager` 发出的事件当前已经开始带：
  - `correlationId`
  - `source`
  - `timestamp`
- 部分 session / local terminal 状态与错误事件还会附带：
  - `code`
  - `recoverable`
- renderer 当前已有：
  - `src/renderer/src/lib/logger.ts`
  - `src/renderer/src/components/app-error-boundary.tsx`
  - `App.tsx` 中的 `unhandledrejection` 日志捕获

当前需要特别注意：

- 这是“基础可观测层”，不是完整 telemetry 平台
- 事件元数据已经开始进入共享类型，但还没有做到所有 domain 事件都完全统一 envelope

当前比较关键的 IPC 包括：

- `credentials:*`
- `servers:getSecrets`
- `sessions:getResourceSnapshot`
- `localTerminals:*`
- `sftp:createFile`
- `sftp:readFile`
- `sftp:writeFile`
- `sftp:uploadPaths`
- `themes:list`
- `themes:importArchive`
- `themes:deletePlugin`
- `backup:getState`
- `backup:list`
- `backup:backupNow`
- `backup:delete`
- `backup:restore`
- `updates:getState`
- `updates:check`
- `updates:download`
- `updates:quitAndInstall`
- `system:getAppInfo`
- `system:pickServerIcon`
- `system:getCapabilities`
- `system:removeKnownHost`
- `system:relaunch`
- `system:window:*`

### 应用更新服务现状

- `UpdateService` 当前包装 `electron-updater` 的 `NsisUpdater`
- 状态机当前覆盖：
  - `unsupported`
  - `idle`
  - `checking`
  - `available`
  - `not-available`
  - `downloading`
  - `downloaded`
  - `error`
- `updates:state` 会在状态变化时主动推送到 renderer
- `settings:update` 修改 `autoUpdateCheckEnabled` 后，会同步写回 `UpdateService`
- 主窗口首次 `did-finish-load` 后，如果自动检查开关开启，会主动执行一次 `check()`
- `quitAndInstall()` 当前只有在 `downloaded` 状态才会真正触发
- 开发态只有在显式设置 `WINSSH_ALLOW_DEV_UPDATES` 时才允许 dev feed，并会写出 `dev-app-update.yml`

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

### 应用设置现状

- `app_settings` 当前仍是单条 JSON 设置模型
- `autoUpdateCheckEnabled` 已进入 `AppSettings`
- 默认值当前来自 `DEFAULT_APP_SETTINGS.autoUpdateCheckEnabled = true`
- `database.test.ts` 已覆盖该设置项的持久化回归

## WebDAV 备份与恢复现状

当前仓库已经有正式的 WebDAV 备份子流程，不再只是“填几个设置项，未来再接能力”。

当前已实现：

- `backup:getState`
- `backup:list`
- `backup:backupNow`
- `backup:delete`
- `backup:restore`
- `backup:testConnection`
- 设置页 backup 分区
- restore dialog 远端备份列表
- restore dialog 单项删除 + 二次确认
- restore 成功后直接整应用 relaunch

当前主进程实现核心在 `src/main/webdav-backup-service.ts`，其行为已经明确包括：

- `backupNow()`：导出当前 SQLite 数据库并上传到 WebDAV
- `list()`：通过 WebDAV `PROPFIND` 列出可恢复备份
- `delete(fileName)`：校验文件名后对远端备份发 `DELETE`
- `restore(fileName?)`：按指定备份恢复；未显式传入时仍保留“回落到最新备份”的兼容行为
- `testConnection()`：验证凭据和远端目录可用性

当前实现特征：

- 远端备份文件名当前匹配 `winssh-<platform>-<timestamp>.db`
- 列表链路当前是只读语义；远端目录不存在时返回 empty，不会因打开恢复弹窗而创建目录
- 删除和恢复前都会校验备份文件名格式，不把 renderer 选中值当成可信输入
- restore 下载后仍会校验 SQLite header，避免把无效文件写回主数据库
- restore 成功后当前预期是立即 `system:relaunch`，而不是在原进程里继续跑旧内存状态

renderer 侧当前行为也已经不是“点恢复 -> 直接恢复最新”，而是：

1. 点击 settings 里的 restore
2. 打开 restore dialog
3. 拉取远端备份列表
4. 用户显式选择一项后才允许 restore
5. 用户也可以在列表项右侧触发 delete
6. delete 需要先经过确认对话框
7. restore 成功后直接 relaunch 应用

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
- SFTP 远端文件读取 / 写入
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
- `src/main/ipc/register-session-ipc.ts`
- `src/main/session-manager.ts`
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
- 设置页当前已经允许用户选择本地终端 shell，且该设置只影响新打开的本地终端标签
- shell 选项当前按平台区分：
  - Windows：`cmd` / `powershell`
  - 非 Windows：`bash` / `zsh`
- `src/shared/local-terminal-shells.ts` 当前负责：
  - 支持 shell 列表
  - 默认 shell 解析
  - 跨平台持久化值归一化
- `LocalTerminalManager` 会按平台选择 shell，并在非 Windows 平台 best-effort 修正 `node-pty` 的 `spawn-helper` 可执行权限
- 主进程 `settings:get` / `settings:update` 当前都会对 `localTerminalShell` 做平台归一化，避免把一台机器上的 shell 配置原样带到另一平台
- 本地终端当前没有数据库持久化模型，生命周期绑定在本次应用运行期

## SFTP 现状

当前已实现：

- 目录列表
- 刷新
- 当前路径编辑 / 跳转
- 返回上一级
- 新建空文件
- 打开远端文本文件编辑器
- 读取远端文件内容
- 保存远端文件内容
- 新建目录
- 重命名
- 删除文件或目录
- 上传文件
- 拖拽上传本地文件 / 目录
- 下载文件
- 传输进度事件
- 多选
- shift 范围选择
- 路径复制
- 路径发送到终端
- 当前路径卡片
- 虚拟列表

### SFTP 远端文件编辑

当前远端文件编辑链路由这些部分组成：

- `sftp:readFile` / `sftp:writeFile`
- `SessionsApplicationService.readFile()` / `writeFile()`
- `SessionManager.readFile()` / `writeFile()`
- `sftpClient.readFile()` / `writeFile()`
- `queryKeys.sftpFile(sessionId, remotePath)`
- `WorkbenchSftpFileEditor`
- `WorkbenchSftpFileMonacoEditor`
- `remote-file-language` helper

当前实现特征：

- 编辑器作为 `sftp-file-editor` document 打开，而不是嵌在 SFTP 面板内部
- Monaco 按当前 i18n 语言懒加载 NLS 资源
- 编辑器主题会从 WinSSH theme registry 解析出的主题映射到 Monaco theme
- 字体族 / 字号跟随当前终端设置
- 支持常见配置、脚本、前端、后端、Markdown、YAML、JSON 等扩展名的基础语言识别
- 保存成功后会更新当前文件 query cache，并失效对应 session 下的 SFTP 相关 query
- 顶层 app menu 的 `saveActiveDocument` 会在当前活动文档是 `sftp-file-editor` 时触发表单保存

当前边界：

- 读写接口是字符串内容模型，主要面向文本文件
- 当前没有专门的二进制文件保护、超大文件流式编辑或远端并发修改冲突检测

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
- 文件右键打开远端编辑器
- 目录双击进入
- 空白区域清除选择
- header 关闭 aux panel
- 当前路径拖拽 dropzone 上传

仍需注意的边界：

- 远端目录删除当前已经支持递归删除
- 本地目录上传当前已经支持递归上传
- 删除批量操作当前是逐项串行调用
- 文件选择对话框当前仍偏向文件选择；目录上传更依赖拖拽路径进入 `uploadPaths()`

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
- `winssh.cyber-retro-light`
- `winssh.cyber-retro-dark`
- `winssh.dashed-border-light`
- `winssh.dashed-border-dark`
- `winssh.high-contrast-light`
- `winssh.high-contrast-dark`

其中：

- `Pixel CRT` 带终端默认字体策略
- `High Contrast` 系列会让 renderer 根节点带上 `theme-high-contrast` class，便于做高对比度样式分支
- `Cyber Retro` / `Dashed Border` 系列是当前仓库里的额外内置主题包，不要再按旧的 `Liquid Glass` 主题包假设索引

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

## Integrated Font / 平台能力现状

系统字体枚举已经移除，字体选择改为内置受控 registry。

当前字体策略如下：

- UI 字体、终端字体、远端文件编辑器字体分别保存
- `editorFontId = null` 表示远端文件编辑器跟随终端字体
- 终端和远端文件编辑器使用内置等宽字体栈，并追加内置 CJK / Symbols fallback
- xterm 会在 `terminal.open()` 和实验性 WebGL renderer 初始化前等待目标字体加载

当前相关文件包括：

- `src/shared/integrated-fonts.ts`
- `src/renderer/src/lib/integrated-font-loader.ts`
- `src/renderer/src/assets/fonts/*`

另外平台相关策略还包括：

- `windowTitleBarStyle = native | custom`
- 当前主进程没有独立 `gpu-config` 模块；硬件加速策略如果后续恢复或调整，需要重新确认入口位置

## 应用更新现状

当前仓库已经有正式的应用更新能力，不再只是交付层预留配置。

已实现内容：

- `UpdateService`
- `updates:*` IPC
- `updates:state` 状态事件
- `system:getAppInfo`
- `ReleaseChannel` / `UpdateState` 共享类型
- `autoUpdateCheckEnabled` 设置项
- workbench 独立 `updates-editor`
- Activity Bar 设置菜单触发“立即检查更新”
- App 级自动更新对话框
- Windows generic feed 打包配置
- 本地 mock release / test server 脚本

当前关键特征：

- 自动更新当前只支持 Windows NSIS 构建
- 自动检查和下载被明确拆开，当前不会自动下载更新包
- `updates-editor` 会展示：
  - 当前 app 名称
  - 当前版本
  - 当前平台
  - 发布通道
  - 更新状态
  - release date / release notes（如果 feed 提供）
- `App.tsx` 中的对话框会在首次观察到新版本时自动弹出，但同一版本被手动关闭后不会反复弹
- 手动下载完成后，renderer 会切到 `downloaded` 状态，并允许 `quitAndInstall`
- `autoUpdateCheckEnabled` 只控制启动后的自动检查，不阻止用户手动点“检查更新”

当前本地测试基础设施包括：

- `scripts/mock-update-release.mjs`
- `scripts/update-test-server.mjs`
- `electron-builder.env`
- `dev-app-update.yml`

当前仓库工作树里没有固定提交 `release/0.1.x` 模拟 feed 目录；需要本地联调时，应优先通过 `updates:mock` 生成模拟 release 数据，再通过 `updates:serve` 启动测试 feed。

需要特别注意的边界：

- 本地 mock release 目录是生成物，不应把某个 `release/0.1.x` 目录当成长期存在的仓库输入；生成出来的模拟包也只适合做检测 / 下载流程测试，不适合拿来当真实升级验证
- 缺少 feed URL、平台不支持或构建形态不支持时，UI 预期是进入 `unsupported`，不是抛异常中断启动
- `releaseChannel` 由版本号后缀推导，如果后续引入别的版本命名策略，需要同步调整 about / updates UI 与相关 tests

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
- `sftp-file-editor`
- `local-terminal-editor`
- `settings-editor`
- `updates-editor`
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
- editor tabs 已支持独立 `updates-editor` 标签
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
- 在 settings activity 下渲染独立 `updates-editor`

另外，当前 `session-editor` 和 `local-terminal-editor` 在 inactive 时会保持 mounted，仅通过可见性切换隐藏；这已经是为了避免 xterm / terminal runtime 因标签切换或面板收起而重挂载的显式策略。

另外，当前更新相关交互已经明确包括：

- Activity Bar 底部设置按钮现在是 dropdown，不只是单一 settings 入口
- dropdown 里可以直接触发“检查更新”，并打开 `updates-editor`
- `App.tsx` 会在检测到可用更新时自动弹出对话框，而不是要求用户必须先进入设置

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
- 本地终端 shell
- 终端字体大小
- 终端字体族
- experimental terminal WebGL
- 光标样式
- 光标闪烁
- 选中即复制
- known hosts 列表查看
- known hosts 删除
- WebDAV 连接测试
- WebDAV 立即备份
- WebDAV 远端备份列表恢复
- WebDAV 远端备份删除
- 凭据库管理
- 应用名称 / 版本 / 平台 / 发布通道查看

设置页当前分区包括：

- `appearance`
- `terminal`
- `security`
- `backup`
- `credentialVault`
- `about`

需要特别修正一点：

- 应用更新当前不是 `WorkbenchSettingsEditor` 里的内嵌分区
- 更新能力当前放在 settings activity 下的独立 `updates-editor`
- `WorkbenchSettingsEditor` 里的 `about` 分区主要负责展示 app info，不直接承担检查 / 下载 / 安装动作

安全相关能力当前包括：

- 系统凭据存储可用性探测
- known hosts 指纹信任
- known hosts 管理
- 主机指纹变更 warning
- 私钥内容回填与旧路径兼容

另外，backup 分区当前需要特别注意的现实约束是：

- restore dialog 当前列出的不是本地文件，而是 WebDAV 远端备份
- 删除动作当前删除的是远端备份文件，不会影响本地当前数据库，除非用户后续主动 restore
- restore 成功后当前会直接 relaunch，因此不要按“恢复成功但进程继续原地跑”来推导后续 UI 状态

另外，设置页里和本地终端 shell 相关的当前边界是：

- renderer 只展示当前平台支持的 shell 选项
- 描述文案当前已经明确说明该设置仅影响新打开的本地终端标签
- 主进程会在 `settings:get` / `settings:update` 时再次归一化该值，不把 renderer 选项约束当成唯一防线

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

## Web 站点现状

仓库当前除了 Electron 桌面端，还包含独立的 `web/` 站点工程。

当前已实现内容：

- 首页 `web/src/home-main.tsx`
- docs landing 页 `web/src/docs-main.tsx`
- Vite 多入口构建：
  - `web/index.html`
  - `web/docs/index.html`
- 网站侧 `zh-CN` / `en-US` 双语
- 网站侧主题切换与 system theme 跟随
- 站点文案集中在 `web/src/content/site.ts`
- 版本号和仓库地址直接复用根 `package.json`
- 网站主题直接复用内置 `winssh.light-plus` / `winssh.dark-plus` 主题 JSON

当前需要注意的边界：

- 这是独立站点工程，不是 Electron renderer 的另一路由
- 网站主题当前只围绕 `light-plus` / `dark-plus` 两个内置主题，不直接接入完整 theme registry
- docs 当前还是 landing / 导览页，不是完整产品手册集合

## 测试版图现状

这次补充更新时已经实际执行：

- `npm run typecheck`
- `npm run test`

并且两者都通过。

另外，`npm run lint` 已经跑过现状观察，但当前仍能看到仓库级历史问题，所以这里不把 lint 通过作为本次快照结论。

从测试文件分布和这次实际跑通的结果看，当前测试面已经覆盖这些方向：

- `database`
- `main/application/servers-application-service`
- `main/application/settings-application-service`
- `session-manager`
- `session-manager.connect`
- `local-terminal-manager`
- `theme-registry`
- `update-service`
- `window-config`
- `integrated-fonts`
- `localization`
- `main/webdav-backup-service`
- `sftp` 工具
- `quick-connect`
- `validation`
- `shared observability`
- `theme` helper
- `remote-file-language`
- `use-terminal`
- `terminal-surface`
- `use-prefers-dark`
- `terminal-pane`
- `session-resource-monitor`
- `sftp-panel`
- `server-brand-icon`
- `workbench-primary-sidebar`
- `workbench-activity-bar`
- `workbench-explorer-home`
- `workbench-titlebar`
- `workbench-settings-editor`
- `workbench-updates-editor`
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
- `App`
- i18n format / index
- web `home-page`
- web `docs-page`
- web `site-language`

说明代码库已经在持续补充回归面，不再只是人工联调。

## 关键数据流

多数功能改动会同时影响以下几层：

1. `src/shared/types.ts`
2. `src/shared/validation.ts`
3. `src/shared/api.ts` / `src/shared/observability.ts`
4. `src/main/bootstrap.ts` / `src/main/ipc/*` / `src/main/application/*` / 对应 runtime service
5. `src/preload/index.ts`
6. `src/renderer/src/features/*`
7. `src/renderer/src/components/*` / `store/*` / `hooks/*`

现在如果只改主进程或只改渲染层，仍然很容易出现接口失配；但同时也不能再按旧习惯只搜 `window.winsshApi` 来追数据流，因为 renderer 已经先经过 `features/*/api` 这一层。

主题相关改动还会多牵涉：

- `src/shared/themes.ts`
- `src/main/theme-registry.ts`
- `themes/builtin/*`
- `src/renderer/src/lib/theme.ts`
- `src/renderer/src/components/workbench/workbench-settings-editor.tsx`

应用更新相关改动还会多牵涉：

- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/shared/api.ts`
- `src/shared/constants.ts`
- `src/main/app-info.ts`
- `src/main/update-service.ts`
- `src/main/bootstrap.ts`
- `src/main/ipc/register-system-ipc.ts`
- `src/main/application/settings-application-service.ts`
- `src/preload/index.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/features/updates/api/updates-client.ts`
- `src/renderer/src/features/settings/api/settings-client.ts`
- `src/renderer/src/features/shared/query-keys.ts`
- `src/renderer/src/components/workbench/workbench-activity-bar.tsx`
- `src/renderer/src/components/workbench/workbench-updates-editor.tsx`
- `src/renderer/src/store/update-dialog-store.ts`
- `src/renderer/src/test/create-winssh-api.ts`
- `electron-builder.yml`
- `package.json`
- `scripts/mock-update-release.mjs`
- `scripts/update-test-server.mjs`

WebDAV 备份 / 恢复相关改动还会多牵涉：

- `src/shared/types.ts`
- `src/shared/api.ts`
- `src/main/ipc/register-system-ipc.ts`
- `src/main/webdav-backup-service.ts`
- `src/preload/index.ts`
- `src/renderer/src/features/backup/api/backup-client.ts`
- `src/renderer/src/features/shared/query-keys.ts`
- `src/renderer/src/components/workbench/workbench-settings-editor.tsx`
- `src/renderer/src/i18n/resources/en-US/workbench.ts`
- `src/renderer/src/i18n/resources/zh-CN/workbench.ts`
- `src/renderer/src/test/create-winssh-api.ts`
- `src/main/webdav-backup-service.test.ts`
- `src/renderer/src/components/workbench/workbench-settings-editor.test.tsx`

私钥、凭据和连接流程相关改动还会多牵涉：

- `src/main/database.ts`
- `src/main/bootstrap.ts`
- `src/main/ipc/register-server-ipc.ts`
- `src/main/ipc/register-session-ipc.ts`
- `src/main/application/servers-application-service.ts`
- `src/main/session-manager.ts`
- `src/main/secure-store.ts`
- `src/renderer/src/components/credential-vault.tsx`
- `src/renderer/src/features/credentials/api/credentials-client.ts`
- `src/renderer/src/features/servers/api/servers-client.ts`
- `src/renderer/src/components/workbench/workbench-server-editor.tsx`
- `src/renderer/src/components/workbench/workbench-quick-input.tsx`
- `src/renderer/src/store/sessions-store.ts`
- `src/renderer/src/components/terminal-pane.tsx`

本地终端与共享 terminal surface 相关改动还会多牵涉：

- `src/main/local-terminal-manager.ts`
- `src/preload/index.ts`
- `src/shared/types.ts`
- `src/shared/local-terminal-shells.ts`
- `src/shared/api.ts`
- `src/shared/constants.ts`
- `src/renderer/src/components/terminal-surface.tsx`
- `src/renderer/src/hooks/use-terminal.ts`
- `src/renderer/src/components/workbench/workbench-local-terminal-editor.tsx`
- `src/renderer/src/components/workbench/workbench-settings-editor.tsx`
- `src/renderer/src/store/local-terminals-store.ts`
- `src/renderer/src/hooks/use-session-events.ts`

资源监控相关改动还会多牵涉：

- `src/shared/types.ts`
- `src/shared/api.ts`
- `src/main/session-manager.ts`
- `src/main/ipc/register-session-ipc.ts`
- `src/preload/index.ts`
- `src/renderer/src/features/sessions/api/sessions-client.ts`
- `src/renderer/src/components/session-resource-monitor.tsx`
- `src/renderer/src/components/workbench/workbench-session-editor.tsx`

SFTP、远端文件编辑、拖拽上传和递归删除相关改动还会多牵涉：

- `src/shared/api.ts`
- `src/main/ipc/register-session-ipc.ts`
- `src/main/session-manager.ts`
- `src/preload/index.ts`
- `src/renderer/src/features/sftp/api/sftp-client.ts`
- `src/renderer/src/features/shared/query-keys.ts`
- `src/renderer/src/components/sftp-panel.tsx`
- `src/renderer/src/components/workbench/workbench-sftp-file-editor.tsx`
- `src/renderer/src/components/workbench/workbench-sftp-file-monaco-editor.tsx`
- `src/renderer/src/components/workbench/workbench-session-editor.tsx`
- `src/renderer/src/components/workbench/workbench-shell.tsx`
- `src/renderer/src/components/workbench/workbench-editor-tabs.tsx`
- `src/renderer/src/lib/remote-file-language.ts`
- `src/renderer/src/i18n/resources/en-US/workbench.ts`
- `src/renderer/src/i18n/resources/zh-CN/workbench.ts`
- `src/renderer/src/test/create-winssh-api.ts`

Jump Server、server brand、自定义图标相关改动还会多牵涉：

- `src/shared/server-brands.ts`
- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/main/database.ts`
- `src/main/ipc/register-server-ipc.ts`
- `src/main/ipc/register-session-ipc.ts`
- `src/main/session-manager.ts`
- `src/main/application/servers-application-service.ts`
- `src/renderer/src/components/server-brand-icon.tsx`
- `src/renderer/src/components/workbench/workbench-server-editor.tsx`
- `src/renderer/src/components/workbench/workbench-editor-tabs.tsx`
- `src/renderer/src/components/workbench/workbench-primary-sidebar.tsx`
- `src/renderer/src/components/workbench/workbench-command-center.tsx`
- `src/renderer/src/components/workbench/workbench-explorer-home.tsx`

官网 / docs landing 相关改动还会多牵涉：

- `web/vite.config.ts`
- `web/src/content/site.ts`
- `web/src/lib/constants.ts`
- `web/src/lib/language.ts`
- `web/src/lib/theme.ts`
- `web/src/components/site-shell.tsx`
- `web/src/components/home-page.tsx`
- `web/src/components/docs-page.tsx`

如果要调整 `sessionId` / provisional session identity 链路，还必须同步改：

- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/main/ipc/register-session-ipc.ts`
- `src/main/session-manager.ts`
- `src/renderer/src/components/workbench/workbench-context.tsx`
- `src/renderer/src/store/sessions-store.ts`
- 对应 tests

## 建议优先阅读的文件

第一次接手仓库，建议先看：

- `package.json`
- `src/main/index.ts`
- `src/main/bootstrap.ts`
- `src/main/observability.ts`
- `src/main/ipc/register-server-ipc.ts`
- `src/main/ipc/register-session-ipc.ts`
- `src/main/ipc/register-system-ipc.ts`
- `src/main/application/servers-application-service.ts`
- `src/main/application/sessions-application-service.ts`
- `src/main/application/settings-application-service.ts`
- `src/main/session-manager.ts`
- `src/main/local-terminal-manager.ts`
- `src/main/app-info.ts`
- `src/main/app-menu.ts`
- `src/main/update-service.ts`
- `src/main/webdav-backup-service.ts`
- `src/main/database.ts`
- `src/main/secure-store.ts`
- `src/shared/integrated-fonts.ts`
- `src/renderer/src/lib/integrated-font-loader.ts`
- `src/main/theme-registry.ts`
- `src/main/window-config.ts`
- `src/preload/index.ts`
- `src/shared/types.ts`
- `src/shared/observability.ts`
- `src/shared/validation.ts`
- `src/shared/api.ts`
- `src/shared/server-brands.ts`
- `src/shared/themes.ts`
- `src/shared/local-terminal-shells.ts`
- `src/shared/quick-connect.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/components/app-error-boundary.tsx`
- `src/renderer/src/components/server-brand-icon.tsx`
- `src/renderer/src/components/session-resource-monitor.tsx`
- `src/renderer/src/components/credential-vault.tsx`
- `src/renderer/src/components/terminal-surface.tsx`
- `src/renderer/src/lib/logger.ts`
- `src/renderer/src/features/shared/api/winssh-client.ts`
- `src/renderer/src/features/shared/query-keys.ts`
- `src/renderer/src/lib/theme.ts`
- `src/renderer/src/components/workbench/workbench-updates-editor.tsx`
- `src/renderer/src/components/workbench/workbench-settings-editor.tsx`
- `src/renderer/src/components/workbench/workbench-sftp-file-editor.tsx`
- `src/renderer/src/components/workbench/workbench-sftp-file-monaco-editor.tsx`
- `src/renderer/src/components/workbench/workbench-shell.tsx`
- `src/renderer/src/components/workbench/workbench-context.tsx`
- `src/renderer/src/store/update-dialog-store.ts`
- `src/renderer/src/store/sessions-store.ts`
- `src/renderer/src/store/local-terminals-store.ts`
- `web/vite.config.ts`
- `web/src/content/site.ts`
- `web/src/components/site-shell.tsx`
- `web/src/lib/theme.ts`

如果要改会话辅助能力，再看：

- `src/renderer/src/components/sftp-panel.tsx`
- `src/renderer/src/components/port-forward-panel.tsx`
- `src/renderer/src/components/workbench/workbench-session-editor.tsx`
- `src/renderer/src/components/workbench/workbench-sftp-file-editor.tsx`
- `src/renderer/src/components/workbench/workbench-sftp-file-monaco-editor.tsx`
- `src/renderer/src/components/workbench/workbench-local-terminal-editor.tsx`
- `src/renderer/src/components/terminal-pane.tsx`
- `src/renderer/src/hooks/use-session-events.ts`

如果要改主题，再看：

- `themes/builtin/winssh-default-themes/package.json`
- `themes/builtin/winssh-cyber-retro/package.json`
- `themes/builtin/winssh-dashed-border/package.json`
- `themes/builtin/winssh-high-contrast/package.json`
- `themes/builtin/winssh-default-themes/themes/*.json`
- `themes/builtin/winssh-cyber-retro/themes/*.json`
- `themes/builtin/winssh-dashed-border/themes/*.json`
- `themes/builtin/winssh-high-contrast/themes/*.json`

如果要改字体和平台适配，再看：

- `src/shared/integrated-fonts.ts`
- `src/renderer/src/lib/integrated-font-loader.ts`
- `src/renderer/src/assets/fonts/README.md`
- `src/main/window-config.ts`
- `build/installer.nsh`

## 当前协作注意事项

- `src/main/index.ts` 现在已经是薄入口；如果要改主进程装配或 IPC，不要只盯着 `index.ts`，优先看 `bootstrap.ts`、`src/main/ipc/*`、`src/main/application/*`
- renderer 组件默认不要直接访问 `window.winsshApi`，当前建议入口是 `src/renderer/src/features/*/api`
- React Query key 现在开始集中到 `src/renderer/src/features/shared/query-keys.ts`，新增 query 时不要再散落硬编码 key
- `src/shared/types.ts` 里的部分事件现在已经带 `correlationId / source / timestamp`，session / local terminal 的状态与错误事件还可能带 `code / recoverable`；改事件类型时不要把这些元数据悄悄删掉
- `AppErrorBoundary` 和 renderer logger 已经接进主流程；如果调整 `App.tsx`、全局异常处理或事件桥接，记得一起看错误归集链路
- 当前 renderer 已经去掉了组件直连 IPC，但 `WorkbenchProvider`、`useSessionEvents()` 和若干大型 workbench 组件仍然承担较多编排；继续重构时应在这个基础上继续拆，而不是回退到“组件里直接写 IPC + toast + invalidateQueries”
- 不要再假设所有 secret 都只走系统安全存储，当前 secret 已分散在 keytar、`servers.private_key` 和 `credentials` 表
- 私钥现在会保存内容本身，修改前先确认是否接受这一安全模型
- `private_key_path` 目前仍承担旧数据兼容职责，不要直接删除兼容逻辑
- 凭据库 secret 当前直接持久化在 SQLite，调整前先确认是否要加密、迁移或改回系统安全存储
- 主进程已经在 `servers:getSecrets` 和 `resolveStoredPrivateKey()` 里读取凭据库 secret，但 `SessionManager` 还不是统一的 credential resolver
- 当前服务器表单保存 / 连接流程可能把凭据库里的 private key 再次写入 `servers.private_key`，如果要做“纯引用模型”，这条链路必须一起改
- `servers:list()` 的 `hasPassword` / `hasPassphrase` 只反映 keytar 状态，不反映凭据库是否有 secret
- `ConnectionRequest.sessionId` 现在已经贯穿 shared validation、主进程和 renderer；如果要动 provisional session identity，至少要一起改 `types / validation / register-session-ipc / session-manager / workbench-context / sessions-store / tests`
- 连接结果当前依赖结构化失败码，以及 recoverable failure 上的 `serverId + secretKind`，不要随意改回纯异常流或丢掉这两个字段
- jump server 当前只支持单跳，嵌套 jump server chain 是显式不支持的
- 连接 phase 和资源监控现在都是真实主进程驱动的数据流，不要只改 terminal overlay 文案而忽略真实事件或采样链路
- SFTP 远端文件编辑当前是文本内容模型，读写接口都是字符串；如果要支持二进制文件、大文件或冲突检测，需要重新设计 `sftp:readFile` / `sftp:writeFile` 链路
- SFTP 远端目录删除当前已经支持递归删除，改删除策略时不要再按“只删空目录”假设推导
- SFTP 本地目录上传当前已经支持递归上传，而拖拽上传链路还依赖 preload 里的 `webUtils.getPathForFile()` 桥接
- `sftp-file-editor` 通过 app menu 的 `saveActiveDocument` 参与保存，调整菜单动作或 workbench shell 时不要漏掉远端文件保存入口
- `session-editor` / `local-terminal-editor` 当前依赖 keep-mounted 策略避免 xterm 重挂载，优化渲染时不要轻易改回条件卸载
- 资源监控当前是 Linux-only best-effort，不要把它误当成全平台能力
- 端口转发当前是 session 级内存状态，不要误以为已有数据库模型
- quick connect 当前只支持严格的 `ssh user@host` 和密码认证
- 本地终端当前依赖 `node-pty`，非 Windows 平台还依赖 `spawn-helper` 可执行权限修复链路
- 本地终端 shell 当前已经是设置项，但它只影响新开的 local terminal；不要误以为修改设置会热切换已有 PTY
- `localTerminalShell` 当前会在主进程按平台归一化；如果做设置迁移或跨平台同步，不要假设持久化值总是对当前平台有效
- 自动更新当前只支持 Windows packaged build；`darwin` / `linux` 和默认 dev build 进入 `unsupported` 是预期行为
- `autoUpdateCheckEnabled` 当前只控制启动后的自动检查，不会禁止用户手动检查更新
- `UpdateService` 当前显式 `autoDownload = false`；看到 `available` 不代表更新包已经下载到本地
- backup restore 当前已经不是“直接恢复最新”；如果要改恢复 UX、删除逻辑或恢复后行为，优先看 `backup:list` / `backup:delete` / `backup:restore(fileName?)` 这条链路
- restore dialog 当前列的是 WebDAV 远端备份，不要误按本地文件导入 / 本地 picker 心智去改
- `backup:delete` 当前要求先确认再删；如果以后改成批量删除或快捷删除，需要重新审视误删风险和确认策略
- restore 成功后当前会直接 `system:relaunch`；不要假设 renderer 可以安全地继续沿用 restore 前的 query cache / store / in-memory runtime
- `WINSSH_UPDATE_BASE_URL` 缺失时，更新 UI 应进入 `feed_url_missing`，不要把它当成异常态直接吞掉
- 如果要在开发态联调更新，需要一起考虑 `WINSSH_ALLOW_DEV_UPDATES`、`dev-app-update.yml` 和本地 feed 服务
- 本地 mock release 目录是生成物，不要把生成出的模拟安装器当成真实升级包
- `system:getAppInfo` 当前驱动 about / updates editor 的版本、平台和发布通道显示；改版本命名时要同步确认 `releaseChannel` 推导与 UI 文案
- 主题系统当前是“theme id + theme registry + theme plugin document”的结构，不是简单 dark mode 开关
- 用户主题包当前通过 ZIP 导入到 `app.getPath('userData')/themes`，built-in theme pack 不可删除
- `web/` 站点当前直接复用根 `package.json` 的版本 / homepage，以及内置 `light-plus` / `dark-plus` 主题 JSON；修改这些源头会同时影响官网
- `servers` 表现在已经带 `brand_id`、`custom_icon_*`、`jump_server_id`，修改 server payload 或 mapper 时要一起考虑
- 标题栏样式切换当前要求重启应用生效
- 当前主进程没有独立 `gpu-config` 模块；如果遇到平台渲染问题，不要再按旧索引直接寻找该文件
- 字体选择不再依赖系统字体枚举；新增或删除字体时优先改 integrated font registry、renderer loader 和随包字体资产

## 当前脚本

这些脚本在 `package.json` 中已定义：

```bash
npm run format
npm run lint
npm run typecheck:node
npm run typecheck:web
npm run typecheck
npm run start
npm run dev
npm run build
npm run test
npm run web:dev
npm run web:build
npm run web:test
npm run updates:mock
npm run updates:serve
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
5. 继续做 Windows 打包与更新源联调，重点确认 `WINSSH_UPDATE_BASE_URL`、dev update config、更新对话框、`updates-editor` 和 `quitAndInstall` 的真实行为
6. 继续完善主题和平台层，尤其是用户主题包导入 / 删除、server brand / custom icon 体验、内置字体策略、Windows GPU 策略和标题栏切换体验
