# test — Mirror-Tree Test Infrastructure

**Parent**: root AGENTS.md (commands, aliases, cross-cutting constraints)

## OVERVIEW

Vitest tests mirroring `src/` structure. NOT co-located with source. 56 test files across 4 subdirectories. globals:true + jsdom env.

## WHERE TO LOOK

| Task                          | File(s)                                            | Notes                                                |
| ----------------------------- | -------------------------------------------------- | ---------------------------------------------------- |
| Write renderer component test | test/renderer/components/ + create-winssh-api mock | Mirror src/renderer/src/components/ path             |
| Write renderer hook test      | test/renderer/hooks/                               | Mirror src/renderer/src/hooks/ path                  |
| Write renderer store test     | test/renderer/store/                               | Mirror src/renderer/src/store/ path                  |
| Write renderer lib test       | test/renderer/lib/                                 | Mirror src/renderer/src/lib/ path                    |
| Write main process test       | test/main/ + test/main/application/                | vi.mock('electron'), MockClient, constructor doubles |
| Write shared module test      | test/shared/                                       | Zod schema validation, sftp path utils, etc.         |
| Write i18n test               | test/renderer/i18n/                                | Translation key completeness                         |
| Override bridge mock behavior | test/renderer/helpers/create-winssh-api.ts         | DeepPartial<WinsshApi> overrides pattern             |

## CONVENTIONS

- **globals: true** — no explicit imports of describe/it/expect needed (Vitest injects them)
- **jsdom env** — all renderer tests use jsdom; ResizeObserver, scrollIntoView, queryCommandSupported polyfilled in setup.ts
- **Bridge mock**: `createWinsshApiMock()` from `test/renderer/helpers/create-winssh-api.ts` (406 lines). Assign to `window.winsshApi` in beforeEach or per-test — NOT vi.mock.
- **QueryClient per-test**: Every renderer component test creates `new QueryClient({ defaultOptions: { queries: { retry: false } } })`. Never share across tests.
- **Main process mocks**: 3 patterns:
  1. `vi.mock('electron')` — for dialog, app, BrowserWindow
  2. Mock class factories — `MockClient extends EventEmitter`, `FakeUpdater implements UpdaterAdapter`
  3. Constructor doubles with `satisfies` + `ConstructorParameters<typeof Service>[N]` typing
- **Conditional DB tests**: `describeDatabase` pattern — `describe.skip` when `better-sqlite3` unavailable. Uses `await import('better-sqlite3').catch(() => null)` + temp DB probe.
- **vi.hoisted()**: Used in `session-manager.connect.test.ts` to share mutable state between test body and `vi.mock('ssh2')` factory closure.
- **Heavy module mocking**: `vi.mock('sonner')` (8+ tests), `vi.mock('@xterm/xterm')` + addons (9 mocks), `vi.mock('monaco-editor/esm/vs/basic-languages/...')` (24 language mocks)
- **@test alias**: `@test/renderer/helpers/create-winssh-api` for mock imports in tests

## ANTI-PATTERNS

- **NEVER** co-locate tests in `src/` — all tests live in `test/` mirroring `src/` structure
- **NEVER** use `vi.mock` for `window.winsshApi` — use direct assignment with `createWinsshApiMock()`
- **NEVER** share QueryClient across renderer tests — create fresh per-test with `retry: false`
- **NEVER** skip conditional DB tests — use `describeDatabase` pattern for graceful skip when native module unavailable
- **NEVER** reference `src/` paths in test imports — use `@test/`, `@/`, `@shared/` aliases
