# AGENTS.md

## 说明

这份文件用于给后续协作者和代码代理提供当前项目快照。

本次梳理时间为 `2026-04-03`。内容只基于当前仓库代码、目录结构和关键入口文件阅读完成，没有执行 `test`、`typecheck`、`lint`、`build`、`dist` 等校验命令，因此这里描述的是“代码现状”，不是“已验证结果”。

## 这次迭代的关键变化

相比前一轮，当前代码已经出现几条明确的新主线：

### 1. 凭据库已经从概念入口变成独立子系统

- `database.ts` 已新增 `credentials` 表
- `servers` 表已新增 `credential_id`
- 主进程已暴露：
  - `credentials:list`
  - `credentials:getSecret`
  - `credentials:create`
  - `credentials:update`
  - `credentials:delete`
- 设置页已有独立 `Credential Vault` 分区
- `CredentialVault` 组件支持新增、编辑、删除凭据
- 服务器编辑器支持选择 `credentialId`
- 选择凭据后，编辑器会自动预填 password / private key / passphrase，并同步 auth type 预览

但当前不是“纯引用式凭据模型”，而是混合态：

- 凭据库 secret 当前保存在 SQLite
- 服务器内联 password / passphrase 仍走系统安全存储
- 服务器私钥内容当前也会写入 `servers.private_key`

### 2. 私钥模型从“路径”转向“内容入库”

- `ServerUpsertInput` 现在使用 `privateKey?: string | null`
- `servers` 表新增 `private_key` 列
- `DatabaseService.getServerPrivateKey()` 已可直接读私钥内容
- 新写入逻辑当前把 `private_key_path` 置空，说明新模型是“直接保存私钥文本”
- 连接时优先读取数据库中的 `private_key`，只有旧数据才回退到 `private_key_path`
- `system:pickPrivateKey` 现在返回文件内容，不是文件路径
- `servers:getSecrets` 已能把 `password`、`passphrase`、`privateKey` 一起回传给编辑器

这意味着当前处于“已迁移但保留旧数据兼容”的状态。

### 3. 会话连接流程有了明确的 phase 状态机

- `shared/types.ts` 新增 `SESSION_CONNECTION_PHASES`
- 当前 phase 包括：
  - `validate`
  - `handshake`
  - `prepare`
  - `attach`
- `SessionStateEvent` 现在带 `phase`
- `sessions-store` 会保存 `connectionPhase` 和 `connectionStartedAt`
- `SessionManager` 会在连接过程中主动发 phase 事件
- `TerminalPane` 的连接中遮罩已经按 phase 逐段推进，而不是单纯 loading

这条链路已经贯穿：

1. shared types
2. 主进程会话层
3. preload / session events
4. sessions store
5. 终端 UI

### 4. SFTP 面板已经从单文件浏览器升级成更完整的远端资源面板

当前代码里新增或增强了：

- 新建空文件 `sftp:createFile`
- 多选
- range 选择
- 上下文菜单按选中项批量操作
- 路径复制
- 路径发送到终端
- 当前路径卡片
- 权限展示由单个八进制字符串升级成：
  - `octal`
  - `symbolic`

这意味着 SFTP 部分已经开始接近“轻量远端文件管理器”，不再只是目录列表。

### 5. 主题系统继续深化，并新增第二套内置主题包

- `ThemeRegistry`
- 内置主题插件目录现在至少有两包：
  - `winssh-default-themes`
  - `winssh-liquid-glass`
- 用户主题目录
- 主题 manifest / theme document schema
- 命令中心直接切主题
- 状态栏显示当前主题
- 终端跟随主题终端色板与默认字体策略
- 主题 token 已覆盖：
  - logo 配色
  - terminal overlay
  - scanline
  - `terminal-overlay-backdrop-blur`

### 6. 设置与安全管理进一步成型

- `known_hosts` 现在不只是展示，还支持删除
- 设置页已经接入 `themes:list`
- 设置页读取和保存的 theme 现在是主题 id，不是简单 light/dark
- 设置页新增凭据库分区

### 7. 工作台交互和品牌层也有明显迭代

- 新 logo 已接入
- 自定义标题栏里直接使用 logo
- 标题栏集成 quick open / command palette / sidebar / panel / window controls
- Explorer、Sidebar、SFTP 等处都加入了更多 tooltip 和确认交互
- 侧边栏删除服务器现在有确认对话框
- 最近连接支持一键清空

### 8. 打包与交付层有更新

