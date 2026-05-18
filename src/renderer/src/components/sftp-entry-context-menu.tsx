import { Folder } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RemoteEntry } from '@shared/types'
import { sftpClient } from '@/features/sftp/api/sftp-client'
import { actionIcons } from '@/lib/action-icons'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'

interface SftpEntryContextMenuProps {
  children: React.ReactNode
  sessionId: string
  singleContextTarget: RemoteEntry | null
  hasSingleContextTarget: boolean
  contextMenuTargets: RemoteEntry[]
  createTargetPath: string
  onOpenDirectory: (path: string) => void
  onEditFile?: (path: string) => void
  onRename: (entry: RemoteEntry) => void
  onRefresh: () => void
  onCopyEntryPaths: (entries: RemoteEntry[]) => void
  onSendPathToTerminal: (path: string) => void
  onOpenCreateFileDialog: (targetPath: string) => void
  onOpenCreateFolderDialog: (targetPath: string) => void
  onOpenDeleteDialog: (entries: RemoteEntry[]) => void
}

export function SftpEntryContextMenu({
  children,
  sessionId,
  singleContextTarget,
  hasSingleContextTarget,
  contextMenuTargets,
  createTargetPath,
  onOpenDirectory,
  onEditFile,
  onRename,
  onRefresh,
  onCopyEntryPaths,
  onSendPathToTerminal,
  onOpenCreateFileDialog,
  onOpenCreateFolderDialog,
  onOpenDeleteDialog
}: SftpEntryContextMenuProps) {
  const { t } = useTranslation()

  const EditIcon = actionIcons.edit
  const DownloadIcon = actionIcons.download
  const CopyIcon = actionIcons.clone
  const SendToTerminalIcon = actionIcons.openTerminal
  const RefreshIcon = actionIcons.refresh
  const NewFileIcon = actionIcons.newFile
  const NewFolderIcon = actionIcons.newFolder
  const RenameIcon = actionIcons.rename
  const DeleteIcon = actionIcons.delete

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="ml-2 mr-2">
        {singleContextTarget?.kind === 'directory' ? (
          <ContextMenuItem onClick={() => onOpenDirectory(singleContextTarget.path)}>
            <Folder className="size-4" />
            {t('workbench.sftp.actions.openDirectory')}
          </ContextMenuItem>
        ) : null}

        {singleContextTarget && singleContextTarget.kind !== 'directory' ? (
          onEditFile && singleContextTarget.kind === 'file' ? (
            <ContextMenuItem onClick={() => onEditFile(singleContextTarget.path)}>
              <EditIcon className="size-4" />
              {t('common.actions.edit')}
            </ContextMenuItem>
          ) : null
        ) : null}

        {singleContextTarget ? (
          <ContextMenuItem
            onClick={() =>
              void sftpClient.downloadFile(sessionId, singleContextTarget.path)
            }
          >
            <DownloadIcon className="size-4" />
            {t('common.actions.download')}
          </ContextMenuItem>
        ) : null}

        <ContextMenuItem onClick={() => void onCopyEntryPaths(contextMenuTargets)}>
          <CopyIcon className="size-4" />
          {t('workbench.sftp.actions.copyPath')}
        </ContextMenuItem>

        {singleContextTarget ? (
          <ContextMenuItem onClick={() => void onSendPathToTerminal(singleContextTarget.path)}>
            <SendToTerminalIcon className="size-4" />
            {t('workbench.sftp.actions.copyPathToTerminal')}
          </ContextMenuItem>
        ) : null}

        <ContextMenuItem onClick={() => void onRefresh()}>
          <RefreshIcon className="size-4" />
          {t('common.actions.refresh')}
        </ContextMenuItem>

        <ContextMenuItem onClick={() => onOpenCreateFileDialog(createTargetPath)}>
          <NewFileIcon className="size-4" />
          {t('common.actions.newFile')}
        </ContextMenuItem>

        <ContextMenuItem onClick={() => onOpenCreateFolderDialog(createTargetPath)}>
          <NewFolderIcon className="size-4" />
          {t('common.actions.newFolder')}
        </ContextMenuItem>

        {hasSingleContextTarget ? <ContextMenuSeparator /> : null}

        {singleContextTarget ? (
          <ContextMenuItem
            onClick={() => {
              onRename(singleContextTarget)
            }}
          >
            <RenameIcon className="size-4" />
            {t('common.actions.rename')}
          </ContextMenuItem>
        ) : null}

        <ContextMenuItem
          variant="destructive"
          onClick={() => onOpenDeleteDialog(contextMenuTargets)}
        >
          <DeleteIcon className="size-4" />
          {t('common.actions.delete')}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
