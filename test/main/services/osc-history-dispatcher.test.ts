import { OscHistoryDispatcher } from '@main/services/osc-history-dispatcher'

describe('OscHistoryDispatcher', () => {
  it('forwards command records to main database writer', () => {
    const recordCommand = vi.fn()
    const dispatcher = new OscHistoryDispatcher({ recordCommand })

    dispatcher.handleCommandRecorded({
      sessionId: 'session-1',
      command: 'ls',
      cwd: '/home/alice',
      startedAt: '2026-06-09T00:00:00.000Z',
      finishedAt: '2026-06-09T00:00:01.000Z',
      exitCode: 0
    })

    expect(recordCommand).toHaveBeenCalledWith(expect.objectContaining({ command: 'ls' }))
  })
})
