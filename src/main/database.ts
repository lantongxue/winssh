import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  COMMAND_HISTORY_CAP,
  COMMAND_HISTORY_LOCAL_SCOPE,
  DEFAULT_APP_SETTINGS
} from '@shared/constants'
import {
  normalizeIntegratedEditorFontId,
  normalizeIntegratedTerminalFontId,
  normalizeIntegratedUiFontId,
  resolveLegacyTerminalFontId
} from '@shared/integrated-fonts'
import type { ServerBrandId, ServerIconMimeType } from '@shared/server-brands'
import type {
  AppSettings,
  CommandHistoryEntry,
  CommandHistoryScope,
  Credential,
  CredentialSecret,
  CredentialUpsertInput,
  CustomCommand,
  GroupInput,
  KnownHost,
  RecentSession,
  Server,
  ServerGroup,
  ServerUpsertInput,
  Tag,
  TagInput,
  SftpBookmark
} from '@shared/types'

type GroupRow = {
  id: string
  name: string
  parent_id: string | null
  color: string
  created_at: string
  updated_at: string
}

type TagRow = {
  id: string
  name: string
  color: string
  created_at: string
  updated_at: string
}

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
  brand_id: ServerBrandId | null
  custom_icon_mime_type: ServerIconMimeType | null
  custom_icon: Buffer | null
  private_key_path: string | null
  private_key: string | null
  password: string | null
  passphrase: string | null
  note: string | null
  group_id: string | null
  credential_id: string | null
  jump_server_id: string | null
  proxy_mode: 'global' | 'none' | 'custom'
  proxy_type: 'socks5' | 'http'
  proxy_host: string | null
  proxy_port: number
  favorite: number
  capture_command_history: number
  created_at: string
  updated_at: string
  last_connected_at: string | null
  group_name: string | null
  group_color: string | null
  group_parent_id: string | null
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

type CommandHistoryRow = {
  id: string
  scope_kind: 'ssh' | 'local'
  server_id: string | null
  local_scope: string | null
  command: string
  executed_at: string
  cwd: string | null
  exit_code: number | null
  duration_ms: number | null
}

type CustomCommandRow = {
  id: string
  name: string
  command: string
  created_at: string
  updated_at: string
}

type SftpBookmarkRow = {
  id: string
  server_id: string
  path: string
  created_at: string
}

type SettingsRow = {
  key: string
  value: string
}

