import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { actionIcons } from '@/lib/action-icons'
import { resolveThemeDefinition } from '@/lib/theme'
import { PortForwardPanel } from '@/components/port-forward-panel'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { SftpPanel } from '@/components/sftp-panel'
import { TerminalPane } from '@/components/terminal-pane'
import { Button } from '@/components/ui/button'
import { useSessionsStore } from '@/store/sessions-store'

export function WorkbenchSessionEditor({ sessionId }: { sessionId: string }) {
  const { t } = useTranslation()
  const { reconnectSession, disconnectSession } = useWorkbenchContext()
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
      <div className="flex h-full items-center justify-center bg-[var(--workbench-editor)] px-6">
        <div className="max-w-md text-center">
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
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--workbench-border)] px-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{session.serverName}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {session.host}:{session.port}
          </div>
        </div>
        <div className="flex items-center gap-2">
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

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <TerminalPane
            session={session}
            settings={settingsQuery.data}
            theme={resolvedTheme}
            onReconnect={reconnectSession}
          />
        </div>
        {auxView && !session.provisional ? (
          <div className="w-[360px] shrink-0 border-l border-[var(--workbench-border)] bg-[var(--workbench-sidebar)]">
            {auxView === 'sftp' ? (
              <SftpPanel session={session} className="h-full bg-[var(--workbench-sidebar)]" />
            ) : null}
            {auxView === 'port-forward' ? (
              <PortForwardPanel
                session={session}
                className="h-full bg-[var(--workbench-sidebar)]"
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
