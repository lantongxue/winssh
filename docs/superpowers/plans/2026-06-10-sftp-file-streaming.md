# SFTP File Streaming 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 用流式 IPC 替换 SFTP 文件编辑器的整文件读写 API，减少打开和保存远程文本文件时的卡顿与内存峰值。

**架构：** `src/main/encoding.ts` 提供可测试的增量解码 helper；`SessionManager` 管理编辑器文件流任务、SFTP handle、取消和进度事件；shared/preload/renderer API 删除旧 `readFile`/`writeFile` 契约并暴露新的 stream 方法和事件；Monaco 编辑器按 `streamId` 分批追加读取内容，保存时按块发送文本并等待每块 ack。

**技术栈：** Electron IPC、React 19、TypeScript、Vitest、Testing Library、Monaco Editor、ssh2 SFTP、iconv-lite、jschardet。

---

## 文件结构

- 修改：`src/main/encoding.ts`，新增增量文本解码器，复用当前 `smartDecode()` 的编码选择规则。
- 修改：`test/main/encoding.test.ts`，覆盖跨 chunk UTF-8、UTF-16 BOM、GBK/Windows-1252 fallback。
- 修改：`src/shared/types.ts`，新增 SFTP 文件流类型。
- 修改：`src/shared/ipc-channels.ts`，新增 `sftp:fileChunk` 和 `sftp:fileStreamState` renderer 事件。
- 修改：`src/shared/api.ts`，删除旧 `sftp.readFile`/`sftp.writeFile`，新增 stream API。
- 修改：`src/preload/index.ts`，删除旧 IPC 映射，新增 stream invoke/send 和订阅。
- 修改：`test/renderer/helpers/create-winssh-api.ts`，更新 mock API 默认实现。
- 修改：`test/preload/away-reminder-subscriptions.test.ts`，增加轻量类型契约检查，证明 mock 和 `WinsshApi` 暴露新方法。
- 修改：`src/main/services/session-runtime.ts`，用 stream 方法替换整文件方法。
- 修改：`src/main/services/legacy-session-runtime.ts`，委派新的 stream 方法到 `SessionManager`。
- 修改：`src/main/services/worker-session-runtime.ts`，worker terminal 模式下继续把编辑器文件流委派给 legacy runtime，并删除旧整文件委派。
- 修改：`src/main/application/sessions-application-service.ts`，暴露 stream use-case 方法。
- 修改：`src/main/ipc/register-session-ipc.ts`，注册新 stream IPC handler，删除旧 `sftp:readFile`/`sftp:writeFile` handler。
- 修改：`src/main/session-manager.ts`，新增读/写 stream 任务、SFTP 分块读写、取消、进度桥接和清理。
- 修改：`test/main/session-manager.test.ts`，覆盖主进程读写 stream 行为。
- 修改：`src/renderer/src/features/shared/query-keys.ts`，移除不再缓存完整文件内容的 `sftpFile` key。
- 修改：`src/renderer/src/components/workbench/workbench-sftp-file-monaco-editor.tsx`，从 React Query 整文件加载迁移为显式 stream 生命周期。
- 修改：`test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx`，迁移编辑器测试到 stream mock，并新增 stale stream、分块保存、保存失败测试。

## 任务 1：增量编码 helper

**文件：**

- 修改：`src/main/encoding.ts`
- 修改：`test/main/encoding.test.ts`

- [ ] **步骤 1：编写失败的测试**

在 `test/main/encoding.test.ts` 的 import 改为：

```ts
import { createIncrementalTextDecoder, smartDecodeBuffer } from '@main/encoding'
```

在文件末尾添加：

```ts
describe('createIncrementalTextDecoder', () => {
  it('preserves UTF-8 characters split across chunks', () => {
    const buffer = Buffer.from('Hello 你好世界', 'utf8')
    const decoder = createIncrementalTextDecoder(buffer.subarray(0, 8))

    const parts = [
      decoder.write(buffer.subarray(0, 8)),
      decoder.write(buffer.subarray(8, 10)),
      decoder.write(buffer.subarray(10)),
      decoder.end()
    ].filter(Boolean)

    expect(decoder.encoding).toBe('utf8')
    expect(parts.join('')).toBe('Hello 你好世界')
  })

  it('detects UTF-16 LE from the initial BOM sample', () => {
    const buffer = Buffer.concat([Buffer.from([0xff, 0xfe]), iconv.encode('test', 'utf16-le')])
    const decoder = createIncrementalTextDecoder(buffer.subarray(0, 4))
    const decoded = decoder.write(buffer) + decoder.end()

    expect(decoder.encoding).toBe('utf16-le')
    expect(decoded).toBe('test')
  })

  it('uses the existing charset fallback for non-UTF initial samples', () => {
    const text = 'Hello 你好'
    const buffer = iconv.encode(text, 'gbk')
    const decoder = createIncrementalTextDecoder(buffer)
    const decoded =
      decoder.write(buffer.subarray(0, 5)) + decoder.write(buffer.subarray(5)) + decoder.end()

    expect(decoded).toBe(text)
    expect(decoder.encoding).toBe('gbk')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/encoding.test.ts -t "createIncrementalTextDecoder"`

预期：FAIL，报错包含 `createIncrementalTextDecoder` 未导出。

- [ ] **步骤 3：编写最少实现代码**

在 `src/main/encoding.ts` 中把 `normalizeEncoding` 保持为内部函数，新增编码选择 helper 和增量 decoder：

```ts
function detectEncoding(buffer: Buffer): string {
  if (buffer.length === 0) return 'utf8'

  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'utf8'
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return 'utf16-le'
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return 'utf16-be'
  }

  const utf8Str = buffer.toString('utf8')
  if (!utf8Str.includes('\uFFFD')) {
    return 'utf8'
  }

  const detection = jschardet.detect(buffer)
  if (detection.encoding && detection.confidence >= 0.5) {
    return normalizeEncoding(detection.encoding) ?? 'gbk'
  }

  return 'gbk'
}

export interface IncrementalTextDecoder {
  readonly encoding: string
  write(buffer: Buffer): string
  end(): string
}

export function createIncrementalTextDecoder(initialSample: Buffer): IncrementalTextDecoder {
  const encoding = detectEncoding(initialSample)
  const decoder = iconv.getDecoder(encoding)

  return {
    encoding,
    write(buffer) {
      return decoder.write(buffer)
    },
    end() {
      return decoder.end() ?? ''
    }
  }
}
```

