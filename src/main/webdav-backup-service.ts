import { renameSync, unlinkSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import type { SecretKind, WebDAVBackupEntry, WebDAVBackupState } from '@shared/types'
import { createLogger, createOperationContext } from './observability'
import type { SettingsApplicationService } from './application/settings-application-service'
import type { DatabaseService } from './database'
import type { SecureStoreService } from './secure-store'

interface WebDAVConfig {
  backupPath: string
  password: string
  url: string
  username: string
}

type WebDAVResponse = {
  body: Buffer
  statusCode: number
}

const MAX_WEBDAV_REDIRECTS = 5
const BACKUP_PASSWORD_ACCOUNT = 'webdav-backup'
const BACKUP_PASSWORD_KIND: SecretKind = 'password'
const DIRECTORY_PROPFIND_BODY =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<D:propfind xmlns:D="DAV:"><D:prop><D:resourcetype/></D:prop></D:propfind>'
const LIST_PROPFIND_BODY =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<D:propfind xmlns:D="DAV:"><D:prop><D:displayname/><D:getlastmodified/></D:prop></D:propfind>'

function getBackupFileName(): string {
  return `winssh-${process.platform}-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
}

function normalizeRemotePath(value: string | null | undefined): string {
  const trimmed = value?.trim() || '/winssh-backup'
  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return normalized.replace(/\/+$/, '') || '/'
}

function buildWebDAVUrl(baseUrl: string, remotePath: string, fileName?: string): string {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '')
  const normalizedPath = normalizeRemotePath(remotePath)
  return fileName
    ? `${normalizedBaseUrl}${normalizedPath}/${encodeURIComponent(fileName)}`
    : `${normalizedBaseUrl}${normalizedPath}`
}

function getIntervalMilliseconds(intervalMinutes: number): number {
  return intervalMinutes * 60 * 1000
}

function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300
}

function isRedirectStatus(statusCode: number): boolean {
  return (
    statusCode === 301 ||
    statusCode === 302 ||
    statusCode === 303 ||
    statusCode === 307 ||
    statusCode === 308
  )
}

function isValidSqliteBuffer(buffer: Buffer): boolean {
  return buffer.subarray(0, 16).toString('ascii').startsWith('SQLite format 3')
}

function isBackupFileName(name: string): boolean {
  return /^winssh-[a-z0-9-]+-.+\.db$/i.test(name)
}

function parseBackupEntries(xml: string): WebDAVBackupEntry[] {
  const files: Array<{ fileName: string; modifiedAt: number }> = []

  for (const responseMatch of xml.matchAll(/<D:response\b[\s\S]*?<\/D:response>/g)) {
    const responseBody = responseMatch[0]
    const nameMatch = responseBody.match(/<D:displayname>([^<]*)<\/D:displayname>/)
    const modifiedMatch = responseBody.match(/<D:getlastmodified>([^<]*)<\/D:getlastmodified>/)

    if (!nameMatch || !modifiedMatch) {
      continue
    }

    const name = nameMatch[1]
    if (!isBackupFileName(name)) {
      continue
    }

    const modifiedAt = Date.parse(modifiedMatch[1])
    if (Number.isNaN(modifiedAt)) {
      continue
    }

    files.push({ fileName: name, modifiedAt })
  }

  files.sort((left, right) => right.modifiedAt - left.modifiedAt)
  return files.map((file) => ({
    fileName: file.fileName,
    modifiedAt: new Date(file.modifiedAt).toISOString()
  }))
}

function sendWebDAVRequest(
  options: {
    body?: Buffer
    headers?: Record<string, string>
    method: string
    password: string
    url: string
    username: string
  },
  redirectCount = 0
): Promise<WebDAVResponse> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(options.url)
    const request = (parsedUrl.protocol === 'https:' ? httpsRequest : httpRequest)(
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${options.username}:${options.password}`).toString('base64')}`,
          ...options.headers
        },
        hostname: parsedUrl.hostname,
        method: options.method,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80)
      },
      (response) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
        })
        response.on('end', () => {
          const statusCode = response.statusCode ?? 0
          const locationHeader = Array.isArray(response.headers.location)
            ? response.headers.location[0]
            : response.headers.location

          if (locationHeader && isRedirectStatus(statusCode)) {
            if (redirectCount >= MAX_WEBDAV_REDIRECTS) {
              reject(new Error(`WebDAV redirect limit exceeded (${MAX_WEBDAV_REDIRECTS})`))
              return
            }

            const redirectMethod = statusCode === 303 ? 'GET' : options.method
            const redirectBody = statusCode === 303 ? undefined : options.body

            sendWebDAVRequest(
              {
                ...options,
                body: redirectBody,
                method: redirectMethod,
                url: new URL(locationHeader, options.url).toString()
              },
              redirectCount + 1
            ).then(resolve, reject)
            return
          }

          resolve({
            body: Buffer.concat(chunks),
            statusCode
          })
        })
      }
    )

    request.on('error', reject)

    if (options.body) {
      request.write(options.body)
    }

    request.end()
  })
}

export class WebDAVBackupService {
  private cachedPassword: string | null = null
  private hasLoadedPassword = false
  private readonly logger = createLogger('main')
  private state: WebDAVBackupState = {
    lastBackupAt: null,
    lastBackupError: null,
    nextBackupAt: null
  }
  private timer: NodeJS.Timeout | null = null

  constructor(
    private readonly database: DatabaseService,
    private readonly secureStore: SecureStoreService,
    private readonly settingsService: SettingsApplicationService
  ) {}

  getState(): WebDAVBackupState {
    return { ...this.state }
  }

  async list(): Promise<WebDAVBackupEntry[]> {
    const config = await this.resolveConfig()
    if (!config) {
      throw new Error('WebDAV is not fully configured yet')
    }

    return this.listRemoteBackups(config)
  }

  async updatePassword(password: string | null): Promise<void> {
    const normalizedPassword = password?.trim() || null
    this.cachedPassword = normalizedPassword
    this.hasLoadedPassword = true

    if (normalizedPassword) {
      const stored = await this.secureStore.setSecret(
        BACKUP_PASSWORD_ACCOUNT,
        BACKUP_PASSWORD_KIND,
        normalizedPassword
      )
      if (!stored) {
        this.logger.warn('Unable to persist WebDAV password in secure storage')
      }
      return
    }

    await this.secureStore.deleteSecret(BACKUP_PASSWORD_ACCOUNT, BACKUP_PASSWORD_KIND)
  }

  async testConnection(): Promise<{ message: string; ok: boolean }> {
    const config = await this.resolveConfig()
    if (!config) {
      return { ok: false, message: 'WebDAV is not fully configured yet' }
    }

    try {
      await this.ensureRemoteDirectory(config)
      return { ok: true, message: 'WebDAV connection is available' }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Unknown WebDAV error'
      }
    }
  }

  async backupNow(): Promise<void> {
    const context = createOperationContext('main', 'backup', 'upload')
    const config = await this.resolveConfig()
    if (!config) {
      throw new Error('WebDAV is not fully configured yet')
    }

    const databasePath = this.database.getDatabasePath()
    const tempBackupPath = join(dirname(databasePath), `.winssh-webdav-backup-${Date.now()}.db`)

    try {
      this.logger.info('Starting WebDAV backup upload', { context })
      await this.database.exportDatabase(tempBackupPath)
      await this.ensureRemoteDirectory(config)

      const backupBuffer = await readFile(tempBackupPath)
      const uploadTarget = buildWebDAVUrl(config.url, config.backupPath, getBackupFileName())
      const uploadResponse = await sendWebDAVRequest({
        body: backupBuffer,
        headers: {
          'Content-Length': String(backupBuffer.byteLength),
          'Content-Type': 'application/octet-stream'
        },
        method: 'PUT',
        password: config.password,
        url: uploadTarget,
        username: config.username
      })

      if (!isSuccessStatus(uploadResponse.statusCode)) {
        throw new Error(`WebDAV upload failed with HTTP ${uploadResponse.statusCode}`)
      }

      this.state = {
        lastBackupAt: new Date().toISOString(),
        lastBackupError: null,
        nextBackupAt: this.getNextBackupAt()
      }
      this.logger.info('WebDAV backup upload completed', { context })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'WebDAV backup failed'
      this.state = {
        ...this.state,
        lastBackupError: message,
        nextBackupAt: this.getNextBackupAt()
      }
      this.logger.error('WebDAV backup upload failed', {
        context,
        error
      })
      throw new Error(message)
    } finally {
      try {
        unlinkSync(tempBackupPath)
      } catch {
        // ignore temp cleanup failures
      }
    }
  }

  async delete(fileName: string): Promise<void> {
    const context = createOperationContext('main', 'backup', 'delete')
    const config = await this.resolveConfig()
    if (!config) {
      throw new Error('WebDAV is not fully configured yet')
    }

    const normalizedFileName = fileName.trim()
    if (!isBackupFileName(normalizedFileName)) {
      throw new Error('The selected WebDAV backup file is invalid')
    }

    try {
      this.logger.info('Starting WebDAV backup delete', {
        context,
        data: { fileName: normalizedFileName }
      })

      const deleteResponse = await sendWebDAVRequest({
        method: 'DELETE',
        password: config.password,
        url: buildWebDAVUrl(config.url, config.backupPath, normalizedFileName),
        username: config.username
      })

      if (deleteResponse.statusCode === 404) {
        throw new Error('The selected WebDAV backup was not found')
      }

      if (!isSuccessStatus(deleteResponse.statusCode)) {
        throw new Error(`WebDAV delete failed with HTTP ${deleteResponse.statusCode}`)
      }

      this.logger.info('WebDAV backup delete completed', {
        context,
        data: { fileName: normalizedFileName }
      })
    } catch (error) {
      this.logger.error('WebDAV backup delete failed', {
        context,
        error
      })
      throw new Error(error instanceof Error ? error.message : 'WebDAV backup delete failed')
    }
  }

  async restore(fileName?: string): Promise<void> {
    const context = createOperationContext('main', 'backup', 'restore')
    const config = await this.resolveConfig()
    if (!config) {
      throw new Error('WebDAV is not fully configured yet')
    }

    try {
      this.logger.info('Starting WebDAV restore', { context })
      const targetBackupFileName = await this.resolveRestoreBackupFileName(config, fileName)
      if (!targetBackupFileName) {
        throw new Error('No remote WinSSH backup was found on WebDAV')
      }

      const downloadResponse = await sendWebDAVRequest({
        method: 'GET',
        password: config.password,
        url: buildWebDAVUrl(config.url, config.backupPath, targetBackupFileName),
        username: config.username
      })

      if (!isSuccessStatus(downloadResponse.statusCode)) {
        throw new Error(`WebDAV download failed with HTTP ${downloadResponse.statusCode}`)
      }

      if (!isValidSqliteBuffer(downloadResponse.body)) {
        throw new Error('The downloaded WebDAV backup is not a valid SQLite database')
      }

      this.stopAutoBackup()

      const databasePath = this.database.getDatabasePath()
      const restorePath = `${databasePath}.restore`
      const rollbackPath = `${databasePath}.rollback-${Date.now()}`

      await writeFile(restorePath, downloadResponse.body)
      this.database.close()

      let movedOriginal = false
      try {
        renameSync(databasePath, rollbackPath)
        movedOriginal = true
      } catch {
        movedOriginal = false
      }

      try {
        renameSync(restorePath, databasePath)
        const { DatabaseService } = await import('./database')
        const probeDatabase = new DatabaseService(databasePath)
        probeDatabase.close()
      } catch (error) {
        try {
          unlinkSync(databasePath)
        } catch {
          // ignore cleanup failures
        }

        if (movedOriginal) {
          renameSync(rollbackPath, databasePath)
        }

        throw error
      }

      this.logger.info('WebDAV restore completed', { context, data: { targetBackupFileName } })
    } catch (error) {
      this.logger.error('WebDAV restore failed', {
        context,
        error
      })
      throw new Error(error instanceof Error ? error.message : 'WebDAV restore failed')
    }
  }

  async syncAutoBackupSettings(): Promise<void> {
    this.stopAutoBackup()

    const settings = this.settingsService.getSettings()
    if (!settings.webdavBackupEnabled) {
      return
    }

    const config = await this.resolveConfig()
    if (!config) {
      return
    }

    this.timer = setInterval(() => {
      void this.backupNow()
    }, getIntervalMilliseconds(settings.webdavBackupIntervalMinutes))

    this.state = {
      ...this.state,
      nextBackupAt: this.getNextBackupAt()
    }
  }

  dispose(): void {
    this.stopAutoBackup()
  }

  private async listRemoteBackups(config: WebDAVConfig): Promise<WebDAVBackupEntry[]> {
    const response = await sendWebDAVRequest({
      body: Buffer.from(LIST_PROPFIND_BODY),
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        Depth: '1'
      },
      method: 'PROPFIND',
      password: config.password,
      url: buildWebDAVUrl(config.url, config.backupPath),
      username: config.username
    })

    if (response.statusCode === 404) {
      return []
    }

    if (response.statusCode !== 207) {
      throw new Error(`Unable to list WebDAV backups (HTTP ${response.statusCode})`)
    }

    return parseBackupEntries(response.body.toString('utf8'))
  }

  private async resolveRestoreBackupFileName(
    config: WebDAVConfig,
    requestedFileName?: string
  ): Promise<string | null> {
    const normalizedFileName = requestedFileName?.trim()
    if (!normalizedFileName) {
      const backups = await this.listRemoteBackups(config)
      return backups[0]?.fileName ?? null
    }

    if (!isBackupFileName(normalizedFileName)) {
      throw new Error('The selected WebDAV backup file is invalid')
    }

    return normalizedFileName
  }

  private getNextBackupAt(): string | null {
    const settings = this.settingsService.getSettings()
    if (!settings.webdavBackupEnabled || !this.timer) {
      return null
    }

    return new Date(
      Date.now() + getIntervalMilliseconds(settings.webdavBackupIntervalMinutes)
    ).toISOString()
  }

  private async getStoredPassword(): Promise<string | null> {
    if (!this.hasLoadedPassword) {
      this.cachedPassword = await this.secureStore.getSecret(
        BACKUP_PASSWORD_ACCOUNT,
        BACKUP_PASSWORD_KIND
      )
      this.hasLoadedPassword = true
    }

    return this.cachedPassword
  }

  private async ensureRemoteDirectory(config: WebDAVConfig): Promise<void> {
    const segments = normalizeRemotePath(config.backupPath).split('/').filter(Boolean)

    if (segments.length === 0) {
      return
    }

    let currentPath = ''
    for (const segment of segments) {
      currentPath = `${currentPath}/${segment}`
      await this.ensureRemoteDirectorySegment(config, currentPath)
    }
  }

  private async ensureRemoteDirectorySegment(config: WebDAVConfig, path: string): Promise<void> {
    const targetUrl = buildWebDAVUrl(config.url, path)
    const probeResponse = await sendWebDAVRequest({
      body: Buffer.from(DIRECTORY_PROPFIND_BODY),
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        Depth: '0'
      },
      method: 'PROPFIND',
      password: config.password,
      url: targetUrl,
      username: config.username
    })

    if (probeResponse.statusCode === 207) {
      return
    }

    if (probeResponse.statusCode !== 404) {
      if (probeResponse.statusCode === 401) {
        throw new Error('WebDAV authentication failed')
      }

      throw new Error(`WebDAV directory probe failed with HTTP ${probeResponse.statusCode}`)
    }

    const createResponse = await sendWebDAVRequest({
      method: 'MKCOL',
      password: config.password,
      url: targetUrl,
      username: config.username
    })

    if (!isSuccessStatus(createResponse.statusCode) && createResponse.statusCode !== 405) {
      throw new Error(`WebDAV directory creation failed with HTTP ${createResponse.statusCode}`)
    }
  }

  private async resolveConfig(): Promise<WebDAVConfig | null> {
    const settings = this.settingsService.getSettings()
    const url = settings.webdavUrl?.trim()
    const username = settings.webdavUsername?.trim()
    const password = await this.getStoredPassword()

    if (!url || !username || !password) {
      return null
    }

    return {
      backupPath: normalizeRemotePath(settings.webdavBackupPath),
      password,
      url,
      username
    }
  }

  private stopAutoBackup(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }

    this.state = {
      ...this.state,
      nextBackupAt: null
    }
  }
}
