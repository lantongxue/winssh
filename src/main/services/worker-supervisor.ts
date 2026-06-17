import type { Worker } from 'node:worker_threads'
import { createLogger } from '../observability'

export type WorkerType =
  | 'ssh-core'
  | 'sftp'
  | 'port-forward'
  | 'osc-history'
  | 'resource-monitor'
  | 'host-trust'

export interface WorkerCrashRecord {
  workerId: string
  workerType: WorkerType
  sessionId: string
  exitCode: number
}

export interface WorkerHandle {
  workerId: string
  workerType: WorkerType
  sessionId: string
  startedAt: number
  worker: Pick<Worker, 'on' | 'terminate'>
}

export interface WorkerSupervisorOptions {
  spawn: (workerType: WorkerType, sessionId: string) => Pick<Worker, 'on' | 'terminate'>
  onCrash?: (record: WorkerCrashRecord) => void
}

export class WorkerSupervisor {
  private readonly logger = createLogger('main')
  private readonly workers = new Map<string, WorkerHandle>()

  constructor(private readonly options: WorkerSupervisorOptions) {}

  spawn(workerType: WorkerType, sessionId: string): WorkerHandle {
    const workerId = `${workerType}-${sessionId}-${Date.now()}`
    const worker = this.options.spawn(workerType, sessionId)
    const handle: WorkerHandle = {
      workerId,
      workerType,
      sessionId,
      startedAt: Date.now(),
      worker
    }

    this.workers.set(workerId, handle)
    worker.on('exit', (exitCode) => {
      this.workers.delete(workerId)

      if (exitCode !== 0) {
        const record = { workerId, workerType, sessionId, exitCode }
        this.logger.warn('Worker exited unexpectedly', { data: record })
        this.options.onCrash?.(record)
      }
    })

    return handle
  }

  list(): WorkerHandle[] {
    return [...this.workers.values()]
  }

  async terminateAll(): Promise<void> {
    const handles = this.list()
    this.workers.clear()
    await Promise.all(handles.map((handle) => handle.worker.terminate()))
  }
}
