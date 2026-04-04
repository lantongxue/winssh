import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import type {
  AppSettings,
  Credential,
  CredentialSecret,
  CredentialUpsertInput,
  GroupInput,
  KnownHost,
  RecentSession,
  Server,
  ServerGroup,
  ServerUpsertInput,
  Tag,
  TagInput
} from '@shared/types'

type GroupRow = {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

type TagRow = GroupRow

type CredentialRow = {
  id: string
  name: string
  kind: 'password' | 'privateKey'
  username: string | null
  note: string | null
  created_at: string
  updated_at: string
}

type CredentialSecretRow = {
  password: string | null
  private_key: string | null
  passphrase: string | null
}

type ServerRow = {
  id: string
  name: string
  host: string
  port: number
  username: string
  auth_type: 'password' | 'privateKey'
  private_key_path: string | null
  private_key: string | null
  note: string | null
  group_id: string | null
  credential_id: string | null
  jump_server_id: string | null
  favorite: number
  created_at: string
  updated_at: string
  last_connected_at: string | null
  group_name: string | null
  group_color: string | null
  group_created_at: string | null
  group_updated_at: string | null
}

type ServerTagRow = {
  server_id: string
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

type RecentSessionRow = {
  id: string
  server_id: string
  server_name: string
  host: string
  connected_at: string
}

type KnownHostRow = {
  host: string
  port: number
  algorithm: string
  fingerprint: string
  verified_at: string
}

type SettingsRow = {
  key: string
  value: string
}

type TableColumnRow = {
  name: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapGroup(row: GroupRow): ServerGroup {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapServer(row: ServerRow, tags: Tag[]): Server {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    username: row.username,
    authType: row.auth_type,
    privateKeyPath: row.private_key_path,
    note: row.note,
    groupId: row.group_id,
    credentialId: row.credential_id,
    jumpServerId: row.jump_server_id,
    favorite: Boolean(row.favorite),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastConnectedAt: row.last_connected_at,
    group: row.group_id
      ? {
          id: row.group_id,
          name: row.group_name ?? '',
          color: row.group_color ?? 'slate',
          createdAt: row.group_created_at ?? row.created_at,
          updatedAt: row.group_updated_at ?? row.updated_at
        }
      : null,
    tags,
    hasPassword: false,
    hasPassphrase: false
  }
}

function mapKnownHost(row: KnownHostRow): KnownHost {
  return {
    host: row.host,
    port: row.port,
    algorithm: row.algorithm,
    fingerprint: row.fingerprint,
    verifiedAt: row.verified_at
  }
}

export class DatabaseService {
  private readonly db: Database.Database

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true })
    this.db = new Database(databasePath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.initialize()
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS server_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS credentials (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('password', 'privateKey')),
        username TEXT,
        password TEXT,
        private_key TEXT,
        passphrase TEXT,
        note TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS servers (
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
        jump_server_id TEXT REFERENCES servers(id) ON DELETE SET NULL,
        favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_connected_at TEXT
      );

      CREATE TABLE IF NOT EXISTS server_tags (
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (server_id, tag_id)
      );

      CREATE TABLE IF NOT EXISTS known_hosts (
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        algorithm TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        verified_at TEXT NOT NULL,
        PRIMARY KEY (host, port)
      );

      CREATE TABLE IF NOT EXISTS recent_sessions (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        connected_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)

    const serverColumns = this.db.prepare('PRAGMA table_info(servers)').all() as TableColumnRow[]
    if (!serverColumns.some((column) => column.name === 'private_key')) {
      this.db.exec('ALTER TABLE servers ADD COLUMN private_key TEXT')
    }
    if (!serverColumns.some((column) => column.name === 'credential_id')) {
      this.db.exec(
        'ALTER TABLE servers ADD COLUMN credential_id TEXT REFERENCES credentials(id) ON DELETE SET NULL'
      )
    }
    if (!serverColumns.some((column) => column.name === 'jump_server_id')) {
      this.db.exec(
        'ALTER TABLE servers ADD COLUMN jump_server_id TEXT REFERENCES servers(id) ON DELETE SET NULL'
      )
    }
  }

  listGroups(): ServerGroup[] {
    const rows = this.db
      .prepare('SELECT * FROM server_groups ORDER BY name COLLATE NOCASE ASC')
      .all() as GroupRow[]

    return rows.map(mapGroup)
  }

  createGroup(input: GroupInput): ServerGroup {
    const id = randomUUID()
    const now = nowIso()
    this.db
      .prepare(
        'INSERT INTO server_groups (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, input.name.trim(), input.color, now, now)

    return this.getGroupById(id) as ServerGroup
  }

  updateGroup(id: string, input: GroupInput): ServerGroup {
    this.db
      .prepare('UPDATE server_groups SET name = ?, color = ?, updated_at = ? WHERE id = ?')
      .run(input.name.trim(), input.color, nowIso(), id)

    return this.getGroupById(id) as ServerGroup
  }

  deleteGroup(id: string): void {
    const transaction = this.db.transaction((groupId: string) => {
      this.db.prepare('UPDATE servers SET group_id = NULL WHERE group_id = ?').run(groupId)
      this.db.prepare('DELETE FROM server_groups WHERE id = ?').run(groupId)
    })

    transaction(id)
  }

  private getGroupById(id: string): ServerGroup | null {
    const row = this.db.prepare('SELECT * FROM server_groups WHERE id = ?').get(id) as
      | GroupRow
      | undefined
    return row ? mapGroup(row) : null
  }

  listTags(): Tag[] {
    const rows = this.db
      .prepare('SELECT * FROM tags ORDER BY name COLLATE NOCASE ASC')
      .all() as TagRow[]
    return rows.map(mapTag)
  }

  createTag(input: TagInput): Tag {
    const id = randomUUID()
    const now = nowIso()
    this.db
      .prepare('INSERT INTO tags (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(id, input.name.trim(), input.color, now, now)

    return this.getTagById(id) as Tag
  }

  updateTag(id: string, input: TagInput): Tag {
    this.db
      .prepare('UPDATE tags SET name = ?, color = ?, updated_at = ? WHERE id = ?')
      .run(input.name.trim(), input.color, nowIso(), id)

    return this.getTagById(id) as Tag
  }

  deleteTag(id: string): void {
    const transaction = this.db.transaction((tagId: string) => {
      this.db.prepare('DELETE FROM server_tags WHERE tag_id = ?').run(tagId)
      this.db.prepare('DELETE FROM tags WHERE id = ?').run(tagId)
    })

    transaction(id)
  }

  private getTagById(id: string): Tag | null {
    const row = this.db.prepare('SELECT * FROM tags WHERE id = ?').get(id) as TagRow | undefined
    return row ? mapTag(row) : null
  }

  listServers(): Server[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            servers.*,
            server_groups.name AS group_name,
            server_groups.color AS group_color,
            server_groups.created_at AS group_created_at,
            server_groups.updated_at AS group_updated_at
          FROM servers
          LEFT JOIN server_groups ON server_groups.id = servers.group_id
          ORDER BY servers.favorite DESC, servers.updated_at DESC, servers.name COLLATE NOCASE ASC
        `
      )
      .all() as ServerRow[]

    const tagRows = this.db
      .prepare(
        `
          SELECT
            server_tags.server_id,
            tags.id,
            tags.name,
            tags.color,
            tags.created_at,
            tags.updated_at
          FROM server_tags
          INNER JOIN tags ON tags.id = server_tags.tag_id
        `
      )
      .all() as ServerTagRow[]

    const tagsByServer = new Map<string, Tag[]>()
    for (const row of tagRows) {
      const existing = tagsByServer.get(row.server_id) ?? []
      existing.push(mapTag(row))
      tagsByServer.set(row.server_id, existing)
    }

    return rows.map((row) => mapServer(row, tagsByServer.get(row.id) ?? []))
  }

  getServerById(id: string): Server | null {
    return this.listServers().find((server) => server.id === id) ?? null
  }

  getServerPrivateKey(id: string): string | null {
    const row = this.db.prepare('SELECT private_key FROM servers WHERE id = ?').get(id) as
      | Pick<ServerRow, 'private_key'>
      | undefined

    return row?.private_key ?? null
  }

  createServer(input: ServerUpsertInput): Server {
    const id = randomUUID()
    this.saveServer({ ...input, id })
    return this.getServerById(id) as Server
  }

  updateServer(id: string, input: ServerUpsertInput): Server {
    this.saveServer({ ...input, id })
    return this.getServerById(id) as Server
  }

  private saveServer(input: ServerUpsertInput & { id: string }): void {
    const now = nowIso()
    const existing = this.getServerById(input.id)

    const transaction = this.db.transaction((payload: ServerUpsertInput & { id: string }) => {
      if (existing) {
        this.db
          .prepare(
            `
              UPDATE servers
              SET
                name = ?,
                host = ?,
                port = ?,
                username = ?,
                auth_type = ?,
                private_key = ?,
                private_key_path = ?,
                note = ?,
                group_id = ?,
                jump_server_id = ?,
                favorite = ?,
                credential_id = ?,
                updated_at = ?
              WHERE id = ?
            `
          )
          .run(
            payload.name.trim(),
            payload.host.trim(),
            payload.port,
            payload.username.trim(),
            payload.authType,
            payload.privateKey?.trim() ? payload.privateKey : null,
            null,
            payload.note?.trim() || null,
            payload.groupId || null,
            payload.jumpServerId || null,
            payload.favorite ? 1 : 0,
            payload.credentialId || null,
            now,
            payload.id
          )
      } else {
        this.db
          .prepare(
            `
              INSERT INTO servers (
                id, name, host, port, username, auth_type, private_key, private_key_path, note,
                group_id, jump_server_id, favorite, credential_id, created_at, updated_at, last_connected_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
          )
          .run(
            payload.id,
            payload.name.trim(),
            payload.host.trim(),
            payload.port,
            payload.username.trim(),
            payload.authType,
            payload.privateKey?.trim() ? payload.privateKey : null,
            null,
            payload.note?.trim() || null,
            payload.groupId || null,
            payload.jumpServerId || null,
            payload.favorite ? 1 : 0,
            payload.credentialId || null,
            now,
            now,
            null
          )
      }

      this.db.prepare('DELETE FROM server_tags WHERE server_id = ?').run(payload.id)
      for (const tagId of payload.tagIds) {
        this.db
          .prepare('INSERT INTO server_tags (server_id, tag_id) VALUES (?, ?)')
          .run(payload.id, tagId)
      }
    })

    transaction(input)
  }

  deleteServer(id: string): void {
    const transaction = this.db.transaction((serverId: string) => {
      this.db.prepare('DELETE FROM recent_sessions WHERE server_id = ?').run(serverId)
      this.db.prepare('DELETE FROM server_tags WHERE server_id = ?').run(serverId)
      this.db.prepare('DELETE FROM servers WHERE id = ?').run(serverId)
    })

    transaction(id)
  }

  toggleFavorite(id: string): Server {
    this.db
      .prepare(
        'UPDATE servers SET favorite = CASE favorite WHEN 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?'
      )
      .run(nowIso(), id)

    return this.getServerById(id) as Server
  }

  recordRecentSession(serverId: string): void {
    const now = nowIso()
    const transaction = this.db.transaction((id: string, connectedAt: string) => {
      this.db
        .prepare('INSERT INTO recent_sessions (id, server_id, connected_at) VALUES (?, ?, ?)')
        .run(randomUUID(), id, connectedAt)
      this.db
        .prepare('UPDATE servers SET last_connected_at = ?, updated_at = ? WHERE id = ?')
        .run(connectedAt, connectedAt, id)
      this.db
        .prepare(
          `
          DELETE FROM recent_sessions
          WHERE id NOT IN (
            SELECT id FROM recent_sessions ORDER BY connected_at DESC LIMIT 20
          )
        `
        )
        .run()
    })

    transaction(serverId, now)
  }

  listRecentSessions(limit = 8): RecentSession[] {
    const rows = this.db
      .prepare(
        `
          SELECT
            recent_sessions.id,
            recent_sessions.server_id,
            recent_sessions.connected_at,
            servers.name AS server_name,
            servers.host AS host
          FROM recent_sessions
          INNER JOIN servers ON servers.id = recent_sessions.server_id
          ORDER BY recent_sessions.connected_at DESC
          LIMIT ?
        `
      )
      .all(limit) as RecentSessionRow[]

    return rows.map((row) => ({
      id: row.id,
      serverId: row.server_id,
      serverName: row.server_name,
      host: row.host,
      connectedAt: row.connected_at
    }))
  }

  clearRecentSessions(): void {
    this.db.prepare('DELETE FROM recent_sessions').run()
  }

  listKnownHosts(): KnownHost[] {
    const rows = this.db
      .prepare('SELECT * FROM known_hosts ORDER BY verified_at DESC, host ASC, port ASC')
      .all() as KnownHostRow[]

    return rows.map(mapKnownHost)
  }

  getKnownHost(host: string, port: number): KnownHost | null {
    const row = this.db
      .prepare('SELECT * FROM known_hosts WHERE host = ? AND port = ?')
      .get(host, port) as KnownHostRow | undefined

    return row ? mapKnownHost(row) : null
  }

  deleteKnownHost(host: string, port: number): void {
    this.db.prepare('DELETE FROM known_hosts WHERE host = ? AND port = ?').run(host, port)
  }

  upsertKnownHost(input: KnownHost): KnownHost {
    this.db
      .prepare(
        `
          INSERT INTO known_hosts (host, port, algorithm, fingerprint, verified_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(host, port) DO UPDATE SET
            algorithm = excluded.algorithm,
            fingerprint = excluded.fingerprint,
            verified_at = excluded.verified_at
        `
      )
      .run(input.host, input.port, input.algorithm, input.fingerprint, input.verifiedAt)

    return this.getKnownHost(input.host, input.port) as KnownHost
  }

  getSettings(): AppSettings {
    const row = this.db.prepare('SELECT * FROM app_settings WHERE key = ?').get('app') as
      | SettingsRow
      | undefined
    if (!row) {
      return DEFAULT_APP_SETTINGS
    }

    try {
      return {
        ...DEFAULT_APP_SETTINGS,
        ...(JSON.parse(row.value) as Partial<AppSettings>)
      }
    } catch {
      return DEFAULT_APP_SETTINGS
    }
  }

  updateSettings(input: Partial<AppSettings>): AppSettings {
    const merged = {
      ...this.getSettings(),
      ...input
    }

    this.db
      .prepare(
        `
          INSERT INTO app_settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `
      )
      .run('app', JSON.stringify(merged))

    return merged
  }

  close(): void {
    this.db.close()
  }

  // ── Credentials ───────────────────────────────────────────────────────────

  private mapCredential(row: CredentialRow): Credential {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      username: row.username,
      note: row.note,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  listCredentials(): Credential[] {
    const rows = this.db
      .prepare(
        'SELECT id, name, kind, username, note, created_at, updated_at FROM credentials ORDER BY name COLLATE NOCASE ASC'
      )
      .all() as CredentialRow[]
    return rows.map((row) => this.mapCredential(row))
  }

  getCredentialById(id: string): Credential | null {
    const row = this.db
      .prepare(
        'SELECT id, name, kind, username, note, created_at, updated_at FROM credentials WHERE id = ?'
      )
      .get(id) as CredentialRow | undefined
    return row ? this.mapCredential(row) : null
  }

  getCredentialSecret(id: string): CredentialSecret | null {
    const row = this.db
      .prepare('SELECT password, private_key, passphrase FROM credentials WHERE id = ?')
      .get(id) as CredentialSecretRow | undefined
    if (!row) return null
    return {
      password: row.password,
      privateKey: row.private_key,
      passphrase: row.passphrase
    }
  }

  createCredential(input: CredentialUpsertInput): Credential {
    const id = randomUUID()
    const now = nowIso()
    this.db
      .prepare(
        `INSERT INTO credentials (id, name, kind, username, password, private_key, passphrase, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.name.trim(),
        input.kind,
        input.username?.trim() || null,
        input.password?.trim() || null,
        input.privateKey?.trim() || null,
        input.passphrase?.trim() || null,
        input.note?.trim() || null,
        now,
        now
      )
    return this.getCredentialById(id) as Credential
  }

  updateCredential(id: string, input: CredentialUpsertInput): Credential {
    const now = nowIso()
    this.db
      .prepare(
        `UPDATE credentials
         SET name = ?, kind = ?, username = ?, password = ?, private_key = ?, passphrase = ?, note = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        input.name.trim(),
        input.kind,
        input.username?.trim() || null,
        input.password?.trim() || null,
        input.privateKey?.trim() || null,
        input.passphrase?.trim() || null,
        input.note?.trim() || null,
        now,
        id
      )
    return this.getCredentialById(id) as Credential
  }

  deleteCredential(id: string): void {
    // servers.credential_id has ON DELETE SET NULL so refs are cleared automatically
    this.db.prepare('DELETE FROM credentials WHERE id = ?').run(id)
  }
}