- `build/installer.nsh` 已添加 `ManifestDPIAware true`
- 说明 Windows 安装器 UI 已针对 HiDPI 做处理

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
- ssh2
- better-sqlite3
- keytar
- i18next
- shadcn/ui

## 当前阶段判断

当前项目已经不是原型壳，而是主链路清晰、工作台结构稳定、并且开始进入“细节能力扩展”的桌面客户端。

按当前代码看，产品已经同时覆盖：

- 服务器配置管理
- 凭据库管理
- SSH 会话连接 / 断开 / 重连
- 终端交互
- SFTP 浏览与传输
- 会话级端口转发
- 主题系统
- 设置中心
- known hosts 管理
- quick connect
- 多语言

更准确地说，现在处于“功能骨架完成，开始强化安全、细节体验和产品化能力”的 MVP/Beta 阶段。

## 核心架构

### `src/main/`

负责：

- Electron 主进程入口
- SQLite 数据库
- 系统安全存储
- SSH / SFTP / 端口转发运行时
- 主题注册与解析
- 主进程本地化
- 窗口和 GPU 配置

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
- 主题定义与主题 schema
- preload / renderer 共用 API 类型

### `src/renderer/src/`

负责：

- React 应用入口
- Workbench UI
- Zustand store
- React Query 数据流
- 终端、SFTP、端口转发界面
- 设置页
- i18n 资源

## 主进程现状

`src/main/index.ts` 当前已接入：

- `DatabaseService`
- `SecureStoreService`
- `SessionManager`
- `ThemeRegistry`
- 主进程本地化解析
- GPU 配置
- 标题栏配置

当前已暴露的 IPC 分组包括：

- `credentials:*`
- `groups:*`
- `tags:*`
- `servers:*`
- `sessions:*`
- `sftp:*`
- `portForwards:*`
- `themes:*`
- `settings:*`
- `system:*`

当前比较关键的新 IPC 包括：

- `credentials:*`
- `servers:getSecrets`
- `sftp:createFile`
- `themes:list`
- `system:removeKnownHost`

## 数据层现状

`src/main/database.ts` 当前持久化：

- 服务器分组
- 标签
- 凭据库条目
- 服务器配置
- 服务器到凭据库的引用关系
- 服务器与标签关系
- known hosts
- 最近连接记录
- 应用设置

当前没有数据库级的端口转发表，因此端口转发规则仍是会话运行时状态。

### 私钥存储现状

`servers` 表当前同时存在：

- `private_key_path`
- `private_key`

其中：

- 新写入使用 `private_key`
- `private_key_path` 主要用于兼容旧数据读取

这是当前非常重要的兼容性约束，后续修改不要把旧数据迁移路径破坏掉。

### 凭据库存储现状

`credentials` 表当前保存：

- `kind`
- `username`
- `password`
- `private_key`
- `passphrase`
- `note`

同时 `servers` 表现在还通过 `credential_id` 引用凭据条目。

这意味着当前数据库不再只是“非 secret 元数据存储”，而是已经直接承载凭据库 secret。

## 安全存储现状

当前 secret 存储已经不是单一路径，而是拆成三类：

- 服务器内联 password / passphrase 仍然经由 `src/main/secure-store.ts` 走系统安全存储
- 服务器私钥内容现在会写入 SQLite `servers.private_key`
- 凭据库 secret 会写入 SQLite `credentials.password / private_key / passphrase`

因此现在不能再假设“所有 secret 都只在系统安全存储里”。

`SecureStoreService` 当前特征：

- 能力探测结果会缓存
- keytar 失败时整体降级为“返回不可用 / 不抛出”
- 删除 secret 时采用 fail-soft 处理，避免 keychain 异常拖垮主流程
- 当前只负责服务器级 password / passphrase，不负责凭据库表里的 secret

## SSH / 会话层现状

`src/main/session-manager.ts` 当前覆盖：

- SSH 连接建立
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

当前连接接口返回的是结构化结果 `SessionConnectResult`：

- 成功：`{ ok: true, summary }`
- 失败：`{ ok: false, code, message }`

明确区分的失败码：

- `password_required`
- `auth_failed`
- `connection_failed`

### 当前连接凭据解析规则

`SessionManager.establishConnection()` 当前解析 secret 的方式是：

- `password = request.password ?? secureStore.getSecret(server.id, 'password')`
- `passphrase = request.passphrase ?? secureStore.getSecret(server.id, 'passphrase')`
- `privateKey = database.getServerPrivateKey(server.id) ?? legacy private_key_path`

也就是说，主进程连接链路当前不会直接从 `credentials` 表读取 password / passphrase / private_key。

凭据库目前更多是：

