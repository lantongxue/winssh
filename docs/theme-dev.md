# WinSSH 主题开发文档

## 1. 文档范围

本文档基于当前仓库中的主题实现整理，目标是说明 WinSSH 现在已经支持的主题开发方式，而不是未来规划。

当前主题系统的核心事实：

1. 主题不是硬编码枚举，而是按“主题插件包”扫描加载。
2. 设置中的 `theme` 保存的是主题 id，或者特殊值 `system`。
3. 主进程负责扫描、校验、合并、回退和主题选择归一化。
4. 渲染层只消费标准化后的 `ThemeDefinition`，并把 UI token 写入根节点 CSS 变量。

建议阅读这些实现文件：

- `src/shared/themes.ts`
- `src/main/theme-registry.ts`
- `src/renderer/src/lib/theme.ts`
- `src/renderer/src/App.tsx`
- `themes/builtin/winssh-default-themes/package.json`

## 2. 当前主题系统概览

主题加载和应用链路如下：

1. 主进程 `ThemeRegistry` 扫描两个主题根目录：
   - 内置主题根目录：`themes/builtin`
   - 用户主题根目录：`app.getPath('userData')/themes`
2. 每个根目录下的一级子目录都被当成一个主题插件包。
3. 插件包里的 `package.json` 通过 `contributes.themes[]` 声明一个或多个主题。
4. 每个主题条目的 `path` 指向一个主题 JSON 文件。
5. 主进程使用 Zod 校验 manifest 和主题文档。
6. 主进程根据 `uiTheme` 推导 `appearance`，并把主题 JSON 与基础 UI token、默认终端调色板合并，生成完整 `ThemeDefinition`。
7. 渲染层通过 `window.winsshApi.themes.list()` 读取主题列表。
8. `App.tsx` 和 `src/renderer/src/lib/theme.ts` 负责解析当前选择并调用 `applyThemeToRoot()`。
9. `applyThemeToRoot()` 会把全部 UI token 写入 `document.documentElement` 上的 CSS 变量，并设置主题相关 class / data-attribute。

设置中的 `theme` 当前可保存：

- `system`
- 任意有效主题 id，例如：
  - `winssh.light-plus`
  - `winssh.dark-plus`
  - `winssh.pixel-crt`
  - `acme.nebula`

## 3. 主题选择与解析规则

### 3.1 `system` 不是主题文件

`system` 是一个特殊选择值，不对应任何插件里的 JSON 文件。

当前规则：

- 系统偏好浅色时，`system` 解析到 `winssh.light-plus`
- 系统偏好深色时，`system` 解析到 `winssh.dark-plus`

对应常量：

- `SYSTEM_THEME_ID = "system"`
- `DEFAULT_LIGHT_THEME_ID = "winssh.light-plus"`
- `DEFAULT_DARK_THEME_ID = "winssh.dark-plus"`
- `DEFAULT_PIXEL_THEME_ID = "winssh.pixel-crt"`

### 3.2 `uiTheme` 决定外观基线

主题贡献项的 `uiTheme` 当前只支持：

- `vs`
- `vs-dark`

运行时行为：

- `vs` -> `appearance = "light"`
- `vs-dark` -> `appearance = "dark"`

这个值会影响：

- 选择浅色还是深色基础 UI token
- 根节点 `.dark` class 是否启用
- 根节点 `color-scheme`
- `ThemeDefinition.appearance`

### 3.3 无效主题选择会回退

如果设置里保存的是一个不存在的主题 id：

- 主进程 `ThemeRegistry.normalizeSelection()` 会把它归一化为 `system`
- 渲染层解析主题时也会继续走默认 light / dark fallback

### 3.4 主题定义永远是“补全后”的

主题文件里只需要写覆盖项，运行时会生成完整 `ThemeDefinition`。标准化后的主题对象会带这些字段：

