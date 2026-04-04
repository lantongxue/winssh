import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { Credential, Server, ServerSecrets, ServerUpsertInput } from '@shared/types'
import { serverSchema, type ServerFormValues } from '@shared/validation'
import { actionIcons } from '@/lib/action-icons'
import { getColorStyle } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import {
  createServerEditorDocument,
  getServerEditorFormId,
  type ServerEditorDocument
} from '@/lib/workbench'
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
  credentialStorageAvailable: boolean,
  secrets?: ServerSecrets
): ServerFormValues {
  if (!server) {
    return {
      authType: 'password',
      favorite: false,
      groupId: null,
      host: '',
      name: '',
      note: '',
      passphrase: secrets?.passphrase ?? '',
      password: secrets?.password ?? '',
      port: 22,
      privateKey: secrets?.privateKey ?? '',
      rememberPassphrase: credentialStorageAvailable,
      rememberPassword: credentialStorageAvailable,
      tagIds: [],
      username: '',
      credentialId: null
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
    passphrase: secrets?.passphrase ?? '',
    password: secrets?.password ?? '',
    port: server.port,
    privateKey: secrets?.privateKey ?? '',
    rememberPassphrase: credentialStorageAvailable ? server.hasPassphrase : false,
    rememberPassword: credentialStorageAvailable ? server.hasPassword : false,
    tagIds: server.tags.map((tag) => tag.id),
    username: server.username,
    credentialId: server.credentialId ?? null
  }
}

function toPayload(
  values: ServerFormValues,
  credentialStorageAvailable: boolean,
  options: { includeSecrets?: boolean } = {}
): ServerUpsertInput {
  const includeSecrets = options.includeSecrets ?? true

  return {
    ...values,
    groupId: values.groupId || null,
    note: values.note || '',
    password: includeSecrets ? values.password : undefined,
    passphrase: includeSecrets ? values.passphrase : undefined,
    privateKey: values.privateKey?.trim() ? values.privateKey : null,
    rememberPassphrase: credentialStorageAvailable ? values.rememberPassphrase : false,
    rememberPassword: credentialStorageAvailable ? values.rememberPassword : false,
    credentialId: values.credentialId || null
  } as ServerUpsertInput
}

function buildConnectionRequest(
  serverId: string,
  values: ServerFormValues,
  credentialStorageAvailable: boolean
) {
  if (values.authType === 'password' && values.password) {
    return {
      password: values.password,
      rememberPassword: credentialStorageAvailable ? values.rememberPassword : false,
      serverId
    }
  }

  if (values.authType === 'privateKey' && values.passphrase) {
    return {
      passphrase: values.passphrase,
      rememberPassphrase: credentialStorageAvailable ? values.rememberPassphrase : false,
      serverId
    }
  }

  return undefined
}

export function WorkbenchServerEditor({ document }: { document: ServerEditorDocument }) {
  const { t } = useTranslation()
  const { connectServer, refreshWorkspaceData } = useWorkbenchContext()
  const queryClient = useQueryClient()
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
  const credentialsQuery = useQuery({
    queryKey: ['credentials'],
    queryFn: () => window.winsshApi.credentials.list()
  })

  const server = (serversQuery.data ?? []).find((item) => item.id === document.serverId) ?? null
  const credentialStorageAvailable = capabilitiesQuery.data?.credentialStorage ?? false
  const serverSecretsQuery = useQuery({
    queryKey: ['server-secrets', document.serverId],
    queryFn: () => window.winsshApi.servers.getSecrets(document.serverId as string),
    enabled: Boolean(document.serverId)
  })
  const serverSecrets = serverSecretsQuery.data
  const [secretVisible, setSecretVisible] = useState(false)

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverSchema as never),
    defaultValues: toDefaultValues(server, credentialStorageAvailable, serverSecretsQuery.data)
  })

  useEffect(() => {
    form.reset(toDefaultValues(server, credentialStorageAvailable))
  }, [credentialStorageAvailable, document.id, form, server])

  useEffect(() => {
    if (!document.serverId) {
      return
    }

    const secrets: ServerSecrets | undefined = serverSecrets
    if (!secrets) {
      return
    }

    if (!form.getFieldState('password').isDirty) {
      form.setValue('password', secrets.password ?? '', { shouldDirty: false })
    }

    if (!form.getFieldState('passphrase').isDirty) {
      form.setValue('passphrase', secrets.passphrase ?? '', { shouldDirty: false })
    }

    if (!form.getFieldState('privateKey').isDirty) {
      form.setValue('privateKey', secrets.privateKey ?? '', { shouldDirty: false })
    }
  }, [document.serverId, form, serverSecrets])

  const authType = form.watch('authType')
  const credentialId = form.watch('credentialId')
  const selectedTagIds = form.watch('tagIds')
  const isPrivateKeyAuth = authType === 'privateKey'

  // Derive selected credential object
  const credentials = credentialsQuery.data ?? []
  const selectedCredential = credentialId
    ? (credentials.find((c: Credential) => c.id === credentialId) ?? null)
    : null

  // When a credential is selected, auto-fill relevant fields as visual preview
  useEffect(() => {
    if (!selectedCredential) return
    // Request the secret content and prefill
    void window.winsshApi.credentials.getSecret(selectedCredential.id).then((secret) => {
      if (selectedCredential.kind === 'password') {
        form.setValue('password', secret.password ?? '', { shouldDirty: false })
        form.setValue('authType', 'password', { shouldDirty: false })
      } else {
        form.setValue('privateKey', secret.privateKey ?? '', { shouldDirty: false })
        form.setValue('passphrase', secret.passphrase ?? '', { shouldDirty: false })
        form.setValue('authType', 'privateKey', { shouldDirty: false })
      }
    })
  }, [form, selectedCredential])
  const credentialLabel = isPrivateKeyAuth
    ? t('workbench.serverEditor.fields.passphrase')
    : t('workbench.serverEditor.fields.password')
  const rememberLabel = isPrivateKeyAuth
    ? t('workbench.serverEditor.fields.rememberPassphrase')
    : t('workbench.serverEditor.fields.rememberPassword')
  const toggleSecretLabel = secretVisible
    ? t('workbench.serverEditor.actions.hideSecret')
    : t('workbench.serverEditor.actions.showSecret')
  const SecretToggleIcon = secretVisible ? EyeOff : Eye
  const formId = getServerEditorFormId(document.id)

  useEffect(() => {
    setSecretVisible(false)
  }, [authType, document.id])

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

  const persistServer = async (
    values: ServerFormValues,
    announce = true,
    options: { includeSecrets?: boolean } = {}
  ) => {
    const payload = toPayload(values, credentialStorageAvailable, options)
    const saved = document.serverId
      ? await window.winsshApi.servers.update(document.serverId, payload)
      : await window.winsshApi.servers.create(payload)

    if (!document.serverId) {
      replaceDocument(document.id, createServerEditorDocument(saved.id))
    }

    await Promise.all([
      refreshWorkspaceData(),
      queryClient.invalidateQueries({ queryKey: ['server-secrets', saved.id] })
    ])

    if (announce) {
      toast.success(
        t(
          document.serverId
            ? 'workbench.serverEditor.toasts.updated'
            : 'workbench.serverEditor.toasts.created'
        )
      )
    }

    return saved
  }

  const handleSave = form.handleSubmit(
    async (values) => {
      await persistServer(values)
    },
    () => reportValidationFailure()
  )

  return (
    <div className="liquid-glass-page flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]">
      <div className="liquid-glass-toolbar flex h-10 shrink-0 items-center justify-between border-b border-[var(--workbench-border)] px-3">
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
            type="submit"
            form={formId}
            variant="ghost"
            size="sm"
            disabled={form.formState.isSubmitting}
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
                  : await persistServer(values, Boolean(server), { includeSecrets: false })

              await connectServer(
                targetServer,
                buildConnectionRequest(targetServer.id, values, credentialStorageAvailable)
              )
            }}
          >
            <ConnectIcon className="size-4" />
            {t('common.actions.connect')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={form.formState.isSubmitting}
            onClick={() =>
              form.reset(
                toDefaultValues(server, credentialStorageAvailable, serverSecretsQuery.data)
              )
            }
          >
            <DiscardIcon className="size-4" />
            {t('common.actions.discard')}
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form
          id={formId}
          className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-4"
          onSubmit={handleSave}
        >
          <section className="liquid-glass-card border border-[var(--workbench-border)] px-6 py-5">
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
                      <Input
                        {...field}
                        placeholder={t('workbench.serverEditor.placeholders.name')}
                      />
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
                      <Input
                        {...field}
                        placeholder={t('workbench.serverEditor.placeholders.host')}
                      />
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

          <section className="liquid-glass-card border border-[var(--workbench-border)] px-6 py-5">
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
                        <SelectItem value="password">
                          {t('workbench.serverEditor.auth.password')}
                        </SelectItem>
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
                          <SelectValue
                            placeholder={t('workbench.serverEditor.placeholders.ungrouped')}
                          />
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
            <section className="liquid-glass-card border border-[var(--workbench-border)] px-6 py-5">
              <div className="mb-4 text-base font-semibold">
                {t('workbench.serverEditor.sections.privateKey')}
              </div>
              <FormField
                control={form.control}
                name="privateKey"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <FormLabel className="leading-none">
                        {t('workbench.serverEditor.fields.privateKeyFile')}
                      </FormLabel>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={async () => {
                          const privateKey = await window.winsshApi.system.pickPrivateKey()
                          if (privateKey) {
                            form.setValue('privateKey', privateKey, {
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
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ''}
                        rows={6}
                        className="field-sizing-fixed min-h-[8rem] resize-y font-mono text-xs leading-5"
                        placeholder={t('workbench.serverEditor.placeholders.privateKeyFile')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
          ) : null}

          <section className="liquid-glass-card border border-[var(--workbench-border)] px-6 py-5">
            <div className="mb-4 flex items-center gap-2 text-base font-semibold">
              {isPrivateKeyAuth ? (
                <KeyRound className="size-4 text-primary" />
              ) : (
                <LockKeyhole className="size-4 text-primary" />
              )}
              {t('workbench.serverEditor.fields.credentials')}
            </div>

            {/* Credential vault selector */}
            <div className="mb-4">
              <FormField
                control={form.control}
                name="credentialId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5 text-muted-foreground" />
                      {t('workbench.serverEditor.fields.credential')}
                    </FormLabel>
                    <Select
                      value={field.value ?? '__none__'}
                      onValueChange={(value) => {
                        field.onChange(value === '__none__' ? null : value)
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={t('workbench.serverEditor.placeholders.credential')}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">
                          {t('workbench.serverEditor.placeholders.credential')}
                        </SelectItem>
                        {credentials.map((credential: Credential) => (
                          <SelectItem key={credential.id} value={credential.id}>
                            <div className="flex items-center gap-2">
                              {credential.kind === 'password' ? (
                                <LockKeyhole className="size-3.5 text-blue-500" />
                              ) : (
                                <KeyRound className="size-3.5 text-amber-500" />
                              )}
                              <span>{credential.name}</span>
                              {credential.username ? (
                                <span className="text-muted-foreground text-xs">
                                  ({credential.username})
                                </span>
                              ) : null}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <FormField
                control={form.control}
                name={isPrivateKeyAuth ? 'passphrase' : 'password'}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{credentialLabel}</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          {...field}
                          type={secretVisible ? 'text' : 'password'}
                          className="pr-11"
                          placeholder={t(
                            isPrivateKeyAuth
                              ? 'workbench.serverEditor.placeholders.privateKeySecret'
                              : 'workbench.serverEditor.placeholders.savedPassword'
                          )}
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
                        aria-label={toggleSecretLabel}
                        aria-pressed={secretVisible}
                        title={toggleSecretLabel}
                        onClick={() => setSecretVisible((visible) => !visible)}
                      >
                        <SecretToggleIcon className="size-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={isPrivateKeyAuth ? 'rememberPassphrase' : 'rememberPassword'}
                render={({ field }) => (
                  <FormItem className="rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-panel)]/35 px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <div className="font-medium leading-none">{rememberLabel}</div>
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
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="liquid-glass-card border border-[var(--workbench-border)] px-6 py-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-base font-semibold">
                {t('workbench.serverEditor.sections.tags')}
              </div>
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

          <section className="liquid-glass-card border border-[var(--workbench-border)] px-6 py-5">
            <div className="mb-4 text-base font-semibold">
              {t('workbench.serverEditor.sections.note')}
            </div>
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
