import { useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { type SessionResourceSnapshot } from '@shared/types'
import { sessionsClient } from '@/features/sessions/api/sessions-client'
import { queryKeys } from '@/features/shared/query-keys'
import { formatFileSize, getResolvedLocale } from '@/i18n/format'
import { cn } from '@/lib/utils'
import type { SessionTab } from '@/store/sessions-store'
import { Skeleton } from '@/components/ui/skeleton'

const RESOURCE_MONITOR_DEFAULT_REFETCH_INTERVAL_MS = 2_000

interface SessionResourceMonitorProps {
  session: SessionTab
  expanded: boolean
  active?: boolean
  className?: string
  refetchIntervalMs?: number
}

interface MetricPillProps {
  label: string
  value: string
  detail?: string
  className?: string
}

function MetricPillShell({ className, children, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex h-8 shrink-0 items-center rounded-md border border-[var(--workbench-border)] bg-[color-mix(in_srgb,var(--workbench-sidebar)_78%,transparent)] px-2.5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
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

function formatLatency(rttMs: number | null): string {
  if (rttMs === null || !Number.isFinite(rttMs)) {
    return '--'
  }

  if (rttMs < 1) {
    return '<1 ms'
  }

  if (rttMs < 1000) {
    return `${Math.round(rttMs)} ms`
  }

  return `${(rttMs / 1000).toFixed(1)} s`
}

function MetricPill({ label, value, detail, className }: MetricPillProps) {
  return (
    <MetricPillShell className={className}>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <div className="shrink-0 text-[10px] leading-none font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </div>
        <div className="shrink-0 text-xs leading-none font-semibold text-foreground">{value}</div>
        {detail ? (
          <div className="truncate text-[11px] leading-none text-muted-foreground">{detail}</div>
        ) : null}
      </div>
    </MetricPillShell>
  )
}

function MetricPillSkeleton({
  className,
  detail = false
}: {
  className?: string
  detail?: boolean
}) {
  return (
    <MetricPillShell
      className={className}
      data-testid="session-resource-monitor-skeleton-pill"
    >
      <div className="flex min-w-0 items-baseline gap-1.5">
        <Skeleton className="h-2.5 w-8 shrink-0 rounded-sm" />
        <Skeleton className="h-3 w-6 shrink-0 rounded-sm" />
        {detail ? <Skeleton className="h-2.5 w-24 shrink-0 rounded-sm" /> : null}
      </div>
    </MetricPillShell>
  )
}

function ResourceMetrics({ snapshot }: { snapshot: SessionResourceSnapshot }) {
  const { t } = useTranslation()

  return (
    <div className="inline-flex min-w-max items-center gap-1.5">
      <MetricPill
        className="min-w-[72px]"
        label={t('workbench.sessionEditor.resourceMonitor.metrics.latency')}
        value={formatLatency(snapshot.latency.rttMs)}
      />
      {snapshot.cpu !== null ? (
        <MetricPill
          className="min-w-[92px]"
          label={t('workbench.sessionEditor.resourceMonitor.metrics.cpu')}
          value={formatPercent(snapshot.cpu.usagePercent)}
        />
      ) : null}
      {snapshot.memory !== null ? (
        <MetricPill
          className="min-w-[188px]"
          detail={`${formatFileSize(snapshot.memory.usedBytes)} / ${formatFileSize(snapshot.memory.totalBytes)}`}
          label={t('workbench.sessionEditor.resourceMonitor.metrics.memory')}
          value={formatPercent(snapshot.memory.usagePercent)}
        />
      ) : null}
      {snapshot.network !== null ? (
        <MetricPill
          className="min-w-[188px]"
          label={t('workbench.sessionEditor.resourceMonitor.metrics.network')}
          value={`\u2193 ${formatTransferRate(snapshot.network.rxBytesPerSecond)} \u2191 ${formatTransferRate(snapshot.network.txBytesPerSecond)}`}
        />
      ) : null}
      {snapshot.disk !== null ? (
        <MetricPill
          className="min-w-[188px]"
          detail={`${formatFileSize(snapshot.disk.usedBytes)} / ${formatFileSize(snapshot.disk.totalBytes)}`}
          label={t('workbench.sessionEditor.resourceMonitor.metrics.disk')}
          value={formatPercent(snapshot.disk.usagePercent, 0)}
        />
      ) : null}
    </div>
  )
}

function LatencyOnlyMetrics({ snapshot }: { snapshot: SessionResourceSnapshot }) {
  const { t } = useTranslation()
  return (
    <div className="inline-flex min-w-max items-center gap-1.5">
      <MetricPill
        className="min-w-[72px]"
        label={t('workbench.sessionEditor.resourceMonitor.metrics.latency')}
        value={formatLatency(snapshot.latency.rttMs)}
      />
      <div className="truncate rounded-md border border-dashed border-[var(--workbench-border)] px-2.5 py-1.5 text-xs text-muted-foreground">
        {t('workbench.sessionEditor.resourceMonitor.linuxOnly')}
      </div>
    </div>
  )
}

export function SessionResourceMonitor({
  session,
  expanded,
  active = true,
  className,
  refetchIntervalMs = RESOURCE_MONITOR_DEFAULT_REFETCH_INTERVAL_MS
}: SessionResourceMonitorProps) {
  const { t } = useTranslation()
  const monitorReady = !session.provisional && session.status === 'ready'
  const monitorQuery = useQuery({
    enabled: monitorReady && active,
    queryFn: () => sessionsClient.getResourceSnapshot(session.sessionId),
    queryKey: queryKeys.resourceSnapshot(session.sessionId),
    refetchInterval: monitorReady && active ? refetchIntervalMs : false,
    retry: false
  })

  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current
    if (!container) return

    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return

    container.scrollLeft += event.deltaY
    event.preventDefault()
  }, [])

  const errorMessage =
    monitorQuery.error instanceof Error
      ? t('workbench.sessionEditor.resourceMonitor.unavailable')
      : undefined

  return (
    <div
      className={cn('flex min-w-0 flex-1 items-center justify-end', className)}
      data-state={expanded ? 'expanded' : 'collapsed'}
      data-testid="session-resource-monitor"
    >
      <div
        className="flex w-full min-w-0 max-w-[920px] items-center gap-2 overflow-hidden"
        data-testid="session-resource-monitor-content"
      >
        {expanded ? (
          <div
            ref={scrollContainerRef}
            onWheel={handleWheel}
            className="no-scrollbar min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
          >
            <div
              className="inline-flex min-w-full justify-end"
              data-testid="session-resource-monitor-viewport"
            >
              {!monitorReady ? (
                <div className="truncate rounded-md border border-dashed border-[var(--workbench-border)] px-2.5 py-1.5 text-xs text-muted-foreground">
                  {t('workbench.sessionEditor.resourceMonitor.unavailable')}
                </div>
              ) : monitorQuery.data ? (
                monitorQuery.data.cpu !== null ? (
                  <ResourceMetrics snapshot={monitorQuery.data} />
                ) : (
                  <LatencyOnlyMetrics snapshot={monitorQuery.data} />
                )
              ) : monitorQuery.isPending || !active ? (
                <div className="inline-flex min-w-max items-center gap-1.5">
                  <MetricPillSkeleton className="min-w-[72px]" />
                  <MetricPillSkeleton className="min-w-[92px]" />
                  <MetricPillSkeleton className="min-w-[188px]" detail />
                  <MetricPillSkeleton className="min-w-[188px]" />
                  <MetricPillSkeleton className="min-w-[188px]" detail />
                </div>
              ) : (
                <div className="truncate rounded-md border border-dashed border-[var(--workbench-border)] px-2.5 py-1.5 text-xs text-muted-foreground">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
