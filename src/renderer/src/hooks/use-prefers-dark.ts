import { useSyncExternalStore } from 'react'

const prefersDarkQuery = '(prefers-color-scheme: dark)'

function getMediaQueryList() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null
  }

  return window.matchMedia(prefersDarkQuery)
}

function subscribe(onStoreChange: () => void) {
  const mediaQueryList = getMediaQueryList()

  if (!mediaQueryList) {
    return () => undefined
  }

  const handleChange = () => onStoreChange()

  if (typeof mediaQueryList.addEventListener === 'function') {
    mediaQueryList.addEventListener('change', handleChange)
    return () => mediaQueryList.removeEventListener('change', handleChange)
  }

  mediaQueryList.addListener(handleChange)
  return () => mediaQueryList.removeListener(handleChange)
}

function getSnapshot() {
  return getMediaQueryList()?.matches ?? false
}

export function usePrefersDark() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
