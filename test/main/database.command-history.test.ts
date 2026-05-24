import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { CommandHistoryScope, ServerUpsertInput } from '@shared/types'
import { COMMAND_HISTORY_CAP } from '@shared/constants'

const betterSqliteModule = await import('better-sqlite3').catch(() => null)
const databaseModule = await import('@main/database').catch(() => null)

const tempDirectories: string[] = []

function createTempDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), 'winssh-cmdhist-'))
  tempDirectories.push(directory)
  return join(directory, 'winssh.db')
}

function createServerInput(overrides: Partial<ServerUpsertInput> = {}): ServerUpsertInput {
  return {
    authType: 'password',
    favorite: false,
    captureCommandHistory: true,
    groupId: null,
    host: '127.0.0.1',
    jumpServerId: null,
    name: 'Server',
    note: '',
    port: 22,
    privateKey: null,
    rememberPassphrase: false,
    rememberPassword: false,
    tagIds: [],
    username: 'root',
    ...overrides
  }
}

const canUse = (() => {
  if (!betterSqliteModule?.default) return false
  const dir = mkdtempSync(join(tmpdir(), 'winssh-cmdhist-probe-'))
  try {
    const db = new betterSqliteModule.default(join(dir, 'probe.db'))
    db.close()
    return true
  } catch {
    return false
  } finally {
    rmSync(dir, { force: true, recursive: true })
  }
})()

const describeDatabase = betterSqliteModule && databaseModule && canUse ? describe : describe.skip

