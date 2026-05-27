import { useState, useCallback, useRef, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  hasSftpMoveDragData,
  readSftpMoveDragData,
  clearSftpMoveDragData
} from '@/lib/terminal-path-dnd'
import { sftpClient } from '@/features/sftp/api/sftp-client'

export type DropValidationState =
  | 'idle'
  | 'valid'
  | 'invalid-self'
  | 'invalid-descendant'
  | 'invalid-same-dir'

export interface SftpMoveCompleteEvent {
  destinationDirPath: string
  kind: 'file' | 'directory'
  sourcePath: string
  targetPath: string
}

interface UseSftpEntryDropOptions {
  sessionId: string
  directoryPath: string
  onMoveComplete: (event: SftpMoveCompleteEvent) => void | Promise<void>
  onDirectoryMoved?: (oldPath: string, newPath: string) => void
}

function getMovedPath(sourcePath: string, directoryPath: string) {
  const lastSlash = sourcePath.lastIndexOf('/')
  const entryName = lastSlash >= 0 ? sourcePath.substring(lastSlash + 1) : sourcePath

  return directoryPath === '/' ? `/${entryName}` : `${directoryPath}/${entryName}`
}

function validateDrop(
  dragData: { path: string; kind: 'file' | 'directory' } | null,
  directoryPath: string
): DropValidationState {
  if (!dragData) return 'idle'

  const sourcePath = dragData.path

  if (sourcePath === directoryPath) {
    return 'invalid-self'
  }

  const lastSlash = sourcePath.lastIndexOf('/')
  const sourceParentPath = lastSlash > 0 ? sourcePath.substring(0, lastSlash) : '/'
  if (sourceParentPath === directoryPath) {
    return 'invalid-same-dir'
  }

  if (dragData.kind === 'directory' && directoryPath.startsWith(sourcePath + '/')) {
    return 'invalid-descendant'
  }

  return 'valid'
}

export function useSftpEntryDrop({
  sessionId,
  directoryPath,
  onMoveComplete,
  onDirectoryMoved
}: UseSftpEntryDropOptions) {
  const [dropState, setDropState] = useState<DropValidationState>('idle')
  const isHandlingRef = useRef(false)
  const { t } = useTranslation()

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!hasSftpMoveDragData(event.dataTransfer)) return

      event.preventDefault()
      event.stopPropagation()

      const dragData = readSftpMoveDragData()
      const state = validateDrop(dragData, directoryPath)
      setDropState(state)

      event.dataTransfer.dropEffect = state === 'valid' ? 'move' : 'none'
    },
    [directoryPath]
  )

  const handleDragEnter = useCallback(
    (event: DragEvent<HTMLElement>) => {
      if (!hasSftpMoveDragData(event.dataTransfer)) return

      event.preventDefault()
      event.stopPropagation()

      const dragData = readSftpMoveDragData()
      const state = validateDrop(dragData, directoryPath)
      setDropState(state)
    },
    [directoryPath]
  )

  const handleDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (!hasSftpMoveDragData(event.dataTransfer)) return

    const relatedTarget = event.relatedTarget as Node | null
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) {
      return
    }

    event.stopPropagation()
    setDropState('idle')
  }, [])

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLElement>) => {
      if (!hasSftpMoveDragData(event.dataTransfer)) return

      event.preventDefault()
      event.stopPropagation()

      const dragData = readSftpMoveDragData()
      const state = validateDrop(dragData, directoryPath)
      setDropState('idle')
      clearSftpMoveDragData()

      if (state !== 'valid' || !dragData) return
      if (isHandlingRef.current) return

      isHandlingRef.current = true
      try {
        await sftpClient.move(sessionId, dragData.path, directoryPath)
        const newPath = getMovedPath(dragData.path, directoryPath)

        if (dragData.kind === 'directory' && onDirectoryMoved) {
          onDirectoryMoved(dragData.path, newPath)
        }

        await onMoveComplete({
          destinationDirPath: directoryPath,
          kind: dragData.kind,
          sourcePath: dragData.path,
          targetPath: newPath
        })
      } catch {
        toast.error(t('workbench.sftp.toasts.moveFailed'))
      } finally {
        isHandlingRef.current = false
      }
    },
    [sessionId, directoryPath, onMoveComplete, onDirectoryMoved, t]
  )

  return {
    dropState,
    dropHandlers: {
      onDragOver: handleDragOver,
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop
    }
  }
}
