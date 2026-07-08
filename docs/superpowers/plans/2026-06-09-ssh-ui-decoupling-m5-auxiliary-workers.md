# SSH UI 解耦 M5 辅助服务 Worker 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 M4 稳定后，将 SFTP、端口转发、OSC/命令历史、资源监控和主机信任拆到独立 worker/dispatcher 边界，进一步降低 main 线程负载。

**架构：** M5 不再触碰 terminal rendering。每个辅助能力先通过 dispatcher 包一层 legacy fallback，再逐个切到 worker。SFTP 继续 text-only；port forward 继续 session-scoped memory only；命令历史写 DB 仍回到 main；host trust prompt 仍由 main 发给 renderer。

**技术栈：** Electron main process、Node `worker_threads`、MessageChannel、ssh2 SFTP/forwarding、Vitest。

---

## 前置条件

- 已完成 M1-M4。
- `WorkerSupervisor` 可管理 worker 生命周期。
- `WorkerSessionRuntime` 可持有 session 级 worker 资源。
- M5 可拆成多个 PR：建议按 SFTP、port-forward、osc-history、resource-monitor、host-trust 顺序实施。

## 文件结构

- 创建：`src/main/services/sftp-dispatcher.ts`
- 创建：`src/main/workers/sftp/index.ts`
- 创建：`test/main/services/sftp-dispatcher.test.ts`
- 创建：`src/main/services/port-forward-dispatcher.ts`
- 创建：`src/main/workers/port-forward/index.ts`
- 创建：`test/main/services/port-forward-dispatcher.test.ts`
- 创建：`src/main/services/osc-history-dispatcher.ts`
- 创建：`src/main/workers/osc-history/index.ts`
- 创建：`test/main/services/osc-history-dispatcher.test.ts`
- 创建：`src/main/workers/resource-monitor/index.ts`
- 创建：`test/main/services/resource-monitor-worker.test.ts`
- 创建：`src/main/workers/host-trust/index.ts`
- 创建：`test/main/services/host-trust-worker.test.ts`
- 修改：`src/main/services/worker-session-runtime.ts`
- 修改：`src/main/application/sessions-application-service.ts`
- 修改：`src/main/bootstrap.ts`

## 任务 1：SFTP dispatcher 和 worker

**文件：**

- 创建：`src/main/services/sftp-dispatcher.ts`
- 创建：`src/main/workers/sftp/index.ts`
- 创建：`test/main/services/sftp-dispatcher.test.ts`
- 修改：`src/main/services/worker-session-runtime.ts`

