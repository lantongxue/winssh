import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck, SlidersHorizontal, TerminalSquare } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { settingsSchema, type SettingsFormValues } from '@shared/validation'
import { useWorkbenchStore } from '@/store/workbench-store'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

const settingsSections = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'terminal', label: 'Terminal' },
  { id: 'security', label: 'Security' }
] as const

export function WorkbenchSettingsEditor() {
  const queryClient = useQueryClient()
  const pushProblem = useWorkbenchStore((state) => state.pushProblem)
  const [selectedSection, setSelectedSection] =
    useState<(typeof settingsSections)[number]['id']>('appearance')

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
      copyOnSelect: true,
      cursorBlink: true,
      cursorStyle: 'block',
      terminalFontFamily: 'JetBrains Mono, Consolas, monospace',
      terminalFontSize: 14,
      theme: 'system'
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
    <div className="flex h-full min-h-0 bg-[var(--workbench-editor)]">
      <aside className="w-[220px] shrink-0 border-r border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] px-3 py-3">
        <div className="px-2 pb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Settings
        </div>
        <div className="space-y-1">
          {settingsSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`flex w-full items-center rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${
                selectedSection === section.id
                  ? 'bg-[var(--workbench-hover)] text-foreground'
                  : 'text-muted-foreground hover:bg-[var(--workbench-hover)] hover:text-foreground'
              }`}
              onClick={() => setSelectedSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </div>
      </aside>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="border-b border-[var(--workbench-border)] px-6 py-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {selectedSection}
          </div>
          <div className="mt-1 text-xl font-semibold">Settings Editor</div>
          <p className="mt-1 text-sm text-muted-foreground">
            调整主题、终端参数和安全相关设置。
          </p>
        </div>

        <Form {...form}>
          <form
            className="space-y-6 px-6 py-6"
            onSubmit={form.handleSubmit(
              async (values) => updateSettings.mutateAsync(values),
              (errors) => {
                const message = Object.values(errors)[0]?.message
                pushProblem({
                  detail: 'Settings Editor',
                  id: `settings:${Date.now()}`,
                  severity: 'error',
                  title: typeof message === 'string' ? message : '设置表单校验失败'
                })
              }
            )}
          >
            {selectedSection === 'appearance' ? (
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <SlidersHorizontal className="size-4 text-primary" />
                  主题与界面
                </div>
                <FormField
                  control={form.control}
                  name="theme"
                  render={({ field }) => (
                    <FormItem className="max-w-sm">
                      <FormLabel>主题模式</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="system">跟随系统</SelectItem>
                          <SelectItem value="light">Light+</SelectItem>
                          <SelectItem value="dark">Dark+</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>
            ) : null}

            {selectedSection === 'terminal' ? (
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <TerminalSquare className="size-4 text-primary" />
                  终端
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
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
                          <Input {...field} />
                        </FormControl>
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
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="cursorBlink"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-sm border border-[var(--workbench-border)] px-4 py-3">
                        <div>
                          <div className="font-medium">光标闪烁</div>
                          <div className="text-sm text-muted-foreground">更容易定位当前输入位置。</div>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="copyOnSelect"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-sm border border-[var(--workbench-border)] px-4 py-3">
                        <div>
                          <div className="font-medium">选中即复制</div>
                          <div className="text-sm text-muted-foreground">更接近常见终端行为。</div>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </section>
            ) : null}

            {selectedSection === 'security' ? (
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4 text-primary" />
                  安全与信任
                </div>
                <div className="rounded-sm border border-[var(--workbench-border)] px-4 py-4">
                  <div className="text-sm font-medium">凭据安全</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {capabilitiesQuery.data?.credentialStorage
                      ? '当前环境支持系统钥匙串，密码和私钥口令会优先写入系统安全存储。'
                      : '当前环境未检测到系统钥匙串，应用不会持久化保存密码或私钥口令。'}
                  </div>
                </div>
                <div className="rounded-sm border border-[var(--workbench-border)]">
                  <div className="border-b border-[var(--workbench-border)] px-4 py-3 text-sm font-medium">
                    已信任主机
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Host</TableHead>
                        <TableHead>Algorithm</TableHead>
                        <TableHead>Fingerprint</TableHead>
                        <TableHead>Verified</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(knownHostsQuery.data ?? []).map((host) => (
                        <TableRow key={`${host.host}:${host.port}:${host.fingerprint}`}>
                          <TableCell>{host.host}:{host.port}</TableCell>
                          <TableCell>{host.algorithm}</TableCell>
                          <TableCell className="font-mono text-xs">{host.fingerprint}</TableCell>
                          <TableCell>{new Date(host.verifiedAt).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {(knownHostsQuery.data ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                            当前没有已信任主机记录。
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </section>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={updateSettings.isPending}>
                保存设置
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
