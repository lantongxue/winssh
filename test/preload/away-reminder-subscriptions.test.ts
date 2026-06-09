import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'
import type {
  AppFocusEvent,
  AppActivityEvent,
  SftpFileChunkEvent,
  SftpFileReadStreamStart,
  SftpFileStreamStateEvent,
  SftpFileWriteStreamStart
} from '@shared/types'
import type { WinsshApi } from '@shared/api'
import type { IpcChannelMap } from '@shared/ipc-channels'

describe('away-reminder preload subscriptions', () => {
  describe('IpcChannelMap includes system:appFocus and system:appActivity', () => {
    it('maps system:appFocus to AppFocusEvent', () => {
      const channel: keyof IpcChannelMap = 'system:appFocus'
      // Type-level assertion: IpcChannelMap['system:appFocus'] must be AppFocusEvent
      type Check = IpcChannelMap['system:appFocus'] extends AppFocusEvent ? true : false
      const _typeCheck: Check = true
      expect(_typeCheck).toBe(true)
      expect(channel).toBe('system:appFocus')
    })

    it('maps system:appActivity to AppActivityEvent', () => {
      const channel: keyof IpcChannelMap = 'system:appActivity'
      type Check = IpcChannelMap['system:appActivity'] extends AppActivityEvent ? true : false
      const _typeCheck: Check = true
      expect(_typeCheck).toBe(true)
      expect(channel).toBe('system:appActivity')
    })
  })

  describe('WinsshApi contract includes appFocus and appActivity', () => {
    it('system.appFocus.onStateChange accepts AppFocusEvent callback and returns Unsubscribe', () => {
      // Type-level check: WinsshApi.system.appFocus.onStateChange signature
      type MethodSig = WinsshApi['system']['appFocus']['onStateChange']
      type ExpectedSig = (callback: (event: AppFocusEvent) => void) => () => void
      type Match = MethodSig extends ExpectedSig ? true : false
      const _typeCheck: Match = true
      expect(_typeCheck).toBe(true)
    })

    it('system.appActivity.onStateChange accepts AppActivityEvent callback and returns Unsubscribe', () => {
      type MethodSig = WinsshApi['system']['appActivity']['onStateChange']
      type ExpectedSig = (callback: (event: AppActivityEvent) => void) => () => void
      type Match = MethodSig extends ExpectedSig ? true : false
      const _typeCheck: Match = true
      expect(_typeCheck).toBe(true)
    })
  })

  describe('createWinsshApiMock includes appFocus and appActivity subscriptions', () => {
    it('default mock provides appFocus.onStateChange returning unsubscribe', () => {
      const api = createWinsshApiMock()
      const unsubscribe = api.system.appFocus.onStateChange(() => {})
      expect(typeof unsubscribe).toBe('function')
      expect(unsubscribe()).toBeUndefined()
    })

    it('default mock provides appActivity.onStateChange returning unsubscribe', () => {
      const api = createWinsshApiMock()
      const unsubscribe = api.system.appActivity.onStateChange(() => {})
      expect(typeof unsubscribe).toBe('function')
      expect(unsubscribe()).toBeUndefined()
    })

    it('appFocus.onStateChange callback is invoked when override provides it', () => {
      const received: AppFocusEvent[] = []
      const api = createWinsshApiMock({
        system: {
          appFocus: {
            onStateChange: (callback) => {
              callback({ phase: 'blurred' })
              callback({ phase: 'focused' })
              return () => undefined
            }
          }
        }
      })
      api.system.appFocus.onStateChange((event) => received.push(event))
      expect(received).toEqual([{ phase: 'blurred' }, { phase: 'focused' }])
    })

    it('appActivity.onStateChange callback is invoked when override provides it', () => {
      const received: AppActivityEvent[] = []
      const api = createWinsshApiMock({
        system: {
          appActivity: {
            onStateChange: (callback) => {
              callback({ phase: 'sleep' })
              callback({ phase: 'wake' })
              return () => undefined
            }
          }
        }
      })
      api.system.appActivity.onStateChange((event) => received.push(event))
      expect(received).toEqual([{ phase: 'sleep' }, { phase: 'wake' }])
    })

    it('unsubscribe stops further callbacks via override', () => {
      let unsubscribed = false
      const received: AppFocusEvent[] = []
      const api = createWinsshApiMock({
        system: {
          appFocus: {
            onStateChange: (callback) => {
              callback({ phase: 'blurred' })
              return () => {
                unsubscribed = true
              }
            }
          }
        }
      })
      const unsub = api.system.appFocus.onStateChange((event) => received.push(event))
      unsub()
      expect(unsubscribed).toBe(true)
    })
  })
})

describe('SFTP file stream API contract', () => {
  it('exposes stream methods instead of whole-file editor methods', async () => {
    type SftpApi = WinsshApi['sftp']
    const _readStart: Awaited<ReturnType<SftpApi['openFileReadStream']>> =
      {} as SftpFileReadStreamStart
    const _writeStart: Awaited<ReturnType<SftpApi['openFileWriteStream']>> =
      {} as SftpFileWriteStreamStart
    const _chunk: Parameters<SftpApi['onFileChunk']>[0] = (_event: SftpFileChunkEvent) => {}
    const _state: Parameters<SftpApi['onFileStreamState']>[0] = (
      _event: SftpFileStreamStateEvent
    ) => {}

    const api = createWinsshApiMock()

    const sftpApiRecord = api.sftp as unknown as Record<string, unknown>
    expect(sftpApiRecord['readFile']).toBeUndefined()
    expect(sftpApiRecord['writeFile']).toBeUndefined()
    await expect(api.sftp.openFileReadStream('session-1', '/etc/hosts')).resolves.toMatchObject({
      encoding: 'utf8',
      remotePath: '/etc/hosts',
      sessionId: 'session-1',
      streamId: expect.any(String)
    })
    await expect(
      api.sftp.openFileWriteStream('session-1', '/etc/hosts', 'utf8')
    ).resolves.toMatchObject({
      remotePath: '/etc/hosts',
      sessionId: 'session-1',
      streamId: expect.any(String)
    })

    void _readStart
    void _writeStart
    void _chunk
    void _state
  })
})
