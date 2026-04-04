import { isMacPlatform } from '@/lib/platform'

export type WorkbenchShortcutId =
  | 'commandPalette'
  | 'newConnection'
  | 'quickOpen'
  | 'togglePanel'
  | 'toggleSidebar'

export type WorkbenchShortcutAction =
  | 'openCommandPalette'
  | 'openNewConnection'
  | 'openQuickOpen'
  | 'togglePanel'
  | 'toggleSidebar'

type KeyboardShortcutEvent = Pick<KeyboardEvent, 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>

export function getWorkbenchShortcutLabel(
  shortcutId: WorkbenchShortcutId,
  isMac = isMacPlatform()
) {
  const modifierLabel = isMac ? 'Cmd' : 'Ctrl'

  switch (shortcutId) {
    case 'commandPalette':
      return isMac ? `${modifierLabel}+P` : `${modifierLabel}+Shift+P`
    case 'newConnection':
      return `${modifierLabel}+N`
    case 'quickOpen':
      return isMac ? `${modifierLabel}+Shift+P` : `${modifierLabel}+P`
    case 'togglePanel':
      return `${modifierLabel}+J`
    case 'toggleSidebar':
      return `${modifierLabel}+B`
  }
}

export function resolveWorkbenchShortcutAction(
  event: KeyboardShortcutEvent,
  isMac = isMacPlatform()
): WorkbenchShortcutAction | null {
  if (!event.metaKey && !event.ctrlKey) {
    return null
  }

  const key = event.key.toLowerCase()

  if (key === 'b') {
    return 'toggleSidebar'
  }

  if (key === 'j') {
    return 'togglePanel'
  }

  if (key === 'n') {
    return 'openNewConnection'
  }

  if (key !== 'p') {
    return null
  }

  if (isMac) {
    return event.shiftKey ? 'openQuickOpen' : 'openCommandPalette'
  }

  return event.shiftKey ? 'openCommandPalette' : 'openQuickOpen'
}
