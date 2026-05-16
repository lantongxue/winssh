# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WinSSH is a cross-platform SSH/SFTP desktop client built with Electron 39, React 19, TypeScript 5.9, and Tailwind CSS 4. It uses electron-vite for builds and ships for Windows, macOS, and Linux.

## Common Commands

```bash
npm run dev              # Start Electron app in dev mode
npm run build            # Typecheck + electron-vite build
npm run typecheck        # Run both node and web TypeScript checks
npm run typecheck:node   # tsc for main/preload/shared
npm run typecheck:web    # tsc for renderer/shared
npm run test             # Vitest (jsdom, globals: true)
npx vitest run <file>    # Run a single test file
npm run lint             # ESLint (has pre-existing failures - not fully green)
npm run format           # Prettier (single quotes, no semicolons, 100 char width)
npm run dist             # Build + electron-builder for current platform
npm run dist:win         # Windows NSIS + ZIP
npm run dist:mac         # macOS DMG + ZIP
npm run dist:linux       # Linux AppImage + DEB
npm run updates:mock     # Generate mock update release files for local testing
npm run updates:serve    # Start a local update server for end-to-end update testing
```

## Test Infrastructure

Vitest runs with `globals: true` (no imports needed for `describe`/`it`/`expect`), `jsdom` environment, and a setup file at `test/renderer/helpers/setup.ts` that stubs `ResizeObserver` and `scrollIntoView`. Tests live in `test/main/`, `test/renderer/`, or `test/shared/` with `.test.ts` or `.test.tsx` extensions.

## Architecture

### Three-Process Electron Model

- **Main process** (`src/main/`): `index.ts` is a thin entry that calls `bootstrap()`, which assembles all services, registers IPC, and creates the main window. The application services layer (`src/main/application/`) orchestrates use cases, and `src/main/ipc/` handles IPC registration split into 3 domain registrars.
- **Preload** (`src/preload/`): Typed IPC bridge using `contextBridge.exposeInMainWorld('winsshApi', api)`. Implements a hub-based subscription system with global and per-ID dispatch for O(1) session/terminal data routing.
- **Renderer** (`src/renderer/src/`): React app with a VS Code-like workbench UI.

### IPC Contract

The typed IPC contract flows through 4 files:
1. `src/shared/types.ts` — domain types
2. `src/shared/api.ts` — `WinsshApi` interface (the contract)
3. `src/shared/ipc-channels.ts` — typed push event channels
4. `src/preload/index.ts` — bridge implementation

Main process handlers are in `src/main/ipc/` (3 registrars: server, session, system).

### Renderer Feature API Gateway

Components must NOT access `window.winsshApi` directly — an ESLint rule enforces this. Instead, use per-domain clients from `src/renderer/src/features/*/api/`. The proxy-based client is in `features/shared/api/winssh-client.ts`. React Query keys are centralized in `features/shared/query-keys.ts`.

### Key Runtime Services (Main Process)

- `session-manager.ts` — SSH sessions, SFTP, port forwarding
- `local-terminal-manager.ts` — node-pty local terminals
- `database.ts` — better-sqlite3 persistence
- `secure-store.ts` — keytar for server passwords/passphrases
- `theme-registry.ts` — theme loading and registration
- `update-service.ts` — electron-updater (Windows-only for packaged builds)
- `webdav-backup-service.ts` — WebDAV backup/restore

### State Management (Renderer)

Zustand stores in `src/renderer/src/store/`: `workbench-store.ts` (persisted UI chrome), `sessions-store.ts` (session tabs and connection phases), `local-terminals-store.ts`, `update-dialog-store.ts`.

### Workbench Document Model

`WorkbenchDocument` is a tagged union with 7 document kinds: server-editor, session-editor, sftp-file-editor, local-terminal-editor, settings-editor, updates-editor, terminal-welcome. Session and local-terminal editors use a keep-mounted strategy (hidden via visibility, not unmounted) to avoid xterm remounting costs. Terminal panes use xterm with addons (fit, search, webgl, image, web-links). The SFTP file editor uses Monaco Editor with language detection based on file extension.

## Path Aliases

- `@/*` and `@renderer/*` → `src/renderer/src/`
- `@main/*` → `src/main/`
- `@shared/*` → `src/shared/`
- `@test/*` → `test/`

## Key Constraints

- **Native modules must be asar-unpacked**: `better-sqlite3` and `keytar` contain native binaries and cannot run from inside an asar archive. The `electron-builder.yml` unpacks them. Any new native dependency must be added to `asarUnpack`.
- **Secret model is hybrid**: keytar for server passwords/passphrases, SQLite `credentials` table for credential vault secrets and private keys. Private key content is stored directly in the database, not as file paths.
- **Session identity**: `sessionId` flows from renderer provisional tab through to main process — do not break this chain.
- **Jump server is single-hop only** — nested chains are explicitly unsupported.
- **Port forwarding rules are in-memory only** (no DB persistence).
- **Resource monitoring is Linux-only** via `/proc/*` and `df`.
- **WebDAV restore triggers app relaunch** — renderer cannot safely continue after restore.
- **`localTerminalShell` is platform-normalized** on both read and write in main process.
- **`npm run lint` is not fully green** — pre-existing React hooks, fast refresh, and IPC direct-access violations exist. Do not introduce new lint violations.

## Conventions

- Conventional commits enforced via husky + commitlint (feat, fix, perf, security, refactor, docs, style, test, build, ci, chore, revert)
- Prettier: single quotes, no semicolons, 100 char print width
- 2-space indentation (EditorConfig)
- UI components use shadcn/ui (new-york style) with Radix UI primitives and Lucide icons
- i18n supports zh-CN and en-US via i18next/react-i18next
- Tests live in `test/` (not alongside source), organized by `test/main/`, `test/renderer/`, `test/shared/`

## Web Sub-Project

The `web/` directory is a separate brand-site project with its own `package.json`, Vite config, and test runner. Use `npm run web:dev`, `npm run web:build`, `npm run web:test` from the repo root.

## Existing Documentation

- `AGENTS.md` — detailed engineering snapshot with architecture, data flows, and boundaries (2138 lines, in Chinese)
- `docs/theme-dev.md` — theme development guide
- `CHANGELOG.md` — auto-generated conventional changelog
