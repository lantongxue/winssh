# SSH / UI 进程级解耦设计

**日期**：2026-06-07
**作者**：Brainstorming session
**状态**：Draft（待用户书面审查）
**目标版本**：winssh 持续演进，分 5 个里程碑交付

## 背景与目标

winssh 当前的主进程 `SessionManager`（2658 行）是一个"上帝类"，同时承担 SSH 连接、shell 通道、SFTP、端口转发、命令历史、OSC 解析、shell 集成、主机信任、资源监控、状态事件等职责。终端数据流 `ssh2 → IPC → preload Hub → renderer → xterm.write` 走单一序列化通道，多会话、高吞吐、键入响应三类场景均存在感知到的卡顿。

本次设计的**单一目标**：通过**进程级隔离**把 SSH 核心从 Electron 主进程和 React 渲染主线程上挪开，使所有 4 类性能痛点（输入延迟 / 主事件循环阻塞 / 冷启动 / 高吞吐数据延迟）都得到根因层解决。

**非目标**（本期不做）：

- 不重构业务功能（连接流程、文档管理、设置等）
- 不动 `LocalTerminalManager`（node-pty 在 main 是合理的，OSC 解析在 main 也可以接受）
- 不重新设计主题、i18n、主题包、备份/恢复、自动更新等

## 阶段交付（A → B 路径）

每个 M 必须满足"独立可发版、可回退"。

| M | 名称 | 关键产出 | 验收 |
|---|---|---|---|
| M1 | 服务边界 | 5 个服务模块 + `SshControlPort`/`SshDataPort` 抽象 | 现有测试全过；`SessionManager` 仍在 main；架构清晰 |
| M2 | ssh-core Worker | ssh2 迁入 `worker_threads`；IPC API 表面不变 | 单 session 行为不变；多 session 内存峰值下降 |
| M3 | 数据通道 | 二进制帧 + `MessagePort` + 背压 | `data.frame.lag_ms` p95 < 50ms |
| M4 | xterm Web Worker | OffscreenCanvas + SharedArrayBuffer | 5 会话 `tail -f` 单核 < 30% |
| M5 | 其他服务拆分 | SFTP/port-forward/osc-history/resource-monitor/host-trust 各入 worker | 主进程 CPU idle > 80% @ 5 session |

每个 M 保留 `WINSSH_LEGACY_TERMINAL=1` 开关回退到上一阶段。

## §1 架构总览

### 进程边界

| 进程 / 线程 | 职责 | 不再做 |
|---|---|---|
| **Main 线程**（Electron 主进程） | DB 持久化 / Bootstrap / IPC 编排 / 凭据管理 / 业务上下文（连接流程、状态机、UI 文档生命周期） | 不直接持有 `ssh2.Client`；不做 OSC 解析 |
| **ssh-core worker**（`worker_threads`） | 拥有 `ssh2.Client` 生命周期、shell channel 字节流、认证、跳板 | 不写 DB、不调 i18n |
| **子 worker：sftp / osc-history / port-forward / resource-monitor / host-trust**（`worker_threads`） | 各管一摊。共享同一 sessionId 的 `Client` 通过 `MessagePort` + 句柄借用协调 | — |
| **Preload**（`contextBridge`） | typed bridge；`SshDataPlane` 通过 Web `MessageChannel` 把 TerminalWorker 与主进程连接 | 不再为每条字节调 `ipcRenderer.send` |
| **Renderer 主线程** | React UI / Zustand / React Query / 路由 / 文档管理 | 不渲染 xterm |
| **TerminalWorker**（Web Worker，OffscreenCanvas） | xterm 生命周期 / 渲染 / 搜索 addon / 复制粘贴 / 输入事件 | 不持有 React 状态 |

### 平面划分

- **控制平面**（control plane）：低频、JSON、typed message。`sessions:control.*` IPC + `MessagePort` 直连。
- **数据平面**（data plane）：高频、二进制。`SharedArrayBuffer` 环形缓冲（终端字节流）+ Transferable `ArrayBuffer`（SFTP 块传输）。

### 关键不变量

