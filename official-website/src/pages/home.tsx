import { useCallback, useMemo, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Cable,
  Clock,
  Compass,
  Download,
  ExternalLink,
  FileJson,
  FolderTree,
  Github,
  History,
  KeyRound,
  Monitor,
  Palette,
  Server,
  Terminal
} from 'lucide-react'
import changelogSource from '../../../CHANGELOG.md?raw'
import lightShotUrl from '@/assets/winssh-light.png'
import darkShotUrl from '@/assets/winssh-dark.png'
import featureHomeUrl from '@/assets/features/winssh-home.png'
import featureQuickConnUrl from '@/assets/features/winssh-quick-conn.png'
import featureNewServerUrl from '@/assets/features/winssh-new.png'
import featureCommandPanelUrl from '@/assets/features/winssh-command-panel.png'
import featureSettingsXtermUrl from '@/assets/features/winssh-settings-xterm.png'
import featureSettingsWebdavUrl from '@/assets/features/winssh-settings-webdav.png'
import { WorkbenchShell } from '@/components/workbench-shell'
import type { EditorTab } from '@/components/editor-tabs'
import type { BreadcrumbSegment } from '@/components/breadcrumb'
import type { FileLanguage } from '@/components/file-icon'
import { ImageCompare } from '@/components/image-compare'
import { FeatureShowcase } from '@/components/feature-showcase'
import { useLanguage } from '@/lib/language'
import { SITE_COPY, type FeatureSpotlight } from '@/content/site'
import { APP_VERSION, REPOSITORY_URL } from '@/lib/constants'
import { ROUTES } from '@/lib/routes'
import { withBasePath } from '@/lib/paths'

const FEATURE_IMAGES: Record<FeatureSpotlight['imageKey'], string> = {
  home: featureHomeUrl,
  'quick-conn': featureQuickConnUrl,
  new: featureNewServerUrl,
  'command-panel': featureCommandPanelUrl,
  'settings-xterm': featureSettingsXtermUrl,
  'settings-webdav': featureSettingsWebdavUrl
}

type DocumentId = 'welcome' | 'features-json'

interface DocumentDescriptor {
  id: DocumentId
  label: string
  language: FileLanguage
  breadcrumbLabel: string
}

const DOCUMENTS: Record<DocumentId, DocumentDescriptor> = {
  welcome: {
    id: 'welcome',
    label: 'Welcome',
    language: 'markdown',
    breadcrumbLabel: 'Welcome'
  },
  'features-json': {
    id: 'features-json',
    label: 'features.json',
    language: 'json',
    breadcrumbLabel: 'features.json'
  }
}

function isDocumentId(id: string): id is DocumentId {
  return id in DOCUMENTS
}

interface RecentRelease {
  version: string
  date: string
}

function extractRecentReleases(markdown: string, limit = 4): RecentRelease[] {
  const releases: RecentRelease[] = []
  const seen = new Set<string>()
  for (const raw of markdown.split(/\r?\n/)) {
    if (!raw.startsWith('## ')) continue
    const version = raw.match(/\[?([0-9]+\.[0-9]+\.[0-9]+)\]?/)?.[1]
    const date = raw.match(/\(([0-9]{4}-[0-9]{2}-[0-9]{2})\)\s*$/)?.[1]
    if (version && date && !seen.has(version)) {
      releases.push({ version, date })
      seen.add(version)
      if (releases.length >= limit) break
    }
  }
  return releases
}

