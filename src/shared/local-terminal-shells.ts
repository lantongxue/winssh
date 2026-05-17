import type { LocalTerminalShell } from './types'

const WINDOWS_LOCAL_TERMINAL_SHELLS: LocalTerminalShell[] = ['cmd', 'powershell']
const POSIX_LOCAL_TERMINAL_SHELLS: LocalTerminalShell[] = ['bash', 'zsh']

function normalizePlatform(platform: string | null | undefined) {
  return (platform ?? '').toLowerCase()
}

function getShellName(shellPath: string | null | undefined) {
  const trimmed = shellPath?.trim()
  if (!trimmed) {
    return null
  }

  const normalized = trimmed.replaceAll('\\', '/').split('/').at(-1)?.toLowerCase() ?? ''
  if (!normalized) {
    return null
  }

  return normalized.endsWith('.exe') ? normalized.slice(0, -4) : normalized
}

export function isWindowsLocalTerminalPlatform(platform: string | null | undefined) {
  const normalizedPlatform = normalizePlatform(platform)
  return normalizedPlatform === 'win32' || normalizedPlatform.startsWith('win')
}

export function getSupportedLocalTerminalShells(platform: string | null | undefined) {
  return isWindowsLocalTerminalPlatform(platform)
    ? [...WINDOWS_LOCAL_TERMINAL_SHELLS]
    : [...POSIX_LOCAL_TERMINAL_SHELLS]
}

export function getDefaultLocalTerminalShell(
  platform: string | null | undefined,
  envShellPath?: string | null
): LocalTerminalShell {
  const envShell = getShellName(envShellPath)
  const supportedShells = getSupportedLocalTerminalShells(platform)

  if (envShell && supportedShells.includes(envShell as LocalTerminalShell)) {
    return envShell as LocalTerminalShell
  }

  if (isWindowsLocalTerminalPlatform(platform)) {
    return 'powershell'
  }

  return normalizePlatform(platform).includes('mac') ? 'zsh' : 'bash'
}

export function normalizeLocalTerminalShell(
  shell: string | null | undefined,
  platform: string | null | undefined,
  envShellPath?: string | null
): LocalTerminalShell {
  const supportedShells = getSupportedLocalTerminalShells(platform)

  if (shell && supportedShells.includes(shell as LocalTerminalShell)) {
    return shell as LocalTerminalShell
  }

  return getDefaultLocalTerminalShell(platform, envShellPath)
}
