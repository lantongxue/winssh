import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { EllipsisVertical, File, Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getParentRemotePath } from '@shared/sftp'
import type { RemoteEntry } from '@shared/types'
import { formatFileSize } from '@/i18n/format'
import { actionIcons } from '@/lib/action-icons'
import type { SessionTab } from '@/store/sessions-store'
import { cn } from '@/lib/utils'
import { useSessionsStore } from '@/store/sessions-store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

interface SftpPanelProps {
  session: SessionTab | null
  className?: string
}

export function SftpPanel({ session, className }: SftpPanelProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const setCurrentPath = useSessionsStore((state) => state.setCurrentPath)
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameTarget, setRenameTarget] = useState<RemoteEntry | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const RefreshIcon = actionIcons.refresh
  const UploadIcon = actionIcons.upload
  const NewFolderIcon = actionIcons.newFolder
  const DownloadIcon = actionIcons.download
  const RenameIcon = actionIcons.rename
  const DeleteIcon = actionIcons.delete
  const CancelIcon = actionIcons.cancel
  const CreateIcon = actionIcons.newFolder
  const SaveIcon = actionIcons.save

  const listingQuery = useQuery({
    queryKey: ['sftp', session?.sessionId, session?.currentPath],
    queryFn: () => window.winsshApi.sftp.list(session!.sessionId, session!.currentPath),
    enabled: Boolean(session)
  })

  useEffect(() => {
    if (session && listingQuery.data?.path && listingQuery.data.path !== session.currentPath) {
      setCurrentPath(session.sessionId, listingQuery.data.path)
    }
  }, [listingQuery.data?.path, session, setCurrentPath])

  const segments = useMemo(() => {
    const currentPath = listingQuery.data?.path ?? session?.currentPath ?? '/'
    if (currentPath === '/') {
      return ['/']
    }

    const parts = currentPath.split('/').filter(Boolean)
    return ['/', ...parts]
  }, [listingQuery.data?.path, session?.currentPath])

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center bg-muted/20">
        <div className="max-w-xs text-center">
          <div className="mb-2 text-base font-medium">{t('workbench.sftp.empty.noSessionTitle')}</div>
          <div className="text-sm text-muted-foreground">
            {t('workbench.sftp.empty.noSessionDescription')}
          </div>
        </div>
      </div>
    )
  }

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['sftp', session.sessionId] })
  }

  const currentPath = listingQuery.data?.path ?? session.currentPath

  return (
    <>
      <div className={cn('flex h-full flex-col bg-background', className)}>
        <div className="border-b px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t('workbench.sftp.explorer')}</div>
              <div className="truncate text-xs text-muted-foreground">{session.serverName}</div>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" title={t('common.actions.refresh')} onClick={() => void refresh()}>
                <RefreshIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                title={t('common.actions.upload')}
                onClick={() =>
                  void window.winsshApi.sftp.uploadFiles(session.sessionId, currentPath).then(refresh)
                }
              >
                <UploadIcon className="size-4" />
              </Button>
              <Button
                size="icon-sm"
                title={t('common.actions.newFolder')}
                onClick={() => setNewFolderOpen(true)}
              >
                <NewFolderIcon className="size-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="mt-3 w-full">
            <div className="flex w-max items-center gap-1 pr-3">
              {segments.map((segment, index) => {
                const target = index === 0 ? '/' : `/${segments.slice(1, index + 1).join('/')}`
                const active = target === currentPath

                return (
                  <Button
                    key={`${segment}-${index}`}
                    type="button"
                    variant={active ? 'secondary' : 'ghost'}
                    size="xs"
                    className="max-w-36 justify-start"
                    onClick={() => setCurrentPath(session.sessionId, target)}
                  >
                    <span className="truncate">{segment === '/' ? t('common.labels.root') : segment}</span>
                  </Button>
                )
              })}
            </div>
          </ScrollArea>

          <Button
            variant="ghost"
            size="sm"
            className="mt-2 justify-start px-2"
            onClick={() => setCurrentPath(session.sessionId, getParentRemotePath(currentPath))}
          >
            <Folder className="size-4" />
            {t('workbench.sftp.actions.backToParent')}
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className="divide-y">
            {listingQuery.isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-9 rounded-md" />
                <Skeleton className="h-9 rounded-md" />
                <Skeleton className="h-9 rounded-md" />
              </div>
            ) : null}

            {listingQuery.data?.entries.map((entry) => (
              <div key={entry.path} className="group flex items-center justify-between px-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto min-h-0 flex-1 justify-start rounded-none px-1.5 py-1.5"
                  onDoubleClick={() => {
                    if (entry.kind === 'directory') {
                      setCurrentPath(session.sessionId, entry.path)
                    }
                  }}
                  onClick={() => {
                    if (entry.kind === 'directory') {
                      setCurrentPath(session.sessionId, entry.path)
                    }
                  }}
                >
                  <div className="flex size-6 items-center justify-center rounded-sm bg-muted text-muted-foreground">
                    {entry.kind === 'directory' ? (
                      <Folder className="size-3.5" />
                    ) : (
                      <File className="size-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-[13px] leading-5 font-medium">{entry.name}</div>
                    <div className="truncate text-[11px] leading-4 text-muted-foreground">
                      {entry.kind === 'directory'
                        ? t('workbench.sftp.kinds.directory')
                        : formatFileSize(Math.max(entry.size, 0))}
                    </div>
                  </div>
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-7"
                      title={t('common.actions.open')}
                    >
                      <EllipsisVertical className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {entry.kind === 'directory' ? (
                      <DropdownMenuItem onClick={() => setCurrentPath(session.sessionId, entry.path)}>
                        <Folder className="size-4" />
                        {t('workbench.sftp.actions.openDirectory')}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() =>
                          void window.winsshApi.sftp.downloadFile(session.sessionId, entry.path)
                        }
                      >
                        <DownloadIcon className="size-4" />
                        {t('common.actions.download')}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameTarget(entry)
                        setRenameValue(entry.name)
                      }}
                    >
                      <RenameIcon className="size-4" />
                      {t('common.actions.rename')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() =>
                        void window.winsshApi.sftp.remove(session.sessionId, entry.path).then(refresh)
                      }
                    >
                      <DeleteIcon className="size-4" />
                      {t('common.actions.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}

            {!listingQuery.isLoading && listingQuery.data?.entries.length === 0 ? (
              <div className="m-3 rounded-md border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
                {t('workbench.sftp.empty.directory')}
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('workbench.sftp.dialogs.createFolder')}</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder={t('workbench.sftp.placeholders.directoryName')}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewFolderOpen(false)}>
              <CancelIcon className="size-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={async () => {
                await window.winsshApi.sftp.mkdir(session.sessionId, currentPath, newFolderName)
                setNewFolderName('')
                setNewFolderOpen(false)
                await refresh()
              }}
            >
              <CreateIcon className="size-4" />
              {t('common.actions.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(renameTarget)} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>{t('workbench.sftp.dialogs.rename')}</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            placeholder={t('workbench.sftp.placeholders.rename')}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>
              <CancelIcon className="size-4" />
              {t('common.actions.cancel')}
            </Button>
            <Button
              onClick={async () => {
                if (!renameTarget) {
                  return
                }

                await window.winsshApi.sftp.rename(session.sessionId, renameTarget.path, renameValue)
                setRenameTarget(null)
                await refresh()
              }}
            >
              <SaveIcon className="size-4" />
              {t('common.actions.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
