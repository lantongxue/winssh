# Remove SFTP Follow Terminal Plan

## Goal

Completely remove the SFTP "follow terminal" feature and its supporting plumbing.

## Scope

- Remove the SFTP follow-terminal toggle and tooltip from the UI.
- Remove shell-side follow setup command injection.
- Remove renderer follow state and terminal cwd tracking used only by follow terminal.
- Remove preload, IPC, and main-process cwd/follow-terminal surfaces if unused.
- Remove follow-terminal tests and adjust remaining tests to current behavior.
- Remove follow-terminal i18n strings and stale planning/documentation references created during this task.

## Phases

1. Planning and context recovery - complete
2. Inventory all follow-terminal and cwd tracking references - complete
3. Remove renderer UI/store behavior - complete
4. Remove preload, IPC, and main-process support - complete
5. Update tests and remove obsolete assertions - complete
6. Run typecheck and focused tests - complete
7. Final residue scan - complete

## Decisions

- "Complete removal" means no visible SFTP follow control and no hidden OSC 7 setup injection.
- Terminal cwd state that exists only to drive SFTP follow should be removed with the feature.

## Errors Encountered

- Initial catchup command accidentally invoked `/usr/bin/python3` as a script path; reran the actual session-catchup script directly with `python3`.
- First typecheck pass still referenced `clearFollowNavigationTimer` after the helper was removed. Deleted the last two call sites and reran the checker successfully.
