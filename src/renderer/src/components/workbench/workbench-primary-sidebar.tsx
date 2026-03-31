import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ChevronDown, ChevronRight, FolderTree, Heart, Plus, Tags } from 'lucide-react'
import { toast } from 'sonner'
import type { Server, ServerGroup, Tag } from '@shared/types'
import { getColorStyle } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'

function SectionHeader({
  action,
  collapsed,
  onToggle,
  title
}: {
  action?: ReactNode
  collapsed: boolean
  onToggle: () => void
  title: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 text-[11px] font-medium tracking-[0.14em] text-muted-foreground">
      <button
        type="button"
        className="flex min-w-0 items-center gap-1 transition-colors hover:text-foreground"
        onClick={onToggle}
      >
        {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        <span className="truncate uppercase">{title}</span>
      </button>
      {action}
    </div>
  )
}

function TreeRow({
  active = false,
  children,
  className,
  depth = 0,
  onClick,
  onDoubleClick
}: {
  active?: boolean
  children: ReactNode
  className?: string
  depth?: number
  onClick?: () => void
  onDoubleClick?: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'group/tree-row flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors',
        active
          ? 'bg-[var(--workbench-hover)] text-foreground'
          : 'text-muted-foreground hover:bg-[var(--workbench-hover)] hover:text-foreground',
        className
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && onClick) {
          event.preventDefault()
          onClick()
        }
      }}
    >
      {children}
    </div>
  )
}

