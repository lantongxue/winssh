import { parentPort } from 'node:worker_threads'
import { sshCoreInboundSchema, type SshCoreInbound } from '@shared/ssh-protocol'
import { SshCoreSessionWorker } from './session-worker'

type PostMessage = (message: unknown) => void

interface DispatchResult {
  ackResult?: unknown
  afterAck?: () => void
}

export function createSshCoreMessageHandler(
  sessionWorker: SshCoreSessionWorker,
  postMessage: PostMessage
) {
  return async (rawMessage: unknown): Promise<void> => {
    const message = sshCoreInboundSchema.parse(rawMessage)

    if (message.type === 'hostTrustResult') {
      sessionWorker.resolveHostTrust(message.requestId, message.ok && message.trusted === true)
      return
    }

    let afterAck: (() => void) | undefined
    try {
      const result = await dispatchMessage(sessionWorker, message)
      const ackResult = isDispatchResult(result) ? result.ackResult : result
      afterAck = isDispatchResult(result) ? result.afterAck : undefined
      postMessage({
        type: 'ack',
        requestId: message.requestId,
        ok: true,
        ...(ackResult === undefined ? {} : { result: ackResult })
      })
    } catch (error) {
      postMessage({
        type: 'ack',
        requestId: message.requestId,
        ok: false,
        message: error instanceof Error ? error.message : 'SSH worker command failed'
      })
      return
    }

    afterAck?.()
  }
}

function isDispatchResult(result: unknown): result is DispatchResult {
  return typeof result === 'object' && result !== null && 'ackResult' in result
}

async function dispatchMessage(sessionWorker: SshCoreSessionWorker, message: SshCoreInbound) {
  switch (message.type) {
    case 'connect':
      return sessionWorker.connect(message.config)
    case 'disconnect':
      return sessionWorker.disconnect(message.sessionId)
    case 'resize':
      return sessionWorker.resize(message.sessionId, message.cols, message.rows)
    case 'write':
      return sessionWorker.write(message.sessionId, Buffer.from(message.data))
    case 'sftp:listDirectory':
      return sessionWorker.listDirectory(message.sessionId, message.remotePath)
    case 'sftp:createFile':
      return sessionWorker.createFile(message.sessionId, message.remotePath)
    case 'sftp:openFileReadStream': {
      const start = await sessionWorker.openFileReadStream(message.sessionId, message.remotePath)
      return {
        ackResult: start,
        afterAck: () => sessionWorker.startFileReadStream(start.streamId)
      }
    }
    case 'sftp:openFileWriteStream':
      return sessionWorker.openFileWriteStream(
        message.sessionId,
        message.remotePath,
        message.encoding
      )
    case 'sftp:writeFileChunk':
      return sessionWorker.writeFileChunk(message.streamId, message.chunk)
    case 'sftp:closeFileWriteStream':
      return sessionWorker.closeFileWriteStream(message.streamId)
    case 'sftp:cancelFileStream':
      return sessionWorker.cancelFileStream(message.streamId)
    case 'sftp:makeDirectory':
      return sessionWorker.makeDirectory(message.sessionId, message.remotePath)
    case 'sftp:rename':
      return sessionWorker.rename(message.sessionId, message.sourcePath, message.targetPath)
    case 'sftp:remove':
      return sessionWorker.remove(message.sessionId, message.remotePath)
    case 'hostTrustResult':
      return undefined
  }
}

if (parentPort) {
  const port = parentPort
  const sessionWorker = new SshCoreSessionWorker({
    postMessage: (message, transferList) => {
      port.postMessage(message, transferList)
    }
  })
  const handleMessage = createSshCoreMessageHandler(sessionWorker, (message) => {
    port.postMessage(message)
  })

  port.on('message', (message) => {
    void handleMessage(message)
  })
}
