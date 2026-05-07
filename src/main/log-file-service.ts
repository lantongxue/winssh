import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AppLogEvent } from '@shared/observability'
import type { LogEntry } from '@shared/types'

function normalizeLogFilePath(logFilePath: string) {
  const normalized = logFilePath.trim()
  if (!normalized) {
    throw new Error('Log file path is required.')
  }

  return normalized
}

function serializeLogEvent(event: AppLogEvent) {
  return `${JSON.stringify(event, (_key, value) =>
    value instanceof Error
      ? {
          message: value.message,
          name: value.name,
          stack: value.stack
        }
      : value
  )}\n`
}

function parseLogEntry(raw: string, index: number): LogEntry {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      id: `log:${index}`,
      level: null,
      message: '',
      raw,
      source: null,
      timestamp: null
    }
  }

  try {
    const parsed = JSON.parse(trimmed) as Partial<AppLogEvent>

    return {
      id: `${parsed.timestamp ?? 'log'}:${index}`,
      level: parsed.level ?? null,
      message: parsed.message?.trim() || trimmed,
      raw: trimmed,
      source: parsed.source ?? null,
      timestamp: parsed.timestamp ?? null
    }
  } catch {
    return {
      id: `log:${index}`,
      level: null,
      message: trimmed,
      raw: trimmed,
      source: null,
      timestamp: null
    }
  }
}

export class LogFileService {
  private logFilePath: string
  private writeQueue = Promise.resolve()

  constructor(logFilePath: string) {
    this.logFilePath = normalizeLogFilePath(logFilePath)
  }

  getLogFilePath() {
    return this.logFilePath
  }

  async setLogFilePath(logFilePath: string) {
    this.logFilePath = normalizeLogFilePath(logFilePath)
    await this.ensureLogFile()
    return this.logFilePath
  }

  append(event: AppLogEvent) {
    const payload = serializeLogEvent(event)

    this.writeQueue = this.writeQueue
      .then(async () => {
        await this.ensureLogFile()
        await writeFile(this.logFilePath, payload, { encoding: 'utf8', flag: 'a' })
      })
      .catch((error) => {
        console.error(
          `Failed to write application log file: ${error instanceof Error ? error.message : String(error)}`
        )
      })
  }

  async writeFromRenderer(event: AppLogEvent) {
    this.append(event)
    await this.writeQueue
  }

  async readEntries(limit = 400): Promise<LogEntry[]> {
    await this.writeQueue
    await this.ensureLogFile()

    const contents = await readFile(this.logFilePath, 'utf8')
    const lines = contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    return lines
      .slice(-limit)
      .reverse()
      .map((line, index) => parseLogEntry(line, index))
  }

  async clear() {
    await this.writeQueue
    await this.ensureLogFile()
    await writeFile(this.logFilePath, '', 'utf8')
  }

  private async ensureLogFile() {
    await mkdir(dirname(this.logFilePath), { recursive: true })
    await writeFile(this.logFilePath, '', { encoding: 'utf8', flag: 'a' })
  }
}