Update `smartDecode()` to call `detectEncoding(buffer)` after BOM/UTF-8 checks only by replacing the duplicated detection section with:

```ts
const encoding = detectEncoding(buffer)
```

and keep the existing try/catch decode fallback.

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/main/encoding.test.ts`

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/main/encoding.ts test/main/encoding.test.ts
git commit -m "feat: add incremental text decoder"
```

## 任务 2：替换 shared/preload API 契约

**文件：**

- 修改：`src/shared/types.ts`
- 修改：`src/shared/ipc-channels.ts`
- 修改：`src/shared/api.ts`
- 修改：`src/preload/index.ts`
- 修改：`test/renderer/helpers/create-winssh-api.ts`
- 修改：`test/preload/away-reminder-subscriptions.test.ts`

- [ ] **步骤 1：编写失败的类型契约测试**

在 `test/preload/away-reminder-subscriptions.test.ts` 中添加 import：

```ts
import type {
  SftpFileChunkEvent,
  SftpFileReadStreamStart,
  SftpFileStreamStateEvent,
  SftpFileWriteStreamStart
} from '@shared/types'
```

在文件末尾添加：

```ts
describe('SFTP file stream API contract', () => {
  it('exposes stream methods instead of whole-file editor methods', async () => {
    type SftpApi = WinsshApi['sftp']
    const _readStart: Awaited<ReturnType<SftpApi['openFileReadStream']>> =
      {} as SftpFileReadStreamStart
    const _writeStart: Awaited<ReturnType<SftpApi['openFileWriteStream']>> =
      {} as SftpFileWriteStreamStart
    const _chunk: Parameters<SftpApi['onFileChunk']>[0] = (_event: SftpFileChunkEvent) => {}
    const _state: Parameters<SftpApi['onFileStreamState']>[0] = (
      _event: SftpFileStreamStateEvent
    ) => {}

    const api = createWinsshApiMock()

    const sftpApiRecord = api.sftp as unknown as Record<string, unknown>
    expect(sftpApiRecord['readFile']).toBeUndefined()
    expect(sftpApiRecord['writeFile']).toBeUndefined()
    await expect(api.sftp.openFileReadStream('session-1', '/etc/hosts')).resolves.toMatchObject({
      encoding: 'utf8',
      remotePath: '/etc/hosts',
      sessionId: 'session-1',
      streamId: expect.any(String)
    })
    await expect(
      api.sftp.openFileWriteStream('session-1', '/etc/hosts', 'utf8')
    ).resolves.toMatchObject({
      remotePath: '/etc/hosts',
      sessionId: 'session-1',
      streamId: expect.any(String)
    })

    void _readStart
    void _writeStart
    void _chunk
    void _state
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/preload/away-reminder-subscriptions.test.ts -t "SFTP file stream API contract"`

预期：FAIL，原因是 stream 类型和 API 方法不存在，旧 mock 仍含 `readFile`/`writeFile`。

- [ ] **步骤 3：更新 shared 类型和事件**

在 `src/shared/types.ts` 的 `SftpListResult` 后添加：

```ts
export type SftpFileStreamDirection = 'upload' | 'download'
export type SftpFileStreamStatus = 'running' | 'completed' | 'error' | 'cancelled'

export interface SftpFileReadStreamStart {
  streamId: string
  sessionId: string
  remotePath: string
  fileName: string
  total: number
  encoding: string
}

export interface SftpFileWriteStreamStart {
  streamId: string
  sessionId: string
  remotePath: string
}

export interface SftpFileChunkEvent extends ObservableEventMetadata {
  streamId: string
  sessionId: string
  remotePath: string
  chunk: string
  transferred: number
  total: number
}

export interface SftpFileStreamStateEvent extends ObservableEventMetadata {
  streamId: string
  sessionId: string
  remotePath: string
  direction: SftpFileStreamDirection
  status: SftpFileStreamStatus
  transferred: number
  total: number
  error?: string
}
```

In `src/shared/ipc-channels.ts`, import `SftpFileChunkEvent` and `SftpFileStreamStateEvent`, then add:

```ts
  'sftp:fileChunk': SftpFileChunkEvent
  'sftp:fileStreamState': SftpFileStreamStateEvent
```

- [ ] **步骤 4：更新 `WinsshApi['sftp']` 契约**

在 `src/shared/api.ts` import 新类型，并将旧方法：

```ts
    readFile: (
      sessionId: string,
      remotePath: string
    ) => Promise<{ content: string; encoding: string; cancelled?: boolean }>
    cancelReadFile: (sessionId: string, remotePath: string) => void
    writeFile: (
      sessionId: string,
      remotePath: string,
      contents: string,
      encoding?: string
    ) => Promise<void>
```

替换为：

```ts
    openFileReadStream: (sessionId: string, remotePath: string) => Promise<SftpFileReadStreamStart>
    openFileWriteStream: (
      sessionId: string,
      remotePath: string,
      encoding: string
    ) => Promise<SftpFileWriteStreamStart>
    writeFileChunk: (streamId: string, chunk: string) => Promise<void>
    closeFileWriteStream: (streamId: string) => Promise<void>
    cancelFileStream: (streamId: string) => void
    onFileChunk: (callback: (event: SftpFileChunkEvent) => void) => Unsubscribe
    onFileStreamState: (callback: (event: SftpFileStreamStateEvent) => void) => Unsubscribe
```

- [ ] **步骤 5：更新 preload 映射**

在 `src/preload/index.ts` 的 `sftp` 对象中删除 `readFile`、`cancelReadFile`、`writeFile`，加入：

