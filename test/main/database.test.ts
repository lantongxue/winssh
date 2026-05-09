import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import type { ServerUpsertInput } from '@shared/types'

const betterSqliteModule = await import('better-sqlite3').catch(() => null)
const databaseModule = await import('@main/database').catch(() => null)
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

describeDatabase('DatabaseService server persistence', () => {
  const Database = betterSqliteModule?.default
  const DatabaseService = databaseModule?.DatabaseService

  it('adds brand, icon, and jump server columns when opening an older database', () => {
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

    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining([
        'brand_id',
        'custom_icon',
        'custom_icon_mime_type',
        'jump_server_id',
        'password',
        'passphrase'
      ])
    )
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

  it('persists nested groups and keeps server assignment at any depth', () => {
    if (!DatabaseService) {
      return
    }

    const databasePath = createTempDatabasePath()
    const service = new DatabaseService(databasePath)

    const parent = service.createGroup({ color: 'red', name: 'Production' })
    const child = service.createGroup({ color: 'blue', name: 'Web', parentId: parent.id })
    const grandchild = service.createGroup({ color: 'green', name: 'API', parentId: child.id })
    const server = service.createServer(
      createServerInput({ groupId: grandchild.id, name: 'API Host' })
    )

    expect(service.listGroups()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: parent.id, parentId: null }),
        expect.objectContaining({ id: child.id, parentId: parent.id }),
        expect.objectContaining({ id: grandchild.id, parentId: child.id })
      ])
    )
    expect(service.getServerById(server.id)).toMatchObject({
      group: expect.objectContaining({ id: grandchild.id, parentId: child.id }),
      groupId: grandchild.id
    })
  })

  it('prevents self-parent and descendant cycles', () => {
    if (!DatabaseService) {
      return
    }

    const databasePath = createTempDatabasePath()
    const service = new DatabaseService(databasePath)

    const parent = service.createGroup({ color: 'red', name: 'Parent' })
    const child = service.createGroup({ color: 'blue', name: 'Child', parentId: parent.id })

    expect(() =>
      service.updateGroup(parent.id, {
        color: parent.color,
        name: parent.name,
        parentId: parent.id
      })
    ).toThrow(/own parent/i)
    expect(() =>
      service.updateGroup(parent.id, { color: parent.color, name: parent.name, parentId: child.id })
    ).toThrow(/descendants/i)
  })

  it('promotes child groups to root when deleting a parent group', () => {
    if (!DatabaseService) {
      return
    }

    const databasePath = createTempDatabasePath()
    const service = new DatabaseService(databasePath)

    const parent = service.createGroup({ color: 'red', name: 'Parent' })
    const child = service.createGroup({ color: 'blue', name: 'Child', parentId: parent.id })
    const parentServer = service.createServer(
      createServerInput({ groupId: parent.id, name: 'Parent Server' })
    )
    const childServer = service.createServer(
      createServerInput({ groupId: child.id, name: 'Child Server' })
    )

    service.deleteGroup(parent.id)

    expect(service.listGroups()).toEqual([
      expect.objectContaining({ id: child.id, parentId: null })
    ])
    expect(service.getServerById(parentServer.id)?.groupId).toBeNull()
    expect(service.getServerById(childServer.id)?.groupId).toBe(child.id)
  })

  it('stores custom icons as data URLs and keeps the detected brand when the icon is removed', () => {
    if (!DatabaseService) {
      return
    }

    const databasePath = createTempDatabasePath()
    const service = new DatabaseService(databasePath)

    const server = service.createServer(
      createServerInput({
        customIconData: Uint8Array.from([1, 2, 3]),
        customIconMimeType: 'image/png',
        name: 'Icon Host'
      })
    )

    expect(service.getServerById(server.id)).toMatchObject({
      brandId: null,
      customIconDataUrl: 'data:image/png;base64,AQID'
    })

    service.updateServerBrand(server.id, 'ubuntu')
    const updated = service.updateServer(
      server.id,
      createServerInput({
        customIconData: null,
        customIconMimeType: null,
        name: 'Icon Host Updated'
      })
    )

    expect(updated).toMatchObject({
      brandId: 'ubuntu',
      customIconDataUrl: null,
      name: 'Icon Host Updated'
    })
  })

  it('persists the automatic update check setting', () => {
    if (!DatabaseService) {
      return
    }

    const databasePath = createTempDatabasePath()
    const service = new DatabaseService(databasePath)

    expect(service.getSettings()).toEqual(DEFAULT_APP_SETTINGS)

    const updated = service.updateSettings({
      autoUpdateCheckEnabled: false
    })

    expect(updated.autoUpdateCheckEnabled).toBe(false)
    expect(service.getSettings().autoUpdateCheckEnabled).toBe(false)
  })

  it('persists the resource monitor interval setting', () => {
    if (!DatabaseService) {
      return
    }

    const databasePath = createTempDatabasePath()
    const service = new DatabaseService(databasePath)

    expect(service.getSettings().resourceMonitorIntervalMs).toBe(
      DEFAULT_APP_SETTINGS.resourceMonitorIntervalMs
    )

    const updated = service.updateSettings({
      resourceMonitorIntervalMs: 5000
    })

    expect(updated.resourceMonitorIntervalMs).toBe(5000)
    expect(service.getSettings().resourceMonitorIntervalMs).toBe(5000)
  })
})
