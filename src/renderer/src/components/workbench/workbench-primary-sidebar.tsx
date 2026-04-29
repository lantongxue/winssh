import {
  useDeferredValue,
  useMemo,
  useState,
  type DragEvent,
  type ReactElement,
  type ReactNode
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  FolderTree,
  Heart,
  LoaderCircle,
  Plus,
  Search,
  Server as ServerIcon,
  Tag as TagIcon
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { Server, ServerGroup, Tag } from '@shared/types'
import { groupsClient } from '@/features/groups/api/groups-client'
import { queryKeys } from '@/features/shared/query-keys'
import { serversClient } from '@/features/servers/api/servers-client'
import { tagsClient } from '@/features/tags/api/tags-client'
import { actionIcons } from '@/lib/action-icons'
import { ServerBrandIcon } from '@/components/server-brand-icon'
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
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

function TooltipAction({
  children,
  content,
  side = 'top'
}: {
  children: ReactElement
  content: string
  side?: React.ComponentProps<typeof TooltipContent>['side']
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </Tooltip>
  )
}

const UNGROUPED_GROUP_ID = '__ungrouped__'
const SERVER_DRAG_MIME = 'application/x-winssh-server-id'

type GroupTreeNode = {
  group: ServerGroup
  children: GroupTreeNode[]
}

type FlatGroup = {
  depth: number
  group: ServerGroup
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase()
}

function getServerSearchRank(server: Server, query: string) {
  const normalizedName = normalizeSearchValue(server.name)
  const normalizedHost = normalizeSearchValue(server.host)

  if (normalizedName === query || normalizedHost === query) {
    return 0
  }

  if (normalizedName.startsWith(query)) {
    return 1
  }

  if (normalizedHost.startsWith(query)) {
    return 2
  }

  if (normalizedName.includes(query)) {
    return 3
  }

  if (normalizedHost.includes(query)) {
    return 4
  }

  return null
}

function buildGroupTree(groups: ServerGroup[]): GroupTreeNode[] {
  const nodes = new Map<string, GroupTreeNode>()
  for (const group of groups) {
    nodes.set(group.id, { group, children: [] })
  }

  const roots: GroupTreeNode[] = []
  for (const node of nodes.values()) {
    if (node.group.parentId && nodes.has(node.group.parentId)) {
      nodes.get(node.group.parentId)?.children.push(node)
      continue
    }

    roots.push(node)
  }

  return roots
}

function flattenGroupTree(nodes: GroupTreeNode[], depth = 0): FlatGroup[] {
  return nodes.flatMap((node) => [
    { depth, group: node.group },
    ...flattenGroupTree(node.children, depth + 1)
  ])
}

function SectionHeader({
  action,
  active = false,
  collapsed,
  count,
  icon,
  onDoubleClick,
  onSelect,
  onToggle,
  title
}: {
  action?: ReactNode
  active?: boolean
  collapsed: boolean
  count?: number
  icon?: ReactNode
  onDoubleClick?: () => void
  onSelect?: () => void
  onToggle: () => void
  title: string
}) {
  const ToggleIcon = collapsed ? actionIcons.expand : actionIcons.collapse

  return (
    <div
      data-active={active}
      className={cn(
        'flex w-full min-w-0 items-stretch rounded-sm text-[11px] font-medium tracking-[0.14em] transition-colors',
        active
          ? 'bg-[var(--workbench-hover)] text-foreground'
          : 'text-muted-foreground hover:bg-[var(--workbench-hover)] hover:text-foreground'
      )}
    >
      <button
        type="button"
        className="flex h-8 w-8 shrink-0 items-center justify-center text-inherit"
        onClick={onToggle}
      >
        <ToggleIcon className="size-3.5" />
      </button>

      {onSelect ? (
        <button
          type="button"
          className="flex min-w-0 h-8 flex-1 items-center gap-1.5 text-inherit"
          onClick={onSelect}
          onDoubleClick={onDoubleClick}
        >
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <span className="min-w-0 truncate text-left uppercase">{title}</span>
          {typeof count === 'number' ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">{count}</span>
          ) : null}
          <span className="flex-1" />
        </button>
      ) : (
        <div
          className="flex min-w-0 h-8 flex-1 items-center gap-1.5 text-inherit"
          onDoubleClick={onDoubleClick}
        >
          {icon ? <span className="shrink-0">{icon}</span> : null}
          <span className="min-w-0 truncate uppercase">{title}</span>
          {typeof count === 'number' ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">{count}</span>
          ) : null}
          <span className="flex-1" />
        </div>
      )}

      {action ? <div className="flex h-8 shrink-0 items-center pr-1">{action}</div> : null}
    </div>
  )
}

