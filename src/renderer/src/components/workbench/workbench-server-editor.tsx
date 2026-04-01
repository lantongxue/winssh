import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, LockKeyhole } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { Server, ServerUpsertInput } from '@shared/types'
import { serverSchema, type ServerFormValues } from '@shared/validation'
import { actionIcons } from '@/lib/action-icons'
import { getColorStyle } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { createServerEditorDocument, type ServerEditorDocument } from '@/lib/workbench'
import { useWorkbenchStore } from '@/store/workbench-store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

function toDefaultValues(
  server: Server | null,
  credentialStorageAvailable: boolean
): ServerFormValues {
  if (!server) {
    return {
      authType: 'password',
      favorite: false,
      groupId: null,
      host: '',
      name: '',
      note: '',
      passphrase: '',
      password: '',
      port: 22,
      privateKeyPath: '',
      rememberPassphrase: credentialStorageAvailable,
      rememberPassword: credentialStorageAvailable,
      tagIds: [],
      username: ''
    }
  }

  return {
    authType: server.authType,
    favorite: server.favorite,
    groupId: server.groupId,
    host: server.host,
    id: server.id,
    name: server.name,
    note: server.note ?? '',
    passphrase: '',
    password: '',
    port: server.port,
    privateKeyPath: server.privateKeyPath ?? '',
    rememberPassphrase: credentialStorageAvailable ? server.hasPassphrase : false,
    rememberPassword: credentialStorageAvailable ? server.hasPassword : false,
    tagIds: server.tags.map((tag) => tag.id),
    username: server.username
  }
}

function toPayload(values: ServerFormValues, credentialStorageAvailable: boolean): ServerUpsertInput {
  return {
    ...values,
    groupId: values.groupId || null,
    note: values.note || '',
    privateKeyPath: values.privateKeyPath || null,
    rememberPassphrase: credentialStorageAvailable ? values.rememberPassphrase : false,
    rememberPassword: credentialStorageAvailable ? values.rememberPassword : false
  } as ServerUpsertInput
}

