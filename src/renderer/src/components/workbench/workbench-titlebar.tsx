import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { queryKeys } from '@/features/shared/query-keys'
import { settingsClient } from '@/features/settings/api/settings-client'
import { systemClient } from '@/features/system/api/system-client'
import { actionIcons } from '@/lib/action-icons'
import { getPlatform } from '@/lib/platform'
import { cn } from '@/lib/utils'
import WinsshLogo from '@/assets/logo-slim.svg?react'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { useWorkbenchStore } from '@/store/workbench-store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type AppRegionStyle = CSSProperties & {
  WebkitAppRegion?: 'drag' | 'no-drag'
}

const noDragStyle = { WebkitAppRegion: 'no-drag' } as AppRegionStyle
const WINDOW_CONTROL_BUTTONS_FALLBACK_RIGHT_INSET = 138

interface WindowControlsOverlayGeometrySource {
  visible: boolean
  getTitlebarAreaRect: () => Pick<DOMRect, 'x' | 'width'>
  addEventListener?: (type: 'geometrychange', listener: () => void) => void
  removeEventListener?: (type: 'geometrychange', listener: () => void) => void
}

type NavigatorWithWindowControlsOverlay = Navigator & {
  windowControlsOverlay?: WindowControlsOverlayGeometrySource
}

