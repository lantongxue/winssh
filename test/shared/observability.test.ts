import { describe, expect, it } from 'vitest'
import { createObservableEvent, createRequestId } from '@shared/observability'

describe('observability helpers', () => {
  it('creates observable events with timestamp and metadata', () => {
    const event = createObservableEvent('sessions:state', 'main', 'corr-1', {
      sessionId: 'session-1'
    })

    expect(event).toMatchObject({
      correlationId: 'corr-1',
      payload: {
        sessionId: 'session-1'
      },
      source: 'main',
      type: 'sessions:state'
    })
    expect(Date.parse(event.timestamp)).not.toBeNaN()
  })

  it('creates prefixed request ids', () => {
    const requestId = createRequestId('sessions')

    expect(requestId.startsWith('sessions:')).toBe(true)
  })
})
