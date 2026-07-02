import { memo, useCallback, useMemo, useState, type DragEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TerminalSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useShallow } from 'zustand/react/shallow'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { queryKeys } from '@/features/shared/query-keys'
import { sessionsClient } from '@/features/sessions/api/sessions-client'
import { settingsClient } from '@/features/settings/api/settings-client'
import { themesClient } from '@/features/themes/api/themes-client'
import { actionIcons } from '@/lib/action-icons'
import { usePrefersDark } from '@/hooks/use-prefers-dark'
import { resolveThemeDefinition } from '@/lib/theme'
import { CommandPanel } from '@/components/workbench/command-panel'
import { PortForwardPanel } from '@/components/port-forward-panel'
import { SessionResourceMonitor } from '@/components/session-resource-monitor'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { SftpPanel } from '@/components/sftp-panel'
import { TerminalPane } from '@/components/terminal-pane'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

const TERMINAL_PANEL_MIN_SIZE = '320px'
const AUX_PANEL_DRAG_MIME = 'application/x-winssh-aux-panel'

const AUX_PANEL_DEFAULT_SIZE_PX = 360
const AUX_PANEL_MIN_SIZE = '280px'
const AUX_PANEL_MAX_SIZE = '55%'

interface WorkbenchSessionEditorProps {
  sessionId: string
  active?: boolean
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

function WorkbenchSessionEditorImpl({ sessionId, active = true }: WorkbenchSessionEditorProps) {
  const { t } = useTranslation()
  const prefersDark = usePrefersDark()
  const { reconnectSession, disconnectSession, openSftpFileEditor } = useWorkbenchContext()
  const [monitorExpanded, setMonitorExpanded] = useState(true)
  const [dropTargetSide, setDropTargetSide] = useState<'left' | 'right' | null>(null)
  const session = useSessionsStore(
    useShallow((state) => state.tabs.find((tab) => tab.sessionId === sessionId) ?? null)
  )
  const setAuxView = useSessionsStore((state) => state.setAuxView)
  const setAuxPanelSide = useSessionsStore((state) => state.setAuxPanelSide)
  const globalSftpPanelSide = useWorkbenchStore((state) => state.sftpPanelSide)
  const auxPanelSides = useWorkbenchStore((state) => state.auxPanelSides)
  const setGlobalAuxPanelSide = useWorkbenchStore((state) => state.setAuxPanelSide)
  const setGlobalAuxPanelSize = useWorkbenchStore((state) => state.setAuxPanelSize)
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsClient.get(),
    initialData: DEFAULT_APP_SETTINGS
  })
  const themesQuery = useQuery({
    queryKey: queryKeys.themes,
    queryFn: () => themesClient.list()
  })
  const RemoteFilesIcon = actionIcons.openRemoteFiles
  const PortForwardIcon = actionIcons.openPortForwards
  const ReconnectIcon = actionIcons.reconnect
  const DisconnectIcon = actionIcons.disconnect
  const ResourceMonitorIcon = actionIcons.openResourceMonitor

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--workbench-editor)] px-6">
        <div className="max-w-md border border-[var(--workbench-border)] px-8 py-10 text-center">
          <div className="text-lg font-semibold text-foreground">
            {t('workbench.sessionEditor.closed.title')}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {t('workbench.sessionEditor.closed.description')}
          </div>
        </div>
      </div>
    )
  }

  const auxView = session.auxView ?? null
  const auxPanelSide =
    session.auxPanelSide ?? (auxView ? auxPanelSides[auxView] : undefined) ?? globalSftpPanelSide
  const auxPanelDefaultSize = useMemo(() => {
    const sizes = useWorkbenchStore.getState().auxPanelSizes
    const sizePx = (auxView ? sizes[auxView] : undefined) ?? AUX_PANEL_DEFAULT_SIZE_PX
    return `${sizePx}px`
  }, [auxView])
  const resolvedTheme = resolveThemeDefinition(
    settingsQuery.data.theme,
    themesQuery.data ?? [],
    prefersDark
  )

  const handleAuxHeaderDragStart = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData(AUX_PANEL_DRAG_MIME, session.sessionId)
    },
    [session.sessionId]
  )

  const handleAuxHeaderDragEnd = useCallback(() => {
    setDropTargetSide(null)
  }, [])

  const handleTerminalDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.dataTransfer.types.includes(AUX_PANEL_DRAG_MIME)) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'

    const rect = event.currentTarget.getBoundingClientRect()
    const midX = rect.left + rect.width / 2
    setDropTargetSide(event.clientX < midX ? 'left' : 'right')
  }, [])

  const handleTerminalDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDropTargetSide(null)
    }
  }, [])

  const handleTerminalDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!event.dataTransfer.types.includes(AUX_PANEL_DRAG_MIME)) {
        return
      }
      event.preventDefault()

      const rect = event.currentTarget.getBoundingClientRect()
      const midX = rect.left + rect.width / 2
      const targetSide: 'left' | 'right' = event.clientX < midX ? 'left' : 'right'

      if (targetSide !== auxPanelSide) {
        setAuxPanelSide(session.sessionId, targetSide)
        if (auxView) {
          setGlobalAuxPanelSide(auxView, targetSide)
        }
      }

      setDropTargetSide(null)
    },
    [session.sessionId, auxView, auxPanelSide, setAuxPanelSide, setGlobalAuxPanelSide]
  )

  const terminalView = (
    <div
      className="relative h-full min-w-0"
      onDragOver={handleTerminalDragOver}
      onDragLeave={handleTerminalDragLeave}
      onDrop={handleTerminalDrop}
    >
      {dropTargetSide === 'left' ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-1.5 bg-[var(--workbench-active)] opacity-60" />
      ) : null}
      <TerminalPane
        active={active}
        session={session}
        settings={settingsQuery.data}
        theme={resolvedTheme}
        onReconnect={reconnectSession}
      />
      {dropTargetSide === 'right' ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-1.5 bg-[var(--workbench-active)] opacity-60" />
      ) : null}
    </div>
  )
  const auxPanelContent =
    auxView === 'sftp' ? (
      <SftpPanel
        session={session}
        className="h-full overflow-hidden bg-[var(--workbench-sidebar)]"
        onEditFile={(remotePath) => openSftpFileEditor(session.sessionId, remotePath)}
        onHeaderDragStart={handleAuxHeaderDragStart}
        onHeaderDragEnd={handleAuxHeaderDragEnd}
      />
    ) : auxView === 'port-forward' ? (
      <PortForwardPanel
        session={session}
        className="h-full overflow-hidden bg-[var(--workbench-sidebar)]"
        onClose={() => setAuxView(session.sessionId, null)}
        onHeaderDragStart={handleAuxHeaderDragStart}
        onHeaderDragEnd={handleAuxHeaderDragEnd}
      />
    ) : auxView === 'command-history' ? (
      <CommandPanel
        scope={{ kind: 'ssh', serverId: session.serverId }}
        onInsertCommand={(text) => sessionsClient.write(session.sessionId, text)}
        onClose={() => setAuxView(session.sessionId, null)}
        className="h-full overflow-hidden bg-[var(--workbench-sidebar)]"
        onHeaderDragStart={handleAuxHeaderDragStart}
        onHeaderDragEnd={handleAuxHeaderDragEnd}
      />
    ) : null
  const showAuxPanel = Boolean(auxPanelContent && !session.provisional)
  const copyServerIp = async () => {
    try {
      await navigator.clipboard.writeText(session.host)
      toast.success(t('workbench.toasts.ipCopied'))
    } catch {
      toast.error(t('workbench.toasts.ipCopyFailed'))
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]">
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-[var(--workbench-border)] px-2">
        <button
          type="button"
          className="inline-flex h-8 min-w-0 shrink-0 items-center rounded-md border border-[var(--workbench-border)] px-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--workbench-hover)_72%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workbench-active)]"
          aria-label={t('workbench.sessionEditor.actions.copyIp')}
          title={t('workbench.sessionEditor.actions.copyIp')}
          onClick={() => void copyServerIp()}
        >
          <div className="flex min-w-0 items-baseline gap-1.5 text-[11px] leading-none text-muted-foreground">
            <span className="shrink-0">{t('workbench.sessionEditor.serverAddress')}</span>
            <span className="truncate font-mono">{session.host}</span>
          </div>
        </button>
        <SessionResourceMonitor
          active={active}
          expanded={monitorExpanded}
          refetchIntervalMs={
            settingsQuery.data?.resourceMonitorIntervalMs ??
            DEFAULT_APP_SETTINGS.resourceMonitorIntervalMs
          }
          session={session}
        />
        <div className="flex shrink-0 items-center gap-2">
          <TooltipIconButton
            variant={monitorExpanded ? 'secondary' : 'ghost'}
            size="icon-sm"
            label={t('workbench.sessionEditor.resourceMonitor.title')}
            aria-pressed={monitorExpanded}
            onClick={() => setMonitorExpanded((prev) => !prev)}
          >
            <ResourceMonitorIcon className="size-4" />
          </TooltipIconButton>
          <TooltipIconButton
            variant={auxView === 'sftp' ? 'secondary' : 'ghost'}
            size="icon-sm"
            label={t('workbench.sessionEditor.remoteFiles')}
            aria-pressed={auxView === 'sftp'}
            disabled={session.provisional || session.status !== 'ready'}
            onClick={() => setAuxView(session.sessionId, auxView === 'sftp' ? null : 'sftp')}
          >
            <RemoteFilesIcon className="size-4" />
          </TooltipIconButton>
          <TooltipIconButton
            variant={auxView === 'port-forward' ? 'secondary' : 'ghost'}
            size="icon-sm"
            label={t('workbench.sessionEditor.portForwards')}
            aria-pressed={auxView === 'port-forward'}
            disabled={session.provisional}
            onClick={() =>
              setAuxView(session.sessionId, auxView === 'port-forward' ? null : 'port-forward')
            }
          >
            <PortForwardIcon className="size-4" />
          </TooltipIconButton>
          <TooltipIconButton
            variant={auxView === 'command-history' ? 'secondary' : 'ghost'}
            size="icon-sm"
            label={t('workbench.commandPanel.title')}
            aria-pressed={auxView === 'command-history'}
            disabled={session.provisional}
            onClick={() =>
              setAuxView(
                session.sessionId,
                auxView === 'command-history' ? null : 'command-history'
              )
            }
          >
            <TerminalSquare className="size-4" />
          </TooltipIconButton>
          {session.status !== 'ready' && session.status !== 'connecting' ? (
            <TooltipIconButton
              variant="ghost"
              size="icon-sm"
              label={t('common.actions.reconnect')}
              onClick={() => void reconnectSession(sessionId)}
            >
              <ReconnectIcon className="size-4" />
            </TooltipIconButton>
          ) : null}
          <TooltipIconButton
            variant="ghost"
            size="icon-sm"
            label={
              session.status === 'connecting'
                ? t('workbench.sessionEditor.cancel')
                : t('common.actions.disconnect')
            }
            onClick={() => void disconnectSession(sessionId)}
          >
            <DisconnectIcon className="size-4" />
          </TooltipIconButton>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup className="h-full" orientation="horizontal">
          {auxPanelSide === 'left' && showAuxPanel ? (
            <>
              <ResizablePanel
                key={`sftp-panel-${session.sessionId}`}
                id={`sftp-panel-${session.sessionId}`}
                defaultSize={auxPanelDefaultSize}
                maxSize={AUX_PANEL_MAX_SIZE}
                minSize={AUX_PANEL_MIN_SIZE}
                onResize={(size) => {
                  if (auxView && size.inPixels > 0) {
                    setGlobalAuxPanelSize(auxView, size.inPixels)
                  }
                }}
              >
                <div className="h-full min-w-0 bg-[var(--workbench-sidebar)] p-3">
                  {auxPanelContent}
                </div>
              </ResizablePanel>
              <ResizableHandle
                withHandle
                className="bg-[var(--workbench-border)] data-[resize-handle-state=drag]:bg-[var(--workbench-active)]"
              />
            </>
          ) : null}

          <ResizablePanel
            key={`terminal-panel-${session.sessionId}`}
            id={`terminal-panel-${session.sessionId}`}
            minSize={TERMINAL_PANEL_MIN_SIZE}
          >
            {terminalView}
          </ResizablePanel>

          {auxPanelSide === 'right' && showAuxPanel ? (
            <>
              <ResizableHandle
                withHandle
                className="bg-[var(--workbench-border)] data-[resize-handle-state=drag]:bg-[var(--workbench-active)]"
              />
              <ResizablePanel
                key={`sftp-panel-${session.sessionId}`}
                id={`sftp-panel-${session.sessionId}`}
                defaultSize={auxPanelDefaultSize}
                maxSize={AUX_PANEL_MAX_SIZE}
                minSize={AUX_PANEL_MIN_SIZE}
                onResize={(size) => {
                  if (auxView && size.inPixels > 0) {
                    setGlobalAuxPanelSize(auxView, size.inPixels)
                  }
                }}
              >
                <div className="h-full min-w-0 bg-[var(--workbench-sidebar)] p-3">
                  {auxPanelContent}
                </div>
              </ResizablePanel>
            </>
          ) : null}
        </ResizablePanelGroup>
      </div>
    </div>
  )
}

export const WorkbenchSessionEditor = memo(WorkbenchSessionEditorImpl)
WorkbenchSessionEditor.displayName = 'WorkbenchSessionEditor'