- [ ] **步骤 1：编写失败的 legacy fallback 测试**

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

  it('sends cancel to the active worker request when worker mode is enabled', () => {
    const postMessage = vi.fn()
    const dispatcher = new SftpDispatcher({
      legacyRuntime: {} as never,
      useWorker: true,
      getWorkerPort: () => ({ postMessage }) as never
    })

    dispatcher.cancelReadFile('session-1', '/tmp/a.txt')

    expect(postMessage).toHaveBeenCalledWith({
      type: 'cancelReadFile',
      sessionId: 'session-1',
      remotePath: '/tmp/a.txt'
    })
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/sftp-dispatcher.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/services/sftp-dispatcher'`。

- [ ] **步骤 3：实现 dispatcher**

实现要求：

- `useWorker: false` 时全部委托 legacy runtime。
- `useWorker: true` 时通过 worker port 请求 `list`、`readFile`、`writeFile`、`cancelReadFile`。
- `readFile` 和 `writeFile` 对外仍是 string API。
- 传输进度继续走 `sftp:transfer`。
- worker 请求失败时返回结构化 error，main 负责翻译用户可见消息。

- [ ] **步骤 4：实现 sftp worker 入口**

`src/main/workers/sftp/index.ts` 要处理：

- `list`
- `readFile`
- `writeFile`
- `cancelReadFile`

每个请求带 `requestId`、`sessionId`、`remotePath`。一次读取最多 256KB chunk，最终对外组合为 string。

- [ ] **步骤 5：接入 `WorkerSessionRuntime`**

把 `readFile`、`writeFile`、`listDirectory` 等 SFTP 方法改为调用 `SftpDispatcher`。默认 `useWorker` 先设为 false，通过单独 flag 切换到 true。

- [ ] **步骤 6：运行验证**

运行：

```bash
npx vitest run test/main/services/sftp-dispatcher.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 7：Commit**

```bash
git add src/main/services/sftp-dispatcher.ts src/main/workers/sftp/index.ts src/main/services/worker-session-runtime.ts test/main/services/sftp-dispatcher.test.ts
git commit -m "feat: add sftp worker dispatcher"
```

## 任务 2：PortForward dispatcher 和 worker

**文件：**

- 创建：`src/main/services/port-forward-dispatcher.ts`
- 创建：`src/main/workers/port-forward/index.ts`
- 创建：`test/main/services/port-forward-dispatcher.test.ts`
- 修改：`src/main/services/worker-session-runtime.ts`

- [ ] **步骤 1：编写失败的 port-forward fallback 测试**

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

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/port-forward-dispatcher.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/services/port-forward-dispatcher'`。

- [ ] **步骤 3：实现 dispatcher**

实现要求：

- public 方法：`list`、`create`、`start`、`stop`、`remove`。
- 默认 `useWorker: false` 委托 legacy runtime。
- worker mode 不写 DB，只维护 session 内存规则。
- 状态变化继续通过 `portForwards:state` 事件发送。

- [ ] **步骤 4：实现 worker 入口**

`src/main/workers/port-forward/index.ts` 处理：

- `create`
- `start`
- `stop`
- `remove`
- `disposeSession`

任何嵌套 jump chain 仍拒绝，沿用现有 validation 和 runtime 规则。

- [ ] **步骤 5：运行验证**

运行：

```bash
npx vitest run test/main/services/port-forward-dispatcher.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/main/services/port-forward-dispatcher.ts src/main/workers/port-forward/index.ts src/main/services/worker-session-runtime.ts test/main/services/port-forward-dispatcher.test.ts
git commit -m "feat: add port forward worker dispatcher"
```

## 任务 3：OSC/命令历史 dispatcher 和 worker

**文件：**

- 创建：`src/main/services/osc-history-dispatcher.ts`
- 创建：`src/main/workers/osc-history/index.ts`
- 创建：`test/main/services/osc-history-dispatcher.test.ts`
- 修改：`src/main/services/worker-session-runtime.ts`

- [ ] **步骤 1：编写失败的命令记录测试**

```ts
import { OscHistoryDispatcher } from '@main/services/osc-history-dispatcher'

describe('OscHistoryDispatcher', () => {
  it('forwards command records to main database writer', () => {
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

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/osc-history-dispatcher.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/services/osc-history-dispatcher'`。

- [ ] **步骤 3：实现 dispatcher**

实现要求：

- worker 扫描 OSC，dispatcher 接收 command boundary。
- dispatcher 不直接打开 DB；通过注入的 `recordCommand` 写入 main database service。
- CWD 变化继续发送 `sessions:cwdChanged`。
- 保留现有 `osc-scanner.test.ts`，不要删除旧扫描器测试。

- [ ] **步骤 4：实现 worker 入口**

`src/main/workers/osc-history/index.ts` 使用现有 `scanOscChunk` 或抽取出的纯函数。输入为 terminal byte chunk，输出为 command start/preexec/done/cwd event。

- [ ] **步骤 5：运行验证**

运行：

```bash
npx vitest run test/main/services/osc-history-dispatcher.test.ts test/main/osc-scanner.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/main/services/osc-history-dispatcher.ts src/main/workers/osc-history/index.ts src/main/services/worker-session-runtime.ts test/main/services/osc-history-dispatcher.test.ts
git commit -m "feat: add osc history worker dispatcher"
```

## 任务 4：Resource monitor worker

**文件：**

- 创建：`src/main/workers/resource-monitor/index.ts`
- 创建：`test/main/services/resource-monitor-worker.test.ts`
- 修改：`src/main/services/worker-session-runtime.ts`

- [ ] **步骤 1：编写平台行为测试**

```ts
import { createResourceMonitorSnapshot } from '@main/workers/resource-monitor'

describe('resource monitor worker', () => {
  it('returns unsupported snapshot on non-linux platforms', async () => {
    const snapshot = await createResourceMonitorSnapshot({
      platform: 'win32',
      sessionId: 'session-1'
    })

    expect(snapshot.platform).toBe('win32')
    expect(snapshot.cpu).toBeNull()
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/resource-monitor-worker.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/workers/resource-monitor'`。

- [ ] **步骤 3：实现 worker helper**

实现要求：

- Linux 读取 `/proc/stat`、`/proc/meminfo` 等现有逻辑可复用。
- 非 Linux 返回与当前 `SessionManager.getResourceSnapshot` 一致的 unsupported/empty shape。
- 采样间隔仍由 main/session runtime 控制，不让 worker 自己无限 setInterval。

- [ ] **步骤 4：接入 runtime**

`WorkerSessionRuntime.getResourceSnapshot(sessionId)` 在 flag 打开时请求 resource-monitor worker；flag 关闭时委托 legacy runtime。

- [ ] **步骤 5：运行验证**

运行：

```bash
npx vitest run test/main/services/resource-monitor-worker.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/main/workers/resource-monitor/index.ts src/main/services/worker-session-runtime.ts test/main/services/resource-monitor-worker.test.ts
git commit -m "feat: move resource snapshot behind worker"
```

## 任务 5：Host trust worker

**文件：**

- 创建：`src/main/workers/host-trust/index.ts`
- 创建：`test/main/services/host-trust-worker.test.ts`
- 修改：`src/main/services/worker-session-runtime.ts`

- [ ] **步骤 1：编写 host trust request 测试**

```ts
import { createHostTrustRequest } from '@main/workers/host-trust'

describe('host trust worker', () => {
  it('creates a renderer-safe trust request', () => {
    const request = createHostTrustRequest({
      sessionId: 'session-1',
      host: 'example.com',
      port: 22,
      fingerprint: 'SHA256:abc'
    })

    expect(request).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        host: 'example.com',
        port: 22,
        fingerprint: 'SHA256:abc'
      })
    )
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/services/host-trust-worker.test.ts`

预期：FAIL，报错包含 `Cannot find module '@main/workers/host-trust'`。

- [ ] **步骤 3：实现 host trust worker helper**

实现要求：

- worker 不直接访问 renderer。
- worker 只构造 host trust request 并发给 main。
- main 继续通过 `system:hostTrustRequest` 发送给 renderer。
- renderer 响应仍通过 `system:respondHostTrust` 回到 main，再转发给等待中的 worker。

- [ ] **步骤 4：接入 runtime**

把现有 host trust 验证路径中的重计算工作迁到 worker helper；保留 `resolveHostTrust(result)` 的 public API。

- [ ] **步骤 5：运行验证**

运行：

```bash
npx vitest run test/main/services/host-trust-worker.test.ts test/main/session-manager.connect.test.ts
npm run typecheck:node
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/main/workers/host-trust/index.ts src/main/services/worker-session-runtime.ts test/main/services/host-trust-worker.test.ts
git commit -m "feat: move host trust checks behind worker"
```

## M5 验收

- [ ] **步骤 1：运行 targeted tests**

运行：

```bash
npx vitest run test/main/services/sftp-dispatcher.test.ts test/main/services/port-forward-dispatcher.test.ts test/main/services/osc-history-dispatcher.test.ts test/main/services/resource-monitor-worker.test.ts test/main/services/host-trust-worker.test.ts
```

预期：PASS。

- [ ] **步骤 2：运行全量验证**

运行：

```bash
npm run typecheck
npm run test
```

预期：PASS。

- [ ] **步骤 3：手工验证 SFTP**

运行：`npm run dev`

预期：SFTP list/read/write/cancel 与 M4 一致，远程文件编辑仍是 text-only。

- [ ] **步骤 4：手工验证端口转发和历史**

预期：端口转发规则重启 app 后不保留；OSC 命令历史继续写入数据库；CWD 变化仍刷新 UI。

- [ ] **步骤 5：手工验证 resource 和 host trust**

预期：Linux resource snapshot 可用；非 Linux 保持 unsupported 状态；未知 host 仍弹出信任确认。

## 回退策略

每个 dispatcher 都必须保留 `useWorker: false` 的 legacy delegate。若任一辅助 worker 出现异常，只关闭该 worker flag，不影响 M4 terminal worker 和 ssh-core worker。

## 自检

- 覆盖 M5 的 SFTP、port-forward、OSC/命令历史、resource-monitor、host-trust 拆分。
- 未改变 DB schema。
- 未改变 SFTP text-only 契约。
- 未改变 port-forward session-scoped memory 契约。