function getWindowControlsOverlay() {
  if (typeof navigator === 'undefined') {
    return null
  }

  return (navigator as NavigatorWithWindowControlsOverlay).windowControlsOverlay ?? null
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
  tone = 'default',
  tooltip,
  ...props
}: React.ComponentProps<typeof Button> & {
  tooltip: string
  tone?: 'default' | 'close'
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={tooltip}
          data-window-control-tone={tone}
          {...props}
          className={cn(
            'window-control-button h-9 w-11 rounded-none border-0 bg-transparent p-0 text-[var(--workbench-muted)]',
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
  const { openLocalTerminal } = useWorkbenchContext()
  const togglePanel = useWorkbenchStore((state) => state.togglePanel)
  const toggleSidebar = useWorkbenchStore((state) => state.toggleSidebar)
  const panelOpen = useWorkbenchStore((state) => state.panelOpen)
  const sidebarOpen = useWorkbenchStore((state) => state.sidebarOpen)
  const setCommandPaletteOpen = useWorkbenchStore((state) => state.setCommandPaletteOpen)
  const setQuickOpenOpen = useWorkbenchStore((state) => state.setQuickOpenOpen)
  const [isMaximized, setIsMaximized] = useState(false)
  const [nativeWindowControlsRightInset, setNativeWindowControlsRightInset] = useState(0)
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsClient.get()
  })

  const customTitleBar = settingsQuery.data?.windowTitleBarStyle === 'custom'
  const platform = useMemo(() => getPlatform(), [])
  const isMac = platform.includes('mac')
  const isWindows = platform.includes('win')
  const QuickOpenIcon = actionIcons.quickOpen
  const OpenTerminalIcon = actionIcons.openTerminal
  const CommandPaletteIcon = actionIcons.commandPalette
  const ToggleSidebarIcon = sidebarOpen
    ? actionIcons.toggleSidebarOpen
    : actionIcons.toggleSidebarClosed
  const TogglePanelIcon = panelOpen ? actionIcons.togglePanelOpen : actionIcons.togglePanelClosed
  const MinimizeWindowIcon = actionIcons.minimizeWindow
  const MaximizeWindowIcon = isMaximized ? actionIcons.restoreWindow : actionIcons.maximizeWindow
  const CloseWindowIcon = actionIcons.close

  useEffect(() => {
    const resetNativeWindowControlsRightInset = () => setNativeWindowControlsRightInset(0)

    if (!customTitleBar || !isWindows) {
      queueMicrotask(resetNativeWindowControlsRightInset)
      return
    }

    const overlay = getWindowControlsOverlay()
    if (!overlay || typeof window === 'undefined') {
      queueMicrotask(resetNativeWindowControlsRightInset)
      return
    }

    const syncOverlayGeometry = () => {
      if (!overlay.visible) {
        setNativeWindowControlsRightInset(0)
        return
      }

      const rect = overlay.getTitlebarAreaRect()
      const rightInset = Math.max(
        WINDOW_CONTROL_BUTTONS_FALLBACK_RIGHT_INSET,
        Math.round(window.innerWidth - (rect.x + rect.width))
      )

      setNativeWindowControlsRightInset(rightInset)
    }

    syncOverlayGeometry()
    overlay.addEventListener?.('geometrychange', syncOverlayGeometry)
    window.addEventListener('resize', syncOverlayGeometry)

    return () => {
      overlay.removeEventListener?.('geometrychange', syncOverlayGeometry)
      window.removeEventListener('resize', syncOverlayGeometry)
    }
  }, [customTitleBar, isWindows])

  useEffect(() => {
    if (!customTitleBar) {
      return
    }

    let cancelled = false

    void systemClient.window.isMaximized().then((value) => {
      if (!cancelled) {
        setIsMaximized(value)
      }
    })

    const unsubscribe = systemClient.window.onStateChange((state) => {
      setIsMaximized(state.isMaximized)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [customTitleBar])

  const useNativeWindowsCaptionButtons =
    customTitleBar && isWindows && nativeWindowControlsRightInset > 0

  return (
    <header
      className="relative flex h-9 shrink-0 items-center border-b border-[var(--workbench-border)] bg-[var(--workbench-titlebar)] px-2 text-xs"
      style={
        {
          WebkitAppRegion: customTitleBar ? 'drag' : 'no-drag',
          paddingLeft: customTitleBar && isMac ? '76px' : undefined,
          paddingRight: useNativeWindowsCaptionButtons
            ? `${nativeWindowControlsRightInset + 8}px`
            : undefined,
          userSelect: 'none'
        } as AppRegionStyle
      }
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div
          className="winssh-logo-orbit flex size-7 shrink-0 items-center justify-center rounded-sm"
          style={noDragStyle}
        >
          <WinsshLogo
            role="img"
            aria-label="WinSSH"
            className="winssh-logo-sprite size-6"
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
        <TitlebarButton
          size="sm"
          tooltip={t('workbench.titleBar.openTerminalTitle')}
          onClick={() => void openLocalTerminal()}
        >
          <OpenTerminalIcon className="size-3.5" />
          {t('common.actions.openTerminal')}
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
        <WindowControlButton tooltip={t('common.actions.toggleSidebar')} onClick={toggleSidebar}>
          <ToggleSidebarIcon className="size-4" />
        </WindowControlButton>
        <WindowControlButton tooltip={t('common.actions.togglePanel')} onClick={togglePanel}>
          <TogglePanelIcon className="size-4" />
        </WindowControlButton>

        {customTitleBar && !isMac && !useNativeWindowsCaptionButtons ? (
          <>
            <WindowControlButton
              tooltip={t('workbench.titleBar.minimizeWindow')}
              onClick={() => void systemClient.window.minimize()}
            >
              <MinimizeWindowIcon className="size-4" />
            </WindowControlButton>
            <WindowControlButton
              tooltip={t(
                isMaximized
                  ? 'workbench.titleBar.restoreWindow'
                  : 'workbench.titleBar.maximizeWindow'
              )}
              onClick={() => void systemClient.window.toggleMaximize()}
            >
              <MaximizeWindowIcon className="size-4" />
            </WindowControlButton>
            <WindowControlButton
              tooltip={t('workbench.titleBar.closeWindow')}
              tone="close"
              onClick={() => void systemClient.window.close()}
            >
              <CloseWindowIcon className="size-4" />
            </WindowControlButton>
          </>
        ) : null}
      </div>
    </header>
  )
}
