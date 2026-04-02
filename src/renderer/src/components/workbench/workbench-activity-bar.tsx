import { useTranslation } from 'react-i18next'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { workbenchActivities } from '@/lib/workbench'
import { cn } from '@/lib/utils'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export function WorkbenchActivityBar() {
  const { t } = useTranslation()
  const { focusActivity } = useWorkbenchContext()
  const sessionCount = useSessionsStore((state) => state.tabs.length)
  const activeActivityId = useWorkbenchStore((state) => state.activeActivityId)
  const setSidebarOpen = useWorkbenchStore((state) => state.setSidebarOpen)
  const sidebarOpen = useWorkbenchStore((state) => state.sidebarOpen)

  return (
    <aside className="flex w-12 shrink-0 flex-col items-center border-r border-[var(--workbench-border)] bg-[var(--workbench-activity-bar)] py-2">
      <div className="flex flex-col items-center gap-1">
        {workbenchActivities.map((activity) => {
          const Icon = activity.icon
          const active = activity.activityId === activeActivityId
          const title = t(`workbench.activity.${activity.activityId}.title`)

          return (
            <Tooltip key={activity.activityId}>
              <TooltipTrigger asChild>
                <button
                  type="button"
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
    </aside>
  )
}
