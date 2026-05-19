export type RouteId = 'home' | 'docs' | 'changelog' | 'download'

export interface RouteMeta {
  id: RouteId
  path: string
}

export const ROUTES: Record<RouteId, RouteMeta> = {
  home: { id: 'home', path: '/' },
  docs: { id: 'docs', path: '/docs/' },
  changelog: { id: 'changelog', path: '/changelog/' },
  download: { id: 'download', path: '/download/' }
}

export function detectRoute(): RouteId {
  if (typeof window === 'undefined') return 'home'
  const pathname = window.location.pathname
  if (pathname.startsWith('/docs')) return 'docs'
  if (pathname.startsWith('/changelog')) return 'changelog'
  if (pathname.startsWith('/download')) return 'download'
  return 'home'
}
