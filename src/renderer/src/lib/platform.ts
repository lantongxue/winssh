export function getPlatform() {
  if (typeof navigator === 'undefined') {
    return ''
  }

  const platform =
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    navigator.userAgent

  return platform.toLowerCase()
}

export function isMacPlatform(platform = getPlatform()) {
  return platform.includes('mac')
}
