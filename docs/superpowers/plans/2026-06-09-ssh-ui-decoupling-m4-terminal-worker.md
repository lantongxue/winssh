# SSH UI 解耦 M4 TerminalWorker 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 SSH terminal 的 xterm 生命周期迁入 renderer Web Worker，并通过 OffscreenCanvas/MessagePort 数据通道减少 React 主线程压力；不可用时自动回退到现有主线程 xterm 路径。

**架构：** M4 在 M3 `createDataChannel` 之上新增 `TerminalWorkerHost` 和 `terminal.worker.ts`。SSH session 优先走 worker host，local terminal 继续使用原 `use-terminal.ts` 主线程路径；OffscreenCanvas、SharedArrayBuffer、TerminalWorker 任一不可用都发出 degraded 事件并回退。

**技术栈：** React 19、xterm.js、Web Worker、OffscreenCanvas、MessagePort、Electron COOP/COEP headers、Vitest/jsdom。

---

## 前置条件

- 已完成 M1、M2、M3。
- `sessionsClient.createDataChannel(sessionId)` 可返回 `MessagePort`。
- 旧 `use-terminal.ts` 主线程 xterm 路径仍可运行。
- 重要校正：不要在 `webPreferences` 中写不存在的 `crossOriginIsolated` 配置；SharedArrayBuffer 需要 COOP/COEP headers，并用 `self.crossOriginIsolated` 做运行时判断。

## 文件结构

- 创建：`src/shared/worker-protocol.ts`  
  职责：定义 renderer 主线程与 terminal worker 的消息类型、降级原因和生命周期事件。
- 修改：`src/main/bootstrap.ts`  
  职责：注册 COOP/COEP headers helper。
- 创建：`test/main/cross-origin-isolation.test.ts`
- 创建：`src/renderer/src/workers/terminal-worker-types.ts`
- 创建：`src/renderer/src/workers/terminal-worker-host.ts`  
  职责：主线程代理，spawn worker、attach data port、处理 fallback。
- 创建：`src/renderer/src/workers/terminal.worker.ts`  
  职责：拥有 SSH xterm 实例、addons、输入输出 port。
- 修改：`src/renderer/src/features/sessions/api/sessions-client.ts`  
  职责：暴露 `createDataChannel` 包装方法。
- 修改：`src/renderer/src/hooks/use-terminal.ts`  
  职责：SSH session 在可用时走 TerminalWorkerHost；local terminal 走旧路径。
- 修改：`src/renderer/src/hooks/use-session-events.ts`  
  职责：订阅 terminal degraded/backpressure 事件。
- 修改：`src/renderer/src/store/sessions-store.ts`  
  职责：保存 terminal degraded/backpressure 状态。
- 创建：`test/shared/worker-protocol.test.ts`
- 创建：`test/renderer/workers/terminal-worker-host.test.ts`
- 修改：`test/renderer/hooks/use-terminal.test.tsx`

## 任务 1：worker protocol 与 cross-origin isolation headers

**文件：**
- 创建：`src/shared/worker-protocol.ts`
- 创建：`test/shared/worker-protocol.test.ts`
- 修改：`src/main/bootstrap.ts`
- 创建：`test/main/cross-origin-isolation.test.ts`

- [ ] **步骤 1：编写 worker protocol 测试**

```ts
import { terminalWorkerMessageSchema } from '@shared/worker-protocol'

describe('worker protocol', () => {
  it('accepts terminal attach message', () => {
    const result = terminalWorkerMessageSchema.parse({
      type: 'attach',
      sessionId: 'session-1',
      useOffscreenCanvas: false
    })

    expect(result.type).toBe('attach')
  })

  it('accepts degraded message with known reason', () => {
    const result = terminalWorkerMessageSchema.parse({
      type: 'degraded',
      sessionId: 'session-1',
      reason: 'offscreen_canvas_unavailable'
    })

    expect(result.reason).toBe('offscreen_canvas_unavailable')
  })
})
```

- [ ] **步骤 2：编写 header helper 测试**

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

- [ ] **步骤 3：运行测试验证失败**

运行：

```bash
npx vitest run test/shared/worker-protocol.test.ts test/main/cross-origin-isolation.test.ts
```

预期：FAIL，报错包含 worker protocol 模块不存在和 `createCrossOriginIsolationHeaders` 未导出。