type StoredSettings = Partial<AppSettings> & {
  terminalFontFamily?: string
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
    parentId: row.parent_id,
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

function toDataUrl(mimeType: ServerIconMimeType | null, data: Buffer | null): string | null {
  if (!mimeType || !data || data.byteLength === 0) {
    return null
  }

  return `data:${mimeType};base64,${data.toString('base64')}`
}

function mapServer(row: ServerRow, tags: Tag[]): Server {
  return {
    id: row.id,
    name: row.name,
    host: row.host,
    port: row.port,
    username: row.username,
    authType: row.auth_type,
    brandId: row.brand_id,
    customIconDataUrl: toDataUrl(row.custom_icon_mime_type, row.custom_icon),
    privateKeyPath: row.private_key_path,
    note: row.note,
    groupId: row.group_id,
    credentialId: row.credential_id,
    jumpServerId: row.jump_server_id,
    proxyMode: row.proxy_mode ?? 'global',
    proxyType: row.proxy_type ?? 'socks5',
    proxyHost: row.proxy_host ?? null,
    proxyPort: row.proxy_port ?? 1080,
    favorite: Boolean(row.favorite),
    captureCommandHistory:
      row.capture_command_history === null ? true : Boolean(row.capture_command_history),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastConnectedAt: row.last_connected_at,
    group: row.group_id
      ? {
          id: row.group_id,
          name: row.group_name ?? '',
          parentId: row.group_parent_id ?? null,
          color: row.group_color ?? 'slate',
          createdAt: row.group_created_at ?? row.created_at,
          updatedAt: row.group_updated_at ?? row.updated_at
        }
      : null,
    tags,
    hasPassword: Boolean(row.password),
    hasPassphrase: Boolean(row.passphrase)
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

function mapCommandHistory(row: CommandHistoryRow): CommandHistoryEntry {
  return {
    id: row.id,
    scopeKind: row.scope_kind,
    serverId: row.server_id,
    command: row.command,
    executedAt: row.executed_at,
    cwd: row.cwd,
    exitCode: row.exit_code,
    durationMs: row.duration_ms
  }
}

function mapCustomCommand(row: CustomCommandRow): CustomCommand {
  return {
    id: row.id,
    name: row.name,
    command: row.command,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapSftpBookmark(row: SftpBookmarkRow): SftpBookmark {
  return {
    id: row.id,
    serverId: row.server_id,
    path: row.path,
    createdAt: row.created_at
  }
}

function commandScopeKey(scope: CommandHistoryScope): {
  scopeKind: 'ssh' | 'local'
  serverId: string | null
  localScope: string | null
} {
  if (scope.kind === 'ssh') {
    return { scopeKind: 'ssh', serverId: scope.serverId, localScope: null }
  }
  return { scopeKind: 'local', serverId: null, localScope: COMMAND_HISTORY_LOCAL_SCOPE }
}

export class DatabaseService {
  private readonly db: Database.Database
  private readonly databasePath: string

  constructor(databasePath: string) {
    mkdirSync(dirname(databasePath), { recursive: true })
    this.databasePath = databasePath
    this.db = new Database(databasePath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('foreign_keys = ON')
    this.initialize()
  }

  getDatabasePath(): string {
    return this.databasePath
  }

  async exportDatabase(targetPath: string): Promise<void> {
    mkdirSync(dirname(targetPath), { recursive: true })
    await this.db.backup(targetPath)
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS server_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        parent_id TEXT REFERENCES server_groups(id) ON DELETE SET NULL,
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
        brand_id TEXT,
        custom_icon_mime_type TEXT,
        custom_icon BLOB,
        private_key_path TEXT,
        private_key TEXT,
        password TEXT,
        passphrase TEXT,
        note TEXT,
        group_id TEXT REFERENCES server_groups(id) ON DELETE SET NULL,
        jump_server_id TEXT REFERENCES servers(id) ON DELETE SET NULL,
        proxy_mode TEXT NOT NULL DEFAULT 'global' CHECK (proxy_mode IN ('global', 'none', 'custom')),
        proxy_type TEXT NOT NULL DEFAULT 'socks5' CHECK (proxy_type IN ('socks5', 'http')),
        proxy_host TEXT,
        proxy_port INTEGER NOT NULL DEFAULT 1080,
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

      CREATE TABLE IF NOT EXISTS command_history (
        id TEXT PRIMARY KEY,
        scope_kind TEXT NOT NULL CHECK (scope_kind IN ('ssh', 'local')),
        server_id TEXT REFERENCES servers(id) ON DELETE CASCADE,
        local_scope TEXT,
        command TEXT NOT NULL,
        executed_at TEXT NOT NULL,
        cwd TEXT,
        exit_code INTEGER,
        duration_ms INTEGER,
        CHECK (
          (scope_kind = 'ssh'   AND server_id IS NOT NULL AND local_scope IS NULL)
          OR
          (scope_kind = 'local' AND server_id IS NULL     AND local_scope IS NOT NULL)
        )
      );

      CREATE INDEX IF NOT EXISTS idx_cmdhist_ssh
        ON command_history(server_id, executed_at DESC)
        WHERE scope_kind = 'ssh';

      CREATE INDEX IF NOT EXISTS idx_cmdhist_local
        ON command_history(local_scope, executed_at DESC)
        WHERE scope_kind = 'local';

      CREATE TABLE IF NOT EXISTS custom_commands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        command TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sftp_bookmarks (
        id TEXT PRIMARY KEY,
        server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
        path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(server_id, path)
      );
    `)

    const customCommandColumns = this.db
      .prepare('PRAGMA table_info(custom_commands)')
      .all() as TableColumnRow[]
    if (
      !customCommandColumns.some((column) => column.name === 'updated_at') ||
      customCommandColumns.some((column) => column.name === 'scope_kind')
    ) {
      this.db.exec('DROP TABLE IF EXISTS custom_commands')
      this.db.exec(`CREATE TABLE custom_commands (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        command TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`)
    }

    const groupColumns = this.db
      .prepare('PRAGMA table_info(server_groups)')
      .all() as TableColumnRow[]
    if (!groupColumns.some((column) => column.name === 'parent_id')) {
      this.db.exec(
        'ALTER TABLE server_groups ADD COLUMN parent_id TEXT REFERENCES server_groups(id) ON DELETE SET NULL'
      )
    }

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
    if (!serverColumns.some((column) => column.name === 'brand_id')) {
      this.db.exec('ALTER TABLE servers ADD COLUMN brand_id TEXT')
    }
    if (!serverColumns.some((column) => column.name === 'custom_icon_mime_type')) {
      this.db.exec('ALTER TABLE servers ADD COLUMN custom_icon_mime_type TEXT')
    }
    if (!serverColumns.some((column) => column.name === 'custom_icon')) {
      this.db.exec('ALTER TABLE servers ADD COLUMN custom_icon BLOB')
    }
    if (!serverColumns.some((column) => column.name === 'password')) {
      this.db.exec('ALTER TABLE servers ADD COLUMN password TEXT')
    }
    if (!serverColumns.some((column) => column.name === 'passphrase')) {
      this.db.exec('ALTER TABLE servers ADD COLUMN passphrase TEXT')
    }
    if (!serverColumns.some((column) => column.name === 'capture_command_history')) {
      this.db.exec(
        'ALTER TABLE servers ADD COLUMN capture_command_history INTEGER NOT NULL DEFAULT 1'
      )
    }
    if (!serverColumns.some((column) => column.name === 'proxy_mode')) {
      this.db.exec("ALTER TABLE servers ADD COLUMN proxy_mode TEXT NOT NULL DEFAULT 'global'")
    }
    if (!serverColumns.some((column) => column.name === 'proxy_type')) {
      this.db.exec("ALTER TABLE servers ADD COLUMN proxy_type TEXT NOT NULL DEFAULT 'socks5'")
    }
    if (!serverColumns.some((column) => column.name === 'proxy_host')) {
      this.db.exec('ALTER TABLE servers ADD COLUMN proxy_host TEXT')
    }
    if (!serverColumns.some((column) => column.name === 'proxy_port')) {
      this.db.exec('ALTER TABLE servers ADD COLUMN proxy_port INTEGER NOT NULL DEFAULT 1080')
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
    const parentId = input.parentId || null
    this.assertValidGroupParent(id, parentId)
    this.db
      .prepare(
        'INSERT INTO server_groups (id, name, parent_id, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      )
      .run(id, input.name.trim(), parentId, input.color, now, now)

    return this.getGroupById(id) as ServerGroup
  }

  updateGroup(id: string, input: GroupInput): ServerGroup {
    const existing = this.getGroupById(id)
    if (!existing) {
      throw new Error('Group not found')
    }

    const parentId = input.parentId === undefined ? existing.parentId : input.parentId || null
    this.assertValidGroupParent(id, parentId)
    this.db
      .prepare(
        'UPDATE server_groups SET name = ?, parent_id = ?, color = ?, updated_at = ? WHERE id = ?'
      )
      .run(input.name.trim(), parentId, input.color, nowIso(), id)

    return this.getGroupById(id) as ServerGroup
  }

  deleteGroup(id: string): void {
    const transaction = this.db.transaction((groupId: string) => {
      this.db.prepare('UPDATE servers SET group_id = NULL WHERE group_id = ?').run(groupId)
      this.db.prepare('UPDATE server_groups SET parent_id = NULL WHERE parent_id = ?').run(groupId)
      this.db.prepare('DELETE FROM server_groups WHERE id = ?').run(groupId)
    })

    transaction(id)
  }

  private getGroupById(id: string): ServerGroup | null {
    const row = this.db.prepare('SELECT * FROM server_groups WHERE id = ?').get(id) as
      GroupRow | undefined
    return row ? mapGroup(row) : null
  }

  private assertValidGroupParent(groupId: string, parentId: string | null): void {
    if (!parentId) {
      return
    }

    if (parentId === groupId) {
      throw new Error('A group cannot be its own parent')
    }

    let currentParentId: string | null = parentId
    const visited = new Set<string>()

    while (currentParentId) {
      if (currentParentId === groupId) {
        throw new Error('A group cannot be moved inside one of its descendants')
      }

      if (visited.has(currentParentId)) {
        throw new Error('Group hierarchy contains a cycle')
      }
      visited.add(currentParentId)

      const parent = this.getGroupById(currentParentId)
      if (!parent) {
        throw new Error('Parent group not found')
      }

      currentParentId = parent.parentId
    }
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
            server_groups.parent_id AS group_parent_id,
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
      Pick<ServerRow, 'private_key'> | undefined

    return row?.private_key ?? null
  }

  getServerPassword(id: string): string | null {
    const row = this.db.prepare('SELECT password FROM servers WHERE id = ?').get(id) as
      Pick<ServerRow, 'password'> | undefined

    return row?.password ?? null
  }

  getServerPassphrase(id: string): string | null {
    const row = this.db.prepare('SELECT passphrase FROM servers WHERE id = ?').get(id) as
      Pick<ServerRow, 'passphrase'> | undefined

    return row?.passphrase ?? null
  }

  updateServerPassword(id: string, password: string | null): void {
    this.db
      .prepare('UPDATE servers SET password = ?, updated_at = ? WHERE id = ?')
      .run(password, nowIso(), id)
  }

  updateServerPassphrase(id: string, passphrase: string | null): void {
    this.db
      .prepare('UPDATE servers SET passphrase = ?, updated_at = ? WHERE id = ?')
      .run(passphrase, nowIso(), id)
  }

  migrateServerSecrets(
    secrets: Array<{ serverId: string; password: string | null; passphrase: string | null }>
  ): void {
    const updatePassword = this.db.prepare(
      'UPDATE servers SET password = ? WHERE id = ? AND password IS NULL'
    )
    const updatePassphrase = this.db.prepare(
      'UPDATE servers SET passphrase = ? WHERE id = ? AND passphrase IS NULL'
    )
    const transaction = this.db.transaction((items: typeof secrets) => {
      for (const item of items) {
        if (item.password !== null) {
          updatePassword.run(item.password, item.serverId)
        }
        if (item.passphrase !== null) {
          updatePassphrase.run(item.passphrase, item.serverId)
        }
      }
    })
    transaction(secrets)
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
    const existingAssets = this.db
      .prepare('SELECT custom_icon_mime_type, custom_icon, credential_id FROM servers WHERE id = ?')
      .get(input.id) as
      Pick<ServerRow, 'custom_icon_mime_type' | 'custom_icon' | 'credential_id'> | undefined
    const customIconMimeType =
      input.customIconMimeType === undefined
        ? (existingAssets?.custom_icon_mime_type ?? null)
        : input.customIconMimeType
    const customIcon =
      input.customIconData === undefined
        ? (existingAssets?.custom_icon ?? null)
        : input.customIconData
          ? Buffer.from(input.customIconData)
          : null
    const proxyMode = input.proxyMode ?? existing?.proxyMode ?? 'global'
    const proxyType = input.proxyType ?? existing?.proxyType ?? 'socks5'
    const proxyHost =
      input.proxyHost === undefined
        ? (existing?.proxyHost ?? null)
        : input.proxyHost?.trim() || null
    const proxyPort = input.proxyPort ?? existing?.proxyPort ?? 1080

    const transaction = this.db.transaction((payload: ServerUpsertInput & { id: string }) => {
      const captureFlag = payload.captureCommandHistory === false ? 0 : 1

      // Handle "保存到凭据库" (Save to Credential Vault)
      const shouldSaveToVault =
        payload.authType === 'password' ? payload.rememberPassword : payload.rememberPassphrase

      let credentialId = payload.credentialId || null

      if (shouldSaveToVault) {
        // If not explicitly provided but exists on current server record, retrieve it
        if (!credentialId && existingAssets?.credential_id) {
          credentialId = existingAssets.credential_id
        }

        const credKind = payload.authType === 'password' ? 'password' : 'privateKey'
        const credName = `${payload.name} (${payload.username})`

        if (credentialId) {
          // Update existing credential row
          this.db
            .prepare(
              `
                UPDATE credentials
                SET
                  name = ?,
                  kind = ?,
                  username = ?,
                  password = ?,
                  private_key = ?,
                  passphrase = ?,
                  updated_at = ?
                WHERE id = ?
              `
            )
            .run(
              credName,
              credKind,
              payload.username.trim(),
              payload.authType === 'password' ? payload.password || null : null,
              payload.authType === 'privateKey' ? payload.privateKey || null : null,
              payload.authType === 'privateKey' ? payload.passphrase || null : null,
              now,
              credentialId
            )
        } else {
          // Create a new credential row
          credentialId = randomUUID()
          this.db
            .prepare(
              `
                INSERT INTO credentials (
                  id, name, kind, username, password, private_key, passphrase, note, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `
            )
            .run(
              credentialId,
              credName,
              credKind,
              payload.username.trim(),
              payload.authType === 'password' ? payload.password || null : null,
              payload.authType === 'privateKey' ? payload.privateKey || null : null,
              payload.authType === 'privateKey' ? payload.passphrase || null : null,
              null,
              now,
              now
            )
        }
      } else {
        // If "保存到凭据库" is false, and payload.credentialId is null, unlink it.
        if (!payload.credentialId) {
          credentialId = null
        }
      }

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
                custom_icon_mime_type = ?,
                custom_icon = ?,
                private_key = ?,
                private_key_path = ?,
                password = ?,
                passphrase = ?,
                note = ?,
                group_id = ?,
                jump_server_id = ?,
                proxy_mode = ?,
                proxy_type = ?,
                proxy_host = ?,
                proxy_port = ?,
                favorite = ?,
                capture_command_history = ?,
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
            customIconMimeType,
            customIcon,
            payload.privateKey?.trim() ? payload.privateKey : null,
            null,
            payload.password || null,
            payload.passphrase || null,
            payload.note?.trim() || null,
            payload.groupId || null,
            payload.jumpServerId || null,
            proxyMode,
            proxyType,
            proxyHost,
            proxyPort,
            payload.favorite ? 1 : 0,
            captureFlag,
            credentialId,
            now,
            payload.id
          )
      } else {
        this.db
          .prepare(
            `
              INSERT INTO servers (
                id, name, host, port, username, auth_type, brand_id, custom_icon_mime_type,
                custom_icon, private_key, private_key_path, password, passphrase, note, group_id, jump_server_id,
                proxy_mode, proxy_type, proxy_host, proxy_port,
                favorite, capture_command_history, credential_id, created_at, updated_at, last_connected_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `
          )
          .run(
            payload.id,
            payload.name.trim(),
            payload.host.trim(),
            payload.port,
            payload.username.trim(),
            payload.authType,
            null,
            customIconMimeType,
            customIcon,
            payload.privateKey?.trim() ? payload.privateKey : null,
            null,
            payload.password || null,
            payload.passphrase || null,
            payload.note?.trim() || null,
            payload.groupId || null,
            payload.jumpServerId || null,
            proxyMode,
            proxyType,
            proxyHost,
            proxyPort,
            payload.favorite ? 1 : 0,
            captureFlag,
            credentialId,
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

  updateServerBrand(id: string, brandId: ServerBrandId): Server {
    this.db
      .prepare('UPDATE servers SET brand_id = ?, updated_at = ? WHERE id = ?')
      .run(brandId, nowIso(), id)

    return this.getServerById(id) as Server
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
      SettingsRow | undefined
    if (!row) {
      return DEFAULT_APP_SETTINGS
    }

    try {
      const parsed = JSON.parse(row.value) as StoredSettings
      const { terminalFontFamily: _legacyTerminalFontFamily, ...settings } = parsed
      const legacyTerminalFontId =
        parsed.terminalFontId ?? resolveLegacyTerminalFontId(_legacyTerminalFontFamily)

      return {
        ...DEFAULT_APP_SETTINGS,
        ...settings,
        uiFontId: normalizeIntegratedUiFontId(parsed.uiFontId),
        terminalFontId: normalizeIntegratedTerminalFontId(legacyTerminalFontId),
        editorFontId: normalizeIntegratedEditorFontId(parsed.editorFontId)
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

  getWebdavBackupPassword(): string | null {
    const row = this.db
      .prepare('SELECT * FROM app_settings WHERE key = ?')
      .get('webdav_backup_password') as SettingsRow | undefined
    return row ? row.value : null
  }

  setWebdavBackupPassword(password: string | null): void {
    if (password === null) {
      this.db.prepare('DELETE FROM app_settings WHERE key = ?').run('webdav_backup_password')
    } else {
      this.db
        .prepare(
          `
            INSERT INTO app_settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
          `
        )
        .run('webdav_backup_password', password)
    }
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

  // ── Command history ──────────────────────────────────────────────────────

  setServerCaptureCommandHistory(serverId: string, enabled: boolean): void {
    this.db
      .prepare('UPDATE servers SET capture_command_history = ?, updated_at = ? WHERE id = ?')
      .run(enabled ? 1 : 0, nowIso(), serverId)
  }

  recordCommand(input: {
    scope: CommandHistoryScope
    command: string
    executedAt: string
    cwd: string | null
    exitCode: number | null
    durationMs: number | null
  }): CommandHistoryEntry | null {
    const trimmed = input.command.replace(/\r/g, '').trim()
    if (!trimmed) {
      return null
    }
    const { scopeKind, serverId, localScope } = commandScopeKey(input.scope)
    const id = randomUUID()
    const cap = COMMAND_HISTORY_CAP

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO command_history
            (id, scope_kind, server_id, local_scope, command, executed_at, cwd, exit_code, duration_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          scopeKind,
          serverId,
          localScope,
          trimmed,
          input.executedAt,
          input.cwd,
          input.exitCode,
          input.durationMs
        )
      if (scopeKind === 'ssh') {
        this.db
          .prepare(
            `DELETE FROM command_history
              WHERE scope_kind = 'ssh' AND server_id = ?
              AND id NOT IN (
                SELECT id FROM command_history
                WHERE scope_kind = 'ssh' AND server_id = ?
                ORDER BY executed_at DESC, id DESC
                LIMIT ?
              )`
          )
          .run(serverId, serverId, cap)
      } else {
        this.db
          .prepare(
            `DELETE FROM command_history
              WHERE scope_kind = 'local' AND local_scope = ?
              AND id NOT IN (
                SELECT id FROM command_history
                WHERE scope_kind = 'local' AND local_scope = ?
                ORDER BY executed_at DESC, id DESC
                LIMIT ?
              )`
          )
          .run(localScope, localScope, cap)
      }
    })

    transaction()
    const row = this.db.prepare('SELECT * FROM command_history WHERE id = ?').get(id) as
      CommandHistoryRow | undefined
    return row ? mapCommandHistory(row) : null
  }

  listCommands(input: {
    scope: CommandHistoryScope
    limit?: number
    before?: string
  }): CommandHistoryEntry[] {
    const limit = Math.min(Math.max(input.limit ?? 200, 1), COMMAND_HISTORY_CAP)
    const { scopeKind, serverId, localScope } = commandScopeKey(input.scope)
    const beforeClause = input.before ? 'AND executed_at < ?' : ''
    const params: (string | number)[] = []

    let sql: string
    if (scopeKind === 'ssh') {
      sql = `SELECT * FROM command_history
             WHERE scope_kind = 'ssh' AND server_id = ? ${beforeClause}
             ORDER BY executed_at DESC, id DESC
             LIMIT ?`
      params.push(serverId as string)
      if (input.before) params.push(input.before)
      params.push(limit)
    } else {
      sql = `SELECT * FROM command_history
             WHERE scope_kind = 'local' AND local_scope = ? ${beforeClause}
             ORDER BY executed_at DESC, id DESC
             LIMIT ?`
      params.push(localScope as string)
      if (input.before) params.push(input.before)
      params.push(limit)
    }

    const rows = this.db.prepare(sql).all(...params) as CommandHistoryRow[]
    return rows.map(mapCommandHistory)
  }

  searchCommands(input: {
    scope: CommandHistoryScope
    query: string
    limit?: number
  }): CommandHistoryEntry[] {
    const limit = Math.min(Math.max(input.limit ?? 200, 1), COMMAND_HISTORY_CAP)
    const { scopeKind, serverId, localScope } = commandScopeKey(input.scope)
    const escaped = input.query.replace(/[\\%_]/g, (m) => `\\${m}`)
    const pattern = `%${escaped}%`

    let sql: string
    const params: (string | number)[] = []
    if (scopeKind === 'ssh') {
      sql = `SELECT * FROM command_history
             WHERE scope_kind = 'ssh' AND server_id = ?
             AND command LIKE ? ESCAPE '\\'
             ORDER BY executed_at DESC, id DESC
             LIMIT ?`
      params.push(serverId as string, pattern, limit)
    } else {
      sql = `SELECT * FROM command_history
             WHERE scope_kind = 'local' AND local_scope = ?
             AND command LIKE ? ESCAPE '\\'
             ORDER BY executed_at DESC, id DESC
             LIMIT ?`
      params.push(localScope as string, pattern, limit)
    }

    const rows = this.db.prepare(sql).all(...params) as CommandHistoryRow[]
    return rows.map(mapCommandHistory)
  }

  deleteCommand(id: string): void {
    this.db.prepare('DELETE FROM command_history WHERE id = ?').run(id)
  }

  clearCommands(scope: CommandHistoryScope): void {
    const { scopeKind, serverId, localScope } = commandScopeKey(scope)
    if (scopeKind === 'ssh') {
      this.db
        .prepare("DELETE FROM command_history WHERE scope_kind = 'ssh' AND server_id = ?")
        .run(serverId)
    } else {
      this.db
        .prepare("DELETE FROM command_history WHERE scope_kind = 'local' AND local_scope = ?")
        .run(localScope)
    }
  }

  clearAllCommands(): void {
    this.db.prepare('DELETE FROM command_history').run()
  }

  // ── Custom commands ──────────────────────────────────────────────────────

  listCustomCommands(): CustomCommand[] {
    const rows = this.db
      .prepare('SELECT * FROM custom_commands ORDER BY updated_at DESC')
      .all() as CustomCommandRow[]
    return rows.map(mapCustomCommand)
  }

  createCustomCommand(input: { name: string; command: string }): CustomCommand {
    const id = randomUUID()
    const now = nowIso()
    this.db
      .prepare(
        'INSERT INTO custom_commands (id, name, command, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(id, input.name, input.command, now, now)
    const row = this.db
      .prepare('SELECT * FROM custom_commands WHERE id = ?')
      .get(id) as CustomCommandRow
    return mapCustomCommand(row)
  }

  updateCustomCommand(
    id: string,
    input: { name?: string; command?: string }
  ): CustomCommand | null {
    const existing = this.db.prepare('SELECT * FROM custom_commands WHERE id = ?').get(id) as
      CustomCommandRow | undefined
    if (!existing) return null
    const name = input.name ?? existing.name
    const command = input.command ?? existing.command
    const now = nowIso()
    this.db
      .prepare('UPDATE custom_commands SET name = ?, command = ?, updated_at = ? WHERE id = ?')
      .run(name, command, now, id)
    const row = this.db
      .prepare('SELECT * FROM custom_commands WHERE id = ?')
      .get(id) as CustomCommandRow
    return mapCustomCommand(row)
  }

  deleteCustomCommand(id: string): void {
    this.db.prepare('DELETE FROM custom_commands WHERE id = ?').run(id)
  }

  // ── SFTP Bookmarks ───────────────────────────────────────────────────────

  listSftpBookmarks(serverId: string): SftpBookmark[] {
    const rows = this.db
      .prepare('SELECT * FROM sftp_bookmarks WHERE server_id = ? ORDER BY created_at DESC')
      .all(serverId) as SftpBookmarkRow[]
    return rows.map(mapSftpBookmark)
  }

  createSftpBookmark(serverId: string, path: string): SftpBookmark {
    const existing = this.db
      .prepare('SELECT * FROM sftp_bookmarks WHERE server_id = ? AND path = ?')
      .get(serverId, path) as SftpBookmarkRow | undefined
    if (existing) {
      return mapSftpBookmark(existing)
    }
    const id = randomUUID()
    const now = nowIso()
    this.db
      .prepare('INSERT INTO sftp_bookmarks (id, server_id, path, created_at) VALUES (?, ?, ?, ?)')
      .run(id, serverId, path, now)
    const row = this.db
      .prepare('SELECT * FROM sftp_bookmarks WHERE id = ?')
      .get(id) as SftpBookmarkRow
    return mapSftpBookmark(row)
  }

  deleteSftpBookmark(id: string): void {
    this.db.prepare('DELETE FROM sftp_bookmarks WHERE id = ?').run(id)
  }

  deleteSftpBookmarkByPath(serverId: string, path: string): void {
    this.db
      .prepare('DELETE FROM sftp_bookmarks WHERE server_id = ? AND path = ?')
      .run(serverId, path)
  }
}