1. ssh-core worker 是 `ssh2.Client` 的**唯一所有者**；任何 SSH 操作必须经过它。
2. 任何子 worker 可独立崩溃 / 重启，不影响 ssh-core；ssh-core 崩溃意味着该 session 不可恢复（用户看到错误并可重连）。
3. TerminalWorker 是 xterm 的**唯一所有者**；主线程不直接 `terminal.write`。
4. 控制平面消息可乱序但要幂等；数据平面消息按到达顺序（不保证不丢，丢失即降级显示）。
5. 凭据在 worker 启动时通过 `parentPort.postMessage` 注入；明文 secret 永不出 worker 边界到 Renderer Mainland；worker 关闭时显式 `Buffer.fill(0)`。

## §2 组件清单

### Main 进程组件

| 组件 | 路径 | 职责 |
|---|---|---|
| `SessionOrchestrator` | `src/main/application/sessions-application-service.ts`（重写） | 会话生命周期、文档生成、错误恢复、IPC 编排。**不持有 `ssh2.Client`** |
| `SshControlPort` | `src/main/services/ssh-control-port.ts`（新） | 主进程 ↔ ssh-core worker 的控制通道。消息类型定义在 `@shared/ssh-protocol` |
| `SshDataAggregator` | `src/main/services/ssh-data-aggregator.ts`（新） | 把 ssh-core 的数据帧按 `sessionId` 路由到正确的 Web `MessagePort` |
| `SftpDispatcher` | `src/main/services/sftp-dispatcher.ts`（新） | SFTP IPC ↔ sftp worker |
| `PortForwardDispatcher` | `src/main/services/port-forward-dispatcher.ts`（新） | port-forward IPC ↔ port-forward worker |
| `OscHistoryDispatcher` | `src/main/services/osc-history-dispatcher.ts`（新） | command history IPC + 命令记录路由 |
| `WorkerSupervisor` | `src/main/services/worker-supervisor.ts`（新） | 启停 / 重启 / 健康检查 / 指标采集所有 worker |

### Worker 组件

| Worker | 路径 | 持有 |
|---|---|---|
| `ssh-core` | `src/main/workers/ssh-core/` | `ssh2.Client`、`shell: ClientChannel`、SFTP `SFTPWrapper`（**外借**给 sftp worker via `MessageChannel`） |
| `sftp` | `src/main/workers/sftp/` | 接收 ssh-core 外借的 SFTP 句柄；所有 SFTP 操作 |
| `osc-history` | `src/main/workers/osc-history/` | OSC 扫描器、shell 集成注入、命令历史记录（写 DB 通过 RPC 到 main） |
| `port-forward` | `src/main/workers/port-forward/` | local/remote 端口转发 runtime |
| `resource-monitor` | `src/main/workers/resource-monitor/` | 现有 `ResourceMonitorService` 迁入 |
| `host-trust` | `src/main/workers/host-trust/` | 现有 `verifyHost` 逻辑迁入 |

> 备注：SFTP 不必"独立"持有 socket，ssh-core 把 SFTP 句柄的"操作权"借给 sftp worker。两者通过 `MessageChannel` 协调（控制消息 + 数据通道）。

### Preload 组件

| 组件 | 路径 | 职责 |
|---|---|---|
| `WinsshApiBridge` | `src/preload/index.ts`（重写） | 保留 `window.winsshApi` 形状（破坏性变更最小化），内部用 `MessagePort` 直连主进程的 `SshControlPort` |
| `TerminalPortAllocator` | `src/preload/terminal-port-allocator.ts`（新） | 为每个 session 分配 Web `MessageChannel` 与 SharedArrayBuffer 槽位 |
| `BinaryChannel` | `src/preload/binary-channel.ts`（新） | 二进制帧协议（长度前缀 + 序号 + payload），背压感知 |

### Renderer 组件

| 组件 | 路径 | 职责 |
|---|---|---|
| `TerminalWorkerHost` | `src/renderer/src/workers/terminal-worker-host.ts`（新） | 主线程侧的 Web Worker 代理，xterm 卸载/加载、消息桥 |
| `TerminalWorker` | `src/renderer/src/workers/terminal.worker.ts`（新） | 持有 `Terminal` 实例、`OffscreenCanvas`、所有 addon；通过 `MessagePort` 与主进程通信 |
| `TerminalTransport`（hook） | `src/renderer/src/hooks/use-terminal.ts`（重写） | 不再调 `sessionsClient.onData`，改为 `terminalWorkerHost.attach(sessionId)` |
| `SshSessionApi` | `src/renderer/src/features/sessions/api/sessions-client.ts`（扩展） | 新增 `getDataChannel(sessionId): MessagePort` 和流式订阅 |

