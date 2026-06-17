# Shell Integration Optimization 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 历史命令与 SFTP 目录跟随保持自动启用，同时移除 SFTP 临时脚本和用户可见 source 命令。

**架构：** shell integration 由共享脚本模块生成 inline installer；主进程在终端输出链路中过滤安装回显并继续解析 OSC 事件。渲染层只消费 `sessions:cwdChanged` 派生出的 `terminalCwd`，跟随逻辑在组件内修复。

**技术栈：** Electron main process, ssh2, node-pty, React 19, Zustand, Vitest, Testing Library。

---

## 文件职责

- `src/main/shell-integration.ts`：生成 shell integration 脚本和 inline installer，识别内部命令。
- `src/main/session-manager.ts`：SSH legacy runtime 安装集成脚本并过滤安装输出。
- `src/main/local-terminal-manager.ts`：本地终端使用同一安装机制。
- `src/renderer/src/components/sftp-panel.tsx`：修复 follow terminal cwd 的状态更新。
- `test/main/session-manager.test.ts`：覆盖 SSH 安装不写远端临时文件、不显示 source 命令。
- `test/main/osc-scanner.test.ts`：覆盖新增/保留 OSC 解析协议。
- `test/renderer/components/sftp-panel.test.tsx`：覆盖 SFTP follow 行为。

## 任务 1：Shell Installer 测试与实现

- [x] 在 `test/main/session-manager.test.ts` 添加失败测试：调用私有安装方法时不调用 SFTP 写入，并且 shell 写入 inline installer。
- [x] 运行 `npx vitest run test/main/session-manager.test.ts -t "installs shell integration"`，确认失败原因是当前实现写临时文件或写 source 命令。
- [x] 修改 `src/main/shell-integration.ts` 导出 inline installer 命令，避免依赖远端文件。
- [x] 修改 `src/main/session-manager.ts` 使用 inline installer，并更新过滤逻辑。
- [x] 重新运行同一测试确认通过。

## 任务 2：本地终端安装路径

- [x] 在可覆盖范围内新增/调整测试，确认本地终端不再写 `.winssh_init_*` 临时文件。
- [x] 修改 `src/main/local-terminal-manager.ts` 使用共享 inline installer。
- [x] 运行相关本地终端测试确认通过。

## 任务 3：SFTP Follow 修复

- [x] 在 `test/renderer/components/sftp-panel.test.tsx` 添加失败测试：启用 follow 后，`terminalCwd` 变化会更新 `currentPath` 并触发新目录 list。
- [x] 运行 `npx vitest run test/renderer/components/sftp-panel.test.tsx -t "follows terminal cwd"`，确认失败。
- [x] 修改 `src/renderer/src/components/sftp-panel.tsx` 的 effect，返回 cleanup 而不是立即清理 timer。
- [x] 重新运行同一测试确认通过。

## 任务 4：验证

- [x] 运行定向测试：`npx vitest run test/main/session-manager.test.ts test/main/osc-scanner.test.ts test/renderer/components/sftp-panel.test.tsx`。
- [x] 运行 `npm run typecheck`。
- [x] 视影响范围运行 `npm run test` 或说明未运行原因。结果：全量测试存在无关的 `test/renderer/hooks/use-terminal.test.tsx` 字体栈期望失败；本次变更相关定向测试通过。
