import {
  ArrowRight,
  Cable,
  FolderTree,
  KeyRound,
  LayoutPanelTop,
  Palette,
  ShieldCheck,
  TerminalSquare
} from 'lucide-react'
import { SiteShell } from '@/components/site-shell'
import { useSiteLanguage } from '@/components/site-language'
import { WorkbenchPreview } from '@/components/workbench-preview'
import { withBasePath } from '@/lib/paths'

const featureIcons = {
  terminal: TerminalSquare,
  local: TerminalSquare,
  connections: KeyRound,
  sftp: FolderTree,
  forwarding: Cable,
  observability: ShieldCheck,
  themes: Palette,
  updates: LayoutPanelTop
} as const

export function HomePage() {
  const { copy } = useSiteLanguage()
  const docsHref = withBasePath('docs/')

  return (
    <SiteShell
      activePage="home"
      pageTitle={copy.home.seoTitle}
      pageDescription={copy.home.seoDescription}
      pageKeywords={copy.home.seoKeywords}
      sectionLinks={copy.home.sections}
    >
      {/* ── Hero ── */}
      <section
        id="overview"
        className="site-entrance site-entrance-1 grid scroll-mt-6 gap-6 border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:p-8"
      >
        <div>
          <div className="site-eyebrow">{copy.home.hero.eyebrow}</div>
          <h1 className="site-marker-title mt-4 max-w-3xl text-4xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-5xl lg:text-[3.5rem]">
            <span className="site-marker-title__text">{copy.home.hero.title}</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[0.95rem] leading-[1.75] text-[var(--workbench-muted)] sm:text-lg">
            {copy.home.hero.subtitle}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a className="site-primary-button" href="#download">
              {copy.home.hero.primaryCta}
              <ArrowRight className="size-4" />
            </a>
            <a className="site-secondary-button" href={docsHref}>
              {copy.home.hero.secondaryCta}
            </a>
            <a
              className="site-secondary-button"
              href={copy.meta.repoUrl}
              target="_blank"
              rel="noreferrer"
            >
              {copy.home.hero.tertiaryCta}
            </a>
          </div>
          <div className="mt-6 inline-flex items-center gap-2 border border-[var(--workbench-border)] bg-[var(--workbench-bg)] px-3 py-2 text-xs font-medium text-[var(--workbench-muted)]">
            <span className="site-status-dot" />
            {copy.home.hero.releaseNote}
          </div>
        </div>

        <div className="space-y-4">
          <div className="site-card-hover border border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-5">
            <div className="site-eyebrow">{copy.meta.winkMeaning}</div>
            <div className="mt-3 text-xl font-bold tracking-[-0.01em]">{copy.home.hero.winkCardTitle}</div>
            <p className="mt-3 text-sm leading-[1.7] text-[var(--workbench-muted)]">
              {copy.home.hero.winkCardBody}
            </p>
          </div>
          <div className="site-card-hover border border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-5">
            <div className="site-eyebrow">{copy.home.hero.signalsLabel}</div>
            <div className="mt-4 space-y-3">
              {copy.home.hero.bullets.map((bullet) => (
                <div key={bullet} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--workbench-active)]" />
                  <p className="text-sm leading-[1.7] text-[var(--foreground)]">{bullet}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Metrics ── */}
      <section className="site-card-grid site-entrance site-entrance-2 grid gap-4 md:grid-cols-3">
        {copy.home.metrics.map((metric) => (
          <article
            key={metric.label}
            className="site-card-hover border border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] p-5"
          >
            <div className="text-3xl font-bold tracking-[-0.04em] text-[var(--foreground)]">
              {metric.value}
            </div>
            <div className="mt-2 text-sm font-semibold">{metric.label}</div>
            <p className="mt-2 text-sm leading-[1.7] text-[var(--workbench-muted)]">
              {metric.description}
            </p>
          </article>
        ))}
      </section>

      {/* ── Features ── */}
      <section
        id="features"
        className="site-entrance site-entrance-3 scroll-mt-6 border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6 lg:p-8"
      >
        <div className="max-w-2xl">
          <div className="site-eyebrow">{copy.home.features.eyebrow}</div>
          <h2 className="site-section-title mt-3">{copy.home.features.title}</h2>
          <p className="mt-3 text-base leading-[1.75] text-[var(--workbench-muted)]">
            {copy.home.features.subtitle}
          </p>
        </div>
        <div className="site-card-grid mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {copy.home.features.items.map((feature) => {
            const Icon = featureIcons[feature.id]

            return (
              <article
                key={feature.id}
                className="site-card-hover group border border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex size-10 items-center justify-center border border-[var(--workbench-border)] bg-[var(--workbench-hover)] text-[var(--workbench-active)] transition-colors group-hover:border-[color-mix(in_srgb,var(--workbench-active)_30%,var(--workbench-border))]">
                    <Icon className="size-5" />
                  </div>
                  <span className="border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--workbench-muted)]">
                    {feature.tag}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-bold tracking-[-0.01em]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-[1.7] text-[var(--workbench-muted)]">
                  {feature.description}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      {/* ── Preview ── */}
      <section
        id="preview"
        className="site-entrance site-entrance-4 scroll-mt-6 border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6 lg:p-8"
      >
        <div className="max-w-2xl">
          <div className="site-eyebrow">{copy.home.preview.eyebrow}</div>
          <h2 className="site-section-title mt-3">{copy.home.preview.title}</h2>
          <p className="mt-3 text-base leading-[1.75] text-[var(--workbench-muted)]">
            {copy.home.preview.subtitle}
          </p>
        </div>
        <div className="mt-7">
          <WorkbenchPreview />
        </div>
      </section>

      {/* ── Download ── */}
      <section
        id="download"
        className="site-entrance site-entrance-5 scroll-mt-6 border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6 lg:p-8"
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_340px]">
          <div>
            <div className="site-eyebrow">{copy.home.download.eyebrow}</div>
            <h2 className="site-section-title mt-3">{copy.home.download.title}</h2>
            <p className="mt-3 max-w-3xl text-base leading-[1.75] text-[var(--workbench-muted)]">
              {copy.home.download.subtitle}
            </p>
            <div className="site-card-grid mt-7 grid gap-4 md:grid-cols-3">
              {copy.home.download.cards.map((card) => (
                <article
                  key={card.id}
                  className="site-card-hover group border border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-5"
                >
                  <div className="text-lg font-bold tracking-[-0.01em]">{card.title}</div>
                  <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--workbench-active)]">
                    <span className="site-status-dot" />
                    {card.status}
                  </div>
                  <p className="mt-4 text-sm leading-[1.7] text-[var(--foreground)]">
                    {card.description}
                  </p>
                  <a
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--workbench-active)] transition-colors hover:text-[color-mix(in_srgb,var(--workbench-active)_80%,var(--foreground))] "
                    href={copy.meta.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {copy.home.download.ctaLabel}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </a>
                </article>
              ))}
            </div>
          </div>

          <aside className="site-card-hover border border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] p-5">
            <div className="site-eyebrow">{copy.home.download.noteEyebrow}</div>
            <div className="mt-3 text-xl font-bold tracking-[-0.01em]">{copy.home.download.noteTitle}</div>
            <p className="mt-3 text-sm leading-[1.7] text-[var(--workbench-muted)]">
              {copy.home.download.noteBody}
            </p>
            <a className="site-primary-button mt-6 inline-flex" href={docsHref}>
              {copy.home.download.noteCta}
              <ArrowRight className="size-4" />
            </a>
          </aside>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section
        id="faq"
        className="site-entrance site-entrance-5 scroll-mt-6 border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6 lg:p-8"
      >
        <div className="max-w-2xl">
          <div className="site-eyebrow">{copy.home.faq.eyebrow}</div>
          <h2 className="site-section-title mt-3">{copy.home.faq.title}</h2>
        </div>
        <div className="site-card-grid mt-7 grid gap-4 lg:grid-cols-2">
          {copy.home.faq.items.map((item) => (
            <article
              key={item.question}
              className="site-card-hover border border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-5"
            >
              <h3 className="text-base font-bold tracking-[-0.01em]">{item.question}</h3>
              <p className="mt-3 text-sm leading-[1.7] text-[var(--workbench-muted)]">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  )
}
