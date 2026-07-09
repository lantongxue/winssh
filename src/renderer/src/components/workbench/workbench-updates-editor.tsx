import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { APP_NAME } from '@shared/constants'
import type { AppInfo, ReleaseChannel, UpdateState } from '@shared/types'
import { RefreshCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { queryKeys } from '@/features/shared/query-keys'
import { settingsClient } from '@/features/settings/api/settings-client'
import { useSettingsAutoSave } from '@/features/settings/use-settings-auto-save'
import { systemClient } from '@/features/system/api/system-client'
import { updatesClient } from '@/features/updates/api/updates-client'
import { formatDateTime } from '@/i18n/format'
import { actionIcons } from '@/lib/action-icons'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ReleaseNotesRenderer } from '@/components/workbench/release-notes-renderer'

function formatPlatformLabel(platform: string) {
  switch (platform) {
    case 'win32':
      return 'Windows'
    case 'darwin':
      return 'macOS'
    case 'linux':
      return 'Linux'
    default:
      return platform
  }
}

function getReleaseChannelLabel(
  releaseChannel: ReleaseChannel,
  t: ReturnType<typeof useTranslation>['t']
) {
  return t(`workbench.settings.about.channels.${releaseChannel}`)
}

function getUpdateStatusMessage(
  updateState: UpdateState | undefined,
  appInfo: AppInfo | undefined,
  t: ReturnType<typeof useTranslation>['t']
) {
  if (!updateState) {
    return t('workbench.settings.updates.status.idle')
  }

  switch (updateState.phase) {
    case 'unsupported':
      if (updateState.unsupportedReason === 'feed_url_missing') {
        return t('workbench.settings.updates.status.feedMissing')
      }

      if (updateState.unsupportedReason === 'app_not_packaged') {
        return t('workbench.settings.updates.status.buildUnsupported')
      }

      return t('workbench.settings.updates.status.platformUnsupported', {
        platform: formatPlatformLabel(appInfo?.platform ?? 'unknown')
      })
    case 'checking':
      return t('workbench.settings.updates.status.checking')
    case 'available':
      if (updateState.requiresManualInstall) {
        return t('workbench.settings.updates.status.manualDownload', {
          version: updateState.availableUpdate?.version ?? updateState.currentVersion
        })
      }
      return t('workbench.settings.updates.status.available', {
        version: updateState.availableUpdate?.version ?? updateState.currentVersion
      })
    case 'not-available':
      return t('workbench.settings.updates.status.notAvailable')
    case 'downloading':
      return t('workbench.settings.updates.status.downloading', {
        percent: Math.round(updateState.downloadProgressPercent ?? 0)
      })
    case 'downloaded':
      return t('workbench.settings.updates.status.downloaded')
    case 'error':
      return updateState.errorMessage || t('workbench.settings.updates.status.error')
    case 'idle':
    default:
      return t('workbench.settings.updates.status.idle')
  }
}

