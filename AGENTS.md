# AGENTS.md

## 说明

这份文件用于给后续协作者和代码代理提供项目现状说明。

本次梳理时间为 `2026-04-02`。内容只基于当前仓库代码和关键入口文件阅读完成，没有执行 `test`、`typecheck`、`lint`、`build`、`dist` 等校验命令，因此这里描述的是“代码结构现状”，不是“已验证运行结果”。

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

当前项目已经不是原型壳，而是主链路明确、工作台结构完整的桌面客户端。按代码来看，已经具备以下产品骨架：

- 服务器配置管理
- SSH 会话连接、断开、重连
- 终端交互
- SFTP 浏览与文件传输
- 会话级端口转发
- 设置中心
- 主题系统
- 中英文本地化

更准确地说，现在处于“功能骨架完整的 MVP/Beta”阶段。后续工作的价值主要在真实联调、边界收敛、交互打磨和质量提升，而不是重搭架构。

## 核心架构

### `src/main/`

负责：

- Electron 主进程入口
- SQLite 数据库
- 系统安全存储
- SSH / SFTP / 端口转发运行时
- 主题注册与解析
- 本地化
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

- `groups:*`
- `tags:*`
- `servers:*`
- `sessions:*`
- `sftp:*`
- `portForwards:*`
- `themes:*`
- `settings:*`
- `system:*`

相比上一轮梳理，这里已经明确多了两块：

- 主题列表 `themes:list`
- known host 删除 `system:removeKnownHost`

## 数据层现状

`src/main/database.ts` 当前持久化：

- 服务器分组
- 标签
- 服务器配置
- 服务器与标签关系
- known hosts
- 最近连接记录
- 应用设置

明确没有看到数据库级的端口转发表，因此端口转发规则不是持久化业务对象，而是会话运行时状态。

数据库当前也支持删除 known host：

- `listKnownHosts`
- `getKnownHost`
- `deleteKnownHost`
- `upsertKnownHost`

## 安全存储现状

密码和私钥口令当前不写入 SQLite，而是经由 `src/main/secure-store.ts` 走系统安全存储。后续改动这块时，不要把 secret 回退成数据库明文、普通 JSON 或本地缓存字段。

## SSH / 会话层现状

`src/main/session-manager.ts` 已接入 `ssh2`，当前代码覆盖：

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

当前连接接口返回的是结构化结果 `SessionConnectResult`，不是简单抛异常：

- 成功：`{ ok: true, summary }`
- 失败：`{ ok: false, code, message }`

当前代码中明确区分的失败码包括：

- `password_required`
- `auth_failed`
- `connection_failed`

渲染层已经基于这个结果做差异化处理，尤其是密码补录和可恢复失败流程。后续不要把这套语义改散。

## SFTP 现状

当前已实现：

- 目录列表
- 刷新
- 新建目录
- 重命名
- 删除文件或目录
- 上传文件
- 下载文件
- 传输进度事件

渲染层已有独立的 `SftpPanel`，会跟随当前 session 的 `currentPath` 联动。

从当前实现看，目录删除走的是 `rmdir`，没有递归删除逻辑，所以非空目录依然属于需要重点注意的边界。

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

这一块是当前代码里比较明确的新能力，已经不是简单的 `light/dark` 切换。

### 主题模型

`src/shared/themes.ts` 当前定义了：

- 主题选择值 `ThemeSelection`
- 主题 appearance
- 主题来源 `builtin | user`
- workbench 颜色 token
- 终端颜色 token
- 终端默认字体 / 字号 / 行高
- 主题插件 manifest schema
- 主题文档 schema

`ThemeMode` 现在本质上是主题选择 id，而不是固定枚举。

### 主题注册

`src/main/theme-registry.ts` 当前负责：

- 加载内置主题目录
- 加载用户主题目录
- 解析主题插件 `package.json`
- 解析主题 JSON
- 去重主题 id
- 校验主题选择是否合法
- 解析窗口背景色
- 将非法主题选择归一化回 `system`

主进程当前使用的主题目录：

- 内置主题：`themes/builtin`
- 用户主题：`app.getPath('userData')/themes`

### 当前内置主题

从 `themes/builtin/winssh-default-themes/package.json` 看，当前至少有：

- `winssh.light-plus`
- `winssh.dark-plus`
- `winssh.pixel-crt`

其中 `Pixel CRT` 附带终端默认样式能力，不只是颜色变化。

