# Findings

## Current State

- The previous plan restored SFTP follow terminal. The current request reverses that direction and asks to remove the feature completely.
- The follow-terminal-specific code path has now been removed from main, preload, renderer store, SFTP panel, and tests.
- The only remaining `follow-terminal` text in `src/renderer/src` is the unrelated editor-font inheritance setting.

## Removal Direction

- Keep the removal narrow: delete only the SFTP follow-terminal feature and its plumbing.
- Keep unrelated SFTP panel behavior such as current path editing, directory listing, and transfer actions.
