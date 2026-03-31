import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Clock3,
  FolderTree,
  Heart,
  LoaderCircle,
  PencilLine,
  PlusCircle,
  Search,
  ServerCog,
  Tags,
  Terminal,
  Trash2
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { Server } from '@shared/types'
import type { GroupFormValues, TagFormValues } from '@shared/validation'
import { getColorStyle } from '@/lib/colors'
import { cn } from '@/lib/utils'
import { useSessionsStore } from '@/store/sessions-store'
import { ConnectionSecretsDialog } from '@/components/connection-secrets-dialog'
import { EntityManagerDialog } from '@/components/entity-manager-dialog'
import { ServerFormDialog } from '@/components/server-form-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

type ConnectionSource = 'table' | 'recent' | 'dialog'

interface ConnectingServerState {
  serverId: string
  serverName: string
  stageIndex: number
  source: ConnectionSource
}

const connectionStages = [
  '校验凭据与连接参数',
  '验证主机并协商 SSH 握手',
  '打开终端与 SFTP 通道',
  '整理会话上下文并准备跳转'
] as const

export function ServersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const addSession = useSessionsStore((state) => state.addSession)
  const [search, setSearch] = useState('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [groupFilter, setGroupFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [serverDialogOpen, setServerDialogOpen] = useState(false)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [tagDialogOpen, setTagDialogOpen] = useState(false)
  const [editingServer, setEditingServer] = useState<Server | null>(null)
  const [pendingSecretServer, setPendingSecretServer] = useState<Server | null>(null)
  const [connectingServers, setConnectingServers] = useState<Record<string, ConnectingServerState>>(
    {}
  )

  const deferredSearch = useDeferredValue(search.trim().toLowerCase())
  const connectingCount = Object.keys(connectingServers).length

  useEffect(() => {
    if (connectingCount === 0) {
      return
    }

    const timer = window.setInterval(() => {
      setConnectingServers((current) => {
        if (Object.keys(current).length === 0) {
          return current
        }

        return Object.fromEntries(
          Object.entries(current).map(([serverId, state]) => [
            serverId,
            {
              ...state,
              stageIndex: (state.stageIndex + 1) % connectionStages.length
            }
          ])
        )
      })
    }, 1100)

    return () => window.clearInterval(timer)
  }, [connectingCount])

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
  const capabilitiesQuery = useQuery({
    queryKey: ['capabilities'],
    queryFn: () => window.winsshApi.system.getCapabilities()
  })

  const refreshData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['servers'] }),
      queryClient.invalidateQueries({ queryKey: ['groups'] }),
      queryClient.invalidateQueries({ queryKey: ['tags'] }),
      queryClient.invalidateQueries({ queryKey: ['recent-sessions'] })
    ])
  }

  const startConnectionVisual = (server: Server, source: ConnectionSource) => {
    setConnectingServers((current) => ({
      ...current,
      [server.id]: {
        serverId: server.id,
        serverName: server.name,
        stageIndex: 0,
        source
      }
    }))
  }

  const clearConnectionVisual = (serverId: string) => {
    setConnectingServers((current) => {
      if (!current[serverId]) {
        return current
      }

      const next = { ...current }
      delete next[serverId]
      return next
    })
  }

  const saveServer = useMutation({
    mutationFn: async (payload: Parameters<typeof window.winsshApi.servers.create>[0]) => {
      if (editingServer) {
        return window.winsshApi.servers.update(editingServer.id, payload)
      }
      return window.winsshApi.servers.create(payload)
    },
    onSuccess: async () => {
      toast.success(editingServer ? '服务器已更新' : '服务器已创建')
      setServerDialogOpen(false)
      setEditingServer(null)
      await refreshData()
    }
  })

  const filteredServers = useMemo(() => {
    return (serversQuery.data ?? []).filter((server) => {
      if (favoriteOnly && !server.favorite) {
        return false
      }
      if (groupFilter !== 'all' && server.groupId !== groupFilter) {
        return false
      }
      if (tagFilter !== 'all' && !server.tags.some((tag) => tag.id === tagFilter)) {
        return false
      }
      if (!deferredSearch) {
        return true
      }

      const haystack = [
        server.name,
        server.host,
        server.username,
        server.note ?? '',
        server.group?.name ?? '',
        ...server.tags.map((tag) => tag.name)
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(deferredSearch)
    })
  }, [deferredSearch, favoriteOnly, groupFilter, serversQuery.data, tagFilter])

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const server of serversQuery.data ?? []) {
      if (server.groupId) {
        counts.set(server.groupId, (counts.get(server.groupId) ?? 0) + 1)
      }
    }
    return counts
  }, [serversQuery.data])

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const server of serversQuery.data ?? []) {
      for (const tag of server.tags) {
        counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1)
      }
    }
    return counts
  }, [serversQuery.data])

  const connectServer = async (
    server: Server,
    extra?: Parameters<typeof window.winsshApi.sessions.connect>[0],
    source: ConnectionSource = 'table'
  ) => {
    startConnectionVisual(server, source)

    try {
      const summary = await window.winsshApi.sessions.connect(extra ?? { serverId: server.id })
      addSession(summary)
      toast.success(`已连接到 ${server.name}`)
      startTransition(() => navigate('/sessions'))
      await refreshData()
      setPendingSecretServer(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '连接失败')
    } finally {
      clearConnectionVisual(server.id)
    }
  }

  const connectRecent = async (serverId: string) => {
    const server = (serversQuery.data ?? []).find((item) => item.id === serverId)
    if (!server) {
      toast.error('未找到对应的服务器配置')
      await refreshData()
      return
    }

    const requiresPrompt =
      (server.authType === 'password' && !server.hasPassword) ||
      (server.authType === 'privateKey' && !server.hasPassphrase)

    if (requiresPrompt) {
      setPendingSecretServer(server)
      return
    }

    await connectServer(server, undefined, 'recent')
  }

  const totalServers = serversQuery.data?.length ?? 0
  const favoriteServers = (serversQuery.data ?? []).filter((server) => server.favorite).length
  const activeConnection = Object.values(connectingServers)[0] ?? null
  const activeConnectionStage = activeConnection
    ? connectionStages[activeConnection.stageIndex]
    : null
  const activeConnectionHint = activeConnection
    ? activeConnection.source === 'dialog'
      ? '凭据已提交，正在继续建立连接'
      : activeConnection.source === 'recent'
        ? '从最近连接记录重新发起连接'
        : '正在根据当前服务器配置建立会话'
    : null

  return (
    <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="flex min-h-0 flex-col overflow-hidden">
        <div className="border-b px-4 py-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">连接资源</h2>
            <p className="text-xs text-muted-foreground">搜索、筛选并组织已保存的 SSH 连接目标。</p>
          </div>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
              placeholder="搜索名称、主机、用户、备注或标签"
            />
          </div>
          {capabilitiesQuery.data?.credentialStorage === false ? (
            <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-200">
              当前环境未检测到系统钥匙串。密码和私钥口令不会被持久保存。
            </div>
          ) : null}
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 p-4">
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium tracking-wide text-muted-foreground">
                  快速视图
                </div>
                <Badge variant="secondary">{filteredServers.length} 条结果</Badge>
              </div>
              <div className="grid gap-1">
                <Button
                  variant={!favoriteOnly ? 'secondary' : 'ghost'}
                  size="sm"
                  className="justify-between"
                  onClick={() => setFavoriteOnly(false)}
                >
                  <span className="flex items-center gap-2">
                    <ServerCog className="size-4" />
                    全部服务器
                  </span>
                  <span className="text-xs text-muted-foreground">{totalServers}</span>
                </Button>
                <Button
                  variant={favoriteOnly ? 'secondary' : 'ghost'}
                  size="sm"
                  className="justify-between"
                  onClick={() => setFavoriteOnly(true)}
                >
                  <span className="flex items-center gap-2">
                    <Heart className="size-4" />
                    仅看收藏
                  </span>
                  <span className="text-xs text-muted-foreground">{favoriteServers}</span>
                </Button>
              </div>
            </section>

            <Separator />

            <section className="space-y-2">
              <div className="text-xs font-medium tracking-wide text-muted-foreground">分组</div>
              <div className="grid gap-1">
                <Button
                  variant={groupFilter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="justify-between"
                  onClick={() => setGroupFilter('all')}
                >
                  <span className="flex items-center gap-2">
                    <FolderTree className="size-4" />
                    全部分组
                  </span>
                  <span className="text-xs text-muted-foreground">{totalServers}</span>
                </Button>
                {(groupsQuery.data ?? []).map((group) => {
                  const style = getColorStyle(group.color)
                  const active = groupFilter === group.id

                  return (
                    <Button
                      key={group.id}
                      variant={active ? 'outline' : 'ghost'}
                      size="sm"
                      className={`justify-between ${active ? `${style.badge} ${style.ring} ring-1` : ''}`}
                      onClick={() => setGroupFilter(group.id)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`size-2 rounded-full ${style.dot}`} />
                        <span className="truncate">{group.name}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {groupCounts.get(group.id) ?? 0}
                      </span>
                    </Button>
                  )
                })}
                {(groupsQuery.data ?? []).length === 0 ? (
                  <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    还没有分组，使用右侧工具栏创建。
                  </div>
                ) : null}
              </div>
            </section>

            <Separator />

            <section className="space-y-2">
              <div className="text-xs font-medium tracking-wide text-muted-foreground">标签</div>
              <div className="grid gap-1">
                <Button
                  variant={tagFilter === 'all' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="justify-between"
                  onClick={() => setTagFilter('all')}
                >
                  <span className="flex items-center gap-2">
                    <Tags className="size-4" />
                    全部标签
                  </span>
                  <span className="text-xs text-muted-foreground">{totalServers}</span>
                </Button>
                {(tagsQuery.data ?? []).map((tag) => {
                  const style = getColorStyle(tag.color)
                  const active = tagFilter === tag.id

                  return (
                    <Button
                      key={tag.id}
                      variant={active ? 'outline' : 'ghost'}
                      size="sm"
                      className={`justify-between ${active ? `${style.badge} ${style.ring} ring-1` : ''}`}
                      onClick={() => setTagFilter(tag.id)}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className={`size-2 rounded-full ${style.dot}`} />
                        <span className="truncate">{tag.name}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {tagCounts.get(tag.id) ?? 0}
                      </span>
                    </Button>
                  )
                })}
                {(tagsQuery.data ?? []).length === 0 ? (
                  <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    还没有标签，使用右侧工具栏创建。
                  </div>
                ) : null}
              </div>
            </section>

            <Separator />

            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground">
                <Clock3 className="size-3.5" />
                最近连接
              </div>
              {(recentQuery.data ?? []).length > 0 ? (
                <div className="grid gap-1">
                  {(recentQuery.data ?? []).map((recent) => {
                    const isConnecting = Boolean(connectingServers[recent.serverId])

                    return (
                      <Button
                        key={recent.id}
                        variant="ghost"
                        disabled={isConnecting}
                        className="h-auto justify-start px-3 py-2"
                        onClick={() => void connectRecent(recent.serverId)}
                      >
                        <div className="min-w-0 text-left">
                          <div className="flex items-center gap-2">
                            {isConnecting ? (
                              <LoaderCircle className="size-3.5 animate-spin text-sky-500" />
                            ) : null}
                            <div className="truncate text-sm font-medium">{recent.serverName}</div>
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {isConnecting
                              ? connectionStages[connectingServers[recent.serverId].stageIndex]
                              : `${recent.host} · ${new Date(recent.connectedAt).toLocaleString()}`}
                          </div>
                        </div>
                      </Button>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
                  暂无最近连接记录。
                </div>
              )}
            </section>
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex flex-col gap-3 border-b px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold">服务器列表</h2>
            <p className="text-xs text-muted-foreground">
              集中查看连接地址、认证方式、标签和最近连接状态。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setGroupDialogOpen(true)}>
              <FolderTree className="size-4" />
              分组管理
            </Button>
            <Button variant="outline" size="sm" onClick={() => setTagDialogOpen(true)}>
              <Tags className="size-4" />
              标签管理
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditingServer(null)
                setServerDialogOpen(true)
              }}
            >
              <PlusCircle className="size-4" />
              新建服务器
            </Button>
          </div>
        </div>

        {activeConnection ? (
          <div className="border-b px-4 py-3">
            <div className="relative overflow-hidden rounded-xl border border-sky-400/25 bg-sky-500/10 px-4 py-3">
              <div className="connection-sheen absolute inset-y-0 left-0 w-24 bg-linear-to-r from-transparent via-white/45 to-transparent dark:via-white/10" />
              <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="relative mt-0.5">
                    <span className="absolute inset-0 rounded-full bg-sky-400/30 animate-ping" />
                    <span className="relative flex size-9 items-center justify-center rounded-full bg-sky-500/15 text-sky-700 dark:text-sky-200">
                      <LoaderCircle className="size-4 animate-spin" />
                    </span>
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="text-sm font-semibold text-sky-900 dark:text-sky-100">
                      正在连接 {activeConnection.serverName}
                    </div>
                    <div className="text-xs text-sky-800/80 dark:text-sky-200/80">
                      {activeConnectionStage}
                    </div>
                    <div className="text-xs text-sky-800/70 dark:text-sky-200/70">
                      {activeConnectionHint}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-sky-800/80 dark:text-sky-200/80">
                  <span className="flex items-center gap-1.5">
                    <span className="connection-dot size-1.5 rounded-full bg-sky-500" />
                    <span className="connection-dot size-1.5 rounded-full bg-sky-500" />
                    <span className="connection-dot size-1.5 rounded-full bg-sky-500" />
                  </span>
                  <span>
                    {connectingCount > 1
                      ? `还有 ${connectingCount - 1} 个连接排队处理中`
                      : '连接完成后将自动跳转到会话页'}
                  </span>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sky-500/10">
                <div className="connection-progress-bar h-full rounded-full bg-linear-to-r from-sky-400 via-cyan-400 to-sky-500" />
              </div>
            </div>
          </div>
        ) : null}

        <ScrollArea className="min-h-0 flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>目标</TableHead>
                <TableHead>分组 / 标签</TableHead>
                <TableHead>认证</TableHead>
                <TableHead>最近连接</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredServers.map((server) => {
                const connectingState = connectingServers[server.id]
                const isConnecting = Boolean(connectingState)
                const connectingStage = connectingState
                  ? connectionStages[connectingState.stageIndex]
                  : null

                return (
                  <TableRow
                    key={server.id}
                    className={cn(
                      'transition-colors hover:bg-muted/40',
                      isConnecting && 'bg-sky-500/5'
                    )}
                  >
                    <TableCell className="align-top">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{server.name}</span>
                          {server.favorite ? (
                            <Heart className="size-4 fill-amber-400 text-amber-400" />
                          ) : null}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {server.username}@{server.host}:{server.port}
                        </div>
                        {server.note ? (
                          <div className="max-w-xl text-sm text-muted-foreground">
                            {server.note}
                          </div>
                        ) : null}
                        {isConnecting ? (
                          <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-700 dark:text-sky-200">
                            <span className="flex items-center gap-1.5">
                              <span className="connection-dot size-1.5 rounded-full bg-sky-500" />
                              <span className="connection-dot size-1.5 rounded-full bg-sky-500" />
                              <span className="connection-dot size-1.5 rounded-full bg-sky-500" />
                            </span>
                            <span className="truncate">{connectingStage}</span>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-2">
                        {server.group ? (
                          <Badge
                            variant="outline"
                            className={getColorStyle(server.group.color).badge}
                          >
                            {server.group.name}
                          </Badge>
                        ) : (
                          <Badge variant="outline">未分组</Badge>
                        )}
                        {server.tags.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className={getColorStyle(tag.color).badge}
                          >
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1 text-sm">
                        <div>{server.authType === 'password' ? '密码认证' : '私钥认证'}</div>
                        <div className="text-muted-foreground">
                          {server.authType === 'password'
                            ? server.hasPassword
                              ? '密码已保存'
                              : '连接时输入密码'
                            : server.hasPassphrase
                              ? '口令已保存'
                              : '连接时可选输入口令'}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">
                      {server.lastConnectedAt
                        ? new Date(server.lastConnectedAt).toLocaleString()
                        : '从未连接'}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          disabled={isConnecting}
                          className={cn(
                            isConnecting &&
                              'bg-sky-600 text-white hover:bg-sky-600 disabled:opacity-100'
                          )}
                          onClick={() => {
                            const requiresPrompt =
                              (server.authType === 'password' && !server.hasPassword) ||
                              (server.authType === 'privateKey' && !server.hasPassphrase)
                            if (requiresPrompt) {
                              setPendingSecretServer(server)
                            } else {
                              void connectServer(server)
                            }
                          }}
                        >
                          {isConnecting ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <Terminal className="size-4" />
                          )}
                          {isConnecting ? '连接中' : '连接'}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={isConnecting}
                          onClick={async () => {
                            await window.winsshApi.servers.toggleFavorite(server.id)
                            await refreshData()
                          }}
                        >
                          <Heart
                            className={`size-4 ${server.favorite ? 'fill-amber-400 text-amber-400' : ''}`}
                          />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={isConnecting}
                          onClick={() => {
                            setEditingServer(server)
                            setServerDialogOpen(true)
                          }}
                        >
                          <PencilLine className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          disabled={isConnecting}
                          onClick={async () => {
                            await window.winsshApi.servers.delete(server.id)
                            toast.success('服务器已删除')
                            await refreshData()
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}

              {filteredServers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-16 text-center text-sm text-muted-foreground"
                  >
                    当前筛选条件下没有匹配的服务器。
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      <ServerFormDialog
        open={serverDialogOpen}
        onOpenChange={setServerDialogOpen}
        server={editingServer}
        groups={groupsQuery.data ?? []}
        tags={tagsQuery.data ?? []}
        credentialStorageAvailable={capabilitiesQuery.data?.credentialStorage ?? false}
        onSubmit={async (payload) => {
          await saveServer.mutateAsync(payload)
        }}
      />

      <EntityManagerDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        type="group"
        items={groupsQuery.data ?? []}
        onCreate={async (input) => {
          await window.winsshApi.groups.create(input as GroupFormValues)
          await refreshData()
          toast.success('分组已创建')
        }}
        onUpdate={async (id, input) => {
          await window.winsshApi.groups.update(id, input as GroupFormValues)
          await refreshData()
          toast.success('分组已更新')
        }}
        onDelete={async (id) => {
          await window.winsshApi.groups.delete(id)
          await refreshData()
          toast.success('分组已删除')
        }}
      />

      <EntityManagerDialog
        open={tagDialogOpen}
        onOpenChange={setTagDialogOpen}
        type="tag"
        items={tagsQuery.data ?? []}
        onCreate={async (input) => {
          await window.winsshApi.tags.create(input as TagFormValues)
          await refreshData()
          toast.success('标签已创建')
        }}
        onUpdate={async (id, input) => {
          await window.winsshApi.tags.update(id, input as TagFormValues)
          await refreshData()
          toast.success('标签已更新')
        }}
        onDelete={async (id) => {
          await window.winsshApi.tags.delete(id)
          await refreshData()
          toast.success('标签已删除')
        }}
      />

      <ConnectionSecretsDialog
        open={Boolean(pendingSecretServer)}
        onOpenChange={(open) => !open && setPendingSecretServer(null)}
        server={pendingSecretServer}
        credentialStorageAvailable={capabilitiesQuery.data?.credentialStorage ?? false}
        onConfirm={async (request) => {
          if (!pendingSecretServer) {
            return
          }

          await connectServer(pendingSecretServer, request, 'dialog')
        }}
      />
    </div>
  )
}
