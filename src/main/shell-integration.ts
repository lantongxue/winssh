// Shell-integration snippet that installs OSC 133 / OSC 633;E hooks on
// the remote (or local) shell. Recognised by main/osc-scanner.ts.
//
// Strategy:
//   - Outer `if [ -n "$BASH_VERSION" ] || [ -n "$ZSH_VERSION" ]; then ... fi`
//     keeps the snippet POSIX-syntactically inert on dash/sh.
//   - Inside, bash and zsh each install their own preexec/precmd hooks that
//     emit OSC 133;A/C/D and OSC 633;E ; <base64(cmd)>.
//   - bash uses `trap DEBUG` + `PROMPT_COMMAND`; zsh uses `add-zsh-hook`.
//   - Leading space on the command line suppresses logging in bash
//     (`HISTCONTROL=ignorespace`) and zsh (`HIST_IGNORE_SPACE`) when configured.
//
// Fish / csh / tcsh / minimal sh users: this snippet will surface a syntax
// error on the first session. They can disable capture per-server via the
// `captureCommandHistory` flag.
//
// One-line form keeps the visible echo to a single terminal line.

const SHELL_INTEGRATION_ONE_LINER = [
  '__wsh_emit() { printf "\\033]%s\\033\\134" "$1"; };',
  '__wsh_b64() { printf "%s" "$1" | base64 | tr -d "\\n"; };',
  'if [ -n "$BASH_VERSION" ]; then',
  '  __wsh_state=A;',
  '  __wsh_pre() {',
  '    [ -n "$COMP_LINE" ] && return;',
  '    [ "$__wsh_state" = "C" ] && return;',
  '    __wsh_emit "633;E;$(__wsh_b64 "$BASH_COMMAND")";',
  '    __wsh_emit "133;C";',
  '    __wsh_state=C;',
  '  };',
  '  __wsh_post() {',
  '    __wsh_ec=$?;',
  '    [ "$__wsh_state" = "C" ] && __wsh_emit "133;D;$__wsh_ec";',
  '    __wsh_emit "133;P;Cwd=$PWD";',
  '    __wsh_emit "133;A";',
  '    __wsh_state=A;',
  '  };',
  '  trap "__wsh_pre" DEBUG;',
  '  PROMPT_COMMAND="__wsh_post${PROMPT_COMMAND:+;$PROMPT_COMMAND}";',
  'elif [ -n "$ZSH_VERSION" ]; then',
  '  __wsh_pre() {',
  '    __wsh_emit "633;E;$(__wsh_b64 "$1")";',
  '    __wsh_emit "133;C";',
  '  };',
  '  __wsh_post() {',
  '    __wsh_ec=$?;',
  '    __wsh_emit "133;D;$__wsh_ec";',
  '    __wsh_emit "133;P;Cwd=$PWD";',
  '    __wsh_emit "133;A";',
  '  };',
  '  autoload -Uz add-zsh-hook;',
  '  add-zsh-hook preexec __wsh_pre;',
  '  add-zsh-hook precmd __wsh_post;',
  'fi'
].join(' ')

/**
 * Bytes to write to the PTY to install command-history capture. Leading space
 * lets the user's HIST_IGNORE_SPACE / HISTCONTROL=ignorespace suppress it from
 * shell history. Trailing `\r` submits the line.
 */
export const SHELL_INTEGRATION_SCRIPT = ` ${SHELL_INTEGRATION_ONE_LINER}\r`

export const SHELL_INTEGRATION_FILE_CONTENT = SHELL_INTEGRATION_ONE_LINER

/** Commands that start with these prefixes are shell-integration internals and should not be recorded. */
const SHELL_INTEGRATION_INTERNAL_PREFIXES = ['__wsh_']

/**
 * Returns `true` when a command text captured via OSC 633;E is a shell-integration
 * internal helper (e.g. __wsh_post when triggered by bash's DEBUG trap during
 * PROMPT_COMMAND execution under certain shell configurations).
 */
export function isShellIntegrationInternal(command: string): boolean {
  const trimmed = command.trim()
  return (
    SHELL_INTEGRATION_INTERNAL_PREFIXES.some((prefix) => trimmed.startsWith(prefix)) ||
    trimmed.includes('__wsh_')
  )
}
