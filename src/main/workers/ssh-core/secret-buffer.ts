export class SecretBuffer {
  private readonly buffer: Buffer
  private disposed = false

  constructor(secret: string) {
    this.buffer = Buffer.from(secret, 'utf8')
  }

  unwrap(): Buffer {
    if (this.disposed) {
      throw new Error('SecretBuffer has been disposed')
    }

    return this.buffer
  }

  dispose(): void {
    this.buffer.fill(0)
    this.disposed = true
  }
}
