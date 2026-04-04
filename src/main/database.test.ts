import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { ServerUpsertInput } from '@shared/types'

const betterSqliteModule = await import('better-sqlite3').catch(() => null)
const databaseModule = await import('./database').catch(() => null)
const canUseBetterSqlite = (() => {
  const Database = betterSqliteModule?.default
  if (!Database) {
    return false
  }

  const directory = mkdtempSync(join(tmpdir(), 'winssh-db-check-'))
  const databasePath = join(directory, 'winssh.db')

  try {
    const database = new Database(databasePath)
    database.close()
    return true
  } catch {
    return false
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
})()
const describeDatabase =
  betterSqliteModule && databaseModule && canUseBetterSqlite ? describe : describe.skip

const tempDirectories: string[] = []

function createTempDatabasePath() {
  const directory = mkdtempSync(join(tmpdir(), 'winssh-db-'))
  tempDirectories.push(directory)
  return join(directory, 'winssh.db')
}

function createServerInput(overrides: Partial<ServerUpsertInput> = {}): ServerUpsertInput {
  return {
    authType: 'password',
    favorite: false,
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

afterEach(() => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop()
    if (!directory) {
      continue
    }

    rmSync(directory, { force: true, recursive: true })
  }
})

describeDatabase('DatabaseService jump server support', () => {
  const Database = betterSqliteModule?.default
  const DatabaseService = databaseModule?.DatabaseService

  it('adds the jump_server_id column when opening an older database', () => {
    if (!Database || !DatabaseService) {
      return
    }

    const databasePath = createTempDatabasePath()
    const raw = new Database(databasePath)

    raw.exec(`
      CREATE TABLE server_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE credentials (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        username TEXT,
        password TEXT,
        private_key TEXT,
        passphrase TEXT,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE servers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT NOT NULL,
        auth_type TEXT NOT NULL CHECK (auth_type IN ('password', 'privateKey')),
        private_key_path TEXT,
        private_key TEXT,
        note TEXT,
        group_id TEXT REFERENCES server_groups(id) ON DELETE SET NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_connected_at TEXT,
        credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL
      );
    `)
    raw.close()

    const service = new DatabaseService(databasePath)
    expect(service.listServers()).toEqual([])

    const migrated = new Database(databasePath)
    const columns = migrated.prepare('PRAGMA table_info(servers)').all() as Array<{ name: string }>
    migrated.close()

    expect(columns.map((column) => column.name)).toContain('jump_server_id')
  })

  it('persists and clears jump server references when the jump server is deleted', () => {
    if (!DatabaseService) {
      return
    }

    const databasePath = createTempDatabasePath()
    const service = new DatabaseService(databasePath)

    const jumpServer = service.createServer(
      createServerInput({
        host: '10.0.0.10',
        name: 'Jump Server'
      })
    )
    const targetServer = service.createServer(
      createServerInput({
        host: '10.0.0.20',
        jumpServerId: jumpServer.id,
        name: 'Target Server'
      })
    )

    expect(service.getServerById(targetServer.id)?.jumpServerId).toBe(jumpServer.id)

    service.deleteServer(jumpServer.id)

    expect(service.getServerById(targetServer.id)?.jumpServerId).toBeNull()
  })
})
