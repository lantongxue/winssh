import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, KeyRound, LockKeyhole, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { Credential, CredentialKind } from '@shared/types'
import { credentialSchema, type CredentialFormValues } from '@shared/validation'
import { actionIcons } from '@/lib/action-icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function CredentialKindBadge({ kind }: { kind: CredentialKind }) {
  const { t } = useTranslation()
  if (kind === 'password') {
    return (
      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-blue-500/15 text-blue-500">
        <LockKeyhole className="size-3" />
        {t('workbench.credentialVault.kinds.password')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium bg-amber-500/15 text-amber-500">
      <KeyRound className="size-3" />
      {t('workbench.credentialVault.kinds.privateKey')}
    </span>
  )
}

function CredentialFormDialog({
  open,
  credential,
  onClose
}: {
  open: boolean
  credential: Credential | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const BrowseIcon = actionIcons.browse
  const [secretVisible, setSecretVisible] = useState(false)

  const form = useForm<CredentialFormValues>({
    resolver: zodResolver(credentialSchema as never),
    defaultValues: {
      name: credential?.name ?? '',
      kind: credential?.kind ?? 'password',
      username: credential?.username ?? '',
      password: '',
      privateKey: '',
      passphrase: '',
      note: credential?.note ?? ''
    }
  })

  const kind = form.watch('kind')
  const isEdit = Boolean(credential)

  const secretQuery = useQuery({
    queryKey: ['credential-secret', credential?.id],
    queryFn: () => window.winsshApi.credentials.getSecret(credential!.id),
    enabled: Boolean(credential?.id)
  })

  // Pre-fill secrets when editing
  useEffect(() => {
    if (secretQuery.data && credential) {
      form.setValue('password', secretQuery.data.password ?? '', { shouldDirty: false })
      form.setValue('privateKey', secretQuery.data.privateKey ?? '', { shouldDirty: false })
      form.setValue('passphrase', secretQuery.data.passphrase ?? '', { shouldDirty: false })
    }
  }, [credential, form, secretQuery.data])

  const saveMutation = useMutation({
    mutationFn: async (values: CredentialFormValues) => {
      if (credential) {
        return window.winsshApi.credentials.update(credential.id, values)
      }
      return window.winsshApi.credentials.create(values)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credentials'] })
      if (credential) {
        await queryClient.invalidateQueries({ queryKey: ['credential-secret', credential.id] })
      }
      toast.success(
        t(isEdit ? 'workbench.credentialVault.toasts.updated' : 'workbench.credentialVault.toasts.created')
      )
      onClose()
    }
  })

  const handleClose = () => {
    form.reset()
    setSecretVisible(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-lg bg-[var(--workbench-editor)] border-[var(--workbench-border)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            {t(isEdit ? 'workbench.credentialVault.dialog.editTitle' : 'workbench.credentialVault.dialog.createTitle')}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => saveMutation.mutateAsync(values))}
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>{t('workbench.credentialVault.fields.name')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('workbench.credentialVault.placeholders.name')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workbench.credentialVault.fields.kind')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="password">
                          {t('workbench.credentialVault.kinds.password')}
                        </SelectItem>
                        <SelectItem value="privateKey">
                          {t('workbench.credentialVault.kinds.privateKey')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {kind === 'password' ? (
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('workbench.credentialVault.fields.username')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder={t('workbench.credentialVault.placeholders.username')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            {kind === 'password' ? (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workbench.credentialVault.fields.password')}</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          type={secretVisible ? 'text' : 'password'}
                          className="pr-11"
                          placeholder={t('workbench.credentialVault.placeholders.password')}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setSecretVisible((v) => !v)}
                      >
                        {secretVisible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="privateKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('workbench.credentialVault.fields.privateKey')}</FormLabel>
                      <div className="flex gap-2 items-start">
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            rows={6}
                            className="font-mono text-xs leading-5 flex-1"
                            placeholder={t('workbench.credentialVault.placeholders.privateKey')}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className="shrink-0"
                          onClick={async () => {
                            const key = await window.winsshApi.system.pickPrivateKey()
                            if (key) {
                              form.setValue('privateKey', key, {
                                shouldDirty: true,
                                shouldValidate: true
                              })
                            }
                          }}
                        >
                          <BrowseIcon className="size-4" />
                          {t('common.actions.browse')}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="passphrase"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('workbench.credentialVault.fields.passphrase')}</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            type={secretVisible ? 'text' : 'password'}
                            className="pr-11"
                            placeholder={t('workbench.credentialVault.placeholders.passphrase')}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setSecretVisible((v) => !v)}
                        >
                          {secretVisible ? (
                            <EyeOff className="size-4" />
                          ) : (
                            <Eye className="size-4" />
                          )}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('workbench.credentialVault.fields.note')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ''}
                      rows={2}
                      placeholder={t('workbench.credentialVault.placeholders.note')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleClose}>
                {t('common.actions.cancel')}
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {t('common.actions.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteCredentialDialog({
  credential,
  onClose
}: {
  credential: Credential | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.winsshApi.credentials.delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['credentials'] })
      await queryClient.invalidateQueries({ queryKey: ['servers'] })
      toast.success(t('workbench.credentialVault.toasts.deleted'))
      onClose()
    }
  })

  if (!credential) return null

  return (
    <Dialog open={Boolean(credential)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm bg-[var(--workbench-editor)] border-[var(--workbench-border)]">
        <DialogHeader>
          <DialogTitle>{t('workbench.credentialVault.dialog.deleteTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t('workbench.credentialVault.dialog.deleteDescription', { name: credential.name })}
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={() => deleteMutation.mutate(credential.id)}
          >
            <Trash2 className="size-4" />
            {t('common.actions.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CredentialVault() {
  const { t } = useTranslation()
  const [editTarget, setEditTarget] = useState<Credential | null | 'new'>(null)
  const [deleteTarget, setDeleteTarget] = useState<Credential | null>(null)
  const EditIcon = actionIcons.edit
  const DeleteIcon = actionIcons.delete

  const credentialsQuery = useQuery({
    queryKey: ['credentials'],
    queryFn: () => window.winsshApi.credentials.list()
  })

  const credentials = credentialsQuery.data ?? []

  return (
    <div className="rounded-sm border border-[var(--workbench-border)]">
      <div className="flex items-center justify-between border-b border-[var(--workbench-border)] px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <ShieldCheck className="size-4 text-primary" />
          {t('workbench.credentialVault.title')}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditTarget('new')}
        >
          <Plus className="size-4" />
          {t('workbench.credentialVault.actions.new')}
        </Button>
      </div>

      {credentials.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          {t('workbench.credentialVault.empty')}
        </div>
      ) : (
        <div className="divide-y divide-[var(--workbench-border)]">
          {credentials.map((credential) => (
            <div
              key={credential.id}
              className="group flex items-center gap-3 px-4 py-3 hover:bg-[var(--workbench-hover)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{credential.name}</span>
                  <CredentialKindBadge kind={credential.kind} />
                </div>
                {credential.username ? (
                  <div className="mt-0.5 text-xs text-muted-foreground truncate">
                    {credential.username}
                  </div>
                ) : (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {t('workbench.credentialVault.privateKeyAuth')}
                  </div>
                )}
                {credential.note ? (
                  <div className="mt-0.5 text-xs text-muted-foreground truncate italic">
                    {credential.note}
                  </div>
                ) : null}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditTarget(credential)}
                    >
                      <EditIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('common.actions.edit')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(credential)}
                    >
                      <DeleteIcon className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('common.actions.delete')}</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}

      <CredentialFormDialog
        open={editTarget !== null}
        credential={editTarget === 'new' ? null : editTarget}
        onClose={() => setEditTarget(null)}
      />
      <DeleteCredentialDialog
        credential={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
