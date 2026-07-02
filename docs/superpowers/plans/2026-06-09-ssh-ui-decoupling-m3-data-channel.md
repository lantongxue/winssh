# SSH UI 解耦 M3 数据通道实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为 SSH 终端数据流引入二进制帧、`MessagePort` 数据通道和背压事件，同时保留旧 `sessions:onData` IPC 订阅作为兼容路径。

**架构：** M3 在 M2 worker runtime 之上增加 `SshDataAggregator` 和 preload `BinaryChannel`。ssh-core worker 输出二进制帧，main 按 `sessionId` 路由到 renderer 建立的端口；没有端口时回退旧 `sessions:data` 事件。

**技术栈：** Electron IPC、MessageChannel/MessagePort、Transferable ArrayBuffer、TypeScript、Vitest、M1 `ssh-data-frame`。

---

## 前置条件

- 已完成 M1 和 M2。
- `src/shared/ssh-data-frame.ts`、`src/main/services/worker-session-runtime.ts` 已存在。
- 旧 `sessions.onData(sessionId, callback)` 仍可工作。

## 文件结构

- 创建：`src/main/services/ssh-data-aggregator.ts`  
  职责：注册 session data port、路由 terminal frame、统计 lag、发出背压事件。
- 创建：`src/preload/binary-channel.ts`  
  职责：preload 侧帧队列、高低水位、flush、dispose。
- 创建：`src/preload/terminal-port-allocator.ts`  
  职责：为每个 SSH session 创建 `MessageChannel`，把一个端口交给 main，另一个端口返回 renderer。
- 修改：`src/preload/index.ts`  
  职责：在 `sessions` API 增加 `createDataChannel(sessionId)`。
- 修改：`src/preload/index.d.ts`  
  职责：同步 preload 类型。
- 修改：`src/shared/api.ts`  
  职责：扩展 `WinsshApi['sessions']`。
- 修改：`src/shared/ipc-channels.ts`  
  职责：新增 `terminal:backpressure` 和可选 data lag 指标事件。
- 修改：`test/renderer/helpers/create-winssh-api.ts`  
  职责：为 renderer 测试 mock `createDataChannel`。
- 创建：`test/main/services/ssh-data-aggregator.test.ts`
- 创建：`test/preload/binary-channel.test.ts`
- 创建：`test/preload/terminal-port-allocator.test.ts`

