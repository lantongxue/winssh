import { randomUUID } from 'node:crypto'
import { accessSync, chmodSync, constants as fsConstants, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import path from 'node:path'
import { spawn, type IPty } from 'node-pty'
import {
  normalizeLocalTerminalShell,
  getSupportedLocalTerminalShells
} from '@shared/local-terminal-shells'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import type {
  AppSettings,
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

const LOCAL_TERMINAL_OUTPUT_BATCH_MS = 16

interface LocalTerminalRecord {
  summary: LocalTerminalSummary
  pty: IPty | null
  disposeListeners: () => void
  closeRequested: boolean
  pendingData: string
  flushTimer: ReturnType<typeof setTimeout> | null
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
    ) => void,
    private readonly getSettings: () => Pick<AppSettings, 'localTerminalShell'> = () =>
      DEFAULT_APP_SETTINGS
  ) {}

  create(): LocalTerminalSummary {
    this.ensureNodePtyHelperExecutable()
    const { shell, shellArgs, shellPath } = this.resolveShellRuntime()
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
      pty = spawn(shellPath, shellArgs, {
        cols: 120,
        cwd,
        env: {
          ...process.env,
          COLORTERM: 'truecolor',
          TERM: 'xterm-256color'
        },
        name: 'xterm-256color',
        ...(process.platform === 'win32'
          ? {
              // ConPTY has been flaky in the local terminal path on Windows and can freeze the app
              // while the shell is repainting after the initial resize. winpty is less featureful
              // but has proven much more stable for this desktop app workflow.
              useConpty: false
            }
          : {}),
        rows: 30
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to start local terminal using "${shellPath}" in "${cwd}": ${message}`)
    }

    const record: LocalTerminalRecord = {
      closeRequested: false,
      disposeListeners: () => undefined,
      flushTimer: null,
      pendingData: '',
      pty,
      summary
    }

    this.terminals.set(terminalId, record)

    const dataDisposable = pty.onData((data) => {
      this.bufferTerminalData(terminalId, data)
    })
    const exitDisposable = pty.onExit(({ exitCode, signal }) => {
      const current = this.terminals.get(terminalId)
      if (!current) {
        return
      }

      this.flushTerminalData(terminalId, current)
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

      this.emitToRenderer(
        'localTerminals:state',
        this.withObservableMetadata(terminalId, {
          code: 'local_terminal_exited',
          message: lastMessage,
          recoverable: false,
          status: 'exited',
          terminalId
        })
      )
      this.emitToRenderer(
        'localTerminals:exit',
        this.withObservableMetadata(terminalId, {
          exitCode,
          signal,
          terminalId
        })
      )
    })

    record.disposeListeners = () => {
      dataDisposable.dispose()
      exitDisposable.dispose()
    }
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
    this.clearPendingTerminalData(record)
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

  private withObservableMetadata<TPayload extends object>(
    correlationId: string,
    payload: TPayload
  ) {
    return {
      ...payload,
      correlationId,
      source: 'main' as const,
      timestamp: now()
    }
  }

  private bufferTerminalData(terminalId: string, data: string) {
    const record = this.terminals.get(terminalId)
    if (!record) {
      return
    }

    record.pendingData += data

    if (record.flushTimer) {
      return
    }

    record.flushTimer = setTimeout(() => {
      const current = this.terminals.get(terminalId)
      if (!current) {
        return
      }

      this.flushTerminalData(terminalId, current)
    }, LOCAL_TERMINAL_OUTPUT_BATCH_MS)
  }

  private flushTerminalData(terminalId: string, record = this.terminals.get(terminalId)) {
    if (!record) {
      return
    }

    if (record.flushTimer) {
      clearTimeout(record.flushTimer)
      record.flushTimer = null
    }

    if (!record.pendingData) {
      return
    }

    const data = record.pendingData
    record.pendingData = ''
    this.emitToRenderer(
      'localTerminals:data',
      this.withObservableMetadata(terminalId, {
        data,
        terminalId
      })
    )
  }

  private clearPendingTerminalData(record: LocalTerminalRecord) {
    if (record.flushTimer) {
      clearTimeout(record.flushTimer)
      record.flushTimer = null
    }

    record.pendingData = ''
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

  private resolveShellRuntime() {
    const preferredShell = normalizeLocalTerminalShell(
      this.getSettings().localTerminalShell,
      process.platform,
      process.platform === 'win32' ? process.env['ComSpec'] : process.env['SHELL']
    )
    const supportedShells = getSupportedLocalTerminalShells(process.platform)
    const fallbackShells = supportedShells.filter((shell) => shell !== preferredShell)

    for (const shell of [preferredShell, ...fallbackShells]) {
      const shellPath = this.resolveShellPath(shell)
      if (shellPath) {
        return {
          shellArgs: this.getShellLaunchArgs(shell),
          shell,
          shellPath
        }
      }
    }

    const fallbackShellPath = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
    return {
      shellArgs: this.getShellLaunchArgs(fallbackShellPath),
      shell: this.resolveShellName(fallbackShellPath),
      shellPath: fallbackShellPath
    }
  }

  private getShellLaunchArgs(shell: string) {
    if (process.platform !== 'win32') {
      return [] as string[]
    }

    const normalizedShell = this.resolveShellName(shell).toLowerCase()

    if (normalizedShell === 'powershell' || normalizedShell === 'powershell.exe') {
      // Skip user profiles to keep terminal startup predictable and avoid renderer lockups from
      // noisy/slow profile scripts.
      return ['-NoLogo', '-NoProfile']
    }

    // Disable AutoRun so cmd doesn't execute user-defined startup commands before the terminal is ready.
    return ['/d']
  }

  private resolveShellPath(shell: string) {
    const candidates = this.getShellCandidates(shell)

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

    return null
  }

  private getShellCandidates(shell: string) {
    if (process.platform === 'win32') {
      if (shell === 'powershell') {
        return ['C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe', 'powershell.exe']
      }

      const comSpec = process.env['ComSpec']?.trim()
      const comSpecName = comSpec ? path.basename(comSpec).toLowerCase() : ''

      return [
        comSpecName === 'cmd.exe' ? comSpec : null,
        'C:\\Windows\\System32\\cmd.exe',
        'cmd.exe'
      ]
    }

    const envShell = process.env['SHELL']?.trim()
    const envShellName = envShell ? this.resolveShellName(envShell).toLowerCase() : ''

    if (shell === 'zsh') {
      return [envShellName === 'zsh' ? envShell : null, '/bin/zsh', '/usr/bin/zsh', 'zsh']
    }

    return [envShellName === 'bash' ? envShell : null, '/bin/bash', '/usr/bin/bash', 'bash']
  }

  private buildTitle(shell: string) {
    const duplicateCount = Array.from(this.terminals.values()).filter(
      (terminal) => terminal.summary.shell === shell
    ).length

    return duplicateCount === 0 ? shell : `${shell} ${duplicateCount + 1}`
  }
}