| 字段                | 说明                                |
| ------------------- | ----------------------------------- |
| `id`                | 主题 id                             |
| `label`             | 主题显示名                          |
| `description`       | 主题描述，可选                      |
| `appearance`        | `light` 或 `dark`                   |
| `pluginId`          | 由 `publisher.name` 组合出的插件 id |
| `pluginDisplayName` | 插件显示名                          |
| `source`            | `builtin` 或 `user`                 |
| `version`           | 主题包版本                          |
| `colors`            | 完整 UI token 集合                  |
| `terminal`          | 完整终端调色板                      |
| `terminalDefaults`  | 主题建议的终端字体配置，可选        |

## 4. 主题插件包目录结构

一个最小可用主题插件包：

```text
my-theme-pack/
  package.json
  themes/
    nebula.json
```

用户主题包要放到用户主题根目录下。实际根目录以 Electron 的 `app.getPath('userData')` 为准，典型结构如下：

```text
<userData>/themes/
  my-theme-pack/
    package.json
    themes/
      nebula.json
```

Windows 下通常会落在类似下面的位置：

```text
%APPDATA%/winssh/themes/
```

需要注意：

1. 目录名只影响扫描顺序，不决定插件 id。
2. 插件 id 来自 manifest 的 `publisher` 和 `name`，不是来自文件夹名。
3. 当前没有主题热重载入口。新增、删除或修改用户主题包后，建议重启 WinSSH。

## 5. `package.json` 格式

主题插件包的 `package.json` 至少需要这些字段：

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

| 字段                               | 必填 | 说明                            |
| ---------------------------------- | ---- | ------------------------------- |
| `name`                             | 是   | 插件名                          |
| `displayName`                      | 否   | 插件显示名，不填时回退到 `name` |
| `publisher`                        | 是   | 发布者                          |
| `version`                          | 是   | 插件版本                        |
| `contributes.themes`               | 是   | 主题列表，至少 1 项             |
| `contributes.themes[].id`          | 是   | 主题全局唯一 id                 |
| `contributes.themes[].label`       | 是   | 设置页和命令中心显示名          |
| `contributes.themes[].description` | 否   | 主题说明                        |
| `contributes.themes[].uiTheme`     | 是   | `vs` 或 `vs-dark`               |
| `contributes.themes[].path`        | 是   | 相对插件包目录的主题 JSON 路径  |

运行时会派生：

- `pluginId = ${publisher}.${name}`
- `pluginDisplayName = displayName ?? name`

例如：

- 目录 `themes/builtin/winssh-default-themes`
- manifest 中 `publisher = "winssh"`、`name = "default-themes"`
- 最终 `pluginId = "winssh.default-themes"`

额外字段目前不会参与主题解析。例如内置主题包里的 `engines.winssh` 不影响加载逻辑。

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
  - 值类型是字符串
  - 不要求一定是颜色值，也可以是圆角、阴影、blur、百分比等 CSS 字符串
  - 省略时按空对象处理
- `terminal`
  - xterm.js 调色板覆盖集合
  - 值类型是字符串
  - 省略时按空对象处理
- `terminalDefaults`
  - 主题建议的终端默认字体配置
  - 可整体省略
  - `fontSize` 范围当前是 `10` 到 `24`
  - `lineHeight` 范围当前是 `1` 到 `2`

当前容错行为：

1. 未知顶层字段会被忽略。
2. `colors` 和 `terminal` 中的未知 token 会被忽略，并由主进程输出 warning。
3. 主题文件解析失败时，该主题会被整体忽略。

## 7. UI Token 清单

`colors` 中可用的键以 `src/shared/themes.ts` 里的 `THEME_COLOR_KEYS` 为准。渲染层会把它们写成根节点 CSS 变量：

```css
--background
--workbench-bg
--glass-surface
--terminal-overlay-panel
```

### 7.1 基础界面 Token

| Token                    | 说明         |
| ------------------------ | ------------ |
| `background`             | 应用主背景   |
| `foreground`             | 应用主文本色 |
| `card`                   | 卡片背景     |
| `card-foreground`        | 卡片文本     |
| `popover`                | 浮层背景     |
| `popover-foreground`     | 浮层文本     |
| `primary`                | 主操作色     |
| `primary-foreground`     | 主操作文本色 |
| `secondary`              | 次级背景     |
| `secondary-foreground`   | 次级文本色   |
| `muted`                  | 弱对比背景   |
| `muted-foreground`       | 弱对比文本   |
| `accent`                 | 强调背景     |
| `accent-foreground`      | 强调文本     |
| `destructive`            | 危险色       |
| `destructive-foreground` | 危险文本色   |
| `border`                 | 默认边框色   |
| `input`                  | 输入框背景   |
| `ring`                   | 焦点高亮色   |
| `radius`                 | 默认圆角值   |

