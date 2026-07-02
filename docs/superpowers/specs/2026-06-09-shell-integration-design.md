# Shell Integration Optimization Design

## Goal

Improve command history capture and SFTP directory following while keeping the feature automatic and zero-configuration.

## Problems

- Remote SSH sessions currently upload a temporary `~/.winssh_init_<sessionId>` file over SFTP and then visibly run a source command in the terminal.
- The visible source command creates a poor first-session experience and can leak implementation details into scrollback.
- The current shell script relies on patterns that are fragile across older bash versions and user shell customizations.
- SFTP follow mode depends on cwd events produced by shell integration, and the renderer follow effect currently clears its own timer immediately.

## Design

- Replace SFTP temporary-file installation with an inline shell integration command written directly to the terminal input stream.
- Keep the installer silent by buffering and filtering installer echo/output in the main process before data reaches the renderer.
- Preserve automatic behavior for bash and zsh, and let unsupported shells degrade without user-visible errors.
- Install a cwd-only shell integration variant when command history is disabled, so SFTP follow mode still works without sending command text or completion markers.
- Keep OSC parsing as the protocol boundary: shell integration emits cwd markers in all supported modes, and emits command text/start/completion markers only when command history is enabled; main process strips recognized markers before rendering.
- Fix SFTP follow mode so `terminalCwd` changes update the SFTP panel when follow is enabled.

## Scope

- SSH legacy runtime installation path.
- Local terminal installation path, to avoid the same temporary-file behavior locally.
- Shared shell integration snippet generation.
- Worker SSH runtime protocol and output filtering, so worker sessions match the legacy runtime behavior.
- Renderer SFTP follow behavior.
- Focused tests for installation behavior, OSC parsing, and follow mode.

## Out Of Scope

- Binary SFTP support.
- Persistent SFTP panel state.
- Database schema changes.
- Changing existing command history persistence APIs.
