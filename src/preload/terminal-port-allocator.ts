export interface TerminalPortAllocatorOptions {
  registerMainPort: (sessionId: string, port: MessagePort) => Promise<void>
}

export class TerminalPortAllocator {
  private readonly rendererPorts = new Map<string, MessagePort>()

  constructor(private readonly options: TerminalPortAllocatorOptions) {}

  async create(sessionId: string): Promise<MessagePort> {
    this.close(sessionId)
    const channel = new MessageChannel()
    this.rendererPorts.set(sessionId, channel.port2)
    await this.options.registerMainPort(sessionId, channel.port1)
    return channel.port2
  }

  close(sessionId: string): void {
    const existing = this.rendererPorts.get(sessionId)
    if (!existing) {
      return
    }

    this.rendererPorts.delete(sessionId)
    existing.close()
  }

  dispose(): void {
    for (const sessionId of this.rendererPorts.keys()) {
      this.close(sessionId)
    }
  }
}