```ts
    openFileReadStream: (sessionId, remotePath) =>
      ipcRenderer.invoke('sftp:openFileReadStream', sessionId, remotePath),
    openFileWriteStream: (sessionId, remotePath, encoding) =>
      ipcRenderer.invoke('sftp:openFileWriteStream', sessionId, remotePath, encoding),
    writeFileChunk: (streamId, chunk) => ipcRenderer.invoke('sftp:writeFileChunk', streamId, chunk),
    closeFileWriteStream: (streamId) =>
      ipcRenderer.invoke('sftp:closeFileWriteStream', streamId),
    cancelFileStream: (streamId) => ipcRenderer.send('sftp:cancelFileStream', streamId),
    onFileChunk: (callback) => subscribe('sftp:fileChunk', callback),
    onFileStreamState: (callback) => subscribe('sftp:fileStreamState', callback),
```

- [ ] **步骤 6：更新 mock helper**

在 `test/renderer/helpers/create-winssh-api.ts` 的默认 `sftp` 中删除旧 `readFile`、`cancelReadFile`、`writeFile`，添加：

```ts
      openFileReadStream: async (sessionId, remotePath) => ({
        encoding: 'utf8',
        fileName: remotePath.split('/').at(-1) ?? remotePath,
        remotePath,
        sessionId,
        streamId: `read:${sessionId}:${remotePath}`,
        total: 0
      }),
      openFileWriteStream: async (sessionId, remotePath) => ({
        remotePath,
        sessionId,
        streamId: `write:${sessionId}:${remotePath}`
      }),
      writeFileChunk: async () => undefined,
      closeFileWriteStream: async () => undefined,
      cancelFileStream: () => undefined,
      onFileChunk: () => noopUnsubscribe,
      onFileStreamState: () => noopUnsubscribe,
```

- [ ] **步骤 7：运行测试验证通过**

运行：`npx vitest run test/preload/away-reminder-subscriptions.test.ts -t "SFTP file stream API contract"`

预期：PASS。

- [ ] **步骤 8：Commit**

```bash
git add src/shared/types.ts src/shared/ipc-channels.ts src/shared/api.ts src/preload/index.ts test/renderer/helpers/create-winssh-api.ts test/preload/away-reminder-subscriptions.test.ts
git commit -m "feat: define sftp file stream api"
```

## 任务 3：主进程 stream runtime

**文件：**

- 修改：`src/main/services/session-runtime.ts`
- 修改：`src/main/services/legacy-session-runtime.ts`
- 修改：`src/main/services/worker-session-runtime.ts`
- 修改：`src/main/application/sessions-application-service.ts`
- 修改：`src/main/ipc/register-session-ipc.ts`
- 修改：`src/main/session-manager.ts`
- 修改：`test/main/session-manager.test.ts`

- [ ] **步骤 1：编写失败的 read stream 测试**

在 `test/main/session-manager.test.ts` 的 imports 中加入新类型：

```ts
import type { SftpFileChunkEvent, SftpFileStreamStateEvent } from '@shared/types'
```

在 `describe('SessionManager port forwarding', () => {` 前添加一个新的 `describe`：

```ts
describe('SessionManager SFTP file streams', () => {
  function createManagerWithSftpEmitSpy() {
    const emitToRenderer = vi.fn()
    const manager = new SessionManager(
      {
        getKnownHost: vi.fn(),
        getServerById: vi.fn(),
        recordRecentSession: vi.fn(),
        upsertKnownHost: vi.fn(),
        getSettings: vi.fn(() => ({
          sftpUploadConcurrency: 3,
          sftpDownloadConcurrency: 3
        }))
      } as never,
      () => null,
      emitToRenderer as never,
      ((key: string) => key) as never
    )
    return { manager, emitToRenderer }
  }

  function createFileSftp(contents: Buffer) {
    const handle = Buffer.from('file-handle')
    return {
      close: vi.fn((_handle: Buffer, callback: (error?: Error) => void) => callback()),
      open: vi.fn(
        (
          _remotePath: string,
          _flags: string,
          callback: (error: Error | undefined, nextHandle: Buffer) => void
        ) => callback(undefined, handle)
      ),
      read: vi.fn(
        (
          _handle: Buffer,
          buffer: Buffer,
          offset: number,
          length: number,
          position: number,
          callback: (error: Error | undefined, bytesRead: number) => void
        ) => {
          const slice = contents.subarray(position, position + length)
          slice.copy(buffer, offset)
          callback(undefined, slice.byteLength)
        }
      ),
      stat: vi.fn(
        (_remotePath: string, callback: (error: Error | undefined, stats: unknown) => void) =>
          callback(undefined, {
            isDirectory: () => false,
            size: contents.byteLength
          })
      ),
      write: vi.fn(
        (
          _handle: Buffer,
          _buffer: Buffer,
          _offset: number,
          _length: number,
          _position: number,
          callback: (error?: Error) => void
        ) => callback()
      )
    }
  }

  it('streams remote file chunks before completion', async () => {
    const { manager, emitToRenderer } = createManagerWithSftpEmitSpy()
    const runtime = createRuntime('session-1', new MockClient())
    runtime.sftp = createFileSftp(Buffer.from('alpha\nbeta\n', 'utf8')) as never
    getSessionsMap(manager).set('session-1', runtime)

    const start = await manager.openFileReadStream('session-1', '/etc/app.conf')

    expect(start).toMatchObject({
      encoding: 'utf8',
      fileName: 'app.conf',
      remotePath: '/etc/app.conf',
      sessionId: 'session-1',
      total: 11
    })
    expect(start.streamId).toEqual(expect.any(String))

    await waitForFileStreamCompletion(emitToRenderer, start.streamId)

    const chunks = emitToRenderer.mock.calls
      .filter(([channel]) => channel === 'sftp:fileChunk')
      .map(([, payload]) => payload as SftpFileChunkEvent)
      .filter((event) => event.streamId === start.streamId)

    expect(chunks.map((event) => event.chunk).join('')).toBe('alpha\nbeta\n')
    expect(emitToRenderer).toHaveBeenCalledWith(
      'sftp:fileStreamState',
      expect.objectContaining({
        streamId: start.streamId,
        status: 'completed',
        transferred: 11,
        total: 11
      } satisfies Partial<SftpFileStreamStateEvent>)
    )
  })
})
```

