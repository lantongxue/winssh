import type { AppLogEvent, LogLevel } from '@shared/observability'
import { winsshClient } from '@/features/shared/api/winssh-client'

function log(level: LogLevel, message: string, data?: unknown) {
  const event: AppLogEvent = {
    data,
    level,
    message,
    source: 'renderer',
    timestamp: new Date().toISOString()
  }

  void winsshClient.logs.write(event).catch(() => undefined)

  if (level === 'error') {
    console.error(JSON.stringify(event))
    return
  }

  if (level === 'warn') {
    console.warn(JSON.stringify(event))
    return
  }

  console.info(JSON.stringify(event))
}

export const rendererLogger = {
  debug: (message: string, data?: unknown) => log('debug', message, data),
  error: (message: string, data?: unknown) => log('error', message, data),
  info: (message: string, data?: unknown) => log('info', message, data),
  warn: (message: string, data?: unknown) => log('warn', message, data)
}

