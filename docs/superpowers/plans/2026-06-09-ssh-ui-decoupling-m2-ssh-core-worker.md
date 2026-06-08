# SSH UI 解耦 M2 ssh-core Worker 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 SSH 连接核心的 `ssh2.Client` 生命周期、shell channel、write、resize、disconnect 从 main 线程迁移到 `worker_threads`，同时保持现有 IPC API 表面不变。

**架构：** M2 在 M1 的 `SessionRuntime` 边界上新增 `WorkerSessionRuntime`。默认可通过 `WINSSH_LEGACY_TERMINAL=1` 回到 `LegacySessionRuntime`；SFTP、端口转发、资源监控、OSC/命令历史、主机信任仍委托 legacy runtime，避免一次性迁移过大。

**技术栈：** Electron main process、Node `worker_threads`、ssh2、TypeScript、Vitest、Zod、M1 `SessionRuntime`。

---

## 前置条件

- 已完成 M1：`src/main/services/session-runtime.ts`、`src/main/services/legacy-session-runtime.ts`、`src/shared/ssh-protocol.ts`、`src/main/services/worker-supervisor.ts` 已存在。
- M1 验收通过：`npm run typecheck` 和 `npm run test` 通过。
- 本计划不修改 renderer 终端渲染路径，终端输出仍可继续通过旧 `sessions:data` IPC 兼容发送。

## 文件结构

- 创建：`src/main/services/ssh-control-port.ts`  
  职责：封装 main 与 ssh-core worker 的 request/response、超时、pending map、事件订阅。
- 创建：`src/main/services/worker-session-runtime.ts`  
  职责：实现 `SessionRuntime`，SSH 控制面走 worker，未迁移功能委托 legacy runtime。
- 创建：`src/main/workers/ssh-core/secret-buffer.ts`  
  职责：保存 worker 内 secret buffer，关闭时清零。
- 创建：`src/main/workers/ssh-core/session-worker.ts`  
  职责：拥有单个 `ssh2.Client` 和 shell channel。
- 创建：`src/main/workers/ssh-core/index.ts`  
  职责：worker 入口，解析 `sshCoreInboundSchema` 并调用 `SshCoreSessionWorker`。
- 修改：`src/main/bootstrap.ts`  
  职责：根据 `WINSSH_LEGACY_TERMINAL` 装配 legacy 或 worker runtime。
- 修改：`src/main/localization.ts`  
  职责：新增 worker crash 双语消息。
- 修改：`electron.vite.config.ts`  
  职责：确保 worker 源码走 main build 输出，`ssh2` 继续 externalize。
- 创建：`test/main/services/ssh-control-port.test.ts`
- 创建：`test/main/services/worker-session-runtime.test.ts`
- 创建：`test/main/workers/ssh-core/secret-buffer.test.ts`
- 创建：`test/main/workers/ssh-core/session-worker.test.ts`

