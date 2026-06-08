export interface OscCommandRecord {
  sessionId: string
  command: string
  cwd: string | null
  startedAt: string
  finishedAt: string
  exitCode: number | null
}

export interface OscCwdChange {
  sessionId: string
  cwd: string
}

export interface OscHistoryDispatcherOptions {
  recordCommand: (record: OscCommandRecord) => void
  sendCwdChanged?: (event: OscCwdChange) => void
}

export class OscHistoryDispatcher {
  constructor(private readonly options: OscHistoryDispatcherOptions) {}

  handleCommandRecorded(record: OscCommandRecord): void {
    this.options.recordCommand(record)
  }

  handleCwdChanged(event: OscCwdChange): void {
    this.options.sendCwdChanged?.(event)
  }
}
