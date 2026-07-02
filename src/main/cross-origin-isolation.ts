import type { Session } from 'electron'

export function createCrossOriginIsolationHeaders(): Record<string, string[]> {
  return {
    'Cross-Origin-Opener-Policy': ['same-origin'],
    'Cross-Origin-Embedder-Policy': ['require-corp']
  }
}

export function registerCrossOriginIsolationHeaders(session: Session): void {
  session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        ...createCrossOriginIsolationHeaders()
      }
    })
  })
}
