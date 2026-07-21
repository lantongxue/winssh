import type { AppSettings, ProxyConfiguration, Server } from './types'

export function resolveServerProxy(
  server: Server,
  settings: AppSettings
): ProxyConfiguration | null {
  const serverProxyMode = server.proxyMode ?? 'global'

  if (serverProxyMode === 'none') {
    return null
  }

  if (serverProxyMode === 'custom') {
    if (!server.proxyHost?.trim()) {
      throw new Error('Proxy host is required')
    }

    return {
      type: server.proxyType,
      host: server.proxyHost.trim(),
      port: server.proxyPort
    }
  }

  if (!settings.proxyMode || settings.proxyMode === 'none') {
    return null
  }

  return {
    type: settings.proxyType,
    host: settings.proxyHost.trim(),
    port: settings.proxyPort
  }
}