在该测试文件靠近 helper 区域添加：

```ts
async function waitForFileStreamCompletion(
  emitToRenderer: ReturnType<typeof vi.fn>,
  streamId: string
) {
  await vi.waitFor(() => {
    expect(
      emitToRenderer.mock.calls.some(
        ([channel, payload]) =>
          channel === 'sftp:fileStreamState' &&
          (payload as SftpFileStreamStateEvent).streamId === streamId &&
          (payload as SftpFileStreamStateEvent).status === 'completed'
      )
    ).toBe(true)
  })
}
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/main/session-manager.test.ts -t "streams remote file chunks"`

预期：FAIL，原因是 `openFileReadStream` 不存在。

- [ ] **步骤 3：更新 runtime/application/ipc 类型骨架**

在 `src/main/services/session-runtime.ts` import 新类型：

```ts
  SftpFileReadStreamStart,
  SftpFileWriteStreamStart,
```

删除 `readFile`、`cancelReadFile`、`writeFile`，新增：

```ts
  openFileReadStream(sessionId: string, remotePath: string): Promise<SftpFileReadStreamStart>
  openFileWriteStream(
    sessionId: string,
    remotePath: string,
    encoding: string
  ): Promise<SftpFileWriteStreamStart>
  writeFileChunk(streamId: string, chunk: string): Promise<void>
  closeFileWriteStream(streamId: string): Promise<void>
  cancelFileStream(streamId: string): void
```

在 `src/main/services/legacy-session-runtime.ts` 删除旧委派，新增对应委派：

```ts
  openFileReadStream(sessionId: string, remotePath: string) {
    return this.sessionManager.openFileReadStream(sessionId, remotePath)
  }

  openFileWriteStream(sessionId: string, remotePath: string, encoding: string) {
    return this.sessionManager.openFileWriteStream(sessionId, remotePath, encoding)
  }

  writeFileChunk(streamId: string, chunk: string) {
    return this.sessionManager.writeFileChunk(streamId, chunk)
  }

  closeFileWriteStream(streamId: string) {
    return this.sessionManager.closeFileWriteStream(streamId)
  }

  cancelFileStream(streamId: string): void {
    this.sessionManager.cancelFileStream(streamId)
  }
```

在 `src/main/services/worker-session-runtime.ts` 删除 `SftpDispatcher`、旧 `readFileViaCoreWorker`、旧 `writeFileViaCoreWorker` 和构造函数中的 sftpDispatcher 初始化；`listDirectory()` 直接保留 worker core path：

```ts
  async listDirectory(sessionId: string, remotePath: string): Promise<SftpListResult> {
    return this.listDirectoryViaCoreWorker(sessionId, remotePath)
  }
```

新增 stream 委派：

```ts
  openFileReadStream(sessionId: string, remotePath: string) {
    return this.options.legacyRuntime.openFileReadStream(sessionId, remotePath)
  }

  openFileWriteStream(sessionId: string, remotePath: string, encoding: string) {
    return this.options.legacyRuntime.openFileWriteStream(sessionId, remotePath, encoding)
  }

  writeFileChunk(streamId: string, chunk: string) {
    return this.options.legacyRuntime.writeFileChunk(streamId, chunk)
  }

  closeFileWriteStream(streamId: string) {
    return this.options.legacyRuntime.closeFileWriteStream(streamId)
  }

  cancelFileStream(streamId: string): void {
    this.options.legacyRuntime.cancelFileStream(streamId)
  }
```

In `src/main/application/sessions-application-service.ts`, delete old methods and add:

```ts
  openFileReadStream(sessionId: string, remotePath: string) {
    return this.sessionRuntime.openFileReadStream(sessionId, remotePath)
  }

  openFileWriteStream(sessionId: string, remotePath: string, encoding: string) {
    return this.sessionRuntime.openFileWriteStream(sessionId, remotePath, encoding)
  }

  writeFileChunk(streamId: string, chunk: string) {
    return this.sessionRuntime.writeFileChunk(streamId, chunk)
  }

  closeFileWriteStream(streamId: string) {
    return this.sessionRuntime.closeFileWriteStream(streamId)
  }

  cancelFileStream(streamId: string): void {
    this.sessionRuntime.cancelFileStream(streamId)
  }
```

In `src/main/ipc/register-session-ipc.ts`, delete old handlers and add:

```ts
ipcMain.handle('sftp:openFileReadStream', (_event, sessionId: string, remotePath: string) =>
  service.openFileReadStream(sessionId, remotePath)
)
ipcMain.handle(
  'sftp:openFileWriteStream',
  (_event, sessionId: string, remotePath: string, encoding: string) =>
    service.openFileWriteStream(sessionId, remotePath, encoding)
)
ipcMain.handle('sftp:writeFileChunk', (_event, streamId: string, chunk: string) =>
  service.writeFileChunk(streamId, chunk)
)
ipcMain.handle('sftp:closeFileWriteStream', (_event, streamId: string) =>
  service.closeFileWriteStream(streamId)
)
ipcMain.on('sftp:cancelFileStream', (_event, streamId: string) =>
  service.cancelFileStream(streamId)
)
```

- [ ] **步骤 4：实现最少 read stream 代码**

在 `src/main/session-manager.ts` imports 中添加：

```ts
import { randomUUID } from 'node:crypto'
```

并改 encoding import：

```ts
import { createIncrementalTextDecoder, encodeContent } from './encoding'
```

新增类型：

```ts
interface EditorFileReadTask {
  kind: 'read'
  streamId: string
  sessionId: string
  remotePath: string
  fileName: string
  total: number
  transferred: number
  controller: AbortController
  handle?: Buffer
}

interface EditorFileWriteTask {
  kind: 'write'
  streamId: string
  sessionId: string
  remotePath: string
  fileName: string
  encoding: string
  transferred: number
  handle: Buffer
  sftp: SFTPWrapper
}
```

