import { beforeEach, describe, expect, it } from 'vitest'
import {
  createServerEditorDocument,
  createSessionEditorDocument,
  createSettingsEditorDocument,
  MIN_TRANSFER_PANEL_REVEAL_SIZE_PX
} from '@/lib/workbench'
import { useWorkbenchStore } from './workbench-store'

describe('workbench store', () => {
  beforeEach(() => {
    localStorage.clear()
    useWorkbenchStore.getState().reset()
  })

  it('starts with no open documents and no active document', () => {
    const state = useWorkbenchStore.getState()

    expect(state.openDocuments).toEqual([])
    expect(state.activeDocumentId).toBeNull()
    expect(state.activeActivityId).toBe('explorer')
  })

  it('closing the last document returns to the tabless explorer fallback', () => {
    const store = useWorkbenchStore.getState()

    store.openDocument(createSettingsEditorDocument())
    store.closeDocument('settings-editor')

    const state = useWorkbenchStore.getState()
    expect(state.openDocuments).toEqual([])
    expect(state.activeDocumentId).toBeNull()
    expect(state.activeActivityId).toBe('explorer')
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
    expect(state.openDocuments.map((document) => document.id)).toEqual(['server-editor:server-1'])
    expect(state.activeDocumentId).toBe('server-editor:server-1')
  })

  it('clears ephemeral title overrides when a document closes', () => {
    const store = useWorkbenchStore.getState()

    store.openDocument(createSessionEditorDocument('session-1'))
    store.setDocumentTitleOverride('session-editor:session-1', 'Prod Shell')
    store.closeDocument('session-editor:session-1')

    const state = useWorkbenchStore.getState()
    expect(state.documentTitleOverrides['session-editor:session-1']).toBeUndefined()
  })

  it('moves ephemeral title overrides with replaced document ids', () => {
    const store = useWorkbenchStore.getState()

    store.openDocument(createSessionEditorDocument('pending-session'))
    store.setDocumentTitleOverride('session-editor:pending-session', 'Prod Shell')
    store.replaceDocument(
      'session-editor:pending-session',
      createSessionEditorDocument('session-1')
    )

    const state = useWorkbenchStore.getState()
    expect(state.documentTitleOverrides['session-editor:pending-session']).toBeUndefined()
    expect(state.documentTitleOverrides['session-editor:session-1']).toBe('Prod Shell')
  })

  it('moveDocument reorders tabs and keeps the active document stable', () => {
    const store = useWorkbenchStore.getState()

    store.openDocument(createSettingsEditorDocument())
    store.openDocument(createServerEditorDocument('server-1'))
    store.openDocument(createSessionEditorDocument('session-1'))
    store.setActiveDocument('session-editor:session-1')
    store.moveDocument('settings-editor', 3)

    const state = useWorkbenchStore.getState()
    expect(state.openDocuments.map((document) => document.id)).toEqual([
      'server-editor:server-1',
      'session-editor:session-1',
      'settings-editor'
    ])
    expect(state.activeDocumentId).toBe('session-editor:session-1')
    expect(state.activeActivityId).toBe('terminal')
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

  it('clears output entries without affecting other workbench state', () => {
    const store = useWorkbenchStore.getState()

    store.appendOutput({
      detail: 'session-1',
      level: 'info',
      message: 'Connected'
    })
    store.setActivePanel('output')
    store.setPanelOpen(true)
    store.clearOutput()

    const state = useWorkbenchStore.getState()
    expect(state.outputEntries).toEqual([])
    expect(state.activePanelId).toBe('output')
    expect(state.panelOpen).toBe(true)
  })

  it('reveals the transfers panel and enforces a minimum useful size', () => {
    const store = useWorkbenchStore.getState()

    store.setPanelSizePx(180)
    store.revealPanel('transfers', { minSizePx: MIN_TRANSFER_PANEL_REVEAL_SIZE_PX })

    const state = useWorkbenchStore.getState()
    expect(state.activePanelId).toBe('transfers')
    expect(state.panelOpen).toBe(true)
    expect(state.panelSizePx).toBe(MIN_TRANSFER_PANEL_REVEAL_SIZE_PX)
  })
})
