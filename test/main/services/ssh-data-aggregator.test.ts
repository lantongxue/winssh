import { SshDataAggregator } from '@main/services/ssh-data-aggregator'

class FakePort {
  postMessage = vi.fn()
  close = vi.fn()
}

describe('SshDataAggregator', () => {
  it('routes frames to the registered session port', () => {
    const port = new FakePort()
    const aggregator = new SshDataAggregator()
    const frame = new ArrayBuffer(4)

    aggregator.registerSessionPort('session-1', port as never)
    aggregator.routeFrame({ sessionId: 'session-1', frame, seq: 1, sentAtMs: performance.now() })

    expect(port.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'data', seq: 1, frame }),
      [frame]
    )
  })

  it('falls back to legacy sender when no port is registered', () => {
    const sendLegacyData = vi.fn()
    const aggregator = new SshDataAggregator({ sendLegacyData })

    aggregator.routeFrame({
      sessionId: 'session-1',
      frame: new TextEncoder().encode('hello').buffer,
      seq: 1,
      sentAtMs: performance.now()
    })

    expect(sendLegacyData).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({ sessionId: 'session-1', data: 'hello' })
    )
  })

  it('reports backpressure when port delivery fails', () => {
    const onBackpressure = vi.fn()
    const port = new FakePort()
    port.postMessage.mockImplementation(() => {
      throw new Error('closed')
    })
    const aggregator = new SshDataAggregator({ onBackpressure })
    const frame = new ArrayBuffer(4)

    aggregator.registerSessionPort('session-1', port as never)
    aggregator.routeFrame({ sessionId: 'session-1', frame, seq: 1, sentAtMs: performance.now() })

    expect(onBackpressure).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', droppedFrames: 1, queuedBytes: 4 })
    )
  })
})
