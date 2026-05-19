import type { ReactNode } from 'react'
import type { RouteId } from '@/lib/routes'
import { Titlebar } from './titlebar'
import { ActivityBar } from './activity-bar'
import { StatusBar } from './status-bar'
import { SideBar, type TreeSection } from './side-bar'
import { EditorTabs, type EditorTab } from './editor-tabs'
import { Breadcrumb, type BreadcrumbSegment } from './breadcrumb'

interface WorkbenchShellProps {
  route: RouteId
  sidebarTitle: string
  workspaceTitle: string
  sidebarSections: TreeSection[]
  activeFileId?: string
  onFileSelect?: (id: string) => void
  tabs: EditorTab[]
  activeTabId: string
  onTabSelect?: (id: string) => void
  onTabClose?: (id: string) => void
  breadcrumb: BreadcrumbSegment[]
  children: ReactNode
}

export function WorkbenchShell({
  route,
  sidebarTitle,
  workspaceTitle,
  sidebarSections,
  activeFileId,
  onFileSelect,
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  breadcrumb,
  children
}: WorkbenchShellProps) {
  return (
    <div className="vsc-shell">
      <Titlebar />
      <div className="vsc-body">
        <ActivityBar activeRoute={route} />
        <SideBar
          title={sidebarTitle}
          workspaceTitle={workspaceTitle}
          sections={sidebarSections}
          activeId={activeFileId}
          onSelect={onFileSelect}
        />
        <main className="vsc-editor" id="main">
          <EditorTabs
            tabs={tabs}
            activeId={activeTabId}
            onSelect={onTabSelect}
            onClose={onTabClose}
          />
          <Breadcrumb segments={breadcrumb} />
          <div className="vsc-editor-content">{children}</div>
        </main>
      </div>
      <StatusBar />
    </div>
  )
}
