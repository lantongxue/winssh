import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, LoaderCircle, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ThemeDefinition } from '@shared/themes'
import type { AppSettings } from '@shared/types'
import { actionIcons } from '@/lib/action-icons'
import type { SessionTab } from '@/store/sessions-store'
import { useTerminal } from '@/hooks/use-terminal'
import { Button } from '@/components/ui/button'

interface TerminalPaneProps {
  session: SessionTab
  settings: AppSettings
  theme: ThemeDefinition | null
  onReconnect: (sessionId: string) => Promise<void>
}

interface ConnectingOverlayProps {
  connectionStages: readonly string[]
  message: string
  serverName: string
}

function ConnectingOverlay({ connectionStages, message, serverName }: ConnectingOverlayProps) {
  const { t } = useTranslation()
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setStageIndex((current) => (current + 1) % connectionStages.length)
    }, 1100)

    return () => window.clearInterval(timer)
  }, [connectionStages.length])

  const activeStage = connectionStages[stageIndex]

  return (
    <div className="flex items-start gap-4">
      <div className="relative mt-0.5">
        <span className="absolute inset-0 rounded-full bg-[var(--terminal-overlay-accent-soft)] animate-ping" />
        <span className="relative flex size-11 items-center justify-center rounded-full bg-[var(--terminal-overlay-accent-soft)] text-[var(--terminal-overlay-accent)]">
          <LoaderCircle className="size-5 animate-spin" />
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-1">
          <div className="font-medium text-[var(--terminal-overlay-text)]">
            {t('workbench.terminal.connecting.title', { name: serverName })}
          </div>
          <div className="text-sm text-[var(--terminal-overlay-muted)]">{message}</div>
        </div>
        <div className="rounded-[calc(var(--terminal-overlay-radius)-1px)] border border-[var(--terminal-overlay-border)] bg-[color-mix(in_srgb,var(--terminal-overlay-panel)_82%,transparent)] p-3">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--terminal-overlay-label)]">
            {t('workbench.terminal.connecting.currentStage')}
          </div>
          <div className="mt-2 text-sm text-[var(--terminal-overlay-accent)]">{activeStage}</div>
          <div className="mt-3 space-y-2">
            {connectionStages.map((stage, index) => (
              <div key={stage} className="flex items-center gap-2 text-xs">
                {index < stageIndex ? (
                  <CheckCircle2 className="size-3.5 text-[var(--terminal-overlay-accent)]" />
                ) : index === stageIndex ? (
                  <LoaderCircle className="size-3.5 animate-spin text-[var(--terminal-overlay-accent)]" />
                ) : (
                  <span className="size-3.5 rounded-full border border-[var(--terminal-overlay-step-border)]" />
                )}
                <span
                  className={
                    index <= stageIndex
                      ? 'text-[var(--terminal-overlay-text)]'
                      : 'text-[var(--terminal-overlay-label)]'
                  }
                >
                  {stage}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--terminal-overlay-accent-soft)_55%,transparent)]">
            <div className="connection-progress-bar h-full rounded-full bg-[var(--terminal-overlay-progress)]" />
          </div>
        </div>
      </div>
    </div>
  )
}

export function TerminalPane({ session, settings, theme, onReconnect }: TerminalPaneProps) {
  const { t } = useTranslation()
  const terminalRef = useTerminal(
    session.provisional ? null : session.sessionId,
    settings,
    theme,
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

  return (
    <div
      className="relative h-full terminal-surface"
      style={theme ? { backgroundColor: theme.terminal.background } : undefined}
    >
      <div ref={terminalRef} className="h-full w-full overflow-hidden" />

      {session.status !== 'ready' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--terminal-overlay-backdrop)]">
          <div className="flex w-[min(560px,calc(100%-2rem))] flex-col gap-4 rounded-[var(--terminal-overlay-radius)] border border-[var(--terminal-overlay-border)] bg-[var(--terminal-overlay-panel)] px-6 py-5 text-left shadow-xl">
            {session.status === 'connecting' ? (
              <ConnectingOverlay
                key={session.connectionStartedAt ?? session.sessionId}
                connectionStages={connectionStages}
                message={session.lastMessage ?? t('workbench.terminal.connecting.defaultMessage')}
                serverName={session.serverName}
              />
            ) : (
              <div className="flex items-start gap-4">
                <div className="flex size-11 items-center justify-center rounded-full bg-[var(--terminal-overlay-warning-soft)] text-[var(--terminal-overlay-warning)]">
                  <RotateCcw className="size-5" />
                </div>
                <div className="space-y-2">
                  <div className="font-medium text-[var(--terminal-overlay-text)]">
                    {t('workbench.terminal.unavailable.title')}
                  </div>
                  <div className="text-sm text-[var(--terminal-overlay-muted)]">
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