### 渲染层主题应用

`src/renderer/src/App.tsx` 当前会：

- 读取 settings
- 读取 themes 列表
- 根据系统深浅色偏好解析最终主题
- 把主题变量写入 `document.documentElement`

`src/renderer/src/lib/theme.ts` 当前负责：

- 解析最终 theme definition
- 把 token 写入 CSS 变量
- 设置 `data-theme` / `data-themeAppearance` / `data-themeSelection`
- 为终端生成配色与默认字体策略

终端当前也会跟随主题：

- `WorkbenchSessionEditor` 会解析当前主题
- `TerminalPane` / `use-terminal` 会使用主题终端色板
- 如果用户仍使用默认终端字体配置，主题还能覆盖终端默认字体、字号和行高

### 主题入口

当前主题切换不只在设置页：

- `WorkbenchSettingsEditor` 支持从主题列表选择
- `WorkbenchCommandCenter` 也支持直接切换主题
- `WorkbenchStatusBar` 会显示当前主题标签

## Workbench 现状

当前渲染层是明确的 workbench 结构，不是传统表单页面拼接。

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

`sessions-store` 里当前还记录了 `auxView`，说明一个 session tab 可以在终端、SFTP 和端口转发之间切换辅助视图。

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

分组、标签、收藏、最近连接都已经整合进 Explorer 树，不是散落的独立页面。

## Quick Connect 现状

项目当前已经有 quick connect 流程。

关键点：

- `WorkbenchCommandCenter` 支持 quick open 输入
- `src/shared/quick-connect.ts` 当前只解析 `ssh user@host`
- 当前 quick connect 只面向密码认证
- 默认端口固定为 `22`
- 如果已存在匹配服务器配置，会直接复用
- 如果不存在，会自动创建一个 password 类型服务器配置再连接

quick connect 的失败恢复也已经接入 quick input 凭据补录流，不是一次性命令式连接。

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

安全能力当前至少包括：

- 系统凭据存储可用性探测
- known hosts 指纹信任
- known hosts 管理

## 国际化现状

当前至少存在：

- `zh-CN`
- `en-US`

并且本地化不是只作用于 renderer：

- 主进程会用当前语言生成系统对话文案
- 渲染层会根据设置和系统语言切换资源

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

## 建议优先阅读的文件

第一次接手仓库，建议先看：

- `package.json`
- `src/main/index.ts`
- `src/main/session-manager.ts`
- `src/main/database.ts`
- `src/main/theme-registry.ts`
- `src/preload/index.ts`
- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/shared/api.ts`
- `src/shared/themes.ts`
- `src/shared/quick-connect.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/lib/theme.ts`
- `src/renderer/src/components/workbench/workbench-shell.tsx`
- `src/renderer/src/components/workbench/workbench-context.tsx`
- `src/renderer/src/store/sessions-store.ts`

如果要改会话辅助能力，再看：

- `src/renderer/src/components/sftp-panel.tsx`
- `src/renderer/src/components/port-forward-panel.tsx`
- `src/renderer/src/components/workbench/workbench-session-editor.tsx`

如果要改主题，再看：

- `themes/builtin/winssh-default-themes/package.json`
- `themes/builtin/winssh-default-themes/themes/*.json`

## 当前协作注意事项

- 密码和 passphrase 继续走系统安全存储，不要写回 SQLite
- 连接结果当前依赖结构化失败码，不要随意改回纯异常流
- 端口转发当前是 session 级内存状态，不要误以为已有数据库模型
- quick connect 当前只支持 `ssh user@host` 和密码认证，扩展前先确认目标语法
- 主题系统当前是“主题选择 id + 主题注册表 + 主题插件文档”的结构，不是简单布尔 dark mode
- Workbench 已经围绕 `activity + document + panel + quick input` 组织，新增功能优先复用这套模型
- 会话相关 UI 改动通常同时牵涉：
  - `use-session-events`
  - `sessions-store`
  - `workbench-store`
  - 对应 editor / panel 组件

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

1. 做真实 SSH / SFTP / 端口转发联调，确认主链路边界
2. 明确 quick connect 是否要扩展到端口参数、私钥或更多 SSH 语法
3. 决定端口转发规则是否需要持久化、模板化或跨 session 复用
4. 持续补 SFTP 边界行为，尤其是目录删除、失败反馈和批量操作
5. 持续打磨主题系统，明确用户主题安装、热更新和回退策略