把 `editorReadControllers` 替换为：

```ts
  private readonly editorFileStreams = new Map<string, EditorFileReadTask | EditorFileWriteTask>()
```

新增方法：

```ts
  async openFileReadStream(sessionId: string, remotePath: string): Promise<SftpFileReadStreamStart> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const stats = await sftpStat(runtime.sftp, normalized)

    if (stats.isDirectory()) {
      throw new Error(`Remote path is a directory: ${normalized}`)
    }

    const total = stats.size ?? 0
    const streamId = `sftp-read:${sessionId}:${randomUUID()}`
    const fileName = path.posix.basename(normalized)
    const controller = new AbortController()
    const task: EditorFileReadTask = {
      kind: 'read',
      streamId,
      sessionId,
      remotePath: normalized,
      fileName,
      total,
      transferred: 0,
      controller
    }
    const handle = await sftpOpen(runtime.sftp, normalized, 'r')
    task.handle = handle
    const firstBuffer = Buffer.allocUnsafe(Math.min(32768, total || 32768))
    const firstBytesRead = await sftpRead(
      runtime.sftp,
      handle,
      firstBuffer,
      0,
      firstBuffer.byteLength,
      0
    )
    const initialSample = firstBuffer.subarray(0, Math.max(0, firstBytesRead))
    const decoder = createIncrementalTextDecoder(initialSample)
    this.editorFileStreams.set(streamId, task)

    void this.runFileReadStream(runtime.sftp, task, decoder, initialSample, firstBytesRead)

    return {
      streamId,
      sessionId,
      remotePath: normalized,
      fileName,
      total,
      encoding: decoder.encoding
    }
  }
```

Then add `runFileReadStream()` using `sftpRead`, `sftpClose`, the provided `IncrementalTextDecoder`, `emitToRenderer('sftp:fileChunk', ...)`, `emitToRenderer('sftp:fileStreamState', ...)`, and the existing `sftp:transfer` bridge. It must first emit `decoder.write(initialSample)` when `firstBytesRead > 0`, set `task.transferred = firstBytesRead`, then continue reading 32 KB chunks from `position = firstBytesRead`. On EOF, emit `decoder.end()` if it returns text, close the handle, emit completed state, and delete the stream task. This lets `openFileReadStream()` return the detected encoding without buffering the whole file.

Use this emit shape:

```ts
this.emitToRenderer(
  'sftp:fileChunk',
  this.withObservableMetadata(task.sessionId, {
    streamId: task.streamId,
    sessionId: task.sessionId,
    remotePath: task.remotePath,
    chunk: decoded,
    transferred: task.transferred,
    total: task.total
  })
)
```

And state shape:

```ts
this.emitToRenderer(
  'sftp:fileStreamState',
  this.withObservableMetadata(task.sessionId, {
    streamId: task.streamId,
    sessionId: task.sessionId,
    remotePath: task.remotePath,
    direction: 'download',
    status,
    transferred: task.transferred,
    total: task.total,
    ...(error ? { error } : {})
  })
)
```

Also emit equivalent `sftp:transfer` with `localPath: '__editor__'` for running/completed/error/cancelled statuses.

- [ ] **步骤 5：运行 read stream 测试验证通过**

运行：`npx vitest run test/main/session-manager.test.ts -t "streams remote file chunks"`

预期：PASS。

- [ ] **步骤 6：编写失败的 write/cancel 测试**

在同一个 describe 中添加：

```ts
it('writes acknowledged chunks incrementally and closes the remote handle', async () => {
  const { manager } = createManagerWithSftpEmitSpy()
  const runtime = createRuntime('session-1', new MockClient())
  const written: string[] = []
  const sftp = createFileSftp(Buffer.alloc(0))
  sftp.write.mockImplementation(
    (
      _handle: Buffer,
      buffer: Buffer,
      offset: number,
      length: number,
      _position: number,
      callback: (error?: Error) => void
    ) => {
      written.push(buffer.subarray(offset, offset + length).toString('utf8'))
      callback()
    }
  )
  runtime.sftp = sftp as never
  getSessionsMap(manager).set('session-1', runtime)

  const start = await manager.openFileWriteStream('session-1', '/etc/app.conf', 'utf8')
  await manager.writeFileChunk(start.streamId, 'alpha')
  await manager.writeFileChunk(start.streamId, '\nbeta')
  await manager.closeFileWriteStream(start.streamId)

  expect(written.join('')).toBe('alpha\nbeta')
  expect(sftp.close).toHaveBeenCalledOnce()
})

it('cancels file streams by stream id and closes the remote handle', async () => {
  const { manager } = createManagerWithSftpEmitSpy()
  const runtime = createRuntime('session-1', new MockClient())
  const sftp = createFileSftp(Buffer.alloc(0))
  runtime.sftp = sftp as never
  getSessionsMap(manager).set('session-1', runtime)

  const start = await manager.openFileWriteStream('session-1', '/etc/app.conf', 'utf8')
  manager.cancelFileStream(start.streamId)

  await expect(manager.writeFileChunk(start.streamId, 'late')).rejects.toThrow(
    /stream unavailable/i
  )
  expect(sftp.close).toHaveBeenCalledOnce()
})
```

- [ ] **步骤 7：运行 write/cancel 测试验证失败**

运行：`npx vitest run test/main/session-manager.test.ts -t "writes acknowledged|cancels file streams"`

预期：FAIL，原因是 write stream 方法不存在或未实现。

- [ ] **步骤 8：实现 write stream 和 cancel**

在 `SessionManager` 添加：

