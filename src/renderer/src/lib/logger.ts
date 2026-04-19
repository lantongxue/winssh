import type { LogLevel } from '@shared/observability'

function log(level: LogLevel, message: string, data?: unknown) {
  const event = {
    data,
    level,
    message,
    source: 'renderer',
    timestamp: new Date().toISOString()
  }

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

