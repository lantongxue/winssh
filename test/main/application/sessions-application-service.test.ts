import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SessionsApplicationService } from '@main/application/sessions-application-service'
import type { LocalTerminalManager } from '@main/local-terminal-manager'
import type { SessionRuntime } from '@main/services/session-runtime'

describe('SessionsApplicationService', () => {
  it('delegates SSH calls through SessionRuntime', async () => {
    const runtime = {
      connect: vi.fn(async () => ({ ok: false, code: 'connection_failed', message: 'fail' })),
      disconnect: vi.fn(async () => undefined),
      write: vi.fn(),
      resize: vi.fn(async () => undefined)
    } as unknown as SessionRuntime
    const service = new SessionsApplicationService(runtime, {} as LocalTerminalManager)

    await service.connect({ serverId: 'server-1', sessionId: 'session-1' } as never)
    service.write('session-1', 'whoami\n')
    await service.resize('session-1', 100, 30)
    await service.disconnect('session-1')

    expect(runtime.connect).toHaveBeenCalledOnce()
    expect(runtime.write).toHaveBeenCalledWith('session-1', 'whoami\n')
    expect(runtime.resize).toHaveBeenCalledWith('session-1', 100, 30)
    expect(runtime.disconnect).toHaveBeenCalledWith('session-1')
  })
})

describe('bootstrap session runtime wiring', () => {
  it('constructs SessionsApplicationService with the selected SessionRuntime', () => {
    const source = readFileSync(join(process.cwd(), 'src/main/bootstrap.ts'), 'utf8')

    expect(source).toContain(
      "import { LegacySessionRuntime } from './services/legacy-session-runtime'"
    )
    expect(source).toContain(
      "import { WorkerSessionRuntime } from './services/worker-session-runtime'"
    )
    expect(source).toContain(
      'const legacySessionRuntime = new LegacySessionRuntime(sessionManager)'
    )
    expect(source).toContain("process.env['WINSSH_WORKER_TERMINAL'] === '1'")
    expect(source).toContain("process.env['WINSSH_LEGACY_TERMINAL'] !== '1'")
    expect(source).toContain('new WorkerSessionRuntime({')
    expect(source).toContain(': legacySessionRuntime')
    expect(source).toContain(
      'const sessionsService = new SessionsApplicationService(sessionRuntime, localTerminalManager)'
    )
  })
})
