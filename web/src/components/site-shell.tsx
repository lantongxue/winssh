import { useEffect, useState } from 'react'
import {
  ArrowUpRight,
  BookOpenText,
  Download,
  Github,
  LayoutDashboard,
  Sparkles,
  Waypoints
} from 'lucide-react'
import { BrandLogo } from '@/components/brand-logo'
import { LanguageToggle } from '@/components/language-toggle'
import { useSiteLanguage } from '@/components/site-language'
import { type SitePage } from '@/content/site'
import { withBasePath } from '@/lib/paths'

interface SectionLink {
  id: string
  label: string
  meta: string
}

interface ToolbarLink {
  active?: boolean
  external?: boolean
  href: string
  icon: RailLinkId
  label: string
}

const railIcons = {
  home: LayoutDashboard,
  features: Sparkles,
  download: Download,
  docs: BookOpenText,
  github: Github
} as const

type RailLinkId = keyof typeof railIcons

function upsertNamedMetaTag(name: string, content: string) {
  let tag = document.head.querySelector(`meta[name="${name}"]`)

  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute('name', name)
    document.head.appendChild(tag)
  }

  tag.setAttribute('content', content)
}

function resolveActiveRailLink(activePage: SitePage, hash: string): RailLinkId {
  if (activePage === 'docs') {
    return 'docs'
  }

  if (hash === '#features') {
    return 'features'
  }

  if (hash === '#download') {
    return 'download'
  }

  return 'home'
}