- 设置页里的统一管理入口
- 服务器编辑器的凭据选择器
- 渲染层表单预填与连接请求补全来源

这是一条很重要的现状约束，后续若想把凭据库做成真正的统一 secret provider，需要同步改主进程连接解析逻辑。

### 连接阶段状态

当前主进程会主动发送连接 phase：

- `validate`
- `handshake`
- `prepare`
- `attach`

这套 phase 现在不是 UI 自己模拟，而是主进程真实驱动。

### sessionId 现状

`ConnectionRequest` 现在支持可选 `sessionId`。

这意味着：

- renderer 可以先生成 client session id
- provisional tab 与真实连接能共用同一个 session identity
- 重试 / 重连时 UI 连续性更好

## SFTP 现状

当前已实现：

- 目录列表
- 刷新
- 新建空文件
- 新建目录
- 重命名
- 删除文件或目录
- 上传文件
- 下载文件
- 传输进度事件

### SFTP 元数据

`RemoteEntry.permissions` 现在不是单字符串，而是：

- `octal`
- `symbolic`

主进程里有明确的权限格式化逻辑，包含普通文件、目录、符号链接以及特殊位表示。

### SFTP 面板交互

当前 `SftpPanel` 已支持：

- 多选
- shift 范围选择
- 右键菜单
- 当前路径复制
- 文件路径批量复制
- 路径发送到终端
- 上一级导航
- 创建文件 / 创建目录

从代码看，目录删除仍走 `rmdir`，没有递归删除逻辑，所以非空目录仍是需要额外关注的边界。

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

当前端口转发的关键特征：

- 生命周期绑定在 session 上
- 规则快照保存在 `SessionManager` 内存中
- 会话断开后，启用中的规则会被回写成错误或停止状态
- 不是数据库持久化模型

渲染层已有 `PortForwardPanel`，入口位于会话编辑器右侧辅助区域。

## 主题系统现状

主题系统已经是正式能力，不再只是 light/dark 选择。

### 主题模型

`src/shared/themes.ts` 当前定义了：

- 主题选择值 `ThemeSelection`
- appearance
- source `builtin | user`
- workbench 颜色 token
- terminal 颜色 token
- terminal 默认字体 / 字号 / 行高
- 主题插件 manifest schema
- theme document schema

`ThemeMode` 现在本质上是 theme id。

### 主题注册

`src/main/theme-registry.ts` 当前负责：

- 加载内置主题目录
- 加载用户主题目录
- 解析主题插件 `package.json`
- 解析主题 JSON
- 去重主题 id
- 校验主题选择是否合法
- 计算窗口背景色
- 把非法选择归一化到 `system`

当前主题目录：

- 内置主题：`themes/builtin`
- 用户主题：`app.getPath('userData')/themes`

### 当前内置主题

当前内置主题不止一组，至少包括：

- `winssh.light-plus`
- `winssh.dark-plus`
- `winssh.pixel-crt`
- `winssh.liquid-glass-light`
- `winssh.liquid-glass-dark`

其中：

- `Pixel CRT` 不只是配色，还附带终端默认字体策略
- `Liquid Glass` 系列引入了更明确的玻璃质感 token，例如 `terminal-overlay-backdrop-blur`

### 渲染层主题应用

`src/renderer/src/App.tsx` 当前会：

- 读取 settings
- 读取 themes 列表
- 根据系统深浅色偏好解析最终主题
- 将 theme token 写入 `document.documentElement`

`src/renderer/src/lib/theme.ts` 当前负责：

- 解析最终 theme definition
- 写入 CSS 变量
- 设置 `data-theme` / `data-themeAppearance` / `data-themeSelection`
- 为终端生成主题色板与默认字体策略

### 主题入口

当前主题切换入口不只在设置页：

- `WorkbenchSettingsEditor`
- `WorkbenchCommandCenter`
- `WorkbenchStatusBar`

## Workbench 现状

当前渲染层是明确的 workbench 结构，而不是传统多页面表单应用。

核心布局在 `src/renderer/src/components/workbench/workbench-shell.tsx`，包含：

- 标题栏
- 活动栏
- 主侧边栏
- 编辑区
- 底部面板
- 命令中心
- 快速输入

当前活动区：

- `explorer`
- `terminal`
- `settings`

当前文档类型：

- `server-editor`
- `session-editor`
- `settings-editor`
- `terminal-welcome`

当前底部面板：

- `output`
- `transfers`
- `problems`

## 会话编辑器现状

`src/renderer/src/components/workbench/workbench-session-editor.tsx` 当前支持：

