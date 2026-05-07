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
      {/* ── Hero ── */}
      <section
        id="docs-top"
        className="site-entrance site-entrance-1 border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6 lg:p-8"
      >
        <div className="site-eyebrow">{copy.docs.hero.eyebrow}</div>
        <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-[-0.03em] text-[var(--foreground)] sm:text-5xl lg:text-[3.5rem]">
          {copy.docs.hero.title}
        </h1>
        <p className="mt-5 max-w-3xl text-[0.95rem] leading-[1.75] text-[var(--workbench-muted)] sm:text-lg">
          {copy.docs.hero.subtitle}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <a className="site-primary-button" href={homeHref}>
            {copy.docs.hero.primaryCta}
            <ArrowRight className="size-4" />
          </a>
          <a className="site-secondary-button" href={`${homeHref}#download`}>
            {copy.docs.hero.secondaryCta}
          </a>
        </div>
      </section>

      {/* ── Quick nav cards ── */}
      <section className="site-card-grid site-entrance site-entrance-2 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {copy.docs.cards.map((card) => (
          <a
            key={card.id}
            href={`#${card.id}`}
            className="site-card-hover group border border-[var(--workbench-border)] bg-[var(--workbench-sidebar)] p-5 transition-colors hover:border-[color-mix(in_srgb,var(--workbench-active)_25%,var(--workbench-border))]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex size-10 items-center justify-center border border-[var(--workbench-border)] bg-[var(--workbench-input)] text-[var(--workbench-active)] transition-colors group-hover:border-[color-mix(in_srgb,var(--workbench-active)_30%,var(--workbench-border))]">
                <FileText className="size-5" />
              </div>
              <span className="border border-[var(--workbench-border)] bg-[var(--workbench-editor)] px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--workbench-muted)]">
                {card.status}
              </span>
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-[-0.01em]">{card.title}</h2>
            <p className="mt-3 text-sm leading-[1.7] text-[var(--workbench-muted)]">
              {card.summary}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--workbench-active)]">
              {card.title}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </div>
          </a>
        ))}
      </section>

      {/* ── Detailed sections ── */}
      <section className="site-entrance site-entrance-3 grid gap-5">
        {copy.docs.cards.map((card, cardIndex) => (
          <article
            key={card.id}
            id={card.id}
            className="site-card-hover scroll-mt-6 border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-6 lg:p-8"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex size-10 shrink-0 items-center justify-center border border-[var(--workbench-border)] bg-[var(--workbench-hover)] text-[var(--workbench-active)]">
                  <span className="text-sm font-bold">
                    {String(cardIndex + 1).padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <div className="site-eyebrow">{card.status}</div>
                  <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em]">{card.title}</h2>
                </div>
              </div>
              <a className="site-secondary-button shrink-0" href="#docs-top">
                {copy.docs.backToTopLabel}
              </a>
            </div>
            <p className="mt-5 max-w-3xl text-base leading-[1.75] text-[var(--workbench-muted)]">
              {card.summary}
            </p>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {card.bullets.map((bullet) => (
                <div
                  key={bullet}
                  className="flex items-center gap-2.5 border border-[var(--workbench-border)] bg-[var(--workbench-bg)] px-4 py-3 text-sm font-medium"
                >
                  <span className="size-1.5 shrink-0 bg-[var(--workbench-active)]" />
                  {bullet}
                </div>
              ))}
            </div>
            {'details' in card && card.details ? (
              <div className="mt-7 border border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-5 lg:p-6">
                <div className="site-eyebrow">{card.details.eyebrow}</div>
                <h3 className="mt-2 max-w-3xl text-xl font-bold tracking-[-0.02em]">
                  {card.details.title}
                </h3>
                <p className="mt-3 max-w-3xl text-sm leading-[1.75] text-[var(--workbench-muted)]">
                  {card.details.lead}
                </p>
                <div className="mt-6 space-y-5">
                  {card.details.sections.map((section, sectionIndex) => {
                    const bullets = 'bullets' in section ? section.bullets : undefined
                    const code = 'code' in section ? section.code : undefined
                    const note = 'note' in section ? section.note : undefined

                    return (
                      <section
                        key={section.title}
                        className="border border-[var(--workbench-border)] bg-[var(--workbench-editor)] p-4 lg:p-5"
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 text-xs font-bold text-[var(--workbench-muted)]">
                            {String(sectionIndex + 1).padStart(2, '0')}
                          </span>
                          <h4 className="text-base font-bold tracking-[-0.01em]">
                            {section.title}
                          </h4>
                        </div>
                        {section.paragraphs?.map((paragraph) => (
                          <p
                            key={paragraph}
                            className="mt-3 max-w-3xl pl-7 text-sm leading-[1.75] text-[var(--workbench-muted)]"
                          >
                            {paragraph}
                          </p>
                        ))}
                        {bullets?.length ? (
                          <ul className="mt-4 grid gap-2 pl-7 text-sm text-[var(--foreground)] md:grid-cols-2">
                            {bullets.map((bullet) => (
                              <li
                                key={bullet}
                                className="flex items-start gap-2 border border-[var(--workbench-border)] bg-[var(--workbench-bg)] px-3 py-2"
                              >
                                <span className="mt-1.5 size-1 shrink-0 bg-[var(--workbench-active)]" />
                                {bullet}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                        {code ? (
                          <div className="mt-4 overflow-hidden border border-[var(--workbench-border)] bg-[var(--workbench-panel)]">
                            <div className="flex items-center justify-between border-b border-[var(--workbench-border)] px-3 py-2">
                              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--workbench-muted)]">
                                {code.language}
                              </span>
                            </div>
                            <pre className="overflow-x-auto px-4 py-4 text-xs leading-6 text-[var(--foreground)]">
                              <code>{code.content}</code>
                            </pre>
                          </div>
                        ) : null}
                        {note ? (
                          <p className="mt-4 border-l-2 border-[var(--workbench-active)] bg-[color-mix(in_srgb,var(--workbench-active)_4%,var(--workbench-bg))] px-4 py-3 text-sm leading-[1.75] text-[var(--workbench-muted)]">
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

      {/* ── Footer note ── */}
      <section className="site-entrance site-entrance-4 border border-dashed border-[var(--workbench-border)] bg-[var(--workbench-bg)] p-6">
        <div className="text-sm leading-[1.75] text-[var(--workbench-muted)]">
          {copy.docs.footerNote}
        </div>
      </section>
    </SiteShell>
  )
}
