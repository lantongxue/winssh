import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ServerIconMimeType } from '@shared/server-brands'
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import type {
  Credential,
  Server,
  ServerGroup,
  ServerSecrets,
  ServerUpsertInput,
  Tag
} from '@shared/types'
import { serverSchema, tagSchema, type ServerFormValues } from '@shared/validation'
import { credentialsClient } from '@/features/credentials/api/credentials-client'
import { groupsClient } from '@/features/groups/api/groups-client'
import { queryKeys } from '@/features/shared/query-keys'
import { serversClient } from '@/features/servers/api/servers-client'
import { systemClient } from '@/features/system/api/system-client'
import { tagsClient } from '@/features/tags/api/tags-client'
import { actionIcons } from '@/lib/action-icons'
import { ServerBrandIcon } from '@/components/server-brand-icon'
import { colorOptions, getColorStyle } from '@/lib/colors'
import { bytesToDataUrl, resolveServerBrandId } from '@/lib/server-brand'
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
import { Combobox } from '@/components/ui/combobox'
import { ComboboxChips } from '@/components/ui/combobox-chips'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

const jumpServerSchema = z
  .object({
    authType: z.enum(['password', 'privateKey']),
    host: z
      .string()
      .trim()
      .min(1, 'validation.server.host.required')
      .max(255, 'validation.server.host.max'),
    name: z
      .string()
      .trim()
      .min(1, 'validation.server.name.required')
      .max(60, 'validation.server.name.max'),
    passphrase: z.string().optional(),
    password: z.string().optional(),
    port: z.coerce
      .number<string | number>()
      .int()
      .min(1, 'validation.server.port.min')
      .max(65535, 'validation.server.port.max'),
    privateKey: z.string().optional().nullable(),
    rememberPassphrase: z.boolean().default(false),
    rememberPassword: z.boolean().default(true),
    username: z
      .string()
      .trim()
      .min(1, 'validation.server.username.required')
      .max(64, 'validation.server.username.max')
  })
  .superRefine((value, ctx) => {
    if (value.authType === 'privateKey' && !value.privateKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['privateKey'],
        message: 'validation.server.privateKey.required'
      })
    }
  })

type JumpServerFormValues = z.output<typeof jumpServerSchema>
type JumpServerFormInputValues = z.input<typeof jumpServerSchema>

function createJumpServerDefaultValues(
  credentialStorageAvailable: boolean
): JumpServerFormInputValues {
  return {
    authType: 'password',
    host: '',
    name: '',
    passphrase: '',
    password: '',
    port: 22,
    privateKey: '',
    rememberPassphrase: false,
    rememberPassword: credentialStorageAvailable,
    username: ''
  }
}

function toDefaultValues(
  server: Server | null,
  credentialStorageAvailable: boolean,
  secrets?: ServerSecrets,
  options: { initialGroupId?: string | null } = {}
): ServerFormValues {
  if (!server) {
    return {
      authType: 'password',
      favorite: false,
      groupId: options.initialGroupId ?? null,
      jumpServerId: null,
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
    jumpServerId: server.jumpServerId,
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
    jumpServerId: values.jumpServerId || null,
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
      secrets: {
        [serverId]: {
          password: values.password,
          rememberPassword: credentialStorageAvailable ? values.rememberPassword : false
        }
      },
      serverId
    }
  }

  if (values.authType === 'privateKey' && values.passphrase) {
    return {
      secrets: {
        [serverId]: {
          passphrase: values.passphrase,
          rememberPassphrase: credentialStorageAvailable ? values.rememberPassphrase : false
        }
      },
      serverId
    }
  }

  return undefined
}

const defaultTagColor = colorOptions[0] ?? 'slate'

function normalizeTagName(value: string) {
  return value.trim().toLocaleLowerCase()
}

function sortTagsByName(tags: Tag[]) {
  return [...tags].sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
  )
}

function buildGroupLabel(group: ServerGroup, groupsById: Map<string, ServerGroup>) {
  const names = [group.name]
  let parentId = group.parentId
  const visited = new Set<string>([group.id])

  while (parentId) {
    if (visited.has(parentId)) {
      break
    }
    visited.add(parentId)

    const parent = groupsById.get(parentId)
    if (!parent) {
      break
    }

    names.unshift(parent.name)
    parentId = parent.parentId
  }

  return names.join(' / ')
}

