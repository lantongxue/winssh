import { SftpDispatcher } from '@main/services/sftp-dispatcher'

describe('SftpDispatcher', () => {
  it('delegates readFile to legacy runtime when worker mode is disabled', async () => {
    const legacyRuntime = {
      readFile: vi.fn(async () => ({ content: 'hello', encoding: 'utf8' }))
    }
    const dispatcher = new SftpDispatcher({
      legacyRuntime: legacyRuntime as never,
      useWorker: false
    })

    await expect(dispatcher.readFile('session-1', '/tmp/a.txt')).resolves.toEqual({
      content: 'hello',
      encoding: 'utf8'
    })
    expect(legacyRuntime.readFile).toHaveBeenCalledWith('session-1', '/tmp/a.txt')
  })

  it('sends cancel to the active worker request when worker mode is enabled', () => {
    const postMessage = vi.fn()
    const dispatcher = new SftpDispatcher({
      legacyRuntime: {} as never,
      useWorker: true,
      getWorkerPort: () => ({ postMessage }) as never
    })

    dispatcher.cancelReadFile('session-1', '/tmp/a.txt')

    expect(postMessage).toHaveBeenCalledWith({
      type: 'cancelReadFile',
      sessionId: 'session-1',
      remotePath: '/tmp/a.txt'
    })
  })
})
