import type { QuickConnectTarget } from './types'

const quickConnectPattern = /^ssh\s+([^@\s]+)@([^\s@:]+)$/i

export function parseQuickConnectInput(input: string): QuickConnectTarget | null {
  const match = quickConnectPattern.exec(input.trim())
  if (!match) {
    return null
  }

  const username = match[1]?.trim()
  const host = match[2]?.trim()

  if (!username || !host) {
    return null
  }

  return {
    authType: 'password',
    host,
    port: 22,
    username
  }
}

export function formatQuickConnectTarget(target: QuickConnectTarget): string {
  return `${target.username}@${target.host}`
}