export function WorkbenchUpdatesEditor() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true)
  const DownloadIcon = actionIcons.download
  const RefreshIcon = actionIcons.refresh
  const RestartIcon = actionIcons.restart

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsClient.get()
  })
  const appInfoQuery = useQuery({
    queryKey: queryKeys.appInfo,
    queryFn: () => systemClient.getAppInfo()
  })
  const updatesQuery = useQuery({
    queryKey: queryKeys.updatesState,
    queryFn: () => updatesClient.getState()
  })
  const { saveField } = useSettingsAutoSave(settingsQuery.data)

  useEffect(() => {
    if (typeof settingsQuery.data?.autoUpdateCheckEnabled === 'boolean') {
      setAutoCheckEnabled(settingsQuery.data.autoUpdateCheckEnabled)
    }
  }, [settingsQuery.data?.autoUpdateCheckEnabled])

  useEffect(() => {
    return updatesClient.onStateChange((state) => {
      queryClient.setQueryData(queryKeys.updatesState, state)
    })
  }, [queryClient])

  const checkForUpdates = useMutation({
    mutationFn: async () => {
      const [state] = await Promise.all([
        updatesClient.check(),
        new Promise<void>((resolve) => setTimeout(resolve, 800))
      ])
      return state
    },
    onMutate: () => {
      const currentState = queryClient.getQueryData<UpdateState>(queryKeys.updatesState)

      if (currentState) {
        queryClient.setQueryData<UpdateState>(queryKeys.updatesState, {
          ...currentState,
          errorMessage: null,
          phase: 'checking'
        })
        return
      }

      if (!appInfoQuery.data) {
        return
      }

      queryClient.setQueryData<UpdateState>(queryKeys.updatesState, {
        autoCheckEnabled,
        availableUpdate: null,
        currentVersion: appInfoQuery.data.version,
        downloadProgressPercent: null,
        errorMessage: null,
        phase: 'checking',
        supported: true,
        unsupportedReason: null,
        requiresManualInstall: appInfoQuery.data.platform !== 'win32',
        releasesUrl: null
      })
    },
    onSuccess: (state) => {
      queryClient.setQueryData(queryKeys.updatesState, state)

      if (state.phase === 'not-available') {
        toast.success(t('workbench.settings.updates.status.notAvailable'))
      }
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('workbench.settings.updates.toasts.checkFailed')
      )
    }
  })

  const downloadUpdate = useMutation({
    mutationFn: () => updatesClient.download(),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKeys.updatesState, state)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('workbench.settings.updates.toasts.downloadFailed')
      )
    }
  })

  const quitAndInstallUpdate = useMutation({
    mutationFn: () => updatesClient.quitAndInstall(),
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('workbench.settings.updates.toasts.installFailed')
      )
    }
  })

  const updateState = updatesQuery.data
  const updateStatusMessage = getUpdateStatusMessage(updateState, appInfoQuery.data, t)
  const updateActionPending =
    checkForUpdates.isPending || downloadUpdate.isPending || quitAndInstallUpdate.isPending
  const showDownloadAction =
    updateState?.phase === 'available' && !updateState?.requiresManualInstall
  const showInstallAction = updateState?.phase === 'downloaded'
  const showManualDownloadAction =
    updateState?.phase === 'available' && updateState?.requiresManualInstall
  const availableReleaseDate = updateState?.availableUpdate?.releaseDate
    ? formatDateTime(updateState.availableUpdate.releaseDate)
    : null
  const releaseNotes =
    typeof updateState?.availableUpdate?.releaseNotes === 'string' &&
    updateState.availableUpdate.releaseNotes.trim()
      ? updateState.availableUpdate.releaseNotes
      : null

  const syncUpdateStateAutoCheck = (enabled: boolean) => {
    queryClient.setQueryData<UpdateState | undefined>(queryKeys.updatesState, (current) =>
      current
        ? {
            ...current,
            autoCheckEnabled: enabled
          }
        : current
    )
  }

  const handleAutoCheckChange = (enabled: boolean) => {
    setAutoCheckEnabled(enabled)

    void saveField('autoUpdateCheckEnabled', enabled, {
      onRevert: (rollbackValue) => {
        setAutoCheckEnabled(rollbackValue)
        syncUpdateStateAutoCheck(rollbackValue)
      },
      onSuccess: (settings) => {
        setAutoCheckEnabled(settings.autoUpdateCheckEnabled)
        syncUpdateStateAutoCheck(settings.autoUpdateCheckEnabled)
      }
    })
  }

  return (
    <div className="flex h-full min-h-0 bg-[var(--workbench-editor)]">
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-6 mt-6 border border-[var(--workbench-border)] px-6 py-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {t('workbench.documents.updates')}
          </div>
          <div className="mt-1 text-xl font-semibold">{t('workbench.settings.updates.title')}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('workbench.settings.updates.description')}
          </p>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section className="space-y-4 border border-[var(--workbench-border)] p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <RefreshCcw className="size-4 text-primary" />
              {t('workbench.settings.about.version.title')}
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-sm border border-[var(--workbench-border)] px-3 py-3">
                <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t('workbench.settings.about.version.nameLabel')}
                </div>
                <div className="mt-1 font-medium">{appInfoQuery.data?.name ?? APP_NAME}</div>
              </div>
              <div className="rounded-sm border border-[var(--workbench-border)] px-3 py-3">
                <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t('workbench.settings.about.version.versionLabel')}
                </div>
                <div className="mt-1 font-medium">{appInfoQuery.data?.version ?? '0.0.0'}</div>
              </div>
              <div className="rounded-sm border border-[var(--workbench-border)] px-3 py-3">
                <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t('workbench.settings.about.version.platformLabel')}
                </div>
                <div className="mt-1 font-medium">
                  {formatPlatformLabel(appInfoQuery.data?.platform ?? 'unknown')}
                </div>
              </div>
              <div className="rounded-sm border border-[var(--workbench-border)] px-3 py-3">
                <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t('workbench.settings.about.version.channelLabel')}
                </div>
                <div className="mt-1 font-medium">
                  {getReleaseChannelLabel(appInfoQuery.data?.releaseChannel ?? 'latest', t)}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-4 border border-[var(--workbench-border)] p-5">
            <div className="flex items-center justify-between rounded-sm border border-[var(--workbench-border)] px-4 py-3">
              <div>
                <div className="font-medium">{t('workbench.settings.updates.autoCheck.title')}</div>
                <div className="text-sm text-muted-foreground">
                  {t('workbench.settings.updates.autoCheck.description')}
                </div>
              </div>
              <Switch
                aria-label={t('workbench.settings.updates.autoCheck.title')}
                checked={autoCheckEnabled}
                onCheckedChange={handleAutoCheckChange}
              />
            </div>
          </section>

          <section className="space-y-4 border border-[var(--workbench-border)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">
                  {t('workbench.settings.updates.statusLabel')}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">{updateStatusMessage}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={updateActionPending || updateState?.phase === 'checking'}
                  onClick={() => checkForUpdates.mutate()}
                >
                  <RefreshIcon
                    className={`size-4${
                      checkForUpdates.isPending || updateState?.phase === 'checking'
                        ? ' animate-spin'
                        : ''
                    }`}
                  />
                  {t('workbench.settings.updates.actions.check')}
                </Button>
                {showManualDownloadAction && updateState?.releasesUrl ? (
                  <Button
                    type="button"
                    disabled={updateActionPending}
                    onClick={() =>
                      window.open(
                        updateState.releasesUrl!,
                        '_blank',
                        'noopener,noreferrer'
                      )
                    }
                  >
                    <DownloadIcon className="size-4" />
                    {t('workbench.settings.updates.actions.goToDownload')}
                  </Button>
                ) : null}
                {showDownloadAction ? (
                  <Button
                    type="button"
                    disabled={updateActionPending}
                    onClick={() => downloadUpdate.mutate()}
                  >
                    <DownloadIcon className="size-4" />
                    {t('workbench.settings.updates.actions.download')}
                  </Button>
                ) : null}
                {showInstallAction ? (
                  <Button
                    type="button"
                    disabled={updateActionPending}
                    onClick={() => quitAndInstallUpdate.mutate()}
                  >
                    <RestartIcon className="size-4" />
                    {t('workbench.settings.updates.actions.install')}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-sm border border-[var(--workbench-border)] px-4 py-4">
              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    {t('workbench.settings.about.version.versionLabel')}
                  </div>
                  <div className="mt-1 font-medium">
                    {updateState?.availableUpdate?.version ??
                      updateState?.currentVersion ??
                      '0.0.0'}
                  </div>
                </div>
                {availableReleaseDate ? (
                  <div>
                    <div className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                      {t('workbench.updatesEditor.releaseDate')}
                    </div>
                    <div className="mt-1 font-medium">{availableReleaseDate}</div>
                  </div>
                ) : null}
              </div>

              {releaseNotes &&
              (updateState?.phase === 'available' || updateState?.phase === 'downloaded') ? (
                <ReleaseNotesRenderer
                  content={releaseNotes}
                  className="mt-4 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] px-3 py-3 text-sm text-muted-foreground"
                />
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