- 终端主视图
- SFTP 辅助侧栏
- 端口转发辅助侧栏
- 会话重连
- 会话断开
- 基于当前主题渲染终端外观

`sessions-store` 当前还记录：

- `auxView`
- `connectionPhase`
- `connectionStartedAt`

说明当前会话 UI 已经不仅管理 tab，还显式管理连接生命周期展示。

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

### 私钥编辑器现状

当前私钥输入方式已经从“文件路径”转成“文本内容”：

- UI 使用 `Textarea`
- 浏览按钮会读取文件内容填入文本域
- 编辑器会通过 `servers:getSecrets` 回填已保存的 `privateKey`

这意味着后续若想重新支持“仅存路径不存内容”，需要明确重新设计数据模型和安全策略。

## Quick Connect 现状

项目当前已经有 quick connect 流程。

关键点：

- `WorkbenchCommandCenter` 的 quick open 支持 quick connect
- `src/shared/quick-connect.ts` 当前只解析 `ssh user@host`
- 当前 quick connect 只面向密码认证
- 默认端口固定为 `22`
- 如果已存在匹配服务器配置，会直接复用
- 如果不存在，会自动创建一个 password 类型服务器配置再连接

quick connect 的失败恢复已经接入 quick input 凭据补录流，不是一次性命令式连接。

## 设置与安全现状

设置页当前支持：

- 语言
- 主题选择
- 标题栏样式
- 终端字体大小
- 终端字体族
- 光标样式
- 光标闪烁
- 选中即复制
- known hosts 列表查看
- known hosts 删除
- 凭据库管理

安全能力当前至少包括：

- 系统凭据存储可用性探测
- known hosts 指纹信任
- known hosts 管理
- 私钥内容回填与旧路径兼容

## 凭据库现状

当前凭据库是一个明确的产品能力，不再只是预留字段。

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
- 服务器编辑器里的 `credentialId` 选择器

当前行为特征：

- 服务器可以绑定一个 `credentialId`
- 编辑器选择凭据后会把 secret 预填进当前表单
- 选择 password 凭据时会把 auth type 切到 `password`
- 选择 private key 凭据时会把 auth type 切到 `privateKey`
- 删除凭据后，`servers.credential_id` 依赖数据库 `ON DELETE SET NULL` 自动清空引用

但当前仍然是混合模型，不是纯引用模型：

- 连接主流程不直接从凭据库取 secret
- 保存服务器时，表单里的 private key 仍可能写回 `servers.private_key`
- 服务器 remembered password / passphrase 状态仍主要反映系统安全存储，而不是凭据库内容

## 标题栏、品牌与交付现状

当前已经有明显的产品化和品牌层迭代：

- 新 logo 资产已加入 `src/renderer/src/assets/logo.svg`
- 标题栏内置 WinSSH logo
- 自定义标题栏可直接打开 quick open 和 command palette
- 标题栏集成 sidebar / panel / window controls
- `build/installer.nsh` 已开启 `ManifestDPIAware true`

因此当前项目不只是功能开发，也已经在推进品牌统一和安装体验。

## 国际化现状

当前至少存在：

- `zh-CN`
- `en-US`

并且本地化不是只作用于 renderer：

- 主进程会用当前语言生成系统对话文案
- 渲染层会根据设置和系统语言切换资源

## 测试版图现状

虽然本次没有执行测试，但从文件分布看，当前测试面已经明显扩大，至少覆盖了这些方向：

- `session-manager`
- `session-manager.connect`
- `theme-registry`
- `window-config`
- `gpu-config`
- `localization`
- `sftp` 工具
- `quick-connect`
- `theme` helper
- `use-terminal`
- `use-prefers-dark`
- `terminal-pane`
- `sftp-panel`
- `workbench-titlebar`
- `workbench-settings-editor`
- `workbench-server-editor`
- `workbench-quick-input`
- `workbench-command-center`
- `workbench-editor-tabs`
- `sessions-store`
- `workbench-store`

这说明代码库已经开始系统化补充回归面，而不是只靠人工联调。

## 关键数据流

多数功能改动会同时影响以下几层：

1. `src/shared/types.ts`
2. `src/shared/validation.ts`
3. `src/shared/api.ts`
4. `src/main/index.ts` 或 `src/main/session-manager.ts`
5. `src/preload/index.ts`
6. `src/renderer/src/*`

如果只改了主进程或只改了渲染层，极容易出现接口失配。

主题相关改动还会多牵涉：

- `src/shared/themes.ts`
- `src/main/theme-registry.ts`
- `themes/builtin/*`
- `src/renderer/src/lib/theme.ts`