## 任务 1：SshDataAggregator

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
    aggregator.routeFrame({ sessionId: 'session-1', frame, seq: 1, sentAtMs: performance.now() })

    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'data', seq: 1, frame }),
      [frame]
    )
  })

  it('falls back to legacy sender when no port is registered', () => {
    const sendLegacyData = vi.fn()
    const aggregator = new SshDataAggregator({ sendLegacyData })

    aggregator.routeFrame({
      sessionId: 'session-1',
      frame: new TextEncoder().encode('hello').buffer,
      seq: 1,
      sentAtMs: performance.now()
    })

    expect(sendLegacyData).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({ sessionId: 'session-1' })
    )
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/ssh-data-aggregator.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/services/ssh-data-aggregator'`。

- [ ] **步骤 3：实现 aggregator**

实现要求：
- `registerSessionPort(sessionId, port)` 保存端口。
- `unregisterSessionPort(sessionId)` 关闭并删除端口。
- `routeFrame(event)` 有端口时 `postMessage({ type: 'data', ... }, [frame])`。
- 无端口时调用注入的 `sendLegacyData(sessionId, event)`。
- 计算 `lagMs = performance.now() - sentAtMs`。
- 队列或端口不可用时发送 `terminal:backpressure`。

- [ ] **步骤 4：更新 `ipc-channels.ts`**

新增事件类型：

```ts
export interface TerminalBackpressureEvent {
  sessionId: string
  droppedFrames: number
  queuedBytes: number
}
```

并加入 `IpcChannelMap`：

```ts
'terminal:backpressure': TerminalBackpressureEvent
```

- [ ] **步骤 5：运行验证**

运行：

```bash
npx vitest run test/main/services/ssh-data-aggregator.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/main/services/ssh-data-aggregator.ts src/shared/ipc-channels.ts test/main/services/ssh-data-aggregator.test.ts
git commit -m "feat: add ssh data aggregator"
```

## 任务 2：Preload BinaryChannel

**文件：**
- 创建：`src/preload/binary-channel.ts`
- 创建：`test/preload/binary-channel.test.ts`

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

  it('drops oldest frames when high water mark is exceeded', () => {
    const port = { postMessage: vi.fn(), close: vi.fn() }
    const channel = new BinaryChannel(port as never, { highWaterMarkBytes: 4 })

    const result = channel.enqueue(new ArrayBuffer(8))

    expect(result.droppedFrames).toBeGreaterThan(0)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/preload/binary-channel.test.ts`

预期：FAIL，报错包含 `Cannot find module '../../src/preload/binary-channel'`。

- [ ] **步骤 3：实现 BinaryChannel**

实现要求：
- 队列保存 `ArrayBuffer[]`。
- `enqueue(frame)` 增加 queued bytes 并返回 `{ droppedFrames, queuedBytes }`。
- 超出 `highWaterMarkBytes` 时丢弃最旧帧直到小于等于一半水位。
- `flush()` 按顺序 `postMessage({ type: 'data', frame }, [frame])`。
- `dispose()` 清空队列并关闭 port。

- [ ] **步骤 4：运行验证**

运行：

```bash
npx vitest run test/preload/binary-channel.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/preload/binary-channel.ts test/preload/binary-channel.test.ts
git commit -m "feat: add preload binary channel"
```

## 任务 3：TerminalPortAllocator 与 API 扩展

**文件：**
- 创建：`src/preload/terminal-port-allocator.ts`
- 创建：`test/preload/terminal-port-allocator.test.ts`
- 修改：`src/preload/index.ts`
- 修改：`src/preload/index.d.ts`
- 修改：`src/shared/api.ts`
- 修改：`test/renderer/helpers/create-winssh-api.ts`

- [ ] **步骤 1：编写失败的端口分配测试**

```ts
import { TerminalPortAllocator } from '../../src/preload/terminal-port-allocator'

describe('TerminalPortAllocator', () => {
  it('creates a channel and registers one port with main', async () => {
    const registerMainPort = vi.fn(async () => undefined)
    const allocator = new TerminalPortAllocator({ registerMainPort })

    const rendererPort = await allocator.create('session-1')

    expect(rendererPort).toBeInstanceOf(MessagePort)
    expect(registerMainPort).toHaveBeenCalledWith('session-1', expect.any(MessagePort))
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/preload/terminal-port-allocator.test.ts`

预期：FAIL，报错包含 `Cannot find module '../../src/preload/terminal-port-allocator'`。

- [ ] **步骤 3：实现 TerminalPortAllocator**

实现要求：
- `create(sessionId)` 创建 `new MessageChannel()`。
- 调用注入的 `registerMainPort(sessionId, channel.port1)`。
- 返回 `channel.port2` 给 renderer。
- 同一个 `sessionId` 重新 create 时先关闭旧 port。

- [ ] **步骤 4：扩展 `WinsshApi`**

`src/shared/api.ts` 的 `sessions` 增加：

```ts
createDataChannel: (sessionId: string) => Promise<MessagePort>
```

`src/preload/index.ts` 的 `sessions` 增加：

```ts
createDataChannel: (sessionId) => terminalPortAllocator.create(sessionId)
```

注册 main port 的内部实现应通过 Electron 支持的 transferable port API 传递给 main；如果当前 Electron 类型要求使用 `postMessage`，把传输封装在 `terminal-port-allocator.ts` 内，避免污染 `WinsshApi`。

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
git add src/preload/terminal-port-allocator.ts src/preload/index.ts src/preload/index.d.ts src/shared/api.ts test/preload/terminal-port-allocator.test.ts test/renderer/helpers/create-winssh-api.ts
git commit -m "feat: expose ssh terminal data channel"
```

## 任务 4：M3 接线与兼容验证

**文件：**
- 修改：`src/main/services/worker-session-runtime.ts`
- 修改：`src/main/ipc/register-session-ipc.ts`
- 修改：`src/main/bootstrap.ts`

- [ ] **步骤 1：编写兼容测试**

在 `test/main/services/worker-session-runtime.test.ts` 增加：

```ts
it('forwards worker data frames to the data aggregator', () => {
  const routeFrame = vi.fn()
  const runtime = new WorkerSessionRuntime({
    legacyRuntime: {} as never,
    sendToRenderer: vi.fn(),
    dataAggregator: { routeFrame } as never,
    spawnWorker: vi.fn()
  })

  runtime.handleWorkerMessage({
    type: 'data',
    sessionId: 'session-1',
    correlationId: 'session-1',
    frame: new ArrayBuffer(4),
    seq: 1
  })

  expect(routeFrame).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 'session-1' }))
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/worker-session-runtime.test.ts -t "forwards worker data frames"`

预期：FAIL，原因是 `WorkerSessionRuntime` 尚未接收 `dataAggregator`。

- [ ] **步骤 3：接入 aggregator**

实现要求：
- `WorkerSessionRuntime` 接收 `dataAggregator` 依赖。
- ssh-core worker 的 `data` outbound 交给 `dataAggregator.routeFrame`。
- `register-session-ipc.ts` 新增内部 handler 用于接收 preload 传来的 main port。
- `bootstrap.ts` 创建一个 `SshDataAggregator` 实例并注入 runtime。

- [ ] **步骤 4：运行验证**

运行：

```bash
npx vitest run test/main/services/worker-session-runtime.test.ts test/main/services/ssh-data-aggregator.test.ts
npm run typecheck
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/services/worker-session-runtime.ts src/main/ipc/register-session-ipc.ts src/main/bootstrap.ts
git commit -m "feat: route ssh worker data through message ports"
```

## M3 验收

- [ ] **步骤 1：运行 targeted tests**

运行：

```bash
npx vitest run test/main/services/ssh-data-aggregator.test.ts test/preload/binary-channel.test.ts test/preload/terminal-port-allocator.test.ts test/main/services/worker-session-runtime.test.ts
```

预期：PASS。

- [ ] **步骤 2：运行全量验证**

运行：

```bash
npm run typecheck
npm run test
```

预期：PASS。

- [ ] **步骤 3：手工验证兼容路径**

运行：`npm run dev`

预期：不使用 `createDataChannel` 的旧 `sessions.onData` 订阅仍能收到终端输出。

- [ ] **步骤 4：手工验证数据通道**

在 renderer 调试点调用 `sessionsClient.createDataChannel(sessionId)` 并监听端口。

预期：同一 session 的输出以二进制 frame 到达；关闭端口后旧 IPC fallback 不崩溃。

## 回退策略

关闭 renderer 对 `sessions.createDataChannel` 的调用即可回退到旧 `sessions:data` IPC。若 main 数据路由异常，`SshDataAggregator` 没有注册 port 时必须自动走 legacy sender。

## 自检

- 覆盖 M3 的二进制帧、`MessagePort` 路由和背压事件。
- 保留旧 `sessions.onData`。
- 没有改 xterm 渲染所有权；M4 才迁移 TerminalWorker。
