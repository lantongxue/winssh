import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

export function useSessionEvents() {
  const { t } = useTranslation()
  const updateSessionState = useSessionsStore((state) => state.updateSessionState)
  const appendOutput = useWorkbenchStore((state) => state.appendOutput)
  const pushProblem = useWorkbenchStore((state) => state.pushProblem)
  const upsertTransfer = useWorkbenchStore((state) => state.upsertTransfer)

  useEffect(() => {
    const unsubscribeState = window.winsshApi.sessions.onStateChange((event) => {
      updateSessionState(event)
      appendOutput({
        detail: event.sessionId,
        level: event.status === 'error' ? 'error' : 'info',
        message: event.message ?? t('workbench.output.sessionStateChanged', { status: event.status })
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

    const unsubscribeError = window.winsshApi.sessions.onError((event) => {
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

    const unsubscribeExit = window.winsshApi.sessions.onExit((event) => {
      appendOutput({
        detail: `${event.code ?? t('workbench.panel.transfer.unknown')}${event.signal ? ` · ${event.signal}` : ''}`,
        level: 'warning',
        message: t('workbench.output.sessionExited', { sessionId: event.sessionId })
      })
    })

    const unsubscribeTransfer = window.winsshApi.sftp.onTransferProgress((event) => {
      upsertTransfer(event)

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

    return () => {
      unsubscribeState()
      unsubscribeError()
      unsubscribeExit()
      unsubscribeTransfer()
    }
  }, [appendOutput, pushProblem, t, updateSessionState, upsertTransfer])
}
