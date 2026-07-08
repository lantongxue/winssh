import { motion } from 'motion/react'
import { useLanguage } from '../i18n/LanguageContext'
import { Circle, GitCommit, Loader2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface Release {
  id: number
  tag_name: string
  name: string
  published_at: string
  body: string
  prerelease: boolean
  html_url: string
}

function ReleaseItem({
  release,
  index,
  formatDate,
  t
}: {
  release: Release
  index: number
  formatDate: (d: string) => string
  t: any
}) {
  const [expanded, setExpanded] = useState(false)
  // Check if content is long enough to need a collapse/expand button
  const isLong = release.body && (release.body.length > 300 || release.body.split('\n').length > 5)

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.8, delay: index * 0.1 }}
      className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active"
    >
      {/* Icon */}
      <div className="flex items-center justify-center w-6 h-6 rounded-full border border-white/20 bg-[#030303] text-neutral-500 group-hover:text-white group-hover:border-white/50 transition-colors shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-[0_0_0_4px_#030303] relative z-10">
        <GitCommit className="w-3 h-3" />
      </div>

      {/* Card */}
      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-2rem)] p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="font-display font-semibold text-xl text-white">
              <a
                href={release.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cyan-400 transition-colors"
              >
                {release.name || release.tag_name}
              </a>
            </h3>
            {release.prerelease && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                Pre-release
              </span>
            )}
          </div>
          <time className="text-sm font-mono text-neutral-500">
            {formatDate(release.published_at)}
          </time>
        </div>

        <div
          className={`mt-4 break-words relative transition-all duration-300 ${!expanded && isLong ? 'max-h-[200px] overflow-hidden' : ''}`}
          style={
            !expanded && isLong
              ? {
                  WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
                  maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)'
                }
              : {}
          }
        >
          <ReactMarkdown
            components={{
              ul: ({ node, ...props }) => <ul className="space-y-3 my-4" {...props} />,
              li: ({ node, ...props }) => (
                <li className="flex items-start gap-3 text-neutral-400 text-sm font-light">
                  <Circle className="w-1.5 h-1.5 mt-1.5 shrink-0 text-white/30 fill-white/30" />
                  <span className="leading-relaxed flex-1" {...props} />
                </li>
              ),
              p: ({ node, ...props }) => (
                <p className="text-neutral-400 text-sm font-light mb-3 last:mb-0" {...props} />
              ),
              h1: ({ node, ...props }) => (
                <h4 className="text-white font-medium text-base mb-2 mt-6 first:mt-0" {...props} />
              ),
              h2: ({ node, ...props }) => (
                <h4 className="text-white font-medium text-base mb-2 mt-6 first:mt-0" {...props} />
              ),
              h3: ({ node, ...props }) => (
                <h4
                  className="text-white font-medium text-sm text-neutral-300 mb-2 mt-6 first:mt-0"
                  {...props}
                />
              ),
              a: ({ node, ...props }) => (
                <a
                  className="text-cyan-400 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                />
              ),
              code: ({ node, ...props }) => (
                <code
                  className="bg-white/10 px-1 py-0.5 rounded text-xs font-mono text-neutral-300"
                  {...props}
                />
              ),
              strong: ({ node, ...props }) => (
                <strong className="font-semibold text-neutral-200" {...props} />
              )
            }}
          >
            {release.body}
          </ReactMarkdown>
        </div>

        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-4 text-sm font-medium text-neutral-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" /> {t.changelogSection.showLess || 'Show less'}
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" /> {t.changelogSection.showMore || 'Read more'}
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  )
}

export function Changelog() {
  const { t, language } = useLanguage()
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(3)

  useEffect(() => {
    fetch('https://api.github.com/repos/lantongxue/winssh/releases')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setReleases(data) // fetch all up to GitHub's default page size (30)
        }
      })
      .catch((e) => console.error('Error fetching releases', e))
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date)
  }

  return (
    <section id="changelog" className="py-32 px-6 relative z-10 border-t border-white/5">
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="font-display text-4xl md:text-5xl font-bold tracking-tight mb-4"
          >
            {t.changelogSection.titleLevel1}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neutral-300 to-white">
              {t.changelogSection.titleLevel2}
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="text-neutral-400 text-lg font-light"
          >
            {t.changelogSection.desc}
          </motion.p>
        </div>

        <div className="space-y-16 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
          {loading ? (
            <div className="flex justify-center items-center py-20 text-neutral-500 relative z-10">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            releases
              .slice(0, visibleCount)
              .map((release, i) => (
                <ReleaseItem
                  key={release.id}
                  release={release}
                  index={i}
                  formatDate={formatDate}
                  t={t}
                />
              ))
          )}
        </div>

        {!loading && releases.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-20 flex justify-center relative z-10"
          >
            {visibleCount < releases.length ? (
              <button
                onClick={() => setVisibleCount((prev) => prev + 3)}
                className="px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium transition-colors flex items-center gap-2"
              >
                <ChevronDown className="w-4 h-4" />
                {t.changelogSection.loadMore || 'Load more releases'}
              </button>
            ) : (
              <a
                href="https://github.com/lantongxue/winssh/releases"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-white font-medium transition-colors flex items-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                {t.changelogSection.viewAllOnGithub || 'View all on GitHub'}
              </a>
            )}
          </motion.div>
        )}
      </div>
    </section>
  )
}