### 共享协议

| 模块 | 路径 |
|---|---|
| `@shared/ssh-protocol` | `src/shared/ssh-protocol.ts`（新） | ssh-core worker 与主进程的所有控制消息类型（Zod schema） |
| `@shared/worker-protocol` | `src/shared/worker-protocol.ts`（新） | Web Worker ↔ 主线程二进制帧协议 |
| `@shared/ssh-data-frame` | `src/shared/ssh-data-frame.ts`（新） | 数据平面帧格式（共享内存布局） |

### 被废弃 / 替换的旧文件

| 旧 | 新 |
|---|---|
| `src/main/session-manager.ts`（2658 行） | 拆为 5 个 worker + 1 个 orchestrator |
| `src/main/local-terminal-manager.ts` | 保持不动（本期不纳入） |
| `src/renderer/src/hooks/use-terminal.ts`（600 行） | 大幅简化（只挂载/卸载 TerminalWorker） |
| `src/renderer/src/hooks/use-session-events.ts`（244 行） | 改为订阅 Worker 的 `MessagePort` |

## §3 数据流

### 3.1 控制平面：连接流程

```
[Renderer React]
  workbench-context.connectServer(server)
   └─→ SshSessionApi.connect(connectionRequest)
        └─→ [Preload] sessions:control.connect (IPC invoke)
             └─→ [Main] SessionOrchestrator.connect(request)
                  ├─→ resolveSecrets(request.secrets)
                  ├─→ ssh-core.worker.postMessage({
                  │       type: 'connect',
                  │       requestId,
                  │       sessionConfig  // 不含明文密码
                  │     })
                  │     [Worker 内部] ssh2.Client.connect()
                  │     [Worker 内部] client.shell() / client.sftp()
                  │     [Worker 内部] emit state 'validate' → 'handshake' → 'attach'
                  │
                  ├─→ DB.recordCommand / DB.snapshotSession
                  │
                  └─→ Promise resolves with SessionSummary

  [反向] 状态变化经由 'sessions:state' IPC 事件回到 Renderer
```

要点：
- 控制消息走 `ipcMain.handle` / `ipcRenderer.invoke`，保留 Promise 语义和类型校验
- 高频状态变化（连接阶段切换）由 worker 推给主进程，主进程再 `webContents.send`
- 凭据通过 `parentPort.postMessage` 注入 worker；**worker 关闭时显式清零 buffer**

### 3.2 数据平面：终端字节流（M4 重点）

```
[ ssh2 shell: ClientChannel ]
        │ .on('data', buffer)        // Node Buffer, 1B~64KB
        ▼
[ ssh-core worker ]                  // Node Thread
   ring buffer: SharedArrayBuffer 8MB（per session）
        │ frame every 8ms OR 16KB whichever first
        ▼  [transfer] ArrayBuffer
[ Main: SshDataAggregator ]
        │ route by sessionId
        ▼  [MessagePort postMessage, transfer]
[ Preload: BinaryChannel ]
        │ receive → re-batch to renderer  // ≤1 frame per rAF
        ▼
[ Renderer Mainland: TerminalWorkerHost ]
        │ port.postMessage →
        ▼
[ TerminalWorker (Web Worker) ]
        │ xterm.write(bytes)         // 零拷贝
        ▼
[ xterm.js + OffscreenCanvas ]
        │
        ▼ (渲染到 OffscreenCanvas, GPU)
[ 用户看到终端输出 ]
```

反向（用户输入）：

```
[ xterm.onData(text) ]               // TerminalWorker 内
        │ postMessage
        ▼
[ Main: BinaryChannel ]
        │ postMessage to main
        ▼
[ SshDataAggregator ]   →  [ ssh-core worker ]   →  [ ssh2 shell.write(buffer) ]
```

### 3.3 SFTP 块传输（M5 重点）

SFTP 文件读写不走 SharedArrayBuffer。改用：

```
[ Renderer: fileEditor ]
   read = async sessionId, path
   ─ipc invoke→ sftp:readFile
                ├─ [ Main: SftpDispatcher ] 委派给 sftp worker
                │    读 sftp-core handle 拿到的字节流
                ├─ [ sftp worker ] 边读边 postMessage 进度
                │    一次最多 256KB 一帧
                ├─ 主进程转发到 renderer
                └─ Renderer 累加 → Monaco.setValue()
```

