export const TERMINAL_PATH_DRAG_MIME = 'application/x-winssh-terminal-path'

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
