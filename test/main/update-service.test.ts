import { EventEmitter } from 'node:events'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { UpdateService, type UpdaterAdapter } from '@main/update-service'

class FakeUpdater extends EventEmitter implements UpdaterAdapter {
  autoDownload = true
  forceDevUpdateConfig = false
  checkForUpdates = vi.fn(async () => undefined)
  downloadUpdate = vi.fn(async () => undefined)
  quitAndInstall = vi.fn(() => undefined)
}

function createService(overrides: Partial<ConstructorParameters<typeof UpdateService>[0]> = {}) {
  const updater = new FakeUpdater()
  const service = new UpdateService({
    autoCheckEnabled: true,
    currentVersion: '1.0.0',
    feedUrl: 'https://updates.example.com/winssh',
    githubOwner: 'lantongxue',
    githubRepo: 'winssh',
    isPackaged: true,
    platform: 'win32',
    updaterFactory: () => updater,
    ...overrides
  })

  return { service, updater }
}

describe('UpdateService', () => {
  it('marks non-Windows builds as unsupported', () => {
    const { service } = createService({
      platform: 'linux'
    })

    expect(service.getState()).toMatchObject({
      phase: 'unsupported',
      supported: false,
      unsupportedReason: 'platform_not_supported'
    })
  })

  it('marks unpackaged Windows builds as unsupported', () => {
    const { service } = createService({
      isPackaged: false
    })

    expect(service.getState()).toMatchObject({
      phase: 'unsupported',
      supported: false,
      unsupportedReason: 'app_not_packaged'
    })
  })

  it('allows dev updates when explicitly enabled and prepares the dev config file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'winssh-dev-updates-'))
    const devConfigPath = join(directory, 'dev-app-update.yml')

    try {
      const { service, updater } = createService({
        allowDevUpdates: true,
        devConfigPath,
        isPackaged: false
      })

      expect(service.getState()).toMatchObject({
        phase: 'idle',
        supported: true,
        unsupportedReason: null
      })
      expect(updater.forceDevUpdateConfig).toBe(true)
      expect(existsSync(devConfigPath)).toBe(true)
      expect(readFileSync(devConfigPath, 'utf8')).toContain('provider: generic')
      expect(readFileSync(devConfigPath, 'utf8')).toContain(
        'url: https://updates.example.com/winssh'
      )
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  it('marks Windows builds without an update feed as unsupported', () => {
    const { service: servicePackaged } = createService({
      githubOwner: ''
    })

    expect(servicePackaged.getState()).toMatchObject({
      phase: 'unsupported',
      supported: false,
      unsupportedReason: 'feed_url_missing'
    })

    const { service: serviceUnpackaged } = createService({
      feedUrl: null,
      isPackaged: false,
      allowDevUpdates: true
    })

    expect(serviceUnpackaged.getState()).toMatchObject({
      phase: 'unsupported',
      supported: false,
      unsupportedReason: 'feed_url_missing'
    })
  })

  it('initializes a Windows updater with autoDownload disabled', () => {
    const { service, updater } = createService()

    expect(service.getState()).toMatchObject({
      phase: 'idle',
      supported: true,
      unsupportedReason: null
    })
    expect(updater.autoDownload).toBe(false)
  })

  it('maps updater events into structured update state', () => {
    const { service, updater } = createService()

    updater.emit('checking-for-update')
    expect(service.getState().phase).toBe('checking')

    updater.emit('update-available', {
      releaseDate: '2026-04-08T00:00:00.000Z',
      releaseName: '0.2.0',
      releaseNotes: 'Fixes and polish',
      version: '0.2.0'
    })
    expect(service.getState()).toMatchObject({
      availableUpdate: {
        releaseNotes: 'Fixes and polish',
        version: '0.2.0'
      },
      phase: 'available'
    })
    expect(updater.downloadUpdate).not.toHaveBeenCalled()

    updater.emit('download-progress', { percent: 42.4 })
    expect(service.getState()).toMatchObject({
      downloadProgressPercent: 42.4,
      phase: 'downloading'
    })

    updater.emit('update-downloaded', {
      releaseDate: '2026-04-08T00:00:00.000Z',
      releaseName: '0.2.0',
      releaseNotes: ['ignored'],
      version: '0.2.0'
    })
    expect(service.getState()).toMatchObject({
      availableUpdate: {
        releaseNotes: null,
        version: '0.2.0'
      },
      downloadProgressPercent: 100,
      phase: 'downloaded'
    })

    updater.emit('error', new Error('network unavailable'))
    expect(service.getState()).toMatchObject({
      errorMessage: 'network unavailable',
      phase: 'error'
    })
  })

  it('checks and downloads only when explicitly requested', async () => {
    const { service, updater } = createService()

    await service.check()
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1)
    expect(updater.downloadUpdate).not.toHaveBeenCalled()

    updater.emit('update-available', {
      releaseDate: null,
      releaseName: '0.2.0',
      releaseNotes: 'Ready',
      version: '0.2.0'
    })

    await service.download()
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1)
  })

  it('updates the auto-check flag in the exposed state', () => {
    const { service } = createService()

    service.setAutoCheckEnabled(false)

    expect(service.getState().autoCheckEnabled).toBe(false)
  })
})
