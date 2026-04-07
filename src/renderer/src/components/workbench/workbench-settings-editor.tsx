import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { SYSTEM_THEME_ID, type ThemeDefinition } from '@shared/themes'
import {
  Check,
  ChevronsUpDown,
  KeyRound,
  Languages,
  ShieldCheck,
  SlidersHorizontal,
  TerminalSquare
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { settingsSchema, type SettingsFormValues } from '@shared/validation'
import { formatDateTime } from '@/i18n/format'
import { getPlatform, isWindowsPlatform } from '@/lib/platform'
import { actionIcons } from '@/lib/action-icons'
import { cn } from '@/lib/utils'
import { useWorkbenchStore } from '@/store/workbench-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList
} from '@/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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

type UserThemePack = {
  pluginDisplayName: string
  pluginId: string
  themes: Array<{ id: string; label: string }>
  version: string
}

function getUserThemePacks(themes: ThemeDefinition[] | undefined): UserThemePack[] {
  const packs = new Map<string, UserThemePack>()

  for (const theme of themes ?? []) {
    if (theme.source !== 'user') {
      continue
    }

    const existingPack = packs.get(theme.pluginId)
    if (existingPack) {
      existingPack.themes.push({
        id: theme.id,
        label: theme.label
      })
      continue
    }

    packs.set(theme.pluginId, {
      pluginDisplayName: theme.pluginDisplayName,
      pluginId: theme.pluginId,
      themes: [
        {
          id: theme.id,
          label: theme.label
        }
      ],
      version: theme.version
    })
  }

  return [...packs.values()].sort((left, right) =>
    left.pluginDisplayName.localeCompare(right.pluginDisplayName)
  )
}

type TerminalFontFamilyComboboxProps = {
  value: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
}

