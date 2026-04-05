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
  sftp: FolderTree,
  forwarding: Cable,
  vault: KeyRound,
  themes: Palette,
  workbench: LayoutPanelTop
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
      <section
        id="overview"
        className="site-entrance site-entrance-1 grid scroll-mt-6 gap-4 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
      >
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
            {copy.home.hero.eyebrow}
          </div>
          <h1 className="site-marker-title mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-5xl">
            <span className="site-marker-title__text">{copy.home.hero.title}</span>
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--workbench-muted)] sm:text-lg">
            {copy.home.hero.subtitle}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
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
          <div className="mt-6 inline-flex rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-bg)] px-3 py-2 text-sm text-[var(--workbench-muted)]">
            {copy.home.hero.releaseNote}
          </div>
        </div>

        <div className="space-y-4">
          <div className="site-card-hover rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
              {copy.meta.winkMeaning}
            </div>
            <div className="mt-3 text-xl font-semibold">{copy.home.hero.winkCardTitle}</div>
            <p className="mt-3 text-sm leading-6 text-[var(--workbench-muted)]">
              {copy.home.hero.winkCardBody}
            </p>
          </div>
          <div className="site-card-hover rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
              {copy.home.hero.signalsLabel}
            </div>
            <div className="mt-4 space-y-3">
              {copy.home.hero.bullets.map((bullet) => (
                <div key={bullet} className="flex gap-3">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-[var(--workbench-active)]" />
                  <p className="text-sm leading-6 text-[var(--foreground)]">{bullet}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="site-card-grid site-entrance site-entrance-2 grid gap-4 md:grid-cols-3">
        {copy.home.metrics.map((metric) => (
          <article
            key={metric.label}
            className="site-card-hover rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] p-5"
          >
            <div className="text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
              {metric.value}
            </div>
            <div className="mt-2 text-sm font-medium">{metric.label}</div>
            <p className="mt-2 text-sm leading-6 text-[var(--workbench-muted)]">
              {metric.description}
            </p>
          </article>
        ))}
      </section>

      <section
        id="features"
        className="site-entrance site-entrance-3 scroll-mt-6 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6"
      >
        <div className="max-w-2xl">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
            {copy.home.features.eyebrow}
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
            {copy.home.features.title}
          </h2>
          <p className="mt-3 text-base leading-7 text-[var(--workbench-muted)]">
            {copy.home.features.subtitle}
          </p>
        </div>
        <div className="site-card-grid mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {copy.home.features.items.map((feature) => {
            const Icon = featureIcons[feature.id]

            return (
              <article
                key={feature.id}
                className="site-card-hover rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex size-10 items-center justify-center rounded-sm bg-[var(--workbench-hover)] text-[var(--workbench-active)]">
                    <Icon className="size-5" />
                  </div>
                  <span className="rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--workbench-muted)]">
                    {feature.tag}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--workbench-muted)]">
                  {feature.description}
                </p>
              </article>
            )
          })}
        </div>
      </section>

      <section
        id="preview"
        className="site-entrance site-entrance-4 scroll-mt-6 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6"
      >
        <div className="max-w-2xl">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
            {copy.home.preview.eyebrow}
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
            {copy.home.preview.title}
          </h2>
          <p className="mt-3 text-base leading-7 text-[var(--workbench-muted)]">
            {copy.home.preview.subtitle}
          </p>
        </div>
        <div className="mt-6">
          <WorkbenchPreview />
        </div>
      </section>

      <section
        id="download"
        className="site-entrance site-entrance-5 scroll-mt-6 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6"
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_340px]">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
              {copy.home.download.eyebrow}
            </div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
              {copy.home.download.title}
            </h2>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[var(--workbench-muted)]">
              {copy.home.download.subtitle}
            </p>
            <div className="site-card-grid mt-6 grid gap-4 md:grid-cols-3">
              {copy.home.download.cards.map((card) => (
                <article
                  key={card.id}
                  className="site-card-hover rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-5"
                >
                  <div className="text-lg font-semibold">{card.title}</div>
                  <div className="mt-2 text-sm text-[var(--workbench-muted)]">{card.status}</div>
                  <p className="mt-4 text-sm leading-6 text-[var(--foreground)]">
                    {card.description}
                  </p>
                  <a
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-[var(--workbench-active)]"
                    href={copy.meta.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {copy.home.download.ctaLabel}
                    <ArrowRight className="size-4" />
                  </a>
                </article>
              ))}
            </div>
          </div>

          <aside className="site-card-hover rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] p-5">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
              {copy.home.download.noteEyebrow}
            </div>
            <div className="mt-3 text-xl font-semibold">{copy.home.download.noteTitle}</div>
            <p className="mt-3 text-sm leading-6 text-[var(--workbench-muted)]">
              {copy.home.download.noteBody}
            </p>
            <a className="site-primary-button mt-6 inline-flex" href={docsHref}>
              {copy.home.download.noteCta}
              <ArrowRight className="size-4" />
            </a>
          </aside>
        </div>
      </section>

      <section
        id="faq"
        className="site-entrance site-entrance-5 scroll-mt-6 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6"
      >
        <div className="max-w-2xl">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
            {copy.home.faq.eyebrow}
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
            {copy.home.faq.title}
          </h2>
        </div>
        <div className="site-card-grid mt-6 grid gap-4 lg:grid-cols-2">
          {copy.home.faq.items.map((item) => (
            <article
              key={item.question}
              className="site-card-hover rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-5"
            >
              <h3 className="text-lg font-semibold">{item.question}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--workbench-muted)]">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  )
}
