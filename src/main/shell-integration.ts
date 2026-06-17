// Shell-integration snippet that installs OSC 133 / OSC 633;Eh hooks on
// the remote (or local) shell. Recognised by main/osc-scanner.ts.
//
// Strategy:
//   - Main process only writes this snippet when it has detected bash or zsh.
//   - bash captures the most recent history entry from PROMPT_COMMAND, avoiding
//     DEBUG traps that are fragile across older bash builds and user configs.
//   - zsh uses add-zsh-hook preexec/precmd.
//   - Command text is sent as OSC 633;Eh;<hex(cmd)> so the remote shell does
//     not need base64.
//   - When command history is disabled, WinSSH installs a cwd-only variant for
//     SFTP follow mode. That variant emits cwd/prompt markers but no command
//     text or completion markers.
//   - Leading space on the command line suppresses logging in bash
//     (`HISTCONTROL=ignorespace`) and zsh (`HIST_IGNORE_SPACE`) when configured.
//
// One-line form keeps the visible echo to a single terminal line.

interface ShellIntegrationOptions {
  commandHistory?: boolean
}

function buildShellIntegrationLines({ commandHistory = true }: ShellIntegrationOptions = {}) {
  const lines = [
    '__wsh_emit() { printf "\\033]%s\\033\\134" "$1"; };',
    ...(commandHistory
      ? ['__wsh_hex() { printf "%s" "$1" | od -An -tx1 -v 2>/dev/null | tr -d " \\n"; };']
      : []),
    '__wsh_host() { hostname 2>/dev/null || printf localhost; };',
    '__wsh_cwd() { __wsh_emit "133;P;Cwd=$PWD"; __wsh_emit "7;file://$(__wsh_host)$PWD"; };',
    'if [ -n "$BASH_VERSION" ]; then',
    '  __wsh_ready=0;',
    ...(commandHistory ? ['  __wsh_last_hist=;'] : []),
    '  __wsh_post() {',
    ...(commandHistory
      ? [
          '    __wsh_ec=$?;',
          '    __wsh_hist=$(HISTTIMEFORMAT= history 1 2>/dev/null);',
          '    __wsh_cmd=$(printf "%s" "$__wsh_hist" | sed "s/^[[:space:]]*[0-9][0-9]*[[:space:]]*//");',
          '    if [ "$__wsh_ready" = "1" ] && [ -n "$__wsh_cmd" ] && [ "$__wsh_hist" != "$__wsh_last_hist" ]; then',
          '      __wsh_emit "633;Eh;$(__wsh_hex "$__wsh_cmd")";',
          '      __wsh_emit "133;D;$__wsh_ec";',
          '    fi;',
          '    __wsh_last_hist=$__wsh_hist;'
        ]
      : []),
    '    __wsh_cwd;',
    '    __wsh_emit "133;A";',
    '    __wsh_ready=1;',
    '  };',
    '  PROMPT_COMMAND="__wsh_post${PROMPT_COMMAND:+;$PROMPT_COMMAND}";',
    'elif [ -n "$ZSH_VERSION" ]; then',
    ...(commandHistory
      ? [
          '  __wsh_pre() {',
          '    __wsh_emit "633;Eh;$(__wsh_hex "$1")";',
          '    __wsh_emit "133;C";',
          '  };'
        ]
      : []),
    '  __wsh_post() {',
    ...(commandHistory ? ['    __wsh_ec=$?;', '    __wsh_emit "133;D;$__wsh_ec";'] : []),
    '    __wsh_cwd;',
    '    __wsh_emit "133;A";',
    '  };',
    '  autoload -Uz add-zsh-hook >/dev/null 2>&1;',
    ...(commandHistory ? ['  add-zsh-hook preexec __wsh_pre >/dev/null 2>&1;'] : []),
    '  add-zsh-hook precmd __wsh_post >/dev/null 2>&1;',
    'fi'
  ]

  return lines
}

const SHELL_INTEGRATION_LINES = buildShellIntegrationLines({ commandHistory: true })
const SHELL_INTEGRATION_CWD_LINES = buildShellIntegrationLines({ commandHistory: false })
const SHELL_INTEGRATION_ONE_LINER = SHELL_INTEGRATION_LINES.join(' ')
const SHELL_INTEGRATION_CWD_ONE_LINER = SHELL_INTEGRATION_CWD_LINES.join(' ')

export const SHELL_INTEGRATION_MULTILINE = SHELL_INTEGRATION_LINES.join('\n')

/**
 * Bytes to write to the PTY to install shell integration inline. Leading space
 * lets the user's HIST_IGNORE_SPACE / HISTCONTROL=ignorespace suppress it from
 * shell history. Trailing `\r` submits the line.
 */
export function createShellIntegrationScript(options: ShellIntegrationOptions = {}): string {
  const command =
    options.commandHistory === false ? SHELL_INTEGRATION_CWD_ONE_LINER : SHELL_INTEGRATION_ONE_LINER
  return ` ${command}\r`
}

export const SHELL_INTEGRATION_SCRIPT = createShellIntegrationScript({ commandHistory: true })

export const SHELL_INTEGRATION_CWD_SCRIPT = createShellIntegrationScript({ commandHistory: false })

export const SHELL_INTEGRATION_INSTALL_ECHO = SHELL_INTEGRATION_SCRIPT.replace(/\r$/, '')

export const SHELL_INTEGRATION_CWD_INSTALL_ECHO = SHELL_INTEGRATION_CWD_SCRIPT.replace(/\r$/, '')

export function stripShellIntegrationInstallEcho(data: string): {
  cleaned: string
  matched: boolean
} {
  const commands = [
    SHELL_INTEGRATION_INSTALL_ECHO,
    SHELL_INTEGRATION_INSTALL_ECHO.trimStart(),
    SHELL_INTEGRATION_CWD_INSTALL_ECHO,
    SHELL_INTEGRATION_CWD_INSTALL_ECHO.trimStart()
  ]

  for (const command of commands) {
    const index = data.indexOf(command)
    if (index === -1) {
      continue
    }

    let prefix = data.slice(0, index)
    prefix = prefix.replace(/[ \b]+$/, '')
    let suffix = data.slice(index + command.length)
    suffix = suffix.replace(/^\r?\n?/, '')

    return {
      cleaned: prefix + suffix,
      matched: true
    }
  }

  return { cleaned: data, matched: false }
}

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
