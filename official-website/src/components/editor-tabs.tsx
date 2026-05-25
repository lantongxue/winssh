import { LayoutGrid, MoreHorizontal, SplitSquareHorizontal } from 'lucide-react'
import { FileIcon, type FileLanguage } from './file-icon'

export interface EditorTab {
  id: string
  label: string
  language: FileLanguage
}

interface EditorTabsProps {
  tabs: EditorTab[]
  activeId: string
  onSelect?: (id: string) => void
  onClose?: (id: string) => void
}

export function EditorTabs({ tabs, activeId, onSelect, onClose }: EditorTabsProps) {
  return (
    <div className="vsc-tabs" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeId
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            className={`vsc-tab ${isActive ? 'is-active' : ''}`}
            onClick={() => onSelect?.(tab.id)}
          >
            <span className="file-icon">
              <FileIcon language={tab.language} />
            </span>
            <span>{tab.label}</span>
            <button
              type="button"
              className="vsc-tab-close"
              aria-label="Close"
              onClick={(e) => {
                e.stopPropagation()
                onClose?.(tab.id)
              }}
            >
              ×
            </button>
          </div>
        )
      })}
      <div className="vsc-tabs-actions">
        <button type="button" className="vsc-icon-btn" aria-label="Split editor">
          <SplitSquareHorizontal size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button type="button" className="vsc-icon-btn" aria-label="Open changes">
          <LayoutGrid size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button type="button" className="vsc-icon-btn" aria-label="More actions">
          <MoreHorizontal size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
