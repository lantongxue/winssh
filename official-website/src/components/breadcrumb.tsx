import { ChevronRight } from 'lucide-react'
import { FileIcon, type FileLanguage } from './file-icon'

export interface BreadcrumbSegment {
  label: string
  language?: FileLanguage
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[]
}

export function Breadcrumb({ segments }: BreadcrumbProps) {
  return (
    <div className="vsc-breadcrumb" aria-label="Breadcrumb">
      {segments.map((seg, idx) => (
        <span key={`${seg.label}-${idx}`} className="vsc-breadcrumb-item">
          {seg.language ? <FileIcon language={seg.language} size={12} /> : null}
          <span>{seg.label}</span>
          {idx < segments.length - 1 ? (
            <ChevronRight
              size={12}
              strokeWidth={1.5}
              className="vsc-breadcrumb-sep"
              aria-hidden="true"
            />
          ) : null}
        </span>
      ))}
    </div>
  )
}