私钥与连接流程相关改动还会多牵涉：

- `src/main/database.ts`
- `src/main/index.ts`
- `src/main/session-manager.ts`
- `src/renderer/src/components/workbench/workbench-server-editor.tsx`
- `src/renderer/src/store/sessions-store.ts`
- `src/renderer/src/components/terminal-pane.tsx`

凭据库相关改动还会多牵涉：

- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/shared/api.ts`
- `src/main/database.ts`
- `src/main/index.ts`
- `src/renderer/src/components/credential-vault.tsx`
- `src/renderer/src/components/workbench/workbench-server-editor.tsx`
- `src/renderer/src/components/workbench/workbench-settings-editor.tsx`
- `src/renderer/src/components/workbench/workbench-quick-input.tsx`

## 建议优先阅读的文件

第一次接手仓库，建议先看：

- `package.json`
- `src/main/index.ts`
- `src/main/session-manager.ts`
- `src/main/database.ts`
- `src/main/secure-store.ts`
- `src/main/theme-registry.ts`
- `src/preload/index.ts`
- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/shared/api.ts`
- `src/shared/themes.ts`
- `src/shared/quick-connect.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/components/credential-vault.tsx`
- `src/renderer/src/lib/theme.ts`
- `src/renderer/src/components/workbench/workbench-shell.tsx`
- `src/renderer/src/components/workbench/workbench-context.tsx`
- `src/renderer/src/store/sessions-store.ts`

如果要改会话辅助能力，再看：

- `src/renderer/src/components/sftp-panel.tsx`
- `src/renderer/src/components/port-forward-panel.tsx`
- `src/renderer/src/components/workbench/workbench-session-editor.tsx`
- `src/renderer/src/components/terminal-pane.tsx`

如果要改主题，再看：

- `themes/builtin/winssh-liquid-glass/package.json`
- `themes/builtin/winssh-default-themes/package.json`
- `themes/builtin/winssh-default-themes/themes/*.json`
- `themes/builtin/winssh-liquid-glass/themes/*.json`

如果要改私钥与凭据流程，再看：

- `src/renderer/src/components/workbench/workbench-server-editor.tsx`
- `src/main/database.ts`
- `src/main/index.ts`
- `src/main/secure-store.ts`
- `src/renderer/src/components/credential-vault.tsx`
- `src/renderer/src/components/workbench/workbench-settings-editor.tsx`

## 当前协作注意事项

- 不要再假设所有 secret 都只走系统安全存储，当前 secret 已分散在 keytar、`servers.private_key` 和 `credentials` 表
- 私钥现在会保存内容本身，修改前先确认是否接受这一安全模型
- `private_key_path` 目前仍承担旧数据兼容职责，不要直接删除兼容逻辑
- 凭据库当前 secret 直接在 SQLite 持久化，调整前先确认是否要加密、迁移或改回系统安全存储
- 连接结果当前依赖结构化失败码，不要随意改回纯异常流
- 连接 phase 现在已贯穿主进程到 UI，不要只改终端 overlay 文案而忽略真实事件流
- 凭据库现在不是纯引用式统一 secret provider，若要做真正的统一解析，至少要同时改 `session-manager`、`servers:getSecrets`、服务器状态标记和编辑器表单流
- 端口转发当前是 session 级内存状态，不要误以为已有数据库模型
- quick connect 当前只支持 `ssh user@host` 和密码认证，扩展前先确认目标语法
- 主题系统当前是“theme id + theme registry + theme plugin document”的结构，不是简单布尔 dark mode
- Workbench 已经围绕 `activity + document + panel + quick input` 组织，新增功能优先复用这套模型

## 当前脚本

这些脚本在 `package.json` 中已定义：

```bash
npm run dev
npm run start
npm run test
npm run typecheck
npm run lint
npm run build
npm run dist
```

这里只说明脚本存在，不代表本次已执行。

## 下一步建议

基于当前代码结构，后续优先级建议如下：

1. 先明确凭据库的长期模型，决定它是继续走 SQLite 明文式持久化，还是迁移到加密存储 / 系统安全存储
2. 再决定是否让 `SessionManager` 直接接管凭据库解析，避免当前“凭据库 + 服务器内联 + keytar”三套路径并存
3. 做真实 SSH / SFTP / 端口转发联调，确认新连接 phase、私钥内容存储和远程文件操作边界
4. 决定端口转发规则是否需要持久化、模板化或跨 session 复用
5. 继续完善 SFTP 资源管理与主题系统，尤其是非空目录、批量操作、用户主题安装和回退策略
