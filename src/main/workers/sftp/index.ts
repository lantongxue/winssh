import { parentPort } from 'node:worker_threads'
import { encodeContent, smartDecode } from '../../encoding'

export const SFTP_WORKER_CHUNK_SIZE = 256 * 1024

type SftpWorkerRequest =
  | { type: 'list'; requestId: string; sessionId: string; remotePath: string }
  | { type: 'readFile'; requestId: string; sessionId: string; remotePath: string }
  | {
      type: 'writeFile'
      requestId: string
      sessionId: string
      remotePath: string
      contents: string
      encoding?: string
    }
  | { type: 'cancelReadFile'; sessionId: string; remotePath: string }

type SftpWorkerOperations = {
  list?(sessionId: string, remotePath: string): Promise<unknown>
  readFile?(sessionId: string, remotePath: string, chunkSize: number): Promise<Buffer>
  writeFile?(sessionId: string, remotePath: string, contents: Buffer): Promise<void>
  cancelReadFile?(sessionId: string, remotePath: string): void
}

type PostMessage = (message: unknown) => void

export function createSftpWorkerMessageHandler(
  operations: SftpWorkerOperations,
  postMessage: PostMessage
) {
  return async (message: SftpWorkerRequest): Promise<void> => {
    if (message.type === 'cancelReadFile') {
      operations.cancelReadFile?.(message.sessionId, message.remotePath)
      return
    }

    try {
      const result = await dispatchSftpMessage(operations, message)
      postMessage({
        type: 'ack',
        requestId: message.requestId,
        ok: true,
        ...(result === undefined ? {} : { result })
      })
    } catch (error) {
      postMessage({
        type: 'ack',
        requestId: message.requestId,
        ok: false,
        message: error instanceof Error ? error.message : 'SFTP worker request failed'
      })
    }
  }
}

async function dispatchSftpMessage(
  operations: SftpWorkerOperations,
  message: Exclude<SftpWorkerRequest, { type: 'cancelReadFile' }>
) {
  switch (message.type) {
    case 'list':
      return requireOperation(operations.list, 'list')(message.sessionId, message.remotePath)
    case 'readFile': {
      const buffer = await requireOperation(operations.readFile, 'readFile')(
        message.sessionId,
        message.remotePath,
        SFTP_WORKER_CHUNK_SIZE
      )
      return smartDecode(buffer)
    }
    case 'writeFile':
      return requireOperation(operations.writeFile, 'writeFile')(
        message.sessionId,
        message.remotePath,
        encodeContent(message.contents, message.encoding)
      )
  }
}

function requireOperation<TOperation>(
  operation: TOperation | undefined,
  name: string
): TOperation {
  if (!operation) {
    throw new Error(`SFTP worker operation unavailable: ${name}`)
  }
  return operation
}

if (parentPort) {
  const port = parentPort
  const handleMessage = createSftpWorkerMessageHandler({}, (message) => {
    port.postMessage(message)
  })

  port.on('message', (message) => {
    void handleMessage(message as SftpWorkerRequest)
  })
}