function ServerTagBadges({ tags }: { tags: Tag[] }) {
  if (tags.length === 0) {
    return null
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {tags.map((tag) => {
        const style = getColorStyle(tag.color)

        return (
          <Badge
            key={tag.id}
            variant="outline"
            className={cn('max-w-full px-2 py-0.5 text-[11px]', style.badge)}
          >
            <span className={cn('size-1.5 rounded-full', style.dot)} />
            <span className="truncate">{tag.name}</span>
          </Badge>
        )
      })}
    </div>
  )
}

type CustomIconDraft =
  | { kind: 'unchanged' }
  | { kind: 'removed' }
  | {
      kind: 'updated'
      data: Uint8Array
      dataUrl: string
      mimeType: ServerIconMimeType
    }

function createDefaultCustomIconDraft(): CustomIconDraft {
  return { kind: 'unchanged' }
}

function getCustomIconPayload(
  customIconDraft: CustomIconDraft
): Pick<ServerUpsertInput, 'customIconData' | 'customIconMimeType'> {
  if (customIconDraft.kind === 'updated') {
    return {
      customIconData: customIconDraft.data,
      customIconMimeType: customIconDraft.mimeType
    }
  }

  if (customIconDraft.kind === 'removed') {
    return {
      customIconData: null,
      customIconMimeType: null
    }
  }

  return {}
}

function getVisibleCustomIconDataUrl(
  server: Server | null,
  customIconDraft: CustomIconDraft
): string | null {
  if (customIconDraft.kind === 'updated') {
    return customIconDraft.dataUrl
  }

  if (customIconDraft.kind === 'removed') {
    return null
  }

  return server?.customIconDataUrl ?? null
}

