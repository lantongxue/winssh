import { useState, type ReactNode } from 'react'
import { ChevronDown, MoreHorizontal, RefreshCw } from 'lucide-react'
import { FileIcon, type FileLanguage } from './file-icon'

export interface TreeFile {
  id: string
  name: string
  language: FileLanguage
}

export interface TreeSection {
  id: string
  title: string
  files: TreeFile[]
}

interface SideBarProps {
  title: string
  workspaceTitle: string
  sections: TreeSection[]
  activeId?: string
  onSelect?: (id: string) => void
  footer?: ReactNode
}

export function SideBar({
  title,
  workspaceTitle,
  sections,
  activeId,
  onSelect,
  footer
}: SideBarProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  return (
    <aside className="vsc-sidebar" aria-label={title}>
      <div className="vsc-sidebar-header">
        <span>{title}</span>
        <div className="vsc-sidebar-header-actions">
          <button type="button" className="vsc-icon-btn" aria-label="Refresh">
            <RefreshCw size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button type="button" className="vsc-icon-btn" aria-label="More actions">
            <MoreHorizontal size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="vsc-sidebar-body">
        {sections.map((section, idx) => {
          const isCollapsed = collapsed[section.id] ?? false
          return (
            <div key={section.id}>
              <button
                type="button"
                className="vsc-tree-section-head"
                aria-expanded={!isCollapsed}
                onClick={() => setCollapsed((c) => ({ ...c, [section.id]: !isCollapsed }))}
              >
                <ChevronDown
                  size={14}
                  strokeWidth={1.5}
                  className={`vsc-tree-section-chevron ${isCollapsed ? 'is-collapsed' : ''}`}
                  aria-hidden="true"
                />
                <span>{idx === 0 ? workspaceTitle : section.title}</span>
              </button>
              {!isCollapsed
                ? section.files.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      className={`vsc-tree-item ${file.id === activeId ? 'is-active' : ''}`}
                      onClick={() => {
                        onSelect?.(file.id)
                        const target = document.getElementById(file.id)
                        if (target) {
                          target.scrollIntoView({ behavior: 'smooth', block: 'start' })
                        }
                      }}
                    >
                      <span className="file-icon">
                        <FileIcon language={file.language} />
                      </span>
                      <span className="file-name">{file.name}</span>
                    </button>
                  ))
                : null}
            </div>
          )
        })}
      </div>
      {footer ? (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--workbench-border)' }}>
          {footer}
        </div>
      ) : null}
    </aside>
  )
}
