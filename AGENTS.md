# AGENTS.md

## 说明

这份文件用于给后续协作者和代码代理提供项目现状说明。

本次整理只基于当前仓库代码结构和关键入口文件阅读完成，没有执行 `npm test`、`npm run typecheck`、`npm run lint`、`npm run build` 等校验命令。

## 项目概览

- 项目名：`winssh`
- 版本：`0.1.0`
- 形态：Electron 桌面应用
- 目标：提供面向桌面的 SSH、SFTP 和端口转发工作台
- 主要技术栈：
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

项目已经不是原型壳层，而是已有完整主链路的 workbench 化客户端。当前代码显示，产品已经具备：

- 服务器配置管理
- SSH 会话建立与重连
- 终端展示与输入
- SFTP 浏览和传输
- 会话级端口转发
- 设置、语言、主题和窗口风格管理

更准确地说，当前阶段像是“功能主骨架已成型的 MVP/Beta”。后续工作重点应放在真实场景联调、边界处理、交互打磨和质量收敛，而不是重新设计整体结构。

## 当前能力梳理

### 主进程

`src/main/index.ts` 已经承担主进程编排职责，当前已接入：

- 数据库服务 `DatabaseService`
- 安全存储 `SecureStoreService`
- 会话管理 `SessionManager`
- 本地化解析
- GPU 配置
- 自定义或原生标题栏配置

当前已暴露的 IPC 能力包括：

- `groups:*`
- `tags:*`
- `servers:*`
- `sessions:*`
- `sftp:*`
- `portForwards:*`
- `settings:*`
- `system:*`

### 数据层

`src/main/database.ts` 当前负责持久化以下内容：

- 服务器分组
- 标签
- 服务器配置
- 服务器和标签关系
- known hosts
- 最近连接记录
- 应用设置

当前代码里没有看到端口转发表，说明端口转发规则不是数据库持久化能力，而是会话期内内存状态。

### 安全存储

密码和私钥口令当前不直接写入 SQLite，而是经由 `src/main/secure-store.ts` 走系统凭据存储。后续改动这一块时，不要把 secret 回退成数据库明文或普通配置文件字段。

### SSH 与会话层

`src/main/session-manager.ts` 已经接入 `ssh2`，并且不只是基础连接，当前代码覆盖了：

- SSH 连接建立
- shell 通道
- SFTP 通道
- 终端写入
- 终端窗口 resize
- 主机指纹校验
- known hosts 写入
- 会话断开
- 会话重连
- 最近连接记录
- 会话状态事件
- 输出事件
- 错误事件

当前连接返回值不是单一 `SessionSummary`，而是 `SessionConnectResult`：

- 成功时返回 `summary`
- 失败时返回结构化失败码和消息

目前代码里显式区分的失败码包括：

- `password_required`
- `auth_failed`
- `connection_failed`

这意味着渲染层已经开始依赖“可恢复失败”和“不可恢复失败”的差异化处理，后续不要随意改回纯异常流。

### SFTP

当前已实现的 SFTP 功能：

- 目录列表
- 刷新
- 新建目录
- 重命名
- 删除文件或目录
- 上传文件
- 下载文件
- 传输进度事件

渲染层已有独立的 `SftpPanel`，并且会跟随当前会话的 `currentPath` 联动。

从代码看，目录删除当前走 `rmdir`，没有递归删除逻辑，所以非空目录处理仍然需要特别留意。

### 端口转发

这一块是上一版文档漏掉的，当前项目已经有完整的会话级端口转发能力。

已实现内容包括：

- 端口转发规则创建
- 端口转发规则列表
- 启动规则
- 停止规则
- 删除规则
- 本地转发 `local`
- 远程转发 `remote`
- 端口转发状态事件
- 会话重连后迁移并恢复已启用规则

当前端口转发的重要特征：

- 生命周期绑定在 session 上，不是全局配置
- 规则快照保存在 `SessionManager` 内存中
- 会话断开后规则状态会被回写为停止或错误，而不是持久化到数据库

渲染层已有 `PortForwardPanel`，入口在会话编辑器侧边辅助视图中。

### Workbench 与渲染层

当前渲染层是明确的 workbench 结构，不是多页面表单式应用。

核心布局在 `src/renderer/src/components/workbench/workbench-shell.tsx`，包含：

- 标题栏
- 活动栏
- 主侧边栏
- 编辑区
- 底部面板
- 命令中心
- 快速输入

当前活动区包括：

- `explorer`
- `terminal`
- `settings`

当前文档类型包括：

- `server-editor`
- `session-editor`
- `settings-editor`
- `terminal-welcome`

当前底部面板包括：

- `output`
- `transfers`
- `problems`

### 会话编辑器

