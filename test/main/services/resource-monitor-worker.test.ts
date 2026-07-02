import { createResourceMonitorSnapshot } from '@main/workers/resource-monitor'

describe('resource monitor worker', () => {
  it('returns unsupported snapshot on non-linux platforms', async () => {
    const snapshot = await createResourceMonitorSnapshot({
      platform: 'win32',
      sessionId: 'session-1'
    })

    expect(snapshot.platform).toBe('windows')
    expect(snapshot.cpu).toBeNull()
  })
})
