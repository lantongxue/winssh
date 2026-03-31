import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { FolderOpen, KeyRound, LockKeyhole, Star } from 'lucide-react'
import { useForm } from 'react-hook-form'
import type { Server, ServerGroup, ServerUpsertInput, Tag } from '@shared/types'
import { serverSchema, type ServerFormValues } from '@shared/validation'
import { getColorStyle } from '@/lib/colors'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

interface ServerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  server: Server | null
  groups: ServerGroup[]
  tags: Tag[]
  credentialStorageAvailable: boolean
  onSubmit: (payload: ServerUpsertInput) => Promise<void>
}

function toDefaultValues(
  server: Server | null,
  credentialStorageAvailable: boolean
): ServerFormValues {
  if (!server) {
    return {
      name: '',
      host: '',
      port: 22,
      username: '',
      authType: 'password',
      privateKeyPath: '',
      note: '',
      groupId: null,
      tagIds: [],
      favorite: false,
      password: '',
      passphrase: '',
      rememberPassword: credentialStorageAvailable,
      rememberPassphrase: credentialStorageAvailable
    }
  }

  return {
    id: server.id,
    name: server.name,
    host: server.host,
    port: server.port,
    username: server.username,
    authType: server.authType,
    privateKeyPath: server.privateKeyPath ?? '',
    note: server.note ?? '',
    groupId: server.groupId,
    tagIds: server.tags.map((tag) => tag.id),
    favorite: server.favorite,
    password: '',
    passphrase: '',
    rememberPassword: credentialStorageAvailable ? server.hasPassword : false,
    rememberPassphrase: credentialStorageAvailable ? server.hasPassphrase : false
  }
}

