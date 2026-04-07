import { memo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { actionIcons } from '@/lib/action-icons'
import { usePrefersDark } from '@/hooks/use-prefers-dark'
import { resolveThemeDefinition } from '@/lib/theme'
import { PortForwardPanel } from '@/components/port-forward-panel'
import { SessionResourceMonitor } from '@/components/session-resource-monitor'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { SftpPanel } from '@/components/sftp-panel'
import { TerminalPane } from '@/components/terminal-pane'
import { Button } from '@/components/ui/button'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Switch } from '@/components/ui/switch'
import { useSessionsStore } from '@/store/sessions-store'

const TERMINAL_PANEL_MIN_SIZE = '320px'
const AUX_PANEL_DEFAULT_SIZE = '360px'
const AUX_PANEL_MIN_SIZE = '280px'
const AUX_PANEL_MAX_SIZE = '55%'

interface WorkbenchSessionEditorProps {
  sessionId: string
  active?: boolean
}

function WorkbenchSessionEditorImpl({ sessionId, active = true }: WorkbenchSessionEditorProps) {
  const { t } = useTranslation()
  const prefersDark = usePrefersDark()
  const { reconnectSession, disconnectSession } = useWorkbenchContext()
  const [monitorExpanded, setMonitorExpanded] = useState(true)
  const session = useSessionsStore(
    (state) => state.tabs.find((tab) => tab.sessionId === sessionId) ?? null
  )
  const setAuxView = useSessionsStore((state) => state.setAuxView)
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.winsshApi.settings.get(),
    initialData: DEFAULT_APP_SETTINGS
  })
  const themesQuery = useQuery({
    queryKey: ['themes'],
    queryFn: () => window.winsshApi.themes.list()
  })
  const RemoteFilesIcon = actionIcons.openRemoteFiles
  const PortForwardIcon = actionIcons.openPortForwards
  const ReconnectIcon = actionIcons.reconnect
  const DisconnectIcon = actionIcons.disconnect

  if (!session) {
    return (
      <div className="liquid-glass-page flex h-full items-center justify-center bg-[var(--workbench-editor)] px-6">
        <div className="liquid-glass-hero max-w-md border border-[var(--workbench-border)] px-8 py-10 text-center">
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
  const resolvedTheme = resolveThemeDefinition(
    settingsQuery.data.theme,
    themesQuery.data ?? [],
    prefersDark
  )
  const terminalView = (
    <div className="h-full min-w-0">
      <TerminalPane
        active={active}
        session={session}
        settings={settingsQuery.data}
        theme={resolvedTheme}
        onReconnect={reconnectSession}
      />
    </div>
  )
  const auxPanelContent =
    auxView === 'sftp' ? (
      <SftpPanel
        session={session}
        className="liquid-glass-pane liquid-glass-panel-frame h-full overflow-hidden bg-[var(--workbench-sidebar)]"
      />
    ) : auxView === 'port-forward' ? (
      <PortForwardPanel
        session={session}
        className="liquid-glass-pane liquid-glass-panel-frame h-full overflow-hidden bg-[var(--workbench-sidebar)]"
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
    <div className="liquid-glass-page flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]">
      <div className="liquid-glass-toolbar flex min-h-[56px] shrink-0 items-center gap-3 border-b border-[var(--workbench-border)] px-3 py-2">
        <button
          type="button"
          className="min-w-0 shrink-0 rounded-md px-2 py-1 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--workbench-hover)_72%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--workbench-active)]"
          aria-label={t('workbench.sessionEditor.actions.copyIp')}
          title={t('workbench.sessionEditor.actions.copyIp')}
          onClick={() => void copyServerIp()}
        >
          <div className="truncate text-sm font-medium text-foreground">{session.serverName}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {session.host}:{session.port}
          </div>
        </button>
        <SessionResourceMonitor
          active={active}
          expanded={monitorExpanded}
          session={session}
        />
        <div className="flex shrink-0 items-center gap-2">
          <label className="flex shrink-0 items-center gap-2 rounded-md border border-[var(--workbench-border)] bg-[color-mix(in_srgb,var(--workbench-sidebar)_72%,transparent)] px-2.5 py-1.5 text-xs text-muted-foreground">
            <span>{t('workbench.sessionEditor.resourceMonitor.title')}</span>
            <Switch
              aria-label={t('workbench.sessionEditor.resourceMonitor.toggle')}
              checked={monitorExpanded}
              onCheckedChange={setMonitorExpanded}
              size="sm"
            />
          </label>
          <Button
            variant={auxView === 'sftp' ? 'secondary' : 'ghost'}
            size="sm"
            disabled={session.provisional || session.status !== 'ready'}
            onClick={() => setAuxView(session.sessionId, auxView === 'sftp' ? null : 'sftp')}
          >
            <RemoteFilesIcon className="size-4" />
            {t('workbench.sessionEditor.remoteFiles')}
          </Button>
          <Button
            variant={auxView === 'port-forward' ? 'secondary' : 'ghost'}
            size="sm"
            disabled={session.provisional}
            onClick={() =>
              setAuxView(session.sessionId, auxView === 'port-forward' ? null : 'port-forward')
            }
          >
            <PortForwardIcon className="size-4" />
            {t('workbench.sessionEditor.portForwards')}
          </Button>
          {session.status !== 'ready' && session.status !== 'connecting' ? (
            <Button variant="ghost" size="sm" onClick={() => void reconnectSession(sessionId)}>
              <ReconnectIcon className="size-4" />
              {t('common.actions.reconnect')}
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => void disconnectSession(sessionId)}>
            <DisconnectIcon className="size-4" />
            {session.status === 'connecting'
              ? t('workbench.sessionEditor.cancel')
              : t('common.actions.disconnect')}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ResizablePanelGroup className="h-full" orientation="horizontal">
          <ResizablePanel minSize={TERMINAL_PANEL_MIN_SIZE}>{terminalView}</ResizablePanel>
          {showAuxPanel ? (
            <>
              <ResizableHandle
                withHandle
                className="bg-[var(--workbench-border)] data-[resize-handle-state=drag]:bg-[var(--workbench-active)]"
              />
              <ResizablePanel
                defaultSize={AUX_PANEL_DEFAULT_SIZE}
                maxSize={AUX_PANEL_MAX_SIZE}
                minSize={AUX_PANEL_MIN_SIZE}
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
