# SSH UI 进程级解耦实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

> **执行入口已拆分：** 本文保留为总览和背景资料。实际实施请按里程碑分别使用以下独立计划：
>
> - M1：`docs/superpowers/plans/2026-06-09-ssh-ui-decoupling-m1-service-boundary.md`
> - M2：`docs/superpowers/plans/2026-06-09-ssh-ui-decoupling-m2-ssh-core-worker.md`
> - M3：`docs/superpowers/plans/2026-06-09-ssh-ui-decoupling-m3-data-channel.md`
> - M4：`docs/superpowers/plans/2026-06-09-ssh-ui-decoupling-m4-terminal-worker.md`
> - M5：`docs/superpowers/plans/2026-06-09-ssh-ui-decoupling-m5-auxiliary-workers.md`

**目标：** 将 SSH 连接、终端数据流、SFTP、端口转发、OSC/命令历史、资源监控和主机信任从 Electron 主进程与 React 主线程逐步解耦到 worker 边界，同时保持现有 IPC API 和 UI 行为可回退。

**架构：** 分 5 个可独立发布的里程碑推进：M1 先建立服务端口和协议边界但继续走旧 `SessionManager`；M2 将 SSH 核心迁入 `worker_threads`；M3 引入二进制数据通道与背压；M4 将 xterm 生命周期迁入 Web Worker 并保留主线程 fallback；M5 再拆出 SFTP、端口转发、OSC/历史、资源监控、主机信任子 worker。每个里程碑都通过 `WINSSH_LEGACY_TERMINAL=1` 或更细粒度 feature flag 回到上一稳定阶段。

**技术栈：** Electron 39、React 19、TypeScript 5、Vite 7、Vitest、ssh2、worker_threads、MessageChannel/MessagePort、SharedArrayBuffer/Transferable ArrayBuffer、xterm.js、Zod。

---

## 规格来源与仓库约束

- 规格：`docs/superpowers/specs/2026-06-07-ssh-ui-decoupling-design.md`
- 根约束：`AGENTS.md`
- 主进程约束：`src/main/AGENTS.md`
- Renderer 约束：`src/renderer/src/AGENTS.md`
- 测试约束：`test/AGENTS.md`
- 重要校正：Electron `WebPreferences` 不提供 `crossOriginIsolated` 配置项；M4 需要通过 COOP/COEP 响应头和运行时 `self.crossOriginIsolated` 检查启用 SharedArrayBuffer。参考 [Electron WebPreferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences)、[MDN COEP](https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Cross-Origin-Embedder-Policy)、[MDN crossOriginIsolated](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated)。

## 不变量

- `LocalTerminalManager` 不纳入本计划，local terminal 继续在 main 中使用 `node-pty`。
- Renderer 不直接访问 `window.winsshApi`，新增调用必须通过 `src/renderer/src/features/*/api`。
- `session-editor` 和 `local-terminal-editor` 继续 keep-mounted，不能改成条件渲染。
- SFTP 远程编辑继续保持 text-only：`readFile` / `writeFile` 的外部 API 仍返回和写入 string。
- 服务器密码和 passphrase 继续由 main 侧解析；worker 只接收连接所需的明文副本，并在 session 结束时清零。
- Jump server 继续单跳，不能引入多跳链。
- 端口转发继续 session-scoped memory only，不新增 DB 持久化。
- 所有用户可见错误码新增后必须同步 `src/main/localization.ts` 中英文。

## 文件结构

### 共享协议与工具

- 创建：`src/shared/ssh-protocol.ts`  
  职责：定义 main 与 ssh-core worker 的控制消息、连接结果、worker 错误码、Zod schema。
- 创建：`src/shared/ssh-data-frame.ts`  
  职责：定义终端数据帧二进制格式、序号、时间戳、背压事件和纯函数编解码。
- 创建：`src/shared/worker-protocol.ts`  
  职责：定义 renderer 主线程与 terminal worker 的消息类型、降级原因、terminal lifecycle 事件。
- 修改：`src/shared/api.ts`  
  职责：在不破坏现有 `WinsshApi` 的前提下增加 terminal data channel opt-in 方法。
- 修改：`src/shared/ipc-channels.ts`  
  职责：补充 `terminal:degraded`、`terminal:backpressure`、worker 指标事件类型。

### Main 进程

- 创建：`src/main/services/session-runtime.ts`  
  职责：抽象 SSH runtime 接口，让 legacy `SessionManager` 和 worker runtime 可以被 `SessionsApplicationService` 替换。
- 创建：`src/main/services/legacy-session-runtime.ts`  
  职责：把现有 `SessionManager` 包装为 `SessionRuntime`，M1 不改变行为。
- 创建：`src/main/services/ssh-control-port.ts`  
  职责：封装 main 与 ssh-core worker 的 request/response、事件订阅、超时和 correlationId。
- 创建：`src/main/services/ssh-data-aggregator.ts`  
  职责：按 `sessionId` 路由二进制终端帧，M1 先兼容旧 `sessions:data` 事件，M3 连接 MessagePort。
- 创建：`src/main/services/worker-supervisor.ts`  
  职责：统一 worker spawn、terminate、health check、crash reporting、restart policy。
- 创建：`src/main/services/sftp-dispatcher.ts`  
  职责：M1 包装 legacy SFTP 方法，M5 切到 sftp worker。
- 创建：`src/main/services/port-forward-dispatcher.ts`  
  职责：M1 包装 legacy port forward 方法，M5 切到 port-forward worker。
- 创建：`src/main/services/osc-history-dispatcher.ts`  
  职责：M1 记录接口边界，M5 承接 OSC/command history worker 事件。
- 修改：`src/main/application/sessions-application-service.ts`  
  职责：从直接依赖 `SessionManager` 改为依赖 `SessionRuntime` + dispatchers。
- 修改：`src/main/bootstrap.ts`  
  职责：装配 legacy runtime、worker runtime、feature flags、cross-origin isolation headers。
- 修改：`src/main/ipc/register-session-ipc.ts`  
  职责：新增 terminal data channel 建立入口，保留旧 IPC handler。
- 修改：`src/main/localization.ts`  
  职责：新增 worker crash、terminal degraded、secret required 等双语消息。

### Main workers

- 创建：`src/main/workers/ssh-core/index.ts`  
  职责：拥有 `ssh2.Client` 生命周期、shell channel、connect/write/resize/disconnect 控制消息。
- 创建：`src/main/workers/ssh-core/session-worker.ts`  
  职责：单 session runtime，封装 ssh2 callback 到 Promise 和 cleanup。
- 创建：`src/main/workers/ssh-core/secret-buffer.ts`  
  职责：接收 secret、转换 Buffer、关闭时 `fill(0)`。
- 创建：`src/main/workers/sftp/index.ts`  
  职责：M5 承接 SFTP text read/write/list/transfer/cancel。
- 创建：`src/main/workers/port-forward/index.ts`  
  职责：M5 承接 port forward runtime。
- 创建：`src/main/workers/osc-history/index.ts`  
  职责：M5 承接 OSC 扫描和命令历史事件生成。
- 创建：`src/main/workers/resource-monitor/index.ts`  
  职责：M5 承接 Linux resource snapshot 采样。
- 创建：`src/main/workers/host-trust/index.ts`  
  职责：M5 承接 host verification request/response。

### Preload

- 创建：`src/preload/binary-channel.ts`  
  职责：封装 MessagePort 二进制帧、队列水位、flush、dispose。
- 创建：`src/preload/terminal-port-allocator.ts`  
  职责：为每个 SSH session 建立 data channel，并把端口交给 renderer。
- 修改：`src/preload/index.ts`  
  职责：保留现有 API，新增 `sessions.createDataChannel(sessionId)`；旧 `sessions.onData` 继续可用。
- 修改：`src/preload/index.d.ts`  
  职责：同步 preload 暴露类型。

### Renderer

- 创建：`src/renderer/src/workers/terminal-worker-host.ts`  
  职责：主线程代理，管理 terminal worker spawn、attach、detach、fallback。
- 创建：`src/renderer/src/workers/terminal.worker.ts`  
  职责：拥有 `Terminal`、addons、data port、输入输出事件。
