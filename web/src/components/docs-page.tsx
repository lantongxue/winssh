import { ArrowRight, FileText } from 'lucide-react'
import { SiteShell } from '@/components/site-shell'
import { useSiteLanguage } from '@/components/site-language'
import { withBasePath } from '@/lib/paths'

export function DocsPage() {
  const { copy } = useSiteLanguage()
  const homeHref = withBasePath('')

  return (
    <SiteShell
      activePage="docs"
      pageTitle={copy.docs.hero.title}
      sectionLinks={copy.docs.sections}
    >
      <section className="rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
          {copy.docs.hero.eyebrow}
        </div>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
          {copy.docs.hero.title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--workbench-muted)] sm:text-lg">
          {copy.docs.hero.subtitle}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a className="site-primary-button" href={homeHref}>
            {copy.docs.hero.primaryCta}
            <ArrowRight className="size-4" />
          </a>
          <a className="site-secondary-button" href={`${homeHref}#download`}>
            {copy.docs.hero.secondaryCta}
          </a>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {copy.docs.cards.map((card) => (
          <a
            key={card.id}
            href={`#${card.id}`}
            className="rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] p-5 transition-colors hover:bg-[var(--workbench-hover)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex size-10 items-center justify-center rounded-sm bg-[var(--workbench-input)] text-[var(--workbench-active)]">
                <FileText className="size-5" />
              </div>
              <span className="rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-[var(--workbench-muted)]">
                {card.status}
              </span>
            </div>
            <h2 className="mt-4 text-xl font-semibold">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--workbench-muted)]">{card.summary}</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-[var(--workbench-active)]">
              {card.title}
              <ArrowRight className="size-4" />
            </div>
          </a>
        ))}
      </section>

      <section className="grid gap-4">
        {copy.docs.cards.map((card) => (
          <article
            key={card.id}
            id={card.id}
            className="scroll-mt-6 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
                  {card.status}
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{card.title}</h2>
              </div>
              <a className="site-secondary-button" href="#top">
                Top
              </a>
            </div>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--workbench-muted)]">
              {card.summary}
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {card.bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-bg)] px-4 py-3 text-sm"
                >
                  {bullet}
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-sm border border-dashed border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-6">
        <div className="text-sm leading-7 text-[var(--workbench-muted)]">{copy.docs.footerNote}</div>
      </section>
    </SiteShell>
  )
}