`src/renderer/src/components/workbench/workbench-session-editor.tsx` 当前已经支持：

- 终端主视图
- SFTP 辅助侧栏
- 端口转发辅助侧栏
- 会话重连
- 会话断开

会话 store 里还记录了 `auxView`，说明同一个 session tab 当前可在终端、SFTP、端口转发三者之间切换辅助视图。

### 服务器管理

服务器编辑器当前支持：

- 名称、主机、端口、用户名
- 密码认证
- 私钥认证
- 记住密码 / 记住口令
- 分组
- 标签
- 收藏
- 备注

分组、标签、收藏、最近连接等都已经被整合进左侧 Explorer 树。

### Quick Connect

当前代码已经有 quick connect 流程，不只是保存服务器后再连接。

关键点：

- `WorkbenchCommandCenter` 支持解析 `ssh user@host`
- `src/shared/quick-connect.ts` 当前只支持这种最小语法
- quick connect 当前只面向密码认证
- 默认端口固定为 `22`
- 如果库里已有匹配服务器会直接复用
- 如果没有，会创建一个对应的 password 类型服务器配置再发起连接

这意味着后续如果扩展 quick connect 语法，需要同步改：

- 解析器
- shared types
- workbench context
- 连接失败后的凭据补录流程

### 设置与国际化

当前设置页支持：

- 语言
- 主题
- 标题栏样式
- 终端字体大小
- 终端字体族
- 光标样式
- 光标闪烁
- 选中即复制
- known hosts 列表查看

当前多语言资源至少包含：

- `zh-CN`
- `en-US`

主进程和渲染进程都已经接入语言解析逻辑，不是只做了前端字符串替换。

## 代码分层

### `src/main/`

负责：

- Electron 主进程入口
- 数据库
- 安全存储
- SSH/SFTP/端口转发运行时
- 本地化
- 窗口和 GPU 配置

### `src/preload/`

负责：

- `contextBridge`
- 统一暴露 `window.winsshApi`

### `src/shared/`

负责：

- 共享类型
- 校验 schema
- quick connect 解析
- SFTP 路径工具
- 共享 API 类型

### `src/renderer/src/`

负责：

- React 应用
- Workbench UI
- Zustand store
- React Query 数据流
- 终端视图
- SFTP 面板
- 端口转发面板
- 国际化资源

## 关键数据流

后续改动时，经常会同时影响这几层：

1. `src/shared/types.ts`
2. `src/shared/validation.ts`
3. `src/main/index.ts` 或 `src/main/session-manager.ts`
4. `src/preload/index.ts`
5. `src/shared/api.ts`
6. `src/renderer/src/*`

如果一个功能改了主进程但没改 preload 或 shared API，渲染层通常会立刻失配。

## 建议优先阅读的文件

如果是第一次接手这个仓库，建议先看：

- `package.json`
- `src/main/index.ts`
- `src/main/session-manager.ts`
- `src/main/database.ts`
- `src/preload/index.ts`
- `src/shared/types.ts`
- `src/shared/validation.ts`
- `src/shared/api.ts`
- `src/shared/quick-connect.ts`
- `src/renderer/src/components/workbench/workbench-shell.tsx`
- `src/renderer/src/components/workbench/workbench-context.tsx`
- `src/renderer/src/store/sessions-store.ts`

如果要改会话辅助能力，再看：

- `src/renderer/src/components/sftp-panel.tsx`
- `src/renderer/src/components/port-forward-panel.tsx`
- `src/renderer/src/components/workbench/workbench-session-editor.tsx`

## 当前协作注意事项

- 密码和 passphrase 继续走系统安全存储，不要写回 SQLite
- 连接结果当前依赖结构化失败码，别把失败语义改散
- 端口转发当前是 session 级内存状态，不要误以为已有数据库模型
- quick connect 当前只支持 `ssh user@host` 和密码认证，扩展前要先确认预期
- Workbench 已经围绕 `activity + document + panel + quick input` 组织，新增功能优先复用这套模型
- 会话相关 UI 改动通常同时牵涉：
  - `use-session-events`
  - `sessions-store`
  - `workbench-store`
  - 对应 panel 或 editor 组件

## 当前可直接使用的命令

这些命令在 `package.json` 中已经定义：

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

基于当前代码结构，后续工作最值得优先关注的是：

1. 补真实场景联调，尤其是密码登录、私钥登录、known hosts、SFTP 传输、端口转发
2. 明确 quick connect 是否要继续扩展语法和认证方式
3. 评估端口转发是否需要持久化或模板化，而不是只绑在当前 session
4. 补齐 SFTP 边界行为，尤其是目录删除、失败反馈和批量操作
5. 继续收敛 workbench 交互细节，避免功能多了但状态管理分散
