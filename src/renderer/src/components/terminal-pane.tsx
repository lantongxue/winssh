import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, LoaderCircle, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AppSettings } from '@shared/types'
import { actionIcons } from '@/lib/action-icons'
import type { SessionTab } from '@/store/sessions-store'
import { useTerminal } from '@/hooks/use-terminal'
import { Button } from '@/components/ui/button'

interface TerminalPaneProps {
  session: SessionTab
  settings: AppSettings
  onReconnect: (sessionId: string) => Promise<void>
}

export function TerminalPane({ session, settings, onReconnect }: TerminalPaneProps) {
  const { t } = useTranslation()
  const [stageIndex, setStageIndex] = useState(0)
  const terminalRef = useTerminal(
    session.provisional ? null : session.sessionId,
    settings,
    !session.provisional
  )
  const ReconnectIcon = actionIcons.reconnect

  const connectionStages = useMemo(
    () =>
      [
        t('workbench.terminal.stages.validate'),
        t('workbench.terminal.stages.handshake'),
        t('workbench.terminal.stages.prepare'),
        t('workbench.terminal.stages.attach')
      ] as const,
    [t]
  )

  useEffect(() => {
    if (session.status !== 'connecting') {
      setStageIndex(0)
      return
    }

    const timer = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % connectionStages.length)
    }, 1100)

    return () => window.clearInterval(timer)
  }, [connectionStages.length, session.sessionId, session.status])

  const activeStage = connectionStages[stageIndex]

  return (
    <div className="relative h-full terminal-surface">
      <div ref={terminalRef} className="h-full w-full overflow-hidden" />

      {session.status !== 'ready' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/45">
          <div className="flex w-[min(560px,calc(100%-2rem))] flex-col gap-4 rounded-lg border border-white/10 bg-zinc-950/95 px-6 py-5 text-left shadow-xl">
            {session.status === 'connecting' ? (
              <div className="flex items-start gap-4">
                <div className="relative mt-0.5">
                  <span className="absolute inset-0 rounded-full bg-sky-400/30 animate-ping" />
                  <span className="relative flex size-11 items-center justify-center rounded-full bg-sky-500/15 text-sky-200">
                    <LoaderCircle className="size-5 animate-spin" />
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="space-y-1">
                    <div className="font-medium text-zinc-100">
                      {t('workbench.terminal.connecting.title', { name: session.serverName })}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {session.lastMessage ?? t('workbench.terminal.connecting.defaultMessage')}
                    </div>
                  </div>
                  <div className="rounded-md border border-white/8 bg-white/3 p-3">
                    <div className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">
                      {t('workbench.terminal.connecting.currentStage')}
                    </div>
                    <div className="mt-2 text-sm text-sky-200">{activeStage}</div>
                    <div className="mt-3 space-y-2">
                      {connectionStages.map((stage, index) => (
                        <div key={stage} className="flex items-center gap-2 text-xs">
                          {index < stageIndex ? (
                            <CheckCircle2 className="size-3.5 text-emerald-300" />
                          ) : index === stageIndex ? (
                            <LoaderCircle className="size-3.5 animate-spin text-sky-300" />
                          ) : (
                            <span className="size-3.5 rounded-full border border-zinc-700" />
                          )}
                          <span className={index <= stageIndex ? 'text-zinc-200' : 'text-zinc-500'}>
                            {stage}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div className="connection-progress-bar h-full rounded-full bg-linear-to-r from-sky-400 via-cyan-400 to-sky-500" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4">
                <div className="flex size-11 items-center justify-center rounded-full bg-amber-500/12 text-amber-300">
                  <RotateCcw className="size-5" />
                </div>
                <div className="space-y-2">
                  <div className="font-medium text-zinc-100">{t('workbench.terminal.unavailable.title')}</div>
                  <div className="text-sm text-zinc-400">
                    {session.lastMessage ?? t('workbench.terminal.unavailable.defaultMessage')}
                  </div>
                </div>
              </div>
            )}
            {session.status !== 'connecting' ? (
              <Button onClick={() => void onReconnect(session.sessionId)}>
                <ReconnectIcon className="size-4" />
                {t('common.actions.reconnect')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
