import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HardDriveDownload, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { settingsSchema, type SettingsFormValues } from '@shared/validation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

export function SettingsPage() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.winsshApi.settings.get()
  })
  const knownHostsQuery = useQuery({
    queryKey: ['known-hosts'],
    queryFn: () => window.winsshApi.system.getKnownHosts()
  })
  const capabilitiesQuery = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => window.winsshApi.system.getCapabilities()
  })

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema as never),
    defaultValues: {
      theme: 'system',
      terminalFontSize: 14,
      terminalFontFamily: 'JetBrains Mono, Consolas, monospace',
      cursorStyle: 'block',
      cursorBlink: true,
      copyOnSelect: true
    }
  })

  useEffect(() => {
    if (settingsQuery.data) {
      form.reset(settingsQuery.data)
    }
  }, [form, settingsQuery.data])

  const updateSettings = useMutation({
    mutationFn: (values: SettingsFormValues) => window.winsshApi.settings.update(values),
    onSuccess: async (settings) => {
      queryClient.setQueryData(['settings'], settings)
      toast.success('设置已保存')
    }
  })

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="min-h-0 overflow-hidden">
        <CardContent className="flex h-full flex-col p-0">
          <div className="border-b px-5 py-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <SlidersHorizontal className="size-4 text-primary" />
              终端与主题
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              控制主题模式、终端字体、光标和复制行为。
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-5 py-5">
            <Form {...form}>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit(async (values) =>
                  updateSettings.mutateAsync(values as SettingsFormValues)
                )}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="theme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>主题模式</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="system">跟随系统</SelectItem>
                            <SelectItem value="light">浅色</SelectItem>
                            <SelectItem value="dark">深色</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cursorStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>光标样式</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="block">Block</SelectItem>
                            <SelectItem value="underline">Underline</SelectItem>
                            <SelectItem value="bar">Bar</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="terminalFontSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>终端字号</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" min={10} max={24} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="terminalFontFamily"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>终端字体</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="JetBrains Mono, Consolas, monospace" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="cursorBlink"
                    render={({ field }) => (
                      <FormItem className="rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium">光标闪烁</div>
                            <div className="text-sm text-muted-foreground">
                              更容易定位当前输入位置。
                            </div>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </div>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="copyOnSelect"
                    render={({ field }) => (
                      <FormItem className="rounded-lg border bg-muted/30 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="font-medium">选中即复制</div>
                            <div className="text-sm text-muted-foreground">
                              更接近常见终端软件的交互方式。
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

                <div className="flex justify-end">
                  <Button type="submit">保存设置</Button>
                </div>
              </form>
            </Form>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="size-4 text-primary" />
              凭据安全
            </div>
            <div className="mt-2 text-sm text-muted-foreground">
              {capabilitiesQuery.data?.credentialStorage
                ? '当前环境支持系统钥匙串，密码和私钥口令会优先写入系统安全存储。'
                : '当前环境未检测到系统钥匙串，应用只保存服务器元数据，不会持久化密码或私钥口令。'}
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-0 overflow-hidden">
          <CardContent className="flex h-full flex-col p-0">
            <div className="border-b px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <HardDriveDownload className="size-4 text-primary" />
                已信任主机
              </div>
              <p className="mt-1 text-xs text-muted-foreground">记录已确认过指纹的远程主机。</p>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>地址</TableHead>
                    <TableHead>指纹</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(knownHostsQuery.data ?? []).map((host) => (
                    <TableRow key={`${host.host}:${host.port}`} className="hover:bg-muted/40">
                      <TableCell className="align-top text-sm">
                        {host.host}:{host.port}
                      </TableCell>
                      <TableCell className="align-top text-xs text-muted-foreground">
                        {host.fingerprint}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(knownHostsQuery.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="py-12 text-center text-sm text-muted-foreground"
                      >
                        还没有记录任何已信任主机。
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