取消语义：`AbortSignal` 通过 `parentPort.postMessage({ type: 'cancel' })` 透传到 worker。

### 3.4 其他能力

| 能力 | 数据流形态 |
|---|---|
| 端口转发状态 | 控制平面（频率低，事件式） |
| 资源监控快照 | 控制平面（每 2-5s 一次） |
| OSC 扫描结果 | 控制平面（命令边界：start/pre/done/cwd） |
| 命令历史条目 | 控制平面（命令完成时一条） |
| 主机信任请求 | 控制平面（带 Promise 握手） |

这些都不需要 SharedArrayBuffer。统一走 `MessagePort` + 结构化克隆。

### 3.5 背压策略

| 通道 | 高水位 | 低水位 | 溢出处理 |
|---|---|---|---|
| Terminal SAB | 8MB / session | 1MB | 丢最早 50% 数据 + emit `backpressure` 事件；xterm 会自然重绘丢失区 |
| SFTP read | 64 inflight | 8 | 暂停 `sftp.read` 直到 inflight < low |
| IPC control | N/A（invoke 限流） | N/A | 队列上限 1000，超出丢弃并打 warning |

### 3.6 消息协议（示例）

```ts
// @shared/ssh-protocol
export type SshCoreInbound =
  | { type: 'connect'; requestId: string; config: SshConnectConfig }
  | { type: 'disconnect'; sessionId: string }
  | { type: 'reconnect'; sessionId: string }
  | { type: 'resize'; sessionId: string; cols: number; rows: number }
  | { type: 'write'; sessionId: string; data: ArrayBuffer }

export type SshCoreOutbound =
  | { type: 'state'; sessionId: string; phase: SessionConnectionPhase; message?: string }
  | { type: 'data'; sessionId: string; frame: ArrayBuffer; seq: number }
  | { type: 'exit'; sessionId: string; code: number; signal?: string }
  | { type: 'error'; sessionId: string; message: string; code?: string }
```

## §4 错误处理

### 4.1 故障域与恢复

| 故障 | 检测 | 恢复 |
|---|---|---|
| **ssh-core worker 崩溃** | `worker.exit !== 0` | 1) 标记 session `error` 状态；2) 不自动重连；3) UI 提示并提供 reconnect 按钮 |
| **子 worker 崩溃**（sftp/port-forward/osc-history/resource-monitor/host-trust） | 同上 | WorkerSupervisor 重启 worker；session 维持 ready；丢失 SFTP 在途请求（重试即可） |
| **TerminalWorker 崩溃** | `worker.onerror` / `onmessageerror` | 主线程 spawn 新 TerminalWorker；OffscreenCanvas 重新 transfer；用户感知为"重绘"（scrollback 由 xterm 自管） |
| **OffscreenCanvas 不可用** | `try { transferControlToOffscreen }` 抛错 | 回退到 Renderer 主线程跑 xterm（保留 WebGL 路径，mainland 渲染）；emit `terminal:fallback` |
| **WebGL 上下文丢失** | `WebglAddon.onContextLoss` | xterm 自动 fallback 到 canvas/DOM；用户无感 |
| **SharedArrayBuffer 不可用** | `crossOriginIsolated === false` | 回退到 Transferable `ArrayBuffer` + `MessagePort`（性能降级但不崩） |
| **SAB 背压溢出** | 写入追上读取 | 丢最早 50% 帧 + 写 `\r\n[LOST DATA]\r\n` 标记 + emit `backpressure` 事件 |
| **IPC 通道断开** | `webContents.destroyed` | 主进程清理该 renderer 持有的所有 session 资源（不持久化，UI 重连即可） |
| **凭据注入失败** | worker 收到 `connect` 但 secret 不可解密 | emit `state: error code='secret_required'`；UI 弹快速输入框（复用现有 `requestConnectionSecrets` 流程） |
| **ssh2 内部错误** | `Client.on('error')` | worker 内部捕获 → `state: error` + `code: connection_failed`；session 进入可重连态 |

### 4.2 资源生命周期

- 每个 session 一组 Disposable：worker 引用、SAB、MessagePort、Interval 计时器、xterm 句柄
- 用 `SessionResources` 类聚合，`sessionId → resources`，关闭时统一 `dispose()`
- 关闭顺序（**严格**）：取消所有 in-flight IPC → 关闭 TerminalWorker → 关闭 xterm → 关闭 MessagePort → worker.postMessage('disconnect') → 等待 ack 或 timeout → `worker.terminate()`
- `WorkerSupervisor` 强制每 24h 滚动重启空闲 worker（避免内存累积）