## 任务 1：SshControlPort request/response

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

    worker.emit('message', { type: 'ack', requestId: 'req-1', ok: true })

    await expect(promise).resolves.toEqual({ type: 'ack', requestId: 'req-1', ok: true })
    expect(worker.postMessage).toHaveBeenCalledOnce()
  })

  it('rejects when a request times out', async () => {
    vi.useFakeTimers()
    const worker = new FakeWorker()
    const port = new SshControlPort(worker as never, { requestTimeoutMs: 5 })
    const promise = port.request({
      type: 'disconnect',
      sessionId: 'session-1',
      correlationId: 'session-1'
    })

    await vi.advanceTimersByTimeAsync(6)

    await expect(promise).rejects.toThrow('SSH worker request timed out')
    vi.useRealTimers()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/ssh-control-port.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/services/ssh-control-port'`。

- [ ] **步骤 3：实现 `SshControlPort`**

实现要求：
- constructor 接收 `Pick<Worker, 'on' | 'postMessage'>`。
- `request(message)` 使用 message 上已有 `requestId`，没有时生成 `${Date.now()}-${counter}`。
- `worker.postMessage(message)` 后建立 pending promise。
- worker `message` 含相同 `requestId` 时 resolve。
- 超时 reject，错误文案以 `SSH worker request timed out:` 开头。
- `dispose()` 清理 timers 和 pending map。

- [ ] **步骤 4：运行测试验证通过**

运行：

```bash
npx vitest run test/main/services/ssh-control-port.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/services/ssh-control-port.ts test/main/services/ssh-control-port.test.ts
git commit -m "feat: add ssh worker control port"
```

## 任务 2：worker 内 secret buffer

**文件：**
- 创建：`src/main/workers/ssh-core/secret-buffer.ts`
- 创建：`test/main/workers/ssh-core/secret-buffer.test.ts`

- [ ] **步骤 1：编写失败的清零测试**

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

  it('throws when unwrapped after dispose', () => {
    const secret = new SecretBuffer('secret')
    secret.dispose()

    expect(() => secret.unwrap()).toThrow('SecretBuffer has been disposed')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/workers/ssh-core/secret-buffer.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/workers/ssh-core/secret-buffer'`。

- [ ] **步骤 3：实现 `SecretBuffer`**

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

## 任务 3：ssh-core worker runtime skeleton

**文件：**
- 创建：`src/main/workers/ssh-core/session-worker.ts`
- 创建：`src/main/workers/ssh-core/index.ts`
- 创建：`test/main/workers/ssh-core/session-worker.test.ts`
- 修改：`electron.vite.config.ts`

- [ ] **步骤 1：编写失败的 session worker 测试**

```ts
import { EventEmitter } from 'node:events'
import { SshCoreSessionWorker } from '@main/workers/ssh-core/session-worker'

class FakeChannel extends EventEmitter {
  write = vi.fn()
  setWindow = vi.fn()
  close = vi.fn()
}

class FakeClient extends EventEmitter {
  connect = vi.fn()
  end = vi.fn()
  shell = vi.fn((_options, callback) => callback(undefined, new FakeChannel()))
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
    await promise

    expect(client.connect).toHaveBeenCalledOnce()
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: 'state', phase: 'ready' }))
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/workers/ssh-core/session-worker.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/workers/ssh-core/session-worker'`。

- [ ] **步骤 3：实现 `SshCoreSessionWorker`**

实现要求：
- 默认 `createClient` 返回 `new Client()`。
- `connect(config)` 发送 `state`：`handshake`、`ready`。
- `client.connect()` 参数来自 `SshConnectConfig`。
- `shell` 打开后保存 channel。
- channel `data` 转为 `ArrayBuffer` 发送 `{ type: 'data', sessionId, frame, seq }`。
- `write(sessionId, data)` 写入当前 shell channel。
- `resize(sessionId, cols, rows)` 调 `channel.setWindow(rows, cols, 0, 0)`。
- `disconnect(sessionId)` 关闭 channel 并 `client.end()`。
- `client.on('error')` 发送 `{ type: 'error', code: 'connection_failed' }`。

- [ ] **步骤 4：实现 worker 入口**

`src/main/workers/ssh-core/index.ts` 要：
- 从 `node:worker_threads` 读取 `parentPort`。
- 用 `sshCoreInboundSchema.parse(message)` 校验输入。
- 分发 `connect`、`write`、`resize`、`disconnect`。
- 每个 request 返回 `{ type: 'ack', requestId, ok: true }` 或 `{ type: 'ack', requestId, ok: false, message }`。

- [ ] **步骤 5：配置 worker 构建**

确认 `electron.vite.config.ts` main 配置继续使用 `externalizeDepsPlugin()`，不要把 `ssh2` 打包到 renderer。worker 源码应在 `tsconfig.node.json` include 范围内；如果已包含 `src/main/**/*`，无需额外改 tsconfig。

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

## 任务 4：WorkerSessionRuntime 与 feature flag

**文件：**
- 创建：`src/main/services/worker-session-runtime.ts`
- 修改：`src/main/bootstrap.ts`
- 修改：`src/main/localization.ts`
- 创建：`test/main/services/worker-session-runtime.test.ts`

- [ ] **步骤 1：编写失败的 crash 测试**

```ts
import { WorkerSessionRuntime } from '@main/services/worker-session-runtime'

describe('WorkerSessionRuntime', () => {
  it('marks session error when ssh-core worker crashes', () => {
    const send = vi.fn()
    const runtime = new WorkerSessionRuntime({
      legacyRuntime: {} as never,
      sendToRenderer: send,
      spawnWorker: vi.fn()
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

- [ ] **步骤 3：实现 `WorkerSessionRuntime`**

实现要求：
- 实现 `SessionRuntime`。
- SSH 方法 `connect`、`disconnect`、`reconnect`、`write`、`resize` 走 `SshControlPort`。
- SFTP、port-forward、resource snapshot、host-trust 方法委托 `legacyRuntime`。
- worker crash 发送 `sessions:error` 和 `sessions:state`，状态进入 error。
- `dispose()` 终止所有 ssh-core worker 并 dispose legacy runtime。

- [ ] **步骤 4：bootstrap feature flag**

在 `bootstrap()` 中装配：

```ts
const legacyRuntime = new LegacySessionRuntime(sessionManager)
const useLegacyTerminal = process.env['WINSSH_LEGACY_TERMINAL'] === '1'
const sessionRuntime = useLegacyTerminal
  ? legacyRuntime
  : new WorkerSessionRuntime({
      legacyRuntime,
      sendToRenderer: (channel, payload) => {
        mainWindow?.webContents.send(channel, payload)
      }
    })
```

`before-quit` 只调用 `sessionRuntime.dispose()`。

- [ ] **步骤 5：新增双语错误文案**

在 `src/main/localization.ts` 增加：
- 英文 key `sessions.workerCrashed`：`SSH worker crashed. Reconnect the session to continue.`
- 中文 key `sessions.workerCrashed`：`SSH 工作线程已崩溃。请重新连接会话后继续。`

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

## M2 验收

- [ ] **步骤 1：运行 targeted tests**

运行：

```bash
npx vitest run test/main/services/ssh-control-port.test.ts test/main/workers/ssh-core/secret-buffer.test.ts test/main/workers/ssh-core/session-worker.test.ts test/main/services/worker-session-runtime.test.ts
```

预期：PASS。

- [ ] **步骤 2：运行全量验证**

运行：

```bash
npm run typecheck
npm run test
```

预期：PASS。

- [ ] **步骤 3：手工验证 legacy 模式**

运行：`$env:WINSSH_LEGACY_TERMINAL='1'; npm run dev`

预期：能连接 SSH、输入 `pwd`、resize、disconnect、reconnect，SFTP 行为不变。

- [ ] **步骤 4：手工验证 worker 模式**

运行：`Remove-Item Env:WINSSH_LEGACY_TERMINAL -ErrorAction SilentlyContinue; npm run dev`

预期：单 session 密码认证和私钥认证连接成功；worker crash 时 UI 显示可重连错误。

## 回退策略

设置 `WINSSH_LEGACY_TERMINAL=1` 即可回到 M1 runtime。若需要代码回退，只需让 `bootstrap.ts` 固定装配 `LegacySessionRuntime`，保留 worker 文件不影响运行。

## 自检

- 覆盖 M2 的 ssh2 worker 迁移和现有 IPC API 不变要求。
- 未迁移 SFTP、port-forward、OSC、resource、host-trust。
- 保留 `WINSSH_LEGACY_TERMINAL=1` 回退。
