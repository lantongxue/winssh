# WinSSH 主题开发文档

## 1. 文档范围

本文档基于当前仓库代码整理，覆盖的是 WinSSH 现阶段已经实现的主题系统，而不是未来规划。

当前主题系统的核心事实是：

1. 主题已经不是固定枚举，而是插件式加载。
2. 主题选择值存的是主题 id，或者特殊值 `system`。
3. 主进程负责扫描、校验、合并和回退。
4. 渲染层只消费标准化后的 `ThemeDefinition`。

当前内置主题可直接作为参考：

- `themes/builtin/winssh-default-themes/package.json`
- `themes/builtin/winssh-default-themes/themes/light-plus.json`
- `themes/builtin/winssh-default-themes/themes/dark-plus.json`
- `themes/builtin/winssh-default-themes/themes/pixel-crt.json`

## 2. 当前主题系统概览

主题的加载和应用链路如下：

1. 主进程 `ThemeRegistry` 扫描两个主题根目录：
   - 内置主题目录：`themes/builtin`
   - 用户主题目录：`app.getPath('userData')/themes`
2. 每个子目录都被视为一个主题插件目录。
3. 插件目录中的 `package.json` 通过 `contributes.themes[]` 声明主题。
4. 每个主题条目的 `path` 指向一个主题 JSON 文件。
5. 主进程读取主题 JSON，并基于浅色或深色基础主题生成完整的 `ThemeDefinition`。
6. 渲染层通过 `window.winsshApi.themes.list()` 获取主题列表。
7. `App.tsx` 调用 `applyThemeToRoot()`，把主题 token 写入 `document.documentElement`。

应用设置里的 `theme` 字段现在存的是：

- `system`
- 或任意一个有效主题 id，例如：
  - `winssh.light-plus`
  - `winssh.dark-plus`
  - `winssh.pixel-crt`
  - `acme.nebula`

## 3. 主题选择与解析规则

WinSSH 当前区分“主题选择值”和“实际解析后的主题”。

### 3.1 `system` 不是一个主题文件

`system` 是特殊选择值，不对应任何插件主题文件。

当用户选择 `system` 时：

- 系统偏好为浅色：解析到 `winssh.light-plus`
- 系统偏好为深色：解析到 `winssh.dark-plus`

### 3.2 `uiTheme` 决定外观基线

主题贡献项中的 `uiTheme` 当前只支持：

- `vs`
- `vs-dark`

它会决定：

- 主题的 `appearance`
- 使用浅色还是深色基础 token
- 根节点是否带 `.dark`
- `color-scheme` 的值

### 3.3 无效选择会被归一化

如果设置里存着一个不存在的主题 id，主进程会把它归一化回 `system`。

## 4. 插件目录结构

一个最小可用的主题插件目录如下：

```text
my-theme-pack/
  package.json
  themes/
    nebula.json
```

用户主题需要放到用户主题根目录下。典型结构如下：

```text
%APPDATA%/winssh/themes/
  my-theme-pack/
    package.json
    themes/
      nebula.json
```

注意：

- 实际目录以 Electron 的 `app.getPath('userData')` 为准。
- 当前实现没有主题热重载入口。新增、修改或替换用户主题后，建议重启 WinSSH。

## 5. `package.json` 格式

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
        "description": "A blue-black theme for WinSSH.",
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
| `name` | 是 | 插件名 |
| `displayName` | 否 | 插件显示名，不填时回退到 `name` |
| `publisher` | 是 | 发布者名 |
| `version` | 是 | 插件版本 |
| `contributes.themes` | 是 | 主题列表，至少 1 项 |
| `contributes.themes[].id` | 是 | 主题全局唯一 id |
| `contributes.themes[].label` | 是 | 设置页和命令中心中显示的主题名 |
| `contributes.themes[].description` | 否 | 主题说明 |
| `contributes.themes[].uiTheme` | 是 | `vs` 或 `vs-dark` |
| `contributes.themes[].path` | 是 | 相对插件目录的主题 JSON 路径 |

运行时还会基于 manifest 派生出：

- `pluginId = ${publisher}.${name}`
- `pluginDisplayName = displayName ?? name`

额外字段目前不会被主题运行时使用。例如内置主题包里的 `engines` 字段不会参与主题解析。

## 6. 主题 JSON 格式

主题 JSON 当前只消费 3 个顶层字段：

```json
{
  "colors": {
    "workbench-bg": "#0c1220",
    "workbench-active": "#73c2fb",
    "workbench-logo": "#73c2fb"
  },
  "terminal": {
    "background": "#070c16",
    "cursor": "#73c2fb",
    "selectionBackground": "rgba(115, 194, 251, 0.2)"
  },
  "terminalDefaults": {
    "fontFamily": "Cascadia Mono, Consolas, monospace",
    "fontSize": 13,
    "lineHeight": 1.1
  }
}
```

规则如下：

- `colors`
  - UI token 覆盖集合
  - 值是字符串，可以是 hex、rgb、rgba、长度值等
  - 未提供的键会从浅色或深色基础主题补全
