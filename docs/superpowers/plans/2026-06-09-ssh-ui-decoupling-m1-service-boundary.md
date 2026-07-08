# SSH UI 解耦 M1 服务边界实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在不改变 SSH、SFTP、端口转发和终端行为的前提下，为后续 worker 化建立 `SessionRuntime`、协议类型、数据帧类型和 worker supervisor 边界。

**架构：** M1 是纯边界重构：`SessionsApplicationService` 从直接依赖 `SessionManager` 改为依赖 `SessionRuntime`，默认实现仍是 `LegacySessionRuntime` 包装现有 `SessionManager`。共享协议和数据帧模块先以纯函数和 Zod schema 落地，供 M2/M3 复用，但 M1 不启动 worker、不改 renderer 数据流。

**技术栈：** Electron main process、TypeScript、Vitest、Zod、现有 `SessionManager`。

---

## 范围

本计划只完成服务边界和协议基线。完成后应用行为应与当前版本一致，`npm run typecheck` 和 `npm run test` 应通过。不要引入 `worker_threads` runtime，不要修改 `use-terminal.ts` 的主线程 xterm 行为，不要新增 renderer API。

## 前置条件

- 当前工作区已包含原始设计规格 `docs/superpowers/specs/2026-06-07-ssh-ui-decoupling-design.md`。
- 执行前先确认 `git status --short`，不要覆盖用户已有改动。
- M1 是整个拆分计划的起点，不依赖其他里程碑产物。

## 依赖

- 规格：`docs/superpowers/specs/2026-06-07-ssh-ui-decoupling-design.md`
- 根约束：`AGENTS.md`
- 主进程约束：`src/main/AGENTS.md`
- 测试约束：`test/AGENTS.md`

## 文件结构

- 创建：`src/shared/ssh-protocol.ts`  
  职责：定义 main 与 ssh-core worker 将来使用的控制消息、事件消息和 Zod schema。
- 创建：`src/shared/ssh-data-frame.ts`  
  职责：定义终端数据帧二进制格式和纯函数编解码。
- 创建：`src/main/services/session-runtime.ts`  
  职责：抽象 SSH runtime 接口，覆盖当前 `SessionsApplicationService` 调用到的所有 session/SFTP/port-forward/host-trust 方法。
- 创建：`src/main/services/legacy-session-runtime.ts`  
  职责：把现有 `SessionManager` 包装成 `SessionRuntime`，保证 M1 无行为变更。
- 创建：`src/main/services/worker-supervisor.ts`  
  职责：统一 worker 生命周期建模，M1 只提供可测试的 spawn/terminate/crash bookkeeping。
- 修改：`src/main/application/sessions-application-service.ts`  
  职责：依赖 `SessionRuntime`，不再直接依赖 `SessionManager`。
- 修改：`src/main/bootstrap.ts`  
  职责：装配 `LegacySessionRuntime` 并避免重复 dispose。
- 创建：`test/shared/ssh-protocol.test.ts`
- 创建：`test/shared/ssh-data-frame.test.ts`
- 创建：`test/main/services/legacy-session-runtime.test.ts`
- 创建：`test/main/application/sessions-application-service.test.ts`
- 创建：`test/main/services/worker-supervisor.test.ts`

## 任务 1：共享协议基线

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

- [ ] **步骤 3：实现协议类型和 schema**

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