### 7.2 Sidebar Token

| Token                        | 说明                    |
| ---------------------------- | ----------------------- |
| `sidebar`                    | 主侧栏背景              |
| `sidebar-foreground`         | 主侧栏文本              |
| `sidebar-primary`            | 主侧栏强调色            |
| `sidebar-primary-foreground` | 主侧栏强调文本          |
| `sidebar-accent`             | 主侧栏 hover / 强调背景 |
| `sidebar-accent-foreground`  | 主侧栏强调文本          |
| `sidebar-border`             | 主侧栏边框              |
| `sidebar-ring`               | 主侧栏焦点色            |

### 7.3 Workbench Token

| Token                            | 说明                         |
| -------------------------------- | ---------------------------- |
| `workbench-bg`                   | 整体 workbench 背景          |
| `workbench-titlebar`             | 标题栏背景                   |
| `workbench-activity-bar`         | Activity Bar 背景            |
| `workbench-sidebar`              | Explorer / Settings 侧栏背景 |
| `workbench-tabs`                 | 编辑器标签栏背景             |
| `workbench-editor`               | 编辑区背景                   |
| `workbench-panel`                | 底部面板背景                 |
| `workbench-border`               | workbench 通用边框           |
| `workbench-hover`                | hover 背景                   |
| `workbench-active`               | 激活态强调色                 |
| `workbench-logo`                 | 标题栏 logo 主色             |
| `workbench-statusbar`            | 状态栏背景                   |
| `workbench-statusbar-foreground` | 状态栏文本                   |
| `workbench-muted`                | workbench 弱化文本           |
| `workbench-input`                | workbench 输入框背景         |
| `workbench-card-radius`          | workbench 卡片圆角           |
| `workbench-hero-radius`          | hero 区块圆角                |
| `workbench-list-radius`          | 列表项圆角                   |
| `workbench-metric-radius`        | 指标卡片圆角                 |
| `workbench-panel-frame-radius`   | 面板容器圆角                 |
| `workbench-tab-radius`           | 标签圆角                     |

### 7.4 Toast Token

| Token                 | 说明               |
| --------------------- | ------------------ |
| `toast-info`          | 信息 toast 强调色  |
| `toast-success`       | 成功 toast 强调色  |
| `toast-warning`       | 警告 toast 强调色  |
| `toast-shadow`        | toast 阴影         |
| `toast-highlight`     | toast 内高光       |
| `toast-radius`        | toast 圆角         |
| `toast-button-radius` | toast 按钮圆角     |
| `toast-backdrop-blur` | toast 背景模糊强度 |

### 7.5 Glass Token

这组 token 可用于自定义玻璃视觉语言效果：

| Token                             | 说明               |
| --------------------------------- | ------------------ |
| `glass-surface`                   | 玻璃表层基础底色   |
| `glass-surface-strong`            | 更强的玻璃底色     |
| `glass-surface-elevated`          | 更高层级的玻璃底色 |
| `glass-surface-interactive`       | 交互态玻璃底色     |
| `glass-surface-interactive-hover` | 交互态 hover 底色  |
| `glass-border`                    | 玻璃边框           |
| `glass-border-strong`             | 强化玻璃边框       |
| `glass-highlight`                 | 高光               |
| `glass-shadow`                    | 常规玻璃阴影       |
| `glass-shadow-strong`             | 更强的玻璃阴影     |
| `glass-glow`                      | 发光描边 / 外发光  |
| `glass-blur`                      | 玻璃模糊强度       |
| `glass-saturate`                  | 玻璃饱和度增强     |

### 7.6 终端表层与连接遮罩 Token

