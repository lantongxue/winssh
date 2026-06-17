import { BinaryChannel } from '../../src/preload/binary-channel'

class FakePort {
  postMessage = vi.fn()
  close = vi.fn()
}

describe('BinaryChannel', () => {
  it('buffers frames and flushes them in order', () => {
    const port = new FakePort()
    const channel = new BinaryChannel(port as never, { highWaterMarkBytes: 1024 })
    const first = new ArrayBuffer(2)
    const second = new ArrayBuffer(3)

    channel.enqueue(first)
    channel.enqueue(second)
    channel.flush()

    expect(port.postMessage).toHaveBeenNthCalledWith(1, { type: 'data', frame: first }, [first])
    expect(port.postMessage).toHaveBeenNthCalledWith(2, { type: 'data', frame: second }, [second])
  })

  it('drops oldest frames when high water mark is exceeded', () => {
    const port = new FakePort()
    const channel = new BinaryChannel(port as never, { highWaterMarkBytes: 4 })

    const result = channel.enqueue(new ArrayBuffer(8))

    expect(result.droppedFrames).toBeGreaterThan(0)
    expect(result.queuedBytes).toBeLessThanOrEqual(4)
  })
})
