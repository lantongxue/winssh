export const SERVER_BRAND_IDS = [
  'linux',
  'archlinux',
  'ubuntu',
  'debian',
  'fedora',
  'centos',
  'redhat',
  'suse',
  'macos'
] as const

export type ServerBrandId = (typeof SERVER_BRAND_IDS)[number]

export const DEFAULT_SERVER_BRAND_ID: ServerBrandId = 'linux'

export const SERVER_ICON_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const

export type ServerIconMimeType = (typeof SERVER_ICON_MIME_TYPES)[number]

export const MAX_SERVER_ICON_BYTES = 256 * 1024

const BRAND_ALIASES: Record<string, ServerBrandId> = {
  almalinux: 'redhat',
  arch: 'archlinux',
  'arch-linux': 'archlinux',
  archlinux: 'archlinux',
  centos: 'centos',
  debian: 'debian',
  fedora: 'fedora',
  kali: 'debian',
  linux: 'linux',
  ol: 'redhat',
  opensuse: 'suse',
  'opensuse-leap': 'suse',
  'opensuse-tumbleweed': 'suse',
  oracle: 'redhat',
  pop: 'ubuntu',
  raspbian: 'debian',
  redhat: 'redhat',
  rhel: 'redhat',
  rocky: 'redhat',
  sles: 'suse',
  sled: 'suse',
  suse: 'suse',
  ubuntu: 'ubuntu'
}

function stripWrappingQuotes(value: string) {
  if (value.length < 2) {
    return value
  }

  const first = value[0]
  const last = value[value.length - 1]
  if ((first === '"' || first === "'") && first === last) {
    return value.slice(1, -1)
  }

  return value
}

function normalizeIdentifier(value: string) {
  return stripWrappingQuotes(value).trim().toLowerCase()
}

export function isServerIconMimeType(value: string): value is ServerIconMimeType {
  return SERVER_ICON_MIME_TYPES.includes(value as ServerIconMimeType)
}

export function resolveServerBrandIdentifier(identifier: string): ServerBrandId | null {
  return BRAND_ALIASES[normalizeIdentifier(identifier)] ?? null
}

export function resolveServerBrandFromOsRelease(content: string): ServerBrandId {
  const values = new Map<string, string>()

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim().toUpperCase()
    const value = line.slice(separatorIndex + 1).trim()
    values.set(key, stripWrappingQuotes(value))
  }

  const identifiers = [values.get('ID'), ...(values.get('ID_LIKE')?.split(/\s+/u) ?? [])].filter(
    (value): value is string => Boolean(value?.trim())
  )

  for (const identifier of identifiers) {
    const brandId = resolveServerBrandIdentifier(identifier)
    if (brandId) {
      return brandId
    }
  }

  return DEFAULT_SERVER_BRAND_ID
}