export function HomePage() {
  const { language } = useLanguage()

  const [tabs, setTabs] = useState<EditorTab[]>([
    { id: DOCUMENTS.welcome.id, label: DOCUMENTS.welcome.label, language: DOCUMENTS.welcome.language }
  ])
  const [activeTabId, setActiveTabId] = useState<DocumentId>('welcome')

  const openDocument = useCallback((id: string) => {
    if (!isDocumentId(id)) return
    const doc = DOCUMENTS[id]
    setTabs((prev) =>
      prev.some((t) => t.id === doc.id)
        ? prev
        : [...prev, { id: doc.id, label: doc.label, language: doc.language }]
    )
    setActiveTabId(doc.id)
  }, [])

  const closeTab = useCallback(
    (id: string) => {
      if (!isDocumentId(id) || tabs.length <= 1) return
      const next = tabs.filter((t) => t.id !== id)
      setTabs(next)
      if (activeTabId === id) {
        const fallback = next[next.length - 1].id
        if (isDocumentId(fallback)) setActiveTabId(fallback)
      }
    },
    [tabs, activeTabId]
  )

  const activeDoc = DOCUMENTS[activeTabId]
  const breadcrumb: BreadcrumbSegment[] = [
    { label: 'winssh' },
    { label: activeDoc.breadcrumbLabel, language: activeDoc.language }
  ]

  const sidebarSections = [
    {
      id: 'editors',
      title: language === 'zh-CN' ? '打开的编辑器' : 'Open Editors',
      files: tabs.map((t) => ({ id: t.id, name: t.label, language: t.language }))
    },
    {
      id: 'workspace',
      title: language === 'zh-CN' ? '工作区' : 'Workspace',
      files: [
        { id: 'welcome', name: 'Welcome', language: 'markdown' as const },
        { id: 'readme', name: 'README.md', language: 'markdown' as const },
        { id: 'features-json', name: 'features.json', language: 'json' as const },
        { id: 'changelog-file', name: 'CHANGELOG.md', language: 'markdown' as const },
        { id: 'download-ts', name: 'download.ts', language: 'typescript' as const }
      ]
    }
  ]

  return (
    <WorkbenchShell
      route="home"
      sidebarTitle={language === 'zh-CN' ? '资源管理器' : 'Explorer'}
      workspaceTitle="WINSSH-OFFICIAL"
      sidebarSections={sidebarSections}
      activeFileId={activeTabId}
      onFileSelect={openDocument}
      tabs={tabs}
      activeTabId={activeTabId}
      onTabSelect={(id) => {
        if (isDocumentId(id)) setActiveTabId(id)
      }}
      onTabClose={closeTab}
      breadcrumb={breadcrumb}
    >
      {activeTabId === 'features-json' ? (
        <FeaturesTab />
      ) : (
        <WelcomeTab onOpenFeatures={() => openDocument('features-json')} />
      )}
    </WorkbenchShell>
  )
}

interface WelcomeTabProps {
  onOpenFeatures: () => void
}