- 创建：`src/renderer/src/workers/terminal-worker-types.ts`  
  职责：renderer worker 专用类型，复用 `@shared/worker-protocol`。
- 修改：`src/renderer/src/features/sessions/api/sessions-client.ts`  
  职责：增加 data channel 方法，仍通过 `features/shared/api/winssh-client.ts`。
- 修改：`src/renderer/src/hooks/use-terminal.ts`  
  职责：M4 前维持旧主线程 xterm，M4 后变为 worker host 的薄 adapter；local terminal 走旧路径。
- 修改：`src/renderer/src/hooks/use-session-events.ts`  
  职责：M3 后订阅 terminal backpressure/degraded 事件并更新 toast/store。
- 修改：`src/renderer/src/store/sessions-store.ts`  
  职责：记录 terminal degraded/backpressure 状态，不改变 session identity。

### 配置与测试

- 修改：`electron.vite.config.ts`  
  职责：增加 main worker 和 renderer worker 构建别名/入口配置。
- 修改：`tsconfig.node.json`  
  职责：包含 `src/main/workers/**/*`。
- 修改：`tsconfig.web.json`  
  职责：包含 `src/renderer/src/workers/**/*`。
- 创建：`test/shared/ssh-protocol.test.ts`
- 创建：`test/shared/ssh-data-frame.test.ts`
- 创建：`test/shared/worker-protocol.test.ts`
- 创建：`test/main/services/legacy-session-runtime.test.ts`
- 创建：`test/main/services/ssh-control-port.test.ts`
- 创建：`test/main/services/ssh-data-aggregator.test.ts`
- 创建：`test/main/services/worker-supervisor.test.ts`
- 创建：`test/main/workers/ssh-core/session-worker.test.ts`
- 创建：`test/preload/binary-channel.test.ts`
- 创建：`test/preload/terminal-port-allocator.test.ts`
- 创建：`test/renderer/workers/terminal-worker-host.test.ts`
- 修改：`test/renderer/hooks/use-terminal.test.tsx`
- 修改：`test/renderer/helpers/create-winssh-api.ts`

## 执行顺序

先做 M1 和 M2，不与 M3/M4 混写。M1 必须是无行为变更重构；M2 只迁移 SSH connect/write/resize/disconnect。M3 和 M4 涉及性能通道和 UI 渲染边界，应在 M2 稳定后单独发版验证。M5 是多个相对独立的 worker 化子项目，可以按 SFTP、port-forward、osc-history、resource-monitor、host-trust 的顺序拆分执行。

---

## M1：服务边界，无行为变更

### 任务 1：共享协议基线

**文件：**

- 创建：`src/shared/ssh-protocol.ts`
- 创建：`test/shared/ssh-protocol.test.ts`

- [ ] **步骤 1：编写失败的协议测试**

```ts
import { sshCoreInboundSchema, sshCoreOutboundSchema } from '@shared/ssh-protocol'

describe('ssh protocol schemas', () => {
  it('accepts a connect control message', () => {
    const result = sshCoreInboundSchema.parse({
      type: 'connect',
      requestId: 'req-1',
      correlationId: 'session-1',
      config: {
        sessionId: 'session-1',
        serverId: 'server-1',
        host: 'example.com',
        port: 22,
        username: 'alice',
        authType: 'password',
        terminal: { cols: 120, rows: 34 }
      }
    })

    expect(result.type).toBe('connect')
    expect(result.config.host).toBe('example.com')
  })

  it('rejects a write control message without binary data', () => {
    expect(() =>
      sshCoreInboundSchema.parse({
        type: 'write',
        sessionId: 'session-1',
        correlationId: 'session-1'
      })
    ).toThrow()
  })

  it('accepts a state outbound message', () => {
    const result = sshCoreOutboundSchema.parse({
      type: 'state',
      sessionId: 'session-1',
      correlationId: 'session-1',
      phase: 'ready'
    })

    expect(result.phase).toBe('ready')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/shared/ssh-protocol.test.ts`

预期：FAIL，报错包含 `Cannot find module '@shared/ssh-protocol'`。

- [ ] **步骤 3：实现协议类型和 Zod schema**

```ts
import { z } from 'zod'
import type { SessionConnectionPhase } from './types'

const terminalSizeSchema = z.object({
  cols: z.number().int().positive(),
  rows: z.number().int().positive()
})

export const sshConnectConfigSchema = z.object({
  sessionId: z.string().min(1),
  serverId: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  authType: z.enum(['password', 'private-key', 'agent']),
  terminal: terminalSizeSchema
})

export type SshConnectConfig = z.infer<typeof sshConnectConfigSchema>

export const sshCoreInboundSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('connect'),
    requestId: z.string().min(1),
    correlationId: z.string().min(1),
    config: sshConnectConfigSchema
  }),
  z.object({
    type: z.literal('disconnect'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1)
  }),
  z.object({
    type: z.literal('resize'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    cols: z.number().int().positive(),
    rows: z.number().int().positive()
  }),
  z.object({
    type: z.literal('write'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    data: z.instanceof(ArrayBuffer)
  })
])

export type SshCoreInbound = z.infer<typeof sshCoreInboundSchema>

export const sshCoreOutboundSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('state'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    phase: z.custom<SessionConnectionPhase>()
  }),
  z.object({
    type: z.literal('data'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    frame: z.instanceof(ArrayBuffer),
    seq: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal('exit'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    code: z.number().int(),
    signal: z.string().optional()
  }),
  z.object({
    type: z.literal('error'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    message: z.string().min(1),
    code: z.string().optional()
  })
])

export type SshCoreOutbound = z.infer<typeof sshCoreOutboundSchema>
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/shared/ssh-protocol.test.ts`

预期：PASS，3 个测试通过。

- [ ] **步骤 5：Commit**

```bash
git add src/shared/ssh-protocol.ts test/shared/ssh-protocol.test.ts
git commit -m "feat: add ssh worker protocol baseline"
```

### 任务 2：终端数据帧纯函数

**文件：**

- 创建：`src/shared/ssh-data-frame.ts`
- 创建：`test/shared/ssh-data-frame.test.ts`

- [ ] **步骤 1：编写失败的帧编解码测试**

```ts
import {
  decodeSshDataFrame,
  encodeSshDataFrame,
  SSH_DATA_FRAME_HEADER_BYTES
} from '@shared/ssh-data-frame'

describe('ssh data frame', () => {
  it('round-trips sequence, timestamp, and payload', () => {
    const payload = new TextEncoder().encode('hello')
    const frame = encodeSshDataFrame({
      seq: 7,
      sentAtMs: 1234.5,
      payload
    })

    const decoded = decodeSshDataFrame(frame)

    expect(decoded.seq).toBe(7)
    expect(decoded.sentAtMs).toBe(1234.5)
    expect(new TextDecoder().decode(decoded.payload)).toBe('hello')
  })

  it('rejects a truncated frame', () => {
    const frame = new ArrayBuffer(SSH_DATA_FRAME_HEADER_BYTES - 1)

    expect(() => decodeSshDataFrame(frame)).toThrow('Invalid SSH data frame')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/shared/ssh-data-frame.test.ts`

预期：FAIL，报错包含 `Cannot find module '@shared/ssh-data-frame'`。

- [ ] **步骤 3：实现帧头和编解码**

```ts
export const SSH_DATA_FRAME_HEADER_BYTES = 16

export interface SshDataFrameInput {
  seq: number
  sentAtMs: number
  payload: Uint8Array
}

export interface SshDataFrame {
  seq: number
  sentAtMs: number
  payload: Uint8Array
}

export function encodeSshDataFrame(input: SshDataFrameInput): ArrayBuffer {
  const buffer = new ArrayBuffer(SSH_DATA_FRAME_HEADER_BYTES + input.payload.byteLength)
  const view = new DataView(buffer)
  view.setUint32(0, input.seq, false)
  view.setFloat64(4, input.sentAtMs, false)
  view.setUint32(12, input.payload.byteLength, false)
  new Uint8Array(buffer, SSH_DATA_FRAME_HEADER_BYTES).set(input.payload)
  return buffer
}

export function decodeSshDataFrame(buffer: ArrayBuffer): SshDataFrame {
  if (buffer.byteLength < SSH_DATA_FRAME_HEADER_BYTES) {
    throw new Error('Invalid SSH data frame: header is truncated')
  }

  const view = new DataView(buffer)
  const payloadLength = view.getUint32(12, false)
  const expectedLength = SSH_DATA_FRAME_HEADER_BYTES + payloadLength

  if (buffer.byteLength !== expectedLength) {
    throw new Error('Invalid SSH data frame: payload length mismatch')
  }

  return {
    seq: view.getUint32(0, false),
    sentAtMs: view.getFloat64(4, false),
    payload: new Uint8Array(buffer, SSH_DATA_FRAME_HEADER_BYTES, payloadLength)
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/shared/ssh-data-frame.test.ts`

