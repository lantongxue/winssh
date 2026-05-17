export const TERMINAL_PATH_DRAG_MIME = 'application/x-winssh-terminal-path'

export const SFTP_MOVE_DRAG_MIME = 'application/x-winssh-sftp-move'

interface SftpMoveDragData {
  path: string
  kind: 'file' | 'directory'
}

let currentMoveDragData: SftpMoveDragData | null = null

function normalizeTerminalPath(path: string | null | undefined) {
  const trimmedPath = path?.trim()

  return trimmedPath ? trimmedPath : null
}

export function hasTerminalPathDragData(dataTransfer: DataTransfer | null | undefined) {
  return Array.from(dataTransfer?.types ?? []).includes(TERMINAL_PATH_DRAG_MIME)
}

export function readTerminalPathDragData(dataTransfer: DataTransfer | null | undefined) {
  return normalizeTerminalPath(dataTransfer?.getData(TERMINAL_PATH_DRAG_MIME))
}

export function writeTerminalPathDragData(
  dataTransfer: DataTransfer | null | undefined,
  path: string | null | undefined
) {
  const normalizedPath = normalizeTerminalPath(path)

  if (!dataTransfer || !normalizedPath) {
    return false
  }

  dataTransfer.effectAllowed = 'copy'
  dataTransfer.setData(TERMINAL_PATH_DRAG_MIME, normalizedPath)
  dataTransfer.setData('text/plain', normalizedPath)

  return true
}

export function hasSftpMoveDragData(dataTransfer: DataTransfer | null | undefined) {
  return Array.from(dataTransfer?.types ?? []).includes(SFTP_MOVE_DRAG_MIME)
}

export function readSftpMoveDragData(): SftpMoveDragData | null {
  return currentMoveDragData
}

export function writeSftpMoveDragData(
  dataTransfer: DataTransfer | null | undefined,
  path: string,
  kind: 'file' | 'directory'
) {
  if (!dataTransfer || !path.trim()) {
    return false
  }

  currentMoveDragData = { path, kind }
  dataTransfer.effectAllowed = 'copyMove'
  dataTransfer.setData(SFTP_MOVE_DRAG_MIME, JSON.stringify({ path, kind }))
  return true
}

export function clearSftpMoveDragData() {
  currentMoveDragData = null
}
