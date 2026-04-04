import { useEffect } from 'react'
import { Files } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { actionIcons } from '@/lib/action-icons'
import {
  createSessionEditorDocument,
  createSettingsEditorDocument,
  createTerminalWelcomeDocument,
  getLegacyPathForActivity,
  getLegacyPathForDocument
} from '@/lib/workbench'
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
import { WorkbenchServerEditor } from '@/components/workbench/workbench-server-editor'
import { WorkbenchSessionEditor } from '@/components/workbench/workbench-session-editor'
import { WorkbenchSettingsEditor } from '@/components/workbench/workbench-settings-editor'
import { WorkbenchStatusBar } from '@/components/workbench/workbench-status-bar'
import { WorkbenchTitlebar } from '@/components/workbench/workbench-titlebar'

function WorkbenchTerminalWelcome() {
  const { t } = useTranslation()
  const { openServerEditor, focusActivity } = useWorkbenchContext()
  const NewConnectionIcon = actionIcons.newConnection

  return (
    <div className="liquid-glass-page flex h-full items-center justify-center bg-[var(--workbench-editor)] px-6">
      <div className="liquid-glass-hero max-w-xl border border-[var(--workbench-border)] px-8 py-10 text-center">
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
  const location = useLocation()
  const navigate = useNavigate()
  const activeDocumentId = useWorkbenchStore((state) => state.activeDocumentId)
  const activeActivityId = useWorkbenchStore((state) => state.activeActivityId)
  const openDocuments = useWorkbenchStore((state) => state.openDocuments)
  const panelOpen = useWorkbenchStore((state) => state.panelOpen)
  const sidebarOpen = useWorkbenchStore((state) => state.sidebarOpen)
  const openDocument = useWorkbenchStore((state) => state.openDocument)
  const setActiveActivity = useWorkbenchStore((state) => state.setActiveActivity)
  const setCommandPaletteOpen = useWorkbenchStore((state) => state.setCommandPaletteOpen)
  const setQuickOpenOpen = useWorkbenchStore((state) => state.setQuickOpenOpen)
  const togglePanel = useWorkbenchStore((state) => state.togglePanel)
  const toggleSidebar = useWorkbenchStore((state) => state.toggleSidebar)

  const activeDocument = openDocuments.find((document) => document.id === activeDocumentId) ?? null

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

      openDocument(createSettingsEditorDocument())
      return
    }

    if (
      currentActiveDocument?.kind === 'session-editor' ||
      currentActiveDocument?.kind === 'terminal-welcome'
    ) {
      setActiveActivity('terminal')
      return
    }

    if (location.pathname === '/sessions') {
      const { activeSessionId: currentActiveSessionId, tabs: currentTabs } =
        useSessionsStore.getState()
      const preferredSessionId = currentActiveSessionId ?? currentTabs.at(-1)?.sessionId
      openDocument(
        preferredSessionId
          ? createSessionEditorDocument(preferredSessionId)
          : createTerminalWelcomeDocument()
      )
      return
    }
  }, [location.pathname, openDocument, setActiveActivity])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        return
      }

      const key = event.key.toLowerCase()

      if (key === 'b') {
        event.preventDefault()
        toggleSidebar()
        return
      }

      if (key === 'j') {
        event.preventDefault()
        togglePanel()
        return
      }

      if (key === 'p') {
        event.preventDefault()

        if (event.shiftKey) {
          setCommandPaletteOpen(true)
          setQuickOpenOpen(false)
          return
        }

        setQuickOpenOpen(true)
        setCommandPaletteOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setCommandPaletteOpen, setQuickOpenOpen, togglePanel, toggleSidebar])

  useEffect(() => {
    const targetPath =
      activeActivityId === 'explorer'
        ? getLegacyPathForActivity('explorer')
        : getLegacyPathForDocument(activeDocument)

    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true })
    }
  }, [activeActivityId, activeDocument, location.pathname, navigate])

  const hasActiveDocument = Boolean(activeDocument)

  const editorHost = (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {hasActiveDocument ? <WorkbenchEditorTabs /> : null}
      {panelOpen ? (
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize="74%" minSize="10%">
            <div className="relative h-full min-h-0 overflow-hidden bg-[var(--workbench-editor)]">
              {!hasActiveDocument ? <WorkbenchExplorerHome /> : null}
              {openDocuments.map((document) => (
                <div
                  key={document.id}
                  className={document.id === activeDocumentId ? 'h-full' : 'hidden h-full'}
                >
                  {document.kind === 'terminal-welcome' ? <WorkbenchTerminalWelcome /> : null}
                  {document.kind === 'server-editor' ? (
                    <WorkbenchServerEditor document={document} />
                  ) : null}
                  {document.kind === 'session-editor' ? (
                    <WorkbenchSessionEditor sessionId={document.sessionId} />
                  ) : null}
                  {document.kind === 'settings-editor' ? <WorkbenchSettingsEditor /> : null}
                </div>
              ))}
            </div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel defaultSize="26%" minSize="10%">
            <WorkbenchPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--workbench-editor)]">
          {!hasActiveDocument ? <WorkbenchExplorerHome /> : null}
          {openDocuments.map((document) => (
            <div
              key={document.id}
              className={document.id === activeDocumentId ? 'h-full' : 'hidden h-full'}
            >
              {document.kind === 'terminal-welcome' ? <WorkbenchTerminalWelcome /> : null}
              {document.kind === 'server-editor' ? (
                <WorkbenchServerEditor document={document} />
              ) : null}
              {document.kind === 'session-editor' ? (
                <WorkbenchSessionEditor sessionId={document.sessionId} />
              ) : null}
              {document.kind === 'settings-editor' ? <WorkbenchSettingsEditor /> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="workbench-shell liquid-glass-shell flex h-full min-h-0 flex-col bg-[var(--workbench-bg)] text-foreground">
      <WorkbenchTitlebar />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <WorkbenchActivityBar />

        <div className="min-w-0 flex-1 overflow-hidden">
          {sidebarOpen ? (
            <ResizablePanelGroup orientation="horizontal">
              <ResizablePanel defaultSize="22%" minSize="16%" maxSize="30%">
                <WorkbenchPrimarySidebar />
              </ResizablePanel>
              <ResizableHandle />
              <ResizablePanel defaultSize="78%" minSize="40%">
                {editorHost}
              </ResizablePanel>
            </ResizablePanelGroup>
          ) : (
            editorHost
          )}
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
