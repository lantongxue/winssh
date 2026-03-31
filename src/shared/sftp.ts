function stripTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) {
    return pathname.replace(/\/+$/, '')
  }

  return pathname
}

export function normalizeRemotePath(input: string | undefined | null): string {
  if (!input) {
    return '/'
  }

  const fragments = input.replace(/\\/g, '/').split('/')
  const stack: string[] = []

  for (const fragment of fragments) {
    if (!fragment || fragment === '.') {
      continue
    }

    if (fragment === '..') {
      stack.pop()
      continue
    }

    stack.push(fragment)
  }

  return stack.length ? `/${stack.join('/')}` : '/'
}

export function joinRemotePath(basePath: string, name: string): string {
  return normalizeRemotePath(`${stripTrailingSlash(normalizeRemotePath(basePath))}/${name}`)
}

export function getParentRemotePath(pathname: string): string {
  const normalized = normalizeRemotePath(pathname)
  if (normalized === '/') {
    return '/'
  }

  const parts = stripTrailingSlash(normalized).split('/').filter(Boolean)
  parts.pop()

  return parts.length ? `/${parts.join('/')}` : '/'
}

export function sortRemoteEntries<T extends { kind: string; name: string }>(entries: T[]): T[] {
  return [...entries].sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === 'directory' ? -1 : 1
    }

    return left.name.localeCompare(right.name, 'zh-CN', { sensitivity: 'base' })
  })
}
