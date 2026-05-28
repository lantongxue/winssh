import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { BrowserWindow } from 'electron'

const { powerMonitorEmitter } = vi.hoisted(() => {
  const { EventEmitter } = require('node:events')
  return { powerMonitorEmitter: new EventEmitter() }
})

vi.mock('electron', () => ({
  powerMonitor: powerMonitorEmitter
}))

import { setupAppFocusAndActivityListeners } from '@main/app-focus-activity'

// --- Helpers -------------------------------------------------------------

function createMockWindow() {
  const send = vi.fn()
  const windowEmitter = new EventEmitter()
  const window = {
    on: windowEmitter.on.bind(windowEmitter),
    removeListener: windowEmitter.removeListener.bind(windowEmitter),
    webContents: { send }
  } as unknown as BrowserWindow
  return { window, send, windowEmitter }
}

function emitWindowEvent(emitter: EventEmitter, event: string) {
  emitter.emit(event)
}

function emitPowerMonitorEvent(event: string) {
  powerMonitorEmitter.emit(event)
}

// --- Tests ---------------------------------------------------------------

describe('setupAppFocusAndActivityListeners', () => {
  let window: BrowserWindow
  let send: Mock
  let windowEmitter: EventEmitter

  beforeEach(() => {
    vi.useFakeTimers()
    const mock = createMockWindow()
    window = mock.window
    send = mock.send
    windowEmitter = mock.windowEmitter
    send.mockClear()
  })

  // --- Focus events ------------------------------------------------------

  describe('focus', () => {
    it('sends system:appFocus with phase focused when window gains focus', () => {
      setupAppFocusAndActivityListeners(window)

      emitWindowEvent(windowEmitter, 'focus')

      expect(send).toHaveBeenCalledWith('system:appFocus', { phase: 'focused' })
    })

    it('cancels pending blur debounce on focus', () => {
      setupAppFocusAndActivityListeners(window)

      emitWindowEvent(windowEmitter, 'blur')
      // Blur is debounced — not sent yet
      expect(send).not.toHaveBeenCalledWith('system:appFocus', { phase: 'blurred' })

      emitWindowEvent(windowEmitter, 'focus')
      // Focus cancels the debounce timer
      vi.advanceTimersByTime(200)

      // Only the focused event was sent, not blurred
      expect(send).not.toHaveBeenCalledWith('system:appFocus', { phase: 'blurred' })
      expect(send).toHaveBeenCalledWith('system:appFocus', { phase: 'focused' })
    })
  })

  // --- Blur events (debounced) -------------------------------------------

  describe('blur debounce', () => {
    it('does NOT send system:appFocus blurred immediately on blur', () => {
      setupAppFocusAndActivityListeners(window)

      emitWindowEvent(windowEmitter, 'blur')

      expect(send).not.toHaveBeenCalledWith('system:appFocus', expect.anything())
    })

    it('sends system:appFocus with phase blurred after 100ms debounce', () => {
      setupAppFocusAndActivityListeners(window)

      emitWindowEvent(windowEmitter, 'blur')
      vi.advanceTimersByTime(100)

      expect(send).toHaveBeenCalledWith('system:appFocus', { phase: 'blurred' })
    })

    it('suppresses rapid Alt+Tab blur→focus→blur flooding', () => {
      setupAppFocusAndActivityListeners(window)

      emitWindowEvent(windowEmitter, 'blur')
      vi.advanceTimersByTime(50) // halfway through debounce
      emitWindowEvent(windowEmitter, 'focus') // cancels debounce
      emitWindowEvent(windowEmitter, 'blur') // new debounce starts
      vi.advanceTimersByTime(50) // not enough time
      expect(send).not.toHaveBeenCalledWith('system:appFocus', { phase: 'blurred' })

      vi.advanceTimersByTime(50) // total 100ms from second blur
      expect(send).toHaveBeenCalledWith('system:appFocus', { phase: 'blurred' })
      expect(send).toHaveBeenCalledWith('system:appFocus', { phase: 'focused' })
      // Only 2 sends total: focused + blurred
      const appFocusCalls = send.mock.calls.filter(
        (c: unknown[]) => c[0] === 'system:appFocus'
      )
      expect(appFocusCalls.length).toBe(2)
    })
  })

  // --- Power monitor events ----------------------------------------------

  describe('powerMonitor', () => {
    it('sends system:appActivity with phase sleep on suspend', () => {
      setupAppFocusAndActivityListeners(window)

      emitPowerMonitorEvent('suspend')

      expect(send).toHaveBeenCalledWith('system:appActivity', { phase: 'sleep' })
    })

    it('sends system:appActivity with phase wake on resume', () => {
      setupAppFocusAndActivityListeners(window)

      emitPowerMonitorEvent('resume')

      expect(send).toHaveBeenCalledWith('system:appActivity', { phase: 'wake' })
    })

    it('sends system:appActivity with phase lock-screen on lock-screen', () => {
      setupAppFocusAndActivityListeners(window)

      emitPowerMonitorEvent('lock-screen')

      expect(send).toHaveBeenCalledWith('system:appActivity', { phase: 'lock-screen' })
    })

    it('sends system:appActivity with phase unlock-screen on unlock-screen', () => {
      setupAppFocusAndActivityListeners(window)

      emitPowerMonitorEvent('unlock-screen')

      expect(send).toHaveBeenCalledWith('system:appActivity', { phase: 'unlock-screen' })
    })
  })

  // --- Cleanup -----------------------------------------------------------

  describe('cleanup', () => {
    it('removes all listeners when cleanup is called', () => {
      const cleanup = setupAppFocusAndActivityListeners(window)

      cleanup()

      // After cleanup, events should not trigger sends
      emitWindowEvent(windowEmitter, 'focus')
      emitWindowEvent(windowEmitter, 'blur')
      emitPowerMonitorEvent('suspend')

      expect(send).not.toHaveBeenCalled()
    })

    it('pending blur debounce is cancelled on cleanup', () => {
      const cleanup = setupAppFocusAndActivityListeners(window)

      emitWindowEvent(windowEmitter, 'blur')
      cleanup()
      vi.advanceTimersByTime(200)

      expect(send).not.toHaveBeenCalledWith('system:appFocus', { phase: 'blurred' })
    })
  })
})