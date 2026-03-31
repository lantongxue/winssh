import { useQuery } from '@tanstack/react-query'
import {
  HardDriveDownload,
  KeyRound,
  ServerCog,
  Settings2,
  ShieldCheck,
  TerminalSquare
} from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useSessionsStore } from '@/store/sessions-store'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator
} from '@/components/ui/sidebar'

const navItems = [
  { to: '/servers', label: '服务器', icon: ServerCog },
  { to: '/sessions', label: '会话', icon: TerminalSquare },
  { to: '/settings', label: '设置', icon: Settings2 }
]

export function AppSidebar() {
  const location = useLocation()
  const sessionCount = useSessionsStore((state) => state.tabs.length)
  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => window.winsshApi.servers.list()
  })
  const recentQuery = useQuery({
    queryKey: ['recent-sessions'],
    queryFn: () => window.winsshApi.servers.listRecent()
  })
  const capabilitiesQuery = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => window.winsshApi.system.getCapabilities()
  })

  const servers = serversQuery.data ?? []

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="gap-3 px-3 py-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-2">
        <div className="flex items-center gap-3 rounded-lg border border-sidebar-border bg-sidebar px-3 py-2 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-0">
          <div className="flex size-9 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground group-data-[collapsible=icon]:size-8">
            <TerminalSquare className="size-4.5" />
          </div>
          <div className="grid min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <span className="truncate text-sm font-semibold">WinSSH</span>
            <span className="truncate text-xs text-sidebar-foreground/60">SSH / SFTP client</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>导航</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.label}
                    isActive={location.pathname === item.to}
                    className="rounded-md"
                  >
                    <NavLink to={item.to}>
                      <item.icon className="size-4" />
                      <span>{item.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                  {item.to === '/sessions' && sessionCount > 0 ? (
                    <SidebarMenuBadge>{sessionCount}</SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>资源</SidebarGroupLabel>
          <SidebarGroupContent className="group-data-[collapsible=icon]:hidden">
            <div className="space-y-1 px-2 text-xs text-sidebar-foreground/70">
              <div className="flex items-center justify-between rounded-md px-2 py-1.5">
                <span>已保存连接</span>
                <span className="font-medium text-sidebar-foreground">{servers.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-md px-2 py-1.5">
                <span>收藏服务器</span>
                <span className="font-medium text-sidebar-foreground">
                  {servers.filter((server) => server.favorite).length}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md px-2 py-1.5">
                <span>活动标签</span>
                <span className="font-medium text-sidebar-foreground">{sessionCount}</span>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>最近连接</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {(recentQuery.data ?? []).slice(0, 6).map((recent) => (
                <SidebarMenuItem key={recent.id}>
                  <SidebarMenuButton asChild tooltip={recent.serverName} className="h-auto py-2">
                    <NavLink to="/servers">
                      <HardDriveDownload className="mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                        <div className="truncate text-sm">{recent.serverName}</div>
                        <div className="truncate text-xs text-sidebar-foreground/60">
                          {recent.host}
                        </div>
                      </div>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
            {(recentQuery.data ?? []).length === 0 ? (
              <div className="px-2 py-1 text-xs text-sidebar-foreground/50">暂无最近连接</div>
            ) : null}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>运行状态</SidebarGroupLabel>
          <SidebarGroupContent className="group-data-[collapsible=icon]:hidden">
            <div className="space-y-2 px-2">
              <div className="rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <ShieldCheck className="size-3.5" />
                  系统钥匙串
                </div>
                <div className="mt-1 text-xs text-sidebar-foreground/60">
                  {capabilitiesQuery.data?.credentialStorage ? '可用' : '不可用'}
                </div>
              </div>
              <div className="rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-2">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <KeyRound className="size-3.5" />
                  SFTP 联动
                </div>
                <div className="mt-1 text-xs text-sidebar-foreground/60">跟随当前终端标签切换</div>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 pb-3 group-data-[collapsible=icon]:hidden">
        <div className="rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs text-sidebar-foreground/70">
          <div className="font-medium text-sidebar-foreground">v0.1.0</div>
          <div className="mt-0.5">Electron + React + xterm.js</div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
