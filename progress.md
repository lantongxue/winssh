# Progress

## 2026-05-23

- Started new removal pass for SFTP follow terminal.
- Read the existing planning files and found they describe the previous restore effort, not the current removal goal.
- Ran repository status and reference scans for `followTerminal`, `__wsh_emit_pwd`, terminal cwd store maps, and related tests.
- Replaced the planning files with a removal-focused plan, findings, and progress log.
- Removed the SFTP follow-terminal toggle, tooltip, shell setup command injection, and renderer sync logic from `SftpPanel`.
- Removed follow-terminal state and terminal cwd tracking from `sessions-store`.
- Removed `sessions:cwd` / `onCwdChange` from shared API types, IPC channel types, preload, and renderer session event subscriptions.
- Removed OSC 7 cwd parsing and `sessions:cwd` emission from `SessionManager`; terminal data now forwards unchanged.
- Deleted obsolete follow-terminal tests and adjusted the remaining session-manager test to assert raw terminal data forwarding.
- Removed SFTP follow-terminal i18n strings while leaving the unrelated editor font "follow terminal font" setting intact.
- Ran `npm run typecheck`; it passed.
- Ran `npx vitest run test/renderer/store/sessions-store.test.ts test/renderer/components/sftp-panel.test.tsx test/main/session-manager.test.ts`; 3 files / 40 tests passed.
- Final residue scan found no SFTP follow-terminal plumbing; remaining `follow-terminal` hits are the unrelated editor font setting.
