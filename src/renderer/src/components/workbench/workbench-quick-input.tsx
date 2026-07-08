import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatQuickConnectTarget } from '@shared/quick-connect'
import { groupsClient } from '@/features/groups/api/groups-client'
import { queryKeys } from '@/features/shared/query-keys'
import { tagsClient } from '@/features/tags/api/tags-client'
import { colorOptions, getColorStyle } from '@/lib/colors'
import { actionIcons } from '@/lib/action-icons'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

export function WorkbenchQuickInput() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    quickInput,
    closeQuickInput,
    connectQuickConnectTarget,
    refreshWorkspaceData,
    submitConnectionSecret
  } = useWorkbenchContext()
  const [secret, setSecret] = useState('')
  const [remember, setRemember] = useState(true)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(colorOptions[0] ?? 'slate')
  const [submitting, setSubmitting] = useState(false)
  const CancelIcon = actionIcons.cancel
  const ConnectIcon = actionIcons.connect
  const SaveIcon = actionIcons.save

  useEffect(() => {
    if (!quickInput) {
      return
    }

    if (quickInput.kind === 'credentials') {
      setSecret('')
      setRemember(quickInput.canRemember ? quickInput.rememberByDefault : false)
      return
    }

    setName(quickInput.initialName ?? '')
    setColor(quickInput.initialColor ?? colorOptions[0] ?? 'slate')
  }, [quickInput])

  if (!quickInput) {
    return null
  }

  const handleEntitySubmit = async () => {
    if (quickInput.kind !== 'entity' || !name.trim()) {
      return
    }

    setSubmitting(true)

    try {
      if (quickInput.entityType === 'group') {
        if (quickInput.mode === 'create') {
          await groupsClient.create({
            color,
            name: name.trim(),
            parentId: quickInput.parentId ?? null
          })
          toast.success(t('workbench.quickInput.toasts.groupCreated'))
        } else if (quickInput.entityId) {
          await groupsClient.update(quickInput.entityId, { color, name: name.trim() })
          toast.success(t('workbench.quickInput.toasts.groupUpdated'))
        }
      } else if (quickInput.mode === 'create') {
        await tagsClient.create({ color, name: name.trim() })
        toast.success(t('workbench.quickInput.toasts.tagCreated'))
      } else if (quickInput.entityId) {
        await tagsClient.update(quickInput.entityId, { color, name: name.trim() })
        toast.success(t('workbench.quickInput.toasts.tagUpdated'))
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.groups }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tags })
      ])
      await refreshWorkspaceData()
      closeQuickInput()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('workbench.quickInput.toasts.saveFailed')
      )
    } finally {
      setSubmitting(false)
    }
  }

  const isPassword = quickInput.kind === 'credentials' && quickInput.secretKind === 'password'
  const credentialTargetName =
    quickInput.kind === 'credentials'
      ? quickInput.source === 'server'
        ? quickInput.server.name
        : formatQuickConnectTarget(quickInput.target)
      : null

  return (
    <Dialog open onOpenChange={(open) => !open && !submitting && closeQuickInput()}>
      <DialogContent
        className="max-w-md rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl"
        showCloseButton={false}
      >
        {quickInput.kind === 'credentials' ? (
          <>
            <DialogHeader className="border-b border-[var(--workbench-border)] px-4 py-4">
              <DialogTitle>
                {t(
                  isPassword
                    ? 'workbench.quickInput.credentials.titles.password'
                    : 'workbench.quickInput.credentials.titles.passphrase'
                )}
              </DialogTitle>
              <DialogDescription>
                {t(
                  isPassword
                    ? 'workbench.quickInput.credentials.descriptions.password'
                    : 'workbench.quickInput.credentials.descriptions.passphrase',
                  { name: credentialTargetName }
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-4 py-4">
              {quickInput.lastErrorMessage ? (
                <div className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {quickInput.lastErrorMessage}
                </div>
              ) : null}
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t('workbench.quickInput.credentials.secretLabel')}
                </div>
                <Input
                  autoFocus
                  type="password"
                  value={secret}
                  onChange={(event) => setSecret(event.target.value)}
                  placeholder={t(
                    isPassword
                      ? 'workbench.quickInput.credentials.placeholder.password'
                      : 'workbench.quickInput.credentials.placeholder.passphrase'
                  )}
                />
              </div>
              <div className="flex items-center justify-between rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-3 py-3">
                <div>
                  <div className="text-sm font-medium">
                    {t(
                      isPassword
                        ? 'workbench.serverEditor.fields.rememberPassword'
                        : 'workbench.serverEditor.fields.rememberPassphrase'
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {t('workbench.quickInput.credentials.keychainDescription')}
                  </div>
                </div>
                <Switch checked={remember} onCheckedChange={setRemember} />
              </div>
            </div>
            <DialogFooter className="border-t border-[var(--workbench-border)] px-4 py-3">
              <Button variant="ghost" disabled={submitting} onClick={closeQuickInput}>
                <CancelIcon className="size-4" />
                {t('common.actions.cancel')}
              </Button>
              <Button
                disabled={submitting}
                onClick={async () => {
                  if (isPassword && !secret) {
                    toast.error(t('workbench.quickInput.credentials.emptyPassword'))
                    return
                  }

                  setSubmitting(true)
                  try {
                    if (quickInput.source === 'quick-connect') {
                      await connectQuickConnectTarget(
                        quickInput.target,
                        secret,
                        remember,
                        quickInput.pendingSessionId
                      )
                      return
                    }

                    await submitConnectionSecret(
                      quickInput.rootServerId,
                      quickInput.server.id,
                      quickInput.secretKind,
                      secret,
                      remember,
                      quickInput.pendingSessionId
                    )
                  } finally {
                    setSubmitting(false)
                  }
                }}
              >
                {submitting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ConnectIcon className="size-4" />
                )}
                {t('common.actions.connect')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="border-b border-[var(--workbench-border)] px-4 py-4">
              <DialogTitle>
                {t(
                  quickInput.mode === 'create'
                    ? quickInput.entityType === 'group'
                      ? 'workbench.quickInput.entity.titles.createGroup'
                      : 'workbench.quickInput.entity.titles.createTag'
                    : quickInput.entityType === 'group'
                      ? 'workbench.quickInput.entity.titles.renameGroup'
                      : 'workbench.quickInput.entity.titles.renameTag'
                )}
              </DialogTitle>
              <DialogDescription>
                {t('workbench.quickInput.entity.descriptions.create')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 px-4 py-4">
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t('common.labels.name')}
                </div>
                <Input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t(
                    quickInput.entityType === 'group'
                      ? 'workbench.quickInput.entity.placeholders.group'
                      : 'workbench.quickInput.entity.placeholders.tag'
                  )}
                />
              </div>
              <div className="space-y-2">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t('common.labels.color')}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {colorOptions.map((option) => {
                    const style = getColorStyle(option)
                    return (
                      <Button
                        key={option}
                        variant="outline"
                        size="sm"
                        className={`justify-start ${color === option ? `${style.badge} ${style.ring} ring-1` : 'bg-transparent'}`}
                        onClick={() => setColor(option)}
                      >
                        <span className={`size-2 rounded-full ${style.dot}`} />
                        <span className="capitalize">{option}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>
            </div>
            <DialogFooter className="border-t border-[var(--workbench-border)] px-4 py-3">
              <Button variant="ghost" disabled={submitting} onClick={closeQuickInput}>
                <CancelIcon className="size-4" />
                {t('common.actions.cancel')}
              </Button>
              <Button
                disabled={submitting || !name.trim()}
                onClick={() => void handleEntitySubmit()}
              >
                {submitting ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <SaveIcon className="size-4" />
                )}
                {t('common.actions.save')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
