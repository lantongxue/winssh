import { randomUUID } from 'node:crypto'
import { parentPort } from 'node:worker_threads'
import type { PortForwardInput, PortForwardRule, PortForwardStatus } from '@shared/types'

type PortForwardWorkerRequest =
  | { type: 'list'; requestId: string; sessionId: string }
  | { type: 'create'; requestId: string; sessionId: string; input: PortForwardInput }
  | { type: 'start'; requestId: string; sessionId: string; ruleId: string }
  | { type: 'stop'; requestId: string; sessionId: string; ruleId: string }
  | { type: 'remove'; requestId: string; sessionId: string; ruleId: string }
  | { type: 'disposeSession'; sessionId: string }

type PostMessage = (message: unknown) => void

export class PortForwardWorkerState {
  private readonly rulesBySession = new Map<string, PortForwardRule[]>()

  list(sessionId: string): PortForwardRule[] {
    return this.getRules(sessionId).map(cloneRule)
  }

  create(sessionId: string, input: PortForwardInput): PortForwardRule {
    const now = new Date().toISOString()
    const rule: PortForwardRule = {
      ...input,
      id: randomUUID(),
      sessionId,
      enabled: false,
      status: 'stopped',
      createdAt: now,
      updatedAt: now
    }
    this.rulesBySession.set(sessionId, [...this.getRules(sessionId), rule])
    return cloneRule(rule)
  }

  start(sessionId: string, ruleId: string): PortForwardRule {
    return this.updateRule(sessionId, ruleId, 'active', true)
  }

  stop(sessionId: string, ruleId: string): PortForwardRule {
    return this.updateRule(sessionId, ruleId, 'stopped', false)
  }

  remove(sessionId: string, ruleId: string): void {
    this.rulesBySession.set(
      sessionId,
      this.getRules(sessionId).filter((rule) => rule.id !== ruleId)
    )
  }

  disposeSession(sessionId: string): void {
    this.rulesBySession.delete(sessionId)
  }

  private updateRule(
    sessionId: string,
    ruleId: string,
    status: PortForwardStatus,
    enabled: boolean
  ): PortForwardRule {
    let updated: PortForwardRule | null = null
    const rules = this.getRules(sessionId).map((rule) => {
      if (rule.id !== ruleId) {
        return rule
      }

      updated = {
        ...rule,
        status,
        enabled,
        updatedAt: new Date().toISOString(),
        lastError: undefined
      }
      return updated
    })

    if (!updated) {
      throw new Error(`Port forward rule not found: ${ruleId}`)
    }

    this.rulesBySession.set(sessionId, rules)
    return cloneRule(updated)
  }

  private getRules(sessionId: string): PortForwardRule[] {
    return this.rulesBySession.get(sessionId) ?? []
  }
}

export function createPortForwardWorkerMessageHandler(
  state: PortForwardWorkerState,
  postMessage: PostMessage
) {
  return async (message: PortForwardWorkerRequest): Promise<void> => {
    if (message.type === 'disposeSession') {
      state.disposeSession(message.sessionId)
      return
    }

    try {
      const result = dispatchMessage(state, message)
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
        message: error instanceof Error ? error.message : 'Port forward worker request failed'
      })
    }
  }
}

function dispatchMessage(
  state: PortForwardWorkerState,
  message: Exclude<PortForwardWorkerRequest, { type: 'disposeSession' }>
) {
  switch (message.type) {
    case 'list':
      return state.list(message.sessionId)
    case 'create':
      return state.create(message.sessionId, message.input)
    case 'start':
      return state.start(message.sessionId, message.ruleId)
    case 'stop':
      return state.stop(message.sessionId, message.ruleId)
    case 'remove':
      return state.remove(message.sessionId, message.ruleId)
  }
}

function cloneRule(rule: PortForwardRule): PortForwardRule {
  return { ...rule }
}

if (parentPort) {
  const port = parentPort
  const state = new PortForwardWorkerState()
  const handleMessage = createPortForwardWorkerMessageHandler(state, (message) => {
    port.postMessage(message)
  })

  port.on('message', (message) => {
    void handleMessage(message as PortForwardWorkerRequest)
  })
}
