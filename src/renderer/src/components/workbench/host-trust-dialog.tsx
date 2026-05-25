import { useEffect, useRef, useState } from 'react'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { HostTrustRequest } from '@shared/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { systemClient } from '@/features/system/api/system-client'

export function HostTrustDialogHost() {
  const { t } = useTranslation()
  const [request, setRequest] = useState<HostTrustRequest | null>(null)
  const respondedRef = useRef(false)

  useEffect(() => {
    return systemClient.onHostTrustRequest((req) => {
      respondedRef.current = false
      setRequest(req)
    })
  }, [])

  const kind = request?.kind ?? 'hostFirstSeen'
  const isChanged = kind === 'hostChanged'

  const title = t(
    isChanged ? 'common.hostTrust.hostChanged.title' : 'common.hostTrust.hostFirstSeen.title'
  )
  const message = t(
    isChanged ? 'common.hostTrust.hostChanged.message' : 'common.hostTrust.hostFirstSeen.message',
    { serverName: request?.serverName ?? '' }
  )
  const detail = t(
    isChanged ? 'common.hostTrust.hostChanged.detail' : 'common.hostTrust.hostFirstSeen.detail',
    {
      fingerprint: request?.fingerprint ?? '',
      knownFingerprint: request?.knownFingerprint ?? '',
      host: request?.host ?? '',
      port: String(request?.port ?? 0)
    }
  )
  const cancelLabel = t(
    isChanged ? 'common.hostTrust.hostChanged.cancel' : 'common.hostTrust.hostFirstSeen.reject'
  )
  const trustLabel = t(
    isChanged ? 'common.hostTrust.hostChanged.trust' : 'common.hostTrust.hostFirstSeen.trust'
  )

  const handleResponse = (trusted: boolean) => {
    if (respondedRef.current || !request) {
      return
    }
    respondedRef.current = true
    const { requestId } = request
    setRequest(null)
    void systemClient.respondHostTrust({ requestId, trusted })
  }

  return (
    <AlertDialog
      open={request !== null}
      onOpenChange={(open) => {
        if (!open) {
          handleResponse(false)
        }
      }}
    >
      <AlertDialogContent
        className="max-w-md rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl"
      >
        <AlertDialogHeader className="border-b border-[var(--workbench-border)] px-4 py-4">
          <AlertDialogTitle className="flex items-center gap-2">
            {isChanged ? (
              <ShieldAlert className="size-5 text-orange-500" />
            ) : (
              <ShieldCheck className="size-5 text-blue-500" />
            )}
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            <p>{message}</p>
            <pre className="mt-2 whitespace-pre-wrap text-xs font-mono opacity-80">
              {detail}
            </pre>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="border-t border-[var(--workbench-border)] px-4 py-3">
          <AlertDialogCancel asChild>
            <Button variant={isChanged ? 'destructive' : 'ghost'}>
              {cancelLabel}
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant={isChanged ? 'outline' : 'default'}
              onClick={() => handleResponse(true)}
            >
              {trustLabel}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}