预期：PASS，2 个测试通过。

- [ ] **步骤 5：Commit**

```bash
git add src/shared/ssh-data-frame.ts test/shared/ssh-data-frame.test.ts
git commit -m "feat: add ssh terminal data frame codec"
```

### 任务 3：SessionRuntime 接口与 legacy adapter

**文件：**

- 创建：`src/main/services/session-runtime.ts`
- 创建：`src/main/services/legacy-session-runtime.ts`
- 创建：`test/main/services/legacy-session-runtime.test.ts`
- 修改：`src/main/application/sessions-application-service.ts`

- [ ] **步骤 1：编写失败的 adapter 测试**

```ts
import { LegacySessionRuntime } from '@main/services/legacy-session-runtime'
import type { SessionManager } from '@main/session-manager'

describe('LegacySessionRuntime', () => {
  it('delegates session operations to SessionManager', async () => {
    const manager = {
      connect: vi.fn(async () => ({ ok: true, session: { sessionId: 'session-1' } })),
      disconnect: vi.fn(async () => undefined),
      write: vi.fn(),
      resize: vi.fn(async () => undefined)
    } as unknown as SessionManager
    const runtime = new LegacySessionRuntime(manager)

    await runtime.connect({ serverId: 'server-1', sessionId: 'session-1' } as never)
    runtime.write('session-1', 'pwd\n')
    await runtime.resize('session-1', 120, 34)
    await runtime.disconnect('session-1')

    expect(manager.connect).toHaveBeenCalledWith({ serverId: 'server-1', sessionId: 'session-1' })
    expect(manager.write).toHaveBeenCalledWith('session-1', 'pwd\n')
    expect(manager.resize).toHaveBeenCalledWith('session-1', 120, 34)
    expect(manager.disconnect).toHaveBeenCalledWith('session-1')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/legacy-session-runtime.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/services/legacy-session-runtime'`。

- [ ] **步骤 3：定义接口并实现 legacy adapter**

`src/main/services/session-runtime.ts`：

```ts
import type {
  ConnectionRequest,
  PortForwardInput,
  PortForwardRule,
  SessionConnectResult,
  SessionResourceSnapshot,
  SessionSummary
} from '@shared/types'

export interface SessionRuntime {
  connect(request: ConnectionRequest): Promise<SessionConnectResult>
  disconnect(sessionId: string): Promise<void>
  reconnect(sessionId: string): Promise<SessionSummary>
  getResourceSnapshot(sessionId: string): Promise<SessionResourceSnapshot>
  write(sessionId: string, data: string): void
  resize(sessionId: string, columns: number, rows: number): Promise<void>
  listDirectory(sessionId: string, remotePath: string): Promise<unknown>
  createFile(sessionId: string, remotePath: string, name: string): Promise<void>
  readFile(sessionId: string, remotePath: string): Promise<unknown>
  cancelReadFile(sessionId: string, remotePath: string): void
  writeFile(
    sessionId: string,
    remotePath: string,
    contents: string,
    encoding?: string
  ): Promise<void>
  makeDirectory(sessionId: string, remotePath: string, name: string): Promise<void>
  rename(sessionId: string, remotePath: string, newName: string): Promise<void>
  move(sessionId: string, sourcePath: string, destinationDirPath: string): Promise<void>
  remove(sessionId: string, remotePath: string): Promise<void>
  uploadFiles(sessionId: string, targetPath: string): Promise<void>
  uploadPaths(sessionId: string, targetPath: string, localPaths: string[]): Promise<void>
  downloadFile(sessionId: string, remotePath: string): Promise<void>
  cancelTransfer(batchId: string): void
  cancelAllTransfers(): void
  listPortForwards(sessionId: string): Promise<PortForwardRule[]>
  createPortForward(sessionId: string, input: PortForwardInput): Promise<PortForwardRule>
  startPortForward(sessionId: string, ruleId: string): Promise<PortForwardRule>
  stopPortForward(sessionId: string, ruleId: string): Promise<PortForwardRule>
  removePortForward(sessionId: string, ruleId: string): Promise<void>
  resolveHostTrust(result: import('@shared/types').HostTrustResult): void
  dispose(): void
}
```

`src/main/services/legacy-session-runtime.ts`：

```ts
import type { HostTrustResult, PortForwardInput } from '@shared/types'
import type { SessionManager } from '../session-manager'
import type { SessionRuntime } from './session-runtime'

export class LegacySessionRuntime implements SessionRuntime {
  constructor(private readonly sessionManager: SessionManager) {}

  connect(request: Parameters<SessionRuntime['connect']>[0]) {
    return this.sessionManager.connect(request)
  }

  disconnect(sessionId: string) {
    return this.sessionManager.disconnect(sessionId)
  }

  reconnect(sessionId: string) {
    return this.sessionManager.reconnect(sessionId)
  }

  getResourceSnapshot(sessionId: string) {
    return this.sessionManager.getResourceSnapshot(sessionId)
  }

  write(sessionId: string, data: string): void {
    this.sessionManager.write(sessionId, data)
  }

  resize(sessionId: string, columns: number, rows: number) {
    return this.sessionManager.resize(sessionId, columns, rows)
  }

  listDirectory(sessionId: string, remotePath: string) {
    return this.sessionManager.listDirectory(sessionId, remotePath)
  }

  createFile(sessionId: string, remotePath: string, name: string) {
    return this.sessionManager.createFile(sessionId, remotePath, name)
  }

  readFile(sessionId: string, remotePath: string) {
    return this.sessionManager.readFile(sessionId, remotePath)
  }

  cancelReadFile(sessionId: string, remotePath: string): void {
    this.sessionManager.cancelReadFile(sessionId, remotePath)
  }

  writeFile(sessionId: string, remotePath: string, contents: string, encoding?: string) {
    return this.sessionManager.writeFile(sessionId, remotePath, contents, encoding)
  }

  makeDirectory(sessionId: string, remotePath: string, name: string) {
    return this.sessionManager.makeDirectory(sessionId, remotePath, name)
  }

  rename(sessionId: string, remotePath: string, newName: string) {
    return this.sessionManager.rename(sessionId, remotePath, newName)
  }

  move(sessionId: string, sourcePath: string, destinationDirPath: string) {
    return this.sessionManager.move(sessionId, sourcePath, destinationDirPath)
  }

  remove(sessionId: string, remotePath: string) {
    return this.sessionManager.remove(sessionId, remotePath)
  }

  uploadFiles(sessionId: string, targetPath: string) {
    return this.sessionManager.uploadFiles(sessionId, targetPath)
  }

  uploadPaths(sessionId: string, targetPath: string, localPaths: string[]) {
    return this.sessionManager.uploadPaths(sessionId, targetPath, localPaths)
  }

  downloadFile(sessionId: string, remotePath: string) {
    return this.sessionManager.downloadFile(sessionId, remotePath)
  }

  cancelTransfer(batchId: string): void {
    this.sessionManager.cancelTransfer(batchId)
  }

  cancelAllTransfers(): void {
    this.sessionManager.cancelAllTransfers()
  }

  listPortForwards(sessionId: string) {
    return this.sessionManager.listPortForwards(sessionId)
  }

  createPortForward(sessionId: string, input: PortForwardInput) {
    return this.sessionManager.createPortForward(sessionId, input)
  }

  startPortForward(sessionId: string, ruleId: string) {
    return this.sessionManager.startPortForward(sessionId, ruleId)
  }

  stopPortForward(sessionId: string, ruleId: string) {
    return this.sessionManager.stopPortForward(sessionId, ruleId)
  }

  removePortForward(sessionId: string, ruleId: string) {
    return this.sessionManager.removePortForward(sessionId, ruleId)
  }

  resolveHostTrust(result: HostTrustResult): void {
    this.sessionManager.resolveHostTrust(result)
  }

  dispose(): void {
    this.sessionManager.dispose()
  }
}
```