```ts
  async openFileWriteStream(
    sessionId: string,
    remotePath: string,
    encoding: string
  ): Promise<SftpFileWriteStreamStart> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const handle = await sftpOpen(runtime.sftp, normalized, 'w')
    const streamId = `sftp-write:${sessionId}:${randomUUID()}`
    this.editorFileStreams.set(streamId, {
      kind: 'write',
      streamId,
      sessionId,
      remotePath: normalized,
      fileName: path.posix.basename(normalized),
      encoding,
      transferred: 0,
      handle,
      sftp: runtime.sftp
    })
    return { streamId, sessionId, remotePath: normalized }
  }

  async writeFileChunk(streamId: string, chunk: string): Promise<void> {
    const task = this.requireWriteFileStream(streamId)
    const buffer = encodeContent(chunk, task.encoding)
    await sftpWrite(task.sftp, task.handle, buffer, 0, buffer.byteLength, task.transferred)
    task.transferred += buffer.byteLength
    this.emitFileStreamState(task, 'running')
  }

  async closeFileWriteStream(streamId: string): Promise<void> {
    const task = this.requireWriteFileStream(streamId)
    this.editorFileStreams.delete(streamId)
    await sftpClose(task.sftp, task.handle).catch(() => undefined)
    this.emitFileStreamState(task, 'completed')
  }

  cancelFileStream(streamId: string): void {
    const task = this.editorFileStreams.get(streamId)
    if (!task) return
    this.editorFileStreams.delete(streamId)
    if (task.kind === 'read') {
      task.controller.abort()
    } else {
      void sftpClose(task.sftp, task.handle).catch(() => undefined)
      this.emitFileStreamState(task, 'cancelled')
    }
  }
```

Add `requireWriteFileStream()` and share `emitFileStreamState()` for both task kinds.

- [ ] **步骤 9：运行主进程 stream 测试验证通过**

运行：`npx vitest run test/main/session-manager.test.ts -t "SFTP file streams"`

预期：PASS。

- [ ] **步骤 10：Commit**

```bash
git add src/main/services/session-runtime.ts src/main/services/legacy-session-runtime.ts src/main/services/worker-session-runtime.ts src/main/application/sessions-application-service.ts src/main/ipc/register-session-ipc.ts src/main/session-manager.ts test/main/session-manager.test.ts
git commit -m "feat: stream sftp file editor ipc in main"
```

## 任务 4：Renderer Monaco 编辑器迁移到 stream

**文件：**

- 修改：`src/renderer/src/features/shared/query-keys.ts`
- 修改：`src/renderer/src/components/workbench/workbench-sftp-file-monaco-editor.tsx`
- 修改：`test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx`

- [ ] **步骤 1：更新 Monaco test double 并编写失败的 stream load 测试**

在 `test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx` 的 `monacoModel` 添加：

```ts
  applyEdits: vi.fn(),
  getFullModelRange: vi.fn(() => ({ endColumn: 1, endLineNumber: 1, startColumn: 1, startLineNumber: 1 })),
  getLineCount: vi.fn(() => 1),
  getLineMaxColumn: vi.fn(() => 1),
  pushEditOperations: vi.fn()
```

在 beforeEach reset 中 reset 这些 mocks。

在 `vi.mock('monaco-editor/esm/vs/editor/editor.api.js', () => ({ ... }))` 的返回对象中添加：

```ts
  Range: class {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number
    ) {}
  },
```

添加 helper：

```ts
function createSftpStreamMock() {
  const chunkCallbacks = new Set<(event: SftpFileChunkEvent) => void>()
  const stateCallbacks = new Set<(event: SftpFileStreamStateEvent) => void>()
  return {
    api: {
      openFileReadStream: vi.fn(async () => ({
        encoding: 'utf8',
        fileName: 'nginx.conf',
        remotePath: '/etc/nginx/nginx.conf',
        sessionId: 'session-1',
        streamId: 'read-1',
        total: 11
      })),
      openFileWriteStream: vi.fn(async () => ({
        remotePath: '/etc/nginx/nginx.conf',
        sessionId: 'session-1',
        streamId: 'write-1'
      })),
      writeFileChunk: vi.fn(async () => undefined),
      closeFileWriteStream: vi.fn(async () => undefined),
      cancelFileStream: vi.fn(),
      onFileChunk: vi.fn((callback) => {
        chunkCallbacks.add(callback)
        return () => chunkCallbacks.delete(callback)
      }),
      onFileStreamState: vi.fn((callback) => {
        stateCallbacks.add(callback)
        return () => stateCallbacks.delete(callback)
      })
    },
    emitChunk(event: SftpFileChunkEvent) {
      chunkCallbacks.forEach((callback) => callback(event))
    },
    emitState(event: SftpFileStreamStateEvent) {
      stateCallbacks.forEach((callback) => callback(event))
    }
  }
}
```

Add test:

```ts
it('appends streamed chunks and marks the editor clean after completion', async () => {
  const stream = createSftpStreamMock()
  window.winsshApi = createWinsshApiMock({ sftp: stream.api })

  renderEditor()

  await waitFor(() => {
    expect(stream.api.openFileReadStream).toHaveBeenCalledWith('session-1', '/etc/nginx/nginx.conf')
  })

  act(() => {
    stream.emitChunk({
      chunk: 'user ',
      remotePath: '/etc/nginx/nginx.conf',
      sessionId: 'session-1',
      streamId: 'read-1',
      total: 11,
      transferred: 5
    })
    stream.emitChunk({
      chunk: 'nginx;',
      remotePath: '/etc/nginx/nginx.conf',
      sessionId: 'session-1',
      streamId: 'read-1',
      total: 11,
      transferred: 11
    })
    stream.emitState({
      direction: 'download',
      remotePath: '/etc/nginx/nginx.conf',
      sessionId: 'session-1',
      status: 'completed',
      streamId: 'read-1',
      total: 11,
      transferred: 11
    })
  })

  await waitFor(() => {
    expect(monacoModel.applyEdits).toHaveBeenCalled()
  })
  expect(screen.getByText('Saved')).toBeInTheDocument()
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx -t "appends streamed chunks"`

预期：FAIL，因为组件仍调用旧 `readFile`。

- [ ] **步骤 3：实现 stream load 生命周期**

在组件中删除 `fileQueryKey`/`fileQuery` 的内容查询，保留 settings/themes query。新增 state/ref：

