import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowUpRight, Clock3, Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { formatDateTime } from '@/i18n/format'
import { actionIcons } from '@/lib/action-icons'
import { ServerBrandIcon } from '@/components/server-brand-icon'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { useSingleOrDoubleClick } from '@/hooks/use-single-or-double-click'
import { useSessionsStore } from '@/store/sessions-store'
import { Button } from '@/components/ui/button'

function ServerShortcut({
  icon,
  metadata,
  onConnect,
  onOpen,
  title
}: {
  icon: React.ReactNode
  metadata: string
  onConnect?: () => void
  onOpen?: () => void
  title: string
}) {
  const clickIntent = useSingleOrDoubleClick({
    onDoubleClick: onConnect,
    onSingleClick: onOpen
  })

  return (
    <button
      type="button"
      className="liquid-glass-list-item flex w-full items-center justify-between gap-3 border border-transparent px-3 py-3 text-left transition-colors hover:border-[var(--workbench-border)] hover:bg-[var(--workbench-hover)]"
      onClick={clickIntent.onClick}
      onDoubleClick={clickIntent.onDoubleClick}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-foreground">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{metadata}</div>
      </div>
      {icon}
    </button>
  )
}

export function WorkbenchExplorerHome() {
  const { t } = useTranslation()
  const { focusActivity, openServerEditor, openSettingsEditor, connectServer } =
    useWorkbenchContext()
  const queryClient = useQueryClient()
  const sessions = useSessionsStore((state) => state.tabs)
  const NewConnectionIcon = actionIcons.newConnection
  const OpenTerminalIcon = actionIcons.openTerminal
  const OpenSettingsIcon = actionIcons.openSettings
  const ClearIcon = actionIcons.clear

  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => window.winsshApi.servers.list()
  })
  const recentQuery = useQuery({
    queryKey: ['recent-sessions'],
    queryFn: () => window.winsshApi.servers.listRecent()
  })

  const favoriteServers = (serversQuery.data ?? []).filter((server) => server.favorite).slice(0, 6)
  const recentServers = (recentQuery.data ?? []).slice(0, 6)

  const handleClearRecent = async () => {
    await window.winsshApi.servers.clearRecent()
    await queryClient.invalidateQueries({ queryKey: ['recent-sessions'] })
    toast.success(t('workbench.explorerHome.toasts.recentCleared'))
  }

  return (
    <div className="liquid-glass-page flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]">
      <div className="liquid-glass-hero mx-6 mt-6 border border-[var(--workbench-border)] px-6 py-5">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {t('workbench.activity.explorer.title')}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              {t('workbench.explorerHome.title')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('workbench.explorerHome.subtitle')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => openServerEditor()}>
              <NewConnectionIcon className="size-4" />
              {t('common.actions.newConnection')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => focusActivity('terminal')}>
              <OpenTerminalIcon className="size-4" />
              {t('common.actions.openTerminal')}
            </Button>
            <Button variant="outline" size="sm" onClick={openSettingsEditor}>
              <OpenSettingsIcon className="size-4" />
              {t('common.actions.openSettings')}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 px-6 py-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="liquid-glass-card min-h-0 overflow-auto border border-[var(--workbench-border)] bg-[var(--workbench-editor)]">
          <section className="border-b border-[var(--workbench-border)] px-6 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <Clock3 className="size-3.5" />
                {t('workbench.explorerHome.recent.title')}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-[11px] font-medium tracking-[0.16em] text-muted-foreground"
                disabled={(recentQuery.data?.length ?? 0) === 0}
                onClick={() => void handleClearRecent()}
              >
                <ClearIcon className="size-3.5" />
                {t('workbench.explorerHome.actions.clearRecent')}
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {recentServers.length === 0 ? (
                <div className="rounded-sm border border-dashed border-[var(--workbench-border)] px-4 py-6 text-sm text-muted-foreground">
                  {t('workbench.explorerHome.empty.recent')}
                </div>
              ) : (
                recentServers.map((recent) => {
                  const server = (serversQuery.data ?? []).find(
                    (item) => item.id === recent.serverId
                  )

                  return (
                    <ServerShortcut
                      key={recent.id}
                      title={recent.serverName}
                      metadata={`${recent.host} · ${formatDateTime(recent.connectedAt)}`}
                      icon={
                        <ServerBrandIcon
                          brandId={server.brandId}
                          customIconDataUrl={server.customIconDataUrl}
                          className="size-4 shrink-0 text-[var(--workbench-active)]"
                        />
                      }
                      onConnect={() => (server ? void connectServer(server) : undefined)}
                    />
                  )
                })
              )}
            </div>
          </section>

          <section className="px-6 py-5">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              <Heart className="size-3.5" />
              {t('workbench.explorerHome.favorites.title')}
            </div>
            <div className="mt-4 space-y-2">
              {favoriteServers.length === 0 ? (
                <div className="rounded-sm border border-dashed border-[var(--workbench-border)] px-4 py-6 text-sm text-muted-foreground">
                  {t('workbench.explorerHome.empty.favorites')}
                </div>
              ) : (
                favoriteServers.map((server) => (
                  <ServerShortcut
                    key={server.id}
                    title={server.name}
                    metadata={`${server.username}@${server.host}:${server.port}`}
                    icon={
                      <ServerBrandIcon
                        brandId={server.brandId}
                        customIconDataUrl={server.customIconDataUrl}
                        className="size-4 shrink-0 text-amber-400"
                      />
                    }
                    onOpen={() => openServerEditor(server.id)}
                    onConnect={() => void connectServer(server)}
                  />
                ))
              )}
            </div>
          </section>
        </div>

        <aside className="liquid-glass-card min-h-0 overflow-auto border border-[var(--workbench-border)] bg-[var(--workbench-sidebar)]">
          <section className="border-b border-[var(--workbench-border)] px-5 py-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {t('workbench.explorerHome.overview.title')}
            </div>
            <div className="mt-4 grid gap-3">
              <div className="liquid-glass-list-item liquid-glass-metric-card border border-[var(--workbench-border)] bg-[var(--workbench-bg)] px-4 py-3">
                <div className="text-xs text-muted-foreground">
                  {t('workbench.explorerHome.overview.savedConnections')}
                </div>
                <div className="mt-1 text-lg font-semibold">{serversQuery.data?.length ?? 0}</div>
              </div>
              <div className="liquid-glass-list-item liquid-glass-metric-card border border-[var(--workbench-border)] bg-[var(--workbench-bg)] px-4 py-3">
                <div className="text-xs text-muted-foreground">
                  {t('workbench.explorerHome.overview.activeSessions')}
                </div>
                <div className="mt-1 text-lg font-semibold">{sessions.length}</div>
              </div>
              <div className="liquid-glass-list-item liquid-glass-metric-card border border-[var(--workbench-border)] bg-[var(--workbench-bg)] px-4 py-3">
                <div className="text-xs text-muted-foreground">
                  {t('workbench.explorerHome.overview.recentConnections')}
                </div>
                <div className="mt-1 text-lg font-semibold">{recentQuery.data?.length ?? 0}</div>
              </div>
            </div>
          </section>

          <section className="px-5 py-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {t('workbench.explorerHome.quickLinks.title')}
            </div>
            <div className="mt-4 grid gap-2">
              <Button
                variant="ghost"
                className="justify-between"
                onClick={() => focusActivity('explorer')}
              >
                <span>{t('workbench.explorerHome.actions.focusExplorer')}</span>
                <ArrowUpRight className="size-4" />
              </Button>
              <Button
                variant="ghost"
                className="justify-between"
                onClick={() => focusActivity('terminal')}
              >
                <span>{t('workbench.explorerHome.actions.focusTerminal')}</span>
                <ArrowUpRight className="size-4" />
              </Button>
              <Button variant="ghost" className="justify-between" onClick={openSettingsEditor}>
                <span>{t('common.actions.openSettings')}</span>
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
