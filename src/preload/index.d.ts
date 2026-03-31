import type { WinsshApi } from '@shared/api'

declare global {
  interface Window {
    winsshApi: WinsshApi
  }
}

export {}
