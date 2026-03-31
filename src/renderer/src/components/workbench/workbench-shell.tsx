import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  createSessionEditorDocument,
  createSettingsEditorDocument,
  createTerminalWelcomeDocument,
  defaultWorkbenchDocument,
  getDocumentActivity,
  getLegacyPathForActivity
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
  const { openServerEditor, focusActivity } = useWorkbenchContext()

  return (
    <div className="flex h-full items-center justify-center bg-[var(--workbench-editor)] px-6">
      <div className="max-w-xl text-center">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Terminal
        </div>
        <div className="mt-2 text-2xl font-semibold text-foreground">还没有活动会话</div>
        <div className="mt-2 text-sm text-muted-foreground">
          在 Explorer 中选择一台服务器，或直接创建一个新的连接配置并发起连接。
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={() => openServerEditor()}>新建连接</Button>
          <Button variant="outline" onClick={() => focusActivity('explorer')}>
            返回 Explorer
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
  const openDocuments = useWorkbenchStore((state) => state.openDocuments)
  const panelOpen = useWorkbenchStore((state) => state.panelOpen)
  const sidebarOpen = useWorkbenchStore((state) => state.sidebarOpen)
  const openDocument = useWorkbenchStore((state) => state.openDocument)
  const setCommandPaletteOpen = useWorkbenchStore((state) => state.setCommandPaletteOpen)
  const setQuickOpenOpen = useWorkbenchStore((state) => state.setQuickOpenOpen)
  const togglePanel = useWorkbenchStore((state) => state.togglePanel)
  const toggleSidebar = useWorkbenchStore((state) => state.toggleSidebar)

  const activeDocument =
    openDocuments.find((document) => document.id === activeDocumentId) ?? defaultWorkbenchDocument
  const activeActivityId = getDocumentActivity(activeDocument)

  useEffect(() => {
    const currentState = useWorkbenchStore.getState()
    const currentActiveDocument =
      currentState.openDocuments.find((document) => document.id === currentState.activeDocumentId) ??
      defaultWorkbenchDocument
    const desiredActivity =
      location.pathname === '/settings'
        ? 'settings'
        : location.pathname === '/sessions'
          ? 'terminal'
          : 'explorer'

    if (desiredActivity === getDocumentActivity(currentActiveDocument)) {
      return
    }

    if (desiredActivity === 'settings') {
      openDocument(createSettingsEditorDocument())
      return
    }

    if (desiredActivity === 'terminal') {
      const { activeSessionId: currentActiveSessionId, tabs: currentTabs } = useSessionsStore.getState()
      const preferredSessionId = currentActiveSessionId ?? currentTabs.at(-1)?.sessionId
      openDocument(
        preferredSessionId
          ? createSessionEditorDocument(preferredSessionId)
          : createTerminalWelcomeDocument()
      )
      return
    }

    openDocument(defaultWorkbenchDocument)
  }, [location.pathname, openDocument])

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
    const targetPath = getLegacyPathForActivity(activeActivityId)

    if (location.pathname !== targetPath) {
      navigate(targetPath, { replace: true })
    }
  }, [activeActivityId, location.pathname, navigate])

  const editorHost = (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <WorkbenchEditorTabs />
      {panelOpen ? (
        <ResizablePanelGroup orientation="vertical">
          <ResizablePanel defaultSize="74%" minSize="38%">
            <div className="relative h-full min-h-0 overflow-hidden bg-[var(--workbench-editor)]">
              {openDocuments.map((document) => (
                <div
                  key={document.id}
                  className={document.id === activeDocumentId ? 'h-full' : 'hidden h-full'}
                >
                  {document.kind === 'explorer-home' ? <WorkbenchExplorerHome /> : null}
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
          <ResizablePanel defaultSize="26%" minSize="14%" maxSize="45%">
            <WorkbenchPanel />
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--workbench-editor)]">
          {openDocuments.map((document) => (
            <div
              key={document.id}
              className={document.id === activeDocumentId ? 'h-full' : 'hidden h-full'}
            >
              {document.kind === 'explorer-home' ? <WorkbenchExplorerHome /> : null}
              {document.kind === 'terminal-welcome' ? <WorkbenchTerminalWelcome /> : null}
              {document.kind === 'server-editor' ? <WorkbenchServerEditor document={document} /> : null}
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
    <div className="flex h-full min-h-0 flex-col bg-[var(--workbench-bg)] text-foreground">
      <WorkbenchTitlebar activeDocument={activeDocument} />

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
