import { PortForwardDispatcher } from '@main/services/port-forward-dispatcher'

describe('PortForwardDispatcher', () => {
  it('keeps rules session-scoped and delegates to legacy runtime while disabled', async () => {
    const legacyRuntime = {
      listPortForwards: vi.fn(() => []),
      createPortForward: vi.fn(async () => ({ id: 'rule-1', status: 'stopped' }))
    }
    const dispatcher = new PortForwardDispatcher({
      legacyRuntime: legacyRuntime as never,
      useWorker: false
    })

    dispatcher.list('session-1')
    await dispatcher.create('session-1', { type: 'local' } as never)

    expect(legacyRuntime.listPortForwards).toHaveBeenCalledWith('session-1')
    expect(legacyRuntime.createPortForward).toHaveBeenCalledWith('session-1', { type: 'local' })
  })
})