### 4.3 日志与可观测性

- 每个 worker 启动时分配 `workerId: 'ssh-core-${pid}-${ts}'`
- 所有跨边界消息带 `correlationId`（与 `sessionId` 同维度）
- 主进程 `observability.ts` 统一收集：
  - `worker.spawn.duration` / `worker.terminate.duration`
  - `data.frame.size` / `data.frame.lag_ms`（端到端）
  - `backpressure.drop_count`（按 session 累计）
  - `worker.crash.count`（按 worker 类型）
- 继续遵循现有规则：主线程不 `console.log`，使用 `createLogger()`

### 4.4 安全边界

- Worker 是**可信**（应用自己 fork），无需担心恶意代码注入
- 凭据不写入日志（`redactSecret()` 包装）
- SFTP 上传下载路径继续走 `normalizeRemotePath()`（防 `../` 越权，**现有逻辑保留**）
- Session 序列化走 `@shared/types` Zod 校验（**现有规则保留**）
- Web Worker 加载路径必须走 Vite 静态资源清单，**禁止** `importScripts` 远程 URL

### 4.5 降级链

```
目标态：M4 完整版（WebGL + SAB + 6 worker）
   ↓ 失败
回退 1：DOM 渲染 + SAB（WebGL 不可用）
   ↓ 失败
回退 2：DOM 渲染 + Transferable（crossOriginIsolated 不可用）
   ↓ 失败
回退 3：DOM 渲染 + 同步 IPC（TerminalWorker 不可用）
   ↓ 失败
现有架构（god-class SessionManager）—— M1/M2 之后可强制保底
```

每次降级 emit `terminal:degraded` 事件，状态栏可见。

## §5 测试策略

### 5.1 测试金字塔

```
                  ┌────────────┐
                  │  E2E (少量) │  Playwright + 真实 sshd (docker)
                  └─────┬──────┘
              ┌─────────┴────────┐
              │  集成 (中等)     │  worker + docker sshd 双向测试
              └─────┬───────────┘
        ┌───────────┴────────────┐
        │  组件 (大量)            │  service 单元 + 模拟 worker
        └─────┬──────────────────┘
   ┌──────────┴──────────┐
   │  纯函数 (海量)       │  协议解析 / 帧编解码 / OSC 扫描
   └─────────────────────┘
```

### 5.2 单元测试（Vitest）

- `@shared/ssh-protocol`：Zod 解析 / reject 错误 / 字段缺失
- `@shared/worker-protocol`：帧编解码 round-trip / 大小端 / 序号溢出
- `scanOscChunk`：现有 `osc-scanner.test.ts` 不变（**保留**）
- Service 单元：mock worker 端口，验证消息路由
- `BinaryChannel`：mock `MessagePort`，验证批帧、背压触发

### 5.3 组件测试

- `SessionOrchestrator`：用 mock `SshControlPort` 验证：
  - `connect` 失败时不留资源
  - `disconnect` 调用顺序正确
  - 并发 `connect` 同 session 去重
- `WorkerSupervisor`：spawn 健康 worker / spawn 崩溃 worker / 重启策略
- `SshDataAggregator`：多 session 数据路由正确 / 关闭后不泄漏
- `TerminalWorkerHost`（jsdom + Mock OffscreenCanvas）：
  - `attach` 触发 worker 初始化
  - `detach` 触发 `worker.terminate`
  - 主线程崩溃时 worker 不残留

### 5.4 集成测试

- `ssh-core` + docker sshd：
  - 连接 + 认证（密码 / 公钥）
  - shell 流往返
  - SFTP 上传 / 下载 / 断点续传
  - 跳板服务器
  - 网络中断模拟
  - **必须**真实跑 ssh2 库（不要 mock）
- `TerminalWorker` + OffscreenCanvas polyfill：
  - 渲染 1000 行 ANSI 输出
  - 大量 OSC 序列不破坏 xterm
  - 输入事件 round-trip

### 5.5 E2E（少量但关键）

