import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  SESSION_RESOURCE_MONITOR_LINUX_ONLY,
  type SessionResourceSnapshot
} from '@shared/types'
import { formatFileSize, getResolvedLocale } from '@/i18n/format'
import { cn } from '@/lib/utils'
import type { SessionTab } from '@/store/sessions-store'
import { Skeleton } from '@/components/ui/skeleton'

const RESOURCE_MONITOR_REFETCH_INTERVAL_MS = 2_000

interface SessionResourceMonitorProps {
  session: SessionTab
  expanded: boolean
  active?: boolean
  className?: string
}

interface MetricPillProps {
  label: string
  value: string
  detail?: string
  className?: string
}

function formatPercent(value: number | null, maximumFractionDigits = 1): string {
  if (value === null || !Number.isFinite(value)) {
    return '--'
  }

  return `${new Intl.NumberFormat(getResolvedLocale(), {
    maximumFractionDigits,
    minimumFractionDigits: value % 1 === 0 ? 0 : 1
  }).format(value)}%`
}

function formatTransferRate(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '--'
  }

  return `${formatFileSize(value)}/s`
}

function MetricPill({ label, value, detail, className }: MetricPillProps) {
  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--workbench-border)] bg-[color-mix(in_srgb,var(--workbench-sidebar)_78%,transparent)] px-2.5 py-1.5',
        className
      )}
    >
      <div className="shrink-0 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </div>
      <div className="shrink-0 text-xs font-semibold text-foreground">{value}</div>
      {detail ? <div className="truncate text-[11px] text-muted-foreground">{detail}</div> : null}
    </div>
  )
}

function ResourceMetrics({ snapshot }: { snapshot: SessionResourceSnapshot }) {
  const { t } = useTranslation()

  return (
    <div className="inline-flex min-w-max items-center gap-1.5">
      <MetricPill
        className="min-w-[92px]"
        label={t('workbench.sessionEditor.resourceMonitor.metrics.cpu')}
        value={formatPercent(snapshot.cpu.usagePercent)}
      />
      <MetricPill
        className="min-w-[188px]"
        detail={`${formatFileSize(snapshot.memory.usedBytes)} / ${formatFileSize(snapshot.memory.totalBytes)}`}
        label={t('workbench.sessionEditor.resourceMonitor.metrics.memory')}
        value={formatPercent(snapshot.memory.usagePercent)}
      />
      <MetricPill
        className="min-w-[188px]"
        label={t('workbench.sessionEditor.resourceMonitor.metrics.network')}
        value={`\u2193 ${formatTransferRate(snapshot.network.rxBytesPerSecond)} \u2191 ${formatTransferRate(snapshot.network.txBytesPerSecond)}`}
      />
      <MetricPill
        className="min-w-[188px]"
        detail={`${formatFileSize(snapshot.disk.usedBytes)} / ${formatFileSize(snapshot.disk.totalBytes)}`}
        label={t('workbench.sessionEditor.resourceMonitor.metrics.disk')}
        value={formatPercent(snapshot.disk.usagePercent, 0)}
      />
    </div>
  )
}

export function SessionResourceMonitor({
  session,
  expanded,
  active = true,
  className
}: SessionResourceMonitorProps) {
  const { t } = useTranslation()
  const monitorReady = !session.provisional && session.status === 'ready'
  const monitorQuery = useQuery({
    enabled: monitorReady && active,
    queryFn: () => window.winsshApi.sessions.getResourceSnapshot(session.sessionId),
    queryKey: ['session-resource-snapshot', session.sessionId],
    refetchInterval: monitorReady && active ? RESOURCE_MONITOR_REFETCH_INTERVAL_MS : false,
    retry: false
  })

  const errorMessage =
    monitorQuery.error instanceof Error ? monitorQuery.error.message : undefined
  const inlineMessage =
    errorMessage === SESSION_RESOURCE_MONITOR_LINUX_ONLY
      ? t('workbench.sessionEditor.resourceMonitor.linuxOnly')
      : t('workbench.sessionEditor.resourceMonitor.unavailable')

  return (
    <div
      className={cn('flex min-w-0 flex-1 items-center justify-center', className)}
      data-state={expanded ? 'expanded' : 'collapsed'}
      data-testid="session-resource-monitor"
    >
      <div className="flex min-w-0 max-w-[920px] flex-1 items-center gap-2 overflow-hidden">
        {expanded ? (
          <div className="no-scrollbar min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
            {!monitorReady ? (
              <div className="truncate rounded-md border border-dashed border-[var(--workbench-border)] px-2.5 py-1.5 text-xs text-muted-foreground">
                {t('workbench.sessionEditor.resourceMonitor.unavailable')}
              </div>
            ) : monitorQuery.data ? (
              <ResourceMetrics snapshot={monitorQuery.data} />
            ) : monitorQuery.isPending || !active ? (
              <div className="inline-flex min-w-max items-center gap-1.5">
                <Skeleton className="h-8 w-[92px] rounded-md" />
                <Skeleton className="h-8 w-[188px] rounded-md" />
                <Skeleton className="h-8 w-[188px] rounded-md" />
                <Skeleton className="h-8 w-[188px] rounded-md" />
              </div>
            ) : (
              <div className="truncate rounded-md border border-dashed border-[var(--workbench-border)] px-2.5 py-1.5 text-xs text-muted-foreground">
                {inlineMessage}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