- `terminal`
  - xterm.js 调色板覆盖集合
  - 未提供的键会从默认终端调色板补全
- `terminalDefaults`
  - 主题建议的终端默认字体配置
  - `fontSize` 当前限制为 `10` 到 `24`
  - `lineHeight` 当前限制为 `1` 到 `2`

未知顶层字段不会成为主题定义的一部分。`colors` 和 `terminal` 中的未知 token 会被忽略，并在主进程输出告警。

## 7. UI Token 清单

`colors` 当前可用的 token 与 `THEME_COLOR_KEYS` 完全一致。

这些 token 在渲染层会被写成 CSS 变量，形式是：

```css
--background
--workbench-bg
--terminal-overlay-panel
```

### 7.1 基础界面 Token

| Token | 说明 |
| --- | --- |
| `background` | 应用主背景 |
| `foreground` | 应用主文本色 |
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
| `destructive` | 危险色 |
| `destructive-foreground` | 危险文本色 |
| `border` | 默认边框色 |
| `input` | 输入框背景 |
| `ring` | 焦点高亮色 |
| `radius` | 默认圆角值 |

### 7.2 Sidebar Token

| Token | 说明 |
| --- | --- |
| `sidebar` | 主侧栏背景 |
| `sidebar-foreground` | 主侧栏文本 |
| `sidebar-primary` | 主侧栏强调色 |
| `sidebar-primary-foreground` | 主侧栏强调文本 |
| `sidebar-accent` | 主侧栏 hover/强调背景 |
| `sidebar-accent-foreground` | 主侧栏强调文本 |
| `sidebar-border` | 主侧栏边框 |
| `sidebar-ring` | 主侧栏焦点色 |

### 7.3 Workbench Token

| Token | 说明 |
| --- | --- |
| `workbench-bg` | 整体 workbench 背景 |
| `workbench-titlebar` | 标题栏背景 |
| `workbench-activity-bar` | Activity Bar 背景 |
| `workbench-sidebar` | Explorer / Settings 侧栏背景 |
| `workbench-tabs` | 编辑器标签栏背景 |
| `workbench-editor` | 编辑区背景 |
| `workbench-panel` | 底部面板背景 |
| `workbench-border` | workbench 通用边框 |
| `workbench-hover` | hover 背景 |
| `workbench-active` | 激活态强调色 |
| `workbench-logo` | 标题栏 logo 主色 |
| `workbench-statusbar` | 状态栏背景 |
| `workbench-statusbar-foreground` | 状态栏文本 |
| `workbench-muted` | workbench 弱化文本 |
| `workbench-input` | workbench 输入框背景 |

### 7.4 Toast Token

| Token | 说明 |
| --- | --- |
| `toast-info` | 信息 toast 强调色 |
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
| `terminal-surface-bg` | 终端容器表层背景 |
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
| `terminal-overlay-step-border` | 步骤边框 |
| `terminal-overlay-warning` | 警告色 |
| `terminal-overlay-warning-soft` | 警告背景 |
| `terminal-overlay-radius` | 遮罩圆角 |

### 7.6 扫描线 Token

| Token | 说明 |
| --- | --- |
| `terminal-scanline-opacity` | 终端扫描线透明度 |
| `terminal-scanline-color` | 扫描线颜色 |
| `terminal-scanline-size` | 扫描线间距 |

如果不需要扫描线效果，最直接的做法是：

- `terminal-scanline-opacity: "0"`
- `terminal-scanline-color: "rgba(255, 255, 255, 0)"`

## 8. 终端调色板 Token

`terminal` 字段当前支持的键与 `TERMINAL_COLOR_KEYS` 完全一致：

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

## 9. 合并、回退与优先级规则

当前主题定义的生成方式是：

1. 根据 `uiTheme` 解析出 `appearance`
2. 根据 `appearance` 选择基础 UI token：
   - `vs` -> 浅色基础主题
   - `vs-dark` -> 深色基础主题
3. 用主题 JSON 的 `colors` 覆盖基础 UI token
4. 用主题 JSON 的 `terminal` 覆盖默认终端调色板
5. 产出完整 `ThemeDefinition`

回退与容错规则如下：

1. 如果主题 id 不存在，设置值会被归一化到 `system`
2. `system` 最终解析到 `winssh.light-plus` 或 `winssh.dark-plus`
3. 如果完全没有可加载主题，运行时会生成一个内置 fallback theme
4. 如果某个主题文件不存在、manifest 非法或 theme document 非法，该主题会被忽略
5. 如果 `colors` 或 `terminal` 中出现未知 token，该 token 会被忽略并输出主进程告警
6. 如果 `contributes.themes[].path` 试图跳出插件目录，该主题会被忽略

### 9.1 重复主题 id 的优先级

当前加载顺序是：

1. 内置主题根目录
2. 用户主题根目录

重复主题 id 的处理规则是“保留第一次加载到的定义”。

这意味着：

- 内置主题和用户主题如果使用同一个 id，内置主题会赢
- 用户主题目前不能通过复用同 id 的方式覆盖内置主题

## 10. 渲染层应用细节

主题应用到根节点时，当前会做这些事：

