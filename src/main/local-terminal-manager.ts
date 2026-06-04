import { randomUUID } from 'node:crypto'
import { accessSync, chmodSync, constants as fsConstants, existsSync, writeFileSync } from 'node:fs'
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
  CommandHistoryEntry,
  CommandRecordedEvent,
  LocalTerminalDataEvent,
  LocalTerminalExitEvent,
  LocalTerminalStateEvent,
  LocalTerminalSummary
} from '@shared/types'
import type { DatabaseService } from './database'
import { createOscScannerState, scanOscChunk, type OscScannerState } from './osc-scanner'
import { isShellIntegrationInternal, SHELL_INTEGRATION_FILE_CONTENT } from './shell-integration'

const require = createRequire(import.meta.url)

type EventMap = {
  'localTerminals:data': LocalTerminalDataEvent
  'localTerminals:exit': LocalTerminalExitEvent
  'localTerminals:state': LocalTerminalStateEvent
  'commandHistory:added': CommandRecordedEvent
}

const LOCAL_TERMINAL_OUTPUT_BATCH_MS = 16
const HISTORY_PROBE_TIMEOUT_MS = 3000

interface PendingLocalCommand {
  text: string | null
  startedAt: number | null
}

interface LocalTerminalRecord {
  summary: LocalTerminalSummary
  pty: IPty | null
  disposeListeners: () => void
  closeRequested: boolean
  pendingData: string
  flushTimer: ReturnType<typeof setTimeout> | null
  oscState: OscScannerState
  pendingCommand: PendingLocalCommand
  historyCaptureEnabled: boolean
  historyCaptureStatus: 'pending' | 'active' | 'unavailable'
  historyProbeTimer: ReturnType<typeof setTimeout> | null
  integrationBuffer?: string
  integrationTimeoutTimer?: ReturnType<typeof setTimeout> | null
  integrationState?: 'none' | 'waiting' | 'delayed' | 'active' | 'failed'
  integrationDelayTimer?: ReturnType<typeof setTimeout> | null
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
    private readonly getSettings: () => Pick<
      AppSettings,
      'localTerminalShell' | 'commandHistoryEnabled'
    > = () => DEFAULT_APP_SETTINGS,
    private readonly database: DatabaseService | null = null
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

    const shellName = path.basename(shell).toLowerCase()
    const shellSupportsIntegration = shellName === 'bash' || shellName === 'zsh'
    const captureEnabled =
      shellSupportsIntegration &&
      Boolean(this.database) &&
      this.getSettings().commandHistoryEnabled !== false

    const record: LocalTerminalRecord = {
      closeRequested: false,
      disposeListeners: () => undefined,
      flushTimer: null,
      pendingData: '',
      pty,
      summary,
      oscState: createOscScannerState(),
      pendingCommand: { text: null, startedAt: null },
      historyCaptureEnabled: captureEnabled,
      historyCaptureStatus: captureEnabled ? 'pending' : 'unavailable',
      historyProbeTimer: null,
      integrationState: captureEnabled ? 'waiting' : 'none'
    }

    this.terminals.set(terminalId, record)