- [ ] **步骤 4：让 SessionsApplicationService 依赖接口**

把 constructor 从：

```ts
constructor(
  private readonly sessionManager: SessionManager,
  private readonly localTerminalManager: LocalTerminalManager
) {}
```

改为：

```ts
constructor(
  private readonly sessionRuntime: SessionRuntime,
  private readonly localTerminalManager: LocalTerminalManager
) {}
```

并把所有 `this.sessionManager.` 调用改为 `this.sessionRuntime.`。

- [ ] **步骤 5：运行测试验证通过**

运行：`npx vitest run test/main/services/legacy-session-runtime.test.ts`

预期：PASS。

- [ ] **步骤 6：运行主进程类型检查**

运行：`npm run typecheck:node`

预期：PASS。

- [ ] **步骤 7：Commit**

```bash
git add src/main/services/session-runtime.ts src/main/services/legacy-session-runtime.ts src/main/application/sessions-application-service.ts test/main/services/legacy-session-runtime.test.ts
git commit -m "refactor: introduce session runtime boundary"
```

### 任务 4：bootstrap 接入 legacy runtime

**文件：**

- 修改：`src/main/bootstrap.ts`
- 修改：`test/main/application/sessions-application-service.test.ts`

- [ ] **步骤 1：编写 application service 委托测试**

```ts
import { SessionsApplicationService } from '@main/application/sessions-application-service'
import type { LocalTerminalManager } from '@main/local-terminal-manager'
import type { SessionRuntime } from '@main/services/session-runtime'

describe('SessionsApplicationService', () => {
  it('delegates SSH calls through SessionRuntime', async () => {
    const runtime = {
      connect: vi.fn(async () => ({ ok: false, code: 'connection_failed', message: 'fail' })),
      disconnect: vi.fn(async () => undefined),
      write: vi.fn(),
      resize: vi.fn(async () => undefined)
    } as unknown as SessionRuntime
    const localTerminalManager = {} as LocalTerminalManager
    const service = new SessionsApplicationService(runtime, localTerminalManager)

    await service.connect({ serverId: 'server-1', sessionId: 'session-1' } as never)
    service.write('session-1', 'whoami\n')
    await service.resize('session-1', 100, 30)
    await service.disconnect('session-1')

    expect(runtime.connect).toHaveBeenCalledOnce()
    expect(runtime.write).toHaveBeenCalledWith('session-1', 'whoami\n')
    expect(runtime.resize).toHaveBeenCalledWith('session-1', 100, 30)
    expect(runtime.disconnect).toHaveBeenCalledWith('session-1')
  })
})
```

- [ ] **步骤 2：运行测试验证通过或暴露未改调用**

运行：`npx vitest run test/main/application/sessions-application-service.test.ts`

预期：PASS；如果 FAIL，报错应指向仍在使用 `sessionManager` 的方法。

- [ ] **步骤 3：修改 bootstrap 装配**

```ts
import { LegacySessionRuntime } from './services/legacy-session-runtime'
```

在创建 `sessionManager` 之后增加：

```ts
const sessionRuntime = new LegacySessionRuntime(sessionManager)
```

把：

```ts
const sessionsService = new SessionsApplicationService(sessionManager, localTerminalManager)
```

改为：

```ts
const sessionsService = new SessionsApplicationService(sessionRuntime, localTerminalManager)
```

`before-quit` 中仍调用 `sessionManager.dispose()`，或者改为 `sessionRuntime.dispose()`；二者只能保留一个，避免重复 dispose。

- [ ] **步骤 4：运行验证**

运行：`npm run typecheck:node`

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/bootstrap.ts test/main/application/sessions-application-service.test.ts
git commit -m "refactor: wire session service through runtime adapter"
```

### 任务 5：WorkerSupervisor

**文件：**

- 创建：`src/main/services/worker-supervisor.ts`
- 创建：`test/main/services/worker-supervisor.test.ts`

- [ ] **步骤 1：编写失败的 supervisor 测试**

```ts
import { EventEmitter } from 'node:events'
import { WorkerSupervisor } from '@main/services/worker-supervisor'

class FakeWorker extends EventEmitter {
  terminated = false

  terminate = vi.fn(async () => {
    this.terminated = true
    return 0
  })
}

