import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateState } from '@shared/types'
import { SYSTEM_THEME_ID } from '@shared/themes'
import { useTranslation } from 'react-i18next'
import { Palette } from 'lucide-react'
import { toast } from 'sonner'
import { queryKeys } from '@/features/shared/query-keys'
import { settingsClient } from '@/features/settings/api/settings-client'
import { themesClient } from '@/features/themes/api/themes-client'
import { updatesClient } from '@/features/updates/api/updates-client'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { actionIcons } from '@/lib/action-icons'
import { workbenchActivities } from '@/lib/workbench'
import { cn } from '@/lib/utils'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

export function WorkbenchActivityBar() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { focusActivity, openSettingsEditor, openUpdatesEditor } = useWorkbenchContext()
  const sessionCount = useSessionsStore((state) => state.tabs.length)
  const activeActivityId = useWorkbenchStore((state) => state.activeActivityId)
  const setSidebarOpen = useWorkbenchStore((state) => state.setSidebarOpen)
  const sidebarOpen = useWorkbenchStore((state) => state.sidebarOpen)
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false)
  const SettingsIcon = actionIcons.openSettings
  const RefreshIcon = actionIcons.refresh

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsClient.get()
  })
  const themesQuery = useQuery({
    queryKey: queryKeys.themes,
    queryFn: () => themesClient.list()
  })
  const updateTheme = useMutation({
    mutationFn: (theme: string) => settingsClient.update({ theme }),
    onSuccess: (updatedSettings) => {
      queryClient.setQueryData(queryKeys.settings, updatedSettings)
    }
  })
  const visibleActivities = workbenchActivities.filter(
    (activity) => activity.activityId !== 'settings'
  )
  const settingsActive = activeActivityId === 'settings' || settingsMenuOpen
  const settingsTitle = t('workbench.activity.settings.title')

  const checkForUpdates = useMutation({
    mutationFn: () => updatesClient.check(),
    onMutate: () => {
      const currentState = queryClient.getQueryData<UpdateState>(queryKeys.updatesState)

      if (!currentState) {
        return
      }

      queryClient.setQueryData<UpdateState>(queryKeys.updatesState, {
        ...currentState,
        errorMessage: null,
        phase: 'checking'
      })
    },
    onSuccess: (state) => {
      queryClient.setQueryData(queryKeys.updatesState, state)
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('workbench.settings.updates.toasts.checkFailed')
      )
    }
  })

  const handleCheckForUpdates = () => {
    openUpdatesEditor()
    checkForUpdates.mutate()
  }

  return (
    <aside className="flex w-12 shrink-0 flex-col items-center border-r border-[var(--workbench-border)] bg-[var(--workbench-activity-bar)] py-2">
      <div className="flex min-h-0 flex-1 flex-col items-center">
        <div className="flex flex-col items-center gap-1">
          {visibleActivities.map((activity) => {
            const Icon = activity.icon
            const active = activity.activityId === activeActivityId
            const title = t(`workbench.activity.${activity.activityId}.title`)

            return (
              <Tooltip key={activity.activityId}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-testid={`activity-${activity.activityId}`}
                    data-active={active}
                    aria-label={title}
                    className={cn(
                      'relative flex size-10 items-center justify-center rounded-sm text-[var(--workbench-muted)] transition-colors hover:bg-[var(--workbench-hover)] hover:text-foreground',
                      active && 'bg-[var(--workbench-hover)] text-foreground'
                    )}
                    onClick={() => {
                      if (active) {
                        setSidebarOpen(!sidebarOpen)
                        return
                      }

                      setSidebarOpen(true)
                      focusActivity(activity.activityId)
                    }}
                  >
                    {active ? (
                      <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-[var(--workbench-active)]" />
                    ) : null}
                    <Icon className="size-5" />
                    {activity.activityId === 'terminal' && sessionCount > 0 ? (
                      <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-[var(--workbench-active)] px-1 text-[10px] font-semibold text-white">
                        {sessionCount > 9 ? '9+' : sessionCount}
                      </span>
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{title}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>

        <DropdownMenu open={settingsMenuOpen} onOpenChange={setSettingsMenuOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  data-testid="activity-settings-menu"
                  data-active={settingsActive}
                  aria-label={settingsTitle}
                  className={cn(
                    'relative mt-auto flex size-10 items-center justify-center rounded-sm text-[var(--workbench-muted)] transition-colors hover:bg-[var(--workbench-hover)] hover:text-foreground',
                    settingsActive && 'bg-[var(--workbench-hover)] text-foreground'
                  )}
                >
                  {settingsActive ? (
                    <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-[var(--workbench-active)]" />
                  ) : null}
                  <SettingsIcon className="size-5" />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{settingsTitle}</TooltipContent>
          </Tooltip>

          <DropdownMenuContent
            align="end"
            side="right"
            className="min-w-40 border-[var(--workbench-border)] bg-[var(--workbench-editor)]"
          >
            <DropdownMenuItem onSelect={() => openSettingsEditor()}>
              <SettingsIcon className="size-4" />
              {settingsTitle}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette className="size-4" />
                {t('workbench.settings.form.theme')}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="border-[var(--workbench-border)] bg-[var(--workbench-editor)]">
                <DropdownMenuRadioGroup
                  value={settingsQuery.data?.theme ?? SYSTEM_THEME_ID}
                  onValueChange={(value) => updateTheme.mutate(value)}
                >
                  <DropdownMenuRadioItem value={SYSTEM_THEME_ID}>
                    {t('common.theme.system')}
                  </DropdownMenuRadioItem>
                  {(themesQuery.data ?? []).map((theme) => (
                    <DropdownMenuRadioItem key={theme.id} value={theme.id}>
                      {theme.label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem
              disabled={checkForUpdates.isPending}
              onSelect={() => handleCheckForUpdates()}
            >
              <RefreshIcon className={cn('size-4', checkForUpdates.isPending && 'animate-spin')} />
              {t('workbench.settings.updates.actions.check')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  )
}
