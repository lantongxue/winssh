# 临时字体缩放实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 为终端页面和 SFTP 文件编辑器页面添加 Ctrl/Cmd + 鼠标滚轮的当前页临时字体缩放。

**架构：** 新增一个纯工具模块负责字号范围、滚轮方向和偏移计算。`TerminalSurface` 为每个终端页面保存临时偏移并将覆盖字号传给 `useTerminal`；`WorkbenchSftpFileMonacoEditor` 为每个文件编辑器实例保存临时偏移并更新 Monaco `fontSize`。

**技术栈：** React 19、TypeScript、Vitest、Testing Library、xterm.js、Monaco Editor、React Query。

---

## 文件结构

- 创建：`src/renderer/src/lib/font-zoom.ts`，集中维护临时字体缩放常量与纯函数。
- 创建：`test/renderer/lib/font-zoom.test.ts`，覆盖纯函数行为。
- 修改：`src/renderer/src/hooks/use-terminal.ts`，接受可选临时字号覆盖。
- 修改：`src/renderer/src/components/terminal-surface.tsx`，捕获 Ctrl/Cmd + wheel 并维护当前终端页面临时偏移。
- 修改：`test/renderer/components/terminal-pane.test.tsx`，验证终端页临时缩放。
- 修改：`src/renderer/src/components/workbench/workbench-sftp-file-monaco-editor.tsx`，捕获 Ctrl/Cmd + wheel 并维护当前编辑器临时偏移。
- 修改：`test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx`，验证 Monaco 编辑器临时缩放。

## 任务 1：字体缩放纯函数

**文件：**
- 创建：`src/renderer/src/lib/font-zoom.ts`
- 创建：`test/renderer/lib/font-zoom.test.ts`

- [ ] **步骤 1：编写失败的测试**

```ts
import {
  clampFontZoomSize,
  getWheelFontZoomDelta,
  resolveTemporaryFontSize
} from '@/lib/font-zoom'

describe('font zoom helpers', () => {
  it('clamps temporary font sizes to the supported range', () => {
    expect(clampFontZoomSize(4)).toBe(10)
    expect(clampFontZoomSize(18)).toBe(18)
    expect(clampFontZoomSize(40)).toBe(24)
  })

  it('maps wheel direction to one point zoom steps', () => {
    expect(getWheelFontZoomDelta({ deltaY: -120 })).toBe(1)
    expect(getWheelFontZoomDelta({ deltaY: 120 })).toBe(-1)
    expect(getWheelFontZoomDelta({ deltaY: 0 })).toBe(0)
  })

  it('resolves temporary offset against the current base size', () => {
    expect(resolveTemporaryFontSize(14, 2)).toBe(16)
    expect(resolveTemporaryFontSize(23, 4)).toBe(24)
    expect(resolveTemporaryFontSize(11, -4)).toBe(10)
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/renderer/lib/font-zoom.test.ts`
预期：FAIL，原因是 `@/lib/font-zoom` 不存在。

- [ ] **步骤 3：编写最少实现代码**

