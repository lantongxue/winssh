# AGENTS.md

## Commands

```bash
npm run dev              # Electron dev mode (hot reload)
npm run build            # typecheck + electron-vite build (NOT just vite build)
npm run test             # All Vitest tests for desktop app
npm run typecheck        # Both Node + Web tsc projects
npm run lint             # KNOWN to have historical failures - do not treat as blocking
npm run format           # Prettier

npx vitest run test/path/to/file.test.ts      # Single test file
npx vitest run -t "pattern name"              # Filter by test name

npm run web:dev          # web/ subproject dev server (separate Vite build)
npm run web:test         # web/ subproject tests (separate vitest)
npm run updates:mock     # Generate mock update feed for local testing
npm run updates:serve    # Serve mock update feed on localhost
npm run dist:win         # Build Windows NSIS installer
```

**Verification order**: `npm run typecheck` → `npm run test` (lint is not a gate)

## Path Aliases

```
@/          → src/renderer/src/
@main/      → src/main/
@renderer/  → src/renderer/src/
@shared/    → src/shared/
@test/      → test/
```

Use these aliases in imports; both src and tests consume them.

## Architecture

**Process boundary**: `src/main/` (Node.js/Electron main) ↔ `src/preload/` (bridge) ↔ `src/renderer/src/` (React). Shared types live in `src/shared/`.

- **`src/main/index.ts`** is a thin entry (`app.whenReady().then(bootstrap)`). All assembly is in **`src/main/bootstrap.ts`**.
- **`src/main/application/`** is a use-case orchestration layer (servers/sessions/settings services).
- **`src/main/ipc/`** has 3 registrars: `register-server-ipc.ts`, `register-session-ipc.ts`, `register-system-ipc.ts`.
- **`src/renderer/src/features/*/api`** is the ONLY approved entry point for renderer code to call preload bridge. ESLint enforces this: `window.winsshApi` is banned in `src/renderer/src/**` except in `features/shared/api/`.
- **`src/renderer/src/features/shared/query-keys.ts`** centralizes all React Query keys. Never hardcode new keys.
- Theme definitions live in `themes/builtin/`, loaded by `src/main/theme-registry.ts`.
- `web/` is a **fully independent** Vite subproject with its own `package.json`, `tsconfig.json`, and tests.

## Testing

- Tests live in **`test/`**, mirroring the `src/` structure — they are **NOT co-located** with source files.
- File pattern: `test/**/*.test.{ts,tsx}`. Setup file: `test/renderer/helpers/setup.ts`.
- Environment: `jsdom` with `globals: true` (no explicit imports of describe/it/expect needed).
- Renderer tests mock `window.winsshApi` via `test/renderer/helpers/create-winssh-api.ts`.
- Main process test mocks live near tests in `test/main/`.

## i18n

- Renderer strings: `src/renderer/src/i18n/resources/{en-US,zh-CN}/` (namespace-per-file).
- Main process strings: `src/main/localization.ts` — adding user-facing error messages or dialog text here requires both languages.
- Adding a new i18n key requires updating **both** locale directories and the type definitions they export.

## Native Dependencies

- `better-sqlite3`, `node-pty`, `keytar`, and `ssh2` are native modules.
- `electron.vite.config.ts` externalizes them via `externalizeDepsPlugin()`.
- `electron-builder.yml` has `asarUnpack` entries for `better-sqlite3` and `keytar`. If adding a new native module that must load from disk at runtime, add it to `asarUnpack` too.
- `postinstall` runs `electron-builder install-app-deps` to rebuild native modules for the Electron target.

## Code Style

- **Prettier**: `singleQuote: true`, `semi: false`, `printWidth: 100`, `trailingComma: none`.
- **TypeScript**: strict mode, no `as any` / `@ts-ignore` allowed.
- **Commit format**: conventional commits enforced by commitlint (`feat:`, `fix:`, `chore:`, etc.). Header max 120 chars. Pre-commit hook is empty (no lint-on-commit).
- **shadcn/ui** components live under `src/renderer/src/components/ui/` — do not add `react-refresh` exports there (eslint disabled intentionally).