- 根据 `appearance` 切换 `.dark`
- 设置 `data-theme`
- 设置 `data-theme-appearance`
- 设置 `data-theme-selection`
- 设置 `color-scheme`
- 把全部 `colors` token 写入 CSS 变量

实际对应的数据属性名为：

- `data-theme`
- `data-theme-appearance`
- `data-theme-selection`

如果你是在 JS 里读取，则对应的 `dataset` key 是：

- `dataset.theme`
- `dataset.themeAppearance`
- `dataset.themeSelection`

如果你在自定义样式里需要根据当前主题状态做额外判断，可以直接读取这些属性。

## 11. `terminalDefaults` 的真实行为

`terminalDefaults` 不是强制覆盖，而是“主题建议默认值”。

当前只有在下面两个条件同时满足时，主题默认终端配置才会生效：

1. 用户终端字体族仍然等于应用默认值
2. 用户终端字号仍然等于应用默认值

当前应用默认值来自 `DEFAULT_APP_SETTINGS`：

- `terminalFontFamily = "JetBrains Mono, Consolas, monospace"`
- `terminalFontSize = 14`

满足条件时，会使用：

- `terminalDefaults.fontFamily`
- `terminalDefaults.fontSize`
- `terminalDefaults.lineHeight`

不满足条件时：

- 字体族使用用户设置
- 字号使用用户设置
- 行高回到默认 `1.2`

这也是为什么 `Pixel CRT` 这类主题只有在用户没改过终端字体和字号时，才会完全呈现其推荐终端风格。

## 12. 开发新主题的建议流程

### 12.1 先复制内置主题插件

最省事的起点是直接复制：

- `themes/builtin/winssh-default-themes`

然后改成你自己的：

- `publisher`
- `name`
- `displayName`
- 主题 `id`
- 主题 `label`
- 主题文件路径

### 12.2 先决定浅色还是深色

`uiTheme` 会影响基础色板和整体可读性预期。

如果主题本质是深色，请直接用 `vs-dark`，不要先选 `vs` 再手工把所有背景改黑。

### 12.3 先只覆盖少量关键 token

建议先覆盖这些键，快速跑通主视觉：

- `background`
- `foreground`
- `primary`
- `workbench-bg`
- `workbench-sidebar`
- `workbench-editor`
- `workbench-border`
- `workbench-active`
- `workbench-logo`
- `terminal-surface-bg`
- `terminal.background`
- `terminal.foreground`
- `terminal.cursor`

主题气质稳定后，再继续补：

- toast
- overlay
- status bar
- scanline
- `terminalDefaults`

## 13. 最小示例

### 13.1 `package.json`

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

### 13.2 `themes/nebula.json`

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
    "workbench-logo": "#73c2fb",
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
  },
  "terminalDefaults": {
    "fontFamily": "Cascadia Mono, Consolas, monospace",
    "fontSize": 13,
    "lineHeight": 1.1
  }
}
```

## 14. 常见问题

### 14.1 为什么主题没有出现在设置页或命令中心里？

优先检查：

1. 目录是否在 `app.getPath('userData')/themes/<plugin-folder>` 下
2. 插件目录下是否存在 `package.json`
3. `contributes.themes[].path` 是否是相对插件目录的路径
4. 主题 `id` 是否与已有主题重复
5. 修改后是否已重启 WinSSH

### 14.2 为什么某个颜色看起来没有生效？

常见原因：

1. token 名拼错了
2. 你改的是 UI token，但实际受影响的是终端 token
3. 你写了未知 token，运行时把它忽略了
4. 你期待的是 logo、overlay 或 scanline 的变化，但只改了主背景

### 14.3 为什么 `terminalDefaults` 没生效？

因为用户可能已经在设置页手动改过：

- 终端字体族
- 终端字号

当前逻辑下，只在这两项仍保持默认值时，主题推荐值才会生效。

### 14.4 为什么用户主题无法覆盖内置主题？

因为当前重复 id 的处理规则是“先加载到的主题优先”，而内置主题会先于用户主题加载。

如果你想基于内置主题做变体，请换一个新的主题 id，不要复用内置主题 id。

## 15. 当前内置主题

当前内置主题 id 为：

- `winssh.light-plus`
- `winssh.dark-plus`
- `winssh.pixel-crt`

其中：

- `Light+` 是默认浅色主题
- `Dark+` 是默认深色主题
- `Pixel CRT` 是带扫描线和终端默认字体策略的复古主题

建议第三方主题继续使用清晰且不易冲突的命名方式，例如：

- `publisher.theme-name`
- `publisher.theme-pack.variant`

不要使用过于泛化的 id，例如：

- `dark`
- `light`
- `blue`

## 16. 最后建议

如果你是第一次开发 WinSSH 主题，最稳妥的路径不是从零写，而是：

1. 复制内置主题包
2. 先只改一个主题文件
3. 先把 workbench 和 terminal 主色调跑通
4. 再细修 overlay、toast、logo、扫描线和终端默认字体

这样最容易快速得到一个完整、可读并且不会明显漏项的主题插件。
