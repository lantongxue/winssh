import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Command,
  FolderPlus,
  LayoutPanelLeft,
  MonitorCog,
  MoonStar,
  PanelBottom,
  Plus,
  Search,
  ServerCog,
  Settings2,
  SunMedium,
  TerminalSquare,
  Unplug
} from 'lucide-react'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import {
  createSessionEditorDocument,
  createSettingsEditorDocument,
  type WorkbenchDocument
} from '@/lib/workbench'
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
  activeDocument: WorkbenchDocument
}

export function WorkbenchCommandCenter({ activeDocument }: WorkbenchCommandCenterProps) {
  const queryClient = useQueryClient()
  const { focusActivity, openServerEditor, openSettingsEditor, disconnectSession, connectServer } =
    useWorkbenchContext()
  const sessions = useSessionsStore((state) => state.tabs)
  const openDocument = useWorkbenchStore((state) => state.openDocument)
  const commandPaletteOpen = useWorkbenchStore((state) => state.commandPaletteOpen)
  const quickOpenOpen = useWorkbenchStore((state) => state.quickOpenOpen)
  const setCommandPaletteOpen = useWorkbenchStore((state) => state.setCommandPaletteOpen)
  const setQuickOpenOpen = useWorkbenchStore((state) => state.setQuickOpenOpen)
  const toggleSidebar = useWorkbenchStore((state) => state.toggleSidebar)
  const togglePanel = useWorkbenchStore((state) => state.togglePanel)

  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => window.winsshApi.servers.list()
  })

  const handleThemeChange = async (theme: 'system' | 'light' | 'dark') => {
    const settings = await window.winsshApi.settings.update({ theme })
    queryClient.setQueryData(['settings'], settings)
    setCommandPaletteOpen(false)
  }

  const currentServer =
    activeDocument.kind === 'server-editor'
      ? (serversQuery.data ?? []).find((server) => server.id === activeDocument.serverId)
      : null
  const currentSession =
    activeDocument.kind === 'session-editor'
      ? sessions.find((session) => session.sessionId === activeDocument.sessionId) ?? null
      : null

  return (
    <>
      <CommandDialog
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        className="max-w-2xl rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl"
        showCloseButton={false}
        title="Command Palette"
        description="Search WinSSH commands"
      >
        <CommandInput placeholder="Type a command" />
        <CommandList>
          <CommandEmpty>没有匹配的命令。</CommandEmpty>

          <CommandGroup heading="Workbench">
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false)
                openServerEditor()
              }}
            >
              <Plus className="size-4" />
              新建连接
              <CommandShortcut>Ctrl+N</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false)
                focusActivity('explorer')
              }}
            >
              <ServerCog className="size-4" />
              聚焦 Explorer
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false)
                focusActivity('terminal')
              }}
            >
              <TerminalSquare className="size-4" />
              聚焦最近会话
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false)
                openSettingsEditor()
              }}
            >
              <Settings2 className="size-4" />
              打开 Settings
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Layout">
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false)
                toggleSidebar()
              }}
            >
              <LayoutPanelLeft className="size-4" />
              切换侧栏
              <CommandShortcut>Ctrl+B</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setCommandPaletteOpen(false)
                togglePanel()
              }}
            >
              <PanelBottom className="size-4" />
              切换底部 Panel
              <CommandShortcut>Ctrl+J</CommandShortcut>
            </CommandItem>
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => void handleThemeChange('system')}>
              <MonitorCog className="size-4" />
              跟随系统
            </CommandItem>
            <CommandItem onSelect={() => void handleThemeChange('light')}>
              <SunMedium className="size-4" />
              Light+
            </CommandItem>
            <CommandItem onSelect={() => void handleThemeChange('dark')}>
              <MoonStar className="size-4" />
              Dark+
            </CommandItem>
          </CommandGroup>

          {currentServer ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Current Server">
                <CommandItem
                  onSelect={() => {
                    setCommandPaletteOpen(false)
                    void connectServer(currentServer)
                  }}
                >
                  <FolderPlus className="size-4" />
                  连接当前服务器
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}

          {currentSession ? (
            <>
              <CommandSeparator />
              <CommandGroup heading="Current Session">
                <CommandItem
                  onSelect={() => {
                    setCommandPaletteOpen(false)
                    void disconnectSession(currentSession.sessionId)
                  }}
                >
                  <Unplug className="size-4" />
                  断开当前会话
                </CommandItem>
              </CommandGroup>
            </>
          ) : null}
        </CommandList>
      </CommandDialog>

      <CommandDialog
        open={quickOpenOpen}
        onOpenChange={setQuickOpenOpen}
        className="max-w-2xl rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl"
        showCloseButton={false}
        title="Quick Open"
        description="Open a connection, session, or settings editor"
      >
        <CommandInput placeholder="Jump to a connection or session" />
        <CommandList>
          <CommandEmpty>没有匹配的项目。</CommandEmpty>

          <CommandGroup heading="Connections">
            {(serversQuery.data ?? []).map((server) => (
              <CommandItem
                key={server.id}
                value={`${server.name} ${server.host} ${server.username}`}
                onSelect={() => {
                  setQuickOpenOpen(false)
                  openServerEditor(server.id)
                }}
              >
                <ServerCog className="size-4" />
                <span>{server.name}</span>
                <CommandShortcut>{server.host}</CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Sessions">
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

          <CommandGroup heading="Workbench">
            <CommandItem
              onSelect={() => {
                setQuickOpenOpen(false)
                openDocument(createSettingsEditorDocument())
              }}
            >
              <Search className="size-4" />
              Settings
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setQuickOpenOpen(false)
                focusActivity('explorer')
              }}
            >
              <Command className="size-4" />
              Explorer Home
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
