import { terminalWorkerMessageSchema } from '@shared/worker-protocol'

describe('worker protocol', () => {
  it('accepts terminal attach message', () => {
    const result = terminalWorkerMessageSchema.parse({
      type: 'attach',
      sessionId: 'session-1',
      useOffscreenCanvas: false
    })

    expect(result.type).toBe('attach')
  })

  it('accepts degraded message with known reason', () => {
    const result = terminalWorkerMessageSchema.parse({
      type: 'degraded',
      sessionId: 'session-1',
      reason: 'offscreen_canvas_unavailable'
    })

    expect(result.reason).toBe('offscreen_canvas_unavailable')
  })
})