```ts
const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
const activeReadStreamIdRef = useRef<string | null>(null)
const pendingChunksRef = useRef<string[]>([])
const loadedContentRef = useRef('')
```

新增 append helper：

```ts
function appendToModel(model: monaco.editor.ITextModel, text: string) {
  const lineCount = model.getLineCount()
  const endColumn = model.getLineMaxColumn(lineCount)
  model.applyEdits([
    {
      range: new monaco.Range(lineCount, endColumn, lineCount, endColumn),
      text
    }
  ])
}
```

Then add effect:

```ts
useEffect(() => {
  let cancelled = false
  setLoadState('loading')
  loadedContentRef.current = ''
  modelRef.current?.setValue('')

  void sftpClient
    .openFileReadStream(document.sessionId, document.remotePath)
    .then((start) => {
      if (cancelled) {
        sftpClient.cancelFileStream(start.streamId)
        return
      }
      activeReadStreamIdRef.current = start.streamId
      setFileEncoding(start.encoding)
    })
    .catch(() => setLoadState('error'))

  return () => {
    cancelled = true
    const streamId = activeReadStreamIdRef.current
    if (streamId) {
      sftpClient.cancelFileStream(streamId)
      activeReadStreamIdRef.current = null
    }
  }
}, [document.sessionId, document.remotePath])
```

Subscribe to chunks and states:

```ts
useEffect(() => {
  const unsubscribeChunk = sftpClient.onFileChunk((event) => {
    if (event.streamId !== activeReadStreamIdRef.current || !modelRef.current) return
    appendToModel(modelRef.current, event.chunk)
    loadedContentRef.current += event.chunk
    setEditorContent(loadedContentRef.current)
  })
  const unsubscribeState = sftpClient.onFileStreamState((event) => {
    if (event.streamId !== activeReadStreamIdRef.current) return
    if (event.status === 'completed') {
      setSavedContent(loadedContentRef.current)
      setEditorContent(loadedContentRef.current)
      setLoadState('ready')
      activeReadStreamIdRef.current = null
    }
    if (event.status === 'error' || event.status === 'cancelled') {
      setLoadState('error')
      activeReadStreamIdRef.current = null
    }
  })
  return () => {
    unsubscribeChunk()
    unsubscribeState()
  }
}, [])
```

Replace `fileQuery.isLoading` checks with `loadState === 'loading'`. Remove `queryClient.setQueryData(fileQueryKey, ...)`.

- [ ] **步骤 4：运行 stream load 测试验证通过**

运行：`npx vitest run test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx -t "appends streamed chunks"`

预期：PASS。

- [ ] **步骤 5：编写失败的 stale stream 和 save chunk 测试**

Add tests:

```ts
it('ignores chunks from stale read streams', async () => {
  const stream = createSftpStreamMock()
  window.winsshApi = createWinsshApiMock({ sftp: stream.api })

  renderEditor()
  await waitFor(() => expect(stream.api.openFileReadStream).toHaveBeenCalled())

  act(() => {
    stream.emitChunk({
      chunk: 'stale',
      remotePath: '/etc/nginx/nginx.conf',
      sessionId: 'session-1',
      streamId: 'old-read',
      total: 5,
      transferred: 5
    })
  })

  expect(monacoModel.applyEdits).not.toHaveBeenCalled()
})

it('saves editor content in bounded chunks and marks clean after close succeeds', async () => {
  const stream = createSftpStreamMock()
  window.winsshApi = createWinsshApiMock({ sftp: stream.api })
  monacoEditor.getValue.mockReturnValue('alpha\nbeta')

  renderEditor()
  await waitFor(() => expect(stream.api.openFileReadStream).toHaveBeenCalled())

  act(() => {
    stream.emitState({
      direction: 'download',
      remotePath: '/etc/nginx/nginx.conf',
      sessionId: 'session-1',
      status: 'completed',
      streamId: 'read-1',
      total: 0,
      transferred: 0
    })
  })

  const form = document.getElementById(
    'sftp-file-editor-form:sftp-file-editor:session-1:%2Fetc%2Fnginx%2Fnginx.conf'
  ) as HTMLFormElement
  fireEvent.submit(form)

  await waitFor(() => {
    expect(stream.api.openFileWriteStream).toHaveBeenCalledWith(
      'session-1',
      '/etc/nginx/nginx.conf',
      'utf8'
    )
    expect(stream.api.writeFileChunk).toHaveBeenCalledWith('write-1', 'alpha\nbeta')
    expect(stream.api.closeFileWriteStream).toHaveBeenCalledWith('write-1')
  })
})

it('keeps the editor dirty when streamed save fails', async () => {
  const stream = createSftpStreamMock()
  stream.api.writeFileChunk.mockRejectedValueOnce(new Error('remote write failed'))
  window.winsshApi = createWinsshApiMock({ sftp: stream.api })
  monacoEditor.getValue.mockReturnValue('alpha\nbeta')

  renderEditor()
  await waitFor(() => expect(stream.api.openFileReadStream).toHaveBeenCalled())

  act(() => {
    stream.emitState({
      direction: 'download',
      remotePath: '/etc/nginx/nginx.conf',
      sessionId: 'session-1',
      status: 'completed',
      streamId: 'read-1',
      total: 0,
      transferred: 0
    })
  })

  const form = document.getElementById(
    'sftp-file-editor-form:sftp-file-editor:session-1:%2Fetc%2Fnginx%2Fnginx.conf'
  ) as HTMLFormElement
  fireEvent.submit(form)

  await waitFor(() => {
    expect(stream.api.cancelFileStream).toHaveBeenCalledWith('write-1')
    expect(screen.getByText('Unsaved')).toBeInTheDocument()
  })
})
```

- [ ] **步骤 6：运行 stream save 测试验证失败**

运行：`npx vitest run test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx -t "bounded chunks|streamed save fails"`

预期：FAIL，因为保存仍调用旧 `writeFile`，没有调用 `openFileWriteStream` / `writeFileChunk` / `closeFileWriteStream`。

- [ ] **步骤 7：实现 stream save**

Add chunk helper near component:

