import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class MockPty {
  private dataListener: ((data: string) => void) | null = null
  private exitListener: ((event: { exitCode: number; signal?: number }) => void) | null = null

  kill = vi.fn()
  resize = vi.fn()
  write = vi.fn()

  onData(listener: (data: string) => void) {
    this.dataListener = listener
    return {
      dispose: () => {
        if (this.dataListener === listener) {
          this.dataListener = null
        }
      }
    }
  }

  onExit(listener: (event: { exitCode: number; signal?: number }) => void) {
    this.exitListener = listener
    return {
      dispose: () => {
        if (this.exitListener === listener) {
          this.exitListener = null
        }
      }
    }
  }

  emitData(data: string) {
    this.dataListener?.(data)
  }

  emitExit(event: { exitCode: number; signal?: number }) {
    this.exitListener?.(event)
  }
}

const { createdPtys, spawnMock } = vi.hoisted(() => ({
  createdPtys: [] as MockPty[],
  spawnMock: vi.fn()
}))

vi.mock('node-pty', () => ({
  spawn: spawnMock
}))

import { LocalTerminalManager } from '@main/local-terminal-manager'

function getTerminalsMap(manager: LocalTerminalManager) {
  return Reflect.get(manager as object, 'terminals') as Map<
    string,
    { summary: { title: string; status: string; lastMessage?: string } }
  >
}

describe('LocalTerminalManager', () => {
  beforeEach(() => {
    createdPtys.length = 0
    spawnMock.mockReset()
    spawnMock.mockImplementation(() => {
      const pty = new MockPty()
      createdPtys.push(pty)
      return pty
    })
    vi.stubEnv('SHELL', '/bin/zsh')
    vi.stubEnv('ComSpec', 'C:\\Windows\\System32\\cmd.exe')
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('creates a local terminal with the resolved shell, home directory, and title', () => {
    const emitToRenderer = vi.fn()
    const manager = new LocalTerminalManager(emitToRenderer)

    const summary = manager.create()

    expect(summary).toMatchObject({
      cwd: expect.any(String),
      shell: process.platform === 'win32' ? 'cmd' : 'zsh',
      status: 'running',
      title: process.platform === 'win32' ? 'cmd' : 'zsh'
    })
    expect(spawnMock).toHaveBeenCalledWith(
      process.platform === 'win32' ? 'C:\\Windows\\System32\\cmd.exe' : '/bin/zsh',
      process.platform === 'win32' ? ['/d'] : [],
      expect.objectContaining({
        cols: 120,
        cwd: summary.cwd,
        env: expect.objectContaining({
          COLORTERM: 'truecolor',
          TERM: 'xterm-256color'
        }),
        name: 'xterm-256color',
        ...(process.platform === 'win32' ? { useConpty: false } : {}),
        rows: 30
      })
    )
  })

  it('prefers the shell configured in settings when it is supported on the current platform', () => {
    const manager = new LocalTerminalManager(vi.fn(), () => ({
      localTerminalShell: process.platform === 'win32' ? 'powershell' : 'bash'
    }))

    const summary = manager.create()

    expect(summary.shell).toBe(process.platform === 'win32' ? 'powershell' : 'bash')
    expect(spawnMock).toHaveBeenCalledWith(
      process.platform === 'win32'
        ? 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
        : '/bin/bash',
      process.platform === 'win32' ? ['-NoLogo', '-NoProfile'] : [],
      expect.objectContaining(process.platform === 'win32' ? { useConpty: false } : {})
    )
  })

  it('increments duplicate shell titles and keeps exited terminals until explicitly closed', () => {
    const manager = new LocalTerminalManager(vi.fn())

    const first = manager.create()
    createdPtys[0]?.emitExit({ exitCode: 0 })
    const second = manager.create()

    expect(first.title).toBe(process.platform === 'win32' ? 'cmd' : 'zsh')
    expect(second.title).toBe(`${process.platform === 'win32' ? 'cmd' : 'zsh'} 2`)
  })

  it('forwards data, write, and resize events to the correct PTY', () => {
    vi.useFakeTimers()

    try {
      const emitToRenderer = vi.fn()
      const manager = new LocalTerminalManager(emitToRenderer)
      const summary = manager.create()
      const pty = createdPtys[0]

      pty?.emitData('hello')
      manager.write(summary.terminalId, 'ls\n')
      manager.resize(summary.terminalId, 100, 40)
      vi.runAllTimers()

      expect(emitToRenderer).toHaveBeenCalledWith(
        'localTerminals:data',
        expect.objectContaining({
          data: 'hello',
          terminalId: summary.terminalId
        })
      )
      expect(pty?.write).toHaveBeenCalledWith('ls\n')
      expect(pty?.resize).toHaveBeenCalledWith(100, 40)
    } finally {
      vi.useRealTimers()
    }
  })

  it('batches local terminal output and flushes it immediately before exit', () => {
    vi.useFakeTimers()

    try {
      const emitToRenderer = vi.fn()
      const manager = new LocalTerminalManager(emitToRenderer)
      const summary = manager.create()

      createdPtys[0]?.emitData('hello ')
      createdPtys[0]?.emitData('world')

      expect(emitToRenderer).not.toHaveBeenCalled()

      createdPtys[0]?.emitExit({ exitCode: 0 })

      expect(emitToRenderer).toHaveBeenNthCalledWith(
        1,
        'localTerminals:data',
        expect.objectContaining({
          data: 'hello world',
          terminalId: summary.terminalId
        })
      )
      expect(emitToRenderer).toHaveBeenNthCalledWith(
        2,
        'localTerminals:state',
        expect.objectContaining({
          status: 'exited',
          terminalId: summary.terminalId
        })
      )
      expect(emitToRenderer).toHaveBeenNthCalledWith(
        3,
        'localTerminals:exit',
        expect.objectContaining({
          exitCode: 0,
          terminalId: summary.terminalId
        })
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('emits exit and state events when the shell exits', () => {
    const emitToRenderer = vi.fn()
    const manager = new LocalTerminalManager(emitToRenderer)
    const summary = manager.create()

    createdPtys[0]?.emitExit({ exitCode: 9, signal: 15 })

    expect(emitToRenderer).toHaveBeenCalledWith(
      'localTerminals:state',
      expect.objectContaining({
        message: 'Local terminal exited with code 9 (signal 15).',
        status: 'exited',
        terminalId: summary.terminalId
      })
    )
    expect(emitToRenderer).toHaveBeenCalledWith(
      'localTerminals:exit',
      expect.objectContaining({
        exitCode: 9,
        signal: 15,
        terminalId: summary.terminalId
      })
    )
    expect(getTerminalsMap(manager).get(summary.terminalId)?.summary).toMatchObject({
      lastMessage: 'Local terminal exited with code 9 (signal 15).',
      status: 'exited'
    })
  })

  it('closes a terminal idempotently and removes it from the runtime map', () => {
    const manager = new LocalTerminalManager(vi.fn())
    const summary = manager.create()
    const pty = createdPtys[0]

    manager.close(summary.terminalId)
    manager.close(summary.terminalId)

    expect(pty?.kill).toHaveBeenCalledTimes(1)
    expect(getTerminalsMap(manager).has(summary.terminalId)).toBe(false)
  })

  it('disposes every active terminal runtime', () => {
    const manager = new LocalTerminalManager(vi.fn())

    manager.create()
    manager.create()
    manager.dispose()

    expect(createdPtys[0]?.kill).toHaveBeenCalledTimes(1)
    expect(createdPtys[1]?.kill).toHaveBeenCalledTimes(1)
    expect(getTerminalsMap(manager).size).toBe(0)
  })
})