    const dataDisposable = pty.onData((data) => {
      this.handlePtyData(terminalId, data)
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
    if (record.historyProbeTimer) {
      clearTimeout(record.historyProbeTimer)
      record.historyProbeTimer = null
    }
    if (record.integrationTimeoutTimer) {
      clearTimeout(record.integrationTimeoutTimer)
      record.integrationTimeoutTimer = null
    }
    if (record.integrationDelayTimer) {
      clearTimeout(record.integrationDelayTimer)
      record.integrationDelayTimer = null
    }
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

  private handlePtyData(terminalId: string, data: string) {
    const record = this.terminals.get(terminalId)
    if (!record) {
      return
    }

    if (record.integrationState === 'waiting') {
      record.integrationState = 'delayed'
      this.handlePtyDataFiltered(terminalId, record, data)
      record.integrationDelayTimer = setTimeout(() => {
        record.integrationDelayTimer = null
        this.installLocalShellIntegration(terminalId, record)
      }, 200)
      return
    }

    if (record.integrationState === 'delayed') {
      this.handlePtyDataFiltered(terminalId, record, data)
      return
    }

    if (record.integrationBuffer !== undefined) {
      record.integrationBuffer += data
      const command = ` . ~/.winssh_init_${terminalId} && rm -f ~/.winssh_init_${terminalId}`

      if (record.integrationBuffer.includes(command)) {
        if (record.integrationTimeoutTimer) {
          clearTimeout(record.integrationTimeoutTimer)
          record.integrationTimeoutTimer = null
        }

        let cleaned = record.integrationBuffer
        const idx = cleaned.indexOf(command)
        if (idx !== -1) {
          let prefix = cleaned.slice(0, idx)
          prefix = prefix.replace(/[ \b]+$/, '')
          let suffix = cleaned.slice(idx + command.length)
          suffix = suffix.replace(/^\r?\n?/, '')
          cleaned = prefix + suffix
        }

        record.integrationBuffer = undefined
        if (cleaned) {
          this.handlePtyDataFiltered(terminalId, record, cleaned)
        }
      }
      return
    }

    this.handlePtyDataFiltered(terminalId, record, data)
  }

  private installLocalShellIntegration(terminalId: string, record: LocalTerminalRecord) {
    try {
      const tempFilePath = path.join(homedir(), `.winssh_init_${terminalId}`)
      writeFileSync(tempFilePath, SHELL_INTEGRATION_FILE_CONTENT, 'utf8')

      const command = ` . ~/.winssh_init_${terminalId} && rm -f ~/.winssh_init_${terminalId}`
      record.integrationBuffer = ''
      record.pty?.write(`${command}\r`)

      record.integrationTimeoutTimer = setTimeout(() => {
        if (record.integrationBuffer !== undefined) {
          const data = record.integrationBuffer
          record.integrationBuffer = undefined
          if (data) {
            this.handlePtyDataFiltered(terminalId, record, data)
          }
        }
        record.integrationTimeoutTimer = null
      }, 1000)
      record.integrationState = 'active'
    } catch {
      record.historyCaptureStatus = 'unavailable'
      record.integrationState = 'failed'
      return
    }

    record.historyProbeTimer = setTimeout(() => {
      if (record.historyCaptureStatus === 'pending') {
        record.historyCaptureStatus = 'unavailable'
      }
      record.historyProbeTimer = null
    }, HISTORY_PROBE_TIMEOUT_MS)
  }

  private handlePtyDataFiltered(terminalId: string, record: LocalTerminalRecord, data: string) {
    const cleaned = scanOscChunk(record.oscState, data, {
      onPromptStart: () => {
        if (record.historyCaptureStatus === 'pending') {
          record.historyCaptureStatus = 'active'
          if (record.historyProbeTimer) {
            clearTimeout(record.historyProbeTimer)
            record.historyProbeTimer = null
          }
        }
      },
      onCommandText: (command) => {
        if (isShellIntegrationInternal(command)) {
          return
        }
        record.pendingCommand = {
          text: command,
          startedAt: record.pendingCommand.startedAt
        }
      },
      onCommandPre: () => {
        if (record.pendingCommand.startedAt === null) {
          record.pendingCommand.startedAt = Date.now()
        }
      },
      onCommandDone: (exitCode) => {
        this.handleLocalCommandDone(record, exitCode)
      },
      onCwd: (cwd) => {
        record.summary.cwd = cwd
      }
    })

    if (cleaned) {
      this.bufferTerminalData(terminalId, cleaned)
    }
  }

  private handleLocalCommandDone(record: LocalTerminalRecord, exitCode: number | null): void {
    const pending = record.pendingCommand
    record.pendingCommand = { text: null, startedAt: null }
    if (!pending.text || !this.database) {
      return
    }
    const executedAt = pending.startedAt
      ? new Date(pending.startedAt).toISOString()
      : new Date().toISOString()
    const durationMs =
      pending.startedAt !== null ? Math.max(0, Date.now() - pending.startedAt) : null

    let entry: CommandHistoryEntry | null = null
    try {
      entry = this.database.recordCommand({
        scope: { kind: 'local' },
        command: pending.text,
        executedAt,
        cwd: record.summary.cwd || null,
        exitCode,
        durationMs
      })
    } catch {
      return
    }

    if (!entry) {
      return
    }

    this.emitToRenderer(
      'commandHistory:added',
      this.withObservableMetadata(record.summary.terminalId, {
        scope: { kind: 'local' },
        entry
      })
    )
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
      return [envShellName === 'zsh' ? envShell : null, '/bin/zsh', '/usr/bin/zsh']
    }

    return [envShellName === 'bash' ? envShell : null, '/bin/bash', '/usr/bin/bash']
  }

  private buildTitle(shell: string) {
    const duplicateCount = Array.from(this.terminals.values()).filter(
      (terminal) => terminal.summary.shell === shell
    ).length

    return duplicateCount === 0 ? shell : `${shell} ${duplicateCount + 1}`
  }
}
