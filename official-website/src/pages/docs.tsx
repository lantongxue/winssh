import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { WorkbenchShell } from '@/components/workbench-shell'
import type { BreadcrumbSegment } from '@/components/breadcrumb'
import { useLanguage } from '@/lib/language'
import { SITE_COPY } from '@/content/site'
import { REPOSITORY_URL } from '@/lib/constants'

export function DocsPage() {
  const { language } = useLanguage()
  const copy = SITE_COPY[language]
  const [activeId, setActiveId] = useState(copy.docs.sections[0]?.id)

  const tabs = [{ id: 'docs', label: 'docs.md', language: 'markdown' as const }]

  const sidebarSections = [
    {
      id: 'editors',
      title: language === 'zh-CN' ? '打开的编辑器' : 'Open Editors',
      files: tabs.map((t) => ({ id: t.id, name: t.label, language: t.language }))
    },
    {
      id: 'workspace',
      title: language === 'zh-CN' ? '文档' : 'Docs',
      files: copy.docs.sections.map((s) => ({
        id: s.id,
        name: `${s.id}.md`,
        language: 'markdown' as const
      }))
    }
  ]

  const breadcrumb: BreadcrumbSegment[] = [
    { label: 'winssh' },
    { label: 'docs' },
    { label: 'docs.md', language: 'markdown' }
  ]

  return (
    <WorkbenchShell
      route="docs"
      sidebarTitle={language === 'zh-CN' ? '资源管理器' : 'Explorer'}
      workspaceTitle="WINSSH-OFFICIAL"
      sidebarSections={sidebarSections}
      activeFileId={activeId}
      onFileSelect={setActiveId}
      tabs={tabs}
      activeTabId="docs"
      breadcrumb={breadcrumb}
    >
      <div className="vsc-md">
        <h1>{copy.docs.title}</h1>
        <p>{copy.docs.subtitle}</p>
        <hr />
        {copy.docs.sections.map((section) => (
          <section key={section.id} id={section.id} onMouseEnter={() => setActiveId(section.id)}>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
          </section>
        ))}
        <hr />
        <p>
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            {copy.docs.repoCta}{' '}
            <ExternalLink
              size={13}
              strokeWidth={1.5}
              aria-hidden="true"
              style={{ verticalAlign: 'text-bottom' }}
            />
          </a>
        </p>
      </div>
    </WorkbenchShell>
  )
}
