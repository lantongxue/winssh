import { EventEmitter } from 'node:events'

import type { UpdateState, UpdateUnsupportedReason, UpdateVersionInfo } from '@shared/types'

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
  autoCheckEnabled: boolean
  currentVersion: string
  githubOwner: string
  githubRepo: string
  isPackaged: boolean
  platform: string
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

  constructor(options: UpdateServiceOptions) {
    super()

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
      unsupportedReason
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

  quitAndInstall(): void {
    if (!this.updater || this.state.phase !== 'downloaded') {
      return
    }

    this.updater.quitAndInstall()
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
