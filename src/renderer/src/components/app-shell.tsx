import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { ThemeToggle } from '@/components/theme-toggle'

const routeMeta: Record<string, { title: string; description: string }> = {
  '/servers': {
    title: '连接配置',
    description: '管理服务器、分组与标签，并从列表直接发起 SSH 或 SFTP 会话。'
  },
  '/sessions': {
    title: '会话工作区',
    description: '使用标签终端并让左侧 SFTP Explorer 跟随当前会话。'
  },
  '/settings': {
    title: '偏好设置',
    description: '维护主题、终端参数和已信任主机。'
  }
}

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const meta = routeMeta[location.pathname] ?? routeMeta['/servers']
  const isSessionsRoute = location.pathname === '/sessions'

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar />
      <SidebarInset className="overflow-hidden">
        <div className="flex h-full flex-col">
          <header
            className={cn(
              'flex items-center justify-between border-b bg-background',
              isSessionsRoute ? 'h-12 px-3' : 'h-14 px-4'
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="size-8 rounded-md border border-border" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{meta.title}</div>
                <div
                  className={cn(
                    'truncate text-xs text-muted-foreground xl:block',
                    isSessionsRoute && 'hidden'
                  )}
                >
                  {meta.description}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  'hidden text-xs text-muted-foreground lg:inline',
                  isSessionsRoute && 'hidden xl:inline'
                )}
              >
                Ctrl/Cmd + B
              </span>
              <ThemeToggle />
            </div>
          </header>
          <div className={cn('min-h-0 flex-1 overflow-hidden', isSessionsRoute ? 'p-0' : 'p-4')}>
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
