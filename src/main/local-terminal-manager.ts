import { randomUUID } from 'node:crypto'
import { accessSync, chmodSync, constants as fsConstants, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { spawn, type IPty } from 'node-pty'
import type {
  LocalTerminalDataEvent,
  LocalTerminalExitEvent,
  LocalTerminalStateEvent,
  LocalTerminalSummary
} from '@shared/types'

const require = createRequire(import.meta.url)

type EventMap = {
  'localTerminals:data': LocalTerminalDataEvent
  'localTerminals:exit': LocalTerminalExitEvent
  'localTerminals:state': LocalTerminalStateEvent
}

interface LocalTerminalRecord {
  summary: LocalTerminalSummary
  pty: IPty | null
  disposeListeners: () => void
  closeRequested: boolean
}

function now() {
  return new Date().toISOString()
}

function formatExitMessage(exitCode: number, signal?: number) {
  return signal === undefined
    ? `Local terminal exited with code ${exitCode}.`
    : `Local terminal exited with code ${exitCode} (signal ${signal}).`
}

function resolveUnpackedPath(filePath: string) {
  return filePath
    .replace('app.asar', 'app.asar.unpacked')
    .replace('node_modules.asar', 'node_modules.asar.unpacked')
}

export class LocalTerminalManager {
  private readonly terminals = new Map<string, LocalTerminalRecord>()

  constructor(
    private readonly emitToRenderer: <K extends keyof EventMap>(
      channel: K,
      payload: EventMap[K]
    ) => void
  ) {}

  create(): LocalTerminalSummary {
    this.ensureNodePtyHelperExecutable()
    const shellPath = this.resolveShellPath()
    const shell = this.resolveShellName(shellPath)
    const title = this.buildTitle(shell)
    const terminalId = randomUUID()
    const cwd = this.resolveWorkingDirectory()

    const summary: LocalTerminalSummary = {
      cwd,
      shell,
      startedAt: now(),
      status: 'running',
      terminalId,
      title
    }

    let pty: IPty

    try {
      pty = spawn(shellPath, [], {
        cols: 120,
        cwd,
        env: {
          ...process.env,
          COLORTERM: 'truecolor',
          TERM: 'xterm-256color'
        },
        name: 'xterm-256color',
        rows: 30
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to start local terminal using "${shellPath}" in "${cwd}": ${message}`)
    }

    const record: LocalTerminalRecord = {
      closeRequested: false,
      disposeListeners: () => undefined,
      pty,
      summary
    }

    const dataDisposable = pty.onData((data) => {
      this.emitToRenderer('localTerminals:data', {
        data,
        terminalId
      })
    })
    const exitDisposable = pty.onExit(({ exitCode, signal }) => {
      const current = this.terminals.get(terminalId)
      if (!current) {
        return
      }

      current.pty = null

      if (current.closeRequested) {
        return
      }

      const lastMessage = formatExitMessage(exitCode, signal)
      current.summary = {
        ...current.summary,
        lastMessage,
        status: 'exited'
      }

      this.emitToRenderer('localTerminals:state', {
        message: lastMessage,
        status: 'exited',
        terminalId
      })
      this.emitToRenderer('localTerminals:exit', {
        exitCode,
        signal,
        terminalId
      })
    })

    record.disposeListeners = () => {
      dataDisposable.dispose()
      exitDisposable.dispose()
    }

    this.terminals.set(terminalId, record)
    return summary
  }

  write(terminalId: string, data: string) {
    this.terminals.get(terminalId)?.pty?.write(data)
  }

  resize(terminalId: string, columns: number, rows: number) {
    this.terminals.get(terminalId)?.pty?.resize(columns, rows)
  }

  close(terminalId: string) {
    const record = this.terminals.get(terminalId)
    if (!record) {
      return
    }

    record.closeRequested = true
    record.disposeListeners()
    record.pty?.kill()
    record.pty = null
    this.terminals.delete(terminalId)
  }

  dispose() {
    for (const terminalId of this.terminals.keys()) {
      this.close(terminalId)
    }
  }

  private ensureNodePtyHelperExecutable() {
    if (process.platform === 'win32') {
      return
    }

    const packageDir = path.dirname(require.resolve('node-pty/package.json'))
    const candidatePaths = [
      path.join(packageDir, 'build', 'Release', 'spawn-helper'),
      path.join(packageDir, 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper')
    ].map(resolveUnpackedPath)

    for (const helperPath of candidatePaths) {
      if (!existsSync(helperPath)) {
        continue
      }

      try {
        accessSync(helperPath, fsConstants.X_OK)
        return
      } catch {
        chmodSync(helperPath, 0o755)
        accessSync(helperPath, fsConstants.X_OK)
        return
      }
    }
  }

  private resolveShellPath() {
    const candidates =
      process.platform === 'win32'
        ? [process.env['ComSpec']?.trim(), 'C:\\Windows\\System32\\cmd.exe', 'cmd.exe']
        : [process.env['SHELL']?.trim(), '/bin/zsh', '/bin/bash', '/bin/sh']

    for (const candidate of candidates) {
      if (!candidate) {
        continue
      }

      if (!path.isAbsolute(candidate)) {
        return candidate
      }

      try {
        accessSync(candidate, fsConstants.X_OK)
        return candidate
      } catch {
        continue
      }
    }

    return process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
  }

  private resolveWorkingDirectory() {
    const candidates =
      process.platform === 'win32' ? [homedir(), process.cwd()] : [homedir(), process.cwd(), '/']

    for (const candidate of candidates) {
      if (!candidate) {
        continue
      }

      try {
        accessSync(candidate, fsConstants.R_OK)
        return candidate
      } catch {
        continue
      }
    }

    return process.cwd()
  }

  private resolveShellName(shellPath: string) {
    const name = path.basename(shellPath)
    return name || shellPath
  }

  private buildTitle(shell: string) {
    const duplicateCount = Array.from(this.terminals.values()).filter(
      (terminal) => terminal.summary.shell === shell
    ).length

    return duplicateCount === 0 ? shell : `${shell} ${duplicateCount + 1}`
  }
}
