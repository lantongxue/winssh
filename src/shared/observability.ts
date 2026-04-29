export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type ObservableSource = 'main' | 'preload' | 'renderer'

export interface AppLogEvent {
  context?: Partial<OperationContext>
  data?: unknown
  error?: unknown
  level: LogLevel
  message: string
  source: ObservableSource
  timestamp: string
}

export interface OperationContext {
  action: string
  correlationId: string
  feature: string
  requestId: string
  serverId?: string
  sessionId?: string
  source: ObservableSource
}

export interface AppError {
  code: string
  correlationId?: string
  details?: Record<string, unknown>
  message: string
  recoverable: boolean
}

export interface ObservableEvent<TPayload> {
  correlationId: string
  payload: TPayload
  source: ObservableSource
  timestamp: string
  type: string
}

export type DomainResult<TData> =
  | {
      context?: OperationContext
      data: TData
      ok: true
    }
  | {
      context?: OperationContext
      error: AppError
      ok: false
    }

export function createObservableEvent<TPayload>(
  type: string,
  source: ObservableSource,
  correlationId: string,
  payload: TPayload
): ObservableEvent<TPayload> {
  return {
    correlationId,
    payload,
    source,
    timestamp: new Date().toISOString(),
    type
  }
}

export function createRequestId(prefix = 'req') {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}:${globalThis.crypto.randomUUID()}`
  }

  return `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`
}

