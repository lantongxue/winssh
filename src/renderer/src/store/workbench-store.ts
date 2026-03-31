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
  defaultWorkbenchDocument,
  getDocumentActivity,
  isPinnedDocument
} from '@/lib/workbench'

interface WorkbenchStateData {
  activeActivityId: WorkbenchActivityId
  activeDocumentId: WorkbenchDocumentId
  activePanelId: WorkbenchPanelId
  collapsedSections: Partial<Record<WorkbenchExplorerSectionId, boolean>>
  commandPaletteOpen: boolean
  openDocuments: WorkbenchDocument[]
  outputEntries: WorkbenchOutputEntry[]
  panelOpen: boolean
  problems: WorkbenchProblemEntry[]
  quickOpenOpen: boolean
  selectedExplorerNode: WorkbenchExplorerNodeId
  sidebarOpen: boolean
  transferEntries: WorkbenchTransferEntry[]
}

interface WorkbenchState extends WorkbenchStateData {
  appendOutput: (entry: Omit<WorkbenchOutputEntry, 'id' | 'createdAt'>) => void
  clearProblems: () => void
  clearTransfers: () => void
  closeDocument: (documentId: WorkbenchDocumentId) => void
  dismissProblem: (problemId: string) => void
  openDocument: (document: WorkbenchDocument) => void
  pushProblem: (problem: Omit<WorkbenchProblemEntry, 'createdAt'>) => void
  replaceDocument: (currentDocumentId: WorkbenchDocumentId, document: WorkbenchDocument) => void
  reset: () => void
  setActiveActivity: (activityId: WorkbenchActivityId) => void
  setActiveDocument: (documentId: WorkbenchDocumentId) => void
  setActivePanel: (panelId: WorkbenchPanelId) => void
  setCommandPaletteOpen: (open: boolean) => void
  setPanelOpen: (open: boolean) => void
  setQuickOpenOpen: (open: boolean) => void
  setSelectedExplorerNode: (nodeId: WorkbenchExplorerNodeId) => void
  setSidebarOpen: (open: boolean) => void
  togglePanel: () => void
  toggleSection: (sectionId: WorkbenchExplorerSectionId) => void
  toggleSidebar: () => void
  upsertTransfer: (entry: Omit<WorkbenchTransferEntry, 'id' | 'updatedAt'>) => void
}

function normalizeDocuments(documents: WorkbenchDocument[]): WorkbenchDocument[] {
  const seen = new Set<WorkbenchDocumentId>()
  const next: WorkbenchDocument[] = []

  for (const document of [defaultWorkbenchDocument, ...documents]) {
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
): WorkbenchDocumentId {
  const closingIndex = documents.findIndex((document) => document.id === closingDocumentId)
  const remaining = documents.filter((document) => document.id !== closingDocumentId)

  if (remaining.length === 0) {
    return defaultWorkbenchDocument.id
  }

  return remaining[Math.min(closingIndex, remaining.length - 1)]?.id ?? defaultWorkbenchDocument.id
}

function createInitialState(): WorkbenchStateData {
  return {
    activeActivityId: 'explorer',
    activeDocumentId: defaultWorkbenchDocument.id,
    activePanelId: 'output',
    collapsedSections: {},
    commandPaletteOpen: false,
    openDocuments: [defaultWorkbenchDocument],
    outputEntries: [],
    panelOpen: false,
    problems: [],
    quickOpenOpen: false,
    selectedExplorerNode: 'home',
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
      clearProblems: () => set({ problems: [] }),
      clearTransfers: () => set({ transferEntries: [] }),
      closeDocument: (documentId) =>
        set((state) => {
          if (isPinnedDocument(documentId)) {
            return state
          }

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
            nextDocuments.find((document) => document.id === nextActiveDocumentId) ??
            defaultWorkbenchDocument

          return {
            activeActivityId: getDocumentActivity(nextActiveDocument),
            activeDocumentId: nextActiveDocumentId,
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

          return {
            activeActivityId: getDocumentActivity(document),
            activeDocumentId:
              state.activeDocumentId === currentDocumentId ? document.id : state.activeDocumentId,
            openDocuments: nextDocuments
          }
        }),
      reset: () => set(createInitialState()),
      setActiveActivity: (activityId) => set({ activeActivityId: activityId }),
      setActiveDocument: (documentId) =>
        set((state) => {
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
      setPanelOpen: (open) => set({ panelOpen: open }),
      setQuickOpenOpen: (open) => set({ quickOpenOpen: open }),
      setSelectedExplorerNode: (nodeId) => set({ selectedExplorerNode: nodeId }),
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

          if (existingIndex === -1) {
            return {
              transferEntries: [nextEntry, ...state.transferEntries].slice(0, 100)
            }
          }

          return {
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
        selectedExplorerNode: state.selectedExplorerNode,
        sidebarOpen: state.sidebarOpen
      }),
      storage: createJSONStorage(() => localStorage)
    }
  )
)