```ts
const SFTP_FILE_SAVE_CHUNK_SIZE = 64 * 1024

function splitTextChunks(contents: string, chunkSize = SFTP_FILE_SAVE_CHUNK_SIZE) {
  const chunks: string[] = []
  for (let index = 0; index < contents.length; index += chunkSize) {
    chunks.push(contents.slice(index, index + chunkSize))
  }
  return chunks.length > 0 ? chunks : ['']
}
```

Replace save mutation with:

```ts
const saveMutation = useMutation({
  mutationFn: async ({ contents, encoding }: { contents: string; encoding: string }) => {
    const start = await sftpClient.openFileWriteStream(
      document.sessionId,
      document.remotePath,
      encoding
    )
    try {
      for (const chunk of splitTextChunks(contents)) {
        await sftpClient.writeFileChunk(start.streamId, chunk)
      }
      await sftpClient.closeFileWriteStream(start.streamId)
    } catch (error) {
      sftpClient.cancelFileStream(start.streamId)
      throw error
    }
  }
})
```

On success, keep `setSavedContent(nextContent)`, `setEditorContent(nextContent)`, and invalidate `['sftp', document.sessionId]`.

- [ ] **步骤 8：运行 renderer 编辑器测试验证通过**

运行：`npx vitest run test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx`

预期：PASS。

- [ ] **步骤 9：删除完整文件 query key**

In `src/renderer/src/features/shared/query-keys.ts`, delete:

```ts
  sftpFile: (sessionId: string, remotePath: string) =>
    ['sftp', sessionId, 'file', remotePath] as const,
```

Run:

```bash
rg -n "sftpFile|readFile|writeFile|cancelReadFile" src/renderer/src test/renderer
```

Expected remaining hits are unrelated Node/fs reads or none for `sftpClient.readFile`, `sftpClient.writeFile`, `sftpClient.cancelReadFile`.

- [ ] **步骤 10：Commit**

```bash
git add src/renderer/src/features/shared/query-keys.ts src/renderer/src/components/workbench/workbench-sftp-file-monaco-editor.tsx test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx
git commit -m "feat: stream sftp file editor in renderer"
```

## 任务 5：旧 API 清理和全量验证

**文件：**

- 修改：`src/main/services/sftp-dispatcher.ts`
- 修改：`src/main/workers/sftp/index.ts`
- 修改：`src/shared/ssh-protocol.ts`
- 修改：`test/main/services/sftp-dispatcher.test.ts`
- 修改：`test/main/workers/ssh-core/index.test.ts`
- 修改：`test/main/workers/ssh-core/session-worker.test.ts`
- 修改：`test/shared/ssh-protocol.test.ts`

- [ ] **步骤 1：搜索旧 API 残留**

运行：

```bash
rg -n "sftp:readFile|sftp:writeFile|cancelReadFile|readFile\\(|writeFile\\(|\\.readFile|\\.writeFile" src test
```

Allowed hits before cleanup are Node `fs.readFile` / `fs.writeFile` calls and worker protocol
references removed in steps 2-3.

- [ ] **步骤 2：删除整文件 SFTP dispatcher/worker 路径**

Delete `src/main/services/sftp-dispatcher.ts`, `src/main/workers/sftp/index.ts`, and
`test/main/services/sftp-dispatcher.test.ts`. These modules only support the old whole-file SFTP
editor worker path after task 3 removes `SftpDispatcher` from `WorkerSessionRuntime`.

```bash
rg -n "SftpDispatcher|workers/sftp|sftp-dispatcher" src test
```

Expected after deletion: no references.

- [ ] **步骤 3：remove old worker core SFTP read/write protocol**

In `src/shared/ssh-protocol.ts`, remove `sftp:readFile` and `sftp:writeFile` variants from `sshCoreInboundSchema`. Keep `sftp:listDirectory`, `sftp:createFile`, `sftp:makeDirectory`, `sftp:rename`, `sftp:remove`.

Update worker tests that asserted old read/write routing:

- `test/main/workers/ssh-core/index.test.ts`
- `test/main/workers/ssh-core/session-worker.test.ts`
- `test/shared/ssh-protocol.test.ts`

Remove tests whose only purpose was whole-file read/write. Keep list/create/rename/remove coverage.

- [ ] **步骤 4：运行 targeted cleanup tests**

Run:

```bash
npx vitest run test/main/services/worker-session-runtime.test.ts test/main/workers/ssh-core/index.test.ts test/main/workers/ssh-core/session-worker.test.ts test/shared/ssh-protocol.test.ts
```

预期：PASS。

- [ ] **步骤 5：运行关键链路测试**

Run:

```bash
npx vitest run test/main/encoding.test.ts test/main/session-manager.test.ts test/preload/away-reminder-subscriptions.test.ts test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx
```

预期：PASS。

- [ ] **步骤 6：运行 typecheck**

Run:

```bash
npm run typecheck
```

预期：exit 0。

- [ ] **步骤 7：运行全量测试**

Run:

```bash
npm run test
```

预期：exit 0。

- [ ] **步骤 8：Commit**

```bash
git add src test
git commit -m "refactor: remove whole-file sftp editor api"
```

## 自检

- 规格覆盖度：计划覆盖编码 helper、stream API、main runtime、IPC/preload、renderer Monaco、取消、错误、进度桥接、旧 API 删除和验证。
- 范围检查：计划只处理远程文本文件编辑链路，不引入二进制编辑、虚拟大文件编辑、数据库或 SFTP explorer upload/download 变更。
- 类型一致性：stream 方法统一使用 `openFileReadStream`、`openFileWriteStream`、`writeFileChunk`、`closeFileWriteStream`、`cancelFileStream`、`onFileChunk`、`onFileStreamState`；事件统一使用 `sftp:fileChunk` 和 `sftp:fileStreamState`。
- 执行注意：当前工作区可能已有未暂存的 `workbench-sftp-file-monaco-editor.tsx` 和对应测试改动。执行任务前先用 `git status --short` 确认这些改动归属，实施时不要回滚用户已有修改。