- [ ] **步骤 4：实现 worker protocol**

`src/shared/worker-protocol.ts` 定义：
- `TerminalDegradedReason`：`offscreen_canvas_unavailable`、`shared_array_buffer_unavailable`、`terminal_worker_crashed`、`worker_init_failed`。
- `terminalWorkerMessageSchema`：支持 `attach`、`resize`、`focus`、`dispose`、`degraded`、`ready`。

- [ ] **步骤 5：实现 headers helper 并注册**

在 `bootstrap.ts` 导出：

```ts
export function createCrossOriginIsolationHeaders(): Record<string, string[]> {
  return {
    'Cross-Origin-Opener-Policy': ['same-origin'],
    'Cross-Origin-Embedder-Policy': ['require-corp']
  }
}
```

在创建窗口前用 `session.defaultSession.webRequest.onHeadersReceived` 合并 headers，不覆盖已有非目标 headers。

- [ ] **步骤 6：运行验证**

运行：

```bash
npx vitest run test/shared/worker-protocol.test.ts test/main/cross-origin-isolation.test.ts
npm run typecheck
```

预期：PASS。

- [ ] **步骤 7：Commit**

```bash
git add src/shared/worker-protocol.ts src/main/bootstrap.ts test/shared/worker-protocol.test.ts test/main/cross-origin-isolation.test.ts
git commit -m "feat: add terminal worker protocol and isolation headers"
```

## 任务 2：TerminalWorkerHost

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
      expect.objectContaining({ type: 'attach', sessionId: 'session-1', useOffscreenCanvas: false }),
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

实现要求：
- `attach({ sessionId, container })` 创建 worker。
- 调 `sessionsClient.createDataChannel(sessionId)` 或注入的 `createDataChannel`。
- 若 canvas 支持 `transferControlToOffscreen`，传 OffscreenCanvas；否则 `useOffscreenCanvas: false`。
- `worker.onerror` 或 worker message `degraded` 时调用 `onDegraded`。
- `detach()` terminate worker，关闭 data port。
- `focus()`、`resize(cols, rows)` 通过 worker message 转发。

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

## 任务 3：TerminalWorker 实现

**文件：**
- 创建：`src/renderer/src/workers/terminal.worker.ts`
- 修改：`electron.vite.config.ts`

- [ ] **步骤 1：编写 worker host 集成测试**

在 `test/renderer/workers/terminal-worker-host.test.ts` 增加：

```ts
it('reports degraded when worker emits degraded message', async () => {
  const listeners = new Map<string, EventListener>()
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn((event: string, listener: EventListener) => listeners.set(event, listener)),
    removeEventListener: vi.fn()
  }
  const onDegraded = vi.fn()
  const host = new TerminalWorkerHost({
    createWorker: () => worker as never,
    createDataChannel: async () => new MessageChannel().port1,
    supportsOffscreenCanvas: () => false,
    isCrossOriginIsolated: () => false,
    onDegraded
  })

  await host.attach({ sessionId: 'session-1', container: document.createElement('div') })
  listeners.get('message')?.(
    new MessageEvent('message', {
      data: { type: 'degraded', sessionId: 'session-1', reason: 'worker_init_failed' }
    })
  )

  expect(onDegraded).toHaveBeenCalledWith('session-1', 'worker_init_failed')
})
```

- [ ] **步骤 2：运行测试**

运行：`npx vitest run test/renderer/workers/terminal-worker-host.test.ts -t "reports degraded"`

预期：PASS after host message handling is implemented。

- [ ] **步骤 3：实现 `terminal.worker.ts`**

实现要求：
- worker 接收 `attach`，创建 `Terminal`。
- data port 收到 `{ type: 'data', frame }` 后解码 payload 并 `terminal.write(...)`。
- `terminal.onData` 把用户输入发回 data port。
- 接收 `resize` 后调用 `terminal.resize(cols, rows)`。
- 初始化失败时 `postMessage({ type: 'degraded', reason: 'worker_init_failed' })`。
- OffscreenCanvas 不可用时不要崩溃，发送 `offscreen_canvas_unavailable`。

- [ ] **步骤 4：配置 renderer worker 构建**

确认 Vite 能处理：

