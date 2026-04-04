import { describe, expect, it } from 'vitest'
import { getWorkbenchShortcutLabel, resolveWorkbenchShortcutAction } from '@/lib/workbench-shortcuts'

describe('resolveWorkbenchShortcutAction', () => {
  it('opens the new connection editor with Cmd+N on macOS', () => {
    expect(
      resolveWorkbenchShortcutAction(
        {
          ctrlKey: false,
          key: 'n',
          metaKey: true,
          shiftKey: false
        },
        true
      )
    ).toBe('openNewConnection')
  })

  it('opens the command palette with Cmd+P on macOS', () => {
    expect(
      resolveWorkbenchShortcutAction(
        {
          ctrlKey: false,
          key: 'p',
          metaKey: true,
          shiftKey: false
        },
        true
      )
    ).toBe('openCommandPalette')
  })

  it('keeps quick connect on Cmd+Shift+P for macOS', () => {
    expect(
      resolveWorkbenchShortcutAction(
        {
          ctrlKey: false,
          key: 'P',
          metaKey: true,
          shiftKey: true
        },
        true
      )
    ).toBe('openQuickOpen')
  })

  it('keeps the existing quick-open-first behavior on non-mac platforms', () => {
    expect(
      resolveWorkbenchShortcutAction(
        {
          ctrlKey: true,
          key: 'n',
          metaKey: false,
          shiftKey: false
        },
        false
      )
    ).toBe('openNewConnection')

    expect(
      resolveWorkbenchShortcutAction(
        {
          ctrlKey: true,
          key: 'p',
          metaKey: false,
          shiftKey: false
        },
        false
      )
    ).toBe('openQuickOpen')

    expect(
      resolveWorkbenchShortcutAction(
        {
          ctrlKey: true,
          key: 'p',
          metaKey: false,
          shiftKey: true
        },
        false
      )
    ).toBe('openCommandPalette')
  })
})

describe('getWorkbenchShortcutLabel', () => {
  it('returns macOS-specific labels for the command palette and quick connect', () => {
    expect(getWorkbenchShortcutLabel('commandPalette', true)).toBe('Cmd+P')
    expect(getWorkbenchShortcutLabel('quickOpen', true)).toBe('Cmd+Shift+P')
  })

  it('returns control-based labels for non-mac platforms', () => {
    expect(getWorkbenchShortcutLabel('commandPalette', false)).toBe('Ctrl+Shift+P')
    expect(getWorkbenchShortcutLabel('quickOpen', false)).toBe('Ctrl+P')
    expect(getWorkbenchShortcutLabel('toggleSidebar', false)).toBe('Ctrl+B')
  })
})