export function ServerFormDialog({
  open,
  onOpenChange,
  server,
  groups,
  tags,
  credentialStorageAvailable,
  onSubmit
}: ServerFormDialogProps) {
  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverSchema as never),
    defaultValues: toDefaultValues(server, credentialStorageAvailable) as ServerFormValues
  })

  useEffect(() => {
    if (open) {
      form.reset(toDefaultValues(server, credentialStorageAvailable))
    }
  }, [credentialStorageAvailable, form, open, server])

  const authType = form.watch('authType')
  const selectedTagIds = form.watch('tagIds')
  const isPrivateKeyAuth = authType === 'privateKey'
  const credentialLabel = isPrivateKeyAuth ? '私钥口令' : '密码'
  const rememberLabel = isPrivateKeyAuth ? '记住口令' : '记住密码'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(960px,calc(100vw-1rem))] max-h-[calc(100dvh-1rem)] max-w-none gap-0 rounded-2xl p-0 sm:w-[min(960px,calc(100vw-2rem))] sm:max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="shrink-0 border-b px-4 py-4 pr-14 sm:px-5">
          <DialogTitle>{server ? '编辑服务器' : '新建服务器'}</DialogTitle>
          <DialogDescription>
            维护 SSH 连接信息，并决定密码或私钥口令是否写入系统钥匙串。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={form.handleSubmit(async (values) => {
              await onSubmit({
                ...values,
                privateKeyPath: values.privateKeyPath || null,
                note: values.note || '',
                groupId: values.groupId || null,
                rememberPassword: credentialStorageAvailable ? values.rememberPassword : false,
                rememberPassphrase: credentialStorageAvailable ? values.rememberPassphrase : false
              } as ServerUpsertInput)
            })}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-3 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4">
                <section className="rounded-2xl border bg-card p-4 sm:p-5">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold">基本信息</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      填写建立 SSH 连接所需的基础参数。
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="min-w-0">
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
                        <FormItem className="min-w-0">
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
                        <FormItem className="min-w-0">
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
                        <FormItem className="min-w-0">
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

                <section className="rounded-2xl border bg-card p-4 sm:p-5">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold">连接策略</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      选择认证方式、分组归属和列表展示优先级。
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="authType"
                      render={({ field }) => (
                        <FormItem className="min-w-0">
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
                        <FormItem className="min-w-0">
                          <FormLabel>分组</FormLabel>
                          <Select
                            value={field.value ?? '__none__'}
                            onValueChange={(value) =>
                              field.onChange(value === '__none__' ? null : value)
                            }
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="未分组" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">未分组</SelectItem>
                              {groups.map((group) => (
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
                    <FormField
                      control={form.control}
                      name="favorite"
                      render={({ field }) => (
                        <FormItem className="rounded-xl border bg-muted/20 p-4 md:col-span-2">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 font-medium">
                                <Star className="size-4 text-amber-400" />
                                收藏该服务器
                              </div>
                              <div className="text-sm text-muted-foreground">
                                收藏后会在列表中优先显示，适合常用或关键主机。
                              </div>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                {isPrivateKeyAuth ? (
                  <section className="rounded-2xl border bg-card p-4 sm:p-5">
                    <div className="mb-4">
                      <h3 className="text-base font-semibold">私钥文件</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        指定用于登录的私钥文件路径。
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                      <FormField
                        control={form.control}
                        name="privateKeyPath"
                        render={({ field }) => (
                          <FormItem className="min-w-0">
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
                          className="w-full sm:w-auto"
                          onClick={async () => {
                            const file = await window.winsshApi.system.pickPrivateKey()
                            if (file) {
                              form.setValue('privateKeyPath', file, { shouldValidate: true })
                            }
                          }}
                        >
                          <FolderOpen className="mr-2 size-4" />
                          浏览
                        </Button>
                      </div>
                    </div>
                  </section>
                ) : null}

                <section className="rounded-2xl border bg-card p-4 sm:p-5">
                  <div className="mb-4 flex items-start gap-3">
                    {isPrivateKeyAuth ? (
                      <KeyRound className="mt-0.5 size-4 text-primary" />
                    ) : (
                      <LockKeyhole className="mt-0.5 size-4 text-primary" />
                    )}
                    <div>
                      <h3 className="text-base font-semibold">凭据策略</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        控制登录密钥的输入方式和保存策略。
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <FormField
                      control={form.control}
                      name={isPrivateKeyAuth ? 'passphrase' : 'password'}
                      render={({ field }) => (
                        <FormItem className="min-w-0">
                          <FormLabel>{credentialLabel}</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="password"
                              placeholder={
                                isPrivateKeyAuth
                                  ? '留空表示无口令或沿用已保存口令'
                                  : '留空则沿用已保存密码'
                              }
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
                        <FormItem className="rounded-xl border bg-muted/20 p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <FormLabel>{rememberLabel}</FormLabel>
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
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </section>

                <section className="rounded-2xl border bg-card p-4 sm:p-5">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">标签</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        可多选，用于筛选和快速识别服务器角色。
                      </p>
                    </div>
                    <Badge variant="secondary">{selectedTagIds.length} 已选</Badge>
                  </div>

                  <FormField
                    control={form.control}
                    name="tagIds"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel className="sr-only">标签</FormLabel>
                        <FormControl>
                          <div className="flex flex-wrap gap-2">
                            {tags.map((tag) => {
                              const active = field.value.includes(tag.id)
                              const style = getColorStyle(tag.color)
                              return (
                                <Button
                                  key={tag.id}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className={`h-auto max-w-full rounded-full px-3 py-2 ${
                                    active ? `${style.badge} ${style.ring} ring-1` : 'bg-muted/20'
                                  }`}
                                  onClick={() => {
                                    const next = active
                                      ? selectedTagIds.filter((tagId) => tagId !== tag.id)
                                      : [...selectedTagIds, tag.id]
                                    field.onChange(next)
                                  }}
                                >
                                  <span className="truncate">{tag.name}</span>
                                </Button>
                              )
                            })}
                            {tags.length === 0 ? (
                              <div className="w-full rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
                                还没有标签，可先在“标签管理”里创建。
                              </div>
                            ) : null}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>

                <section className="rounded-2xl border bg-card p-4 sm:p-5">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold">备注</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      记录环境说明、跳板关系或其他维护信息。
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="note"
                    render={({ field }) => (
                      <FormItem className="min-w-0">
                        <FormLabel>连接说明</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            rows={5}
                            placeholder="记录环境说明、跳板关系、用途说明等。"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </section>
              </div>
            </div>

            <div className="shrink-0 border-t px-3 py-3 sm:px-4">
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button type="submit">{server ? '保存修改' : '创建服务器'}</Button>
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
