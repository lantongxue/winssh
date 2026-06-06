import type {
  AppActivityEvent,
  AppFocusEvent,
  CommandRecordedEvent,
  HostTrustRequest,
  LocalTerminalDataEvent,
  LocalTerminalExitEvent,
  LocalTerminalStateEvent,
  PortForwardStateEvent,
  SessionCwdEvent,
  SessionDataEvent,
  SessionErrorEvent,
  SessionExitEvent,
  SessionStateEvent,
  SystemMenuAction,
  TransferProgressEvent,
  UpdateState,
  WindowState
} from './types'

export interface IpcChannelMap {
  'commandHistory:added': CommandRecordedEvent
  'localTerminals:data': LocalTerminalDataEvent
  'localTerminals:exit': LocalTerminalExitEvent
  'localTerminals:state': LocalTerminalStateEvent
  'portForwards:state': PortForwardStateEvent
  'sessions:cwdChanged': SessionCwdEvent
  'sessions:data': SessionDataEvent
  'sessions:error': SessionErrorEvent
  'sessions:exit': SessionExitEvent
  'sessions:state': SessionStateEvent
  'sftp:transfer': TransferProgressEvent
  'system:hostTrustRequest': HostTrustRequest
  'system:menuAction': SystemMenuAction
  'system:appFocus': AppFocusEvent
  'system:appActivity': AppActivityEvent
  'system:windowState': WindowState
  'updates:state': UpdateState
}

export type IpcChannel = keyof IpcChannelMap
export type IpcPayload<C extends IpcChannel> = IpcChannelMap[C]
export type IpcCallback<C extends IpcChannel> = (payload: IpcPayload<C>) => void
