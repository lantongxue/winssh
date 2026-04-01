# WinSSH 主题插件开发文档

## 1. 目标

WinSSH 的主题系统已经从固定枚举模式改成了插件式加载模型。

现在主题和 VS Code 的扩展主题类似，核心原则是：

1. 主题以“插件目录”存在。
2. 每个插件通过 `package.json` 暴露 `contributes.themes`。
3. 每个主题条目指向一个独立的主题 JSON 文件。
4. 主进程在启动时扫描主题插件目录，解析后通过 IPC 提供给渲染层。
5. 渲染层只消费标准化后的 `ThemeDefinition`，不再硬编码 `light`、`dark`、`pixel`。

当前内置主题也已经按同样结构落在仓库里，可直接作为开发参考：

- `themes/builtin/winssh-default-themes/package.json`
- `themes/builtin/winssh-default-themes/themes/light-plus.json`
- `themes/builtin/winssh-default-themes/themes/dark-plus.json`
- `themes/builtin/winssh-default-themes/themes/pixel-crt.json`

## 2. 运行时架构

主题加载链路如下：

1. 主进程 `ThemeRegistry` 扫描两个根目录：
   - 内置主题目录：`themes/builtin`
   - 用户主题目录：`app.getPath('userData')/themes`
2. 每个子目录被视为一个主题插件目录，必须包含 `package.json`。
3. `package.json` 中的 `contributes.themes[]` 声明主题列表。
4. 每个主题声明的 `path` 必须是插件目录内的相对路径。
5. 主进程读取主题 JSON，和内置基础色板合并，生成完整主题对象。
6. 渲染层通过 `window.winsshApi.themes.list()` 获取主题列表。
7. 应用设置中的 `theme` 字段现在存储的是：
   - `system`
   - 或某个插件主题的 `id`

## 3. 主题选择模型

WinSSH 现在区分两种概念：

- `system`
  - 这是一个特殊选择值，不是插件主题。
  - 当用户选择 `system` 时：
    - 浅色系统偏好映射到 `winssh.light-plus`
    - 深色系统偏好映射到 `winssh.dark-plus`
- 插件主题 ID
  - 例如：
    - `winssh.light-plus`
    - `winssh.dark-plus`
    - `winssh.pixel-crt`
    - `acme.nebula`

这意味着“系统主题”只是一个解析规则，而不是一个真正的主题文件。

## 4. 插件目录结构

一个最小可用主题插件目录如下：

```text
my-theme-pack/
  package.json
  themes/
    nebula.json
```

如果要让 WinSSH 识别用户主题，把整个目录放到用户主题根目录下。

用户主题根目录规则：

- 逻辑路径：`app.getPath('userData')/themes`
- Windows 上通常接近：`%APPDATA%/winssh/themes`
- 以 Electron 实际 `userData` 路径为准

最终结构通常类似：

```text
%APPDATA%/winssh/themes/
  my-theme-pack/
    package.json
    themes/
      nebula.json
```

修改或新增主题插件后，建议重启 WinSSH，让主进程重新扫描插件目录。

## 5. package.json 格式

主题插件的 `package.json` 至少需要这些字段：

