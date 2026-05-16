import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  WorkbenchActivityId,
  WorkbenchDocument,
  WorkbenchDocumentId,
  WorkbenchExplorerNodeId,
  WorkbenchExplorerSectionId,
  WorkbenchOutputEntry,
  WorkbenchPanelId,
  WorkbenchProblemEntry,
  WorkbenchTransferEntry
} from '@/lib/workbench'
import {
  createTransferEntryId,
  DEFAULT_WORKBENCH_BOTTOM_PANEL_SIZE_PX,
  getDocumentActivity
} from '@/lib/workbench'

interface WorkbenchStateData {
  activeActivityId: WorkbenchActivityId
  activeDocumentId: WorkbenchDocumentId | null
  activePanelId: WorkbenchPanelId
  batchProgress: Record<string, { total: number; completed: number }>
  collapsedSections: Partial<Record<WorkbenchExplorerSectionId, boolean>>
  commandPaletteOpen: boolean
  documentTitleOverrides: Partial<Record<WorkbenchDocumentId, string>>
  openDocuments: WorkbenchDocument[]
  outputEntries: WorkbenchOutputEntry[]
  panelOpen: boolean
  panelSizePx: number
  problems: WorkbenchProblemEntry[]
  quickOpenOpen: boolean
  selectedExplorerNode: WorkbenchExplorerNodeId
  sftpPanelSide: 'left' | 'right'
  sidebarOpen: boolean
  transferEntries: WorkbenchTransferEntry[]
}

interface WorkbenchState extends WorkbenchStateData {
  appendOutput: (entry: Omit<WorkbenchOutputEntry, 'id' | 'createdAt'>) => void
  clearOutput: () => void
  clearProblems: () => void
  clearDocumentTitleOverride: (documentId: WorkbenchDocumentId) => void
  clearTransfers: () => void
  closeDocument: (documentId: WorkbenchDocumentId) => void
  dismissProblem: (problemId: string) => void
  moveDocument: (documentId: WorkbenchDocumentId, targetIndex: number) => void
  openDocument: (document: WorkbenchDocument) => void
  pushProblem: (problem: Omit<WorkbenchProblemEntry, 'createdAt'>) => void
  replaceDocument: (currentDocumentId: WorkbenchDocumentId, document: WorkbenchDocument) => void
  reset: () => void
  revealPanel: (
    panelId: WorkbenchPanelId,
    options?: {
      minSizePx?: number
    }
  ) => void
  setActiveActivity: (activityId: WorkbenchActivityId) => void
  setActiveDocument: (documentId: WorkbenchDocumentId | null) => void
  setActivePanel: (panelId: WorkbenchPanelId) => void
  setCommandPaletteOpen: (open: boolean) => void
  setDocumentTitleOverride: (documentId: WorkbenchDocumentId, title: string) => void
  setPanelOpen: (open: boolean) => void
  setPanelSizePx: (sizePx: number) => void
  setQuickOpenOpen: (open: boolean) => void
  setSelectedExplorerNode: (nodeId: WorkbenchExplorerNodeId) => void
  setSftpPanelSide: (side: 'left' | 'right') => void
  setSidebarOpen: (open: boolean) => void
  togglePanel: () => void
  toggleSection: (sectionId: WorkbenchExplorerSectionId) => void
  toggleSidebar: () => void
  updateBatchProgress: (batchId: string, total: number) => void
  upsertTransfer: (entry: Omit<WorkbenchTransferEntry, 'id' | 'updatedAt'>) => void
}

function normalizePanelSizePx(sizePx: number) {
  if (!Number.isFinite(sizePx)) {
    return DEFAULT_WORKBENCH_BOTTOM_PANEL_SIZE_PX
  }

  return Math.max(160, Math.round(sizePx))
}

function normalizeDocuments(documents: WorkbenchDocument[]): WorkbenchDocument[] {
  const seen = new Set<WorkbenchDocumentId>()
  const next: WorkbenchDocument[] = []

  for (const document of documents) {
    if (seen.has(document.id)) {
      continue
    }

    seen.add(document.id)
    next.push(document)
  }

  return next
}

function getFallbackDocumentId(
  documents: WorkbenchDocument[],
  closingDocumentId: WorkbenchDocumentId
): WorkbenchDocumentId | null {
  const closingIndex = documents.findIndex((document) => document.id === closingDocumentId)
  const remaining = documents.filter((document) => document.id !== closingDocumentId)

  if (remaining.length === 0) {
    return null
  }

  return remaining[Math.min(closingIndex, remaining.length - 1)]?.id ?? null
}

