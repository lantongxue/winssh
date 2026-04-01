import { describe, expect, it } from 'vitest'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { applyThemeToRoot, resolveTerminalAppearance } from '@/lib/theme'

describe('theme helpers', () => {
  it('applies the pixel theme as dark mode with a pixel data-theme marker', () => {
    const root = document.createElement('html')

    applyThemeToRoot(root, 'pixel', false)

    expect(root.classList.contains('dark')).toBe(true)
    expect(root.dataset.theme).toBe('pixel')
  })

  it('resolves system theme against the OS preference', () => {
    const root = document.createElement('html')

    applyThemeToRoot(root, 'system', false)
    expect(root.classList.contains('dark')).toBe(false)
    expect(root.dataset.theme).toBe('light')

    applyThemeToRoot(root, 'system', true)
    expect(root.classList.contains('dark')).toBe(true)
    expect(root.dataset.theme).toBe('dark')
  })

  it('uses pixel terminal defaults only when the user still has the base defaults', () => {
    const appearance = resolveTerminalAppearance({
      ...DEFAULT_APP_SETTINGS,
      theme: 'pixel'
    })

    expect(appearance.fontFamily).toBe('Lucida Console, Cascadia Mono, Consolas, monospace')
    expect(appearance.fontSize).toBe(13)
    expect(appearance.lineHeight).toBe(1.08)
    expect(appearance.theme.background).toBe('#050b07')
  })

  it('keeps user terminal typography overrides under the pixel theme', () => {
    const appearance = resolveTerminalAppearance({
      ...DEFAULT_APP_SETTINGS,
      terminalFontFamily: 'IBM Plex Mono',
      terminalFontSize: 16,
      theme: 'pixel'
    })

    expect(appearance.fontFamily).toBe('IBM Plex Mono')
    expect(appearance.fontSize).toBe(16)
    expect(appearance.lineHeight).toBe(1.2)
  })

  it('keeps the existing terminal palette for non-pixel themes', () => {
    const appearance = resolveTerminalAppearance({
      ...DEFAULT_APP_SETTINGS,
      theme: 'dark'
    })

    expect(appearance.fontFamily).toBe(DEFAULT_APP_SETTINGS.terminalFontFamily)
    expect(appearance.fontSize).toBe(DEFAULT_APP_SETTINGS.terminalFontSize)
    expect(appearance.theme.background).toBe('#09090b')
    expect(appearance.theme.cursor).toBe('#38bdf8')
  })
})
