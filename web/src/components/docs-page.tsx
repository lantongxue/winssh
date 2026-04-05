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
      pageTitle={copy.docs.seoTitle}
      pageDescription={copy.docs.seoDescription}
      pageKeywords={copy.docs.seoKeywords}
      sectionLinks={copy.docs.sections}
    >
      <section
        id="docs-top"
        className="site-entrance site-entrance-1 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6"
      >
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

      <section className="site-card-grid site-entrance site-entrance-2 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {copy.docs.cards.map((card) => (
          <a
            key={card.id}
            href={`#${card.id}`}
            className="site-card-hover rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] p-5 transition-colors hover:bg-[var(--workbench-hover)]"
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

      <section className="site-entrance site-entrance-3 grid gap-4">
        {copy.docs.cards.map((card) => (
          <article
            key={card.id}
            id={card.id}
            className="site-card-hover scroll-mt-6 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
                  {card.status}
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{card.title}</h2>
              </div>
              <a className="site-secondary-button" href="#docs-top">
                {copy.docs.backToTopLabel}
              </a>
            </div>
            <p className="mt-4 max-w-3xl text-base leading-7 text-[var(--workbench-muted)]">
              {card.summary}
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {card.bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="site-card-hover rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-bg)] px-4 py-3 text-sm"
                >
                  {bullet}
                </div>
              ))}
            </div>
            {'details' in card && card.details ? (
              <div className="site-card-hover mt-6 rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-5">
                <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
                  {card.details.eyebrow}
                </div>
                <h3 className="mt-2 max-w-3xl text-xl font-semibold tracking-[-0.02em]">
                  {card.details.title}
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--workbench-muted)]">
                  {card.details.lead}
                </p>
                <div className="mt-6 space-y-4">
                  {card.details.sections.map((section) => {
                    const bullets = 'bullets' in section ? section.bullets : undefined
                    const code = 'code' in section ? section.code : undefined
                    const note = 'note' in section ? section.note : undefined

                    return (
                      <section
                        key={section.title}
                        className="site-card-hover rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-4"
                      >
                        <h4 className="text-base font-semibold tracking-[-0.01em]">{section.title}</h4>
                        {section.paragraphs?.map((paragraph) => (
                          <p
                            key={paragraph}
                            className="mt-3 max-w-3xl text-sm leading-7 text-[var(--workbench-muted)]"
                          >
                            {paragraph}
                          </p>
                        ))}
                        {bullets?.length ? (
                          <ul className="mt-4 grid gap-2 text-sm text-[var(--foreground)] md:grid-cols-2">
                            {bullets.map((bullet) => (
                              <li
                                key={bullet}
                                className="site-card-hover rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-bg)] px-3 py-2"
                              >
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {code ? (
                          <div className="mt-4 overflow-hidden rounded-sm border border-[var(--workbench-border)] bg-[var(--workbench-panel)]">
                            <div className="border-b border-[var(--workbench-border)] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
                              {code.language}
                            </div>
                            <pre className="overflow-x-auto px-4 py-4 text-xs leading-6 text-[var(--foreground)]">
                              <code>{code.content}</code>
                            </pre>
                          </div>
                        ) : null}
                        {note ? (
                          <p className="mt-4 rounded-sm border border-dashed border-[var(--workbench-border)] bg-[var(--workbench-bg)] px-3 py-3 text-sm leading-7 text-[var(--workbench-muted)]">
                            {note}
                          </p>
                        ) : null}
                      </section>
                    )
                  })}
                </div>
              </div>
            ) : null}
          </article>
        ))}
      </section>

      <section className="site-entrance site-entrance-4 rounded-sm border border-dashed border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-6">
        <div className="text-sm leading-7 text-[var(--workbench-muted)]">{copy.docs.footerNote}</div>
      </section>
    </SiteShell>
  )
}
