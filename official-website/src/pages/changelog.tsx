import { useMemo, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import changelogSource from '../../../CHANGELOG.md?raw'
import { WorkbenchShell } from '@/components/workbench-shell'
import type { BreadcrumbSegment } from '@/components/breadcrumb'
import { useLanguage } from '@/lib/language'
import { SITE_COPY } from '@/content/site'
import { REPOSITORY_URL } from '@/lib/constants'
import { renderMarkdown } from '@/lib/markdown'

interface VersionEntry {
  id: string
  name: string
  language: 'markdown'
}

function extractVersions(markdown: string): VersionEntry[] {
  const versions: VersionEntry[] = []
  const seen = new Set<string>()
  const lines = markdown.split(/\r?\n/)
  for (const line of lines) {
    if (line.startsWith('## ')) {
      const stripped = line.slice(3).trim()
      const match = stripped.match(/^\[?([0-9]+\.[0-9]+\.[0-9]+)\]?/)
      if (match) {
        const id = `v-${match[1]}`
        if (!seen.has(id)) {
          versions.push({ id, name: `v${match[1]}.md`, language: 'markdown' })
          seen.add(id)
        }
      }
    }
  }
  return versions.slice(0, 20)
}

export function ChangelogPage() {
  const { language } = useLanguage()
  const copy = SITE_COPY[language]
  const versions = useMemo(() => extractVersions(changelogSource), [])
  const [activeId, setActiveId] = useState(versions[0]?.id)

  const tabs = [{ id: 'changelog', label: 'CHANGELOG.md', language: 'markdown' as const }]

  const sidebarSections = [
    {
      id: 'editors',
      title: language === 'zh-CN' ? '打开的编辑器' : 'Open Editors',
      files: tabs.map((t) => ({ id: t.id, name: t.label, language: t.language }))
    },
    {
      id: 'versions',
      title: language === 'zh-CN' ? '版本' : 'Versions',
      files: versions
    }
  ]

  const breadcrumb: BreadcrumbSegment[] = [
    { label: 'winssh' },
    { label: 'CHANGELOG.md', language: 'markdown' }
  ]

  return (
    <WorkbenchShell
      route="changelog"
      sidebarTitle={language === 'zh-CN' ? '资源管理器' : 'Explorer'}
      workspaceTitle="WINSSH-OFFICIAL"
      sidebarSections={sidebarSections}
      activeFileId={activeId}
      onFileSelect={setActiveId}
      tabs={tabs}
      activeTabId="changelog"
      breadcrumb={breadcrumb}
    >
      <div className="vsc-md">
        <h1>{copy.changelog.title}</h1>
        <p>{copy.changelog.subtitle}</p>
        <hr />
        {renderMarkdown(changelogSource)}
        <hr />
        <p>
          <a href={REPOSITORY_URL} target="_blank" rel="noopener noreferrer">
            {copy.changelog.repoCta}{' '}
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