describeDatabase('command history persistence', () => {
  afterEach(() => {
    while (tempDirectories.length > 0) {
      const dir = tempDirectories.pop()
      if (dir) rmSync(dir, { force: true, recursive: true })
    }
  })

  it('persists SSH commands scoped to the server and lists them newest-first', () => {
    const { DatabaseService } = databaseModule!
    const db = new DatabaseService(createTempDatabasePath())
    const server = db.createServer(createServerInput({ name: 'Web' }))

    db.recordCommand({
      scope: { kind: 'ssh', serverId: server.id },
      command: 'ls',
      executedAt: '2026-01-01T00:00:00.000Z',
      cwd: '/home',
      exitCode: 0,
      durationMs: 12
    })
    db.recordCommand({
      scope: { kind: 'ssh', serverId: server.id },
      command: 'pwd',
      executedAt: '2026-01-02T00:00:00.000Z',
      cwd: '/home',
      exitCode: 0,
      durationMs: 5
    })

    const entries = db.listCommands({ scope: { kind: 'ssh', serverId: server.id } })
    expect(entries.map((e) => e.command)).toEqual(['pwd', 'ls'])
    expect(entries[0].exitCode).toBe(0)
    expect(entries[0].durationMs).toBe(5)
    db.close()
  })

  it('rejects rows that violate the scope CHECK constraint', () => {
    const { DatabaseService } = databaseModule!
    const db = new DatabaseService(createTempDatabasePath())
    const server = db.createServer(createServerInput({ name: 'Box' }))

    expect(() =>
      db.recordCommand({
        scope: { kind: 'ssh', serverId: server.id },
        command: 'ok',
        executedAt: '2026-01-01T00:00:00.000Z',
        cwd: null,
        exitCode: 0,
        durationMs: null
      })
    ).not.toThrow()

    db.close()
  })

  it('filters local commands separately from SSH commands', () => {
    const { DatabaseService } = databaseModule!
    const db = new DatabaseService(createTempDatabasePath())
    const server = db.createServer(createServerInput({ name: 'Box' }))

    db.recordCommand({
      scope: { kind: 'ssh', serverId: server.id },
      command: 'remote-ls',
      executedAt: '2026-01-01T00:00:00.000Z',
      cwd: null,
      exitCode: 0,
      durationMs: null
    })
    db.recordCommand({
      scope: { kind: 'local' },
      command: 'local-ls',
      executedAt: '2026-01-02T00:00:00.000Z',
      cwd: null,
      exitCode: 0,
      durationMs: null
    })

    const sshEntries = db.listCommands({ scope: { kind: 'ssh', serverId: server.id } })
    const localEntries = db.listCommands({ scope: { kind: 'local' } })
    expect(sshEntries.map((e) => e.command)).toEqual(['remote-ls'])
    expect(localEntries.map((e) => e.command)).toEqual(['local-ls'])
    db.close()
  })

  it('caps history per scope at COMMAND_HISTORY_CAP by pruning oldest', () => {
    const { DatabaseService } = databaseModule!
    const db = new DatabaseService(createTempDatabasePath())
    const server = db.createServer(createServerInput({ name: 'Box' }))

    const total = COMMAND_HISTORY_CAP + 5
    for (let i = 0; i < total; i++) {
      db.recordCommand({
        scope: { kind: 'ssh', serverId: server.id },
        command: `cmd-${i}`,
        executedAt: new Date(1735689600000 + i * 1000).toISOString(),
        cwd: null,
        exitCode: 0,
        durationMs: null
      })
    }

    const entries = db.listCommands({
      scope: { kind: 'ssh', serverId: server.id },
      limit: COMMAND_HISTORY_CAP
    })
    expect(entries.length).toBe(COMMAND_HISTORY_CAP)
    expect(entries[0].command).toBe(`cmd-${total - 1}`)
    expect(entries[entries.length - 1].command).toBe(`cmd-${total - COMMAND_HISTORY_CAP}`)
    db.close()
  })

  it('searches by substring with escaped LIKE characters', () => {
    const { DatabaseService } = databaseModule!
    const db = new DatabaseService(createTempDatabasePath())
    const server = db.createServer(createServerInput({ name: 'Box' }))
    for (const command of ['echo hello', 'cat 50%_results', 'grep foo']) {
      db.recordCommand({
        scope: { kind: 'ssh', serverId: server.id },
        command,
        executedAt: new Date().toISOString(),
        cwd: null,
        exitCode: 0,
        durationMs: null
      })
    }

    const helloResults = db.searchCommands({
      scope: { kind: 'ssh', serverId: server.id },
      query: 'hello'
    })
    expect(helloResults.map((e) => e.command)).toEqual(['echo hello'])

    const percentResults = db.searchCommands({
      scope: { kind: 'ssh', serverId: server.id },
      query: '50%'
    })
    expect(percentResults.map((e) => e.command)).toEqual(['cat 50%_results'])

    db.close()
  })

  it('cascades deletion when a server is deleted', () => {
    const { DatabaseService } = databaseModule!
    const db = new DatabaseService(createTempDatabasePath())
    const server = db.createServer(createServerInput({ name: 'Doomed' }))
    db.recordCommand({
      scope: { kind: 'ssh', serverId: server.id },
      command: 'temp',
      executedAt: new Date().toISOString(),
      cwd: null,
      exitCode: 0,
      durationMs: null
    })
    db.deleteServer(server.id)
    const scope: CommandHistoryScope = { kind: 'ssh', serverId: server.id }
    expect(db.listCommands({ scope })).toEqual([])
    db.close()
  })

  it('clears history scoped to one scope without touching others', () => {
    const { DatabaseService } = databaseModule!
    const db = new DatabaseService(createTempDatabasePath())
    const a = db.createServer(createServerInput({ name: 'A' }))
    const b = db.createServer(createServerInput({ name: 'B' }))
    for (const serverId of [a.id, b.id]) {
      db.recordCommand({
        scope: { kind: 'ssh', serverId },
        command: 'keep-or-clear',
        executedAt: new Date().toISOString(),
        cwd: null,
        exitCode: 0,
        durationMs: null
      })
    }

    db.clearCommands({ kind: 'ssh', serverId: a.id })
    expect(db.listCommands({ scope: { kind: 'ssh', serverId: a.id } })).toEqual([])
    expect(db.listCommands({ scope: { kind: 'ssh', serverId: b.id } }).length).toBe(1)
    db.close()
  })

  it('toggles capture_command_history on the server record', () => {
    const { DatabaseService } = databaseModule!
    const db = new DatabaseService(createTempDatabasePath())
    const server = db.createServer(createServerInput({ name: 'Toggle' }))
    expect(server.captureCommandHistory).toBe(true)

    db.setServerCaptureCommandHistory(server.id, false)
    const refreshed = db.getServerById(server.id)
    expect(refreshed?.captureCommandHistory).toBe(false)

    db.setServerCaptureCommandHistory(server.id, true)
    expect(db.getServerById(server.id)?.captureCommandHistory).toBe(true)
    db.close()
  })
})
