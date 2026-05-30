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
import { X, ArrowRight, Lock, Monitor, Server } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface PortForwardPanelProps {
  session: SessionTab | null
  className?: string
  onClose: () => void
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

function TooltipIconButton({
  children,
  label,
  ...props
}: React.ComponentProps<typeof Button> & {
  label: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function PortForwardPanel({
  session,
  className,
  onClose,
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
              <span className="text-sm font-bold tracking-tight text-foreground">
                {t('workbench.portForward.title')}
              </span>
              <span className="truncate text-[11px] text-muted-foreground mt-0.5 opacity-80">
                {t('workbench.portForward.subtitle')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <TooltipIconButton
                variant="ghost"
                size="icon-sm"
                className="size-7 text-[var(--workbench-active)] hover:bg-[var(--workbench-hover)]"
                disabled={!canManage}
                label={t('workbench.portForward.actions.newRule')}
                onClick={() => {
                  form.reset(DEFAULT_VALUES)
                  setCreateOpen(true)
                }}
              >
                <NewRuleIcon className="size-4" />
              </TooltipIconButton>
              <TooltipIconButton
                variant="ghost"
                size="icon-sm"
                className="size-7 text-muted-foreground hover:text-foreground hover:bg-[var(--workbench-hover)]"
                label={t('common.actions.close')}
                onClick={onClose}
              >
                <X className="size-4" />
              </TooltipIconButton>
            </div>
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
                    'relative overflow-hidden border border-[var(--workbench-border)] px-3.5 py-3'
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground leading-normal">
                      {rule.kind === 'local' ? (
                        <Monitor className="size-3.5 text-[var(--workbench-active)]" />
                      ) : (
                        <Server className="size-3.5 text-[var(--workbench-active)]" />
                      )}
                      <span>{t(`workbench.portForward.kinds.${rule.kind}`)}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-semibold border shrink-0',
                        rule.status === 'active' &&
                          'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                        rule.status === 'starting' &&
                          'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                        rule.status === 'error' &&
                          'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
                        rule.status === 'stopped' &&
                          'bg-muted/50 text-muted-foreground border-muted-foreground/20'
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

                  {/* Redesigned Visual Flow Map */}
                  <div className="mt-3.5 flex items-center justify-between gap-3 bg-[color-mix(in_srgb,var(--workbench-hover)_10%,transparent)] p-3 rounded-lg border border-[var(--workbench-border)]/40 relative">
                    {/* Source Node */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1 text-left block">
                        {rule.kind === 'local'
                          ? t('workbench.portForward.kinds.localSource')
                          : t('workbench.portForward.kinds.remoteSource')}
                      </span>
                      <span className="font-mono text-[11px] text-foreground font-semibold truncate bg-[var(--workbench-input)] px-2 py-1.5 rounded border border-[var(--workbench-border)]/50 leading-none select-text text-left block">
                        {rule.bindHost}:{rule.bindPort}
                      </span>
                    </div>

                    {/* Connector */}
                    <div className="flex flex-col items-center justify-center shrink-0 px-1 select-none">
                      <div
                        className={cn(
                          'flex items-center justify-center size-6 rounded-full border mb-1 transition-all',
                          rule.status === 'active'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                            : rule.status === 'starting'
                              ? 'bg-amber-500/10 border-amber-500/30 text-amber-500 animate-pulse'
                              : 'bg-muted/30 border-muted-foreground/10 text-muted-foreground/75'
                        )}
                      >
                        <Lock className="size-3" />
                      </div>
                      <div className="flex items-center gap-0.5 relative w-12 justify-center">
                        <span
                          className={cn(
                            'h-[2px] flex-1 rounded-full',
                            rule.status === 'active'
                              ? 'bg-emerald-500/40'
                              : 'bg-muted-foreground/20'
                          )}
                        />
                        <ArrowRight
                          className={cn(
                            'size-3 shrink-0',
                            rule.status === 'active'
                              ? 'text-emerald-500 animate-pulse'
                              : 'text-muted-foreground/50'
                          )}
                        />
                        <span
                          className={cn(
                            'h-[2px] flex-1 rounded-full',
                            rule.status === 'active'
                              ? 'bg-emerald-500/40'
                              : 'bg-muted-foreground/20'
                          )}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground/60 font-medium scale-90 mt-0.5 whitespace-nowrap">
                        SSH Tunnel
                      </span>
                    </div>

                    {/* Destination Node */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1 text-right block">
                        {rule.kind === 'local'
                          ? t('workbench.portForward.kinds.localDest')
                          : t('workbench.portForward.kinds.remoteDest')}
                      </span>
                      <span className="font-mono text-[11px] text-foreground font-semibold truncate bg-[var(--workbench-input)] px-2 py-1.5 rounded border border-[var(--workbench-border)]/50 leading-none select-text text-right block">
                        {rule.targetHost}:{rule.targetPort}
                      </span>
                    </div>
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

                  {/* Redesigned Actions Row */}
                  <div className="mt-3 flex items-center justify-between border-t border-[var(--workbench-border)]/50 pt-2.5">
                    <div>
                      {active ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-[11px] font-medium border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/15 hover:text-amber-600 dark:hover:text-amber-400 text-amber-600 dark:text-amber-500 shrink-0 gap-1.5 transition-colors"
                          disabled={!canManage}
                          onClick={async () => {
                            await portForwardsClient.stop(session.sessionId, rule.id)
                            await refresh()
                          }}
                        >
                          <StopIcon className="size-3.5" />
                          {t('common.actions.stop')}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-[11px] font-medium border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/15 hover:text-emerald-600 dark:hover:text-emerald-400 text-emerald-600 dark:text-emerald-500 shrink-0 gap-1.5 transition-colors"
                          disabled={!canManage}
                          onClick={async () => {
                            await portForwardsClient.start(session.sessionId, rule.id)
                            await refresh()
                          }}
                        >
                          <StartIcon className="size-3.5" />
                          {t('common.actions.start')}
                        </Button>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2.5 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 gap-1.5 transition-colors"
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
