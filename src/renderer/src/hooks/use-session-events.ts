import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { localTerminalsClient } from '@/features/local-terminals/api/local-terminals-client'
import { portForwardsClient } from '@/features/port-forwards/api/port-forwards-client'
import { queryKeys } from '@/features/shared/query-keys'
import { sftpClient } from '@/features/sftp/api/sftp-client'
import { sessionsClient } from '@/features/sessions/api/sessions-client'
import { MIN_TRANSFER_PANEL_REVEAL_SIZE_PX } from '@/lib/workbench'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

export function useSessionEvents() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const updateLocalTerminalState = useLocalTerminalsStore((state) => state.updateTerminalState)
  const updateSessionState = useSessionsStore((state) => state.updateSessionState)
  const appendOutput = useWorkbenchStore((state) => state.appendOutput)
  const pushProblem = useWorkbenchStore((state) => state.pushProblem)
  const revealPanel = useWorkbenchStore((state) => state.revealPanel)
  const upsertTransfer = useWorkbenchStore((state) => state.upsertTransfer)

  useEffect(() => {
    const unsubscribeState = sessionsClient.onStateChange((event) => {
      updateSessionState(event)

      if (event.status === 'connecting') {
        return
      }

      appendOutput({
        detail: event.sessionId,
        level: event.status === 'error' ? 'error' : 'info',
        message:
          event.message ?? t('workbench.output.sessionStateChanged', { status: event.status })
      })

      if (event.status === 'error' && event.message) {
        pushProblem({
          detail: event.sessionId,
          documentId: `session-editor:${event.sessionId}`,
          id: `session-state:${event.sessionId}:${Date.now()}`,
          severity: 'error',
          title: event.message
        })
        toast.error(event.message)
      }
    })

    const unsubscribeError = sessionsClient.onError((event) => {
      appendOutput({
        detail: event.sessionId,
        level: 'error',
        message: event.message
      })
      pushProblem({
        detail: event.sessionId,
        documentId: `session-editor:${event.sessionId}`,
        id: `session-error:${event.sessionId}:${Date.now()}`,
        severity: 'error',
        title: event.message
      })
      toast.error(event.message)
    })

    const unsubscribeExit = sessionsClient.onExit((event) => {
      appendOutput({
        detail: `${event.code ?? t('workbench.panel.transfer.unknown')}${event.signal ? ` · ${event.signal}` : ''}`,
        level: 'warning',
        message: t('workbench.output.sessionExited', { sessionId: event.sessionId })
      })
    })

    const unsubscribeTransfer = sftpClient.onTransferProgress((event) => {
      upsertTransfer(event)

      if (event.direction === 'upload' && event.status === 'running') {
        revealPanel('transfers', { minSizePx: MIN_TRANSFER_PANEL_REVEAL_SIZE_PX })
      }

      if (event.status === 'completed') {
        const message = t(`workbench.output.${event.direction}Completed`, {
          fileName: event.fileName
        })
        appendOutput({
          detail: event.remotePath,
          level: 'success',
          message
        })
        toast.success(message)
      }

      if (event.status === 'error') {
        const message = event.error ?? `${event.fileName} ${t('workbench.panel.transfer.error')}`
        appendOutput({
          detail: event.remotePath,
          level: 'error',
          message
        })
        pushProblem({
          detail: event.remotePath,
          documentId: `session-editor:${event.sessionId}`,
          id: `transfer-error:${event.sessionId}:${event.fileName}:${Date.now()}`,
          severity: 'error',
          title: message
        })
        toast.error(message)
      }
    })

    const unsubscribePortForward = portForwardsClient.onStateChange((event) => {
      const detail = `${event.rule.bindHost}:${event.rule.bindPort} -> ${event.rule.targetHost}:${event.rule.targetPort}`

      void queryClient.invalidateQueries({ queryKey: queryKeys.portForwards(event.sessionId) })

      if (event.rule.status === 'error' && event.rule.lastError) {
        appendOutput({
          detail,
          level: 'error',
          message: event.rule.lastError
        })
        pushProblem({
          detail,
          documentId: `session-editor:${event.sessionId}`,
          id: `port-forward:${event.sessionId}:${event.rule.id}:${Date.now()}`,
          severity: 'error',
          title: event.rule.lastError
        })
        toast.error(event.rule.lastError)
        return
      }

      if (event.rule.status === 'active' && event.rule.lastError) {
        appendOutput({
          detail,
          level: 'warning',
          message: event.rule.lastError
        })
        return
      }

      if (event.rule.status === 'active') {
        appendOutput({
          detail,
          level: 'success',
          message: t('workbench.output.portForwardActive')
        })
        return
      }

      if (event.rule.status === 'stopped') {
        appendOutput({
          detail,
          level: 'info',
          message: t('workbench.output.portForwardStopped')
        })
      }
    })

    const unsubscribeLocalTerminalState = localTerminalsClient.onStateChange((event) => {
      updateLocalTerminalState(event)

      if (event.status === 'exited') {
        return
      }

      appendOutput({
        detail: event.terminalId,
        level: event.status === 'error' ? 'error' : 'info',
        message:
          event.message ?? t('workbench.output.localTerminalStateChanged', { status: event.status })
      })

      if (event.status === 'error' && event.message) {
        pushProblem({
          detail: event.terminalId,
          documentId: `local-terminal-editor:${event.terminalId}`,
          id: `local-terminal-state:${event.terminalId}:${Date.now()}`,
          severity: 'error',
          title: event.message
        })
        toast.error(event.message)
      }
    })

    const unsubscribeLocalTerminalExit = localTerminalsClient.onExit((event) => {
      appendOutput({
        detail: `${event.exitCode}${event.signal === undefined ? '' : ` · ${event.signal}`}`,
        level: 'warning',
        message: t('workbench.output.localTerminalExited', { terminalId: event.terminalId })
      })
    })

    return () => {
      unsubscribeState()
      unsubscribeError()
      unsubscribeExit()
      unsubscribeTransfer()
      unsubscribePortForward()
      unsubscribeLocalTerminalState()
      unsubscribeLocalTerminalExit()
    }
  }, [
    appendOutput,
    pushProblem,
    queryClient,
    revealPanel,
    t,
    updateLocalTerminalState,
    updateSessionState,
    upsertTransfer
  ])
}
