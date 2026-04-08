import { describe, expect, it } from 'vitest'
import { getWindowChromeOptions } from './window-config'

describe('getWindowChromeOptions', () => {
  it('keeps the native title bar when custom chrome is disabled', () => {
    expect(getWindowChromeOptions({ windowTitleBarStyle: 'native' }, 'win32')).toEqual({
      titleBarStyle: 'default'
    })
  })

  it('uses hidden inset chrome on macOS custom title bars', () => {
    expect(getWindowChromeOptions({ windowTitleBarStyle: 'custom' }, 'darwin')).toEqual({
      titleBarStyle: 'hiddenInset'
    })
  })

  it('uses a hidden title bar with native overlay controls on Windows custom title bars', () => {
    expect(getWindowChromeOptions({ windowTitleBarStyle: 'custom' }, 'win32')).toEqual({
      titleBarStyle: 'hidden',
      titleBarOverlay: true
    })
  })
})