```ts
export const FONT_ZOOM_MIN_SIZE = 10
export const FONT_ZOOM_MAX_SIZE = 24

export function clampFontZoomSize(size: number) {
  return Math.max(FONT_ZOOM_MIN_SIZE, Math.min(FONT_ZOOM_MAX_SIZE, size))
}

export function getWheelFontZoomDelta(event: Pick<WheelEvent, 'deltaY'>) {
  if (event.deltaY < 0) return 1
  if (event.deltaY > 0) return -1
  return 0
}

export function resolveTemporaryFontSize(baseSize: number, offset: number) {
  return clampFontZoomSize(baseSize + offset)
}
```

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/renderer/lib/font-zoom.test.ts`
预期：PASS。

## 任务 2：终端页面临时缩放

**文件：**
- 修改：`src/renderer/src/hooks/use-terminal.ts`
- 修改：`src/renderer/src/components/terminal-surface.tsx`
- 修改：`test/renderer/components/terminal-pane.test.tsx`

- [ ] **步骤 1：编写失败的测试**

在 `test/renderer/components/terminal-pane.test.tsx` 增加测试：

```ts
it('temporarily zooms only the active terminal surface with ctrl wheel', () => {
  const readySession: SessionTab = {
    ...session,
    connectionPhase: 'attach',
    status: 'ready'
  }

  const { container } = render(
    <TerminalPane
      session={readySession}
      settings={settings}
      theme={theme}
      onReconnect={async () => undefined}
    />
  )

  const surface = container.querySelector('.terminal-surface') as HTMLElement
  fireEvent.wheel(surface, { ctrlKey: true, deltaY: -120 })

  expect(useTerminalMock).toHaveBeenLastCalledWith(
    expect.anything(),
    settings,
    theme,
    true,
    expect.any(Function),
    expect.any(Function),
    true,
    expect.stringMatching(/^ready:session-1:/),
    15
  )
  expect(window.winsshApi.settings.update).not.toHaveBeenCalled()
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/renderer/components/terminal-pane.test.tsx -t "temporarily zooms"`
预期：FAIL，因为 `useTerminal` 还没有临时字号参数。

- [ ] **步骤 3：编写最少实现代码**

在 `useTerminal` 参数末尾增加 `fontSizeOverride?: number`，并在计算 terminal options 时优先使用它：

```ts
fontSize: fontSizeOverride ?? terminalAppearance.fontSize
```

在 `TerminalSurface` 中：

```ts
const [fontZoomOffset, setFontZoomOffset] = useState(0)
const baseFontSize = resolveTerminalAppearance(settings, theme).fontSize
const temporaryFontSize = resolveTemporaryFontSize(baseFontSize, fontZoomOffset)

const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
  if (!(event.ctrlKey || event.metaKey)) return
  event.preventDefault()
  event.stopPropagation()
  const delta = getWheelFontZoomDelta(event)
  if (delta === 0) return
  setFontZoomOffset((current) => temporaryFontSize - baseFontSize + delta)
}
```

并将 `temporaryFontSize` 传给 `useTerminal`。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/renderer/components/terminal-pane.test.tsx -t "temporarily zooms"`
预期：PASS。

## 任务 3：SFTP 文件编辑器临时缩放

**文件：**
- 修改：`src/renderer/src/components/workbench/workbench-sftp-file-monaco-editor.tsx`
- 修改：`test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx`

- [ ] **步骤 1：编写失败的测试**

在 `test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx` 增加测试：

```ts
it('temporarily zooms only the current Monaco editor with ctrl wheel', async () => {
  const updateSettings = vi.fn()
  window.winsshApi = createWinsshApiMock({
    settings: {
      update: updateSettings
    },
    sftp: {
      readFile: vi.fn().mockResolvedValue({ content: 'user nginx;', encoding: 'utf8' })
    }
  })

  const { container } = renderEditor()

  await waitFor(() => {
    expect(monaco.editor.create).toHaveBeenCalled()
  })

  fireEvent.wheel(container.querySelector('[data-sftp-editor-surface]') as HTMLElement, {
    ctrlKey: true,
    deltaY: -120
  })

  expect(monacoEditor.updateOptions).toHaveBeenLastCalledWith(
    expect.objectContaining({ fontSize: 15 })
  )
  expect(updateSettings).not.toHaveBeenCalled()
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npx vitest run test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx -t "temporarily zooms"`
预期：FAIL，因为组件还没有缩放 surface 和 wheel 处理。

- [ ] **步骤 3：编写最少实现代码**

在 Monaco 编辑器组件中新增本地 offset：

```ts
const [fontZoomOffset, setFontZoomOffset] = useState(0)
const temporaryFontSize = resolveTemporaryFontSize(
  terminalAppearance.fontSize,
  fontZoomOffset
)
```

创建编辑器和更新 options 时使用 `temporaryFontSize`。在编辑器容器上添加 `data-sftp-editor-surface` 和 `onWheel`，Ctrl/Cmd + wheel 更新 offset 并阻止默认行为。

- [ ] **步骤 4：运行测试验证通过**

运行：`npx vitest run test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx -t "temporarily zooms"`
预期：PASS。

## 任务 4：集成验证

**文件：**
- 无新增文件，验证前面所有改动。

- [ ] **步骤 1：运行相关测试**

运行：

```bash
npx vitest run test/renderer/lib/font-zoom.test.ts test/renderer/components/terminal-pane.test.tsx test/renderer/components/workbench/workbench-sftp-file-monaco-editor.test.tsx
```

预期：PASS。

- [ ] **步骤 2：运行类型检查**

运行：`npm run typecheck`
预期：exit 0。
