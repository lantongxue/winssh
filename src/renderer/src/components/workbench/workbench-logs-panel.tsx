import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { logsClient } from '@/features/logs/api/logs-client'
import { queryKeys } from '@/features/shared/query-keys'
import { formatTime } from '@/i18n/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function WorkbenchLogsPanel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draftPath, setDraftPath] = useState('')

  const stateQuery = useQuery({
    queryKey: queryKeys.logsState,
    queryFn: () => logsClient.getState()
  })
  const entriesQuery = useQuery({
    queryKey: queryKeys.logEntries,
    queryFn: () => logsClient.list()
  })

  useEffect(() => {
    if (stateQuery.data?.logFilePath) {
      setDraftPath(stateQuery.data.logFilePath)
    }
  }, [stateQuery.data?.logFilePath])

  const refreshLogs = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.logsState }),
      queryClient.invalidateQueries({ queryKey: queryKeys.logEntries })
    ])
  }

  const clearMutation = useMutation({
    mutationFn: () => logsClient.clear(),
    onSuccess: async () => {
      await refreshLogs()
      toast.success(t('workbench.panel.logs.toasts.cleared'))
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('workbench.panel.logs.toasts.clearFailed')
      )
    }
  })

  const updatePathMutation = useMutation({
    mutationFn: (logFilePath: string) => logsClient.updatePath(logFilePath),
    onSuccess: async (state) => {
      setDraftPath(state.logFilePath)
      await refreshLogs()
      toast.success(t('workbench.panel.logs.toasts.pathUpdated'))
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('workbench.panel.logs.toasts.pathUpdateFailed')
      )
    }
  })

  const isBusy = clearMutation.isPending || updatePathMutation.isPending

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[var(--workbench-border)] px-4 py-3">
        <div className="text-sm font-medium text-foreground">{t('workbench.panel.logs.title')}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {t('workbench.panel.logs.description')}
        </div>
        <div className="mt-3 flex flex-col gap-2 xl:flex-row xl:items-center">
          <Input
            value={draftPath}
            onChange={(event) => setDraftPath(event.target.value)}
            placeholder={t('workbench.panel.logs.pathPlaceholder')}
            className="font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={
                isBusy ||
                !draftPath.trim() ||
                draftPath.trim() === (stateQuery.data?.logFilePath ?? '').trim()
              }
              onClick={() => updatePathMutation.mutate(draftPath.trim())}
            >
              {t('workbench.panel.logs.actions.savePath')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => void refreshLogs()}
            >
              {t('common.actions.refresh')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isBusy}
              onClick={() => clearMutation.mutate()}
            >
              {t('workbench.panel.logs.actions.clear')}
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {entriesQuery.data?.length ? (
          <div className="space-y-px bg-[var(--workbench-border)]">
            {entriesQuery.data.map((entry) => (
              <div key={entry.id} className="bg-[var(--workbench-panel)] px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="font-medium text-foreground">{entry.message}</div>
                  <div className="flex items-center gap-2 text-[11px] uppercase text-muted-foreground">
                    {entry.level ? <span>{entry.level}</span> : null}
                    {entry.source ? <span>{entry.source}</span> : null}
                    {entry.timestamp ? <span>{formatTime(entry.timestamp)}</span> : null}
                  </div>
                </div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-sm bg-[var(--workbench-hover)] px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  {entry.raw}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-sm text-muted-foreground">
            {t('workbench.panel.empty.logs')}
          </div>
        )}
      </div>
    </div>
  )
}
