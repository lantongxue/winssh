import { parentPort } from 'node:worker_threads'
import { createOscScannerState, scanOscChunk } from '../../osc-scanner'
import type { OscCommandRecord } from '../../services/osc-history-dispatcher'

type OscHistoryWorkerRequest = {
  type: 'scan'
  sessionId: string
  chunk: string
  cwd?: string | null
}

type OscHistoryWorkerEvent =
  | { type: 'commandRecorded'; record: OscCommandRecord }
  | { type: 'cwdChanged'; sessionId: string; cwd: string }
  | { type: 'data'; sessionId: string; data: string }

type PostMessage = (message: OscHistoryWorkerEvent) => void

interface PendingCommand {
  command: string | null
  cwd: string | null
  startedAt: number | null
}

export function createOscHistoryWorkerMessageHandler(postMessage: PostMessage) {
  const scannerState = createOscScannerState()
  const pendingCommand: PendingCommand = { command: null, cwd: null, startedAt: null }

  return (message: OscHistoryWorkerRequest): void => {
    if (message.type !== 'scan') {
      return
    }

    const data = scanOscChunk(scannerState, message.chunk, {
      onCommandText: (command) => {
        pendingCommand.command = command
      },
      onCommandPre: () => {
        pendingCommand.startedAt ??= Date.now()
        pendingCommand.cwd ??= message.cwd ?? null
      },
      onCommandDone: (exitCode) => {
        if (!pendingCommand.command || pendingCommand.startedAt === null) {
          pendingCommand.command = null
          pendingCommand.startedAt = null
          pendingCommand.cwd = null
          return
        }

        postMessage({
          type: 'commandRecorded',
          record: {
            sessionId: message.sessionId,
            command: pendingCommand.command,
            cwd: pendingCommand.cwd,
            startedAt: new Date(pendingCommand.startedAt).toISOString(),
            finishedAt: new Date().toISOString(),
            exitCode
          }
        })
        pendingCommand.command = null
        pendingCommand.startedAt = null
        pendingCommand.cwd = null
      },
      onCwd: (cwd) => {
        postMessage({ type: 'cwdChanged', sessionId: message.sessionId, cwd })
      }
    })

    if (data.length > 0) {
      postMessage({ type: 'data', sessionId: message.sessionId, data })
    }
  }
}

if (parentPort) {
  const port = parentPort
  const handleMessage = createOscHistoryWorkerMessageHandler((message) => {
    port.postMessage(message)
  })

  port.on('message', (message) => {
    handleMessage(message as OscHistoryWorkerRequest)
  })
}