## 任务 2：终端数据帧纯函数

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
    const frame = encodeSshDataFrame({ seq: 7, sentAtMs: 1234.5, payload })
    const decoded = decodeSshDataFrame(frame)

    expect(decoded.seq).toBe(7)
    expect(decoded.sentAtMs).toBe(1234.5)
    expect(new TextDecoder().decode(decoded.payload)).toBe('hello')
  })

  it('rejects a truncated frame', () => {
    expect(() => decodeSshDataFrame(new ArrayBuffer(SSH_DATA_FRAME_HEADER_BYTES - 1))).toThrow(
      'Invalid SSH data frame'
    )
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

## 任务 3：SessionRuntime 接口与 legacy adapter

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

- [ ] **步骤 3：定义 `SessionRuntime` 接口**

`src/main/services/session-runtime.ts` 要覆盖 `SessionsApplicationService` 当前所有远程 session 方法：

```ts
import type {
  ConnectionRequest,
  HostTrustResult,
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
  resolveHostTrust(result: HostTrustResult): void
  dispose(): void
}
```

- [ ] **步骤 4：实现 `LegacySessionRuntime`**

实现每个方法时只委托 `this.sessionManager`，不要复制 `SessionManager` 内部逻辑。

- [ ] **步骤 5：让 `SessionsApplicationService` 依赖接口**

把 constructor 改为：

```ts
constructor(
  private readonly sessionRuntime: SessionRuntime,
  private readonly localTerminalManager: LocalTerminalManager
) {}
```

把所有远程 session 调用从 `this.sessionManager.` 改为 `this.sessionRuntime.`。local terminal 方法继续调用 `this.localTerminalManager`。

- [ ] **步骤 6：运行测试验证通过**

运行：

```bash
npx vitest run test/main/services/legacy-session-runtime.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 7：Commit**

```bash
git add src/main/services/session-runtime.ts src/main/services/legacy-session-runtime.ts src/main/application/sessions-application-service.ts test/main/services/legacy-session-runtime.test.ts
git commit -m "refactor: introduce session runtime boundary"
```

## 任务 4：bootstrap 接入 legacy runtime

**文件：**

- 修改：`src/main/bootstrap.ts`
- 创建：`test/main/application/sessions-application-service.test.ts`

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
    const service = new SessionsApplicationService(runtime, {} as LocalTerminalManager)

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

- [ ] **步骤 2：运行测试**

运行：`npx vitest run test/main/application/sessions-application-service.test.ts`

预期：PASS；若失败，失败点应指向仍然绕过 `SessionRuntime` 的调用。

- [ ] **步骤 3：修改 bootstrap 装配**

在 `src/main/bootstrap.ts` 导入：

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

`before-quit` 中只保留一次 dispose。建议改成：

```ts
sessionRuntime.dispose()
```

并删除同一闭包里的 `sessionManager.dispose()`。

- [ ] **步骤 4：运行验证**

运行：

```bash
npx vitest run test/main/application/sessions-application-service.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/bootstrap.ts test/main/application/sessions-application-service.test.ts
git commit -m "refactor: wire session service through runtime adapter"
```

## 任务 5：WorkerSupervisor

**文件：**

- 创建：`src/main/services/worker-supervisor.ts`
- 创建：`test/main/services/worker-supervisor.test.ts`

- [ ] **步骤 1：编写失败的 supervisor 测试**

```ts
import { EventEmitter } from 'node:events'
import { WorkerSupervisor } from '@main/services/worker-supervisor'

class FakeWorker extends EventEmitter {
  terminate = vi.fn(async () => 0)
}

describe('WorkerSupervisor', () => {
  it('tracks worker lifecycle and terminates all workers', async () => {
    const worker = new FakeWorker()
    const supervisor = new WorkerSupervisor({ spawn: vi.fn(() => worker as never) })

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
    const supervisor = new WorkerSupervisor({ spawn: vi.fn(() => worker as never), onCrash })

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
    const handle = { workerId, workerType, sessionId, startedAt: Date.now(), worker }
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

运行：

```bash
npx vitest run test/main/services/worker-supervisor.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/services/worker-supervisor.ts test/main/services/worker-supervisor.test.ts
git commit -m "feat: add worker supervisor service"
```

## M1 验收

- [ ] **步骤 1：运行 targeted tests**

运行：

```bash
npx vitest run test/shared/ssh-protocol.test.ts test/shared/ssh-data-frame.test.ts test/main/services/legacy-session-runtime.test.ts test/main/application/sessions-application-service.test.ts test/main/services/worker-supervisor.test.ts
```

预期：PASS。

- [ ] **步骤 2：运行全量类型检查**

运行：`npm run typecheck`

预期：PASS。

- [ ] **步骤 3：运行全量测试**

运行：`npm run test`

预期：PASS。若出现历史失败，记录失败测试名和失败原因；只修复与本计划文件相关的新失败。

- [ ] **步骤 4：M1 收尾 commit**

```bash
git status --short
git commit --allow-empty -m "chore: mark ssh ui decoupling m1 boundary complete"
```

## 回退策略

把 `SessionsApplicationService` constructor 改回接收 `SessionManager`，删除 `LegacySessionRuntime` 装配，并在 `bootstrap.ts` 中恢复 `new SessionsApplicationService(sessionManager, localTerminalManager)`。共享协议文件可以保留，因为 M1 不会被运行时调用。

## 自检

- 覆盖规格中的 M1 服务边界、`SshControlPort` 前置协议、`SshDataPort` 前置帧格式和 worker 生命周期建模。
- 没有改变 preload、renderer、SFTP 行为或 port-forward 持久化策略。
- 每个任务都有测试先行、运行命令、预期结果和 commit。