```json
{
  "name": "nebula-themes",
  "displayName": "Nebula Themes",
  "publisher": "acme",
  "version": "1.0.0",
  "contributes": {
    "themes": [
      {
        "id": "acme.nebula",
        "label": "Nebula",
        "description": "A cool dark theme for WinSSH.",
        "uiTheme": "vs-dark",
        "path": "./themes/nebula.json"
      }
    ]
  }
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | 是 | 插件名，用于组成插件 ID |
| `displayName` | 否 | UI 友好名称，不填时退回 `name` |
| `publisher` | 是 | 发布者，用于组成插件 ID |
| `version` | 是 | 插件版本字符串 |
| `contributes.themes` | 是 | 主题贡献列表，至少 1 个 |
| `contributes.themes[].id` | 是 | 全局唯一主题 ID，建议 `publisher.theme-name` 风格 |
| `contributes.themes[].label` | 是 | 设置页和命令面板里显示的名称 |
| `contributes.themes[].description` | 否 | 主题说明 |
| `contributes.themes[].uiTheme` | 是 | `vs` 或 `vs-dark` |
| `contributes.themes[].path` | 是 | 相对插件目录的主题 JSON 路径 |

`uiTheme` 规则：

- `vs`
  - 主题被视为浅色主题
  - WinSSH 不会给根节点加 `.dark`
- `vs-dark`
  - 主题被视为深色主题
  - WinSSH 会给根节点加 `.dark`

## 6. 主题 JSON 格式

主题 JSON 当前支持 3 个顶层字段：

```json
{
  "colors": {
    "workbench-bg": "#101522",
    "workbench-active": "#73c2fb",
    "primary": "#73c2fb"
  },
  "terminal": {
    "cursor": "#73c2fb",
    "selectionBackground": "rgba(115, 194, 251, 0.22)"
  },
  "terminalDefaults": {
    "fontFamily": "Cascadia Mono, Consolas, monospace",
    "fontSize": 13,
    "lineHeight": 1.1
  }
}
```

规则：

- `colors`
  - 定义 WinSSH UI 的 CSS token 覆盖值
  - 只需要写你想覆盖的部分
  - 未提供的 token 会按 `uiTheme` 对应的基础主题自动补全
- `terminal`
  - 定义 xterm.js 调色板覆盖值
  - 未提供的键会从默认终端调色板补全
- `terminalDefaults`
  - 主题推荐的终端字体默认值
  - 只有在用户仍然使用应用默认终端字体族和字号时才会生效
  - 如果用户已在设置里自定义字体或字号，则仍以用户设置为准

## 7. UI 颜色 Token

### 7.1 基础界面 Token

| Token | 说明 |
| --- | --- |
| `background` | 应用主背景 |
| `foreground` | 主文本色 |
| `card` | 卡片背景 |
| `card-foreground` | 卡片文本 |
| `popover` | 浮层背景 |
| `popover-foreground` | 浮层文本 |
| `primary` | 主操作色 |
| `primary-foreground` | 主操作文本色 |
| `secondary` | 次级背景 |
| `secondary-foreground` | 次级文本色 |
| `muted` | 弱对比背景 |
| `muted-foreground` | 弱对比文本 |
| `accent` | 强调背景 |
| `accent-foreground` | 强调文本 |
| `destructive` | 危险操作色 |
| `destructive-foreground` | 危险操作文本色 |
| `border` | 默认边框色 |
| `input` | 输入框背景 |
| `ring` | 焦点高亮色 |
| `radius` | 默认圆角 |

### 7.2 Sidebar Token

| Token | 说明 |
| --- | --- |
| `sidebar` | 侧栏背景 |
| `sidebar-foreground` | 侧栏文本 |
| `sidebar-primary` | 侧栏主强调色 |
| `sidebar-primary-foreground` | 侧栏主强调文本 |
| `sidebar-accent` | 侧栏 hover/强调背景 |
| `sidebar-accent-foreground` | 侧栏强调文本 |
| `sidebar-border` | 侧栏边框 |
| `sidebar-ring` | 侧栏焦点色 |

### 7.3 Workbench Token

| Token | 说明 |
| --- | --- |
| `workbench-bg` | 整体 workbench 背景 |
| `workbench-titlebar` | 标题栏背景 |
| `workbench-activity-bar` | Activity Bar 背景 |
| `workbench-sidebar` | 主侧栏背景 |
| `workbench-tabs` | 标签栏背景 |
| `workbench-editor` | 编辑区背景 |
| `workbench-panel` | 底部面板背景 |
| `workbench-border` | workbench 通用边框 |
| `workbench-hover` | hover 背景 |
| `workbench-active` | 激活态强调色 |
| `workbench-statusbar` | 状态栏背景 |
| `workbench-statusbar-foreground` | 状态栏文本 |
| `workbench-muted` | workbench 弱化文本 |
| `workbench-input` | workbench 输入框背景 |

### 7.4 Toast Token

| Token | 说明 |
| --- | --- |
| `toast-info` | 信息类 toast 强调色 |
| `toast-success` | 成功 toast 强调色 |
| `toast-warning` | 警告 toast 强调色 |
| `toast-shadow` | toast 阴影 |
| `toast-highlight` | toast 内高光 |
| `toast-radius` | toast 圆角 |
| `toast-button-radius` | toast 按钮圆角 |
| `toast-backdrop-blur` | toast 背景模糊强度 |

### 7.5 终端表层与连接遮罩 Token

| Token | 说明 |
| --- | --- |
| `terminal-surface-bg` | 终端表层背景 |
| `terminal-overlay-backdrop` | 连接中/重连遮罩背景 |
| `terminal-overlay-panel` | 遮罩面板背景 |
| `terminal-overlay-border` | 遮罩边框 |
| `terminal-overlay-text` | 遮罩主文本 |
| `terminal-overlay-muted` | 遮罩弱文本 |
| `terminal-overlay-label` | 阶段标签文本 |
| `terminal-overlay-accent` | 遮罩强调文本 |
| `terminal-overlay-accent-strong` | 遮罩强强调色 |
| `terminal-overlay-accent-soft` | 遮罩柔和强调背景 |
| `terminal-overlay-progress` | 进度条颜色 |
| `terminal-overlay-step-border` | 阶段步骤边框 |
| `terminal-overlay-warning` | 警告色 |
| `terminal-overlay-warning-soft` | 警告背景 |
| `terminal-overlay-radius` | 终端遮罩圆角 |

### 7.6 扫描线 Token

| Token | 说明 |
| --- | --- |
| `terminal-scanline-opacity` | 终端扫描线透明度 |
| `terminal-scanline-color` | 扫描线颜色 |
| `terminal-scanline-size` | 扫描线间距 |

如果你不需要扫描线效果：

- `terminal-scanline-opacity` 设为 `0`
- `terminal-scanline-color` 可以保留透明色

## 8. 终端调色板 Token

`terminal` 字段支持的键如下：

| Token | 说明 |
| --- | --- |
| `background` | 终端背景色 |
| `foreground` | 终端前景色 |
| `cursor` | 光标颜色 |
| `selectionBackground` | 终端选区背景 |
| `black` | ANSI 黑 |
| `red` | ANSI 红 |
| `green` | ANSI 绿 |
| `yellow` | ANSI 黄 |
| `blue` | ANSI 蓝 |
| `magenta` | ANSI 洋红 |
| `cyan` | ANSI 青 |
| `white` | ANSI 白 |
| `brightBlack` | ANSI 亮黑 |
| `brightRed` | ANSI 亮红 |
| `brightGreen` | ANSI 亮绿 |
| `brightYellow` | ANSI 亮黄 |
| `brightBlue` | ANSI 亮蓝 |
| `brightMagenta` | ANSI 亮洋红 |
| `brightCyan` | ANSI 亮青 |
| `brightWhite` | ANSI 亮白 |

## 9. terminalDefaults 的行为

`terminalDefaults` 不是强制覆盖，而是“主题建议默认值”。

当前行为是：

1. 如果用户终端字体族仍然等于应用默认值
2. 且用户终端字号仍然等于应用默认值
3. 才会应用主题里的：
   - `fontFamily`
   - `fontSize`
   - `lineHeight`

一旦用户在设置页里手动改过字体族或字号，主题默认值会让位给用户设置。

这和当前内置 `Pixel CRT` 的行为一致。

## 10. 合并与回退规则

WinSSH 目前的合并规则如下：

1. 根据 `uiTheme` 选择基础色板：
   - `vs` 使用浅色基础主题
   - `vs-dark` 使用深色基础主题
2. 用主题 JSON 的 `colors` 覆盖基础色板
3. 用主题 JSON 的 `terminal` 覆盖默认终端调色板
4. 输出完整主题对象给渲染层

回退规则：

1. 如果设置里存着一个不存在的主题 ID，运行时会自动回退到 `system`
2. `system` 会解析到：
   - 浅色系统偏好 -> `winssh.light-plus`
   - 深色系统偏好 -> `winssh.dark-plus`
3. 如果插件里出现重复的主题 ID，当前实现保留最先加载到的那一个，后续重复项会被忽略
4. 如果主题 JSON 里写了未知 token，当前实现会忽略并输出主进程告警

## 11. 开发一个新主题的建议流程

### 11.1 先复制内置插件

最省事的方式是复制：

- `themes/builtin/winssh-default-themes`

然后改成你自己的：

- `publisher`
- `name`
- `displayName`
- 主题 `id`
- `label`
- `path`

### 11.2 先从少量 token 开始

建议先只覆盖这些键，快速建立主视觉：

- `background`
- `foreground`
- `primary`
- `workbench-bg`
- `workbench-sidebar`
- `workbench-editor`
- `workbench-border`
- `workbench-active`
- `terminal-surface-bg`
- `terminal.background`
- `terminal.foreground`
- `terminal.cursor`

等主题气质稳定后，再继续补 overlay、toast、扫描线等细节。

### 11.3 先决定它是浅色还是深色

因为 `uiTheme` 会影响：

- 根节点是否带 `.dark`
- 默认基础色板
- 整体可读性预期

如果主题本质是深色，请直接使用 `vs-dark`，不要用 `vs` 再硬把颜色改成深色。

## 12. 最小可运行示例

### `package.json`

```json
{
  "name": "nebula-themes",
  "displayName": "Nebula Themes",
  "publisher": "acme",
  "version": "1.0.0",
  "contributes": {
    "themes": [
      {
        "id": "acme.nebula",
        "label": "Nebula",
        "description": "A blue-black theme for WinSSH.",
        "uiTheme": "vs-dark",
        "path": "./themes/nebula.json"
      }
    ]
  }
}
```

### `themes/nebula.json`

```json
{
  "colors": {
    "background": "#0c1220",
    "foreground": "#d9e7ff",
    "primary": "#73c2fb",
    "primary-foreground": "#07111d",
    "border": "#1b2940",
    "workbench-bg": "#0c1220",
    "workbench-sidebar": "#11192c",
    "workbench-editor": "#0c1220",
    "workbench-panel": "#0a101b",
    "workbench-border": "#1b2940",
    "workbench-active": "#73c2fb",
    "workbench-statusbar": "#11233b",
    "workbench-statusbar-foreground": "#d9e7ff",
    "terminal-surface-bg": "#070c16",
    "terminal-overlay-panel": "rgba(9, 14, 24, 0.96)",
    "terminal-overlay-accent": "#9dd9ff",
    "terminal-overlay-accent-strong": "#73c2fb"
  },
  "terminal": {
    "background": "#070c16",
    "foreground": "#d9e7ff",
    "cursor": "#73c2fb",
    "selectionBackground": "rgba(115, 194, 251, 0.2)",
    "blue": "#73c2fb",
    "brightBlue": "#a7dbff"
  }
}
```

## 13. 常见问题

### 13.1 为什么主题没显示在设置页里？

检查这几项：

1. 插件目录是不是放在 `userData/themes/<plugin-folder>` 下
2. `package.json` 是否存在
3. `contributes.themes[].path` 是否写成了相对路径
4. 主题 `id` 是否和其它插件重复
5. 修改后是否已重启 WinSSH

### 13.2 为什么某个颜色不生效？

通常是这几类问题：

1. token 名写错了
2. 写成了不存在的 token，主进程会忽略
3. 你改的是 UI token，但实际受影响的是终端 token
4. 你期待的是扫描线效果，但没有设置：
   - `terminal-scanline-opacity`
   - `terminal-scanline-color`

### 13.3 为什么 terminalDefaults 没生效？

因为用户可能已经在设置里手动改过终端字体或字号。

当前逻辑下，只在“用户仍使用应用默认终端字体族和字号”时应用主题推荐值。

## 14. 内置主题 ID 约定

当前内置主题 ID：

- `winssh.light-plus`
- `winssh.dark-plus`
- `winssh.pixel-crt`

建议第三方主题遵循类似格式：

- `publisher.theme-name`
- `publisher.theme-pack.variant`

不要使用过于泛化的 ID，例如：

- `dark`
- `light`
- `blue`

因为这些名字非常容易和其它插件冲突。

## 15. 最后的建议

如果你是第一次开发 WinSSH 主题，最好的起点不是从零写，而是：

1. 复制 `themes/builtin/winssh-default-themes`
2. 先只改一个主题文件
3. 先把 workbench 和 terminal 主色调跑通
4. 再细修 overlay、toast、扫描线和圆角

这样最容易快速得到一个完整可用的主题插件。
