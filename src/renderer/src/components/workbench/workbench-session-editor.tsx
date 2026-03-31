import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FolderTree, RefreshCcw, Unplug } from 'lucide-react'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { SftpPanel } from '@/components/sftp-panel'
import { TerminalPane } from '@/components/terminal-pane'
import { Button } from '@/components/ui/button'
import { useSessionsStore } from '@/store/sessions-store'

export function WorkbenchSessionEditor({ sessionId }: { sessionId: string }) {
  const [remoteVisible, setRemoteVisible] = useState(false)
  const { reconnectSession, disconnectSession } = useWorkbenchContext()
  const session = useSessionsStore((state) =>
    state.tabs.find((tab) => tab.sessionId === sessionId) ?? null
  )
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.winsshApi.settings.get(),
    initialData: DEFAULT_APP_SETTINGS
  })

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--workbench-editor)] px-6">
        <div className="max-w-md text-center">
          <div className="text-lg font-semibold text-foreground">该会话已经关闭</div>
          <div className="mt-2 text-sm text-muted-foreground">
            如果需要继续工作，请在 Explorer 中重新连接对应服务器。
          </div>
        </div>
      </div>
    )
  }

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
            variant={remoteVisible ? 'secondary' : 'ghost'}
            size="sm"
            disabled={session.provisional || session.status !== 'ready'}
            onClick={() => setRemoteVisible((current) => !current)}
          >
            <FolderTree className="size-4" />
            Remote Files
          </Button>
          {session.status !== 'ready' && session.status !== 'connecting' ? (
            <Button variant="ghost" size="sm" onClick={() => void reconnectSession(sessionId)}>
              <RefreshCcw className="size-4" />
              Reconnect
            </Button>
          ) : null}
          <Button variant="ghost" size="sm" onClick={() => void disconnectSession(sessionId)}>
            <Unplug className="size-4" />
            {session.status === 'connecting' ? 'Cancel' : 'Disconnect'}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <TerminalPane
            session={session}
            settings={settingsQuery.data}
            onReconnect={reconnectSession}
          />
        </div>
        {remoteVisible && !session.provisional && session.status === 'ready' ? (
          <div className="w-[360px] shrink-0 border-l border-[var(--workbench-border)] bg-[var(--workbench-sidebar)]">
            <SftpPanel session={session} className="h-full bg-[var(--workbench-sidebar)]" />
          </div>
        ) : null}
      </div>
    </div>
  )
}
