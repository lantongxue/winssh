import { EventEmitter } from 'node:events'
import { createWriteStream } from 'node:fs'
import { get as httpsGet } from 'node:https'
import { get as httpGet, type IncomingMessage } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

import type { UpdateState, UpdateUnsupportedReason, UpdateVersionInfo } from '@shared/types'

const execAsync = promisify(exec)

type UpdateEventMap = {
  'checking-for-update': () => void
  'update-available': (info: ProviderUpdateInfo) => void
  'update-not-available': (info: ProviderUpdateInfo) => void
  'download-progress': (info: DownloadProgressInfo) => void
  'update-downloaded': (info: ProviderUpdateInfo) => void
  error: (error: Error) => void
}

type ProviderUpdateInfo = {
  version: string
  releaseDate?: string | null
  releaseName?: string | null
  releaseNotes?: unknown
}

type DownloadProgressInfo = {
  percent: number
}

export interface UpdaterAdapter {
  autoDownload: boolean
  forceDevUpdateConfig?: boolean
  on<K extends keyof UpdateEventMap>(event: K, listener: UpdateEventMap[K]): this
  checkForUpdates(): Promise<unknown>
  downloadUpdate(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

export type UpdateServiceOptions = {
  arch: string
  autoCheckEnabled: boolean
  currentVersion: string
  githubOwner: string
  githubRepo: string
  isPackaged: boolean
  platform: string
  productName: string
  updaterFactory?: (options: UpdateServiceOptions) => UpdaterAdapter
}

function coerceReleaseNotes(input: unknown): string | null {
  return typeof input === 'string' && input.trim() ? input.trim() : null
}

function toVersionInfo(info: ProviderUpdateInfo): UpdateVersionInfo {
  return {
    releaseDate: info.releaseDate ?? null,
    releaseName: info.releaseName ?? null,
    releaseNotes: coerceReleaseNotes(info.releaseNotes),
    version: info.version
  }
}

function resolveUnsupportedReason(options: UpdateServiceOptions): UpdateUnsupportedReason | null {
  if (
    options.platform !== 'win32' &&
    options.platform !== 'darwin' &&
    options.platform !== 'linux'
  ) {
    return 'platform_not_supported'
  }

  if (!options.isPackaged) {
    return 'app_not_packaged'
  }

  if (!options.githubOwner?.trim() || !options.githubRepo?.trim()) {
    return 'feed_url_missing'
  }

  return null
}

function createUpdater(options: UpdateServiceOptions): UpdaterAdapter {
  const electronUpdater = require('electron-updater')

  const config = {
    provider: 'github' as const,
    owner: options.githubOwner,
    repo: options.githubRepo
  }

  if (options.platform === 'win32') {
    return new electronUpdater.NsisUpdater(config)
  }
  if (options.platform === 'darwin') {
    return new electronUpdater.MacUpdater(config)
  }
  return new electronUpdater.AppImageUpdater(config)
}

export class UpdateService extends EventEmitter {
  private readonly updater: UpdaterAdapter | null
  private state: UpdateState
  private readonly platform: string
  private readonly arch: string
  private readonly githubOwner: string
  private readonly githubRepo: string
  private readonly productName: string
  private downloadedDmgPath: string | null = null

  constructor(options: UpdateServiceOptions) {
    super()

    this.platform = options.platform
    this.arch = options.arch
    this.githubOwner = options.githubOwner
    this.githubRepo = options.githubRepo
    this.productName = options.productName

    const unsupportedReason = resolveUnsupportedReason(options)
    this.updater = unsupportedReason ? null : (options.updaterFactory ?? createUpdater)(options)

    this.state = {
      autoCheckEnabled: options.autoCheckEnabled,
      availableUpdate: null,
      currentVersion: options.currentVersion,
      downloadProgressPercent: null,
      errorMessage: null,
      phase: unsupportedReason ? 'unsupported' : 'idle',
      supported: unsupportedReason === null,
      unsupportedReason,
      requiresManualInstall: options.platform !== 'win32'
    }

    if (this.updater) {
      this.updater.autoDownload = false
      this.attachUpdaterEvents(this.updater)
    }
  }

  getState(): UpdateState {
    return { ...this.state }
  }

  setAutoCheckEnabled(enabled: boolean): UpdateState {
    this.state = {
      ...this.state,
      autoCheckEnabled: enabled
    }
    this.emitState()
    return this.getState()
  }

  async check(): Promise<UpdateState> {
    if (!this.updater) {
      return this.getState()
    }

    try {
      await this.updater.checkForUpdates()
    } catch (error) {
      this.setState({
        errorMessage: error instanceof Error ? error.message : 'Failed to check for updates.',
        phase: 'error'
      })
    }

    return this.getState()
  }

  async download(): Promise<UpdateState> {
    if (!this.updater || this.state.phase !== 'available') {
      return this.getState()
    }

    if (this.platform === 'darwin') {
      return this.downloadForMacOS()
    }

    try {
      await this.updater.downloadUpdate()
    } catch (error) {
      this.setState({
        errorMessage: error instanceof Error ? error.message : 'Failed to download the update.',
        phase: 'error'
      })
    }

    return this.getState()
  }

  async quitAndInstall(): Promise<void> {
    if (this.state.phase !== 'downloaded') {
      return
    }

    if (this.platform === 'darwin' && this.downloadedDmgPath) {
      await this.mountAndReveal()
      return
    }

    if (!this.updater) {
      return
    }

    this.updater.quitAndInstall()
  }

  private async downloadForMacOS(): Promise<UpdateState> {
    const version = this.state.availableUpdate?.version
    if (!version) {
      return this.getState()
    }

    this.setState({
      downloadProgressPercent: 0,
      errorMessage: null,
      phase: 'downloading'
    })

    try {
      const destPath = join(tmpdir(), `${this.productName}-Mac-${version}-${this.arch}.dmg`)
      const url = this.buildDmgUrl(version)
      await this.downloadFile(url, destPath)
      this.downloadedDmgPath = destPath
      this.setState({
        downloadProgressPercent: 100,
        phase: 'downloaded'
      })
    } catch (error) {
      this.downloadedDmgPath = null
      this.setState({
        errorMessage: error instanceof Error ? error.message : 'Failed to download the update.',
        phase: 'error'
      })
    }

    return this.getState()
  }

  private buildDmgUrl(version: string): string {
    return `https://github.com/${this.githubOwner}/${this.githubRepo}/releases/download/v${version}/${this.productName}-Mac-${version}-${this.arch}.dmg`
  }

  private downloadFile(url: string, destPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const follow = (targetUrl: string, redirectCount = 0): void => {
        if (redirectCount > 10) {
          reject(new Error('Too many redirects'))
          return
        }

        const get = targetUrl.startsWith('https') ? httpsGet : httpGet
        get(targetUrl, (res: IncomingMessage) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            const location = res.headers.location
            if (!location) {
              reject(new Error('Redirect without location header'))
              return
            }
            res.resume()
            follow(location, redirectCount + 1)
            return
          }

          if (res.statusCode !== 200) {
            res.resume()
            reject(new Error(`Download failed: HTTP ${res.statusCode}`))
            return
          }

          const total = parseInt(res.headers['content-length'] ?? '0', 10)
          let received = 0
          const file = createWriteStream(destPath)

          res.on('data', (chunk: Buffer) => {
            received += chunk.length
            if (total > 0) {
              this.setState({
                downloadProgressPercent: (received / total) * 100,
                phase: 'downloading'
              })
            }
          })

          res.pipe(file)
          file.on('finish', () => {
            file.close()
            resolve()
          })
          file.on('error', (err: Error) => {
            file.close()
            reject(err)
          })
        }).on('error', reject)
      }

      follow(url)
    })
  }

  private async mountAndReveal(): Promise<void> {
    if (!this.downloadedDmgPath) {
      return
    }

    try {
      const { existsSync } = require('node:fs')

      const version = this.state.availableUpdate?.version
      const expectedMountPoint = version
        ? `/Volumes/${this.productName} ${version}`
        : `/Volumes/${this.productName}`
      const fallbackMountPoint = `/Volumes/${this.productName}`

      let targetPath = expectedMountPoint
      if (!existsSync(expectedMountPoint) && existsSync(fallbackMountPoint)) {
        targetPath = fallbackMountPoint
      }

      if (!existsSync(targetPath)) {
        // Run hdiutil attach without -nobrowse so Finder opens it automatically
        await execAsync(`hdiutil attach "${this.downloadedDmgPath}"`)
      }

      // Use macOS 'open' command to reliably open the folder and bring Finder to foreground
      await execAsync(`open "${targetPath}"`)

      this.setState({ phase: 'mounted' })
    } catch (error) {
      this.setState({
        errorMessage: error instanceof Error ? error.message : 'Failed to mount the update.',
        phase: 'error'
      })
    }
  }

  private attachUpdaterEvents(updater: UpdaterAdapter) {
    updater.on('checking-for-update', () => {
      this.setState({
        availableUpdate: null,
        downloadProgressPercent: null,
        errorMessage: null,
        phase: 'checking'
      })
    })
    updater.on('update-available', (info) => {
      this.setState({
        availableUpdate: toVersionInfo(info),
        downloadProgressPercent: null,
        errorMessage: null,
        phase: 'available'
      })
    })
    updater.on('update-not-available', () => {
      this.setState({
        availableUpdate: null,
        downloadProgressPercent: null,
        errorMessage: null,
        phase: 'not-available'
      })
    })
    updater.on('download-progress', (progress) => {
      this.setState({
        downloadProgressPercent: Number.isFinite(progress.percent) ? progress.percent : null,
        errorMessage: null,
        phase: 'downloading'
      })
    })
    updater.on('update-downloaded', (info) => {
      this.setState({
        availableUpdate: toVersionInfo(info),
        downloadProgressPercent: 100,
        errorMessage: null,
        phase: 'downloaded'
      })
    })
    updater.on('error', (error) => {
      this.setState({
        downloadProgressPercent: null,
        errorMessage: error.message,
        phase: 'error'
      })
    })
  }

  private setState(input: Partial<UpdateState>) {
    this.state = {
      ...this.state,
      ...input
    }
    this.emitState()
  }

  private emitState() {
    this.emit('state-change', this.getState())
  }
}
