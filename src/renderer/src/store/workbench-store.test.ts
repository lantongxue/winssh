import { beforeEach, describe, expect, it } from 'vitest'
import {
  createServerEditorDocument,
  createSessionEditorDocument,
  createSettingsEditorDocument
} from '@/lib/workbench'
import { useWorkbenchStore } from './workbench-store'

describe('workbench store', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.getState().reset()
  })

  it('keeps the explorer home document pinned', () => {
    const store = useWorkbenchStore.getState()

    store.openDocument(createSettingsEditorDocument())
    store.closeDocument('explorer-home')

    const state = useWorkbenchStore.getState()
    expect(state.openDocuments[0]?.id).toBe('explorer-home')
    expect(state.openDocuments.map((document) => document.id)).toContain('settings-editor')
  })

  it('opens documents and syncs active activity from the focused document', () => {
    useWorkbenchStore.getState().openDocument(createSessionEditorDocument('session-1'))

    const state = useWorkbenchStore.getState()
    expect(state.activeActivityId).toBe('terminal')
    expect(state.activeDocumentId).toBe('session-editor:session-1')
  })

  it('replaces an existing document in place', () => {
    const store = useWorkbenchStore.getState()

    store.openDocument(createServerEditorDocument())
    store.replaceDocument('server-editor:new', createServerEditorDocument('server-1'))

    const state = useWorkbenchStore.getState()
    expect(state.openDocuments.map((document) => document.id)).toEqual([
      'explorer-home',
      'server-editor:server-1'
    ])
    expect(state.activeDocumentId).toBe('server-editor:server-1')
  })

  it('toggles command surfaces independently from panel visibility', () => {
    const store = useWorkbenchStore.getState()

    store.setCommandPaletteOpen(true)
    store.setQuickOpenOpen(true)
    store.togglePanel()

    const state = useWorkbenchStore.getState()
    expect(state.commandPaletteOpen).toBe(true)
    expect(state.quickOpenOpen).toBe(true)
    expect(state.panelOpen).toBe(true)
  })
})