```ts
new Worker(new URL('./terminal.worker.ts', import.meta.url), { type: 'module' })
```

如果需要别名配置，只改 `electron.vite.config.ts` renderer alias，不改变 `HashRouter`。

- [ ] **步骤 5：运行验证**

运行：

```bash
npx vitest run test/renderer/workers/terminal-worker-host.test.ts
npm run typecheck:web
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/renderer/src/workers/terminal.worker.ts electron.vite.config.ts test/renderer/workers/terminal-worker-host.test.ts
git commit -m "feat: add ssh terminal web worker"
```

## 任务 4：use-terminal 分流与 degraded 状态

**文件：**
- 修改：`src/renderer/src/hooks/use-terminal.ts`
- 修改：`src/renderer/src/features/sessions/api/sessions-client.ts`
- 修改：`src/renderer/src/hooks/use-session-events.ts`
- 修改：`src/renderer/src/store/sessions-store.ts`
- 修改：`test/renderer/hooks/use-terminal.test.tsx`

- [ ] **步骤 1：扩展 use-terminal 测试**

在 `test/renderer/hooks/use-terminal.test.tsx` 增加：

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

预期：FAIL，原因是 `useTerminal` 尚不接受 worker host options。

- [ ] **步骤 3：修改 `sessions-client.ts`**

确保 renderer feature API 暴露：

```ts
export const sessionsClient = getWinsshDomainClient('sessions')
```

如果需要显式包装，必须仍通过 `getWinsshDomainClient('sessions')`，不要在 renderer 组件中直接访问 `window.winsshApi`。

- [ ] **步骤 4：修改 `use-terminal.ts`**

实现要求：
- local terminal 继续旧路径。
- SSH session 若 worker host 可用且未降级，调用 `terminalWorkerHost.attach`。
- SSH worker degraded 后切回原主线程 xterm 初始化逻辑。
- 保留 keep-mounted 场景下的 focus/resize 行为。
- 不改变 `session-editor` 和 `local-terminal-editor` 的挂载策略。

- [ ] **步骤 5：接入 events/store**

`use-session-events.ts` 订阅 `terminal:backpressure` 和 `terminal:degraded`。

`sessions-store.ts` 增加 sessionId 维度状态：

```ts
terminalHealth: Record<string, { degradedReason?: string; backpressureCount: number }>
```

- [ ] **步骤 6：运行验证**

运行：

```bash
npx vitest run test/renderer/hooks/use-terminal.test.tsx test/renderer/workers/terminal-worker-host.test.ts
npm run typecheck:web
```

预期：PASS。

- [ ] **步骤 7：Commit**

```bash
git add src/renderer/src/hooks/use-terminal.ts src/renderer/src/features/sessions/api/sessions-client.ts src/renderer/src/hooks/use-session-events.ts src/renderer/src/store/sessions-store.ts test/renderer/hooks/use-terminal.test.tsx
git commit -m "feat: route ssh terminal rendering through worker host"
```

## M4 验收

- [ ] **步骤 1：运行 targeted tests**

运行：

```bash
npx vitest run test/shared/worker-protocol.test.ts test/main/cross-origin-isolation.test.ts test/renderer/workers/terminal-worker-host.test.ts test/renderer/hooks/use-terminal.test.tsx
```

预期：PASS。

- [ ] **步骤 2：运行全量验证**

运行：

```bash
npm run typecheck
npm run test
```

预期：PASS。

- [ ] **步骤 3：手工验证 worker 模式**

运行：`npm run dev`

预期：SSH session 能连接、输入、resize；多 session 输出时 React UI 仍可交互。

- [ ] **步骤 4：手工验证 fallback**

强制让 `supportsOffscreenCanvas()` 返回 false 或临时禁用 worker host。

预期：发出 degraded 状态，terminal 回到主线程 xterm 路径，session 不断开。

## 回退策略

禁用 SSH worker host 分支即可回到 M3：数据通道保留，但 xterm 仍在主线程。若 COOP/COEP 引发资源加载问题，先关闭 SharedArrayBuffer 使用路径，继续用 Transferable ArrayBuffer。

## 自检

- 覆盖 M4 的 TerminalWorker、OffscreenCanvas、SharedArrayBuffer 降级链。
- local terminal 不受影响。
- renderer 仍遵守 feature API gateway。
