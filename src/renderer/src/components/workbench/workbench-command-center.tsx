import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_PIXEL_THEME_ID, SYSTEM_THEME_ID } from '@shared/themes'
import { useTranslation } from 'react-i18next'
import { formatQuickConnectTarget, parseQuickConnectInput } from '@shared/quick-connect'
import {
  Files,
  MonitorCog,
  MoonStar,
  Palette,
  ServerCog,
  SunMedium,
  TerminalSquare
} from 'lucide-react'
import { ServerBrandIcon } from '@/components/server-brand-icon'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { actionIcons } from '@/lib/action-icons'
import { isMacPlatform } from '@/lib/platform'
import {
  createSessionEditorDocument,
  createSettingsEditorDocument,
  type WorkbenchDocument
} from '@/lib/workbench'
import { getWorkbenchShortcutLabel } from '@/lib/workbench-shortcuts'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut
} from '@/components/ui/command'

interface WorkbenchCommandCenterProps {
  activeDocument: WorkbenchDocument | null
}

export function WorkbenchCommandCenter({ activeDocument }: WorkbenchCommandCenterProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [quickConnectQuery, setQuickConnectQuery] = useState('')
  const {
    beginQuickConnect,
    focusActivity,
    openServerEditor,
    openSettingsEditor,
    disconnectSession,
    connectServer
  } = useWorkbenchContext()
  const sessions = useSessionsStore((state) => state.tabs)
  const openDocument = useWorkbenchStore((state) => state.openDocument)
  const commandPaletteOpen = useWorkbenchStore((state) => state.commandPaletteOpen)
  const quickOpenOpen = useWorkbenchStore((state) => state.quickOpenOpen)
  const setCommandPaletteOpen = useWorkbenchStore((state) => state.setCommandPaletteOpen)
  const setQuickOpenOpen = useWorkbenchStore((state) => state.setQuickOpenOpen)
  const toggleSidebar = useWorkbenchStore((state) => state.toggleSidebar)
  const togglePanel = useWorkbenchStore((state) => state.togglePanel)
  const NewConnectionIcon = actionIcons.newConnection
  const OpenSettingsIcon = actionIcons.openSettings
  const ToggleSidebarIcon = actionIcons.toggleSidebar
  const TogglePanelIcon = actionIcons.togglePanel
  const ConnectIcon = actionIcons.connect
  const DisconnectIcon = actionIcons.disconnect
  const isMac = isMacPlatform()

  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => window.winsshApi.servers.list()
  })
  const themesQuery = useQuery({
    queryKey: ['themes'],
    queryFn: () => window.winsshApi.themes.list()
  })

  const themeIcons = {
    system: MonitorCog
  } as const
  const SystemThemeIcon = themeIcons.system

  const handleThemeChange = async (theme: string) => {
    const settings = await window.winsshApi.settings.update({ theme })
    queryClient.setQueryData(['settings'], settings)
    setCommandPaletteOpen(false)
  }

  const currentServer =
    activeDocument?.kind === 'server-editor'
      ? (serversQuery.data ?? []).find((server) => server.id === activeDocument.serverId)
      : null
  const currentSession =
    activeDocument?.kind === 'session-editor'
      ? (sessions.find((session) => session.sessionId === activeDocument.sessionId) ?? null)
      : null
  const quickConnectTarget = parseQuickConnectInput(quickConnectQuery)

  return (
    <>
      <CommandDialog
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        className="max-w-2xl rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl"
        showCloseButton={false}
        title={t('workbench.commandCenter.commandPalette.title')}
        description={t('workbench.commandCenter.commandPalette.description')}
      >
        <CommandInput placeholder={t('workbench.commandCenter.commandPalette.placeholder')} />
        <CommandList>
          <CommandEmpty>{t('workbench.commandCenter.commandPalette.empty')}</CommandEmpty>

          <CommandGroup heading={t('workbench.commandCenter.commandPalette.groups.workbench')}>
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false)
                openServerEditor()
              }}
            >
              <NewConnectionIcon className="size-4" />
              {t('common.actions.newConnection')}
              <CommandShortcut>{getWorkbenchShortcutLabel('newConnection', isMac)}</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false)
                focusActivity('explorer')
              }}
            >
              <ServerCog className="size-4" />
              {t('workbench.activity.explorer.title')}
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false)
                focusActivity('terminal')
              }}
            >
              <TerminalSquare className="size-4" />
              {t('workbench.activity.terminal.title')}
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false)
                openSettingsEditor()
              }}
            >
              <OpenSettingsIcon className="size-4" />
              {t('common.actions.openSettings')}
              <CommandShortcut>{getWorkbenchShortcutLabel('openSettings', isMac)}</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t('workbench.commandCenter.commandPalette.groups.layout')}>
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false)
                toggleSidebar()
              }}
            >
              <ToggleSidebarIcon className="size-4" />
              {t('common.actions.toggleSidebar')}
              <CommandShortcut>{getWorkbenchShortcutLabel('toggleSidebar', isMac)}</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false)
                togglePanel()
              }}
            >
              <TogglePanelIcon className="size-4" />
              {t('common.actions.togglePanel')}
              <CommandShortcut>{getWorkbenchShortcutLabel('togglePanel', isMac)}</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t('workbench.commandCenter.commandPalette.groups.theme')}>
            <CommandItem onSelect={() => void handleThemeChange(SYSTEM_THEME_ID)}>
              <SystemThemeIcon className="size-4" />
              {t('common.theme.system')}
            </CommandItem>
            {(themesQuery.data ?? []).map((theme) => {
              const ThemeIcon =
                theme.id === DEFAULT_PIXEL_THEME_ID
                  ? TerminalSquare
                  : theme.appearance === 'dark'
                    ? MoonStar
                    : theme.appearance === 'light'
                      ? SunMedium
                      : Palette

              return (
                <CommandItem key={theme.id} onSelect={() => void handleThemeChange(theme.id)}>
                  <ThemeIcon className="size-4" />
                  {theme.label}
                </CommandItem>
              )
            })}
          </CommandGroup>

          {currentServer ? (
            <>
              <CommandSeparator />
              <CommandGroup
                heading={t('workbench.commandCenter.commandPalette.groups.currentServer')}
              >
                <CommandItem
                  onSelect={() => {
                    setCommandPaletteOpen(false)
                    void connectServer(currentServer)
                  }}
                >
                  <ConnectIcon className="size-4" />
                  {t('common.actions.connect')}
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}

          {currentSession ? (
            <>
              <CommandSeparator />
              <CommandGroup
                heading={t('workbench.commandCenter.commandPalette.groups.currentSession')}
              >
                <CommandItem
                  onSelect={() => {
                    setCommandPaletteOpen(false)
                    void disconnectSession(currentSession.sessionId)
                  }}
                >
                  <DisconnectIcon className="size-4" />
                  {t('common.actions.disconnect')}
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>

      <CommandDialog
        open={quickOpenOpen}
        onOpenChange={(open) => {
          setQuickOpenOpen(open)
          if (!open) {
            setQuickConnectQuery('')
          }
        }}
        className="max-w-2xl rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl"
        showCloseButton={false}
        title={t('workbench.commandCenter.quickOpen.title')}
        description={t('workbench.commandCenter.quickOpen.description')}
      >
        <CommandInput
          placeholder={t('workbench.commandCenter.quickOpen.placeholder')}
          value={quickConnectQuery}
          onValueChange={setQuickConnectQuery}
        />
        <CommandList>
          <CommandEmpty>{t('workbench.commandCenter.quickOpen.empty')}</CommandEmpty>

          {quickConnectTarget ? (
            <>
              <CommandGroup heading={t('workbench.commandCenter.quickOpen.groups.quickConnect')}>
                <CommandItem
                  value={quickConnectQuery}
                  onSelect={() => {
                    setQuickOpenOpen(false)
                    void beginQuickConnect(quickConnectTarget)
                  }}
                >
                  <ConnectIcon className="size-4" />
                  <span>
                    {t('workbench.commandCenter.quickOpen.actions.connectTo', {
                      target: formatQuickConnectTarget(quickConnectTarget)
                    })}
                  </span>
                </CommandItem>
              </CommandGroup>

              <CommandSeparator />
            </>
          ) : null}

          <CommandGroup heading={t('workbench.commandCenter.quickOpen.groups.connections')}>
            {(serversQuery.data ?? []).map((server) => (
              <CommandItem
                key={server.id}
                value={`${server.name} ${server.host} ${server.username}`}
                onSelect={() => {
                  setQuickOpenOpen(false)
                  openServerEditor(server.id)
                }}
              >
                <ServerBrandIcon
                  brandId={server.brandId}
                  customIconDataUrl={server.customIconDataUrl}
                  className="size-4 text-[var(--workbench-active)]"
                />
                <span>{server.name}</span>
                <CommandShortcut>{server.host}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t('workbench.commandCenter.quickOpen.groups.sessions')}>
            {sessions.map((session) => (
              <CommandItem
                key={session.sessionId}
                value={`${session.serverName} ${session.host} ${session.port}`}
                onSelect={() => {
                  setQuickOpenOpen(false)
                  openDocument(createSessionEditorDocument(session.sessionId))
                }}
              >
                <TerminalSquare className="size-4" />
                <span>{session.serverName}</span>
                <CommandShortcut>{session.host}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading={t('workbench.commandCenter.quickOpen.groups.workbench')}>
            <CommandItem
              onSelect={() => {
                setQuickOpenOpen(false)
                openDocument(createSettingsEditorDocument())
              }}
            >
              <OpenSettingsIcon className="size-4" />
              {t('common.actions.openSettings')}
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setQuickOpenOpen(false)
                focusActivity('explorer')
              }}
            >
              <Files className="size-4" />
              {t('workbench.activity.explorer.title')}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