| Token                            | 说明                  |
| -------------------------------- | --------------------- |
| `terminal-surface-bg`            | 终端容器表层背景      |
| `terminal-overlay-backdrop`      | 连接中 / 重连遮罩背景 |
| `terminal-overlay-panel`         | 遮罩面板背景          |
| `terminal-overlay-border`        | 遮罩边框              |
| `terminal-overlay-text`          | 遮罩主文本            |
| `terminal-overlay-muted`         | 遮罩弱文本            |
| `terminal-overlay-label`         | 阶段标签文本          |
| `terminal-overlay-accent`        | 遮罩强调文本          |
| `terminal-overlay-accent-strong` | 遮罩强强调色          |
| `terminal-overlay-accent-soft`   | 遮罩柔和强调背景      |
| `terminal-overlay-progress`      | 进度条颜色            |
| `terminal-overlay-step-border`   | 步骤边框              |
| `terminal-overlay-warning`       | 警告色                |
| `terminal-overlay-warning-soft`  | 警告背景              |
| `terminal-overlay-radius`        | 遮罩圆角              |
| `terminal-overlay-backdrop-blur` | 遮罩背景模糊强度      |

### 7.7 扫描线 Token

| Token                       | 说明             |
| --------------------------- | ---------------- |
| `terminal-scanline-opacity` | 终端扫描线透明度 |
| `terminal-scanline-color`   | 扫描线颜色       |
| `terminal-scanline-size`    | 扫描线间距       |

如果不需要扫描线效果，最直接的做法是：

- `terminal-scanline-opacity: "0"`
- `terminal-scanline-color: "rgba(255, 255, 255, 0)"`

## 8. 终端调色板 Token

`terminal` 字段支持的键与 `TERMINAL_COLOR_KEYS` 一致：

| Token                 | 说明         |
| --------------------- | ------------ |
| `background`          | 终端背景色   |
| `foreground`          | 终端前景色   |
| `cursor`              | 光标颜色     |
| `selectionBackground` | 终端选区背景 |
| `black`               | ANSI 黑      |
| `red`                 | ANSI 红      |
| `green`               | ANSI 绿      |
| `yellow`              | ANSI 黄      |
| `blue`                | ANSI 蓝      |
| `magenta`             | ANSI 洋红    |
| `cyan`                | ANSI 青      |
| `white`               | ANSI 白      |
| `brightBlack`         | ANSI 亮黑    |
| `brightRed`           | ANSI 亮红    |
| `brightGreen`         | ANSI 亮绿    |
| `brightYellow`        | ANSI 亮黄    |
| `brightBlue`          | ANSI 亮蓝    |
| `brightMagenta`       | ANSI 亮洋红  |
| `brightCyan`          | ANSI 亮青    |
| `brightWhite`         | ANSI 亮白    |

## 9. 渲染层应用细节

主题应用到根节点时，当前会做这些事：

1. 根据 `appearance` 切换 `.dark`
2. 设置 `data-theme`
3. 设置 `data-theme-appearance`
4. 设置 `data-theme-plugin`
5. 设置 `data-theme-selection`
6. 设置 `color-scheme`
7. 把全部 UI token 写入 CSS 变量

## 10. `terminalDefaults` 的真实行为

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
- 行高固定回到 `1.2`

因此：

- `Pixel CRT` 这类主题只有在用户没有改过终端字体和字号时，才会完整呈现推荐终端风格
- 主题不能用 `terminalDefaults` 去强制覆盖用户自定义终端排版

## 11. 合并、优先级与回退规则

当前主题定义的生成过程：

1. 根据 `uiTheme` 推导 `appearance`
2. 根据 `appearance` 选择基础 UI token：
   - `vs` -> 浅色基础主题
   - `vs-dark` -> 深色基础主题
3. 使用主题 JSON 的 `colors` 覆盖基础 UI token
4. 使用主题 JSON 的 `terminal` 覆盖默认终端调色板
5. 保留 `terminalDefaults`
6. 产出完整 `ThemeDefinition`

回退与容错规则：

1. 主题 id 不存在时，选择值会归一化为 `system`
2. `system` 会解析到 `winssh.light-plus` 或 `winssh.dark-plus`
3. 如果完全没有可加载主题，运行时会创建一个合成 fallback theme
4. manifest 非法、主题文件不存在或主题文档非法时，该主题会被忽略
5. `colors` 或 `terminal` 中出现未知 token 时，该 token 会被忽略并打印 warning
6. `contributes.themes[].path` 如果试图跳出插件包目录，该主题会被忽略

