import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { FolderOpen, KeyRound, LockKeyhole, Save, Star, TerminalSquare, Undo2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import type { Server, ServerUpsertInput } from '@shared/types'
import { serverSchema, type ServerFormValues } from '@shared/validation'
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
  const { connectServer, refreshWorkspaceData } = useWorkbenchContext()
  const pushProblem = useWorkbenchStore((state) => state.pushProblem)
  const replaceDocument = useWorkbenchStore((state) => state.replaceDocument)

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
  const credentialLabel = isPrivateKeyAuth ? '私钥口令' : '密码'
  const rememberLabel = isPrivateKeyAuth ? '记住口令' : '记住密码'

  const reportValidationFailure = () => {
    const firstMessage = Object.values(form.formState.errors)[0]?.message
    pushProblem({
      detail: document.serverId ? `Server ${document.serverId}` : 'New Connection',
      documentId: document.id,
      id: `server-editor:${document.id}:${Date.now()}`,
      severity: 'error',
      title: typeof firstMessage === 'string' ? firstMessage : '服务器表单校验失败'
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
      toast.success(document.serverId ? '服务器已更新' : '服务器已创建')
    }

    return saved
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--workbench-border)] px-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">
            {server?.name ?? 'Untitled Connection'}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">
            {server ? `${server.username}@${server.host}:${server.port}` : 'New SSH connection'}
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
            <Save className="size-4" />
            Save
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
            <TerminalSquare className="size-4" />
            Connect
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={form.formState.isSubmitting}
            onClick={() => form.reset(toDefaultValues(server, credentialStorageAvailable))}
          >
            <Undo2 className="size-4" />
            Discard
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form className="min-h-0 flex-1 overflow-auto">
          <section className="border-b border-[var(--workbench-border)] px-6 py-5">
            <div className="mb-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                Basic
              </div>
              <div className="mt-1 text-base font-semibold">连接参数</div>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>名称</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Production Bastion" />
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
                    <FormLabel>主机地址</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="192.168.1.10 或 demo.example.com" />
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
                    <FormLabel>端口</FormLabel>
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
                    <FormLabel>用户名</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="root / ubuntu / admin" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </section>

          <section className="border-b border-[var(--workbench-border)] px-6 py-5">
            <div className="mb-4 text-base font-semibold">连接策略</div>
            <div className="grid gap-4 lg:grid-cols-2">
              <FormField
                control={form.control}
                name="authType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>认证方式</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="password">密码认证</SelectItem>
                        <SelectItem value="privateKey">私钥认证</SelectItem>
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
                    <FormLabel>分组</FormLabel>
                    <Select
                      value={field.value ?? '__none__'}
                      onValueChange={(value) => field.onChange(value === '__none__' ? null : value)}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="未分组" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">未分组</SelectItem>
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
                      <Star className="size-4 text-amber-400" />
                      收藏该服务器
                    </div>
                    <div className="text-sm text-muted-foreground">收藏后会在 Explorer 中优先展示。</div>
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
              <div className="mb-4 text-base font-semibold">私钥文件</div>
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                <FormField
                  control={form.control}
                  name="privateKeyPath"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>私钥文件</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ''}
                          placeholder="选择 PEM / KEY / PPK 文件"
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
                    <FolderOpen className="size-4" />
                    浏览
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
              凭据策略
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
                        placeholder={isPrivateKeyAuth ? '留空表示无口令' : '留空则沿用已保存密码'}
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
                          ? '保存到系统钥匙串，后续连接可直接复用。'
                          : '当前环境没有可用的系统钥匙串。'}
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
              <div className="text-base font-semibold">标签</div>
              <Badge variant="secondary">{selectedTagIds.length} 已选</Badge>
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
                          还没有标签，可在 Explorer 中创建。
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
            <div className="mb-4 text-base font-semibold">备注</div>
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>连接说明</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={5} placeholder="记录环境说明、跳板关系或维护信息。" />
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