function buildServerPayload(
  values: ServerFormValues,
  credentialStorageAvailable: boolean,
  customIconDraft: CustomIconDraft,
  options: { includeSecrets?: boolean } = {}
): ServerUpsertInput {
  return {
    ...toPayload(values, credentialStorageAvailable, options),
    ...getCustomIconPayload(customIconDraft)
  }
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
  const UploadIcon = actionIcons.upload
  const RemoveIcon = actionIcons.delete

  const serversQuery = useQuery({
    queryKey: queryKeys.servers,
    queryFn: () => serversClient.list()
  })
  const groupsQuery = useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => groupsClient.list()
  })
  const tagsQuery = useQuery({
    queryKey: queryKeys.tags,
    queryFn: () => tagsClient.list()
  })
  const capabilitiesQuery = useQuery({
    queryKey: queryKeys.capabilities,
    queryFn: () => systemClient.getCapabilities()
  })
  const credentialsQuery = useQuery({
    queryKey: queryKeys.credentials,
    queryFn: () => credentialsClient.list()
  })

  const server = (serversQuery.data ?? []).find((item) => item.id === document.serverId) ?? null
  const credentialStorageAvailable = capabilitiesQuery.data?.credentialStorage ?? false
  const serverSecretsQuery = useQuery({
    queryKey: queryKeys.serverSecrets(document.serverId as string),
    queryFn: () => serversClient.getSecrets(document.serverId as string),
    enabled: Boolean(document.serverId)
  })
  const serverSecrets = serverSecretsQuery.data
  const [secretVisible, setSecretVisible] = useState(false)
  const [tagDraftError, setTagDraftError] = useState<string | null>(null)
  const [tagDraftSubmitting, setTagDraftSubmitting] = useState(false)
  const [deletingTagId, setDeletingTagId] = useState<string | null>(null)
  const [customIconDraft, setCustomIconDraft] = useState<CustomIconDraft>(
    createDefaultCustomIconDraft()
  )

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverSchema as never),
    defaultValues: toDefaultValues(server, credentialStorageAvailable, serverSecretsQuery.data, {
      initialGroupId: document.initialGroupId
    })
  })
  const jumpServerForm = useForm<JumpServerFormInputValues, unknown, JumpServerFormValues>({
    resolver: zodResolver(jumpServerSchema),
    defaultValues: createJumpServerDefaultValues(credentialStorageAvailable)
  })

  useEffect(() => {
    form.reset(
      toDefaultValues(server, credentialStorageAvailable, undefined, {
        initialGroupId: document.initialGroupId
      })
    )
  }, [credentialStorageAvailable, document.id, document.initialGroupId, form, server])

  useEffect(() => {
    jumpServerForm.reset(createJumpServerDefaultValues(credentialStorageAvailable))
  }, [credentialStorageAvailable, jumpServerForm])

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
  const jumpServerId = form.watch('jumpServerId')
  const tags = tagsQuery.data ?? []
  const isPrivateKeyAuth = authType === 'privateKey'
  const availableJumpServers = (serversQuery.data ?? []).filter(
    (item) => item.id !== document.serverId
  )
  const selectedJumpServer = availableJumpServers.find((item) => item.id === jumpServerId) ?? null
  const groups = groupsQuery.data ?? []
  const groupsById = new Map(groups.map((group) => [group.id, group]))
  const groupOptions = [
    {
      label: t('workbench.serverEditor.placeholders.ungrouped'),
      value: '__none__'
    },
    ...groups.map((group) => ({
      label: buildGroupLabel(group, groupsById),
      value: group.id
    }))
  ]
  const tagOptions = tags.map((tag) => {
    const style = getColorStyle(tag.color)

    return {
      chipClassName: style.badge,
      chipDotClassName: style.dot,
      deleteLabel: t('workbench.serverEditor.actions.deleteTag', { name: tag.name }),
      keywords: [tag.color],
      label: tag.name,
      value: tag.id
    }
  })

  // Derive selected credential object
  const credentials = credentialsQuery.data ?? []
  const selectedCredential = credentialId
    ? (credentials.find((c: Credential) => c.id === credentialId) ?? null)
    : null
  const resolvedBrandId = resolveServerBrandId(server?.brandId)
  const visibleCustomIconDataUrl = getVisibleCustomIconDataUrl(server, customIconDraft)
  const hasCustomIconChanges = customIconDraft.kind !== 'unchanged'
  const hasVisibleCustomIcon = Boolean(visibleCustomIconDataUrl)
  const brandLabel = t(`workbench.serverEditor.brands.${resolvedBrandId}`)
  const brandDescription = hasVisibleCustomIcon
    ? t('workbench.serverEditor.descriptions.brandCustomIcon')
    : server?.brandId
      ? t('workbench.serverEditor.descriptions.brandDetected')
      : t('workbench.serverEditor.descriptions.brandPending')

  // When a credential is selected, auto-fill relevant fields as visual preview
  useEffect(() => {
    if (!selectedCredential) return
    // Request the secret content and prefill
    void credentialsClient.getSecret(selectedCredential.id).then((secret) => {
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
  const jumpServerFormId = `${formId}:jumpserver`
  const [jumpServerDialogOpen, setJumpServerDialogOpen] = useState(false)
  const [jumpSecretVisible, setJumpSecretVisible] = useState(false)
  const jumpAuthType = jumpServerForm.watch('authType')
  const isJumpPrivateKeyAuth = jumpAuthType === 'privateKey'
  const jumpSecretLabel = isJumpPrivateKeyAuth
    ? t('workbench.serverEditor.fields.passphrase')
    : t('workbench.serverEditor.fields.password')
  const jumpRememberLabel = isJumpPrivateKeyAuth
    ? t('workbench.serverEditor.fields.rememberPassphrase')
    : t('workbench.serverEditor.fields.rememberPassword')
  const JumpSecretToggleIcon = jumpSecretVisible ? EyeOff : Eye

  useEffect(() => {
    setSecretVisible(false)
  }, [authType, document.id])

  useEffect(() => {
    setJumpSecretVisible(false)
  }, [jumpAuthType])

  useEffect(() => {
    setTagDraftError(null)
    setTagDraftSubmitting(false)
  }, [document.id])

  useEffect(() => {
    setCustomIconDraft(createDefaultCustomIconDraft())
  }, [document.id, server?.customIconDataUrl, server?.id])

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

  const openJumpServerDialog = () => {
    jumpServerForm.reset(createJumpServerDefaultValues(credentialStorageAvailable))
    setJumpSecretVisible(false)
    setJumpServerDialogOpen(true)
  }

  const reportPersistenceError = (error: unknown) => {
    const message =
      error instanceof Error ? error.message : t('workbench.serverEditor.toasts.saveFailed')

    pushProblem({
      detail: server?.name ?? t('workbench.documents.serverEditor.newConnection'),
      documentId: document.id,
      id: `server-editor:${document.id}:save:${Date.now()}`,
      severity: 'error',
      title: message
    })
    toast.error(message)
  }

  const validatePayload = (payload: ServerUpsertInput) => {
    const parsed = serverSchema.safeParse(payload)
    if (parsed.success) {
      return parsed.data as ServerUpsertInput
    }

    throw new Error(
      t(parsed.error.issues[0]?.message ?? 'workbench.serverEditor.validation.failed')
    )
  }

  const handleUploadCustomIcon = async () => {
    const selectedIcon = await systemClient.pickServerIcon()
    if (!selectedIcon) {
      return
    }

    setCustomIconDraft({
      kind: 'updated',
      data: selectedIcon.data,
      dataUrl: bytesToDataUrl(selectedIcon.mimeType, selectedIcon.data),
      mimeType: selectedIcon.mimeType
    })
  }

  const resetEditor = () => {
    form.reset(
      toDefaultValues(server, credentialStorageAvailable, serverSecretsQuery.data, {
        initialGroupId: document.initialGroupId
      })
    )
    setCustomIconDraft(createDefaultCustomIconDraft())
  }

  const ensureJumpServerTag = async () => {
    const availableTags = tagsQuery.data ?? (await tagsClient.list())
    const existing = availableTags.find(
      (tag: Tag) => tag.name.trim().toLowerCase() === 'jumpserver'
    )

    if (existing) {
      return existing
    }

    return tagsClient.create({
      color: 'amber',
      name: 'jumpserver'
    })
  }

  const syncTagsQueryData = (nextTags: Tag[]) => {
    queryClient.setQueryData<Tag[]>(['tags'], sortTagsByName(nextTags))
  }

  const setSelectedTags = (nextTagIds: string[]) => {
    form.setValue('tagIds', nextTagIds, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true
    })
  }

  const selectTag = (tagId: string) => {
    const currentTagIds = form.getValues('tagIds')
    if (currentTagIds.includes(tagId)) {
      return
    }

    setSelectedTags([...currentTagIds, tagId])
  }

  const removeSelectedTag = (tagId: string) => {
    setSelectedTags(form.getValues('tagIds').filter((currentTagId) => currentTagId !== tagId))
  }

  const handleDeleteTag = async (tag: Tag) => {
    setDeletingTagId(tag.id)

    try {
      await tagsClient.delete(tag.id)
      removeSelectedTag(tag.id)
      queryClient.setQueryData<Tag[]>(['tags'], (current) =>
        sortTagsByName((current ?? []).filter((currentTag) => currentTag.id !== tag.id))
      )
      queryClient.setQueryData<Server[]>(['servers'], (current) =>
        (current ?? []).map((serverItem) => ({
          ...serverItem,
          tags: serverItem.tags.filter((serverTag) => serverTag.id !== tag.id)
        }))
      )
      await refreshWorkspaceData()
      toast.success(t('workbench.primarySidebar.toasts.tagDeleted'))
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('workbench.serverEditor.toasts.tagDeleteFailed')
      )
    } finally {
      setDeletingTagId((current) => (current === tag.id ? null : current))
    }
  }

  const handleCreateTag = async (input: string) => {
    const tagName = input.trim()
    if (!tagName) {
      return
    }

    const parsed = tagSchema.safeParse({
      color: defaultTagColor,
      name: tagName
    })
    if (!parsed.success) {
      setTagDraftError(t(parsed.error.issues[0]?.message ?? 'validation.tag.name.required'))
      return
    }

    setTagDraftSubmitting(true)

    try {
      const availableTags = tagsQuery.data ?? (await tagsClient.list())
      if (!tagsQuery.data) {
        syncTagsQueryData(availableTags)
      }

      const existing = availableTags.find(
        (tag) => normalizeTagName(tag.name) === normalizeTagName(tagName)
      )
      if (existing) {
        selectTag(existing.id)
        setTagDraftError(null)
        return
      }

      const created = await tagsClient.create(parsed.data)
      syncTagsQueryData([...availableTags, created])
      selectTag(created.id)
      setTagDraftError(null)
    } catch (error) {
      try {
        const latestTags = await tagsClient.list()
        syncTagsQueryData(latestTags)
        const matched = latestTags.find(
          (tag) => normalizeTagName(tag.name) === normalizeTagName(tagName)
        )
        if (matched) {
          selectTag(matched.id)
          setTagDraftError(null)
          return
        }
      } catch {
        // Ignore the recovery lookup and surface the original error instead.
      }

      const message =
        error instanceof Error ? error.message : t('workbench.serverEditor.toasts.tagCreateFailed')
      setTagDraftError(message)
      toast.error(message)
    } finally {
      setTagDraftSubmitting(false)
    }
  }

  const persistServer = async (
    values: ServerFormValues,
    announce = true,
    options: { includeSecrets?: boolean } = {}
  ) => {
    const payload = validatePayload(
      buildServerPayload(values, credentialStorageAvailable, customIconDraft, options)
    )
    const saved = document.serverId
      ? await serversClient.update(document.serverId, payload)
      : await serversClient.create(payload)

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

  const handleCreateJumpServer = jumpServerForm.handleSubmit(async (values) => {
    const jumpTag = await ensureJumpServerTag()
    const created = await serversClient.create({
      authType: values.authType,
      credentialId: null,
      favorite: false,
      groupId: null,
      host: values.host,
      jumpServerId: null,
      name: values.name,
      note: '',
      passphrase: values.passphrase,
      password: values.password,
      port: values.port,
      privateKey: values.privateKey?.trim() ? values.privateKey : null,
      rememberPassphrase: credentialStorageAvailable ? values.rememberPassphrase : false,
      rememberPassword: credentialStorageAvailable ? values.rememberPassword : false,
      tagIds: [jumpTag.id],
      username: values.username
    })

    form.setValue('jumpServerId', created.id, {
      shouldDirty: true,
      shouldValidate: true
    })
    setJumpServerDialogOpen(false)

    await Promise.all([
      refreshWorkspaceData(),
      queryClient.invalidateQueries({ queryKey: ['servers'] }),
      queryClient.invalidateQueries({ queryKey: ['tags'] })
    ])

    toast.success(t('workbench.serverEditor.toasts.jumpServerCreated', { name: created.name }))
  })

  const handleSave = form.handleSubmit(
    async (values) => {
      try {
        await persistServer(values)
      } catch (error) {
        reportPersistenceError(error)
      }
    },
    () => reportValidationFailure()
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--workbench-border)] px-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-panel)]/40">
            <ServerBrandIcon
              brandId={server?.brandId}
              customIconDataUrl={visibleCustomIconDataUrl}
              className="size-5 text-[var(--workbench-active)]"
            />
          </div>
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
              try {
                const valid = await form.trigger()

                if (!valid) {
                  reportValidationFailure()
                  return
                }

                const values = form.getValues()
                const targetServer =
                  server && !form.formState.isDirty && !hasCustomIconChanges
                    ? server
                    : await persistServer(values, Boolean(server), { includeSecrets: false })

                await connectServer(
                  targetServer,
                  buildConnectionRequest(targetServer.id, values, credentialStorageAvailable)
                )
              } catch (error) {
                reportPersistenceError(error)
              }
            }}
          >
            <ConnectIcon className="size-4" />
            {t('common.actions.connect')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={form.formState.isSubmitting}
            onClick={resetEditor}
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
          <section className="border border-[var(--workbench-border)] px-6 py-5">
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
              <FormField
                control={form.control}
                name="groupId"
                render={({ field }) => (
                  <FormItem className="content-start">
                    <FormLabel>{t('workbench.serverEditor.fields.group')}</FormLabel>
                    <FormControl>
                      <Combobox
                        aria-label={t('workbench.serverEditor.fields.group')}
                        className="h-9 bg-[var(--workbench-editor)] shadow-xs"
                        value={field.value ?? '__none__'}
                        options={groupOptions}
                        placeholder={t('workbench.serverEditor.placeholders.ungrouped')}
                        searchPlaceholder={t('workbench.serverEditor.fields.group')}
                        emptyText={t('workbench.serverEditor.placeholders.ungrouped')}
                        onValueChange={(value) =>
                          field.onChange(value === '__none__' ? null : value)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tagIds"
                render={({ field }) => (
                  <FormItem className="content-start">
                    <FormLabel>{t('workbench.serverEditor.fields.tags')}</FormLabel>
                    <FormControl>
                      <ComboboxChips
                        aria-label={t('workbench.serverEditor.fields.tags')}
                        className="bg-[var(--workbench-editor)]"
                        value={field.value}
                        options={tagOptions}
                        placeholder={t('workbench.serverEditor.placeholders.tag')}
                        searchPlaceholder={t('workbench.serverEditor.fields.tagInput')}
                        emptyText={t('workbench.serverEditor.empty.tags')}
                        creating={tagDraftSubmitting}
                        deletingOptionValue={deletingTagId}
                        createOptionLabel={(query) => `${t('common.actions.create')} "${query}"`}
                        onValueChange={(value) => {
                          setSelectedTags(value)
                          if (tagDraftError) {
                            setTagDraftError(null)
                          }
                        }}
                        onQueryChange={(query) => {
                          if (query && tagDraftError) {
                            setTagDraftError(null)
                          }
                        }}
                        onCreateOption={(query) => void handleCreateTag(query)}
                        onDeleteOption={(option) => {
                          const tag = tags.find((item) => item.id === option.value)
                          if (!tag) {
                            return
                          }
                          void handleDeleteTag(tag)
                        }}
                      />
                    </FormControl>
                    <FormMessage>{tagDraftError}</FormMessage>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="favorite"
              render={({ field }) => (
                <FormItem className="mt-5 flex items-center justify-between rounded-sm border border-[var(--workbench-border)] px-4 py-3">
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

          <section className="border border-[var(--workbench-border)] px-6 py-5">
            <div className="mb-4 flex items-center gap-2 text-base font-semibold">
              {isPrivateKeyAuth ? (
                <KeyRound className="size-4 text-primary" />
              ) : (
                <LockKeyhole className="size-4 text-primary" />
              )}
              {t('workbench.serverEditor.sections.credentials')}
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

            <div className="mt-4 space-y-4">
              {isPrivateKeyAuth ? (
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
                            const privateKey = await systemClient.pickPrivateKey()
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
              ) : null}
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

          <section className="border border-[var(--workbench-border)] px-6 py-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-base font-semibold">
                {t('workbench.serverEditor.fields.jumpServer')}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={openJumpServerDialog}
              >
                <ShieldCheck className="size-4" />
                {t('workbench.serverEditor.actions.createJumpServer')}
              </Button>
            </div>
            <FormField
              control={form.control}
              name="jumpServerId"
              render={({ field }) => (
                <FormItem className="gap-3">
                  <FormLabel className="sr-only">
                    {t('workbench.serverEditor.fields.jumpServer')}
                  </FormLabel>
                  <FormDescription>
                    {t('workbench.serverEditor.descriptions.jumpServer')}
                  </FormDescription>
                  <Select
                    value={field.value ?? '__none__'}
                    onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                  >
                    <FormControl>
                      <SelectTrigger className="bg-[var(--workbench-editor)]">
                        <SelectValue
                          placeholder={t('workbench.serverEditor.placeholders.jumpServer')}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">
                        {t('workbench.serverEditor.placeholders.jumpServer')}
                      </SelectItem>
                      {availableJumpServers.map((jumpServer) => (
                        <SelectItem
                          key={jumpServer.id}
                          value={jumpServer.id}
                          textValue={`${jumpServer.name} ${jumpServer.tags.map((tag) => tag.name).join(' ')}`.trim()}
                        >
                          <div className="flex w-full min-w-0 items-center gap-2">
                            <span className="truncate">{jumpServer.name}</span>
                            <ServerTagBadges tags={jumpServer.tags} />
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedJumpServer ? (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] px-3 py-2 text-sm">
                      <ShieldCheck className="size-4 text-amber-500" />
                      <span className="font-medium text-foreground">{selectedJumpServer.name}</span>
                      <ServerTagBadges tags={selectedJumpServer.tags} />
                      <span className="text-muted-foreground">
                        {t('workbench.serverEditor.descriptions.existing', {
                          host: selectedJumpServer.host,
                          port: selectedJumpServer.port,
                          username: selectedJumpServer.username
                        })}
                      </span>
                    </div>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <section className="border border-[var(--workbench-border)] px-6 py-5">
            <div className="mb-4 text-base font-semibold">
              {t('workbench.serverEditor.sections.brand')}
            </div>
            <div className="rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-panel)]/35 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)]">
                    <ServerBrandIcon
                      brandId={server?.brandId}
                      customIconDataUrl={visibleCustomIconDataUrl}
                      className="size-8 text-[var(--workbench-active)]"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">
                      {t('workbench.serverEditor.fields.brand')}
                    </div>
                    <div className="mt-1 truncate text-sm text-foreground">{brandLabel}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{brandDescription}</div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleUploadCustomIcon()}
                  >
                    <UploadIcon className="size-4" />
                    {t('common.actions.upload')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!hasVisibleCustomIcon}
                    onClick={() => setCustomIconDraft({ kind: 'removed' })}
                  >
                    <RemoveIcon className="size-4" />
                    {t('workbench.serverEditor.actions.removeCustomIcon')}
                  </Button>
                </div>
              </div>
              <FormDescription className="mt-4">
                {t('workbench.serverEditor.descriptions.brand')}
              </FormDescription>
            </div>
          </section>

          <section className="border border-[var(--workbench-border)] px-6 py-5">
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
      <Dialog
        open={jumpServerDialogOpen}
        onOpenChange={(open) => {
          if (!open && !jumpServerForm.formState.isSubmitting) {
            setJumpServerDialogOpen(false)
          }
        }}
      >
        <DialogContent
          className="max-w-2xl rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0"
          showCloseButton={false}
        >
          <DialogHeader className="border-b border-[var(--workbench-border)] px-5 py-4">
            <DialogTitle>{t('workbench.serverEditor.jumpServer.dialog.title')}</DialogTitle>
            <DialogDescription>
              {t('workbench.serverEditor.jumpServer.dialog.description')}
            </DialogDescription>
          </DialogHeader>
          <Form {...jumpServerForm}>
            <form
              id={jumpServerFormId}
              className="space-y-4 px-5 py-5"
              onSubmit={handleCreateJumpServer}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={jumpServerForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('workbench.serverEditor.fields.name')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('workbench.serverEditor.jumpServer.placeholders.name')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={jumpServerForm.control}
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
                  control={jumpServerForm.control}
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
                  control={jumpServerForm.control}
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
                  control={jumpServerForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
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

              {isJumpPrivateKeyAuth ? (
                <FormField
                  control={jumpServerForm.control}
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
                            const privateKey = await systemClient.pickPrivateKey()
                            if (privateKey) {
                              jumpServerForm.setValue('privateKey', privateKey, {
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
              ) : null}

              <div className="space-y-4 rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-panel)]/35 px-4 py-4">
                <FormField
                  control={jumpServerForm.control}
                  name={isJumpPrivateKeyAuth ? 'passphrase' : 'password'}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{jumpSecretLabel}</FormLabel>
                      <div className="relative">
                        <FormControl>
                          <Input
                            {...field}
                            type={jumpSecretVisible ? 'text' : 'password'}
                            className="pr-11"
                            placeholder={t(
                              isJumpPrivateKeyAuth
                                ? 'workbench.serverEditor.placeholders.privateKeySecret'
                                : 'workbench.serverEditor.jumpServer.placeholders.password'
                            )}
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
                          aria-label={toggleSecretLabel}
                          aria-pressed={jumpSecretVisible}
                          title={toggleSecretLabel}
                          onClick={() => setJumpSecretVisible((visible) => !visible)}
                        >
                          <JumpSecretToggleIcon className="size-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={jumpServerForm.control}
                  name={isJumpPrivateKeyAuth ? 'rememberPassphrase' : 'rememberPassword'}
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="font-medium leading-none">{jumpRememberLabel}</div>
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
            </form>
          </Form>
          <DialogFooter className="border-t border-[var(--workbench-border)] px-5 py-4">
            <Button
              variant="ghost"
              disabled={jumpServerForm.formState.isSubmitting}
              onClick={() => setJumpServerDialogOpen(false)}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button
              type="submit"
              form={jumpServerFormId}
              disabled={jumpServerForm.formState.isSubmitting}
            >
              {t('common.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