function TreeRow({
  active = false,
  children,
  className,
  depth = 0,
  draggable = false,
  dropTarget = false,
  onClick,
  onDragEnd,
  onDragLeave,
  onDragOver,
  onDragStart,
  onDoubleClick,
  onDrop
}: {
  active?: boolean
  children: ReactNode
  className?: string
  depth?: number
  draggable?: boolean
  dropTarget?: boolean
  onClick?: () => void
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void
  onDragLeave?: (event: DragEvent<HTMLDivElement>) => void
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void
  onDoubleClick?: () => void
  onDrop?: (event: DragEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      data-active={active}
      draggable={draggable}
      className={cn(
        'liquid-glass-list-item group/tree-row flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors',
        active
          ? 'bg-[var(--workbench-hover)] text-foreground'
          : 'text-muted-foreground hover:bg-[var(--workbench-hover)] hover:text-foreground',
        dropTarget &&
          'bg-[var(--workbench-hover)] text-foreground ring-1 ring-[var(--workbench-active)]/35',
        className
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={onClick}
      onDragEnd={onDragEnd}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDragStart={onDragStart}
      onDoubleClick={onDoubleClick}
      onDrop={onDrop}
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
  connected,
  depth,
  dragging = false,
  groups,
  onConnect,
  onDelete,
  onDragEnd,
  onDragStart,
  onEdit,
  onMoveToGroup,
  onSelect,
  onToggleFavorite,
  showHost = false,
  server
}: {
  active: boolean
  connected?: boolean
  depth?: number
  dragging?: boolean
  groups: ServerGroup[]
  onConnect: () => void
  onDelete: () => void
  onDragEnd?: (event: DragEvent<HTMLDivElement>) => void
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void
  onEdit: () => void
  onMoveToGroup: (server: Server, group: ServerGroup | null) => void | Promise<void>
  onSelect?: () => void
  onToggleFavorite: () => void
  showHost?: boolean
  server: Server
}) {
  const { t } = useTranslation()
  const ConnectIcon = actionIcons.connect
  const EditIcon = actionIcons.edit
  const FavoriteIcon = actionIcons.star
  const DeleteIcon = actionIcons.delete
  const hasTags = server.tags.length > 0
  const shouldShowHost = showHost && server.host.trim() !== '' && server.host !== server.name
  const hasMeta = hasTags || shouldShowHost
  const groupMenuItems = flattenGroupTree(buildGroupTree(groups))

  const handleConnect = () => {
    onSelect?.()
    onConnect()
  }
  const connectLabel = t('workbench.primarySidebar.actions.connect')
  const connectedLabel = t('workbench.primarySidebar.labels.connected')

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <TreeRow
          active={active}
          className={dragging ? 'opacity-60' : undefined}
          depth={depth}
          draggable
          onClick={onSelect}
          onDragEnd={onDragEnd}
          onDragStart={onDragStart}
          onDoubleClick={handleConnect}
        >
          <ServerBrandIcon
            brandId={server.brandId}
            customIconDataUrl={server.customIconDataUrl}
            className={cn(
              'size-3.5 shrink-0',
              hasMeta && 'mt-0.5 self-start',
              server.favorite ? 'text-amber-400' : 'text-[var(--workbench-active)]'
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate">{server.name}</span>
              {connected ? (
                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-medium tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
                  {connectedLabel}
                </span>
              ) : null}
              {server.favorite ? (
                <Heart className="size-3.5 shrink-0 fill-amber-400 text-amber-400" />
              ) : null}
            </div>
            {shouldShowHost ? (
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{server.host}</div>
            ) : null}
            {hasTags ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {server.tags.map((tag) => {
                  const style = getColorStyle(tag.color)

                  return (
                    <span
                      key={tag.id}
                      className={cn(
                        'inline-flex max-w-full items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] leading-none',
                        style.badge
                      )}
                    >
                      <span className={cn('size-1.5 shrink-0 rounded-full', style.dot)} />
                      <span className="truncate">{tag.name}</span>
                    </span>
                  )
                })}
              </div>
            ) : null}
          </div>
          <TooltipAction content={connectLabel} side="right">
            <button
              type="button"
              className={cn(
                'flex size-5 shrink-0 items-center justify-center rounded-sm text-[var(--workbench-muted)] transition-all hover:bg-[var(--workbench-hover)] hover:text-foreground',
                hasMeta && 'mt-0.5 self-start',
                'opacity-0 pointer-events-none group-hover/tree-row:opacity-100 group-hover/tree-row:pointer-events-auto',
                'group-focus-within/tree-row:opacity-100 group-focus-within/tree-row:pointer-events-auto'
              )}
              aria-label={connectLabel}
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
          </TooltipAction>
        </TreeRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onConnect}>
          <ConnectIcon className="size-4" />
          {t('workbench.primarySidebar.actions.connect')}
        </ContextMenuItem>
        <ContextMenuItem onClick={onEdit}>
          <EditIcon className="size-4" />
          {t('workbench.primarySidebar.actions.edit')}
        </ContextMenuItem>
        <ContextMenuItem onClick={onToggleFavorite}>
          <FavoriteIcon className="size-4" />
          {server.favorite
            ? t('workbench.primarySidebar.actions.removeFromFavorites')
            : t('workbench.primarySidebar.actions.addToFavorites')}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>
            <FolderTree className="size-4" />
            {t('workbench.primarySidebar.actions.moveToGroup')}
          </ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem
              disabled={server.groupId === null}
              onClick={() => void onMoveToGroup(server, null)}
            >
              {t('workbench.primarySidebar.labels.ungrouped')}
            </ContextMenuItem>
            {groupMenuItems.map(({ depth, group }) => (
              <ContextMenuItem
                key={group.id}
                disabled={server.groupId === group.id}
                onClick={() => void onMoveToGroup(server, group)}
              >
                {depth > 0 ? `${'— '.repeat(depth)}${group.name}` : group.name}
              </ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <DeleteIcon className="size-4" />
          {t('common.actions.delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function EntityNode({
  active,
  children,
  depth,
  dropTarget = false,
  onClick,
  onCreateServer,
  onCreateSubgroup,
  onDragLeave,
  onDragOver,
  onDoubleClick,
  onDrop,
  onDelete,
  onRename
}: {
  active: boolean
  children: ReactNode
  depth: number
  dropTarget?: boolean
  onClick: () => void
  onCreateServer?: () => void
  onCreateSubgroup?: () => void
  onDragLeave?: (event: DragEvent<HTMLDivElement>) => void
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void
  onDoubleClick?: () => void
  onDrop?: (event: DragEvent<HTMLDivElement>) => void
  onDelete: () => void
  onRename: () => void
}) {
  const { t } = useTranslation()
  const NewConnectionIcon = actionIcons.newConnection
  const RenameIcon = actionIcons.rename
  const DeleteIcon = actionIcons.delete

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <TreeRow
          active={active}
          depth={depth}
          dropTarget={dropTarget}
          onClick={onClick}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDoubleClick={onDoubleClick}
          onDrop={onDrop}
        >
          {children}
        </TreeRow>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {onCreateServer ? (
          <>
            <ContextMenuItem onClick={onCreateServer}>
              <NewConnectionIcon className="size-4" />
              {t('common.actions.newConnection')}
            </ContextMenuItem>
            {onCreateSubgroup ? (
              <ContextMenuItem onClick={onCreateSubgroup}>
                <Plus className="size-4" />
                {t('workbench.primarySidebar.actions.createSubgroup')}
              </ContextMenuItem>
            ) : null}
            <ContextMenuSeparator />
          </>
        ) : null}
        <ContextMenuItem onClick={onRename}>
          <RenameIcon className="size-4" />
          {t('workbench.primarySidebar.actions.rename')}
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onClick={onDelete}>
          <DeleteIcon className="size-4" />
          {t('common.actions.delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function WorkbenchPrimarySidebar() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    connectServer,
    deleteServer,
    moveServerToGroup,
    openEntityQuickInput,
    openServerEditor,
    refreshWorkspaceData,
    toggleFavorite
  } = useWorkbenchContext()
  const sessions = useSessionsStore((state) => state.tabs)
  const ClearIcon = actionIcons.clear
  const collapsedSections = useWorkbenchStore((state) => state.collapsedSections)
  const selectedExplorerNode = useWorkbenchStore((state) => state.selectedExplorerNode)
  const setSelectedExplorerNode = useWorkbenchStore((state) => state.setSelectedExplorerNode)
  const toggleSection = useWorkbenchStore((state) => state.toggleSection)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
  const [expandedTags, setExpandedTags] = useState<Record<string, boolean>>({})
  const [draggedServerId, setDraggedServerId] = useState<string | null>(null)
  const [dropTargetGroupId, setDropTargetGroupId] = useState<string | null>(null)
  const [pendingDeleteServer, setPendingDeleteServer] = useState<Server | null>(null)
  const [isDeletingServer, setIsDeletingServer] = useState(false)
  const [serverSearchQuery, setServerSearchQuery] = useState('')
  const CancelIcon = actionIcons.cancel
  const CollapseIcon = actionIcons.collapse
  const DeleteIcon = actionIcons.delete
  const ExpandIcon = actionIcons.expand
  const deferredServerSearchQuery = useDeferredValue(serverSearchQuery)

  const serversQuery = useQuery({
    queryKey: queryKeys.servers,
    queryFn: () => serversClient.list()
  })
  const groupsQuery = useQuery({
    queryKey: queryKeys.groups,
    queryFn: () => groupsClient.list()
  })
  const tagsQuery = useQuery({
    queryKey: queryKeys.tags,
    queryFn: () => tagsClient.list()
  })
  const recentQuery = useQuery({
    queryKey: queryKeys.recentSessions,
    queryFn: () => serversClient.listRecent()
  })

  const servers = useMemo(() => serversQuery.data ?? [], [serversQuery.data])
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data])
  const groupTree = useMemo(() => buildGroupTree(groups), [groups])
  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data])
  const recents = useMemo(() => recentQuery.data ?? [], [recentQuery.data])
  const favoriteServers = useMemo(() => servers.filter((server) => server.favorite), [servers])
  const ungroupedServers = useMemo(() => servers.filter((server) => !server.groupId), [servers])
  const connectedServerIds = useMemo(
    () =>
      new Set(
        sessions.filter((session) => session.status === 'ready').map((session) => session.serverId)
      ),
    [sessions]
  )
  const normalizedServerSearchQuery = useMemo(
    () => normalizeSearchValue(deferredServerSearchQuery),
    [deferredServerSearchQuery]
  )
  const hasServerSearch = normalizedServerSearchQuery.length > 0
  const filteredServers = useMemo(() => {
    if (!hasServerSearch) {
      return []
    }

    return [...servers]
      .map((server) => ({
        rank: getServerSearchRank(server, normalizedServerSearchQuery),
        server
      }))
      .filter((entry) => entry.rank !== null)
      .sort((left, right) => {
        if (left.rank !== right.rank) {
          return (left.rank ?? Number.POSITIVE_INFINITY) - (right.rank ?? Number.POSITIVE_INFINITY)
        }

        const leftConnected = connectedServerIds.has(left.server.id)
        const rightConnected = connectedServerIds.has(right.server.id)

        if (leftConnected !== rightConnected) {
          return leftConnected ? -1 : 1
        }

        if (left.server.favorite !== right.server.favorite) {
          return left.server.favorite ? -1 : 1
        }

        return left.server.name.localeCompare(right.server.name)
      })
      .map((entry) => entry.server)
  }, [connectedServerIds, hasServerSearch, normalizedServerSearchQuery, servers])

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

  const serverMap = useMemo(() => new Map(servers.map((server) => [server.id, server])), [servers])

  const clearDragState = () => {
    setDraggedServerId(null)
    setDropTargetGroupId(null)
  }

  const resolveDraggedServerId = (event: DragEvent<HTMLElement>) => {
    const dataTransferServerId =
      event.dataTransfer.getData(SERVER_DRAG_MIME) || event.dataTransfer.getData('text/plain')

    return draggedServerId ?? dataTransferServerId ?? null
  }

  const canMoveServerToGroup = (serverId: string, targetGroupId: string | null) => {
    const server = serverMap.get(serverId)
    return Boolean(server) && server?.groupId !== targetGroupId
  }

  const getDropTargetKey = (groupId: string | null) => groupId ?? UNGROUPED_GROUP_ID

  const handleMoveServerGroup = async (server: Server, group: ServerGroup | null) => {
    await moveServerToGroup(
      server,
      group?.id ?? null,
      group?.name ?? t('workbench.primarySidebar.labels.ungrouped')
    )

    if (group) {
      setExpandedGroups((current) => ({
        ...current,
        [group.id]: true
      }))
      return
    }

    setExpandedGroups((current) => ({
      ...current,
      [UNGROUPED_GROUP_ID]: true
    }))
  }

  const handleServerDragStart = (serverId: string) => (event: DragEvent<HTMLDivElement>) => {
    setDraggedServerId(serverId)
    setDropTargetGroupId(null)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(SERVER_DRAG_MIME, serverId)
    event.dataTransfer.setData('text/plain', serverId)
  }

  const handleServerDragEnd = () => {
    clearDragState()
  }

  const handleGroupDragOver = (groupId: string | null) => (event: DragEvent<HTMLDivElement>) => {
    const serverId = resolveDraggedServerId(event)
    if (!serverId || !canMoveServerToGroup(serverId, groupId)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTargetGroupId(getDropTargetKey(groupId))
  }

  const handleGroupDragLeave = (groupId: string | null) => (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return
    }

    const targetKey = getDropTargetKey(groupId)
    setDropTargetGroupId((current) => (current === targetKey ? null : current))
  }

  const handleGroupDrop = (groupId: string | null) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()

    const serverId = resolveDraggedServerId(event)
    clearDragState()

    if (!serverId || !canMoveServerToGroup(serverId, groupId)) {
      return
    }

    const server = serverMap.get(serverId)
    if (!server) {
      return
    }

    const targetGroup = groupId ? (groups.find((group) => group.id === groupId) ?? null) : null
    void handleMoveServerGroup(server, targetGroup)
  }

  const handleDeleteGroup = async (group: ServerGroup) => {
    await groupsClient.delete(group.id)
    await refreshWorkspaceData()
    toast.success(t('workbench.primarySidebar.toasts.groupDeleted'))
  }

  const handleDeleteTag = async (tag: Tag) => {
    await tagsClient.delete(tag.id)
    await refreshWorkspaceData()
    toast.success(t('workbench.primarySidebar.toasts.tagDeleted'))
  }

  const handleClearRecent = async () => {
    await serversClient.clearRecent()
    await queryClient.invalidateQueries({ queryKey: ['recent-sessions'] })
    toast.success(t('workbench.primarySidebar.toasts.recentCleared'))
  }

  const closeDeleteServerDialog = () => {
    if (isDeletingServer) {
      return
    }

    setPendingDeleteServer(null)
  }

  const handleDeleteServer = async () => {
    if (!pendingDeleteServer) {
      return
    }

    setIsDeletingServer(true)

    try {
      await deleteServer(pendingDeleteServer.id)
      setPendingDeleteServer(null)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('workbench.primarySidebar.toasts.serverDeleteFailed')
      )
    } finally {
      setIsDeletingServer(false)
    }
  }

  const ungroupedExpanded = expandedGroups[UNGROUPED_GROUP_ID] ?? true
  const toggleUngrouped = () =>
    setExpandedGroups((current) => ({
      ...current,
      [UNGROUPED_GROUP_ID]: !(current[UNGROUPED_GROUP_ID] ?? true)
    }))

  const clearServerSearch = () => {
    setServerSearchQuery('')
  }

  const renderGroupNode = (node: GroupTreeNode, depth: number): ReactNode => {
    const { group } = node
    const style = getColorStyle(group.color)
    const active = selectedExplorerNode === `group:${group.id}`
    const expanded = expandedGroups[group.id] ?? false
    const groupServers = servers.filter((server) => server.groupId === group.id)

    return (
      <div key={group.id} className="space-y-0.5">
        <EntityNode
          active={active}
          depth={depth}
          dropTarget={dropTargetGroupId === group.id}
          onClick={() => setSelectedExplorerNode(`group:${group.id}`)}
          onCreateServer={() => openServerEditor(null, { initialGroupId: group.id })}
          onCreateSubgroup={() =>
            openEntityQuickInput({ entityType: 'group', mode: 'create', parentId: group.id })
          }
          onDragLeave={handleGroupDragLeave(group.id)}
          onDragOver={handleGroupDragOver(group.id)}
          onDoubleClick={() =>
            setExpandedGroups((current) => ({
              ...current,
              [group.id]: !expanded
            }))
          }
          onDrop={handleGroupDrop(group.id)}
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
            {expanded ? <CollapseIcon className="size-3.5" /> : <ExpandIcon className="size-3.5" />}
          </button>
          <span className={`size-2 rounded-full ${style.dot}`} />
          <span className="flex-1 truncate">{group.name}</span>
          <span className="text-xs text-muted-foreground">{groupCounts.get(group.id) ?? 0}</span>
        </EntityNode>
        {expanded
          ? [
              ...node.children.map((child) => renderGroupNode(child, depth + 1)),
              ...groupServers.map((server) => (
                <ServerRow
                  key={server.id}
                  active={selectedExplorerNode === `server:${server.id}`}
                  connected={connectedServerIds.has(server.id)}
                  depth={depth + 1}
                  dragging={draggedServerId === server.id}
                  groups={groups}
                  server={server}
                  onSelect={() => setSelectedExplorerNode(`server:${server.id}`)}
                  onConnect={() => void connectServer(server)}
                  onDelete={() => setPendingDeleteServer(server)}
                  onDragEnd={handleServerDragEnd}
                  onDragStart={handleServerDragStart(server.id)}
                  onEdit={() => openServerEditor(server.id)}
                  onMoveToGroup={(currentServer, targetGroup) =>
                    void handleMoveServerGroup(currentServer, targetGroup)
                  }
                  onToggleFavorite={() => void toggleFavorite(server.id)}
                />
              ))
            ]
          : null}
      </div>
    )
  }

  return (
    <>
      <aside className="liquid-glass-pane flex h-full min-h-0 flex-col bg-[var(--workbench-sidebar)]">
        <div className="border-b border-[var(--workbench-border)] px-4 py-3">
          <div className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground">
            {t('workbench.primarySidebar.title').toUpperCase()}
          </div>
          <div className="mt-2 text-sm font-medium text-foreground">
            {t('workbench.primarySidebar.title')}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t('workbench.primarySidebar.description')}
          </p>
          <div className="mt-3">
            <label className="sr-only" htmlFor="workbench-primary-sidebar-search">
              {t('workbench.primarySidebar.search.label')}
            </label>
            <div className="liquid-glass-chip liquid-glass-search-shell flex items-center gap-2 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2.5 text-[var(--workbench-muted)] shadow-xs transition-colors focus-within:border-[var(--workbench-active)]/50 focus-within:text-foreground">
              <Search className="size-3.5 shrink-0" />
              <Input
                id="workbench-primary-sidebar-search"
                value={serverSearchQuery}
                onChange={(event) => setServerSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && serverSearchQuery) {
                    event.preventDefault()
                    clearServerSearch()
                  }
                }}
                placeholder={t('workbench.primarySidebar.search.placeholder')}
                aria-label={t('workbench.primarySidebar.search.label')}
                className="liquid-glass-search-input h-8 border-0 bg-transparent px-0 text-[13px] shadow-none placeholder:text-[var(--workbench-muted)] focus-visible:border-0 focus-visible:ring-0 dark:bg-transparent"
              />
              {serverSearchQuery ? (
                <TooltipAction content={t('workbench.primarySidebar.search.clear')} side="right">
                  <button
                    type="button"
                    className="flex size-5 shrink-0 items-center justify-center rounded-sm text-[var(--workbench-muted)] transition-colors hover:bg-[var(--workbench-hover)] hover:text-foreground"
                    aria-label={t('workbench.primarySidebar.search.clear')}
                    onClick={clearServerSearch}
                  >
                    <CancelIcon className="size-3.5" />
                  </button>
                </TooltipAction>
              ) : null}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-3">
          {hasServerSearch ? (
            <section className="space-y-1">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium tracking-[0.14em] text-muted-foreground">
                <Search className="size-3.5" />
                <span className="min-w-0 flex-1 truncate uppercase">
                  {t('workbench.primarySidebar.search.results')}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {filteredServers.length}
                </span>
              </div>
              {filteredServers.length > 0 ? (
                <div className="space-y-0.5">
                  {filteredServers.map((server) => (
                    <ServerRow
                      key={server.id}
                      active={selectedExplorerNode === `server:${server.id}`}
                      connected={connectedServerIds.has(server.id)}
                      depth={1}
                      dragging={draggedServerId === server.id}
                      groups={groups}
                      server={server}
                      showHost
                      onSelect={() => setSelectedExplorerNode(`server:${server.id}`)}
                      onConnect={() => void connectServer(server)}
                      onDelete={() => setPendingDeleteServer(server)}
                      onDragEnd={handleServerDragEnd}
                      onDragStart={handleServerDragStart(server.id)}
                      onEdit={() => openServerEditor(server.id)}
                      onMoveToGroup={(currentServer, targetGroup) =>
                        void handleMoveServerGroup(currentServer, targetGroup)
                      }
                      onToggleFavorite={() => void toggleFavorite(server.id)}
                    />
                  ))}
                </div>
              ) : (
                <div className="rounded-sm border border-dashed border-[var(--workbench-border)] bg-[var(--workbench-input)]/35 px-3 py-3 text-xs leading-5 text-muted-foreground">
                  {t('workbench.primarySidebar.search.empty', {
                    query: deferredServerSearchQuery.trim()
                  })}
                </div>
              )}
            </section>
          ) : (
            <>
              <section className="space-y-1">
                <SectionHeader
                  title={t('workbench.primarySidebar.sections.groups')}
                  icon={<ServerIcon className="size-3.5" />}
                  count={groups.length + 1}
                  active={selectedExplorerNode === 'groups'}
                  collapsed={Boolean(collapsedSections.groups)}
                  onDoubleClick={() => toggleSection('groups')}
                  onSelect={() => setSelectedExplorerNode('groups')}
                  onToggle={() => toggleSection('groups')}
                  action={
                    <TooltipAction content={t('workbench.primarySidebar.actions.createGroup')}>
                      <button
                        type="button"
                        className="flex size-5 shrink-0 items-center justify-center rounded-sm text-[var(--workbench-muted)] transition-all hover:bg-[var(--workbench-hover)] hover:text-foreground"
                        aria-label={t('workbench.primarySidebar.actions.createGroup')}
                        onClick={() =>
                          openEntityQuickInput({ entityType: 'group', mode: 'create' })
                        }
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </TooltipAction>
                  }
                />
                {!collapsedSections.groups ? (
                  <div className="space-y-0.5">
                    <div className="space-y-0.5">
                      <TreeRow
                        active={selectedExplorerNode === `group:${UNGROUPED_GROUP_ID}`}
                        depth={1}
                        onClick={() => setSelectedExplorerNode(`group:${UNGROUPED_GROUP_ID}`)}
                        dropTarget={dropTargetGroupId === UNGROUPED_GROUP_ID}
                        onDragLeave={handleGroupDragLeave(null)}
                        onDragOver={handleGroupDragOver(null)}
                        onDoubleClick={toggleUngrouped}
                        onDrop={handleGroupDrop(null)}
                      >
                        <button
                          type="button"
                          className="flex size-4 items-center justify-center"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggleUngrouped()
                          }}
                        >
                          {ungroupedExpanded ? (
                            <CollapseIcon className="size-3.5" />
                          ) : (
                            <ExpandIcon className="size-3.5" />
                          )}
                        </button>
                        <span className="size-2 rounded-full bg-muted-foreground/50" />
                        <span className="flex-1 truncate">
                          {t('workbench.primarySidebar.labels.ungrouped')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {ungroupedServers.length}
                        </span>
                      </TreeRow>
                      {ungroupedExpanded
                        ? ungroupedServers.map((server) => (
                            <ServerRow
                              key={server.id}
                              active={selectedExplorerNode === `server:${server.id}`}
                              connected={connectedServerIds.has(server.id)}
                              depth={2}
                              dragging={draggedServerId === server.id}
                              groups={groups}
                              server={server}
                              onSelect={() => setSelectedExplorerNode(`server:${server.id}`)}
                              onConnect={() => void connectServer(server)}
                              onDelete={() => setPendingDeleteServer(server)}
                              onDragEnd={handleServerDragEnd}
                              onDragStart={handleServerDragStart(server.id)}
                              onEdit={() => openServerEditor(server.id)}
                              onMoveToGroup={(currentServer, targetGroup) =>
                                void handleMoveServerGroup(currentServer, targetGroup)
                              }
                              onToggleFavorite={() => void toggleFavorite(server.id)}
                            />
                          ))
                        : null}
                    </div>
                    {groupTree.map((node) => renderGroupNode(node, 1))}
                  </div>
                ) : null}
              </section>

              <section className="space-y-1">
                <SectionHeader
                  title={t('workbench.primarySidebar.sections.favorites')}
                  icon={<Heart className="size-3.5" />}
                  count={favoriteServers.length}
                  active={selectedExplorerNode === 'favorites'}
                  collapsed={Boolean(collapsedSections.favorites)}
                  onDoubleClick={() => toggleSection('favorites')}
                  onSelect={() => setSelectedExplorerNode('favorites')}
                  onToggle={() => toggleSection('favorites')}
                />
                {!collapsedSections.favorites ? (
                  <div className="space-y-0.5">
                    {favoriteServers.map((server) => (
                      <ServerRow
                        key={server.id}
                        active={selectedExplorerNode === `server:${server.id}`}
                        connected={connectedServerIds.has(server.id)}
                        depth={1}
                        dragging={draggedServerId === server.id}
                        groups={groups}
                        server={server}
                        onSelect={() => setSelectedExplorerNode(`server:${server.id}`)}
                        onConnect={() => void connectServer(server)}
                        onDelete={() => setPendingDeleteServer(server)}
                        onDragEnd={handleServerDragEnd}
                        onDragStart={handleServerDragStart(server.id)}
                        onEdit={() => openServerEditor(server.id)}
                        onMoveToGroup={(currentServer, targetGroup) =>
                          void handleMoveServerGroup(currentServer, targetGroup)
                        }
                        onToggleFavorite={() => void toggleFavorite(server.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="space-y-1">
                <SectionHeader
                  title={t('workbench.primarySidebar.sections.tags')}
                  icon={<TagIcon className="size-3.5" />}
                  count={tags.length}
                  active={selectedExplorerNode === 'tags'}
                  collapsed={Boolean(collapsedSections.tags)}
                  onDoubleClick={() => toggleSection('tags')}
                  onSelect={() => setSelectedExplorerNode('tags')}
                  onToggle={() => toggleSection('tags')}
                  action={
                    <TooltipAction content={t('workbench.primarySidebar.actions.createTag')}>
                      <button
                        type="button"
                        className="flex size-5 shrink-0 items-center justify-center rounded-sm text-[var(--workbench-muted)] transition-all hover:bg-[var(--workbench-hover)] hover:text-foreground"
                        aria-label={t('workbench.primarySidebar.actions.createTag')}
                        onClick={() => openEntityQuickInput({ entityType: 'tag', mode: 'create' })}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </TooltipAction>
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
                            depth={1}
                            onClick={() => setSelectedExplorerNode(`tag:${tag.id}`)}
                            onDoubleClick={() =>
                              setExpandedTags((current) => ({
                                ...current,
                                [tag.id]: !expanded
                              }))
                            }
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
                                <CollapseIcon className="size-3.5" />
                              ) : (
                                <ExpandIcon className="size-3.5" />
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
                                  connected={connectedServerIds.has(server.id)}
                                  depth={2}
                                  dragging={draggedServerId === server.id}
                                  groups={groups}
                                  server={server}
                                  onSelect={() => setSelectedExplorerNode(`server:${server.id}`)}
                                  onConnect={() => void connectServer(server)}
                                  onDelete={() => setPendingDeleteServer(server)}
                                  onDragEnd={handleServerDragEnd}
                                  onDragStart={handleServerDragStart(server.id)}
                                  onEdit={() => openServerEditor(server.id)}
                                  onMoveToGroup={(currentServer, targetGroup) =>
                                    void handleMoveServerGroup(currentServer, targetGroup)
                                  }
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
                  title={t('workbench.primarySidebar.sections.recent')}
                  icon={<FolderTree className="size-3.5" />}
                  count={recents.length}
                  active={selectedExplorerNode === 'recent'}
                  collapsed={Boolean(collapsedSections.recent)}
                  onDoubleClick={() => toggleSection('recent')}
                  onSelect={() => setSelectedExplorerNode('recent')}
                  onToggle={() => toggleSection('recent')}
                  action={
                    <TooltipAction
                      content={t('workbench.primarySidebar.actions.clearRecent')}
                      side="right"
                    >
                      <button
                        type="button"
                        className="flex size-5 shrink-0 items-center justify-center rounded-sm text-[var(--workbench-muted)] transition-colors hover:bg-[var(--workbench-hover)] hover:text-foreground disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--workbench-muted)]"
                        aria-label={t('workbench.primarySidebar.actions.clearRecent')}
                        disabled={recents.length === 0}
                        onClick={() => void handleClearRecent()}
                      >
                        <ClearIcon className="size-3.5" />
                      </button>
                    </TooltipAction>
                  }
                />
                {!collapsedSections.recent ? (
                  <div className="space-y-0.5">
                    {recents.map((recent) => {
                      const server = servers.find((item) => item.id === recent.serverId)
                      if (!server) {
                        return null
                      }

                      return (
                        <ServerRow
                          key={recent.id}
                          active={false}
                          depth={1}
                          dragging={draggedServerId === server.id}
                          groups={groups}
                          server={server}
                          onConnect={() => void connectServer(server)}
                          onDelete={() => setPendingDeleteServer(server)}
                          onDragEnd={handleServerDragEnd}
                          onDragStart={handleServerDragStart(server.id)}
                          onEdit={() => openServerEditor(server.id)}
                          onMoveToGroup={(currentServer, targetGroup) =>
                            void handleMoveServerGroup(currentServer, targetGroup)
                          }
                          onToggleFavorite={() => void toggleFavorite(server.id)}
                        />
                      )
                    })}
                  </div>
                ) : null}
              </section>
            </>
          )}
        </div>
      </aside>

      <Dialog
        open={pendingDeleteServer !== null}
        onOpenChange={(open) => !open && closeDeleteServerDialog()}
      >
        <DialogContent
          className="max-w-md rounded-md border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-0 shadow-2xl"
          showCloseButton={false}
        >
          <DialogHeader className="border-b border-[var(--workbench-border)] px-4 py-4">
            <DialogTitle>{t('workbench.primarySidebar.dialogs.deleteServer.title')}</DialogTitle>
            <DialogDescription>
              {t('workbench.primarySidebar.dialogs.deleteServer.description', {
                name: pendingDeleteServer?.name ?? ''
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="border-t border-[var(--workbench-border)] px-4 py-3">
            <Button variant="ghost" disabled={isDeletingServer} onClick={closeDeleteServerDialog}>
              <CancelIcon className="size-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={isDeletingServer || !pendingDeleteServer}
              onClick={() => void handleDeleteServer()}
            >
              {isDeletingServer ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <DeleteIcon className="size-4" />
              )}
              {t('common.actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
