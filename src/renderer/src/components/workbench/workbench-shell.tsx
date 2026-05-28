import { useEffect, useEffectEvent, useLayoutEffect } from 'react'
import { Files } from 'lucide-react'
import { usePanelRef } from 'react-resizable-panels'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { SystemMenuAction } from '@shared/types'
import { actionIcons } from '@/lib/action-icons'
import { isMacPlatform } from '@/lib/platform'
import {
  createLocalTerminalEditorDocument,
  createSessionEditorDocument,
  createSettingsEditorDocument,
  createTerminalWelcomeDocument,
  DEFAULT_WORKBENCH_BOTTOM_PANEL_SIZE_PX,
  getServerEditorFormId,
  getSftpFileEditorFormId,
  getLegacyPathForActivity,
  getLegacyPathForDocument
} from '@/lib/workbench'
import { resolveWorkbenchShortcutAction } from '@/lib/workbench-shortcuts'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Button } from '@/components/ui/button'
import { WorkbenchActivityBar } from '@/components/workbench/workbench-activity-bar'
import { WorkbenchCommandCenter } from '@/components/workbench/workbench-command-center'
import { WorkbenchEditorTabs } from '@/components/workbench/workbench-editor-tabs'
import { WorkbenchExplorerHome } from '@/components/workbench/workbench-explorer-home'
import { WorkbenchPanel } from '@/components/workbench/workbench-panel'
import { WorkbenchPrimarySidebar } from '@/components/workbench/workbench-primary-sidebar'
import { WorkbenchProvider, useWorkbenchContext } from '@/components/workbench/workbench-context'
import { WorkbenchQuickInput } from '@/components/workbench/workbench-quick-input'
import { WorkbenchLocalTerminalEditor } from '@/components/workbench/workbench-local-terminal-editor'
import { WorkbenchServerEditor } from '@/components/workbench/workbench-server-editor'
import { WorkbenchSessionEditor } from '@/components/workbench/workbench-session-editor'
import { WorkbenchSftpFileEditor } from '@/components/workbench/workbench-sftp-file-editor'
import { WorkbenchSettingsEditor } from '@/components/workbench/workbench-settings-editor'
import { WorkbenchStatusBar } from '@/components/workbench/workbench-status-bar'
import { WorkbenchTitlebar } from '@/components/workbench/workbench-titlebar'
import { WorkbenchUpdatesEditor } from '@/components/workbench/workbench-updates-editor'
import { WorkbenchAwayReminderOverlay } from '@/components/workbench/workbench-away-reminder-overlay'
import { useAwayDetector } from '@/hooks/use-away-detector'

function submitServerEditorForm(documentId: `server-editor:${string}`) {
  const form = document.getElementById(getServerEditorFormId(documentId))

  if (!(form instanceof HTMLFormElement)) {
    return
  }

  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit()
    return
  }

  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

function submitSftpFileEditorForm(documentId: `sftp-file-editor:${string}`) {
  const form = document.getElementById(getSftpFileEditorFormId(documentId))

  if (!(form instanceof HTMLFormElement)) {
    return
  }

  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit()
    return
  }

  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}