function TerminalFontFamilyCombobox({ value, onChange, options }: TerminalFontFamilyComboboxProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const normalizedQuery = query.trim()
  const hasExactMatch = options.some(
    (option) => option.value.toLowerCase() === normalizedQuery.toLowerCase()
  )

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setQuery('')
    }
  }

  const handleSelect = (nextValue: string) => {
    onChange(nextValue)
    setOpen(false)
    setQuery('')
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <FormControl>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-transparent px-3 font-normal"
          >
            <span className="truncate text-left" style={{ fontFamily: value }}>
              {value}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
      </FormControl>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('workbench.settings.form.terminalFontFamilySearchPlaceholder')}
          />
          <CommandList className="max-h-72">
            <CommandEmpty>{t('workbench.settings.form.terminalFontFamilyEmpty')}</CommandEmpty>
            {normalizedQuery && !hasExactMatch ? (
              <CommandItem value={normalizedQuery} onSelect={() => handleSelect(normalizedQuery)}>
                <Check
                  className={cn('size-4', value === normalizedQuery ? 'opacity-100' : 'opacity-0')}
                />
                <span className="truncate">
                  {t('workbench.settings.form.terminalFontFamilyUseCustom', {
                    value: normalizedQuery
                  })}
                </span>
              </CommandItem>
            ) : null}
            {options.map((option) => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => handleSelect(option.value)}
              >
                <Check
                  className={cn('size-4', value === option.value ? 'opacity-100' : 'opacity-0')}
                />
                <span className="truncate">{option.label}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function WorkbenchSettingsEditor() {
  const { t } = useTranslation()
  const platform = getPlatform()
  const localTerminalShellOptions = isWindowsPlatform(platform)
    ? [
        { label: t('workbench.settings.localTerminalShells.cmd'), value: 'cmd' },
        { label: t('workbench.settings.localTerminalShells.powershell'), value: 'powershell' }
      ]
    : [
        { label: t('workbench.settings.localTerminalShells.bash'), value: 'bash' },
        { label: t('workbench.settings.localTerminalShells.zsh'), value: 'zsh' }
      ]
  const queryClient = useQueryClient()
  const pushProblem = useWorkbenchStore((state) => state.pushProblem)
  const [selectedSection, setSelectedSection] =
    useState<(typeof settingsSections)[number]['id']>('appearance')
  const [themePackPendingDelete, setThemePackPendingDelete] = useState<UserThemePack | null>(null)
  const DeleteIcon = actionIcons.delete
  const SaveIcon = actionIcons.save
  const UploadIcon = actionIcons.upload
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
  const userThemePacks = getUserThemePacks(themesQuery.data)

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
  const importThemePack = useMutation({
    mutationFn: () => window.winsshApi.themes.importArchive(),
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('workbench.settings.toasts.themeImportFailed')
      )
    },
    onSuccess: async (result) => {
      if (!result) {
        return
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['themes'] }),
        queryClient.invalidateQueries({ queryKey: ['settings'] })
      ])
      toast.success(
        t('workbench.settings.toasts.themeImported', {
          name: result.pluginDisplayName
        })
      )
    }
  })
  const deleteThemePack = useMutation({
    mutationFn: (pluginId: string) => window.winsshApi.themes.deletePlugin(pluginId),
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('workbench.settings.toasts.themeDeleteFailed')
      )
    },
    onSuccess: async (result) => {
      setThemePackPendingDelete(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['themes'] }),
        queryClient.invalidateQueries({ queryKey: ['settings'] })
      ])
      toast.success(
        t('workbench.settings.toasts.themeDeleted', {
          name: result.pluginDisplayName
        })
      )
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
                <div className="space-y-4 rounded-sm border border-[var(--workbench-border)] px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">
                        {t('workbench.settings.themeManagement.title')}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {t('workbench.settings.themeManagement.importDescription')}
                      </div>
                    </div>
                    <Button
                      type="button"
                      className="lg:self-start"
                      disabled={importThemePack.isPending}
                      onClick={() => importThemePack.mutate()}
                    >
                      <UploadIcon className="size-4" />
                      {t('common.actions.import')}
                    </Button>
                  </div>

                  {userThemePacks.length > 0 ? (
                    <div className="space-y-3">
                      {userThemePacks.map((pack) => {
                        const deletingCurrentPack =
                          deleteThemePack.isPending && deleteThemePack.variables === pack.pluginId

                        return (
                          <div
                            key={pack.pluginId}
                            className="rounded-sm border border-[var(--workbench-border)] px-4 py-3"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="space-y-2">
                                <div>
                                  <div className="font-medium">{pack.pluginDisplayName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {pack.pluginId} · v{pack.version}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <div className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                                    {t('workbench.settings.themeManagement.importedThemes')}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {pack.themes.map((theme) => (
                                      <Badge key={theme.id} variant="secondary">
                                        {theme.label}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={deletingCurrentPack}
                                onClick={() => setThemePackPendingDelete(pack)}
                              >
                                <DeleteIcon className="size-4" />
                                {t('common.actions.delete')}
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="rounded-sm border border-dashed border-[var(--workbench-border)] px-4 py-6 text-sm text-muted-foreground">
                      {t('workbench.settings.themeManagement.empty')}
                    </div>
                  )}
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
                          <TerminalFontFamilyCombobox
                            value={field.value}
                            onChange={field.onChange}
                            options={fontOptions}
                          />
                          <FormMessage />
                        </FormItem>
                      )
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="localTerminalShell"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workbench.settings.form.localTerminalShell')}</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {localTerminalShellOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          {t('workbench.settings.form.localTerminalShellDescription')}
                        </FormDescription>
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
                          <Switch
                            aria-label={t('workbench.settings.form.cursorBlink.title')}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
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
                          <Switch
                            aria-label={t('workbench.settings.form.copyOnSelect.title')}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="experimentalTerminalWebgl"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-sm border border-[var(--workbench-border)] px-4 py-3">
                        <div>
                          <div className="font-medium">
                            {t('workbench.settings.form.experimentalTerminalWebgl.title')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t('workbench.settings.form.experimentalTerminalWebgl.description')}
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            aria-label={t(
                              'workbench.settings.form.experimentalTerminalWebgl.title'
                            )}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
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

        <Dialog
          open={themePackPendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) {
              setThemePackPendingDelete(null)
            }
          }}
        >
          <DialogContent className="max-w-sm border-[var(--workbench-border)] bg-[var(--workbench-editor)]">
            <DialogHeader>
              <DialogTitle>{t('workbench.settings.themeManagement.deleteTitle')}</DialogTitle>
              <DialogDescription>
                {t('workbench.settings.themeManagement.deleteDescription', {
                  name: themePackPendingDelete?.pluginDisplayName ?? ''
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setThemePackPendingDelete(null)}
              >
                {t('common.actions.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!themePackPendingDelete || deleteThemePack.isPending}
                onClick={() => {
                  if (!themePackPendingDelete) {
                    return
                  }

                  deleteThemePack.mutate(themePackPendingDelete.pluginId)
                }}
              >
                <DeleteIcon className="size-4" />
                {t('common.actions.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
