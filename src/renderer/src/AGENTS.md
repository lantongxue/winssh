# src/renderer/src — React Workbench App

**Parent**: root AGENTS.md (commands, aliases, cross-cutting constraints)

## OVERVIEW

React 19 + Tailwind 4 + Zustand workbench app. Single-page shell (no pages/ dir). Feature API gateway enforced by ESLint. 7 subdirectories.

## WHERE TO LOOK

| Task                      | File(s)                                                                        | Notes                                                                    |
| ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Add new IPC method client | features/<domain>/api/\* + features/shared/query-keys.ts                       | Must go through features/\*/api — ESLint bans window.winsshApi           |
| Add new document/tab type | lib/workbench.ts (WorkbenchDocument union) + store/workbench-store.ts          | 7 document kinds; add factory + open/close logic                         |
| Modify session UI         | store/sessions-store.ts + workbench-context.tsx + workbench-session-editor.tsx | Keep-mounted strategy — do NOT change to conditional render              |
| Modify local terminal     | hooks/use-terminal.ts (600 lines) + store/local-terminals-store.ts             | Shared terminal surface for SSH + local                                  |
| Add SFTP UI feature       | features/sftp/api + components/sftp-_ + workbench-sftp-file-_-editor           | SFTP remote editing is text-only (Monaco)                                |
| Add settings section      | components/workbench/workbench-settings-editor.tsx (1719 lines)                | 6 sections in monolith; use handleSettingSave() + auto-save hook         |
| Add server editor field   | components/workbench/workbench-server-editor.tsx (1684 lines)                  | Two forms: main + jump server dialog; auth type toggles fields           |
| Add sidebar feature       | components/workbench/workbench-primary-sidebar.tsx (1309 lines)                | Tree structure + search ranking + drag-and-drop                          |
| Add theme resolution      | lib/theme.ts + hooks/use-prefers-dark.ts                                       | resolveThemeDefinition + applyThemeToRoot                                |
| Add React Query domain    | features/shared/query-keys.ts                                                  | NEVER hardcode keys — pre-existing violations exist but do NOT replicate |
| Add i18n key              | i18n/resources/{en-US,zh-CN}/{namespace}.ts                                    | Both locales + type definitions required                                 |
| Add global push event     | hooks/use-session-events.ts                                                    | THE event hub — routes IPC push events to stores + toast + invalidation  |

## CONVENTIONS

- **Feature API gateway**: ALL renderer-to-preload calls go through `features/*/api` clients wrapping `winsshClient`. `window.winsshApi` is ESLint-banned except in `features/shared/api/`.
- **Keep-mounted**: `session-editor` and `local-terminal-editor` use visibility toggle (`invisible pointer-events-none`), NOT conditional render. Other documents use `hidden`.
- **Zustand + React Query**: UI state → Zustand stores (4), server state → React Query. Never use Redux or Context for state.
- **Auto-save**: Settings use `useSettingsAutoSave` hook with `saveField()` + rollback via `onRevert`.
- **shadcn/ui**: Components in `components/ui/` use new-york style. ESLint disables `react-refresh/only-export-components` there — do NOT add those exports.
- **HashRouter**: Electron `file://` compat — not BrowserRouter.
- **WorkbenchDocument is tagged union**: 7 kinds with template literal ID types. No separate `pages/` directory.
- **Global hooks**: `hooks/` is renderer-level shared (not per-feature). `use-session-events.ts` is mounted at App root.
- **i18n namespace-per-file**: `.ts` files (not JSON) with typed exports. 3 namespaces per locale: common, validation, workbench.

## ANTI-PATTERNS

- **NEVER** use `window.winsshApi` directly in components — use `features/*/api` clients (ESLint error)
- **NEVER** hardcode React Query keys — use `features/shared/query-keys.ts` (pre-existing violations are debt, not patterns)
- **NEVER** change session-editor/local-terminal-editor to conditional render — keep-mounted is required for xterm stability
- **NEVER** add `react-refresh` exports to `components/ui/` — ESLint intentionally disabled there
- **NEVER** add binary/large-file SFTP support — `sftp:readFile`/`sftp:writeFile` API is string-only
- **NEVER** assume app continues after backup restore — triggers `system:relaunch`
- **NEVER** use BrowserRouter — HashRouter required for Electron `file://` compat
