import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppFocusEvent, AppActivityEvent } from '@shared/types'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'

describe('systemClient — appFocus/appActivity subscription methods', () => {
  beforeEach(() => {
    window.winsshApi = createWinsshApiMock()
  })

  it('systemClient.appFocus.onStateChange returns unsubscribe function', () => {
    const callback = vi.fn<(event: AppFocusEvent) => void>()
    const unsubscribe = window.winsshApi.system.appFocus.onStateChange(callback)

    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })

  it('systemClient.appActivity.onStateChange returns unsubscribe function', () => {
    const callback = vi.fn<(event: AppActivityEvent) => void>()
    const unsubscribe = window.winsshApi.system.appActivity.onStateChange(callback)

    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })

  it('appFocus.onStateChange callback receives AppFocusEvent with phase "blurred"', () => {
    let capturedEvent: AppFocusEvent | null = null

    window.winsshApi = createWinsshApiMock({
      system: {
        appFocus: {
          onStateChange: vi.fn((cb: (event: AppFocusEvent) => void) => {
            cb({ phase: 'blurred' })
            return () => undefined
          })
        }
      }
    })

    window.winsshApi.system.appFocus.onStateChange((event) => {
      capturedEvent = event
    })

    expect(capturedEvent).toEqual({ phase: 'blurred' })
  })

  it('appActivity.onStateChange callback receives AppActivityEvent with phase "sleep"', () => {
    let capturedEvent: AppActivityEvent | null = null

    window.winsshApi = createWinsshApiMock({
      system: {
        appActivity: {
          onStateChange: vi.fn((cb: (event: AppActivityEvent) => void) => {
            cb({ phase: 'sleep' })
            return () => undefined
          })
        }
      }
    })

    window.winsshApi.system.appActivity.onStateChange((event) => {
      capturedEvent = event
    })

    expect(capturedEvent).toEqual({ phase: 'sleep' })
  })

  it('appFocus.onStateChange unsubscribe stops receiving events', () => {
    const callback = vi.fn<(event: AppFocusEvent) => void>()
    let storedCallback: ((event: AppFocusEvent) => void) | null = null

    window.winsshApi = createWinsshApiMock({
      system: {
        appFocus: {
          onStateChange: vi.fn((cb: (event: AppFocusEvent) => void) => {
            storedCallback = cb
            return () => {
              storedCallback = null
            }
          })
        }
      }
    })

    const unsubscribe = window.winsshApi.system.appFocus.onStateChange(callback)

    storedCallback?.({ phase: 'focused' })
    expect(callback).toHaveBeenCalledTimes(1)

    unsubscribe()
    expect(storedCallback).toBeNull()
  })

  it('appActivity supports all phase types', () => {
    const phases: AppActivityEvent['phase'][] = [
      'sleep',
      'wake',
      'lock-screen',
      'unlock-screen'
    ]

    for (const phase of phases) {
      let capturedEvent: AppActivityEvent | null = null

      window.winsshApi = createWinsshApiMock({
        system: {
          appActivity: {
            onStateChange: vi.fn((cb: (event: AppActivityEvent) => void) => {
              cb({ phase })
              return () => undefined
            })
          }
        }
      })

      window.winsshApi.system.appActivity.onStateChange((event) => {
        capturedEvent = event
      })

      expect(capturedEvent).toEqual({ phase })
    }
  })
})