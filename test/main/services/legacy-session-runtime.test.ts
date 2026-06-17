import { LegacySessionRuntime } from '@main/services/legacy-session-runtime'
import type { SessionManager } from '@main/session-manager'

describe('LegacySessionRuntime', () => {
  it('delegates session operations to SessionManager', async () => {
    const manager = {
      connect: vi.fn(async () => ({ ok: true, session: { sessionId: 'session-1' } })),
      disconnect: vi.fn(async () => undefined),
      write: vi.fn(),
      resize: vi.fn(async () => undefined)
    } as unknown as SessionManager
    const runtime = new LegacySessionRuntime(manager)

    await runtime.connect({ serverId: 'server-1', sessionId: 'session-1' } as never)
    runtime.write('session-1', 'pwd\n')
    await runtime.resize('session-1', 120, 34)
    await runtime.disconnect('session-1')

    expect(manager.connect).toHaveBeenCalledWith({ serverId: 'server-1', sessionId: 'session-1' })
    expect(manager.write).toHaveBeenCalledWith('session-1', 'pwd\n')
    expect(manager.resize).toHaveBeenCalledWith('session-1', 120, 34)
    expect(manager.disconnect).toHaveBeenCalledWith('session-1')
  })
})
