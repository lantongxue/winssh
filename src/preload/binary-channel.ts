interface BinaryPort {
  postMessage(message: unknown, transferList?: Array<ArrayBuffer>): void
  close(): void
}

export interface BinaryChannelOptions {
  highWaterMarkBytes: number
}

export interface BinaryChannelEnqueueResult {
  droppedFrames: number
  queuedBytes: number
}

export class BinaryChannel {
  private readonly queue: ArrayBuffer[] = []
  private queuedBytes = 0

  constructor(
    private readonly port: BinaryPort,
    private readonly options: BinaryChannelOptions
  ) {}

  enqueue(frame: ArrayBuffer): BinaryChannelEnqueueResult {
    this.queue.push(frame)
    this.queuedBytes += frame.byteLength

    let droppedFrames = 0
    const targetBytes = Math.floor(this.options.highWaterMarkBytes / 2)

    while (this.queuedBytes > this.options.highWaterMarkBytes && this.queue.length > 0) {
      const dropped = this.queue.shift()
      if (!dropped) {
        break
      }
      this.queuedBytes -= dropped.byteLength
      droppedFrames += 1

      if (this.queuedBytes <= targetBytes) {
        break
      }
    }

    return { droppedFrames, queuedBytes: this.queuedBytes }
  }

  flush(): void {
    while (this.queue.length > 0) {
      const frame = this.queue.shift()
      if (!frame) {
        continue
      }
      this.queuedBytes -= frame.byteLength
      this.port.postMessage({ type: 'data', frame }, [frame])
    }
  }

  dispose(): void {
    this.queue.length = 0
    this.queuedBytes = 0
    this.port.close()
  }
}
