# src/main — Electron Main Process

**Parent**: root AGENTS.md (commands, aliases, cross-cutting constraints)

## OVERVIEW

Node.js/Electron main process: lifecycle, IPC, database, SSH/SFTP, themes, updates, WebDAV backup. 19 source files across 3 subdirectories.

## STRUCTURE

```
src/main/
├── index.ts            # Thin entry: app.whenReady().then(bootstrap) — never modify for features
├── bootstrap.ts        # All wiring: services, IPC, DB init, window creation
├── application/        # Use-case orchestration (NOT raw services)
│   ├── servers-application-service.ts    # Server CRUD + secrets + keytar cleanup
│   ├── sessions-application-service.ts   # Thin facade over SessionManager + LocalTerminalManager
│   └── settings-application-service.ts   # Settings CRUD + theme validation + shell sync
├── ipc/                # Domain-split registrars (4 modules)
│   ├── register-server-ipc.ts            # credentials, groups, tags, servers
│   ├── register-session-ipc.ts           # sessions, localTerminals, sftp, portForwards
│   ├── register-system-ipc.ts            # themes, settings, logs, updates, backup, system, window
│   └── register-command-history-ipc.ts   # commandHistory
├── session-manager.ts     # 2897 lines — SSH/SFTP/port-forward runtime engine
├── database.ts            # 1209 lines — SQLite persistence for all entities
├── local-terminal-manager.ts  # node-pty local terminals + OSC command capture
├── secure-store.ts         # keytar password/passphrase storage
├── theme-registry.ts       # JSON theme pack loading + import/delete
├── update-service.ts       # NsisUpdater — Windows-only auto-update
├── webdav-backup-service.ts # WebDAV backup/restore/test/list
├── log-file-service.ts     # Persistent app log file
├── app-menu.ts             # macOS application menu only
├── localization.ts         # Main process i18n (en-US + zh-CN required)
├── observability.ts        # Structured logging + DomainResult envelope
├── concurrency-pool.ts     # Custom concurrency primitive
├── osc-scanner.ts          # OSC sequence parser for command history capture
└── shell-integration.ts    # Shell integration script injection
```

## WHERE TO LOOK

| Task                         | File(s)                                                                     | Notes                                                                                                                                |
| ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Add IPC handler              | application service + matching ipc/register-\*                              | Handler delegates to app service, not manager directly                                                                               |
| Add server DB column         | database.ts + servers-application-service.ts + shared/validation.ts         | Cross-cutting: schema, row mapping, saveServer(), Zod                                                                                |
| Modify SSH connection flow   | session-manager.ts establishConnection() + bindRuntimeClient()              | ssh2 callback-to-Promise wrapping pattern throughout                                                                                 |
| Add SFTP operation           | session-manager.ts + sessions-application-service.ts + ipc/register-session | Text-only editor file streams: `openFileReadStream`/`openFileWriteStream`/`writeFileChunk`/`closeFileWriteStream`/`cancelFileStream` |
| Add port forward type        | session-manager.ts + sessions-application-service.ts                        | Session-scoped memory only, no DB persistence                                                                                        |
| Add theme pack feature       | theme-registry.ts + themes/builtin/                                         | JSON theme packs, not CSS                                                                                                            |
| Modify backup/restore        | webdav-backup-service.ts                                                    | Restore triggers system:relaunch — app exits                                                                                         |
| Add main process dialog text | localization.ts                                                             | Must add both en-US and zh-CN strings                                                                                                |

## CONVENTIONS

- **IPC flow**: registrar → application service → manager/database. Never call manager directly from registrar.
- **Zod validation**: All IPC inputs validated via `parseInput(schema, input)` from `shared/validation.ts` in registrar layer.
- **Error normalization**: ssh2 errors wrapped in `ConnectionFailure` with structured codes (`client-authentication`, `host-untrusted`, etc.).
- **Logging**: Use `createLogger('main')` from `observability.ts`. Not `console.log`.
- **Transaction pattern**: Database multi-step writes use `better-sqlite3` synchronous `transaction()`.
- **NsisUpdater only**: `update-service.ts` uses `NsisUpdater` (not generic `autoUpdater`). Non-win32 → `unsupported`.

## ANTI-PATTERNS

- **DO NOT** assume credential vault is the auth source — SessionManager uses `request.secrets[server.id]` + keytar fallback, not vault
- **DO NOT** implement multi-hop jump chains — explicitly rejected at validation and runtime levels
- **DO NOT** delete `private_key_path` column or its file-reading fallback — legacy compat for existing user data
- **DO NOT** add DB persistence for port forward rules — session-scoped memory only
- **DO NOT** assume app continues after backup restore — triggers `system:relaunch`
- **DO NOT** modify `index.ts` for feature work — all wiring is in `bootstrap.ts`
- **DO NOT** use `console.log` — use `createLogger()` from `observability.ts`
- **DO NOT** add binary/large-file SFTP editor support — `openFileReadStream`/`openFileWriteStream`/`writeFileChunk`/`closeFileWriteStream`/`cancelFileStream` stay text-only