function WorkbenchTerminalWelcome() {
  const { t } = useTranslation()
  const { openLocalTerminal, openServerEditor, focusActivity } = useWorkbenchContext()
  const NewConnectionIcon = actionIcons.newConnection
  const OpenTerminalIcon = actionIcons.openTerminal

  return (
    <div className="flex h-full items-center justify-center bg-[var(--workbench-editor)] px-6">
      <div className="max-w-xl border border-[var(--workbench-border)] px-8 py-10 text-center">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {t('workbench.activity.terminal.title')}
        </div>
        <div className="mt-2 text-2xl font-semibold text-foreground">
          {t('workbench.shell.terminalWelcome.title')}
        </div>
        <div className="mt-2 text-sm text-muted-foreground">
          {t('workbench.shell.terminalWelcome.description')}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={() => void openLocalTerminal()}>
            <OpenTerminalIcon className="size-4" />
            {t('common.actions.openTerminal')}
          </Button>
          <Button onClick={() => openServerEditor()}>
            <NewConnectionIcon className="size-4" />
            {t('common.actions.newConnection')}
          </Button>
          <Button variant="outline" onClick={() => focusActivity('explorer')}>
            <Files className="size-4" />
            {t('workbench.activity.explorer.title')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function WorkbenchShellContent() {
  useAwayDetector()
  const {
    closeLocalTerminal,
    disconnectSession,
    openLocalTerminal,
    openServerEditor,
    openSettingsEditor,
    openUpdatesEditor
  } = useWorkbenchContext()
  const location = useLocation()
  const navigate = useNavigate()
  const activeDocumentId = useWorkbenchStore((state) => state.activeDocumentId)
  const activeActivityId = useWorkbenchStore((state) => state.activeActivityId)
  const openDocuments = useWorkbenchStore((state) => state.openDocuments)
  const panelOpen = useWorkbenchStore((state) => state.panelOpen)
  const panelSizePx = useWorkbenchStore((state) => state.panelSizePx)
  const sidebarOpen = useWorkbenchStore((state) => state.sidebarOpen)
  const openDocument = useWorkbenchStore((state) => state.openDocument)
  const closeDocument = useWorkbenchStore((state) => state.closeDocument)
  const setActiveActivity = useWorkbenchStore((state) => state.setActiveActivity)
  const setCommandPaletteOpen = useWorkbenchStore((state) => state.setCommandPaletteOpen)
  const setPanelSizePx = useWorkbenchStore((state) => state.setPanelSizePx)
  const setQuickOpenOpen = useWorkbenchStore((state) => state.setQuickOpenOpen)
  const togglePanel = useWorkbenchStore((state) => state.togglePanel)
  const toggleSidebar = useWorkbenchStore((state) => state.toggleSidebar)
  const setActiveLocalTerminal = useLocalTerminalsStore((state) => state.setActiveTerminal)
  const isMac = isMacPlatform()
  const sidebarPanelRef = usePanelRef()
  const bottomPanelRef = usePanelRef()

  const activeDocument = openDocuments.find((document) => document.id === activeDocumentId) ?? null

  const handleWorkbenchAction = useEffectEvent(async (action: SystemMenuAction) => {
    if (action === 'saveActiveDocument') {
      if (activeDocument?.kind === 'server-editor') {
        submitServerEditorForm(activeDocument.id)
      }
      if (activeDocument?.kind === 'sftp-file-editor') {
        submitSftpFileEditorForm(activeDocument.id)
      }
      return
    }

    if (action === 'closeActiveDocument') {
      if (!activeDocument) {
        return
      }

      if (activeDocument.kind === 'session-editor') {
        await disconnectSession(activeDocument.sessionId)
        return
      }

      if (activeDocument.kind === 'local-terminal-editor') {
        await closeLocalTerminal(activeDocument.terminalId)
        return
      }

      closeDocument(activeDocument.id)
      return
    }

    if (action === 'toggleSidebar') {
      toggleSidebar()
      return
    }

    if (action === 'togglePanel') {
      togglePanel()
      return
    }

    if (action === 'openCommandPalette') {
      setCommandPaletteOpen(true)
      setQuickOpenOpen(false)
      return
    }

    if (action === 'openQuickOpen') {
      setQuickOpenOpen(true)
      setCommandPaletteOpen(false)
      return
    }

    setCommandPaletteOpen(false)
    setQuickOpenOpen(false)

    if (action === 'openNewConnection') {
      openServerEditor()
      return
    }

    if (action === 'openSettings') {
      openSettingsEditor()
      return
    }

    if (action === 'openUpdates') {
      openUpdatesEditor()
      return
    }

    if (action === 'openLocalTerminal') {
      await openLocalTerminal()
    }
  })

  useEffect(() => {
    const currentState = useWorkbenchStore.getState()
    const currentActiveDocument =
      currentState.openDocuments.find(
        (document) => document.id === currentState.activeDocumentId
      ) ?? null

    if (location.pathname === '/servers') {
      setActiveActivity('explorer')
      return
    }

    if (location.pathname === '/settings') {
      if (currentActiveDocument?.kind === 'settings-editor') {
        setActiveActivity('settings')
        return
      }

      if (currentActiveDocument?.kind === 'updates-editor') {
        setActiveActivity('settings')
        return
      }

      openDocument(createSettingsEditorDocument())
      return
    }

    if (
      currentActiveDocument?.kind === 'session-editor' ||
      currentActiveDocument?.kind === 'sftp-file-editor' ||
      currentActiveDocument?.kind === 'local-terminal-editor' ||
      currentActiveDocument?.kind === 'terminal-welcome'
    ) {
      setActiveActivity('terminal')
      return
    }

    if (location.pathname === '/sessions') {
      const { activeSessionId: currentActiveSessionId, tabs: currentTabs } =
        useSessionsStore.getState()
      const { activeTerminalId: currentActiveLocalTerminalId, tabs: currentLocalTerminalTabs } =
        useLocalTerminalsStore.getState()
      const preferredSessionId = currentActiveSessionId ?? currentTabs.at(-1)?.sessionId
      const preferredLocalTerminalId =
        currentActiveLocalTerminalId ?? currentLocalTerminalTabs.at(-1)?.terminalId
      openDocument(
        preferredSessionId
          ? createSessionEditorDocument(preferredSessionId)
          : preferredLocalTerminalId
            ? createLocalTerminalEditorDocument(preferredLocalTerminalId)
            : createTerminalWelcomeDocument()
      )
      return
    }
  }, [location.pathname, openDocument, setActiveActivity])

  useEffect(() => {
    if (activeDocument?.kind === 'session-editor') {
      useSessionsStore.getState().setActiveSession(activeDocument.sessionId)
      return
    }

    if (activeDocument?.kind === 'local-terminal-editor') {
      setActiveLocalTerminal(activeDocument.terminalId)
    }
  }, [activeDocument, setActiveLocalTerminal])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const action = resolveWorkbenchShortcutAction(event, isMac)

      if (!action) {
        return
      }

      event.preventDefault()

      void handleWorkbenchAction(action)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isMac])

  useEffect(() => {
    return window.winsshApi.system.menu.onAction((action) => {
      void handleWorkbenchAction(action)
    })
  }, [])

  useEffect(() => {
    const targetPath =
      activeActivityId === 'explorer'
        ? getLegacyPathForActivity('explorer')
        : getLegacyPathForDocument(activeDocument)

    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true })
    }
  }, [activeActivityId, activeDocument, location.pathname, navigate])

  useLayoutEffect(() => {
    const sidebarPanel = sidebarPanelRef.current

    if (!sidebarPanel) {
      return
    }

    if (sidebarOpen) {
      if (sidebarPanel.isCollapsed()) {
        sidebarPanel.expand()
      }
      return
    }

    if (!sidebarPanel.isCollapsed()) {
      sidebarPanel.collapse()
    }
  }, [sidebarOpen, sidebarPanelRef])

  useLayoutEffect(() => {
    const bottomPanel = bottomPanelRef.current

    if (!bottomPanel) {
      return
    }

    if (panelOpen) {
      if (bottomPanel.isCollapsed()) {
        bottomPanel.expand()
      }

      if (Math.abs(bottomPanel.getSize().inPixels - panelSizePx) > 1) {
        bottomPanel.resize(panelSizePx)
      }
      return
    }

    if (!bottomPanel.isCollapsed()) {
      bottomPanel.collapse()
    }
  }, [bottomPanelRef, panelOpen, panelSizePx])

  const hasActiveDocument = Boolean(activeDocument)
  const documentLayers = openDocuments.map((document) => {
    const active = document.id === activeDocumentId
    const keepMountedWhenInactive =
      document.kind === 'session-editor' || document.kind === 'local-terminal-editor'
    const className = keepMountedWhenInactive
      ? active
        ? 'relative h-full'
        : 'absolute inset-0 h-full invisible pointer-events-none'
      : active
        ? 'h-full'
        : 'hidden h-full'

    return (
      <div key={document.id} aria-hidden={!active} className={className}>
        {document.kind === 'terminal-welcome' ? <WorkbenchTerminalWelcome /> : null}
        {document.kind === 'server-editor' ? <WorkbenchServerEditor document={document} /> : null}
        {document.kind === 'session-editor' ? (
          <WorkbenchSessionEditor active={active} sessionId={document.sessionId} />
        ) : null}
        {document.kind === 'sftp-file-editor' ? (
          <WorkbenchSftpFileEditor active={active} document={document} />
        ) : null}
        {document.kind === 'local-terminal-editor' ? (
          <WorkbenchLocalTerminalEditor active={active} terminalId={document.terminalId} />
        ) : null}
        {document.kind === 'settings-editor' ? <WorkbenchSettingsEditor /> : null}
        {document.kind === 'updates-editor' ? <WorkbenchUpdatesEditor /> : null}
      </div>
    )
  })

  const editorHost = (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {hasActiveDocument ? <WorkbenchEditorTabs /> : null}
      <ResizablePanelGroup id="workbench-editor-layout" orientation="vertical">
        <ResizablePanel id="workbench-editor-main" defaultSize="74%" minSize="10%">
          <div className="relative h-full min-h-0 overflow-hidden bg-[var(--workbench-editor)]">
            {!hasActiveDocument ? <WorkbenchExplorerHome /> : null}
            {documentLayers}
            <WorkbenchAwayReminderOverlay />
          </div>
        </ResizablePanel>
        <ResizableHandle
          disabled={!panelOpen}
          style={panelOpen ? undefined : { display: 'none' }}
        />
        <ResizablePanel
          collapsedSize={0}
          collapsible
          defaultSize={`${DEFAULT_WORKBENCH_BOTTOM_PANEL_SIZE_PX}px`}
          groupResizeBehavior="preserve-pixel-size"
          id="workbench-bottom-panel"
          minSize="10%"
          onResize={(size) => {
            if (size.inPixels > 0) {
              setPanelSizePx(size.inPixels)
            }
          }}
          panelRef={bottomPanelRef}
        >
          <div
            aria-hidden={!panelOpen}
            className={
              panelOpen ? 'h-full min-h-0' : 'h-full min-h-0 invisible pointer-events-none'
            }
          >
            <WorkbenchPanel />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )

  return (
    <div className="workbench-shell flex h-full min-h-0 flex-col bg-[var(--workbench-bg)] text-foreground">
      <WorkbenchTitlebar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <WorkbenchActivityBar />

        <div className="min-w-0 flex-1 overflow-hidden">
          <ResizablePanelGroup id="workbench-shell-layout" orientation="horizontal">
            <ResizablePanel
              collapsedSize={0}
              collapsible
              defaultSize="22%"
              id="workbench-primary-sidebar"
              maxSize="30%"
              minSize="16%"
              panelRef={sidebarPanelRef}
            >
              <div
                aria-hidden={!sidebarOpen}
                className={
                  sidebarOpen ? 'h-full min-w-0' : 'h-full min-w-0 invisible pointer-events-none'
                }
              >
                <WorkbenchPrimarySidebar />
              </div>
            </ResizablePanel>
            <ResizableHandle
              disabled={!sidebarOpen}
              style={sidebarOpen ? undefined : { display: 'none' }}
            />
            <ResizablePanel defaultSize="78%" id="workbench-editor-host" minSize="40%">
              {editorHost}
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      <WorkbenchStatusBar />
      <WorkbenchCommandCenter activeDocument={activeDocument} />
      <WorkbenchQuickInput />
    </div>
  )
}

export function WorkbenchShell() {
  return (
    <WorkbenchProvider>
      <WorkbenchShellContent />
    </WorkbenchProvider>
  )
}