## Critical Constraints

These are the facts an agent is most likely to get wrong:

- **ESLint blocks `window.winsshApi`** in all `src/renderer/src/**` except `src/renderer/src/features/shared/api/**`. Always go through `features/*/api`.
- **Credential model is hybrid** — do not assume a single source of truth: server password/passphrase uses `keytar`, credential vault secrets live in SQLite, server private keys are inline in `servers.private_key` DB column.
- **`SessionManager` does NOT read credential vault directly** for connection auth. Only `servers:getSecrets` (display) and `resolveStoredPrivateKey()` use the vault. Connection auth uses `request.secrets[server.id]` or keytar fallback.
- **Jump server is single-hop only**. Nested jump chains are explicitly rejected.
- **Auto-update is Windows-only** (NSIS builds). macOS/Linux and dev builds return `unsupported` — this is expected UI state, not an error.
- **Resource monitoring is Linux-only** (`/proc/stat`, `/proc/meminfo`, etc.).
- **Port forwarding is session-scoped memory only** — no DB persistence.
- **`session-editor` and `local-terminal-editor` use keep-mounted strategy** (visible via visibility toggle, not conditional render) to avoid xterm re-initialization on tab switch. Do not change this.
- **SFTP remote file editing is text-only** — `sftp:readFile`/`sftp:writeFile` return/write strings. No binary/large-file support.
- **`private_key_path` column is legacy compat** — new writes store key content in `private_key`. Do not delete the compat path-reading logic.
- **Restore (backup) triggers `system:relaunch`** — do not assume the app continues running after restore.
- **`web/` is a separate subproject** — changes to root `package.json` version or `src/shared/themes.ts` (light/dark-plus themes) affect it. Coordinate.
- **`npm run lint` has known repository-level failures** (React hooks, IPC constraints). Do not fail a workflow because of lint; only fail on new lint errors introduced by your change.

## Cross-Cutting Changes

Changing any domain typically requires touching these layers together:

- **IPC change**: `src/shared/types.ts` → `src/shared/validation.ts` → `src/main/ipc/register-*` → `src/preload/index.ts` → `src/renderer/src/features/<domain>/api/*` → update `query-keys.ts`.
- **Session identity / phase**: add `src/main/session-manager.ts` + `src/renderer/src/store/sessions-store.ts` + `src/renderer/src/components/workbench/workbench-context.tsx`.
- **Theme change**: `src/shared/themes.ts` → `src/main/theme-registry.ts` → `themes/builtin/<pack>/themes/*.json` → `src/renderer/src/lib/theme.ts`.
- **SFTP / remote editing**: add `src/main/session-manager.ts` (readFile/writeFile) + `src/renderer/src/features/sftp/api/*` + `src/renderer/src/components/workbench/workbench-sftp-file-*-editor.tsx`.
- **Any change to `servers` table schema**: also update `src/main/database.ts`, `src/main/application/servers-application-service.ts`, and `src/shared/validation.ts` (`ServerUpsertInput`/`serverSchema`).

## Test Mock for `window.winsshApi`

When writing renderer tests that call the preload bridge:

```ts
import { createWinsshApi } from '@test/helpers/create-winssh-api'
// The setup file (test/renderer/helpers/setup.ts) injects window.winsshApi automatically.
// To override behavior in a specific test, mock the method:
const api = createWinsshApi({ /* overrides */ })
```

## Key Entry Points to Read First

- `src/main/bootstrap.ts` — how the main process is wired
- `src/preload/index.ts` — full typed bridge surface
- `src/shared/types.ts` — canonical shared types, event shapes, connection phases
- `src/renderer/src/App.tsx` — React root, theme bootstrapping, routing
- `src/renderer/src/components/workbench/workbench-shell.tsx` — renderer layout root
- `src/renderer/src/features/shared/api/winssh-client.ts` — reference for how feature API clients wrap the bridge
