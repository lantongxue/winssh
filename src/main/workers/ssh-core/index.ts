import { parentPort } from 'node:worker_threads'
import { sshCoreInboundSchema, type SshCoreInbound } from '@shared/ssh-protocol'
import { SshCoreSessionWorker } from './session-worker'

type PostMessage = (message: unknown) => void

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

    try {
      const result = await dispatchMessage(sessionWorker, message)
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
        message: error instanceof Error ? error.message : 'SSH worker command failed'
      })
    }
  }
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
    case 'sftp:readFile':
      return sessionWorker.readFile(message.sessionId, message.remotePath)
    case 'sftp:writeFile':
      return sessionWorker.writeFile(
        message.sessionId,
        message.remotePath,
        message.contents,
        message.encoding
      )
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