function createInitialState(): WorkbenchStateData {
  return {
    activeActivityId: 'explorer',
    activeDocumentId: null,
    activePanelId: 'output',
    batchProgress: {},
    collapsedSections: {},
    commandPaletteOpen: false,
    documentTitleOverrides: {},
    openDocuments: [],
    outputEntries: [],
    panelOpen: false,
    panelSizePx: DEFAULT_WORKBENCH_BOTTOM_PANEL_SIZE_PX,
    problems: [],
    quickOpenOpen: false,
    selectedExplorerNode: 'home',
    sftpPanelSide: 'left',
    sidebarOpen: true,
    transferEntries: []
  }
}

export const useWorkbenchStore = create<WorkbenchState>()(
  persist(
    (set) => ({
      ...createInitialState(),
      appendOutput: (entry) =>
        set((state) => ({
          outputEntries: [
            {
              ...entry,
              createdAt: new Date().toISOString(),
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
            },
            ...state.outputEntries
          ].slice(0, 120)
        })),
      clearOutput: () => set({ outputEntries: [] }),
      clearDocumentTitleOverride: (documentId) =>
        set((state) => {
          if (!state.documentTitleOverrides[documentId]) {
            return state
          }

          const nextOverrides = { ...state.documentTitleOverrides }
          delete nextOverrides[documentId]

          return {
            documentTitleOverrides: nextOverrides
          }
        }),
      clearProblems: () => set({ problems: [] }),
      clearTransfers: () => set({ transferEntries: [], batchProgress: {} }),
      closeDocument: (documentId) =>
        set((state) => {
          const currentDocuments = normalizeDocuments(state.openDocuments)

          if (!currentDocuments.some((document) => document.id === documentId)) {
            return state
          }

          const nextDocuments = normalizeDocuments(
            currentDocuments.filter((document) => document.id !== documentId)
          )

          const nextActiveDocumentId =
            state.activeDocumentId === documentId
              ? getFallbackDocumentId(currentDocuments, documentId)
              : state.activeDocumentId

          const nextActiveDocument =
            nextDocuments.find((document) => document.id === nextActiveDocumentId) ?? null
          const nextTitleOverrides = { ...state.documentTitleOverrides }
          delete nextTitleOverrides[documentId]

          return {
            activeActivityId: getDocumentActivity(nextActiveDocument),
            activeDocumentId: nextActiveDocumentId,
            documentTitleOverrides: nextTitleOverrides,
            openDocuments: nextDocuments
          }
        }),
      dismissProblem: (problemId) =>
        set((state) => ({
          problems: state.problems.filter((problem) => problem.id !== problemId)
        })),
      openDocument: (document) =>
        set((state) => {
          const openDocuments = normalizeDocuments([...state.openDocuments, document])
          return {
            activeActivityId: getDocumentActivity(document),
            activeDocumentId: document.id,
            openDocuments
          }
        }),
      moveDocument: (documentId, targetIndex) =>
        set((state) => {
          const currentDocuments = normalizeDocuments(state.openDocuments)
          const currentIndex = currentDocuments.findIndex((document) => document.id === documentId)

          if (currentIndex === -1) {
            return state
          }

          const document = currentDocuments[currentIndex]
          const remaining = currentDocuments.filter(
            (currentDocument) => currentDocument.id !== documentId
          )
          const normalizedIndex =
            targetIndex > currentIndex
              ? Math.max(0, Math.min(targetIndex - 1, remaining.length))
              : Math.max(0, Math.min(targetIndex, remaining.length))

          remaining.splice(normalizedIndex, 0, document)

          return {
            openDocuments: remaining
          }
        }),
      pushProblem: (problem) =>
        set((state) => ({
          panelOpen: true,
          activePanelId: 'problems',
          problems: [{ ...problem, createdAt: new Date().toISOString() }, ...state.problems].slice(
            0,
            60
          )
        })),
      replaceDocument: (currentDocumentId, document) =>
        set((state) => {
          const currentDocuments = normalizeDocuments(state.openDocuments)
          const replaceIndex = currentDocuments.findIndex(
            (currentDocument) => currentDocument.id === currentDocumentId
          )

          if (replaceIndex === -1) {
            const openDocuments = normalizeDocuments([...currentDocuments, document])
            return {
              activeActivityId: getDocumentActivity(document),
              activeDocumentId: document.id,
              openDocuments
            }
          }

          const nextDocuments = normalizeDocuments(
            currentDocuments.map((currentDocument, index) =>
              index === replaceIndex ? document : currentDocument
            )
          )
          const currentOverride = state.documentTitleOverrides[currentDocumentId]
          const nextTitleOverrides = { ...state.documentTitleOverrides }

          if (document.id !== currentDocumentId) {
            delete nextTitleOverrides[currentDocumentId]

            if (currentOverride) {
              nextTitleOverrides[document.id] = currentOverride
            }
          }

          return {
            activeActivityId: getDocumentActivity(document),
            activeDocumentId:
              state.activeDocumentId === currentDocumentId ? document.id : state.activeDocumentId,
            documentTitleOverrides: nextTitleOverrides,
            openDocuments: nextDocuments
          }
        }),
      reset: () => set(createInitialState()),
      revealPanel: (panelId, options) =>
        set((state) => {
          const nextPanelSizePx = options?.minSizePx
            ? Math.max(state.panelSizePx, normalizePanelSizePx(options.minSizePx))
            : state.panelSizePx

          if (
            state.activePanelId === panelId &&
            state.panelOpen &&
            state.panelSizePx === nextPanelSizePx
          ) {
            return state
          }

          return {
            activePanelId: panelId,
            panelOpen: true,
            panelSizePx: nextPanelSizePx
          }
        }),
      setActiveActivity: (activityId) => set({ activeActivityId: activityId }),
      setActiveDocument: (documentId) =>
        set((state) => {
          if (documentId === null) {
            return {
              activeActivityId: 'explorer',
              activeDocumentId: null
            }
          }

          const activeDocument = state.openDocuments.find((document) => document.id === documentId)

          if (!activeDocument) {
            return state
          }

          return {
            activeActivityId: getDocumentActivity(activeDocument),
            activeDocumentId: documentId
          }
        }),
      setActivePanel: (panelId) => set({ activePanelId: panelId }),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setDocumentTitleOverride: (documentId, title) =>
        set((state) => ({
          documentTitleOverrides: {
            ...state.documentTitleOverrides,
            [documentId]: title
          }
        })),
      setPanelOpen: (open) => set({ panelOpen: open }),
      setPanelSizePx: (sizePx) =>
        set((state) => {
          const nextPanelSizePx = normalizePanelSizePx(sizePx)

          if (state.panelSizePx === nextPanelSizePx) {
            return state
          }

          return {
            panelSizePx: nextPanelSizePx
          }
        }),
      setQuickOpenOpen: (open) => set({ quickOpenOpen: open }),
      setSelectedExplorerNode: (nodeId) => set({ selectedExplorerNode: nodeId }),
      setSftpPanelSide: (side) => set({ sftpPanelSide: side }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      togglePanel: () => set((state) => ({ panelOpen: !state.panelOpen })),
      toggleSection: (sectionId) =>
        set((state) => ({
          collapsedSections: {
            ...state.collapsedSections,
            [sectionId]: !state.collapsedSections[sectionId]
          }
        })),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      updateBatchProgress: (batchId, total) =>
        set((state) => {
          const current = state.batchProgress[batchId]
          const completed = (current?.completed ?? 0) + 1
          return {
            batchProgress: {
              ...state.batchProgress,
              [batchId]: { total, completed }
            }
          }
        }),
      upsertTransfer: (entry) =>
        set((state) => {
          const transferId = createTransferEntryId(entry)
          const existingIndex = state.transferEntries.findIndex(
            (transferEntry) => transferEntry.id === transferId
          )
          const nextEntry: WorkbenchTransferEntry = {
            ...entry,
            id: transferId,
            updatedAt: new Date().toISOString()
          }

          const existingEntry = existingIndex !== -1 ? state.transferEntries[existingIndex] : null
          const wasCompleted = existingEntry?.status === 'completed'
          const isNowCompleted = entry.status === 'completed'
          const hasBatch = entry.batchId !== undefined

          let nextBatchProgress = state.batchProgress

          if (hasBatch) {
            const current = state.batchProgress[entry.batchId!]
            nextBatchProgress = {
              ...state.batchProgress,
              [entry.batchId!]: {
                total: entry.batchTotal ?? current?.total ?? 0,
                completed: current?.completed ?? 0
              }
            }
          }

          if (hasBatch && isNowCompleted && !wasCompleted) {
            const current = nextBatchProgress[entry.batchId!]
            const completed = (current?.completed ?? 0) + 1
            nextBatchProgress = {
              ...nextBatchProgress,
              [entry.batchId!]: { total: entry.batchTotal ?? current?.total ?? 0, completed }
            }
          }

          if (existingIndex === -1) {
            return {
              batchProgress: nextBatchProgress,
              transferEntries: [nextEntry, ...state.transferEntries].slice(0, 100)
            }
          }

          return {
            batchProgress: nextBatchProgress,
            transferEntries: state.transferEntries.map((transferEntry, index) =>
              index === existingIndex ? nextEntry : transferEntry
            )
          }
        })
    }),
    {
      name: 'winssh-workbench',
      partialize: (state) => ({
        activeActivityId: state.activeActivityId,
        activePanelId: state.activePanelId,
        collapsedSections: state.collapsedSections,
        panelOpen: state.panelOpen,
        panelSizePx: state.panelSizePx,
        selectedExplorerNode: state.selectedExplorerNode,
        sidebarOpen: state.sidebarOpen,
        sftpPanelSide: state.sftpPanelSide
      }),
      storage: createJSONStorage(() => localStorage)
    }
  )
)
