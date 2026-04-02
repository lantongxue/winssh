import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { actionIcons } from '@/lib/action-icons'
import { cn } from '@/lib/utils'
import { useWorkbenchStore } from '@/store/workbench-store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function getPlatform() {
  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    navigator.userAgent
  return platform.toLowerCase()
}

type AppRegionStyle = CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag'
}

const noDragStyle = { WebkitAppRegion: 'no-drag' } as AppRegionStyle

function TitlebarButton({
  children,
  className,
  tooltip,
  ...props
}: React.ComponentProps<typeof Button> & { tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          {...props}
          className={cn(
            'h-7 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 text-[var(--workbench-muted)] hover:bg-[var(--workbench-hover)] hover:text-foreground',
            className
          )}
          style={noDragStyle}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

function WindowControlButton({
  children,
  className,
  tooltip,
  ...props
}: React.ComponentProps<typeof Button> & { tooltip: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={tooltip}
          {...props}
          className={cn(
            'h-9 w-11 rounded-none border-0 bg-transparent p-0 text-[var(--workbench-muted)] hover:bg-[var(--workbench-hover)] hover:text-foreground',
            className
          )}
          style={noDragStyle}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export function WorkbenchTitlebar() {
  const { t } = useTranslation()
  const togglePanel = useWorkbenchStore((state) => state.togglePanel)
  const toggleSidebar = useWorkbenchStore((state) => state.toggleSidebar)
  const setCommandPaletteOpen = useWorkbenchStore((state) => state.setCommandPaletteOpen)
  const setQuickOpenOpen = useWorkbenchStore((state) => state.setQuickOpenOpen)
  const [isMaximized, setIsMaximized] = useState(false)
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.winsshApi.settings.get()
  })

  const customTitleBar = settingsQuery.data?.windowTitleBarStyle === 'custom'
  const platform = useMemo(() => getPlatform(), [])
  const isMac = platform.includes('mac')
  const QuickOpenIcon = actionIcons.quickOpen
  const CommandPaletteIcon = actionIcons.commandPalette
  const ToggleSidebarIcon = actionIcons.toggleSidebar
  const TogglePanelIcon = actionIcons.togglePanel
  const MinimizeWindowIcon = actionIcons.minimizeWindow
  const MaximizeWindowIcon = isMaximized ? actionIcons.restoreWindow : actionIcons.maximizeWindow
  const CloseWindowIcon = actionIcons.close

  useEffect(() => {
    if (!customTitleBar) {
      return
    }

    let cancelled = false

    void window.winsshApi.system.window.isMaximized().then((value) => {
      if (!cancelled) {
        setIsMaximized(value)
      }
    })

    const unsubscribe = window.winsshApi.system.window.onStateChange((state) => {
      setIsMaximized(state.isMaximized)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [customTitleBar])

  return (
    <header
      className="relative flex h-9 shrink-0 items-center border-b border-[var(--workbench-border)] bg-[var(--workbench-titlebar)] px-2 text-xs"
      style={
        {
          WebkitAppRegion: customTitleBar ? 'drag' : 'no-drag',
          paddingLeft: customTitleBar && isMac ? '76px' : undefined,
          userSelect: 'none'
        } as AppRegionStyle
      }
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TitlebarButton
          size="sm"
          tooltip={t('workbench.titleBar.quickOpenTitle')}
          onClick={() => setQuickOpenOpen(true)}
        >
          <QuickOpenIcon className="size-3.5" />
          {t('common.actions.quickOpen')}
        </TitlebarButton>
      </div>

      <div className="pointer-events-none absolute inset-x-0 flex justify-center">
        <div className="pointer-events-auto w-full max-w-[440px] px-20 sm:px-24">
          <TitlebarButton
            size="sm"
            tooltip={t('workbench.titleBar.commandPaletteTitle')}
            className="w-full justify-center"
            onClick={() => setCommandPaletteOpen(true)}
          >
            <CommandPaletteIcon className="size-3.5" />
            {t('common.actions.commandPalette')}
          </TitlebarButton>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-1">
        <WindowControlButton
          tooltip={t('common.actions.toggleSidebar')}
          onClick={toggleSidebar}
        >
          <ToggleSidebarIcon className="size-4" />
        </WindowControlButton>
        <WindowControlButton tooltip={t('common.actions.togglePanel')} onClick={togglePanel}>
          <TogglePanelIcon className="size-4" />
        </WindowControlButton>

        {customTitleBar && !isMac ? (
          <>
            <WindowControlButton
              tooltip={t('workbench.titleBar.minimizeWindow')}
              onClick={() => void window.winsshApi.system.window.minimize()}
            >
              <MinimizeWindowIcon className="size-4" />
            </WindowControlButton>
            <WindowControlButton
              tooltip={t(
                isMaximized ? 'workbench.titleBar.restoreWindow' : 'workbench.titleBar.maximizeWindow'
              )}
              onClick={() => void window.winsshApi.system.window.toggleMaximize()}
            >
              <MaximizeWindowIcon className="size-4" />
            </WindowControlButton>
            <WindowControlButton
              tooltip={t('workbench.titleBar.closeWindow')}
              className="hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => void window.winsshApi.system.window.close()}
            >
              <CloseWindowIcon className="size-4" />
            </WindowControlButton>
          </>
        ) : null}
      </div>
    </header>
  )
}
