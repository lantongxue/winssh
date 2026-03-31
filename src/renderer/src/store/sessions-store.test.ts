import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionsStore } from './sessions-store'

describe('sessions store', () => {
  beforeEach(() => {
    useSessionsStore.getState().clear()
  })

  it('adds and activates sessions', () => {
    useSessionsStore.getState().addSession({
      sessionId: '1',
      serverId: 'server-1',
      serverName: 'alpha',
      host: '127.0.0.1',
      port: 22,
      status: 'ready',
      connectedAt: new Date().toISOString(),
      currentPath: '/home'
    })

    const state = useSessionsStore.getState()
    expect(state.tabs).toHaveLength(1)
    expect(state.activeSessionId).toBe('1')
  })

  it('replaces a session when reconnecting', () => {
    const store = useSessionsStore.getState()
    store.addSession({
      sessionId: '1',
      serverId: 'server-1',
      serverName: 'alpha',
      host: '127.0.0.1',
      port: 22,
      status: 'error',
      connectedAt: new Date().toISOString(),
      currentPath: '/home'
    })

    store.replaceSession('1', {
      sessionId: '2',
      serverId: 'server-1',
      serverName: 'alpha',
      host: '127.0.0.1',
      port: 22,
      status: 'ready',
      connectedAt: new Date().toISOString(),
      currentPath: '/srv'
    })

    const state = useSessionsStore.getState()
    expect(state.tabs[0].sessionId).toBe('2')
    expect(state.activeSessionId).toBe('2')
  })

  it('creates a provisional session and swaps it with the real session summary', () => {
    const store = useSessionsStore.getState()

    store.addPendingSession({
      host: '10.0.0.1',
      port: 22,
      serverId: 'server-1',
      serverName: 'alpha',
      sessionId: 'pending:server-1'
    })

    expect(useSessionsStore.getState().tabs[0]?.provisional).toBe(true)
    expect(useSessionsStore.getState().activeSessionId).toBe('pending:server-1')

    store.replaceSession('pending:server-1', {
      sessionId: 'session-1',
      serverId: 'server-1',
      serverName: 'alpha',
      host: '10.0.0.1',
      port: 22,
      status: 'ready',
      connectedAt: new Date().toISOString(),
      currentPath: '/home'
    })

    const state = useSessionsStore.getState()
    expect(state.tabs[0]?.sessionId).toBe('session-1')
    expect(state.tabs[0]?.provisional).toBeUndefined()
    expect(state.activeSessionId).toBe('session-1')
  })
})
