import { EventEmitter } from 'node:events'
import { WorkerSupervisor } from '@main/services/worker-supervisor'

class FakeWorker extends EventEmitter {
  terminate = vi.fn(async () => 0)
}

describe('WorkerSupervisor', () => {
  it('tracks worker lifecycle and terminates all workers', async () => {
    const worker = new FakeWorker()
    const supervisor = new WorkerSupervisor({ spawn: vi.fn(() => worker as never) })

    const handle = supervisor.spawn('ssh-core', 'session-1')

    expect(handle.workerId).toContain('ssh-core')
    expect(supervisor.list().map((item) => item.sessionId)).toEqual(['session-1'])

    await supervisor.terminateAll()

    expect(worker.terminate).toHaveBeenCalledOnce()
    expect(supervisor.list()).toEqual([])
  })

  it('emits crash records for non-zero exits', () => {
    const worker = new FakeWorker()
    const onCrash = vi.fn()
    const supervisor = new WorkerSupervisor({ spawn: vi.fn(() => worker as never), onCrash })

    supervisor.spawn('ssh-core', 'session-1')
    worker.emit('exit', 1)

    expect(onCrash).toHaveBeenCalledWith(
      expect.objectContaining({ workerType: 'ssh-core', sessionId: 'session-1', exitCode: 1 })
    )
  })
})