function WelcomeTab({ onOpenFeatures }: WelcomeTabProps) {
  const { language } = useLanguage()
  const copy = SITE_COPY[language]
  const recent = useMemo(() => extractRecentReleases(changelogSource), [])
  const t = WELCOME_STRINGS[language]

  const startItems = [
    {
      icon: Download,
      label: t.start.download,
      hint: t.start.downloadHint,
      href: withBasePath(ROUTES.download.path)
    },
    {
      icon: BookOpen,
      label: t.start.docs,
      hint: t.start.docsHint,
      href: withBasePath(ROUTES.docs.path)
    },
    {
      icon: Github,
      label: t.start.github,
      hint: t.start.githubHint,
      href: REPOSITORY_URL,
      external: true
    },
    {
      icon: History,
      label: t.start.changelog,
      hint: t.start.changelogHint,
      href: withBasePath(ROUTES.changelog.path)
    }
  ]

  const walkthroughs = [
    {
      num: '01',
      icon: Terminal,
      title: t.walks.first.title,
      body: t.walks.first.body,
      href: withBasePath(ROUTES.docs.path)
    },
    {
      num: '02',
      icon: FolderTree,
      title: t.walks.sftp.title,
      body: t.walks.sftp.body,
      href: withBasePath(ROUTES.docs.path)
    },
    {
      num: '03',
      icon: Cable,
      title: t.walks.port.title,
      body: t.walks.port.body,
      href: withBasePath(ROUTES.docs.path)
    },
    {
      num: '04',
      icon: Palette,
      title: t.walks.theme.title,
      body: t.walks.theme.body,
      href: withBasePath(ROUTES.docs.path)
    }
  ]

  return (
    <div className="vsc-welcome">
      {/* Hero */}
      <section className="vsc-welcome-hero" aria-labelledby="welcome-brand">
        <img
          src={withBasePath('icon.png')}
          alt=""
          className="vsc-welcome-icon"
          width={96}
          height={96}
          decoding="async"
        />
        <div className="vsc-welcome-headings">
          <div className="vsc-welcome-brand-row">
            <h1 id="welcome-brand" className="vsc-welcome-title">
              {copy.brand}
            </h1>
            <span className="vsc-welcome-version" title={`Version ${APP_VERSION}`}>
              v{APP_VERSION}
            </span>
          </div>
          <p className="vsc-welcome-tagline">{copy.tagline}</p>
          <p className="vsc-welcome-lede">{copy.hero.subline}</p>
          <div className="vsc-welcome-ctas">
            <a
              className="vsc-cta is-primary"
              href={withBasePath(ROUTES.download.path)}
            >
              <Download size={16} strokeWidth={2} aria-hidden="true" />
              {copy.hero.primaryCta}
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </a>
            <a
              className="vsc-cta"
              href={REPOSITORY_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Github size={16} strokeWidth={1.75} aria-hidden="true" />
              {copy.hero.secondaryCta}
              <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" />
            </a>
          </div>
          <ul className="vsc-welcome-keywords" aria-label={t.keywordsLabel}>
            {copy.hero.keywords.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Theme comparison slider */}
      <section className="vsc-welcome-section-block">
        <header className="vsc-welcome-section-head">
          <h2 className="vsc-welcome-h2">
            <Monitor size={16} strokeWidth={1.75} aria-hidden="true" />
            {t.compare.title}
          </h2>
          <p className="vsc-welcome-section-sub">{t.compare.subtitle}</p>
        </header>
        <ImageCompare
          leftSrc={lightShotUrl}
          leftAlt={t.compare.lightAlt}
          leftLabel={t.compare.lightLabel}
          rightSrc={darkShotUrl}
          rightAlt={t.compare.darkAlt}
          rightLabel={t.compare.darkLabel}
          initialPosition={50}
          ariaLabel={t.compare.ariaLabel}
          ariaValueTextFormat={(pct) =>
            language === 'zh-CN'
              ? `深色显示 ${pct}%`
              : `Dark theme visible ${pct}%`
          }
        />
        <p className="vsc-compare-hint" aria-hidden="true">
          {t.compare.hintBefore}
          <kbd>←</kbd>
          <kbd>→</kbd>
          {t.compare.hintAfter}
        </p>
      </section>

      {/* Start + Recent */}
      <section className="vsc-welcome-cols">
        <div className="vsc-welcome-col">
          <h2 className="vsc-welcome-h2">
            <Compass size={16} strokeWidth={1.75} aria-hidden="true" />
            {t.start.title}
          </h2>
          <ul className="vsc-action-list">
            {startItems.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="vsc-action-item"
                    target={item.external ? '_blank' : undefined}
                    rel={item.external ? 'noopener noreferrer' : undefined}
                  >
                    <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
                    <span className="vsc-action-body">
                      <span className="vsc-action-label">{item.label}</span>
                      <span className="vsc-action-hint">{item.hint}</span>
                    </span>
                    {item.external ? (
                      <ExternalLink size={12} strokeWidth={1.75} aria-hidden="true" />
                    ) : (
                      <ArrowRight size={14} strokeWidth={1.75} aria-hidden="true" />
                    )}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="vsc-welcome-col">
          <h2 className="vsc-welcome-h2">
            <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
            {t.recent.title}
          </h2>
          <ul className="vsc-recent-list">
            {recent.map((r, idx) => (
              <li key={r.version}>
                <a
                  href={withBasePath(ROUTES.changelog.path)}
                  className="vsc-recent-item"
                >
                  <span className="vsc-recent-version">v{r.version}</span>
                  {idx === 0 ? <span className="vsc-recent-badge">{t.recent.latest}</span> : null}
                  <span className="vsc-recent-date">{r.date}</span>
                </a>
              </li>
            ))}
          </ul>
          <a
            href={withBasePath(ROUTES.changelog.path)}
            className="vsc-welcome-more"
          >
            {t.recent.viewAll}
            <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* Walkthroughs */}
      <section className="vsc-welcome-section-block">
        <header className="vsc-welcome-section-head">
          <h2 className="vsc-welcome-h2">
            <KeyRound size={16} strokeWidth={1.75} aria-hidden="true" />
            {t.walks.title}
          </h2>
          <p className="vsc-welcome-section-sub">{t.walks.subtitle}</p>
        </header>
        <div className="vsc-walkthrough-grid">
          {walkthroughs.map((w) => {
            const Icon = w.icon
            return (
              <a key={w.num} href={w.href} className="vsc-walkthrough-card">
                <div className="vsc-walkthrough-num">{w.num}</div>
                <div className="vsc-walkthrough-content">
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    color="var(--workbench-active)"
                    aria-hidden="true"
                  />
                  <h3>{w.title}</h3>
                  <p>{w.body}</p>
                  <span className="vsc-walkthrough-cta">
                    {t.walks.cta}
                    <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
                  </span>
                </div>
              </a>
            )
          })}
        </div>
      </section>

      {/* Capabilities pointer — opens features.json in a new editor tab */}
      <section className="vsc-welcome-section-block">
        <header className="vsc-welcome-section-head">
          <h2 className="vsc-welcome-h2">
            <Server size={16} strokeWidth={1.75} aria-hidden="true" />
            {t.capabilities.title}
          </h2>
          <p className="vsc-welcome-section-sub">{copy.features.subtitle}</p>
        </header>
        <button
          type="button"
          className="vsc-features-pointer"
          onClick={onOpenFeatures}
        >
          <span className="vsc-features-pointer-icon" aria-hidden="true">
            <FileJson size={18} strokeWidth={1.5} />
          </span>
          <span className="vsc-features-pointer-body">
            <span className="vsc-features-pointer-title">features.json</span>
            <span className="vsc-features-pointer-meta">
              {t.capabilities.pointerMeta.replace('{count}', String(copy.features.items.length))}
            </span>
          </span>
          <span className="vsc-features-pointer-cta">
            {t.capabilities.pointerCta}
            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </span>
        </button>
      </section>

      {/* Footer (VS Code authentic checkbox) */}
      <footer className="vsc-welcome-footer">
        <label className="vsc-welcome-checkbox">
          <input type="checkbox" defaultChecked aria-label={t.footer.checkbox} />
          <span>{t.footer.checkbox}</span>
        </label>
        <span className="vsc-welcome-footer-meta">
          {t.footer.meta} · v{APP_VERSION}
        </span>
      </footer>
    </div>
  )
}

function FeaturesTab() {
  const { language } = useLanguage()
  const copy = SITE_COPY[language]
  const t = WELCOME_STRINGS[language]

  return (
    <div className="vsc-features-doc">
      <header className="vsc-features-doc-head">
        <div className="vsc-features-doc-meta" aria-hidden="true">
          <span className="vsc-features-doc-meta-key">file</span>
          <span className="vsc-features-doc-meta-sep">::</span>
          <span className="vsc-features-doc-meta-val">features.json</span>
          <span className="vsc-features-doc-meta-dot">·</span>
          <span className="vsc-features-doc-meta-val">{copy.features.items.length} entries</span>
        </div>
        <h1 className="vsc-features-doc-title">{copy.features.title}</h1>
        <p className="vsc-features-doc-sub">{copy.features.subtitle}</p>
        <p className="vsc-features-doc-hint">
          {t.featuresDoc.hint}
        </p>
      </header>
      <FeatureShowcase
        features={copy.features.items}
        images={FEATURE_IMAGES}
        introLabel={copy.features.introLabel}
      />
    </div>
  )
}

const WELCOME_STRINGS = {
  'zh-CN': {
    keywordsLabel: '产品关键词',
    compare: {
      title: '深色 / 浅色 双主题',
      subtitle: '拖动中间的手柄,实时对比 WinSSH 在两种主题下的真实界面。',
      lightLabel: '浅色',
      darkLabel: '深色',
      lightAlt: 'WinSSH 浅色主题主界面截图',
      darkAlt: 'WinSSH 深色主题主界面截图',
      ariaLabel: '主题对比滑块',
      hintBefore: '提示:可使用 ',
      hintAfter: ' 方向键精细调整'
    },
    start: {
      title: '开始',
      download: '下载 WinSSH',
      downloadHint: 'Windows / macOS / Linux',
      docs: '阅读文档',
      docsHint: '从安装到高级技巧',
      github: '在 GitHub 上查看',
      githubHint: '源代码完全开放 · MIT',
      changelog: '查看更新日志',
      changelogHint: '版本历史与发布说明'
    },
    recent: {
      title: '最近发布',
      latest: '最新',
      viewAll: '查看全部发布'
    },
    walks: {
      title: '快速演练',
      subtitle: '从这里开始，几分钟内熟悉 WinSSH 的核心能力。',
      cta: '开始',
      first: {
        title: '第一次连接',
        body: '新建服务器、选择协议、保存凭据，30 秒内打开终端。'
      },
      sftp: {
        title: '双面板 SFTP',
        body: '两个面板间拖拽传输，Monaco 编辑器直接修改远程文本。'
      },
      port: {
        title: '配置端口转发',
        body: '本地 / 远程 / 动态三类规则，实时可视化连接状态。'
      },
      theme: {
        title: '自定义主题',
        body: '内建 Light+ / Dark+ / Pixel CRT，或写一个 JSON 文件加载你自己的。'
      }
    },
    capabilities: {
      title: '完整能力',
      pointerMeta: '{count} 项核心能力 · 真实截图 · 可交互浏览',
      pointerCta: '打开 features.json'
    },
    featuresDoc: {
      hint: '点击左侧步骤或使用 ↑ / ↓ 键浏览;按 Esc 失去焦点。'
    },
    footer: {
      checkbox: '启动时显示欢迎页',
      meta: 'WinSSH 官方网站'
    }
  },
  'en-US': {
    keywordsLabel: 'Product keywords',
    compare: {
      title: 'Light & Dark themes',
      subtitle: 'Drag the handle to compare the real WinSSH UI side by side.',
      lightLabel: 'Light',
      darkLabel: 'Dark',
      lightAlt: 'WinSSH light theme main interface screenshot',
      darkAlt: 'WinSSH dark theme main interface screenshot',
      ariaLabel: 'Theme comparison slider',
      hintBefore: 'Tip: use ',
      hintAfter: ' arrow keys for fine control'
    },
    start: {
      title: 'Start',
      download: 'Download WinSSH',
      downloadHint: 'Windows / macOS / Linux',
      docs: 'Read the docs',
      docsHint: 'From install to advanced',
      github: 'View on GitHub',
      githubHint: 'Source fully open · MIT',
      changelog: 'Browse the changelog',
      changelogHint: 'Releases and notes'
    },
    recent: {
      title: 'Recent',
      latest: 'latest',
      viewAll: 'See all releases'
    },
    walks: {
      title: 'Walkthroughs',
      subtitle: 'Start here. Get comfortable with the core flows in minutes.',
      cta: 'Get started',
      first: {
        title: 'Your first connection',
        body: 'Create a server, pick a protocol, save credentials — terminal in 30 seconds.'
      },
      sftp: {
        title: 'Dual-panel SFTP',
        body: 'Drag between panels. Edit remote files in Monaco without leaving the workbench.'
      },
      port: {
        title: 'Set up port forwarding',
        body: 'Local, remote, and dynamic rules with a live status graph.'
      },
      theme: {
        title: 'Customize the theme',
        body: 'Light+, Dark+, Pixel CRT — or load any custom JSON theme.'
      }
    },
    capabilities: {
      title: 'Capabilities',
      pointerMeta: '{count} core capabilities · real screenshots · interactive',
      pointerCta: 'Open features.json'
    },
    featuresDoc: {
      hint: 'Click a step on the left or use ↑ / ↓ to browse; press Esc to release focus.'
    },
    footer: {
      checkbox: 'Show welcome page on startup',
      meta: 'WinSSH Official Site'
    }
  }
} as const
