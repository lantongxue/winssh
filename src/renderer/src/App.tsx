import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ThemeDefinition } from '@shared/themes'
import type { ThemeMode } from '@shared/types'
import { useTranslation } from 'react-i18next'
import { Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { AppErrorBoundary } from '@/components/app-error-boundary'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { WorkbenchShell } from '@/components/workbench/workbench-shell'
import { HostTrustDialogHost } from '@/components/workbench/host-trust-dialog'
import { ReleaseNotesRenderer } from '@/components/workbench/release-notes-renderer'
import { TooltipProvider } from '@/components/ui/tooltip'
import { queryKeys } from '@/features/shared/query-keys'
import { settingsClient } from '@/features/settings/api/settings-client'
import { themesClient } from '@/features/themes/api/themes-client'
import { updatesClient } from '@/features/updates/api/updates-client'
import { usePrefersDark } from '@/hooks/use-prefers-dark'
import { useSessionEvents } from '@/hooks/use-session-events'
import i18n from '@/i18n'
import { resolveAppLanguage } from '@/i18n/format'
import { actionIcons } from '@/lib/action-icons'
import { rendererLogger } from '@/lib/logger'
import { applyThemeToRoot } from '@/lib/theme'
import { getUiFontStack, loadUiFontStack } from '@/lib/integrated-font-loader'
import { useUpdateDialogStore } from '@/store/update-dialog-store'

function applyTheme(theme: ThemeMode, themes: ThemeDefinition[], prefersDark: boolean) {
  applyThemeToRoot(document.documentElement, theme, themes, prefersDark)
}

function UpdateDialog() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const seenVersionsRef = useRef(new Set<string>())
  const dialogMode = useUpdateDialogStore((state) => state.mode)
  const closeDialog = useUpdateDialogStore((state) => state.close)
  const openAutoDialog = useUpdateDialogStore((state) => state.openAuto)
  const DownloadIcon = actionIcons.download
  const RestartIcon = actionIcons.restart

  const updatesQuery = useQuery({
    queryKey: queryKeys.updatesState,
    queryFn: () => updatesClient.getState()
  })

  useEffect(() => {
    return updatesClient.onStateChange((state) => {
      queryClient.setQueryData(queryKeys.updatesState, state)
    })
  }, [queryClient])

  const updateState = updatesQuery.data
  const availableVersion =
    updateState?.phase === 'available' ? updateState.availableUpdate?.version : null
  const releaseNotes =
    typeof updateState?.availableUpdate?.releaseNotes === 'string' &&
    updateState.availableUpdate.releaseNotes.trim()
      ? updateState.availableUpdate.releaseNotes
      : null

  useEffect(() => {
    if (!availableVersion) {
      if (dialogMode === 'auto' && updateState?.phase !== 'available') {
        closeDialog()
      }
      return
    }

    if (dialogMode !== 'manual' && !seenVersionsRef.current.has(availableVersion)) {
      openAutoDialog()
    }
  }, [availableVersion, closeDialog, dialogMode, openAutoDialog, updateState?.phase])

  const downloadUpdate = useMutation({
    mutationFn: () => updatesClient.download(),
    onSuccess: (state) => {
      queryClient.setQueryData(queryKeys.updatesState, state)
    }
  })
  const installUpdate = useMutation({
    mutationFn: () => updatesClient.quitAndInstall()
  })

  const handleClose = () => {
    if (availableVersion) {
      seenVersionsRef.current.add(availableVersion)
    }

    closeDialog()
  }

  const dialogTitle =
    updateState?.phase === 'checking'
      ? t('workbench.updateDialog.titles.checking')
      : updateState?.phase === 'not-available'
        ? t('workbench.updateDialog.titles.notAvailable')
        : updateState?.phase === 'downloading'
          ? t('workbench.updateDialog.titles.downloading')
          : updateState?.phase === 'downloaded'
            ? t('workbench.updateDialog.titles.downloaded')
            : updateState?.phase === 'error'
              ? t('workbench.updateDialog.titles.error')
              : updateState?.phase === 'unsupported'
                ? t('workbench.updateDialog.titles.unsupported')
                : t('workbench.updateDialog.title')

  const dialogDescription =
    updateState?.phase === 'checking'
      ? t('workbench.updateDialog.descriptions.checking')
      : updateState?.phase === 'not-available'
        ? t('workbench.updateDialog.descriptions.notAvailable')
        : updateState?.phase === 'available' && updateState.requiresManualInstall
          ? t('workbench.updateDialog.descriptions.manualDownload', {
              version: updateState.availableUpdate?.version ?? updateState.currentVersion
            })
          : updateState?.phase === 'available'
            ? t('workbench.updateDialog.description', {
                version: updateState.availableUpdate?.version ?? updateState.currentVersion
              })
            : updateState?.phase === 'downloading'
              ? t('workbench.updateDialog.descriptions.downloading', {
                  percent: Math.round(updateState.downloadProgressPercent ?? 0)
                })
              : updateState?.phase === 'downloaded'
                ? t('workbench.updateDialog.descriptions.downloaded')
                : updateState?.phase === 'error'
                  ? (updateState.errorMessage ?? t('workbench.updateDialog.descriptions.error'))
                  : updateState?.phase === 'unsupported'
                    ? t('workbench.updateDialog.descriptions.unsupported')
                    : t('workbench.updateDialog.descriptions.idle')

  const showDialog =
    dialogMode === 'manual'
      ? Boolean(updateState)
      : dialogMode === 'auto' &&
        updateState?.phase === 'available' &&
        Boolean(updateState.availableUpdate)

  if (!showDialog || !updateState) {
    return null
  }

  const canDownload = updateState.phase === 'available' && !updateState.requiresManualInstall
  const canInstall = updateState.phase === 'downloaded'
  const showManualDownload =
    updateState.phase === 'available' && updateState.requiresManualInstall
  const closeLabel =
    updateState.phase === 'available'
      ? t('workbench.updateDialog.actions.later')
      : t('common.actions.close')

  return (
    <Dialog open={showDialog} onOpenChange={(nextOpen) => !nextOpen && handleClose()}>
      <DialogContent className="max-w-md border-[var(--workbench-border)] bg-[var(--workbench-editor)]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        {releaseNotes ? (
          <ReleaseNotesRenderer
            content={releaseNotes}
            className="max-h-64 overflow-auto rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] px-3 py-3 text-sm text-muted-foreground"
          />
        ) : null}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose}>
            {closeLabel}
          </Button>
          {showManualDownload && updateState.releasesUrl ? (
            <Button
              type="button"
              onClick={() => window.open(updateState.releasesUrl!, '_blank', 'noopener,noreferrer')}
            >
              <DownloadIcon className="size-4" />
              {t('workbench.updateDialog.actions.goToDownload')}
            </Button>
          ) : null}
          {canDownload ? (
            <Button
              type="button"
              disabled={downloadUpdate.isPending}
              onClick={() => downloadUpdate.mutate()}
            >
              <DownloadIcon className="size-4" />
              {t('workbench.updateDialog.actions.download')}
            </Button>
          ) : null}
          {canInstall ? (
            <Button
              type="button"
              disabled={installUpdate.isPending}
              onClick={() => installUpdate.mutate()}
            >
              <RestartIcon className="size-4" />
              {t('workbench.updateDialog.actions.install')}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function App() {
  useSessionEvents()
  const prefersDark = usePrefersDark()
  const [bootstrappedLanguage, setBootstrappedLanguage] = useState<string | null>(null)

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      rendererLogger.error('Unhandled promise rejection', {
        reason:
          event.reason instanceof Error
            ? {
                message: event.reason.message,
                name: event.reason.name,
                stack: event.reason.stack
              }
            : event.reason
      })
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', handleUnhandledRejection)
  }, [])

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsClient.get()
  })
  const themesQuery = useQuery({
    queryKey: queryKeys.themes,
    queryFn: () => themesClient.list()
  })
  const resolvedLanguage = settingsQuery.data
    ? resolveAppLanguage(settingsQuery.data.language)
    : null

  useEffect(() => {
    if (!settingsQuery.data?.theme || !themesQuery.data) {
      return
    }

    applyTheme(settingsQuery.data.theme, themesQuery.data, prefersDark)
  }, [prefersDark, settingsQuery.data?.theme, themesQuery.data])

  useEffect(() => {
    if (!settingsQuery.data?.uiFontId) {
      return
    }

    const fontId = settingsQuery.data.uiFontId
    document.documentElement.style.setProperty('--app-font-family', getUiFontStack(fontId))
    void loadUiFontStack(fontId).then((fontStack) => {
      document.documentElement.style.setProperty('--app-font-family', fontStack)
    })
  }, [settingsQuery.data?.uiFontId])

  useEffect(() => {
    if (!settingsQuery.data) {
      return
    }

    let cancelled = false
    const nextLanguage = resolveAppLanguage(settingsQuery.data.language)

    void i18n.changeLanguage(nextLanguage).then(() => {
      if (!cancelled) {
        setBootstrappedLanguage(nextLanguage)
      }
    })

    return () => {
      cancelled = true
    }
  }, [settingsQuery.data])

  if (!settingsQuery.data || !themesQuery.data || resolvedLanguage !== bootstrappedLanguage) {
    return <div className="h-full bg-[var(--workbench-bg)]" />
  }

  return (
    <AppErrorBoundary>
      <TooltipProvider>
        <WorkbenchShell />
      </TooltipProvider>
      <UpdateDialog />
      <HostTrustDialogHost />
      <Toaster position="bottom-right" closeButton offset={16} />
    </AppErrorBoundary>
  )
}
