import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { APP_NAME, DEFAULT_APP_SETTINGS } from '@shared/constants'
import { SYSTEM_THEME_ID, type ThemeDefinition } from '@shared/themes'
import type { AppSettings, ReleaseChannel, WebDAVBackupEntry } from '@shared/types'
import {
  Check,
  CircleHelp,
  Cloud,
  KeyRound,
  Languages,
  ShieldCheck,
  SlidersHorizontal,
  TerminalSquare
} from 'lucide-react'
import { INTEGRATED_FONTS } from '@shared/integrated-fonts'
import { useTranslation } from 'react-i18next'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { settingsSchema, type SettingsFormValues } from '@shared/validation'
import { queryKeys } from '@/features/shared/query-keys'
import { backupClient } from '@/features/backup/api/backup-client'
import { settingsClient } from '@/features/settings/api/settings-client'
import { useSettingsAutoSave } from '@/features/settings/use-settings-auto-save'
import { systemClient } from '@/features/system/api/system-client'
import { themesClient } from '@/features/themes/api/themes-client'
import { formatDateTime } from '@/i18n/format'
import { getPlatform, isWindowsPlatform } from '@/lib/platform'
import { actionIcons } from '@/lib/action-icons'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  { id: 'credentialVault', labelKey: 'workbench.settings.sections.credentialVault' },
  { id: 'backup', labelKey: 'workbench.settings.sections.backup' },
  { id: 'about', labelKey: 'workbench.settings.sections.about' }
] as const

const settingsSectionIcons = {
  about: CircleHelp,
  appearance: SlidersHorizontal,
  backup: Cloud,
  credentialVault: KeyRound,
  security: ShieldCheck,
  terminal: TerminalSquare
} as const

const DEFAULT_SETTINGS_FORM_VALUES: SettingsFormValues = DEFAULT_APP_SETTINGS

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

function formatPlatformLabel(platform: string) {
  switch (platform) {
    case 'win32':
      return 'Windows'
    case 'darwin':
      return 'macOS'
    case 'linux':
      return 'Linux'
    default:
      return platform
  }
}

