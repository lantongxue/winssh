import { useState } from 'react'
import { Apple, Download, Monitor, Search, Star, Terminal as TerminalIcon, type LucideIcon } from 'lucide-react'
import { WorkbenchShell } from '@/components/workbench-shell'
import type { BreadcrumbSegment } from '@/components/breadcrumb'
import { useLanguage } from '@/lib/language'
import { SITE_COPY } from '@/content/site'
import { APP_VERSION, DOWNLOADS, REPOSITORY_URL, type Platform } from '@/lib/constants'

const ICON_BY_PLATFORM: Record<Platform, LucideIcon> = {
  windows: Monitor,
  macos: Apple,
  linux: TerminalIcon
}

export function DownloadPage() {
  const { language } = useLanguage()
  const copy = SITE_COPY[language]

  const tabs = [{ id: 'download', label: 'Extensions: Download', language: 'plain' as const }]

  const sidebarSections = [
    {
      id: 'editors',
      title: language === 'zh-CN' ? '打开的编辑器' : 'Open Editors',
      files: tabs.map((t) => ({ id: t.id, name: t.label, language: t.language }))
    },
    {
      id: 'platforms',
      title: language === 'zh-CN' ? '平台' : 'Platforms',
      files: DOWNLOADS.map((p) => ({
        id: `download-${p.platform}`,
        name: `${copy.download.platforms[p.platform]}.pkg`,
        language: 'plain' as const
      }))
    }
  ]

  const breadcrumb: BreadcrumbSegment[] = [
    { label: 'winssh' },
    { label: language === 'zh-CN' ? '扩展' : 'Extensions' },
    { label: copy.download.title }
  ]

  const [activeId, setActiveId] = useState('download-windows')

  return (
    <WorkbenchShell
      route="download"
      sidebarTitle={language === 'zh-CN' ? '资源管理器' : 'Explorer'}
      workspaceTitle="WINSSH-OFFICIAL"
      sidebarSections={sidebarSections}
      activeFileId={activeId}
      onFileSelect={setActiveId}
      tabs={tabs}
      activeTabId="download"
      breadcrumb={breadcrumb}
    >
      <div className="vsc-marketplace">
        <div className="vsc-marketplace-header">
          <Search size={14} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--workbench-muted)' }} />
          <input
            type="search"
            className="vsc-marketplace-search"
            placeholder={
              language === 'zh-CN'
                ? '搜索 Marketplace 中的扩展'
                : 'Search Marketplace for extensions'
            }
            defaultValue="WinSSH"
            aria-label="Search downloads"
          />
        </div>

        <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--workbench-muted)' }}>
          {copy.download.subtitle}
        </p>

        <div className="vsc-extension-list">
          {DOWNLOADS.map((platform) => {
            const Icon = ICON_BY_PLATFORM[platform.platform]
            const label = copy.download.platforms[platform.platform]
            return (
              <div key={platform.platform} className="vsc-extension-item" id={`download-${platform.platform}`}>
                <div className="vsc-extension-icon">
                  <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
                </div>
                <div className="vsc-extension-body">
                  <h3>
                    WinSSH for {label}{' '}
                    <span style={{ fontSize: 13, color: 'var(--workbench-muted)', fontWeight: 400 }}>
                      v{APP_VERSION}
                    </span>
                  </h3>
                  <p>{platform.assets.map((a) => `${a.label} (${a.format})`).join('  ·  ')}</p>
                  <div className="vsc-extension-meta">
                    <Star size={11} strokeWidth={1.5} aria-hidden="true" style={{ verticalAlign: 'text-bottom' }} /> winssh ·{' '}
                    {language === 'zh-CN' ? '开源' : 'Open Source'} · MIT
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <a
                    href={`${REPOSITORY_URL}/releases/latest`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vsc-install-btn"
                  >
                    <Download size={12} strokeWidth={2} aria-hidden="true" />
                    {copy.download.download}
                  </a>
                  <a
                    href={`${REPOSITORY_URL}/releases`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vsc-install-btn is-secondary"
                  >
                    {copy.download.viewAll}
                  </a>
                </div>
              </div>
            )
          })}
        </div>

        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            color: 'var(--workbench-muted)',
            fontFamily: 'var(--font-mono)'
          }}
        >
          {copy.download.note}
        </p>
      </div>
    </WorkbenchShell>
  )
}