export function SiteShell({
  activePage,
  children,
  pageTitle,
  pageDescription,
  pageKeywords,
  sectionLinks
}: {
  activePage: SitePage
  children: React.ReactNode
  pageTitle: string
  pageDescription: string
  pageKeywords: readonly string[]
  sectionLinks: readonly SectionLink[]
}) {
  const { copy, locale, setLocale } = useSiteLanguage()
  const docsHref = withBasePath('docs/')
  const homeHref = withBasePath('')
  const [activeRailId, setActiveRailId] = useState<RailLinkId>(() =>
    resolveActiveRailLink(activePage, typeof window === 'undefined' ? '' : window.location.hash)
  )

  const homeAnchors = {
    overview: `${homeHref}#overview`,
    features: `${homeHref}#features`,
    download: `${homeHref}#download`
  }

  useEffect(() => {
    const syncActiveRail = () => {
      setActiveRailId(resolveActiveRailLink(activePage, window.location.hash))
    }

    syncActiveRail()
    window.addEventListener('hashchange', syncActiveRail)
    window.addEventListener('popstate', syncActiveRail)

    return () => {
      window.removeEventListener('hashchange', syncActiveRail)
      window.removeEventListener('popstate', syncActiveRail)
    }
  }, [activePage])

  useEffect(() => {
    document.title = pageTitle
    upsertNamedMetaTag('description', pageDescription)
    upsertNamedMetaTag('keywords', pageKeywords.join(', '))
  }, [pageDescription, pageKeywords, pageTitle])

  const toolbarLinks: ToolbarLink[] = [
    {
      href: activePage === 'home' ? '#overview' : homeHref,
      icon: 'home',
      label: copy.shell.homeLabel,
      active: activeRailId === 'home'
    },
    {
      href: activePage === 'home' ? '#features' : homeAnchors.features,
      icon: 'features',
      label: copy.shell.featuresLabel,
      active: activeRailId === 'features'
    },
    {
      href: activePage === 'home' ? '#download' : homeAnchors.download,
      icon: 'download',
      label: copy.shell.downloadLabel,
      active: activeRailId === 'download'
    },
    {
      href: docsHref,
      icon: 'docs',
      label: copy.shell.docsLabel,
      active: activeRailId === 'docs'
    },
    {
      href: copy.meta.repoUrl,
      icon: 'github',
      label: copy.shell.githubLabel,
      external: true
    }
  ]

  const railLinks = [
    {
      id: 'home' as RailLinkId,
      href: activePage === 'home' ? '#overview' : homeHref,
      label: copy.shell.railHome,
      active: activeRailId === 'home'
    },
    {
      id: 'features' as RailLinkId,
      href: activePage === 'home' ? '#features' : homeAnchors.features,
      label: copy.shell.railFeatures,
      active: activeRailId === 'features'
    },
    {
      id: 'download' as RailLinkId,
      href: activePage === 'home' ? '#download' : homeAnchors.download,
      label: copy.shell.railDownload,
      active: activeRailId === 'download'
    },
    {
      id: 'docs' as RailLinkId,
      href: docsHref,
      label: copy.shell.railDocs,
      active: activeRailId === 'docs'
    },
    {
      id: 'github' as RailLinkId,
      href: copy.meta.repoUrl,
      label: copy.shell.railGithub,
      active: false,
      external: true
    }
  ]

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--workbench-bg)] text-[var(--foreground)]">
      <header className="site-titlebar flex h-11 shrink-0 items-center border-b border-[var(--workbench-border)] bg-[var(--workbench-titlebar)] px-3">
        <div className="flex min-w-0 items-center gap-3">
          <a className="flex min-w-0 items-center gap-3" href={homeHref}>
            <div className="flex size-7 items-center justify-center text-[var(--workbench-logo)]">
              <BrandLogo className="size-6" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{copy.meta.appName}</div>
              <div className="truncate text-[11px] text-[var(--workbench-muted)]">
                {copy.shell.tagline}
              </div>
            </div>
          </a>
        </div>

        <nav className="mx-auto hidden items-center gap-1 lg:flex">
          {toolbarLinks.map((item) => {
            const Icon = railIcons[item.icon]

            return (
              <a
                key={`${item.icon}:${item.label}`}
                className={`site-toolbar-link ${item.active ? 'site-toolbar-link--active' : ''}`}
                href={item.href}
                aria-current={item.active ? 'location' : undefined}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noreferrer' : undefined}
              >
                <Icon className="size-3.5" />
                <span>{item.label}</span>
              </a>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            className={`site-toolbar-link hidden md:inline-flex ${
              activeRailId === 'docs' ? 'site-toolbar-link--active' : ''
            }`}
            href={docsHref}
            aria-current={activeRailId === 'docs' ? 'location' : undefined}
          >
            <BookOpenText className="size-3.5" />
            {copy.shell.docsLabel}
          </a>
          <LanguageToggle
            currentLocale={locale}
            label={copy.shell.languageLabel}
            onChange={setLocale}
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r border-[var(--workbench-border)] bg-[var(--workbench-activity-bar)] py-3 md:flex">
          {railLinks.map((item) => {
            const Icon = railIcons[item.id]
            const content = (
              <>
                {item.active ? (
                  <span className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-[var(--workbench-active)]" />
                ) : null}
                <Icon className="size-4" />
              </>
            )

            return item.external ? (
              <a
                key={item.id}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                aria-label={item.label}
                className="site-activity-link"
                title={item.label}
              >
                {content}
              </a>
            ) : (
              <a
                key={item.id}
                href={item.href}
                aria-label={item.label}
                aria-current={item.active ? 'location' : undefined}
                className={`site-activity-link ${item.active ? 'site-activity-link--active' : ''}`}
                title={item.label}
              >
                {content}
              </a>
            )
          })}
        </aside>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="grid h-full min-h-0 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="hidden min-h-0 border-r border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] px-4 py-5 lg:block">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
                <Waypoints className="size-3.5" />
                {copy.shell.sectionLabel}
              </div>
              <div className="mt-4 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)]">
                {sectionLinks.map((section) => (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    className="flex items-start justify-between gap-3 border-b border-[var(--workbench-border)] px-4 py-3 last:border-b-0 hover:bg-[var(--workbench-hover)]"
                  >
                    <div>
                      <div className="text-sm font-medium">{section.label}</div>
                      <div className="mt-1 text-xs text-[var(--workbench-muted)]">
                        {section.meta}
                      </div>
                    </div>
                    <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-[var(--workbench-muted)]" />
                  </a>
                ))}
              </div>
              <div className="mt-4 rounded-sm border border-dashed border-[var(--workbench-border)] bg-[var(--workbench-bg)] px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
                  {copy.meta.winkMeaning}
                </div>
                <div className="mt-2 text-sm text-[var(--foreground)]">{pageTitle}</div>
              </div>
            </aside>

            <main className="min-h-0 overflow-y-auto bg-[var(--workbench-editor)]">
              <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
                <div className="flex gap-2 overflow-x-auto lg:hidden">
                  {sectionLinks.map((section) => (
                    <a key={section.id} href={`#${section.id}`} className="site-mobile-chip">
                      {section.label}
                    </a>
                  ))}
                </div>
                {children}
              </div>
            </main>
          </div>
        </div>
      </div>

      <footer className="flex h-7 shrink-0 items-center justify-between gap-3 overflow-x-auto bg-[var(--workbench-statusbar)] px-3 text-[11px] text-[var(--workbench-statusbar-foreground)]">
        <div className="flex min-w-max items-center gap-3">
          <span className="font-semibold">{copy.meta.appName}</span>
          <span>{copy.shell.statusChannelLabel}: {copy.meta.releaseChannel}</span>
          <span>{copy.shell.statusVersionLabel}: {copy.meta.version}</span>
        </div>
        <div className="flex min-w-max items-center gap-3">
          <span>
            {copy.shell.statusPlatformLabel}: {copy.meta.platforms.map((platform) => platform.label).join(' / ')}
          </span>
          <span>
            {copy.shell.statusLanguageLabel}: {locale}
          </span>
          <a href={copy.meta.repoUrl} target="_blank" rel="noreferrer">
            {copy.shell.githubLabel}
          </a>
        </div>
      </footer>
    </div>
  )
}