describe('WorkerSupervisor', () => {
  it('tracks worker lifecycle and terminates all workers', async () => {
    const worker = new FakeWorker()
    const supervisor = new WorkerSupervisor({
      spawn: vi.fn(() => worker as never)
    })

    const handle = supervisor.spawn('ssh-core', 'session-1')

    expect(handle.workerId).toContain('ssh-core')
    expect(supervisor.list().map((item) => item.sessionId)).toEqual(['session-1'])

    await supervisor.terminateAll()

    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(supervisor.list()).toEqual([])
  })

  it('emits crash records for non-zero exits', () => {
    const worker = new FakeWorker()
    const onCrash = vi.fn()
    const supervisor = new WorkerSupervisor({
      spawn: vi.fn(() => worker as never),
      onCrash
    })

    supervisor.spawn('ssh-core', 'session-1')
    worker.emit('exit', 1)

    expect(onCrash).toHaveBeenCalledWith(
      expect.objectContaining({ workerType: 'ssh-core', sessionId: 'session-1', exitCode: 1 })
    )
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/worker-supervisor.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/services/worker-supervisor'`。

- [ ] **步骤 3：实现 supervisor**

```ts
import { Worker } from 'node:worker_threads'
import { createLogger } from '../observability'

export type WorkerType =
  'ssh-core' | 'sftp' | 'port-forward' | 'osc-history' | 'resource-monitor' | 'host-trust'

export interface WorkerCrashRecord {
  workerId: string
  workerType: WorkerType
  sessionId: string
  exitCode: number
}

export interface WorkerHandle {
  workerId: string
  workerType: WorkerType
  sessionId: string
  startedAt: number
  worker: Pick<Worker, 'on' | 'terminate'>
}

export interface WorkerSupervisorOptions {
  spawn: (workerType: WorkerType, sessionId: string) => Pick<Worker, 'on' | 'terminate'>
  onCrash?: (record: WorkerCrashRecord) => void
}

export class WorkerSupervisor {
  private readonly logger = createLogger('main')
  private readonly workers = new Map<string, WorkerHandle>()

  constructor(private readonly options: WorkerSupervisorOptions) {}

  spawn(workerType: WorkerType, sessionId: string): WorkerHandle {
    const workerId = `${workerType}-${sessionId}-${Date.now()}`
    const worker = this.options.spawn(workerType, sessionId)
    const handle: WorkerHandle = {
      workerId,
      workerType,
      sessionId,
      startedAt: Date.now(),
      worker
    }

    this.workers.set(workerId, handle)
    worker.on('exit', (exitCode) => {
      this.workers.delete(workerId)
      if (exitCode !== 0) {
        const record = { workerId, workerType, sessionId, exitCode }
        this.logger.warn('Worker exited unexpectedly', { data: record })
        this.options.onCrash?.(record)
      }
    })

    return handle
  }

  list(): WorkerHandle[] {
    return [...this.workers.values()]
  }

  async terminateAll(): Promise<void> {
    const handles = this.list()
    this.workers.clear()
    await Promise.all(handles.map((handle) => handle.worker.terminate()))
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/main/services/worker-supervisor.test.ts`

预期：PASS，2 个测试通过。

- [ ] **步骤 5：Commit**

```bash
git add src/main/services/worker-supervisor.ts test/main/services/worker-supervisor.test.ts
git commit -m "feat: add worker supervisor service"
```

### 任务 6：M1 验证门

**文件：**

- 修改：无

- [ ] **步骤 1：运行 targeted tests**

运行：

```bash
npx vitest run test/shared/ssh-protocol.test.ts test/shared/ssh-data-frame.test.ts test/main/services/legacy-session-runtime.test.ts test/main/services/worker-supervisor.test.ts
```

预期：PASS。

- [ ] **步骤 2：运行全量类型检查**

运行：`npm run typecheck`

预期：PASS。

- [ ] **步骤 3：运行全量测试**

运行：`npm run test`

预期：PASS。若历史测试失败，记录失败测试名和失败原因；只有与本里程碑文件相关的失败能继续修改。

- [ ] **步骤 4：M1 commit**

```bash
git status --short
git commit --allow-empty -m "chore: mark ssh ui decoupling m1 boundary complete"
```

---

## M2：ssh-core worker

### 任务 7：SshControlPort request/response

**文件：**

- 创建：`src/main/services/ssh-control-port.ts`
- 创建：`test/main/services/ssh-control-port.test.ts`

- [ ] **步骤 1：编写失败的 request/response 测试**

```ts
import { EventEmitter } from 'node:events'
import { SshControlPort } from '@main/services/ssh-control-port'

class FakeWorker extends EventEmitter {
  postMessage = vi.fn()
}

describe('SshControlPort', () => {
  it('resolves a request when worker replies with the same requestId', async () => {
    const worker = new FakeWorker()
    const port = new SshControlPort(worker as never, { requestTimeoutMs: 1000 })
    const promise = port.request({
      type: 'connect',
      requestId: 'req-1',
      correlationId: 'session-1',
      config: {
        sessionId: 'session-1',
        serverId: 'server-1',
        host: 'example.com',
        port: 22,
        username: 'alice',
        authType: 'password',
        terminal: { cols: 80, rows: 24 }
      }
    })

    worker.emit('message', {
      type: 'ack',
      requestId: 'req-1',
      ok: true
    })

    await expect(promise).resolves.toEqual({ type: 'ack', requestId: 'req-1', ok: true })
    expect(worker.postMessage).toHaveBeenCalledOnce()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/ssh-control-port.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/services/ssh-control-port'`。

- [ ] **步骤 3：实现 SshControlPort**

实现要点：

- `request(message)` 生成或使用 `requestId`。
- `worker.postMessage(message)`。
- `message` 事件中按 `requestId` resolve。
- 超时 reject，错误文案为 `SSH worker request timed out: <requestId>`。
- `dispose()` 清理 pending timers。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/main/services/ssh-control-port.test.ts`

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/services/ssh-control-port.ts test/main/services/ssh-control-port.test.ts
git commit -m "feat: add ssh worker control port"
```

### 任务 8：ssh-core worker secret buffer

**文件：**

- 创建：`src/main/workers/ssh-core/secret-buffer.ts`
- 创建：`test/main/workers/ssh-core/secret-buffer.test.ts`

- [ ] **步骤 1：编写失败的 secret 清零测试**

```ts
import { SecretBuffer } from '@main/workers/ssh-core/secret-buffer'

describe('SecretBuffer', () => {
  it('zeros stored bytes on dispose', () => {
    const secret = new SecretBuffer('hunter2')
    const buffer = secret.unwrap()

    expect(buffer.toString('utf8')).toBe('hunter2')

    secret.dispose()

    expect([...buffer]).toEqual([0, 0, 0, 0, 0, 0, 0])
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/workers/ssh-core/secret-buffer.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/workers/ssh-core/secret-buffer'`。

- [ ] **步骤 3：实现 SecretBuffer**

```ts
export class SecretBuffer {
  private readonly buffer: Buffer
  private disposed = false

  constructor(secret: string) {
    this.buffer = Buffer.from(secret, 'utf8')
  }

  unwrap(): Buffer {
    if (this.disposed) {
      throw new Error('SecretBuffer has been disposed')
    }
    return this.buffer
  }

  dispose(): void {
    this.buffer.fill(0)
    this.disposed = true
  }
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/main/workers/ssh-core/secret-buffer.test.ts`

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/workers/ssh-core/secret-buffer.ts test/main/workers/ssh-core/secret-buffer.test.ts
git commit -m "security: zero ssh worker secret buffers"
```

### 任务 9：ssh-core worker runtime skeleton

**文件：**

- 创建：`src/main/workers/ssh-core/session-worker.ts`
- 创建：`src/main/workers/ssh-core/index.ts`
- 创建：`test/main/workers/ssh-core/session-worker.test.ts`
- 修改：`electron.vite.config.ts`

- [ ] **步骤 1：编写失败的 worker session 单元测试**

```ts
import { EventEmitter } from 'node:events'
import { SshCoreSessionWorker } from '@main/workers/ssh-core/session-worker'

class FakeClient extends EventEmitter {
  connect = vi.fn()
  end = vi.fn()
  shell = vi.fn()
}

describe('SshCoreSessionWorker', () => {
  it('emits ready after client ready and shell open', async () => {
    const client = new FakeClient()
    const post = vi.fn()
    const worker = new SshCoreSessionWorker({
      createClient: () => client as never,
      postMessage: post
    })

    const promise = worker.connect({
      sessionId: 'session-1',
      serverId: 'server-1',
      host: 'example.com',
      port: 22,
      username: 'alice',
      authType: 'password',
      terminal: { cols: 80, rows: 24 }
    })

    client.emit('ready')
    client.shell({}, vi.fn())

    await promise

    expect(client.connect).toHaveBeenCalledOnce()
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'state', phase: 'ready' }))
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/workers/ssh-core/session-worker.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/workers/ssh-core/session-worker'`。

- [ ] **步骤 3：实现最小 worker session**

实现要点：

- `createClient` 默认返回 `new Client()`。
- `connect(config)` 发送 `state`：`resolving`、`handshake`、`ready`。
- `write(sessionId, data)` 只写当前 shell channel。
- `resize(sessionId, cols, rows)` 调 `channel.setWindow(rows, cols, 0, 0)`。
- `disconnect(sessionId)` 关闭 channel 和 client。
- 捕获 `client.on('error')` 并发送 `{ type: 'error' }`。

- [ ] **步骤 4：创建 worker 入口**

`src/main/workers/ssh-core/index.ts` 负责：

- 读取 `parentPort`。
- 解析 `sshCoreInboundSchema`。
- 分发 `connect` / `write` / `resize` / `disconnect`。
- 对每个 message 返回 ack 或 error ack。

- [ ] **步骤 5：配置 worker 构建**

在 `electron.vite.config.ts` main 配置中保持 `externalizeDepsPlugin()`，worker 文件通过编译输出路径加载；不要把 `ssh2` 打进 renderer bundle。

- [ ] **步骤 6：运行验证**

运行：

```bash
npx vitest run test/main/workers/ssh-core/session-worker.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 7：Commit**

```bash
git add src/main/workers/ssh-core src/main/services/ssh-control-port.ts electron.vite.config.ts test/main/workers/ssh-core/session-worker.test.ts
git commit -m "feat: add ssh core worker skeleton"
```

### 任务 10：WorkerSessionRuntime feature flag

**文件：**

- 创建：`src/main/services/worker-session-runtime.ts`
- 修改：`src/main/bootstrap.ts`
- 修改：`src/main/localization.ts`
- 创建：`test/main/services/worker-session-runtime.test.ts`

- [ ] **步骤 1：编写失败的 runtime fallback 测试**

```ts
import { WorkerSessionRuntime } from '@main/services/worker-session-runtime'

describe('WorkerSessionRuntime', () => {
  it('marks session error when ssh-core worker crashes', () => {
    const send = vi.fn()
    const runtime = new WorkerSessionRuntime({
      sendToRenderer: send,
      spawnWorker: vi.fn(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'exit') callback(1)
        }),
        postMessage: vi.fn(),
        terminate: vi.fn(async () => 1)
      })) as never
    })

    runtime.handleWorkerCrash('session-1', 1)

    expect(send).toHaveBeenCalledWith(
      'sessions:error',
      expect.objectContaining({ sessionId: 'session-1', code: 'worker_crashed' })
    )
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/worker-session-runtime.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/services/worker-session-runtime'`。

- [ ] **步骤 3：实现 WorkerSessionRuntime**

实现要点：

- 实现 `SessionRuntime`。
- SSH 控制方法走 `SshControlPort`。
- SFTP/port-forward/resource/host-trust 方法在 M2 仍委托 legacy runtime，保证外部行为不变。
- worker crash 发送 `sessions:error` 和 `sessions:state`，状态进入 error，可重连。
- `dispose()` 终止所有 worker。

- [ ] **步骤 4：bootstrap feature flag**

在 `bootstrap()` 中加入：

```ts
const useLegacyTerminal = process.env['WINSSH_LEGACY_TERMINAL'] === '1'
const sessionRuntime = useLegacyTerminal
  ? new LegacySessionRuntime(sessionManager)
  : new WorkerSessionRuntime({
      legacyRuntime: new LegacySessionRuntime(sessionManager),
      sendToRenderer: (channel, payload) => {
        mainWindow?.webContents.send(channel, payload)
      }
    })
```

M2 初次合入时默认仍可设为 legacy；切默认值前必须完成 M2 验证门。

- [ ] **步骤 5：新增双语错误文案**

在 `src/main/localization.ts` 增加：

- `sessions.workerCrashed` 英文：`SSH worker crashed. Reconnect the session to continue.`
- `sessions.workerCrashed` 中文：`SSH 工作线程已崩溃。请重新连接会话后继续。`

- [ ] **步骤 6：运行验证**

运行：

```bash
npx vitest run test/main/services/worker-session-runtime.test.ts test/main/localization.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 7：Commit**

```bash
git add src/main/services/worker-session-runtime.ts src/main/bootstrap.ts src/main/localization.ts test/main/services/worker-session-runtime.test.ts
git commit -m "feat: route ssh sessions through worker runtime"
```

---

## M3：数据通道与背压

### 任务 11：SshDataAggregator

**文件：**

- 创建：`src/main/services/ssh-data-aggregator.ts`
- 创建：`test/main/services/ssh-data-aggregator.test.ts`
- 修改：`src/shared/ipc-channels.ts`

- [ ] **步骤 1：编写失败的数据路由测试**

```ts
import { SshDataAggregator } from '@main/services/ssh-data-aggregator'

describe('SshDataAggregator', () => {
  it('routes frames to the registered session port', () => {
    const port = { postMessage: vi.fn(), close: vi.fn() }
    const aggregator = new SshDataAggregator()
    const frame = new ArrayBuffer(4)

    aggregator.registerSessionPort('session-1', port as never)
    aggregator.routeFrame({ sessionId: 'session-1', frame, seq: 1, sentAtMs: 10 })

    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'data', seq: 1, frame }),
      [frame]
    )
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/ssh-data-aggregator.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/services/ssh-data-aggregator'`。

- [ ] **步骤 3：实现 aggregator**

实现要点：

- `registerSessionPort(sessionId, port)` 保存端口。
- `unregisterSessionPort(sessionId)` 关闭并删除端口。
- `routeFrame(event)` 有端口则 `postMessage` transfer frame；无端口则走 legacy sender 发送 `sessions:data`。
- 计算 `lagMs = performance.now() - sentAtMs`，发送指标。
- 高水位超限发送 `terminal:backpressure`。

- [ ] **步骤 4：运行验证**

运行：

```bash
npx vitest run test/main/services/ssh-data-aggregator.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/services/ssh-data-aggregator.ts src/shared/ipc-channels.ts test/main/services/ssh-data-aggregator.test.ts
git commit -m "feat: add ssh data aggregator"
```

### 任务 12：Preload BinaryChannel 和端口分配

**文件：**

- 创建：`src/preload/binary-channel.ts`
- 创建：`src/preload/terminal-port-allocator.ts`
- 修改：`src/preload/index.ts`
- 修改：`src/preload/index.d.ts`
- 修改：`src/shared/api.ts`
- 创建：`test/preload/binary-channel.test.ts`
- 创建：`test/preload/terminal-port-allocator.test.ts`

- [ ] **步骤 1：编写失败的 BinaryChannel 测试**

```ts
import { BinaryChannel } from '../../src/preload/binary-channel'

describe('BinaryChannel', () => {
  it('buffers frames and flushes them in order', () => {
    const port = { postMessage: vi.fn(), close: vi.fn() }
    const channel = new BinaryChannel(port as never, { highWaterMarkBytes: 1024 })
    const first = new ArrayBuffer(2)
    const second = new ArrayBuffer(3)

    channel.enqueue(first)
    channel.enqueue(second)
    channel.flush()

    expect(port.postMessage).toHaveBeenNthCalledWith(1, { type: 'data', frame: first }, [first])
    expect(port.postMessage).toHaveBeenNthCalledWith(2, { type: 'data', frame: second }, [second])
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/preload/binary-channel.test.ts`

预期：FAIL，报错包含 `Cannot find module '../../src/preload/binary-channel'`。

- [ ] **步骤 3：实现 BinaryChannel**

实现要点：

- 队列保存 `ArrayBuffer[]`。
- `enqueue(frame)` 记录 queued bytes。
- 超出 `highWaterMarkBytes` 时丢弃旧帧直到低于一半，并返回 drop count。
- `flush()` 按顺序 `postMessage({ type: 'data', frame }, [frame])`。
- `dispose()` 清空队列并关闭 port。

- [ ] **步骤 4：扩展 WinsshApi**

`src/shared/api.ts` 的 `sessions` 增加：

```ts
createDataChannel: (sessionId: string) => Promise<MessagePort>
```

`src/preload/index.ts` 的 `sessions` 增加：

```ts
createDataChannel: (sessionId) => terminalPortAllocator.create(sessionId)
```

`terminal-port-allocator.ts` 使用 `MessageChannel`，把一个端口交给 main，另一个返回 renderer。

- [ ] **步骤 5：更新测试 mock**

`test/renderer/helpers/create-winssh-api.ts` 的 `sessions` 默认值增加：

```ts
createDataChannel: async () => {
  const channel = new MessageChannel()
  return channel.port1
}
```

- [ ] **步骤 6：运行验证**

运行：

```bash
npx vitest run test/preload/binary-channel.test.ts test/preload/terminal-port-allocator.test.ts
npm run typecheck
```

预期：PASS。

- [ ] **步骤 7：Commit**

```bash
git add src/preload/binary-channel.ts src/preload/terminal-port-allocator.ts src/preload/index.ts src/preload/index.d.ts src/shared/api.ts test/preload test/renderer/helpers/create-winssh-api.ts
git commit -m "feat: add terminal data channel bridge"
```

---

## M4：TerminalWorker 与降级链

### 任务 13：cross-origin isolation 前置检查

**文件：**

- 修改：`src/main/bootstrap.ts`
- 创建：`test/main/cross-origin-isolation.test.ts`

- [ ] **步骤 1：编写失败的 header 配置测试**

```ts
import { createCrossOriginIsolationHeaders } from '@main/bootstrap'

describe('cross-origin isolation headers', () => {
  it('sets COOP and COEP for renderer documents', () => {
    expect(createCrossOriginIsolationHeaders()).toEqual({
      'Cross-Origin-Opener-Policy': ['same-origin'],
      'Cross-Origin-Embedder-Policy': ['require-corp']
    })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/cross-origin-isolation.test.ts`

预期：FAIL，报错包含 `createCrossOriginIsolationHeaders` 未导出。

- [ ] **步骤 3：实现 headers helper 并在 createWindow 前注册**

在 `bootstrap.ts` 中导出 helper：

```ts
export function createCrossOriginIsolationHeaders(): Record<string, string[]> {
  return {
    'Cross-Origin-Opener-Policy': ['same-origin'],
    'Cross-Origin-Embedder-Policy': ['require-corp']
  }
}
```

在创建窗口前注册 `session.defaultSession.webRequest.onHeadersReceived`，合并现有 headers，不覆盖非目标 header。

- [ ] **步骤 4：运行验证**

运行：

```bash
npx vitest run test/main/cross-origin-isolation.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/bootstrap.ts test/main/cross-origin-isolation.test.ts
git commit -m "feat: enable cross origin isolation headers"
```

### 任务 14：TerminalWorkerHost

**文件：**

- 创建：`src/renderer/src/workers/terminal-worker-host.ts`
- 创建：`src/renderer/src/workers/terminal-worker-types.ts`
- 创建：`test/renderer/workers/terminal-worker-host.test.ts`

- [ ] **步骤 1：编写失败的 host attach/detach 测试**

```ts
import { TerminalWorkerHost } from '@/workers/terminal-worker-host'

class FakeWorker {
  postMessage = vi.fn()
  terminate = vi.fn()
  addEventListener = vi.fn()
  removeEventListener = vi.fn()
}

describe('TerminalWorkerHost', () => {
  it('initializes worker with session id and canvas support flags', async () => {
    const worker = new FakeWorker()
    const createDataChannel = vi.fn(async () => new MessageChannel().port1)
    const host = new TerminalWorkerHost({
      createWorker: () => worker as never,
      createDataChannel,
      supportsOffscreenCanvas: () => false,
      isCrossOriginIsolated: () => false
    })

    await host.attach({ sessionId: 'session-1', container: document.createElement('div') })

    expect(createDataChannel).toHaveBeenCalledWith('session-1')
    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'attach',
        sessionId: 'session-1',
        useOffscreenCanvas: false
      }),
      expect.any(Array)
    )

    host.detach()
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/renderer/workers/terminal-worker-host.test.ts`

预期：FAIL，报错包含 `Cannot find module '@/workers/terminal-worker-host'`。

- [ ] **步骤 3：实现 host**

实现要点：

- `attach({ sessionId, container })` 创建 worker。
- 调 `sessionsClient.createDataChannel(sessionId)`。
- 如果 `container.querySelector('canvas')?.transferControlToOffscreen` 可用，则传 OffscreenCanvas；否则发送 fallback mode。
- worker error 时 emit degraded reason `terminal_worker_crashed`。
- `detach()` terminate worker，关闭 data port。

- [ ] **步骤 4：运行验证**

运行：

```bash
npx vitest run test/renderer/workers/terminal-worker-host.test.ts
npm run typecheck:web
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/renderer/src/workers/terminal-worker-host.ts src/renderer/src/workers/terminal-worker-types.ts test/renderer/workers/terminal-worker-host.test.ts
git commit -m "feat: add terminal worker host"
```

### 任务 15：TerminalWorker 实现与 use-terminal 分流

**文件：**

- 创建：`src/renderer/src/workers/terminal.worker.ts`
- 修改：`src/renderer/src/hooks/use-terminal.ts`
- 修改：`test/renderer/hooks/use-terminal.test.tsx`

- [ ] **步骤 1：扩展 use-terminal 测试**

在现有 `test/renderer/hooks/use-terminal.test.tsx` 增加一个 SSH worker 模式测试：

```ts
it('uses terminal worker host for SSH sessions when enabled', async () => {
  const attach = vi.fn(async () => undefined)
  const detach = vi.fn()
  const host = { attach, detach, focus: vi.fn(), resize: vi.fn() }

  const { unmount } = renderHook(() =>
    useTerminal(
      { kind: 'ssh', sessionId: 'session-1', write: vi.fn(), resize: vi.fn(async () => undefined) },
      undefined,
      undefined,
      { enabled: true, terminalWorkerHost: host as never }
    )
  )

  await waitFor(() => expect(attach).toHaveBeenCalled())
  unmount()

  expect(detach).toHaveBeenCalledOnce()
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/renderer/hooks/use-terminal.test.tsx -t "uses terminal worker host"`

预期：FAIL，原因是 `useTerminal` 尚不接受 `terminalWorkerHost`。

- [ ] **步骤 3：实现 TerminalWorker**

实现要点：

- worker 接收 `attach`、`resize`、`focus`、`dispose`。
- 创建 `Terminal` 和 addons。
- data port 收到 frame 后 `terminal.write(Uint8Array)`。
- `terminal.onData` 把用户输入发回 data port。
- 无 OffscreenCanvas 时发送 `{ type: 'degraded', reason: 'offscreen_canvas_unavailable' }`，host 回退到主线程旧路径。

- [ ] **步骤 4：修改 use-terminal**

实现要点：

- local terminal 继续旧路径。
- SSH session 若 worker host 可用且未降级，走 `terminalWorkerHost.attach`。
- 降级后复用原主线程 xterm 逻辑。
- 保留 keep-mounted 场景下的 resize/focus 行为。

- [ ] **步骤 5：运行验证**

运行：

```bash
npx vitest run test/renderer/hooks/use-terminal.test.tsx test/renderer/workers/terminal-worker-host.test.ts
npm run typecheck:web
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/renderer/src/workers/terminal.worker.ts src/renderer/src/hooks/use-terminal.ts test/renderer/hooks/use-terminal.test.tsx
git commit -m "feat: move ssh terminal rendering behind worker host"
```

---

## M5：其他服务 worker 化

### 任务 16：SFTP dispatcher 切换到 worker

**文件：**

- 创建：`src/main/services/sftp-dispatcher.ts`
- 创建：`src/main/workers/sftp/index.ts`
- 创建：`test/main/services/sftp-dispatcher.test.ts`

- [ ] **步骤 1：编写失败的 dispatcher 测试**

```ts
import { SftpDispatcher } from '@main/services/sftp-dispatcher'

describe('SftpDispatcher', () => {
  it('delegates readFile to legacy runtime when worker mode is disabled', async () => {
    const legacyRuntime = {
      readFile: vi.fn(async () => ({ content: 'hello', encoding: 'utf8' }))
    }
    const dispatcher = new SftpDispatcher({
      legacyRuntime: legacyRuntime as never,
      useWorker: false
    })

    await expect(dispatcher.readFile('session-1', '/tmp/a.txt')).resolves.toEqual({
      content: 'hello',
      encoding: 'utf8'
    })
    expect(legacyRuntime.readFile).toHaveBeenCalledWith('session-1', '/tmp/a.txt')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/sftp-dispatcher.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/services/sftp-dispatcher'`。

- [ ] **步骤 3：实现 dispatcher**

实现要点：

- M5 初始默认 `useWorker: false`。
- worker mode 下通过 MessagePort 调 sftp worker。
- `readFile` / `writeFile` 继续 string API。
- `cancelReadFile(sessionId, remotePath)` 发送 cancel 消息。
- 传输进度继续通过 `sftp:transfer` 发给 renderer。

- [ ] **步骤 4：运行验证**

运行：

```bash
npx vitest run test/main/services/sftp-dispatcher.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/services/sftp-dispatcher.ts src/main/workers/sftp/index.ts test/main/services/sftp-dispatcher.test.ts
git commit -m "feat: add sftp worker dispatcher"
```

### 任务 17：port-forward、osc-history、resource-monitor、host-trust dispatchers

**文件：**

- 创建：`src/main/services/port-forward-dispatcher.ts`
- 创建：`src/main/services/osc-history-dispatcher.ts`
- 创建：`src/main/workers/port-forward/index.ts`
- 创建：`src/main/workers/osc-history/index.ts`
- 创建：`src/main/workers/resource-monitor/index.ts`
- 创建：`src/main/workers/host-trust/index.ts`
- 创建：`test/main/services/port-forward-dispatcher.test.ts`
- 创建：`test/main/services/osc-history-dispatcher.test.ts`

- [ ] **步骤 1：编写 port-forward legacy fallback 测试**

```ts
import { PortForwardDispatcher } from '@main/services/port-forward-dispatcher'

describe('PortForwardDispatcher', () => {
  it('keeps rules session-scoped and delegates to legacy runtime while disabled', async () => {
    const legacyRuntime = {
      listPortForwards: vi.fn(async () => []),
      createPortForward: vi.fn(async () => ({ id: 'rule-1', status: 'stopped' }))
    }
    const dispatcher = new PortForwardDispatcher({
      legacyRuntime: legacyRuntime as never,
      useWorker: false
    })

    await dispatcher.list('session-1')
    await dispatcher.create('session-1', { type: 'local' } as never)

    expect(legacyRuntime.listPortForwards).toHaveBeenCalledWith('session-1')
    expect(legacyRuntime.createPortForward).toHaveBeenCalledWith('session-1', { type: 'local' })
  })
})
```

- [ ] **步骤 2：编写 osc-history dispatcher 测试**

```ts
import { OscHistoryDispatcher } from '@main/services/osc-history-dispatcher'

describe('OscHistoryDispatcher', () => {
  it('forwards command records to main database writer', async () => {
    const recordCommand = vi.fn()
    const dispatcher = new OscHistoryDispatcher({ recordCommand })

    dispatcher.handleCommandRecorded({
      sessionId: 'session-1',
      command: 'ls',
      cwd: '/home/alice',
      startedAt: '2026-06-09T00:00:00.000Z',
      finishedAt: '2026-06-09T00:00:01.000Z',
      exitCode: 0
    })

    expect(recordCommand).toHaveBeenCalledWith(expect.objectContaining({ command: 'ls' }))
  })
})
```

- [ ] **步骤 3：运行测试验证失败**

运行：

```bash
npx vitest run test/main/services/port-forward-dispatcher.test.ts test/main/services/osc-history-dispatcher.test.ts
```

预期：FAIL，报错包含对应模块不存在。

- [ ] **步骤 4：实现 dispatchers 与 worker 入口**

实现要点：

- `PortForwardDispatcher` 的 public 方法与现有 `SessionsApplicationService` 中 port forward 方法一一对应。
- `OscHistoryDispatcher` 不直接写 DB；通过注入的 `recordCommand` 函数回到 main。
- `resource-monitor` 只在 Linux 采样；非 Linux 返回 unsupported snapshot，行为与现有一致。
- `host-trust` worker 只能发起 request，最终用户响应仍通过 main 的 `system:hostTrustRequest` 和 `respondHostTrust` 回流。

- [ ] **步骤 5：运行验证**

运行：

```bash
npx vitest run test/main/services/port-forward-dispatcher.test.ts test/main/services/osc-history-dispatcher.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/main/services/port-forward-dispatcher.ts src/main/services/osc-history-dispatcher.ts src/main/workers/port-forward src/main/workers/osc-history src/main/workers/resource-monitor src/main/workers/host-trust test/main/services/port-forward-dispatcher.test.ts test/main/services/osc-history-dispatcher.test.ts
git commit -m "feat: add worker dispatchers for ssh auxiliary services"
```

---

## 性能与集成验证

### 任务 18：性能基准脚本

**文件：**

- 创建：`test/performance/ssh-data-lag.test.ts`
- 创建：`test/performance/terminal-throughput.test.ts`
- 修改：`vitest.config.ts`

- [ ] **步骤 1：编写 frame lag 基准测试**

```ts
import { decodeSshDataFrame, encodeSshDataFrame } from '@shared/ssh-data-frame'

describe('ssh data frame performance', () => {
  it('decodes 10000 small frames within the local budget', () => {
    const frames = Array.from({ length: 10000 }, (_, seq) =>
      encodeSshDataFrame({
        seq,
        sentAtMs: performance.now(),
        payload: new Uint8Array([65, 66, 67, 10])
      })
    )

    const startedAt = performance.now()
    for (const frame of frames) {
      decodeSshDataFrame(frame)
    }
    const elapsed = performance.now() - startedAt

    expect(elapsed).toBeLessThan(100)
  })
})
```

- [ ] **步骤 2：运行测试**

运行：`npx vitest run test/performance/ssh-data-lag.test.ts`

预期：PASS；如果本地机器抖动超过 100ms，先记录实际值，再把 CI 阈值放到单独的 perf job，不降低产品验收目标 `data.frame.lag_ms p95 < 50ms`。

- [ ] **步骤 3：把性能测试从默认 `npm run test` 中隔离**

修改 `vitest.config.ts`，默认 test include 不包含 `test/performance/**`；新增 npm script 建议：

```json
"test:perf": "vitest run test/performance"
```

- [ ] **步骤 4：Commit**

```bash
git add test/performance/ssh-data-lag.test.ts test/performance/terminal-throughput.test.ts vitest.config.ts package.json
git commit -m "test: add ssh data performance benchmarks"
```

### 任务 19：里程碑验收矩阵

**文件：**

- 创建：`docs/superpowers/checklists/ssh-ui-decoupling-acceptance.md`

- [ ] **步骤 1：创建验收清单**

```md
# SSH UI 解耦验收清单

## M1

- `npm run typecheck` 通过。
- `npm run test` 通过。
- `WINSSH_LEGACY_TERMINAL=1 npm run dev` 可连接 SSH、输入命令、打开 SFTP。
- 默认模式与 legacy 模式行为一致。

## M2

- 单 session 密码认证连接成功。
- 单 session 私钥认证连接成功。
- `write`、`resize`、`disconnect` 行为与 M1 一致。
- ssh-core worker 崩溃后 UI 进入可重连 error 状态。

## M3

- `sessions.onData` legacy 订阅仍可用。
- `sessions.createDataChannel(sessionId)` 可接收同一 session 的数据帧。
- `terminal:backpressure` 能被 renderer 收到并展示降级/警告状态。

## M4

- `self.crossOriginIsolated === true` 时优先启用 SharedArrayBuffer。
- OffscreenCanvas 不可用时回退到主线程 xterm。
- TerminalWorker 崩溃时 session 不断开，UI 重建 terminal。

## M5

- SFTP read/write/list/cancel 与 M4 行为一致。
- Port forward 规则不写 DB。
- OSC 命令历史继续写入数据库。
- Linux resource monitor 继续返回 snapshot；非 Linux 保持 unsupported 行为。
- Host trust request 仍由 main 发给 renderer 确认。
```

- [ ] **步骤 2：Commit**

```bash
git add docs/superpowers/checklists/ssh-ui-decoupling-acceptance.md
git commit -m "docs: add ssh decoupling acceptance checklist"
```

---

## 最终验证顺序

每个里程碑完成后按此顺序验证：

1. `npm run typecheck`
2. `npm run test`
3. `WINSSH_LEGACY_TERMINAL=1 npm run dev`
4. 默认模式 `npm run dev`
5. 手工验证：连接 SSH、输入 `pwd`、resize terminal、断开重连、打开 SFTP、读取文本文件、启动和停止一个端口转发规则。
6. M3 之后增加：5 个 session 同时输出大量文本，观察 UI 是否可交互。
7. M4 之后增加：DevTools 中确认 `self.crossOriginIsolated`，并分别验证 OffscreenCanvas 可用与 forced fallback。
8. M5 之后增加：SFTP cancel、host trust prompt、command history capture、Linux resource snapshot。

## 回退策略

- M1 回退：删除新增 service adapter 并让 `SessionsApplicationService` 重新依赖 `SessionManager`。
- M2 回退：设置 `WINSSH_LEGACY_TERMINAL=1`，默认装配 `LegacySessionRuntime`。
- M3 回退：保留 `sessions:onData` IPC 通道，关闭 `createDataChannel` 使用路径。
- M4 回退：TerminalWorkerHost 发送 `terminal:degraded` 后走原 `use-terminal.ts` 主线程 xterm 路径。
- M5 回退：每个 dispatcher 都保留 `useWorker: false` 的 legacy delegate。

## 自检

- 规格覆盖度：M1 覆盖服务边界；M2 覆盖 ssh-core worker；M3 覆盖二进制数据通道和背压；M4 覆盖 xterm Web Worker、OffscreenCanvas、SharedArrayBuffer 降级；M5 覆盖 SFTP、端口转发、OSC/命令历史、资源监控、主机信任拆分。
- 占位符扫描：计划正文没有使用禁止占位表达作为任务内容；每个任务都有具体文件、测试命令、预期结果和 commit。
- 类型一致性：`SessionRuntime`、`LegacySessionRuntime`、`WorkerSessionRuntime`、`SshControlPort`、`SshDataAggregator`、`BinaryChannel`、`TerminalWorkerHost` 在任务中使用的命名保持一致。
- 仓库约束：不直接在 renderer 组件访问 `window.winsshApi`；不改变 local terminal；不改变 keep-mounted 策略；不扩大 SFTP text-only API。
