import type {
  AppError,
  AppLogEvent,
  LogLevel,
  ObservableSource,
  OperationContext
} from '@shared/observability'
import { createRequestId } from '@shared/observability'

let appLogSink: ((event: AppLogEvent) => void) | null = null

function formatLogEvent(event: AppLogEvent) {
  return JSON.stringify(event, (_key, value) =>
    value instanceof Error
      ? {
          message: value.message,
          name: value.name,
          stack: value.stack
        }
      : value
  )
}

function writeLog(level: LogLevel, event: AppLogEvent) {
  const line = formatLogEvent(event)

  if (level === 'error') {
    console.error(line)
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  console.info(line)

  appLogSink?.(event)
}

export function setAppLogSink(sink: ((event: AppLogEvent) => void) | null) {
  appLogSink = sink
}

export function createOperationContext(
  source: ObservableSource,
  feature: string,
  action: string,
  context: Partial<Omit<OperationContext, 'action' | 'feature' | 'requestId' | 'source'>> = {}
): OperationContext {
  const requestId = createRequestId(feature)

  return {
    action,
    correlationId: context.correlationId ?? requestId,
    feature,
    requestId,
    serverId: context.serverId,
    sessionId: context.sessionId,
    source
  }
}

export function createLogger(source: ObservableSource) {
  const log = (
    level: LogLevel,
    message: string,
    options: {
      context?: Partial<OperationContext>
      data?: unknown
      error?: unknown
    } = {}
  ) => {
    writeLog(level, {
      context: options.context,
      data: options.data,
      error: options.error,
      level,
      message,
      source,
      timestamp: new Date().toISOString()
    })
  }

  return {
    debug: (message: string, options?: { context?: Partial<OperationContext>; data?: unknown }) =>
      log('debug', message, options),
    error: (
      message: string,
      options?: { context?: Partial<OperationContext>; data?: unknown; error?: unknown }
    ) => log('error', message, options),
    info: (message: string, options?: { context?: Partial<OperationContext>; data?: unknown }) =>
      log('info', message, options),
    warn: (
      message: string,
      options?: { context?: Partial<OperationContext>; data?: unknown; error?: unknown }
    ) => log('warn', message, options)
  }
}

export function toAppError(
  error: unknown,
  options: {
    code?: string
    correlationId?: string
    details?: Record<string, unknown>
    recoverable?: boolean
  } = {}
): AppError {
  if (isAppErrorLike(error)) {
    return {
      code: error.code,
      correlationId: error.correlationId ?? options.correlationId,
      details: error.details ?? options.details,
      message: error.message,
      recoverable: error.recoverable
    }
  }

  return {
    code: options.code ?? 'unexpected_error',
    correlationId: options.correlationId,
    details: options.details,
    message: error instanceof Error ? error.message : 'Unexpected error',
    recoverable: options.recoverable ?? false
  }
}

function isAppErrorLike(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'recoverable' in error
  )
}

