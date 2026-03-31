import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderTree, Plus, RefreshCcw, ServerCog, X } from 'lucide-react'
import type { AppSettings } from '@shared/types'
import { cn } from '@/lib/utils'
import { useSessionsStore } from '@/store/sessions-store'
import { SftpPanel } from '@/components/sftp-panel'
import { TerminalPane } from '@/components/terminal-pane'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

const statusMeta = {
  ready: { label: '就绪', dot: 'bg-emerald-500' },
  connecting: { label: '连接中', dot: 'bg-sky-500' },
  error: { label: '错误', dot: 'bg-rose-500' },
  disconnected: { label: '已断开', dot: 'bg-amber-500' }
} as const

export function SessionsPage({ settings }: { settings: AppSettings }) {
  const navigate = useNavigate()
  const tabs = useSessionsStore((state) => state.tabs)
  const activeSessionId = useSessionsStore((state) => state.activeSessionId)
  const setActiveSession = useSessionsStore((state) => state.setActiveSession)
  const replaceSession = useSessionsStore((state) => state.replaceSession)
  const removeSession = useSessionsStore((state) => state.removeSession)
  const [sftpVisible, setSftpVisible] = useState(false)

  const activeSession = useMemo(
    () => tabs.find((tab) => tab.sessionId === activeSessionId) ?? tabs[0] ?? null,
    [activeSessionId, tabs]
  )

  useEffect(() => {
    if (!activeSessionId && tabs[0]) {
      setActiveSession(tabs[0].sessionId)
    }
  }, [activeSessionId, setActiveSession, tabs])

  const handleReconnect = async (sessionId: string) => {
    const nextSession = await window.winsshApi.sessions.reconnect(sessionId)
    replaceSession(sessionId, nextSession)
  }

  const handleClose = async (sessionId: string) => {
    await window.winsshApi.sessions.disconnect(sessionId)
    if (tabs.length === 1 && tabs[0]?.sessionId === sessionId) {
      setSftpVisible(false)
    }
    removeSession(sessionId)
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      {tabs.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 bg-muted/15 px-6 text-center">
          <div className="space-y-1">
            <div className="text-lg font-semibold">还没有打开任何会话</div>
            <div className="max-w-lg text-sm text-muted-foreground">
              在服务器页发起连接后，这里会进入会话工作区，SFTP 也会跟随当前标签切换。
            </div>
          </div>
          <Button onClick={() => navigate('/servers')}>
            <Plus className="size-4" />
            去连接一台服务器
          </Button>
        </div>
      ) : (
        <>
          <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-muted/20 px-3 sm:px-4">
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-full border border-border/70 bg-background/80 px-3 shadow-xs hover:bg-background"
                onClick={() => navigate('/servers')}
              >
                <ServerCog className="size-4" />
                <span className="hidden sm:inline">服务器</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={!activeSession}
                className={cn(
                  'h-9 rounded-full border border-border/70 bg-background/80 px-3 shadow-xs hover:bg-background',
                  sftpVisible && 'border-sky-400/35 bg-sky-500/10 text-sky-700 dark:text-sky-200'
                )}
                onClick={() => setSftpVisible((current) => !current)}
              >
                <FolderTree className="size-4" />
                <span className="hidden sm:inline">SFTP</span>
              </Button>
            </div>

            <ScrollArea className="min-w-0 flex-1">
              <div className="flex w-max items-center gap-2 pr-4">
                {tabs.map((tab) => {
                  const active = tab.sessionId === activeSession?.sessionId
                  const meta = statusMeta[tab.status]

                  return (
                    <div
                      key={tab.sessionId}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        'group flex h-10 min-w-[180px] max-w-[280px] cursor-pointer items-center gap-3 rounded-2xl border px-3 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring/50',
                        active
                          ? 'border-border bg-background text-foreground shadow-xs'
                          : 'border-transparent bg-transparent text-muted-foreground hover:border-border/60 hover:bg-background/70 hover:text-foreground'
                      )}
                      onClick={() => setActiveSession(tab.sessionId)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setActiveSession(tab.sessionId)
                        }
                      }}
                    >
                      <span
                        className={cn(
                          'size-2 shrink-0 rounded-full',
                          meta.dot,
                          tab.status === 'connecting' && 'animate-pulse'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{tab.serverName}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {tab.host}:{tab.port}
                        </div>
                      </div>
                      <span className="hidden text-[11px] text-muted-foreground lg:inline">
                        {meta.label}
                      </span>
                      <button
                        type="button"
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleClose(tab.sessionId)
                        }}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>

            <div className="flex shrink-0 items-center gap-2">
              {activeSession &&
              activeSession.status !== 'ready' &&
              activeSession.status !== 'connecting' ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full border border-border/70 bg-background/80 shadow-xs hover:bg-background"
                  onClick={() => void handleReconnect(activeSession.sessionId)}
                >
                  <RefreshCcw className="size-4" />
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-full border border-border/70 bg-background/80 px-3 shadow-xs hover:bg-background"
                onClick={() => navigate('/servers')}
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">新建连接</span>
              </Button>
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.10),transparent_26%)]">
            {activeSession ? (
              <>
                <div className="flex h-full min-h-0">
                  {sftpVisible ? (
                    <div className="hidden h-full shrink-0 border-r bg-background/96 backdrop-blur md:block md:w-[300px] lg:w-[360px]">
                      <SftpPanel session={activeSession} className="h-full" />
                    </div>
                  ) : null}

                  <div className="min-w-0 flex-1">
                    <TerminalPane
                      session={activeSession}
                      settings={settings}
                      onReconnect={handleReconnect}
                    />
                  </div>
                </div>

                {sftpVisible ? (
                  <>
                    <div
                      className={cn(
                        'absolute inset-y-0 left-0 z-20 w-[min(360px,calc(100%-2.5rem))] max-w-sm border-r bg-background shadow-2xl transition-transform duration-300 md:hidden',
                        sftpVisible ? 'translate-x-0' : '-translate-x-full'
                      )}
                    >
                      <SftpPanel session={activeSession} className="h-full" />
                    </div>
                    <button
                      type="button"
                      className="absolute inset-0 z-10 bg-black/15 md:hidden"
                      onClick={() => setSftpVisible(false)}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  )
}