### 11.1 重复主题 id 的优先级

当前加载顺序是：

1. 内置主题根目录
2. 用户主题根目录

每个根目录内又会按插件文件夹名排序后加载。

重复主题 id 的规则是：

- 保留第一次加载到的定义

这意味着：

1. 内置主题和用户主题如果使用同一个主题 id，内置主题会赢
2. 用户主题目前不能用“相同主题 id”去覆盖内置主题
3. 就算都在用户主题目录里，排序更靠前且先被加载的插件包也会赢

## 12. 当前内置主题包

### 12.1 Default Themes

内置路径：

- `themes/builtin/winssh-default-themes`

manifest 派生出的插件 id：

- `winssh.default-themes`

当前包含：

- `winssh.light-plus`
- `winssh.dark-plus`
- `winssh.pixel-crt`

特征：

- `Light+` 是默认浅色主题
- `Dark+` 是默认深色主题
- `Pixel CRT` 带扫描线 token 和终端推荐字体配置

## 13. 开发新主题的建议流程

### 13.1 先选一个正确的起点

如果你要做：

- 常规浅色 / 深色主题：建议复制 `themes/builtin/winssh-default-themes`

### 13.2 先决定 `vs` 还是 `vs-dark`

如果主题本质是深色，请直接用 `vs-dark`，不要先选 `vs` 再手工把所有背景改深色。

### 13.3 第一轮先覆盖关键 token

建议先覆盖这些键，快速跑通主视觉：

- `background`
- `foreground`
- `primary`
- `border`
- `workbench-bg`
- `workbench-sidebar`
- `workbench-editor`
- `workbench-panel`
- `workbench-border`
- `workbench-active`
- `workbench-logo`
- `workbench-statusbar`
- `terminal-surface-bg`
- `terminal.background`
- `terminal.foreground`
- `terminal.cursor`

主题气质稳定后，再继续补：

- workbench radius token
- toast token
- overlay token
- scanline token
- `terminalDefaults`

### 13.4 不要复用内置主题 id

建议继续使用清晰且不易冲突的命名方式，例如：

- `publisher.theme-name`
- `publisher.theme-pack.variant`

不要使用：

- `dark`
- `light`
- `blue`
- `winssh.dark-plus`

## 14. 最小示例

### 14.1 `package.json`

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

### 14.2 `themes/nebula.json`

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

## 15. 常见问题

### 15.1 为什么主题没有出现在设置页或命令中心？

优先检查：

1. 目录是否在 `app.getPath('userData')/themes/<plugin-folder>` 下
2. 插件包里是否存在 `package.json`
3. `contributes.themes[].path` 是否是相对插件包目录的路径
4. 主题 id 是否和已有主题重复
5. 修改后是否已重启 WinSSH

### 15.2 为什么某个 token 看起来没有生效？

常见原因：

1. token 名拼错了
2. 你改的是 UI token，但实际受影响的是终端 token
3. 你写了未知 token，运行时把它忽略了
4. 你改了 `terminalDefaults`，但用户其实已经自定义过终端字体或字号

### 15.3 为什么 `terminalDefaults` 没生效？

因为当前逻辑只会在用户仍然使用默认：

- 终端字体族
- 终端字号

时才应用主题推荐值。

### 15.4 为什么用户主题无法覆盖内置主题？

因为当前重复主题 id 的规则是“先加载到的定义优先”，而内置主题根目录会先于用户主题根目录加载。

如果你想基于内置主题做变体，请使用新的主题 id，而不是复用内置主题 id。

## 16.

如果你是第一次开发 WinSSH 主题，最稳妥的路径不是从零写，而是：

1. 复制内置主题包
2. 先只改一个主题文件
3. 先把 workbench 和 terminal 主色调跑通
4. 再细修 overlay、toast、radius、scanline 和终端默认字体

这样更容易快速得到一个完整、可读，而且不容易漏项的主题插件包。
