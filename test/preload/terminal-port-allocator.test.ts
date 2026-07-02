import { TerminalPortAllocator } from '../../src/preload/terminal-port-allocator'

describe('TerminalPortAllocator', () => {
  it('creates a channel and registers one port with main', async () => {
    const registerMainPort = vi.fn(async () => undefined)
    const allocator = new TerminalPortAllocator({ registerMainPort })

    const rendererPort = await allocator.create('session-1')

    expect(rendererPort).toBeInstanceOf(MessagePort)
    expect(registerMainPort).toHaveBeenCalledWith('session-1', expect.any(MessagePort))
  })

  it('closes previous renderer port for the same session', async () => {
    const allocator = new TerminalPortAllocator({ registerMainPort: vi.fn(async () => undefined) })
    const first = await allocator.create('session-1')
    const close = vi.spyOn(first, 'close')

    await allocator.create('session-1')

    expect(close).toHaveBeenCalledOnce()
  })
})
