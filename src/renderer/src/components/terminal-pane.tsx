import { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, LoaderCircle, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ThemeDefinition } from '@shared/themes'
import { SESSION_CONNECTION_PHASES, type AppSettings } from '@shared/types'
import { actionIcons } from '@/lib/action-icons'
import type { SessionTab } from '@/store/sessions-store'
import { useTerminal } from '@/hooks/use-terminal'
import { Button } from '@/components/ui/button'

const MIN_CONNECTION_STAGE_DURATION_MS = 220
const CONNECTED_OVERLAY_DURATION_MS = 320
const LAST_CONNECTION_PHASE = SESSION_CONNECTION_PHASES[SESSION_CONNECTION_PHASES.length - 1]

interface TerminalPaneProps {
  session: SessionTab
  settings: AppSettings
  theme: ThemeDefinition | null
  onReconnect: (sessionId: string) => Promise<void>
}

interface ConnectingOverlayProps {
  connectionPhase: SessionTab['connectionPhase']
  connectionStages: ReadonlyArray<{
    key: (typeof SESSION_CONNECTION_PHASES)[number]
    label: string
  }>
  message: string
  mode: 'connected' | 'connecting'
  serverName: string
}

function ConnectingOverlay({
  connectionPhase,
  connectionStages,
  message,
  mode,
  serverName
}: ConnectingOverlayProps) {
  const { t } = useTranslation()
  const stageIndex = connectionStages.findIndex((stage) => stage.key === connectionPhase)
  const resolvedStageIndex =
    mode === 'connected'
      ? connectionStages.length - 1
      : stageIndex >= 0
        ? stageIndex
        : 0
  const activeStage = connectionStages[resolvedStageIndex]
  const progressValue =
    mode === 'connected'
      ? 100
      : Math.round(((resolvedStageIndex + 1) / connectionStages.length) * 100)
  const progressWidth = `${progressValue}%`

  return (
    <div className="flex items-start gap-4">
      <div className="relative mt-0.5">
        {mode === 'connecting' ? (
          <span className="absolute inset-0 rounded-full bg-[var(--terminal-overlay-accent-soft)] animate-ping" />
        ) : null}
        <span className="relative flex size-11 items-center justify-center rounded-full bg-[var(--terminal-overlay-accent-soft)] text-[var(--terminal-overlay-accent)]">
          {mode === 'connected' ? (
            <CheckCircle2 className="size-5" />
          ) : (
            <LoaderCircle className="size-5 animate-spin" />
          )}
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-1">
          <div className="font-medium text-[var(--terminal-overlay-text)]">
            {t(
              mode === 'connected'
                ? 'workbench.terminal.connected.title'
                : 'workbench.terminal.connecting.title',
              { name: serverName }
            )}
          </div>
          <div className="text-sm text-[var(--terminal-overlay-muted)]">{message}</div>
        </div>
        <div className="rounded-[calc(var(--terminal-overlay-radius)-1px)] border border-[var(--terminal-overlay-border)] bg-[color-mix(in_srgb,var(--terminal-overlay-panel)_82%,transparent)] p-3">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--terminal-overlay-label)]">
            {t('workbench.terminal.connecting.currentStage')}
          </div>
          <div className="mt-2 text-sm text-[var(--terminal-overlay-accent)]">{activeStage.label}</div>
          <div className="mt-3 space-y-2">
            {connectionStages.map((stage, index) => (
              <div key={stage.key} className="flex items-center gap-2 text-xs">
                {mode === 'connected' || index < resolvedStageIndex ? (
                  <CheckCircle2 className="size-3.5 text-[var(--terminal-overlay-accent)]" />
                ) : index === resolvedStageIndex ? (
                  <LoaderCircle className="size-3.5 animate-spin text-[var(--terminal-overlay-accent)]" />
                ) : (
                  <span className="size-3.5 rounded-full border border-[var(--terminal-overlay-step-border)]" />
                )}
                <span
                  className={
                    index <= resolvedStageIndex
                      ? 'text-[var(--terminal-overlay-text)]'
                      : 'text-[var(--terminal-overlay-label)]'
                  }
                >
                  {stage.label}
                </span>
              </div>
            ))}
          </div>
          <div
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={progressValue}
            className="mt-4 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--terminal-overlay-accent-soft)_55%,transparent)]"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-[var(--terminal-overlay-progress)] transition-[width] duration-300 ease-out"
              style={{ width: progressWidth }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function getConnectionPhaseIndex(phase: SessionTab['connectionPhase']) {
  const phaseIndex = SESSION_CONNECTION_PHASES.findIndex((currentPhase) => currentPhase === phase)
  return phaseIndex >= 0 ? phaseIndex : 0
}

export function TerminalPane({ session, settings, theme, onReconnect }: TerminalPaneProps) {
  const { t } = useTranslation()
  const connectionCycleKey = `${session.sessionId}:${session.connectionStartedAt ?? ''}`
  const activeConnectionCycleRef = useRef(connectionCycleKey)
  const completedOverlayCycleRef = useRef<string | null>(null)
  const [displayedConnectionPhase, setDisplayedConnectionPhase] = useState<
    SessionTab['connectionPhase']
  >(session.connectionPhase ?? SESSION_CONNECTION_PHASES[0])
  const [showConnectedOverlay, setShowConnectedOverlay] = useState(false)
  const terminalRef = useTerminal(
    session.provisional ? null : session.sessionId,
    settings,
    theme,
    !session.provisional
  )
  const ReconnectIcon = actionIcons.reconnect

  const connectionStages = useMemo(
    () =>
      SESSION_CONNECTION_PHASES.map((phase) => ({
        key: phase,
        label: t(`workbench.terminal.stages.${phase}`)
      })),
    [t]
  )
  const targetConnectionPhase =
    session.status === 'ready'
      ? LAST_CONNECTION_PHASE
      : session.status === 'connecting'
        ? session.connectionPhase ?? displayedConnectionPhase ?? SESSION_CONNECTION_PHASES[0]
        : null
  const shouldShowConnectedOverlay =
    showConnectedOverlay ||
    (session.status === 'ready' &&
      displayedConnectionPhase === LAST_CONNECTION_PHASE &&
      completedOverlayCycleRef.current !== connectionCycleKey)
  const overlayVisible =
    session.status === 'connecting' ||
    (session.status === 'ready' &&
      (displayedConnectionPhase !== LAST_CONNECTION_PHASE || shouldShowConnectedOverlay))

  useEffect(() => {
    if (activeConnectionCycleRef.current === connectionCycleKey) {
      return
    }

    activeConnectionCycleRef.current = connectionCycleKey
    completedOverlayCycleRef.current = null
    setDisplayedConnectionPhase(session.connectionPhase ?? SESSION_CONNECTION_PHASES[0])
    setShowConnectedOverlay(false)
  }, [connectionCycleKey, session.connectionPhase])

  useEffect(() => {
    if (!targetConnectionPhase) {
      setShowConnectedOverlay(false)
      return
    }

    const currentPhaseIndex = getConnectionPhaseIndex(displayedConnectionPhase)
    const targetPhaseIndex = getConnectionPhaseIndex(targetConnectionPhase)

    if (currentPhaseIndex < targetPhaseIndex) {
      const timeout = window.setTimeout(() => {
        setDisplayedConnectionPhase(SESSION_CONNECTION_PHASES[currentPhaseIndex + 1])
      }, MIN_CONNECTION_STAGE_DURATION_MS)

      return () => window.clearTimeout(timeout)
    }

    if (session.status !== 'ready') {
      setShowConnectedOverlay(false)
      return
    }

    if (completedOverlayCycleRef.current === connectionCycleKey) {
      return
    }

    completedOverlayCycleRef.current = connectionCycleKey
    setShowConnectedOverlay(true)
    const timeout = window.setTimeout(() => {
      setShowConnectedOverlay(false)
    }, CONNECTED_OVERLAY_DURATION_MS)

    return () => window.clearTimeout(timeout)
  }, [connectionCycleKey, displayedConnectionPhase, session.status, targetConnectionPhase])

  return (
    <div
      className="relative h-full terminal-surface"
      style={theme ? { backgroundColor: theme.terminal.background } : undefined}
    >
      <div ref={terminalRef} className="h-full w-full overflow-hidden p-2" />

      {overlayVisible ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--terminal-overlay-backdrop)]">
          <div className="flex w-[min(560px,calc(100%-2rem))] flex-col gap-4 rounded-[var(--terminal-overlay-radius)] border border-[var(--terminal-overlay-border)] bg-[var(--terminal-overlay-panel)] px-6 py-5 text-left shadow-xl">
            {shouldShowConnectedOverlay ? (
              <ConnectingOverlay
                connectionPhase={LAST_CONNECTION_PHASE}
                connectionStages={connectionStages}
                message={t('workbench.terminal.connected.defaultMessage')}
                mode="connected"
                serverName={session.serverName}
              />
            ) : (
              <ConnectingOverlay
                key={session.connectionStartedAt ?? session.sessionId}
                connectionPhase={displayedConnectionPhase}
                connectionStages={connectionStages}
                message={session.lastMessage ?? t('workbench.terminal.connecting.defaultMessage')}
                mode="connecting"
                serverName={session.serverName}
              />
            )}
          </div>
        </div>
      ) : null}

      {session.status !== 'ready' && session.status !== 'connecting' ? (
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--terminal-overlay-backdrop)]">
          <div className="flex w-[min(560px,calc(100%-2rem))] flex-col gap-4 rounded-[var(--terminal-overlay-radius)] border border-[var(--terminal-overlay-border)] bg-[var(--terminal-overlay-panel)] px-6 py-5 text-left shadow-xl">
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
            <Button onClick={() => void onReconnect(session.sessionId)}>
              <ReconnectIcon className="size-4" />
              {t('common.actions.reconnect')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
