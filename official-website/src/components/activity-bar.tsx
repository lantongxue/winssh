import { BookOpen, Download, History, House, type LucideIcon } from 'lucide-react'
import { Fragment } from 'react'
import { ROUTES, type RouteId } from '@/lib/routes'
import { withBasePath } from '@/lib/paths'
import { useLanguage } from '@/lib/language'
import { SITE_COPY } from '@/content/site'

interface ActivityBarProps {
  activeRoute: RouteId
}

interface Item {
  id: RouteId
  icon: LucideIcon
  href: string
}

const TOP_ITEMS: Item[] = [
  { id: 'home', icon: House, href: ROUTES.home.path },
  { id: 'download', icon: Download, href: ROUTES.download.path },
  { id: 'docs', icon: BookOpen, href: ROUTES.docs.path }
]

const BOTTOM_ITEMS: Item[] = [
  { id: 'changelog', icon: History, href: ROUTES.changelog.path }
]

export function ActivityBar({ activeRoute }: ActivityBarProps) {
  const { language } = useLanguage()
  const copy = SITE_COPY[language]

  return (
    <nav className="vsc-activity" aria-label={copy.brand}>
      {TOP_ITEMS.map((item) => (
        <Fragment key={item.id}>
          {renderItem(item, item.id === activeRoute, copy.nav[item.id])}
        </Fragment>
      ))}
      <div className="vsc-activity-spacer" aria-hidden="true" />
      {BOTTOM_ITEMS.map((item) => (
        <Fragment key={item.id}>
          {renderItem(item, item.id === activeRoute, copy.nav[item.id])}
        </Fragment>
      ))}
    </nav>
  )
}

function renderItem(item: Item, active: boolean, label: string) {
  const Icon = item.icon
  return (
    <a
      href={withBasePath(item.href)}
      className={`vsc-activity-icon ${active ? 'is-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      title={label}
    >
      <Icon size={22} strokeWidth={1.5} aria-hidden="true" />
    </a>
  )
}
