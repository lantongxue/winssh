import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { SYSTEM_THEME_ID } from '@shared/themes'
import { KeyRound, Languages, ShieldCheck, SlidersHorizontal, TerminalSquare } from 'lucide-react'
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
import { CredentialVault } from '@/components/credential-vault'

const settingsSections = [
  { id: 'appearance', labelKey: 'workbench.settings.sections.appearance' },
  { id: 'terminal', labelKey: 'workbench.settings.sections.terminal' },
  { id: 'security', labelKey: 'workbench.settings.sections.security' },
  { id: 'credentialVault', labelKey: 'workbench.settings.sections.credentialVault' }
] as const

const settingsSectionIcons = {
  appearance: SlidersHorizontal,
  credentialVault: KeyRound,
  security: ShieldCheck,
  terminal: TerminalSquare
} as const

const DEFAULT_SETTINGS_FORM_VALUES: SettingsFormValues = DEFAULT_APP_SETTINGS

function getTerminalFontOptions(fonts: string[] | undefined, currentValue: string) {
  return [...new Set([currentValue.trim(), ...(fonts ?? []).map((font) => font.trim())])]
    .filter(Boolean)
    .map((font) => ({ label: font, value: font }))
}

export function WorkbenchSettingsEditor() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const pushProblem = useWorkbenchStore((state) => state.pushProblem)
  const [selectedSection, setSelectedSection] =
    useState<(typeof settingsSections)[number]['id']>('appearance')
  const DeleteIcon = actionIcons.delete
  const SaveIcon = actionIcons.save
  const showSaveAction = selectedSection !== 'credentialVault'

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
  const systemFontsQuery = useQuery({
    queryKey: ['system-fonts'],
    queryFn: () => window.winsshApi.system.listFonts()
  })

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema as never),
    defaultValues: settingsQuery.data ?? DEFAULT_SETTINGS_FORM_VALUES
  })

  useEffect(() => {
    if (settingsQuery.data) {
      form.reset(settingsQuery.data)
    }
  }, [form, settingsQuery.data])

  const updateSettings = useMutation({
    mutationFn: (values: SettingsFormValues) => window.winsshApi.settings.update(values),
    onSuccess: async (settings, values) => {
      const titleBarStyleChanged =
        settingsQuery.data?.windowTitleBarStyle !== values.windowTitleBarStyle

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
  const removeKnownHost = useMutation({
    mutationFn: ({ host, port }: { host: string; port: number }) =>
      window.winsshApi.system.removeKnownHost(host, port),
    onError: (error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : t('workbench.settings.toasts.knownHostDeleteFailed')
      )
    },
    onSuccess: async (_data, variables) => {
      queryClient.setQueryData(['known-hosts'], (current: typeof knownHostsQuery.data) =>
        (current ?? []).filter(
          (item) => !(item.host === variables.host && item.port === variables.port)
        )
      )
      await queryClient.invalidateQueries({ queryKey: ['known-hosts'] })
      toast.success(
        t('workbench.settings.toasts.knownHostDeleted', {
          host: `${variables.host}:${variables.port}`
        })
      )
    }
  })

  return (
    <div className="liquid-glass-page flex h-full min-h-0 bg-[var(--workbench-editor)]">
      <aside className="liquid-glass-pane w-[220px] shrink-0 border-r border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] px-3 py-3">
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
                data-active={selectedSection === section.id}
                className={`liquid-glass-list-item flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors ${
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
        <div className="liquid-glass-hero mx-6 mt-6 border border-[var(--workbench-border)] px-6 py-5">
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
                  title:
                    typeof message === 'string'
                      ? message
                      : t('workbench.settings.validation.failed')
                })
              }
            )}
          >
            {selectedSection === 'appearance' ? (
              <section className="liquid-glass-card space-y-4 border border-[var(--workbench-border)] p-5">
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
                            <SelectItem value="native">
                              {t('common.titleBarStyle.native')}
                            </SelectItem>
                            <SelectItem value="custom">
                              {t('common.titleBarStyle.custom')}
                            </SelectItem>
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
              <section className="liquid-glass-card space-y-4 border border-[var(--workbench-border)] p-5">
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
                    render={({ field }) => {
                      const fontOptions = getTerminalFontOptions(systemFontsQuery.data, field.value)

                      return (
                        <FormItem>
                          <FormLabel>{t('workbench.settings.form.terminalFontFamily')}</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <span className="truncate" style={{ fontFamily: field.value }}>
                                  {field.value}
                                </span>
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {fontOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                  style={{ fontFamily: option.value }}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )
                    }}
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
                            <SelectItem value="bar">
                              {t('workbench.settings.cursorStyles.bar')}
                            </SelectItem>
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
                          <div className="font-medium">
                            {t('workbench.settings.form.cursorBlink.title')}
                          </div>
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
                          <div className="font-medium">
                            {t('workbench.settings.form.copyOnSelect.title')}
                          </div>
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
              <section className="liquid-glass-card space-y-4 border border-[var(--workbench-border)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <ShieldCheck className="size-4 text-primary" />
                  {t('workbench.settings.sections.security')}
                </div>
                <div className="rounded-sm border border-[var(--workbench-border)] px-4 py-4">
                  <div className="text-sm font-medium">
                    {t('workbench.settings.sections.security')}
                  </div>
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
                        <TableHead className="w-[88px] text-right">
                          {t('workbench.settings.knownHosts.actions')}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(knownHostsQuery.data ?? []).map((host) => (
                        <TableRow key={`${host.host}:${host.port}:${host.fingerprint}`}>
                          <TableCell>
                            {host.host}:{host.port}
                          </TableCell>
                          <TableCell>{host.algorithm}</TableCell>
                          <TableCell className="font-mono text-xs">{host.fingerprint}</TableCell>
                          <TableCell>{formatDateTime(host.verifiedAt)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={
                                removeKnownHost.isPending &&
                                removeKnownHost.variables?.host === host.host &&
                                removeKnownHost.variables?.port === host.port
                              }
                              onClick={() =>
                                removeKnownHost.mutate({
                                  host: host.host,
                                  port: host.port
                                })
                              }
                            >
                              <DeleteIcon className="size-4" />
                              {t('common.actions.delete')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(knownHostsQuery.data ?? []).length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="py-8 text-center text-sm text-muted-foreground"
                          >
                            {t('workbench.settings.knownHosts.empty')}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </TableBody>
                  </Table>
                </div>
              </section>
            ) : null}

            {selectedSection === 'credentialVault' ? (
              <section className="liquid-glass-card space-y-4 border border-[var(--workbench-border)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <KeyRound className="size-4 text-primary" />
                  {t('workbench.credentialVault.title')}
                </div>
                <CredentialVault />
              </section>
            ) : null}

            {showSaveAction ? (
              <div className="flex justify-end">
                <Button type="submit" disabled={updateSettings.isPending}>
                  <SaveIcon className="size-4" />
                  {t('common.actions.save')}
                </Button>
              </div>
            ) : null}
          </form>
        </Form>
      </div>
    </div>
  )
}
