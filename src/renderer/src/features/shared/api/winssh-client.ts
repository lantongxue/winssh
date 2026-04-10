import type { WinsshApi } from '@shared/api'

export function getWinsshClient(): WinsshApi {
  return window.winsshApi
}

export function getWinsshDomainClient<TKey extends keyof WinsshApi>(key: TKey): WinsshApi[TKey] {
  return new Proxy({} as WinsshApi[TKey], {
    get(_target, property) {
      return getWinsshClient()[key][property as keyof WinsshApi[TKey]]
    }
  })
}

export const winsshClient: WinsshApi = new Proxy({} as WinsshApi, {
  get(_target, property) {
    return getWinsshClient()[property as keyof WinsshApi]
  }
})
