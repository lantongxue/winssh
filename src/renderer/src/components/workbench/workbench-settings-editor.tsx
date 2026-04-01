import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { SYSTEM_THEME_ID } from '@shared/themes'
import { Languages, ShieldCheck, SlidersHorizontal, TerminalSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { settingsSchema, type SettingsFormValues } from '@shared/validation'
import { formatDateTime } from '@/i18n/format'
import { actionIcons } from '@/lib/action-icons'
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
  { id: 'appearance', labelKey: 'workbench.settings.sections.appearance' },
  { id: 'terminal', labelKey: 'workbench.settings.sections.terminal' },
  { id: 'security', labelKey: 'workbench.settings.sections.security' }
] as const

const settingsSectionIcons = {
  appearance: SlidersHorizontal,
  security: ShieldCheck,
  terminal: TerminalSquare
} as const

export function WorkbenchSettingsEditor() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const pushProblem = useWorkbenchStore((state) => state.pushProblem)
  const [selectedSection, setSelectedSection] =
    useState<(typeof settingsSections)[number]['id']>('appearance')
  const SaveIcon = actionIcons.save

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
  const themesQuery = useQuery({
    queryKey: ['themes'],
    queryFn: () => window.winsshApi.themes.list()
  })

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema as never),
    defaultValues: {
      copyOnSelect: true,
      cursorBlink: true,
      cursorStyle: 'block',
      language: 'system',
      terminalFontFamily: 'JetBrains Mono, Consolas, monospace',
      terminalFontSize: 14,
      theme: SYSTEM_THEME_ID,
      windowTitleBarStyle: 'native'
    }
  })

  useEffect(() => {
    if (settingsQuery.data) {
      form.reset(settingsQuery.data)
    }
  }, [form, settingsQuery.data])

  const updateSettings = useMutation({
    mutationFn: (values: SettingsFormValues) => window.winsshApi.settings.update(values),
    onSuccess: async (settings, values) => {
      const titleBarStyleChanged = settingsQuery.data?.windowTitleBarStyle !== values.windowTitleBarStyle

      queryClient.setQueryData(['settings'], settings)

      if (titleBarStyleChanged) {
        toast.success(t('workbench.settings.titleBar.restartTitle'), {
          action: {
            label: t('common.actions.restartNow'),
            onClick: () => void window.winsshApi.system.relaunch()
          },
          description: t('workbench.settings.titleBar.restartDescription')
        })
      } else {
        toast.success(t('workbench.settings.toasts.saved'))
      }
    }
  })

  return (
    <div className="flex h-full min-h-0 bg-[var(--workbench-editor)]">
      <aside className="w-[220px] shrink-0 border-r border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] px-3 py-3">
        <div className="px-2 pb-3 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {t('workbench.activity.settings.title')}
        </div>
        <div className="space-y-1">
          {settingsSections.map((section) => {
            const SectionIcon = settingsSectionIcons[section.id]

            return (
              <button
                key={section.id}
                type="button"
                className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${
                  selectedSection === section.id
                    ? 'bg-[var(--workbench-hover)] text-foreground'
                    : 'text-muted-foreground hover:bg-[var(--workbench-hover)] hover:text-foreground'
                }`}
                onClick={() => setSelectedSection(section.id)}
              >
                <SectionIcon className="size-4 shrink-0" />
                {t(section.labelKey)}
              </button>
            )
          })}
        </div>
      </aside>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="border-b border-[var(--workbench-border)] px-6 py-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {t(settingsSections.find((section) => section.id === selectedSection)?.labelKey ?? '')}
          </div>
          <div className="mt-1 text-xl font-semibold">{t('workbench.settings.title')}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(`workbench.settings.descriptions.${selectedSection}`)}
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
                  detail: t('workbench.settings.title'),
                  id: 'settings:validation',
                  severity: 'error',
                  title: typeof message === 'string' ? message : t('workbench.settings.validation.failed')
                })
              }
            )}
          >
            {selectedSection === 'appearance' ? (
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <SlidersHorizontal className="size-4 text-primary" />
                  {t('workbench.settings.sections.appearance')}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem className="max-w-sm">
                        <FormLabel>{t('workbench.settings.form.language')}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="system">
                              <div className="flex items-center gap-2">
                                <Languages className="size-4" />
                                {t('common.language.system')}
                              </div>
                            </SelectItem>
                            <SelectItem value="zh-CN">{t('common.language.zhCN')}</SelectItem>
                            <SelectItem value="en-US">{t('common.language.enUS')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="theme"
                    render={({ field }) => (
                      <FormItem className="max-w-sm">
                        <FormLabel>{t('workbench.settings.form.theme')}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={SYSTEM_THEME_ID}>
                              {t('common.theme.system')}
                            </SelectItem>
                            {(themesQuery.data ?? []).map((theme) => (
                              <SelectItem key={theme.id} value={theme.id}>
                                {theme.label}
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
                    name="windowTitleBarStyle"
                    render={({ field }) => (
                      <FormItem className="max-w-sm">
                        <FormLabel>{t('workbench.settings.form.titleBarStyle')}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="native">{t('common.titleBarStyle.native')}</SelectItem>
                            <SelectItem value="custom">{t('common.titleBarStyle.custom')}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>
            ) : null}

            {selectedSection === 'terminal' ? (
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <TerminalSquare className="size-4 text-primary" />
                  {t('workbench.settings.sections.terminal')}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="terminalFontSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workbench.settings.form.terminalFontSize')}</FormLabel>
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
                        <FormLabel>{t('workbench.settings.form.terminalFontFamily')}</FormLabel>
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
                        <FormLabel>{t('workbench.settings.form.cursorStyle')}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="block">
                              {t('workbench.settings.cursorStyles.block')}
                            </SelectItem>
                            <SelectItem value="underline">
                              {t('workbench.settings.cursorStyles.underline')}
                            </SelectItem>
                            <SelectItem value="bar">{t('workbench.settings.cursorStyles.bar')}</SelectItem>
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
                          <div className="font-medium">{t('workbench.settings.form.cursorBlink.title')}</div>
                          <div className="text-sm text-muted-foreground">
                            {t('workbench.settings.form.cursorBlink.description')}
                          </div>
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
                          <div className="font-medium">{t('workbench.settings.form.copyOnSelect.title')}</div>
                          <div className="text-sm text-muted-foreground">
                            {t('workbench.settings.form.copyOnSelect.description')}
                          </div>
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
                  {t('workbench.settings.sections.security')}
                </div>
                <div className="rounded-sm border border-[var(--workbench-border)] px-4 py-4">
                  <div className="text-sm font-medium">{t('workbench.settings.sections.security')}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {capabilitiesQuery.data?.credentialStorage
                      ? t('workbench.settings.security.available')
                      : t('workbench.settings.security.unavailable')}
                  </div>
                </div>
                <div className="rounded-sm border border-[var(--workbench-border)]">
                  <div className="border-b border-[var(--workbench-border)] px-4 py-3 text-sm font-medium">
                    {t('workbench.settings.knownHosts.title')}
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('workbench.settings.knownHosts.host')}</TableHead>
                        <TableHead>{t('workbench.settings.knownHosts.algorithm')}</TableHead>
                        <TableHead>{t('workbench.settings.knownHosts.fingerprint')}</TableHead>
                        <TableHead>{t('workbench.settings.knownHosts.verified')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(knownHostsQuery.data ?? []).map((host) => (
                        <TableRow key={`${host.host}:${host.port}:${host.fingerprint}`}>
                          <TableCell>{host.host}:{host.port}</TableCell>
                          <TableCell>{host.algorithm}</TableCell>
                          <TableCell className="font-mono text-xs">{host.fingerprint}</TableCell>
                          <TableCell>{formatDateTime(host.verifiedAt)}</TableCell>
                        </TableRow>
                      ))}
                      {(knownHostsQuery.data ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                            {t('workbench.settings.knownHosts.empty')}
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
                <SaveIcon className="size-4" />
                {t('common.actions.save')}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
