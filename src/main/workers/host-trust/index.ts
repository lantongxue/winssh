import { randomUUID } from 'node:crypto'
import { parentPort } from 'node:worker_threads'
import type { HostTrustKind, HostTrustRequest } from '@shared/types'

export interface HostTrustWorkerRequestInput {
  sessionId?: string
  requestId?: string
  kind?: HostTrustKind
  serverName?: string
  host: string
  port: number
  fingerprint: string
  knownFingerprint?: string
}

export type RendererSafeHostTrustRequest = HostTrustRequest & {
  sessionId?: string
}

type HostTrustWorkerMessage = {
  type: 'createRequest'
  requestId: string
  input: HostTrustWorkerRequestInput
}

export function createHostTrustRequest(
  input: HostTrustWorkerRequestInput
): RendererSafeHostTrustRequest {
  return {
    requestId: input.requestId ?? randomUUID(),
    kind: input.kind ?? (input.knownFingerprint ? 'hostChanged' : 'hostFirstSeen'),
    serverName: input.serverName ?? input.host,
    host: input.host,
    port: input.port,
    fingerprint: input.fingerprint,
    knownFingerprint: input.knownFingerprint,
    ...(input.sessionId ? { sessionId: input.sessionId } : {})
  }
}

if (parentPort) {
  const port = parentPort
  port.on('message', (message: HostTrustWorkerMessage) => {
    if (message.type !== 'createRequest') {
      return
    }

    port.postMessage({
      type: 'ack',
      requestId: message.requestId,
      ok: true,
      result: createHostTrustRequest(message.input)
    })
  })
}
