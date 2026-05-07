import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, LoaderCircle, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ThemeDefinition } from '@shared/themes'
import { SESSION_CONNECTION_PHASES, type AppSettings } from '@shared/types'
import { sessionsClient } from '@/features/sessions/api/sessions-client'
import { actionIcons } from '@/lib/action-icons'
import type { SessionTab } from '@/store/sessions-store'
import { TerminalSurface } from '@/components/terminal-surface'
import { Button } from '@/components/ui/button'

const MIN_CONNECTION_STAGE_DURATION_MS = 180
const CONNECTED_OVERLAY_DURATION_MS = 600
const LAST_CONNECTION_PHASE = SESSION_CONNECTION_PHASES[SESSION_CONNECTION_PHASES.length - 1]

interface TerminalPaneProps {
  session: SessionTab
  settings: AppSettings
  theme: ThemeDefinition | null
  onReconnect: (sessionId: string) => Promise<void>
  active?: boolean
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
    mode === 'connected' ? connectionStages.length - 1 : stageIndex >= 0 ? stageIndex : 0
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
          <div className="mt-2 text-sm text-[var(--terminal-overlay-accent)]">
            {activeStage.label}
          </div>
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

function TerminalPaneImpl({
  session,
  settings,
  theme,
  onReconnect,
  active = true
}: TerminalPaneProps) {
  const { t } = useTranslation()
  const connectionCycleKey = `${session.sessionId}:${session.connectionStartedAt ?? ''}`
  const activeConnectionCycleRef = useRef(connectionCycleKey)
  // 记录每个连接周期是否已完成"已连接"overlay 展示
  const completedOverlayCycleRef = useRef<string | null>(null)
  const [displayedConnectionPhase, setDisplayedConnectionPhase] = useState<
    SessionTab['connectionPhase']
  >(session.connectionPhase ?? SESSION_CONNECTION_PHASES[0])
  const [showConnectedOverlay, setShowConnectedOverlay] = useState(false)
  const transport = useMemo(
    () =>
      session.provisional
        ? null
        : {
            onData: (callback: (data: string) => void) =>
              sessionsClient.onData(session.sessionId, (event) => {
                callback(event.data)
              }),
            resize: (columns: number, rows: number) =>
              sessionsClient.resize(session.sessionId, columns, rows),
            write: (data: string) => sessionsClient.write(session.sessionId, data)
          },
    [session.provisional, session.sessionId]
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

  // 当连接周期切换（新连接 / 重连）时，重置所有显示状态
  useEffect(() => {
    if (activeConnectionCycleRef.current === connectionCycleKey) {
      return
    }

    activeConnectionCycleRef.current = connectionCycleKey
    completedOverlayCycleRef.current = null
    setDisplayedConnectionPhase(session.connectionPhase ?? SESSION_CONNECTION_PHASES[0])
    setShowConnectedOverlay(false)
  }, [connectionCycleKey, session.connectionPhase])

  // 连接中：让 displayedConnectionPhase 以最小间隔追赶 session.connectionPhase
  useEffect(() => {
    if (session.status !== 'connecting' && session.status !== 'ready') {
      return
    }

    const targetPhase =
      session.status === 'ready'
        ? LAST_CONNECTION_PHASE
        : (session.connectionPhase ?? SESSION_CONNECTION_PHASES[0])
    const currentIndex = SESSION_CONNECTION_PHASES.findIndex((p) => p === displayedConnectionPhase)
    const targetIndex = SESSION_CONNECTION_PHASES.findIndex((p) => p === targetPhase)

    if (currentIndex >= targetIndex) {
      return
    }

    const timeout = window.setTimeout(() => {
      setDisplayedConnectionPhase(SESSION_CONNECTION_PHASES[currentIndex + 1])
    }, MIN_CONNECTION_STAGE_DURATION_MS)

    return () => window.clearTimeout(timeout)
  }, [session.status, session.connectionPhase, displayedConnectionPhase])

  // 连接成功：等待阶段回放完成后显示"已连接" overlay
  useEffect(() => {
    if (session.status !== 'ready') {
      return
    }

    if (completedOverlayCycleRef.current === connectionCycleKey) {
      return
    }

    if (displayedConnectionPhase !== LAST_CONNECTION_PHASE) {
      return
    }

    completedOverlayCycleRef.current = connectionCycleKey
    setShowConnectedOverlay(true)
  }, [session.status, connectionCycleKey, displayedConnectionPhase])

  // "已连接" overlay 定时消失：独立 effect，避免被其他依赖变化打断 timer
  useEffect(() => {
    if (!showConnectedOverlay) {
      return
    }

    const timeout = window.setTimeout(() => {
      setShowConnectedOverlay(false)
    }, CONNECTED_OVERLAY_DURATION_MS)

    return () => window.clearTimeout(timeout)
  }, [showConnectedOverlay])

  // overlay 可见条件：
  // - 正在连接中
  // - 连接成功后短暂展示"已连接"
  const replayingCompletedConnection =
    session.status === 'ready' && displayedConnectionPhase !== LAST_CONNECTION_PHASE
  const overlayVisible =
    session.status === 'connecting' ||
    replayingCompletedConnection ||
    (session.status === 'ready' && showConnectedOverlay)
  const focusKey = session.status === 'ready' ? `ready:${connectionCycleKey}` : null
  return (
    <TerminalSurface
      active={active}
      enabled={!session.provisional}
      focusKey={focusKey}
      settings={settings}
      theme={theme}
      transport={transport}
    >
      {overlayVisible ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--terminal-overlay-backdrop)] backdrop-blur-[var(--terminal-overlay-backdrop-blur)]">
          <div className="flex w-[min(560px,calc(100%-2rem))] flex-col gap-4 rounded-[var(--terminal-overlay-radius)] border border-[var(--terminal-overlay-border)] bg-[var(--terminal-overlay-panel)] px-6 py-5 text-left shadow-xl">
            {showConnectedOverlay ? (
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
        <div className="absolute inset-0 flex items-center justify-center bg-[var(--terminal-overlay-backdrop)] backdrop-blur-[var(--terminal-overlay-backdrop-blur)]">
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
    </TerminalSurface>
  )
}

export const TerminalPane = memo(TerminalPaneImpl)
TerminalPane.displayName = 'TerminalPane'
