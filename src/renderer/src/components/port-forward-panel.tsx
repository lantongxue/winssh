import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { portForwardSchema, type PortForwardFormValues } from '@shared/validation'
import { portForwardsClient } from '@/features/port-forwards/api/port-forwards-client'
import { queryKeys } from '@/features/shared/query-keys'
import { actionIcons } from '@/lib/action-icons'
import type { SessionTab } from '@/store/sessions-store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

interface PortForwardPanelProps {
  session: SessionTab | null
  className?: string
  onHeaderDragStart?: (event: React.DragEvent<HTMLDivElement>) => void
  onHeaderDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void
}

const DEFAULT_VALUES: PortForwardFormValues = {
  kind: 'local',
  bindHost: '127.0.0.1',
  bindPort: 3000,
  targetHost: '127.0.0.1',
  targetPort: 80
}

function isPublicBindHost(host: string) {
  return host.trim() === '0.0.0.0' || host.trim() === '::'
}



export function PortForwardPanel({
  session,
  className,
  onHeaderDragStart,
  onHeaderDragEnd
}: PortForwardPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const NewRuleIcon = actionIcons.newConnection
  const StartIcon = actionIcons.start
  const StopIcon = actionIcons.stop
  const DeleteIcon = actionIcons.delete

  const form = useForm<PortForwardFormValues>({
    resolver: zodResolver(portForwardSchema as never),
    defaultValues: DEFAULT_VALUES
  })

  const rulesQuery = useQuery({
    queryKey: queryKeys.portForwards(session?.sessionId ?? ''),
    queryFn: () => portForwardsClient.list(session!.sessionId),
    enabled: Boolean(session)
  })

  const canManage = Boolean(session && !session.provisional && session.status === 'ready')
  const currentKind = form.watch('kind')
  const bindHost = form.watch('bindHost')

  const refresh = async () => {
    if (!session) {
      return
    }

    await queryClient.invalidateQueries({ queryKey: queryKeys.portForwards(session.sessionId) })
  }

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20">
        <div className="max-w-xs text-center">
          <div className="mb-2 text-base font-medium">
            {t('workbench.sessionEditor.closed.title')}
          </div>
          <div className="text-sm text-muted-foreground">
            {t('workbench.sessionEditor.closed.description')}
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={cn('flex h-full flex-col bg-[var(--workbench-sidebar)]', className)}>
        <div className="border-b border-[var(--workbench-border)] px-4 py-3.5">
          <div
            draggable={!!onHeaderDragStart}
            className={cn(
              'flex items-center justify-between gap-3',
              onHeaderDragStart && 'cursor-grab active:cursor-grabbing'
            )}
            onDragStart={onHeaderDragStart}
            onDragEnd={onHeaderDragEnd}
          >
            <div className="min-w-0 flex flex-col">
              <span className="text-sm font-bold tracking-tight text-foreground">{t('workbench.portForward.title')}</span>
              <span className="truncate text-[11px] text-muted-foreground mt-0.5 opacity-80">
                {t('workbench.portForward.subtitle')}
              </span>
            </div>
            <Button
              size="sm"
              className="h-8 px-3 text-[11px] font-medium"
              disabled={!canManage}
              onClick={() => {
                form.reset(DEFAULT_VALUES)
                setCreateOpen(true)
              }}
            >
              <NewRuleIcon className="size-3.5" />
              {t('workbench.portForward.actions.newRule')}
            </Button>
          </div>
          {!canManage ? (
            <div className="mt-3 rounded border border-dashed border-[var(--workbench-border)] bg-[var(--workbench-hover)]/30 px-3 py-2 text-xs text-muted-foreground">
              {t('workbench.portForward.unavailableHint')}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <div className="space-y-3">
            {rulesQuery.isLoading ? (
              <>
                <Skeleton className="h-[96px] rounded-lg" />
                <Skeleton className="h-[96px] rounded-lg" />
              </>
            ) : null}

            {!rulesQuery.isLoading && (rulesQuery.data?.length ?? 0) === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--workbench-border)] px-4 py-6 text-center text-xs text-muted-foreground">
                {t('workbench.portForward.empty.rules')}
              </div>
            ) : null}

            {(rulesQuery.data ?? []).map((rule) => {
              const active = rule.status === 'active' || rule.status === 'starting'

              return (
                <div
                  key={rule.id}
                  className={cn(
                    'relative overflow-hidden rounded-md border border-[var(--workbench-border)] bg-[color-mix(in_srgb,var(--workbench-hover)_20%,transparent)] px-3.5 py-3 transition-all hover:bg-[color-mix(in_srgb,var(--workbench-hover)_35%,transparent)] shadow-sm',
                    rule.status === 'active' && 'border-l-[3px] border-l-emerald-500',
                    rule.status === 'starting' && 'border-l-[3px] border-l-amber-500',
                    rule.status === 'error' && 'border-l-[3px] border-l-red-500',
                    rule.status === 'stopped' && 'border-l-[3px] border-l-[var(--workbench-muted)]/50'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground leading-normal">
                        {t(`workbench.portForward.kinds.${rule.kind}`)}
                      </div>
                      <div className="mt-1.5 font-mono text-[11px] text-muted-foreground break-all bg-[var(--workbench-hover)]/30 px-1.5 py-0.5 rounded border border-[var(--workbench-border)]/20 inline-block leading-normal select-text">
                        {rule.bindHost}:{rule.bindPort} -&gt; {rule.targetHost}:{rule.targetPort}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold border shrink-0',
                        rule.status === 'active' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                        rule.status === 'starting' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                        rule.status === 'error' && 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
                        rule.status === 'stopped' && 'bg-muted/50 text-muted-foreground border-muted-foreground/20'
                      )}
                    >
                      <span
                        className={cn(
                          'size-1.5 rounded-full shrink-0',
                          rule.status === 'active' && 'bg-emerald-500 animate-pulse',
                          rule.status === 'starting' && 'bg-amber-500 animate-pulse',
                          rule.status === 'error' && 'bg-red-500',
                          rule.status === 'stopped' && 'bg-muted-foreground'
                        )}
                      />
                      {t(`workbench.portForward.statuses.${rule.status}`)}
                    </Badge>
                  </div>

                  {rule.lastError ? (
                    <div
                      className={cn(
                        'mt-2.5 text-[11px] font-medium leading-relaxed bg-destructive/5 px-2 py-1.5 border border-destructive/10 rounded',
                        rule.status === 'error' ? 'text-destructive' : 'text-muted-foreground'
                      )}
                    >
                      {rule.lastError}
                    </div>
                  ) : null}

                  <div className="mt-3 flex items-center gap-2 border-t border-[var(--workbench-border)]/50 pt-2.5">
                    {active ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-[11px] font-medium border-[var(--workbench-border)] hover:bg-[var(--workbench-hover)] hover:text-foreground shrink-0"
                        disabled={!canManage}
                        onClick={async () => {
                          await portForwardsClient.stop(session.sessionId, rule.id)
                          await refresh()
                        }}
                      >
                        <StopIcon className="size-3.5 text-muted-foreground" />
                        {t('common.actions.stop')}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2.5 text-[11px] font-medium border-[var(--workbench-border)] hover:bg-[var(--workbench-hover)] hover:text-foreground shrink-0"
                        disabled={!canManage}
                        onClick={async () => {
                          await portForwardsClient.start(session.sessionId, rule.id)
                          await refresh()
                        }}
                      >
                        <StartIcon className="size-3.5 text-muted-foreground" />
                        {t('common.actions.start')}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                      disabled={!canManage}
                      onClick={async () => {
                        await portForwardsClient.remove(session.sessionId, rule.id)
                        await refresh()
                      }}
                    >
                      <DeleteIcon className="size-3.5" />
                      {t('common.actions.delete')}
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('workbench.portForward.dialog.create')}</DialogTitle>
            <DialogDescription>{t('workbench.portForward.dialog.description')}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                if (!session) {
                  return
                }

                await portForwardsClient.create(session.sessionId, values)
                setCreateOpen(false)
                form.reset(DEFAULT_VALUES)
                await refresh()
              })}
            >
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workbench.portForward.fields.kind')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="local">
                          {t('workbench.portForward.kinds.local')}
                        </SelectItem>
                        <SelectItem value="remote">
                          {t('workbench.portForward.kinds.remote')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="text-xs text-muted-foreground">
                      {t(`workbench.portForward.directions.${currentKind}`)}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="bindHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('workbench.portForward.fields.bindHost')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bindPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('workbench.portForward.fields.bindPort')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={65535}
                          onChange={(event) => field.onChange(Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isPublicBindHost(bindHost) ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  {t('workbench.portForward.warnings.publicBind', { host: bindHost.trim() })}
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="targetHost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('workbench.portForward.fields.targetHost')}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="targetPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('workbench.portForward.fields.targetPort')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          max={65535}
                          onChange={(event) => field.onChange(Number(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                  {t('common.actions.cancel')}
                </Button>
                <Button type="submit">{t('common.actions.save')}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  )
}