export function WorkbenchServerEditor({ document }: { document: ServerEditorDocument }) {
  const { t } = useTranslation()
  const { connectServer, refreshWorkspaceData } = useWorkbenchContext()
  const pushProblem = useWorkbenchStore((state) => state.pushProblem)
  const replaceDocument = useWorkbenchStore((state) => state.replaceDocument)
  const SaveIcon = actionIcons.save
  const ConnectIcon = actionIcons.connect
  const DiscardIcon = actionIcons.discard
  const BrowseIcon = actionIcons.browse
  const FavoriteIcon = actionIcons.star

  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => window.winsshApi.servers.list()
  })
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: () => window.winsshApi.groups.list()
  })
  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: () => window.winsshApi.tags.list()
  })
  const capabilitiesQuery = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => window.winsshApi.system.getCapabilities()
  })

  const server = (serversQuery.data ?? []).find((item) => item.id === document.serverId) ?? null
  const credentialStorageAvailable = capabilitiesQuery.data?.credentialStorage ?? false

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverSchema as never),
    defaultValues: toDefaultValues(server, credentialStorageAvailable)
  })

  useEffect(() => {
    form.reset(toDefaultValues(server, credentialStorageAvailable))
  }, [credentialStorageAvailable, document.id, form, server])

  const authType = form.watch('authType')
  const selectedTagIds = form.watch('tagIds')
  const isPrivateKeyAuth = authType === 'privateKey'
  const credentialLabel = isPrivateKeyAuth
    ? t('workbench.serverEditor.fields.passphrase')
    : t('workbench.serverEditor.fields.password')
  const rememberLabel = isPrivateKeyAuth
    ? t('workbench.serverEditor.fields.rememberPassphrase')
    : t('workbench.serverEditor.fields.rememberPassword')

  const reportValidationFailure = () => {
    const firstMessage = Object.values(form.formState.errors)[0]?.message
    pushProblem({
      detail: server?.name ?? t('workbench.documents.serverEditor.newConnection'),
      documentId: document.id,
      id: `server-editor:${document.id}:${Date.now()}`,
      severity: 'error',
      title:
        typeof firstMessage === 'string'
          ? firstMessage
          : t('workbench.serverEditor.validation.failed')
    })
  }

  const persistServer = async (values: ServerFormValues, announce = true) => {
    const payload = toPayload(values, credentialStorageAvailable)
    const saved = document.serverId
      ? await window.winsshApi.servers.update(document.serverId, payload)
      : await window.winsshApi.servers.create(payload)

    if (!document.serverId) {
      replaceDocument(document.id, createServerEditorDocument(saved.id))
    }

    await refreshWorkspaceData()

    if (announce) {
      toast.success(
        t(document.serverId ? 'workbench.serverEditor.toasts.updated' : 'workbench.serverEditor.toasts.created')
      )
    }

    return saved
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--workbench-border)] px-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {server?.name ?? t('workbench.documents.serverEditor.newConnection')}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {server
              ? t('workbench.serverEditor.descriptions.existing', {
                  host: server.host,
                  port: server.port,
                  username: server.username
                })
              : t('workbench.serverEditor.descriptions.new')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={form.formState.isSubmitting}
            onClick={form.handleSubmit(
              async (values) => {
                await persistServer(values)
              },
              () => reportValidationFailure()
            )}
          >
            <SaveIcon className="size-4" />
            {t('common.actions.save')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={form.formState.isSubmitting}
            onClick={async () => {
              const valid = await form.trigger()

              if (!valid) {
                reportValidationFailure()
                return
              }

              const values = form.getValues()
              const targetServer =
                server && !form.formState.isDirty
                  ? server
                  : await persistServer(values, Boolean(server))

              await connectServer(targetServer)
            }}
          >
            <ConnectIcon className="size-4" />
            {t('common.actions.connect')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={form.formState.isSubmitting}
            onClick={() => form.reset(toDefaultValues(server, credentialStorageAvailable))}
          >
            <DiscardIcon className="size-4" />
            {t('common.actions.discard')}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form className="min-h-0 flex-1 overflow-auto">
          <section className="border-b border-[var(--workbench-border)] px-6 py-5">
            <div className="mb-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                {t('workbench.serverEditor.sections.basic')}
              </div>
              <div className="mt-1 text-base font-semibold">
                {t('workbench.serverEditor.sections.connection')}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workbench.serverEditor.fields.name')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('workbench.serverEditor.placeholders.name')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workbench.serverEditor.fields.host')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('workbench.serverEditor.placeholders.host')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workbench.serverEditor.fields.port')}</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" min={1} max={65535} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workbench.serverEditor.fields.username')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('workbench.serverEditor.placeholders.username')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="border-b border-[var(--workbench-border)] px-6 py-5">
            <div className="mb-4 text-base font-semibold">
              {t('workbench.serverEditor.sections.strategy')}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <FormField
                control={form.control}
                name="authType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workbench.serverEditor.fields.authType')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="password">{t('workbench.serverEditor.auth.password')}</SelectItem>
                        <SelectItem value="privateKey">
                          {t('workbench.serverEditor.auth.privateKey')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="groupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('workbench.serverEditor.fields.group')}</FormLabel>
                    <Select
                      value={field.value ?? '__none__'}
                      onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('workbench.serverEditor.placeholders.ungrouped')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          {t('workbench.serverEditor.placeholders.ungrouped')}
                        </SelectItem>
                        {(groupsQuery.data ?? []).map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="favorite"
              render={({ field }) => (
                <FormItem className="mt-4 flex items-center justify-between rounded-sm border border-[var(--workbench-border)] px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <FavoriteIcon className="size-4 text-amber-400" />
                      {t('workbench.serverEditor.fields.favoriteTitle')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('workbench.serverEditor.fields.favoriteDescription')}
                    </div>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </section>

          {isPrivateKeyAuth ? (
            <section className="border-b border-[var(--workbench-border)] px-6 py-5">
              <div className="mb-4 text-base font-semibold">
                {t('workbench.serverEditor.sections.privateKey')}
              </div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <FormField
                  control={form.control}
                  name="privateKeyPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('workbench.serverEditor.fields.privateKeyFile')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder={t('workbench.serverEditor.placeholders.privateKeyFile')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const file = await window.winsshApi.system.pickPrivateKey()
                      if (file) {
                        form.setValue('privateKeyPath', file, { shouldValidate: true })
                      }
                    }}
                  >
                    <BrowseIcon className="size-4" />
                    {t('common.actions.browse')}
                  </Button>
                </div>
              </div>
            </section>
          ) : null}

          <section className="border-b border-[var(--workbench-border)] px-6 py-5">
            <div className="mb-4 flex items-center gap-2 text-base font-semibold">
              {isPrivateKeyAuth ? (
                <KeyRound className="size-4 text-primary" />
              ) : (
                <LockKeyhole className="size-4 text-primary" />
              )}
              {t('workbench.serverEditor.fields.credentials')}
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <FormField
                control={form.control}
                name={isPrivateKeyAuth ? 'passphrase' : 'password'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{credentialLabel}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder={t(
                          isPrivateKeyAuth
                            ? 'workbench.serverEditor.placeholders.privateKeySecret'
                            : 'workbench.serverEditor.placeholders.savedPassword'
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={isPrivateKeyAuth ? 'rememberPassphrase' : 'rememberPassword'}
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-sm border border-[var(--workbench-border)] px-4 py-3">
                    <div>
                      <div className="font-medium">{rememberLabel}</div>
                      <div className="text-sm text-muted-foreground">
                        {credentialStorageAvailable
                          ? t('workbench.serverEditor.systemKeychain.available')
                          : t('workbench.serverEditor.systemKeychain.unavailable')}
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value && credentialStorageAvailable}
                        disabled={!credentialStorageAvailable}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="border-b border-[var(--workbench-border)] px-6 py-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-base font-semibold">{t('workbench.serverEditor.sections.tags')}</div>
              <Badge variant="secondary">
                {t('common.labels.selectedCount', { count: selectedTagIds.length })}
              </Badge>
            </div>
            <FormField
              control={form.control}
              name="tagIds"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {(tagsQuery.data ?? []).map((tag) => {
                        const active = field.value.includes(tag.id)
                        const style = getColorStyle(tag.color)

                        return (
                          <Button
                            key={tag.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className={cn(
                              'h-auto rounded-full px-3 py-2',
                              active ? `${style.badge} ${style.ring} ring-1` : 'bg-transparent'
                            )}
                            onClick={() => {
                              const next = active
                                ? selectedTagIds.filter((tagId) => tagId !== tag.id)
                                : [...selectedTagIds, tag.id]
                              field.onChange(next)
                            }}
                          >
                            {tag.name}
                          </Button>
                        )
                      })}
                      {(tagsQuery.data ?? []).length === 0 ? (
                        <div className="rounded-sm border border-dashed border-[var(--workbench-border)] px-3 py-4 text-sm text-muted-foreground">
                          {t('workbench.serverEditor.empty.tags')}
                        </div>
                      ) : null}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <section className="px-6 py-5">
            <div className="mb-4 text-base font-semibold">{t('workbench.serverEditor.sections.note')}</div>
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('workbench.serverEditor.fields.connectNote')}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={5}
                      placeholder={t('workbench.serverEditor.placeholders.note')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>
        </form>
      </Form>
    </div>
  )
}
