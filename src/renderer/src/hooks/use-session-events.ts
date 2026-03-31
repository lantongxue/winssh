import { useEffect } from 'react'
import { toast } from 'sonner'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'

export function useSessionEvents() {
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
        message: event.message ?? `Session state changed to ${event.status}`
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
        detail: `${event.code ?? 'unknown'}${event.signal ? ` · ${event.signal}` : ''}`,
        level: 'warning',
        message: `Session exited: ${event.sessionId}`
      })
    })

    const unsubscribeTransfer = window.winsshApi.sftp.onTransferProgress((event) => {
      upsertTransfer(event)

      if (event.status === 'completed') {
        appendOutput({
          detail: event.remotePath,
          level: 'success',
          message: `${event.direction === 'upload' ? '上传完成' : '下载完成'}: ${event.fileName}`
        })
        toast.success(
          `${event.direction === 'upload' ? '上传完成' : '下载完成'}: ${event.fileName}`
        )
      }

      if (event.status === 'error') {
        const message = event.error ?? `${event.fileName} 传输失败`
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
  }, [appendOutput, pushProblem, updateSessionState, upsertTransfer])
}