- 启动应用 → 添加 server → 连接 → 输入 `ls` → 看到输出 → 关闭 → 重新打开 session
- 多个 session 并发：3 个 + 同时操作无卡顿
- 跳板链路完整
- SFTP 大文件（>100MB）传输 + 取消
- 自动更新（保留现有 E2E）

### 5.6 性能基准（CI 必跑）

- **打字延迟**：`type "hello\n"` → 看到 `hello$ ` 时间差，p95 < 16ms（1 帧）
- **高吞吐**：`yes | head -n 100000` 输出 100K 行不丢、不卡 UI
- **多会话**：5 个并发 session 全部 `tail -f /var/log/syslog`，CPU < 30% 单核
- **冷启动**：`npm start` → 工作台可交互 < 2s（不含 ssh 握手）
- **SAB 吞吐**：`data.frame.lag_ms` p95 < 50ms

### 5.7 兼容与回归

- **保留所有现有测试**：M1 不删任何 `*.test.ts`，只增加
- 回归对比：M3 后跑 `npm run test`，断言不通过即 fail
- M2 后必须能做：`npm run dev` 启动 → 现有功能全部可用
- 金丝雀发布：M3-M5 阶段保留 `WINSSH_LEGACY_TERMINAL=1` 开关，让内测用户切换验证

### 5.8 测试工具

- `docker-ssh-fixture`：项目级 fixture，CI 起 `node:18-sshd`，预置 3 个用户
- `fake-indexeddb`：jsdom 测试用（DB mock）
- `msw`：mock IPC（仅组件测试，不在集成测试中用）
- `playwright` + electron driver：E2E

### 5.9 不测什么

- 不测 `ssh2` 库本身（上游责任）
- 不测 `xterm.js` 渲染像素（snapshot 测试不现实）
- 不测 Electron 内部 IPC 行为（跨平台关注点由项目级 E2E 覆盖）

## 跨切关注点

### Electron 配置变更

`electron.vite.config.ts`：
- `webPreferences.crossOriginIsolated: true`（M4 需要）
- `webPreferences.sandbox: false`（保持现有，避免破坏 native module）
- 增加 `worker_threads` 入口构建

`electron-builder.yml`：
- `asarUnpack` 不需新增（worker 走 `node:worker_threads` 加载本地 .js）

### i18n

- Worker 不直接调 i18n；用户可见错误消息由主进程翻译后透传
- 新增错误码需在 `src/main/localization.ts` 双语补齐

### 数据库

- 写 DB 的责任收敛到 main 进程；worker 通过 `parentPort.postMessage({ type: 'db:write', ... })` RPC 调用
- `database.ts` 不动

### Web 子项目 `web/`

- 不受本次影响（`web/` 走自己的 vite build）
- 但 `src/shared/themes.ts`（light/dark-plus）若有变，需同步（**本次不动**）

## 风险与回退

| 风险 | 概率 | 影响 | 回退 |
|---|---|---|---|
| `crossOriginIsolated` 配不上 | 中 | M4 失效 | 走降级链 2 |
| OffscreenCanvas + WebGL 兼容性 | 低 | M4 部分失效 | 走降级链 1 |
| worker_threads 在 Electron 39 的稳定性 | 低 | M2 不可用 | `WINSSH_LEGACY_TERMINAL=1` 保留旧路径 |
| SharedArrayBuffer 大小超过 V8 限制 | 极低 | 单 session 不可用 | 改 4MB SAB 或回退到 Transferable |
| xterm addon DOM 依赖（如 `WebLinksAddon`） | 中 | Worker 内需 mock | 改 addon 初始化位置（部分留在 main） |

## 与现有规则的兼容性

- ✅ ESLint 规则：`window.winsshApi` 仍只在 `features/shared/api/**`（Preload 暴露不变）
- ✅ 凭据模型：keytar 仍由 main 独占；worker 只接 secret 的明文副本
- ✅ 跳板：单跳规则不变
- ✅ 平台更新：仅 Windows 仍由 NSIS 触发
- ✅ keep-mounted 策略：`session-editor` / `local-terminal-editor` 仍 keep-mounted（xterm 实例化在 Worker，但卸载触发等同）
- ✅ SFTP 文本限制：read/write 仍是 string

## 实施节奏（粗略）

- M1：1-2 周
- M2：2-3 周
- M3：1-2 周
- M4：2-3 周
- M5：1-2 周 / 子项

合计 7-12 周，5 个可独立发版的里程碑。
