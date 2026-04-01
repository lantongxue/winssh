import type { App } from 'electron'

export const HARDWARE_ACCELERATION_ENV = 'WINSSH_HARDWARE_ACCELERATION'

const ENABLED_ENV_VALUES = new Set(['1', 'true', 'on'])
const DISABLED_ENV_VALUES = new Set(['0', 'false', 'off'])

function normalizeEnvValue(value: string | undefined): string | null {
  const normalized = value?.trim().toLowerCase()
  return normalized ? normalized : null
}

export function shouldDisableHardwareAcceleration(
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const override = normalizeEnvValue(env[HARDWARE_ACCELERATION_ENV])

  if (override && ENABLED_ENV_VALUES.has(override)) {
    return false
  }

  if (override && DISABLED_ENV_VALUES.has(override)) {
    return true
  }

  return platform === 'win32'
}

export function configureHardwareAcceleration(
  targetApp: Pick<App, 'disableHardwareAcceleration'>,
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv = process.env
): void {
  if (shouldDisableHardwareAcceleration(platform, env)) {
    targetApp.disableHardwareAcceleration()
  }
}