function ServerRow({
  active,
  depth,
  onConnect,
  onDelete,
  onEdit,
  onSelect,
  onToggleFavorite,
  server
}: {
  active: boolean
  depth?: number
  onConnect: () => void
  onDelete: () => void
  onEdit: () => void
  onSelect: () => void
  onToggleFavorite: () => void
  server: Server
}) {
  const handleConnect = () => {
    onSelect()
    onConnect()
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <TreeRow active={active} depth={depth} onClick={onSelect} onDoubleClick={handleConnect}>
          <span
            className={cn(
              'size-2 rounded-full',
              server.favorite ? 'bg-amber-400' : 'bg-[var(--workbench-active)]'
            )}
          />
          <span className="min-w-0 flex-1 truncate">{server.name}</span>
          {server.favorite ? <Heart className="size-3.5 fill-amber-400 text-amber-400" /> : null}
          <button
            type="button"
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-sm text-[var(--workbench-muted)] transition-all hover:bg-[var(--workbench-hover)] hover:text-foreground',
              'opacity-0 pointer-events-none group-hover/tree-row:opacity-100 group-hover/tree-row:pointer-events-auto',
              'group-focus-within/tree-row:opacity-100 group-focus-within/tree-row:pointer-events-auto'
            )}
            aria-label={`Connect to ${server.name}`}
            onMouseDown={(event) => {
              event.stopPropagation()
            }}
            onDoubleClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              handleConnect()
            }}
          >
            <ArrowRight className="size-3.5" />
          </button>
        </TreeRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onConnect}>连接</ContextMenuItem>
        <ContextMenuItem onClick={onEdit}>编辑</ContextMenuItem>
        <ContextMenuItem onClick={onToggleFavorite}>
          {server.favorite ? '取消收藏' : '加入收藏'}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function EntityNode({
  active,
  children,
  depth,
  onClick,
  onDelete,
  onRename
}: {
  active: boolean
  children: ReactNode
  depth: number
  onClick: () => void
  onDelete: () => void
  onRename: () => void
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <TreeRow active={active} depth={depth} onClick={onClick}>
          {children}
        </TreeRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onRename}>重命名</ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function WorkbenchPrimarySidebar() {
  const {
    connectServer,
    deleteServer,
    openEntityQuickInput,
    openServerEditor,
    refreshWorkspaceData,
    toggleFavorite
  } = useWorkbenchContext()
  const activeSessionId = useSessionsStore((state) => state.activeSessionId)
  const sessions = useSessionsStore((state) => state.tabs)
  const collapsedSections = useWorkbenchStore((state) => state.collapsedSections)
  const selectedExplorerNode = useWorkbenchStore((state) => state.selectedExplorerNode)
  const setSelectedExplorerNode = useWorkbenchStore((state) => state.setSelectedExplorerNode)
  const toggleSection = useWorkbenchStore((state) => state.toggleSection)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({})

  const serversQuery = useQuery({
    queryKey: ['servers'],
    queryFn: () => window.winsshApi.servers.list()
  })
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: () => window.winsshApi.groups.list()
  })
  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: () => window.winsshApi.tags.list()
  })
  const recentQuery = useQuery({
    queryKey: ['recent-sessions'],
    queryFn: () => window.winsshApi.servers.listRecent()
  })

  const servers = useMemo(() => serversQuery.data ?? [], [serversQuery.data])
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data])
  const recents = useMemo(() => recentQuery.data ?? [], [recentQuery.data])
  const recentIds = useMemo(() => new Set(recents.map((recent) => recent.serverId)), [recents])

  const filteredServers = useMemo(() => {
    if (selectedExplorerNode === 'favorites') {
      return servers.filter((server) => server.favorite)
    }

    if (selectedExplorerNode === 'recent') {
      return servers.filter((server) => recentIds.has(server.id))
    }

    if (selectedExplorerNode.startsWith('group:')) {
      const groupId = selectedExplorerNode.slice('group:'.length)
      return servers.filter((server) => server.groupId === groupId)
    }

    if (selectedExplorerNode.startsWith('tag:')) {
      const tagId = selectedExplorerNode.slice('tag:'.length)
      return servers.filter((server) => server.tags.some((tag) => tag.id === tagId))
    }

    return servers
  }, [recentIds, selectedExplorerNode, servers])

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const server of servers) {
      if (server.groupId) {
        counts.set(server.groupId, (counts.get(server.groupId) ?? 0) + 1)
      }
    }
    return counts
  }, [servers])

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const server of servers) {
      for (const tag of server.tags) {
        counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1)
      }
    }
    return counts
  }, [servers])

  const handleDeleteGroup = async (group: ServerGroup) => {
    await window.winsshApi.groups.delete(group.id)
    await refreshWorkspaceData()
    toast.success('分组已删除')
  }

  const handleDeleteTag = async (tag: Tag) => {
    await window.winsshApi.tags.delete(tag.id)
    await refreshWorkspaceData()
    toast.success('标签已删除')
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-[var(--workbench-border)] bg-[var(--workbench-sidebar)]">
      <div className="border-b border-[var(--workbench-border)] px-4 py-3">
        <div className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground">
          EXPLORER
        </div>
        <div className="mt-2 text-sm font-medium text-foreground">Connections</div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          单击打开编辑器，双击建立 SSH 会话。
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-3">
        <section className="space-y-1">
          <SectionHeader
            title="Favorites"
            collapsed={Boolean(collapsedSections.favorites)}
            onToggle={() => toggleSection('favorites')}
          />
          {!collapsedSections.favorites ? (
            <div className="space-y-0.5">
              <TreeRow
                active={selectedExplorerNode === 'favorites'}
                onClick={() => setSelectedExplorerNode('favorites')}
              >
                <Heart className="size-4" />
                <span className="flex-1 truncate">收藏连接</span>
                <span className="text-xs text-muted-foreground">
                  {servers.filter((server) => server.favorite).length}
                </span>
              </TreeRow>
              {servers
                .filter((server) => server.favorite)
                .map((server) => (
                  <ServerRow
                    key={server.id}
                    active={selectedExplorerNode === `server:${server.id}`}
                    depth={1}
                    server={server}
                    onSelect={() => setSelectedExplorerNode(`server:${server.id}`)}
                    onConnect={() => void connectServer(server)}
                    onDelete={() => void deleteServer(server.id)}
                    onEdit={() => openServerEditor(server.id)}
                    onToggleFavorite={() => void toggleFavorite(server.id)}
                  />
                ))}
            </div>
          ) : null}
        </section>

        <section className="space-y-1">
          <SectionHeader
            title="Recent"
            collapsed={Boolean(collapsedSections.recent)}
            onToggle={() => toggleSection('recent')}
          />
          {!collapsedSections.recent ? (
            <div className="space-y-0.5">
              <TreeRow
                active={selectedExplorerNode === 'recent'}
                onClick={() => setSelectedExplorerNode('recent')}
              >
                <FolderTree className="size-4" />
                <span className="flex-1 truncate">最近连接</span>
                <span className="text-xs text-muted-foreground">{recents.length}</span>
              </TreeRow>
              {recents.map((recent) => {
                const server = servers.find((item) => item.id === recent.serverId)
                if (!server) {
                  return null
                }

                return (
                  <ServerRow
                    key={recent.id}
                    active={selectedExplorerNode === `recent-server:${recent.serverId}`}
                    depth={1}
                    server={server}
                    onSelect={() => setSelectedExplorerNode(`recent-server:${recent.serverId}`)}
                    onConnect={() => void connectServer(server)}
                    onDelete={() => void deleteServer(server.id)}
                    onEdit={() => openServerEditor(server.id)}
                    onToggleFavorite={() => void toggleFavorite(server.id)}
                  />
                )
              })}
            </div>
          ) : null}
        </section>

        <section className="space-y-1">
          <SectionHeader
            title="Groups"
            collapsed={Boolean(collapsedSections.groups)}
            onToggle={() => toggleSection('groups')}
            action={
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                onClick={() => openEntityQuickInput({ entityType: 'group', mode: 'create' })}
              >
                <Plus className="size-3.5" />
              </Button>
            }
          />
          {!collapsedSections.groups ? (
            <div className="space-y-0.5">
              {groups.map((group) => {
                const style = getColorStyle(group.color)
                const active = selectedExplorerNode === `group:${group.id}`
                const expanded = expandedGroups[group.id] ?? false
                const groupServers = servers.filter((server) => server.groupId === group.id)

                return (
                  <div key={group.id} className="space-y-0.5">
                    <EntityNode
                      active={active}
                      depth={0}
                      onClick={() => setSelectedExplorerNode(`group:${group.id}`)}
                      onDelete={() => void handleDeleteGroup(group)}
                      onRename={() =>
                        openEntityQuickInput({
                          entityId: group.id,
                          entityType: 'group',
                          initialColor: group.color,
                          initialName: group.name,
                          mode: 'rename'
                        })
                      }
                    >
                      <button
                        type="button"
                        className="flex size-4 items-center justify-center"
                        onClick={(event) => {
                          event.stopPropagation()
                          setExpandedGroups((current) => ({
                            ...current,
                            [group.id]: !expanded
                          }))
                        }}
                      >
                        {expanded ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </button>
                      <span className={`size-2 rounded-full ${style.dot}`} />
                      <span className="flex-1 truncate">{group.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {groupCounts.get(group.id) ?? 0}
                      </span>
                    </EntityNode>
                    {expanded
                      ? groupServers.map((server) => (
                          <ServerRow
                            key={server.id}
                            active={selectedExplorerNode === `server:${server.id}`}
                            depth={1}
                            server={server}
                            onSelect={() => setSelectedExplorerNode(`server:${server.id}`)}
                            onConnect={() => void connectServer(server)}
                            onDelete={() => void deleteServer(server.id)}
                            onEdit={() => openServerEditor(server.id)}
                            onToggleFavorite={() => void toggleFavorite(server.id)}
                          />
                        ))
                      : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>

        <section className="space-y-1">
          <SectionHeader
            title="Tags"
            collapsed={Boolean(collapsedSections.tags)}
            onToggle={() => toggleSection('tags')}
            action={
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                onClick={() => openEntityQuickInput({ entityType: 'tag', mode: 'create' })}
              >
                <Plus className="size-3.5" />
              </Button>
            }
          />
          {!collapsedSections.tags ? (
            <div className="space-y-0.5">
              {tags.map((tag) => {
                const style = getColorStyle(tag.color)
                const active = selectedExplorerNode === `tag:${tag.id}`
                const expanded = expandedTags[tag.id] ?? false
                const tagServers = servers.filter((server) =>
                  server.tags.some((serverTag) => serverTag.id === tag.id)
                )

                return (
                  <div key={tag.id} className="space-y-0.5">
                    <EntityNode
                      active={active}
                      depth={0}
                      onClick={() => setSelectedExplorerNode(`tag:${tag.id}`)}
                      onDelete={() => void handleDeleteTag(tag)}
                      onRename={() =>
                        openEntityQuickInput({
                          entityId: tag.id,
                          entityType: 'tag',
                          initialColor: tag.color,
                          initialName: tag.name,
                          mode: 'rename'
                        })
                      }
                    >
                      <button
                        type="button"
                        className="flex size-4 items-center justify-center"
                        onClick={(event) => {
                          event.stopPropagation()
                          setExpandedTags((current) => ({
                            ...current,
                            [tag.id]: !expanded
                          }))
                        }}
                      >
                        {expanded ? (
                          <ChevronDown className="size-3.5" />
                        ) : (
                          <ChevronRight className="size-3.5" />
                        )}
                      </button>
                      <span className={`size-2 rounded-full ${style.dot}`} />
                      <span className="flex-1 truncate">{tag.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {tagCounts.get(tag.id) ?? 0}
                      </span>
                    </EntityNode>
                    {expanded
                      ? tagServers.map((server) => (
                          <ServerRow
                            key={server.id}
                            active={selectedExplorerNode === `server:${server.id}`}
                            depth={1}
                            server={server}
                            onSelect={() => setSelectedExplorerNode(`server:${server.id}`)}
                            onConnect={() => void connectServer(server)}
                            onDelete={() => void deleteServer(server.id)}
                            onEdit={() => openServerEditor(server.id)}
                            onToggleFavorite={() => void toggleFavorite(server.id)}
                          />
                        ))
                      : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </section>

        <section className="space-y-1">
          <SectionHeader
            title="All Servers"
            collapsed={Boolean(collapsedSections['all-servers'])}
            onToggle={() => toggleSection('all-servers')}
            action={
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                onClick={() => openServerEditor()}
              >
                <Plus className="size-3.5" />
              </Button>
            }
          />
          {!collapsedSections['all-servers'] ? (
            <div className="space-y-0.5">
              <TreeRow
                active={selectedExplorerNode === 'all-servers' || selectedExplorerNode === 'home'}
                onClick={() => setSelectedExplorerNode('all-servers')}
              >
                <Tags className="size-4" />
                <span className="flex-1 truncate">全部服务器</span>
                <span className="text-xs text-muted-foreground">{filteredServers.length}</span>
              </TreeRow>
              {filteredServers.map((server) => (
                <ServerRow
                  key={server.id}
                  active={
                    selectedExplorerNode === `server:${server.id}` ||
                    (activeSessionId
                      ? sessions.some((session) => session.serverId === server.id)
                      : false)
                  }
                  depth={1}
                  server={server}
                  onSelect={() => setSelectedExplorerNode(`server:${server.id}`)}
                  onConnect={() => void connectServer(server)}
                  onDelete={() => void deleteServer(server.id)}
                  onEdit={() => openServerEditor(server.id)}
                  onToggleFavorite={() => void toggleFavorite(server.id)}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </aside>
  )
}
