import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { AppLogEvent } from '@shared/observability'
import { LogFileService } from '@main/log-file-service'

const createdDirs: string[] = []

function createEvent(message: string): AppLogEvent {
  return {
    level: 'info',
    message,
    source: 'main',
    timestamp: new Date().toISOString()
  }
}

afterEach(async () => {
  await Promise.all(
    createdDirs.splice(0).map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

describe('LogFileService', () => {
  it('appends, reads, clears, and moves the log file', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'winssh-logs-'))
    createdDirs.push(tempDir)

    const firstPath = join(tempDir, 'first', 'app.log')
    const secondPath = join(tempDir, 'second', 'app.log')
    const service = new LogFileService(firstPath)

    await service.writeFromRenderer(createEvent('first message'))

    const firstEntries = await service.readEntries()
    expect(firstEntries).toHaveLength(1)
    expect(firstEntries[0]?.message).toBe('first message')

    await service.clear()
    await expect(service.readEntries()).resolves.toEqual([])

    await service.setLogFilePath(secondPath)
    await service.writeFromRenderer(createEvent('second message'))

    const fileContents = await readFile(secondPath, 'utf8')
    expect(fileContents).toContain('second message')

    const secondEntries = await service.readEntries()
    expect(secondEntries[0]?.message).toBe('second message')
  })
})