function getReleaseChannelLabel(
  releaseChannel: ReleaseChannel,
  t: ReturnType<typeof useTranslation>['t']
) {
  return t(`workbench.settings.about.channels.${releaseChannel}`)
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
  const [selectedSection, setSelectedSection] =
    useState<(typeof settingsSections)[number]['id']>('appearance')
  const [themePackPendingDelete, setThemePackPendingDelete] = useState<UserThemePack | null>(null)
  const [backupRestoreDialogOpen, setBackupRestoreDialogOpen] = useState(false)
  const [backupPendingDelete, setBackupPendingDelete] = useState<WebDAVBackupEntry | null>(null)
  const [selectedBackupFileName, setSelectedBackupFileName] = useState<string | null>(null)
  const DeleteIcon = actionIcons.delete
  const UploadIcon = actionIcons.upload

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsClient.get()
  })
  const knownHostsQuery = useQuery({
    queryKey: queryKeys.knownHosts,
    queryFn: () => systemClient.getKnownHosts()
  })
  const capabilitiesQuery = useQuery({
    queryKey: queryKeys.capabilities,
    queryFn: () => systemClient.getCapabilities()
  })
  const themesQuery = useQuery({
    queryKey: queryKeys.themes,
    queryFn: () => themesClient.list()
  })
  const appInfoQuery = useQuery({
    queryKey: queryKeys.appInfo,
    queryFn: () => systemClient.getAppInfo()
  })
  const userThemePacks = getUserThemePacks(themesQuery.data)

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema as never),
    defaultValues: settingsQuery.data ?? DEFAULT_SETTINGS_FORM_VALUES
  })
  const { saveField, savedSettingsRef } = useSettingsAutoSave(settingsQuery.data)

  useEffect(() => {
    if (settingsQuery.data) {
      form.reset(settingsQuery.data, { keepDirtyValues: true })
    }
  }, [form, settingsQuery.data])

  const resetSavedField = <K extends keyof AppSettings>(field: K, value: AppSettings[K]) => {
    form.resetField(field as keyof SettingsFormValues, {
      defaultValue: value as SettingsFormValues[K]
    })
  }

  const handleSettingSave = <K extends keyof AppSettings>(field: K, value: AppSettings[K]) =>
    saveField(field, value, {
      onRevert: (rollbackValue) => {
        resetSavedField(field, rollbackValue)
      },
      onSuccess: (settings, previousSettings) => {
        resetSavedField(field, settings[field])

        if (
          field === 'webdavBackupEnabled' ||
          field === 'webdavBackupIntervalMinutes' ||
          field === 'webdavBackupPath' ||
          field === 'webdavUrl' ||
          field === 'webdavUsername'
        ) {
          void queryClient.invalidateQueries({ queryKey: queryKeys.backupState })
        }

        if (
          field === 'windowTitleBarStyle' &&
          previousSettings.windowTitleBarStyle !== settings.windowTitleBarStyle
        ) {
          toast.success(t('workbench.settings.titleBar.restartTitle'), {
            action: {
              label: t('common.actions.restartNow'),
              onClick: () => void systemClient.relaunch()
            },
            description: t('workbench.settings.titleBar.restartDescription')
          })
        }
      }
    })

  const handleTerminalFontSizeBlur = async () => {
    const parsedFontSize = settingsSchema.shape.terminalFontSize.safeParse(
      form.getValues('terminalFontSize')
    )

    if (!parsedFontSize.success) {
      resetSavedField(
        'terminalFontSize',
        savedSettingsRef.current?.terminalFontSize ?? DEFAULT_SETTINGS_FORM_VALUES.terminalFontSize
      )
      toast.error(t('workbench.settings.validation.failed'))
      return
    }

    await handleSettingSave('terminalFontSize', parsedFontSize.data)
  }
  const importThemePack = useMutation({
    mutationFn: () => themesClient.importArchive(),
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
    mutationFn: (pluginId: string) => themesClient.deletePlugin(pluginId),
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
      systemClient.removeKnownHost(host, port),
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
  const backupStateQuery = useQuery({
    queryKey: queryKeys.backupState,
    queryFn: () => backupClient.getState()
  })
  const backupListQuery = useQuery({
    queryKey: queryKeys.backupList,
    queryFn: () => backupClient.list(),
    enabled: backupRestoreDialogOpen
  })

  useEffect(() => {
    if (!backupRestoreDialogOpen) {
      setSelectedBackupFileName(null)
      setBackupPendingDelete(null)
    } else if (
      selectedBackupFileName &&
      backupListQuery.data &&
      !backupListQuery.data.some((backup) => backup.fileName === selectedBackupFileName)
    ) {
      setSelectedBackupFileName(null)
    }

    if (
      backupPendingDelete &&
      backupListQuery.data &&
      !backupListQuery.data.some((backup) => backup.fileName === backupPendingDelete.fileName)
    ) {
      setBackupPendingDelete(null)
    }
  }, [backupListQuery.data, backupPendingDelete, backupRestoreDialogOpen, selectedBackupFileName])
  const testConnection = useMutation({
    mutationFn: () => backupClient.testConnection(),
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('workbench.settings.backup.testFailed')
      )
    },
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(t('workbench.settings.backup.testSuccess', { message: result.message }))
      } else {
        toast.error(t('workbench.settings.backup.testFailedMessage', { message: result.message }))
      }
    }
  })
  const backupNow = useMutation({
    mutationFn: () => backupClient.backupNow(),
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('workbench.settings.backup.backupFailed')
      )
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.backupState })
      toast.success(t('workbench.settings.backup.backupSuccess'))
    }
  })
  const deleteBackup = useMutation({
    mutationFn: (fileName: string) => backupClient.delete(fileName),
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('workbench.settings.backup.deleteFailed')
      )
    },
    onSuccess: async (_data, fileName) => {
      setBackupPendingDelete(null)
      if (selectedBackupFileName === fileName) {
        setSelectedBackupFileName(null)
      }
      queryClient.setQueryData<WebDAVBackupEntry[]>(queryKeys.backupList, (current) =>
        (current ?? []).filter((backup) => backup.fileName !== fileName)
      )
      await queryClient.invalidateQueries({ queryKey: queryKeys.backupList })
      toast.success(t('workbench.settings.backup.deleteSuccess', { fileName }))
    }
  })
  const restoreBackup = useMutation({
    mutationFn: (fileName: string) => backupClient.restore(fileName),
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('workbench.settings.backup.restoreFailed')
      )
    },
    onSuccess: async () => {
      setBackupRestoreDialogOpen(false)
      setBackupPendingDelete(null)
      setSelectedBackupFileName(null)
      await systemClient.relaunch()
    }
  })
  const backupDestructiveActionPending = restoreBackup.isPending || deleteBackup.isPending
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
          <div className="space-y-6 px-6 py-6">
            {selectedSection === 'appearance' ? (
              <>
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
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value)
                              void handleSettingSave('language', value as AppSettings['language'])
                            }}
                          >
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
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value)
                              void handleSettingSave('theme', value)
                            }}
                          >
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
                      name="uiFontId"
                      render={({ field }) => (
                        <FormItem className="max-w-sm">
                          <FormLabel>{t('workbench.settings.form.uiFont')}</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value)
                              void handleSettingSave('uiFontId', value as AppSettings['uiFontId'])
                            }}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {INTEGRATED_FONTS.map((font) => (
                                <SelectItem key={font.id} value={font.id}>
                                  {font.label}
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
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value)
                              void handleSettingSave(
                                'windowTitleBarStyle',
                                value as AppSettings['windowTitleBarStyle']
                              )
                            }}
                          >
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

                <section className="liquid-glass-card space-y-4 border border-[var(--workbench-border)] p-5">
                  <div className="text-sm font-semibold">
                    {t('workbench.settings.themeManagement.title')}
                  </div>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-1">
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
                </section>
              </>
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
                          <Input
                            {...field}
                            type="number"
                            min={10}
                            max={24}
                            onBlur={() => {
                              field.onBlur()
                              void handleTerminalFontSizeBlur()
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="terminalFontId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workbench.settings.form.terminalFont')}</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value)
                            void handleSettingSave(
                              'terminalFontId',
                              value as AppSettings['terminalFontId']
                            )
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INTEGRATED_FONTS.map((font) => (
                              <SelectItem key={font.id} value={font.id}>
                                {font.label}
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
                    name="editorFontId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workbench.settings.form.editorFont')}</FormLabel>
                        <Select
                          value={field.value ?? 'follow-terminal'}
                          onValueChange={(value) => {
                            const nextValue =
                              value === 'follow-terminal'
                                ? null
                                : (value as AppSettings['editorFontId'])
                            field.onChange(nextValue)
                            void handleSettingSave('editorFontId', nextValue)
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="follow-terminal">
                              {t('workbench.settings.form.editorFontFollowTerminal')}
                            </SelectItem>
                            {INTEGRATED_FONTS.map((font) => (
                              <SelectItem key={font.id} value={font.id}>
                                {font.label}
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
                    name="localTerminalShell"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workbench.settings.form.localTerminalShell')}</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value)
                            void handleSettingSave(
                              'localTerminalShell',
                              value as AppSettings['localTerminalShell']
                            )
                          }}
                        >
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
                        <Select
                          value={field.value}
                          onValueChange={(value) => {
                            field.onChange(value)
                            void handleSettingSave(
                              'cursorStyle',
                              value as AppSettings['cursorStyle']
                            )
                          }}
                        >
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
                            onCheckedChange={(checked) => {
                              field.onChange(checked)
                              void handleSettingSave('cursorBlink', checked)
                            }}
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
                            onCheckedChange={(checked) => {
                              field.onChange(checked)
                              void handleSettingSave('copyOnSelect', checked)
                            }}
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
                            onCheckedChange={(checked) => {
                              field.onChange(checked)
                              void handleSettingSave('experimentalTerminalWebgl', checked)
                            }}
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

            {selectedSection === 'backup' ? (
              <section className="liquid-glass-card space-y-4 border border-[var(--workbench-border)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Cloud className="size-4 text-primary" />
                  {t('workbench.settings.sections.backup')}
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="webdavUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workbench.settings.form.webdavUrl')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="https://example.com/dav"
                            onBlur={() => {
                              field.onBlur()
                              void handleSettingSave('webdavUrl', field.value)
                            }}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="webdavUsername"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workbench.settings.form.webdavUsername')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            onBlur={() => {
                              field.onBlur()
                              void handleSettingSave('webdavUsername', field.value)
                            }}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormItem>
                    <FormLabel>{t('workbench.settings.form.webdavPassword')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={
                          savedSettingsRef.current?.webdavUrl
                            ? t('workbench.settings.form.webdavPasswordPlaceholder')
                            : undefined
                        }
                        onBlur={async (e) => {
                          const value = e.target.value
                          if (value) {
                            try {
                              await settingsClient.update({
                                webdavPassword: value
                              } as Partial<AppSettings>)
                              await queryClient.invalidateQueries({
                                queryKey: queryKeys.backupState
                              })
                            } catch (error) {
                              toast.error(
                                error instanceof Error
                                  ? error.message
                                  : t('workbench.settings.backup.testFailed')
                              )
                            }
                          }
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('workbench.settings.form.webdavPasswordDescription')}
                    </FormDescription>
                  </FormItem>
                  <FormField
                    control={form.control}
                    name="webdavBackupPath"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workbench.settings.form.webdavBackupPath')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            onBlur={() => {
                              field.onBlur()
                              void handleSettingSave('webdavBackupPath', field.value)
                            }}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="webdavBackupIntervalMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('workbench.settings.form.webdavBackupInterval')}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min={15}
                            max={10080}
                            onBlur={() => {
                              field.onBlur()
                              const parsed =
                                settingsSchema.shape.webdavBackupIntervalMinutes.safeParse(
                                  form.getValues('webdavBackupIntervalMinutes')
                                )
                              if (parsed.success) {
                                void handleSettingSave('webdavBackupIntervalMinutes', parsed.data)
                              } else {
                                resetSavedField(
                                  'webdavBackupIntervalMinutes',
                                  savedSettingsRef.current?.webdavBackupIntervalMinutes ??
                                    DEFAULT_SETTINGS_FORM_VALUES.webdavBackupIntervalMinutes
                                )
                                toast.error(t('workbench.settings.validation.failed'))
                              }
                            }}
                          />
                        </FormControl>
                        <FormDescription>
                          {t('workbench.settings.form.webdavBackupIntervalDescription')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="webdavBackupEnabled"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-sm border border-[var(--workbench-border)] px-4 py-3">
                        <div>
                          <div className="font-medium">
                            {t('workbench.settings.form.webdavBackupEnabled.title')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {t('workbench.settings.form.webdavBackupEnabled.description')}
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            aria-label={t('workbench.settings.form.webdavBackupEnabled.title')}
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked)
                              void handleSettingSave('webdavBackupEnabled', checked)
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={testConnection.isPending}
                    onClick={() => testConnection.mutate()}
                  >
                    {t('workbench.settings.backup.actions.testConnection')}
                  </Button>
                  <Button
                    type="button"
                    disabled={backupNow.isPending}
                    onClick={() => backupNow.mutate()}
                  >
                    {t('workbench.settings.backup.actions.backupNow')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={backupDestructiveActionPending}
                    onClick={() => setBackupRestoreDialogOpen(true)}
                  >
                    {t('workbench.settings.backup.actions.restore')}
                  </Button>
                </div>
                {backupStateQuery.data ? (
                  <div className="space-y-2 rounded-sm border border-[var(--workbench-border)] px-4 py-3">
                    <div className="text-sm font-medium">
                      {t('workbench.settings.backup.status.title')}
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {backupStateQuery.data.lastBackupAt && (
                        <div>
                          {t('workbench.settings.backup.status.lastBackup')}:{' '}
                          {formatDateTime(backupStateQuery.data.lastBackupAt)}
                        </div>
                      )}
                      {backupStateQuery.data.nextBackupAt && (
                        <div>
                          {t('workbench.settings.backup.status.nextBackup')}:{' '}
                          {formatDateTime(backupStateQuery.data.nextBackupAt)}
                        </div>
                      )}
                      {backupStateQuery.data.lastBackupError && (
                        <div className="text-destructive">
                          {t('workbench.settings.backup.status.lastError')}:{' '}
                          {backupStateQuery.data.lastBackupError}
                        </div>
                      )}
                      {!backupStateQuery.data.lastBackupAt &&
                        !backupStateQuery.data.lastBackupError && (
                          <div>{t('workbench.settings.backup.status.noBackupYet')}</div>
                        )}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {selectedSection === 'about' ? (
              <>
                <section className="liquid-glass-card space-y-4 border border-[var(--workbench-border)] p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CircleHelp className="size-4 text-primary" />
                    {t('workbench.settings.sections.about')}
                  </div>

                  <div className="rounded-sm border border-[var(--workbench-border)] px-4 py-4">
                    <div className="text-sm font-medium">
                      {t('workbench.settings.about.intro.title')}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {t('workbench.settings.about.intro.description')}
                    </div>
                  </div>
                </section>

                <section className="liquid-glass-card space-y-4 border border-[var(--workbench-border)] p-5">
                  <div className="text-sm font-semibold">
                    {t('workbench.settings.about.version.title')}
                  </div>
                  <dl className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-sm border border-[var(--workbench-border)] px-3 py-3">
                      <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        {t('workbench.settings.about.version.nameLabel')}
                      </dt>
                      <dd className="mt-1 font-medium">{appInfoQuery.data?.name ?? APP_NAME}</dd>
                    </div>
                    <div className="rounded-sm border border-[var(--workbench-border)] px-3 py-3">
                      <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        {t('workbench.settings.about.version.versionLabel')}
                      </dt>
                      <dd className="mt-1 font-medium">{appInfoQuery.data?.version ?? '0.0.0'}</dd>
                    </div>
                    <div className="rounded-sm border border-[var(--workbench-border)] px-3 py-3">
                      <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        {t('workbench.settings.about.version.platformLabel')}
                      </dt>
                      <dd className="mt-1 font-medium">
                        {formatPlatformLabel(appInfoQuery.data?.platform ?? 'unknown')}
                      </dd>
                    </div>
                    <div className="rounded-sm border border-[var(--workbench-border)] px-3 py-3">
                      <dt className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                        {t('workbench.settings.about.version.channelLabel')}
                      </dt>
                      <dd className="mt-1 font-medium">
                        {getReleaseChannelLabel(appInfoQuery.data?.releaseChannel ?? 'latest', t)}
                      </dd>
                    </div>
                  </dl>
                </section>
              </>
            ) : null}
          </div>
        </Form>

        <Dialog
          open={backupRestoreDialogOpen}
          onOpenChange={(open) => {
            setBackupRestoreDialogOpen(open)
            if (!open) {
              setSelectedBackupFileName(null)
              setBackupPendingDelete(null)
            }
          }}
        >
          <DialogContent className="max-w-lg border-[var(--workbench-border)] bg-[var(--workbench-editor)]">
            <DialogHeader>
              <DialogTitle>{t('workbench.settings.backup.restoreDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('workbench.settings.backup.restoreDialog.description')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {backupListQuery.isLoading ? (
                <div className="rounded-sm border border-dashed border-[var(--workbench-border)] px-4 py-6 text-sm text-muted-foreground">
                  {t('workbench.settings.backup.restoreDialog.loading')}
                </div>
              ) : null}

              {backupListQuery.isError ? (
                <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                  {backupListQuery.error instanceof Error
                    ? backupListQuery.error.message
                    : t('workbench.settings.backup.restoreDialog.loadFailed')}
                </div>
              ) : null}

              {!backupListQuery.isLoading && !backupListQuery.isError ? (
                <BackupRestoreList
                  backups={backupListQuery.data ?? []}
                  actionPending={backupDestructiveActionPending}
                  onDelete={setBackupPendingDelete}
                  selectedBackupFileName={selectedBackupFileName}
                  onSelect={setSelectedBackupFileName}
                />
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setBackupRestoreDialogOpen(false)}
              >
                {t('common.actions.cancel')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={
                  backupDestructiveActionPending ||
                  backupListQuery.isLoading ||
                  backupListQuery.isError ||
                  !selectedBackupFileName
                }
                onClick={() => {
                  if (!selectedBackupFileName) {
                    return
                  }

                  restoreBackup.mutate(selectedBackupFileName)
                }}
              >
                {t('workbench.settings.backup.restoreDialog.confirm')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog
          open={backupPendingDelete !== null}
          onOpenChange={(open) => {
            if (!open) {
              setBackupPendingDelete(null)
            }
          }}
        >
          <DialogContent className="max-w-sm border-[var(--workbench-border)] bg-[var(--workbench-editor)]">
            <DialogHeader>
              <DialogTitle>{t('workbench.settings.backup.deleteDialog.title')}</DialogTitle>
              <DialogDescription>
                {t('workbench.settings.backup.deleteDialog.description', {
                  fileName: backupPendingDelete?.fileName ?? ''
                })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBackupPendingDelete(null)}>
                {t('common.actions.cancel')}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!backupPendingDelete || deleteBackup.isPending}
                onClick={() => {
                  if (!backupPendingDelete) {
                    return
                  }

                  deleteBackup.mutate(backupPendingDelete.fileName)
                }}
              >
                <DeleteIcon className="size-4" />
                {t('common.actions.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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

type BackupRestoreListProps = {
  actionPending: boolean
  backups: WebDAVBackupEntry[]
  onDelete: (backup: WebDAVBackupEntry) => void
  selectedBackupFileName: string | null
  onSelect: (fileName: string) => void
}

function BackupRestoreList({
  actionPending,
  backups,
  onDelete,
  selectedBackupFileName,
  onSelect
}: BackupRestoreListProps) {
  const { t } = useTranslation()
  const DeleteIcon = actionIcons.delete

  if (backups.length === 0) {
    return (
      <div className="rounded-sm border border-dashed border-[var(--workbench-border)] px-4 py-6 text-sm text-muted-foreground">
        {t('workbench.settings.backup.restoreDialog.empty')}
      </div>
    )
  }

  return (
    <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
      {backups.map((backup) => {
        const selected = backup.fileName === selectedBackupFileName

        return (
          <div
            key={backup.fileName}
            className={cn(
              'flex w-full items-start justify-between gap-3 rounded-sm border px-4 py-3 text-left transition-colors',
              selected
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-[var(--workbench-border)] hover:bg-[var(--workbench-hover)]'
            )}
          >
            <button
              type="button"
              className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
              disabled={actionPending}
              onClick={() => onSelect(backup.fileName)}
            >
              <div className="space-y-1">
                <div className="truncate font-medium">{backup.fileName}</div>
                <div className="text-sm text-muted-foreground">
                  {t('workbench.settings.backup.restoreDialog.modifiedAt')}:{' '}
                  {formatDateTime(backup.modifiedAt)}
                </div>
              </div>
            </button>
            <div className="flex items-start gap-2">
              <Check
                className={cn('mt-2 size-4 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                aria-label={t('workbench.settings.backup.restoreDialog.deleteLabel', {
                  fileName: backup.fileName
                })}
                disabled={actionPending}
                onClick={() => onDelete(backup)}
              >
                <DeleteIcon className="size-4" />
                {t('common.actions.delete')}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
