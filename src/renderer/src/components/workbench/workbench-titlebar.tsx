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

function WinsshLogo(props: React.ComponentProps<'svg'>) {
  return (
    <svg viewBox="0 0 658.62 494.25" fill="none" {...props}>
      <path
        fill="currentColor"
        d="M536.94 494.25H121.69C54.6 494.25.17 441.43 0 376.18V118.07C.17 52.81 54.6 0 121.69 0h415.25c67.08 0 121.51 52.81 121.69 118.07v258.11c-.17 65.25-54.6 118.07-121.69 118.07Zm-415.25-463.74c-49.76 0-90.15 39.15-90.32 87.56v258.11c.17 48.4 40.56 87.56 90.32 87.56h415.25c49.76 0 90.15-39.15 90.33-87.56V118.07c-.17-48.41-40.56-87.56-90.33-87.56H121.69Z"
      />
      <path
        fill="currentColor"
        d="M177.44 272.44c-4.88-.07-9.55-1.15-13.15-3.05-3.56-2.05-5.56-4.84-5.56-7.75s2-5.7 5.56-7.75l88.31-49.54-95.07-54.34c-3.56-2.05-5.56-4.84-5.56-7.75s2-5.7 5.56-7.75c7.31-4.16 19-4.16 26.31 0l106.34 61.98c3.56 2.05 5.56 4.84 5.56 7.75s-2 5.7-5.56 7.75l-98.08 57.39c-3.99 2.11-9.27 3.21-14.65 3.05Z"
      />
      <path
        fill="currentColor"
        d="M316.63 367.16c-66.69.62-125.43-20.91-158.74-53.79 39.55 18.54 109.02 21.59 182.07 12.04 78.36-10.24 139.05-32.72 160.78-62.13-11.58 57.78-89.39 103-184.11 103.88Z"
      />
      <ellipse cx="441.4" cy="201.93" fill="currentColor" rx="29.25" ry="58.6" />
    </svg>
  )
}

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
        <div className="flex shrink-0 items-center justify-center rounded-sm">
          <WinsshLogo
            role="img"
            aria-label="WinSSH"
            className="size-6"
            style={{ color: 'var(--workbench-logo)' }}
          />
        </div>
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
