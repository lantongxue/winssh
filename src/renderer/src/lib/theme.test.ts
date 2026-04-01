import { describe, expect, it } from 'vitest'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import {
  createThemeDefinition,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  DEFAULT_PIXEL_THEME_ID
} from '@shared/themes'
import { applyThemeToRoot, resolveTerminalAppearance } from '@/lib/theme'

const themes = [
  createThemeDefinition({
    appearance: 'light',
    id: DEFAULT_LIGHT_THEME_ID,
    label: 'Light+',
    pluginDisplayName: 'WinSSH Default Themes',
    pluginId: 'winssh.default-themes',
    source: 'builtin',
    version: '0.1.0'
  }),
  createThemeDefinition({
    appearance: 'dark',
    id: DEFAULT_DARK_THEME_ID,
    label: 'Dark+',
    pluginDisplayName: 'WinSSH Default Themes',
    pluginId: 'winssh.default-themes',
    source: 'builtin',
    version: '0.1.0'
  }),
  createThemeDefinition({
    appearance: 'dark',
    id: DEFAULT_PIXEL_THEME_ID,
    label: 'Pixel CRT',
    pluginDisplayName: 'WinSSH Default Themes',
    pluginId: 'winssh.default-themes',
    source: 'builtin',
    terminal: {
      background: '#050b07',
      cursor: '#7dff9b',
      foreground: '#9ff6a8',
      selectionBackground: 'rgba(125,255,155,0.22)'
    },
    terminalDefaults: {
      fontFamily: 'Lucida Console, Cascadia Mono, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.08
    },
    version: '0.1.0'
  })
]

describe('theme helpers', () => {
  it('applies the pixel theme as dark mode with its plugin theme id marker', () => {
    const root = document.createElement('html')

    applyThemeToRoot(root, DEFAULT_PIXEL_THEME_ID, themes, false)

    expect(root.classList.contains('dark')).toBe(true)
    expect(root.dataset.theme).toBe(DEFAULT_PIXEL_THEME_ID)
  })

  it('resolves system theme against the OS preference', () => {
    const root = document.createElement('html')

    applyThemeToRoot(root, 'system', themes, false)
    expect(root.classList.contains('dark')).toBe(false)
    expect(root.dataset.theme).toBe(DEFAULT_LIGHT_THEME_ID)

    applyThemeToRoot(root, 'system', themes, true)
    expect(root.classList.contains('dark')).toBe(true)
    expect(root.dataset.theme).toBe(DEFAULT_DARK_THEME_ID)
  })

  it('uses theme terminal defaults only when the user still has the base defaults', () => {
    const appearance = resolveTerminalAppearance(
      {
        ...DEFAULT_APP_SETTINGS,
        theme: DEFAULT_PIXEL_THEME_ID
      },
      themes[2]
    )

    expect(appearance.fontFamily).toBe('Lucida Console, Cascadia Mono, Consolas, monospace')
    expect(appearance.fontSize).toBe(13)
    expect(appearance.lineHeight).toBe(1.08)
    expect(appearance.theme.background).toBe('#050b07')
  })

  it('keeps user terminal typography overrides under a plugin theme', () => {
    const appearance = resolveTerminalAppearance(
      {
        ...DEFAULT_APP_SETTINGS,
        terminalFontFamily: 'IBM Plex Mono',
        terminalFontSize: 16,
        theme: DEFAULT_PIXEL_THEME_ID
      },
      themes[2]
    )

    expect(appearance.fontFamily).toBe('IBM Plex Mono')
    expect(appearance.fontSize).toBe(16)
    expect(appearance.lineHeight).toBe(1.2)
  })

  it('keeps the existing terminal palette for non-pixel themes', () => {
    const appearance = resolveTerminalAppearance(
      {
        ...DEFAULT_APP_SETTINGS,
        theme: DEFAULT_DARK_THEME_ID
      },
      themes[1]
    )

    expect(appearance.fontFamily).toBe(DEFAULT_APP_SETTINGS.terminalFontFamily)
    expect(appearance.fontSize).toBe(DEFAULT_APP_SETTINGS.terminalFontSize)
    expect(appearance.theme.background).toBe('#09090b')
    expect(appearance.theme.cursor).toBe('#38bdf8')
  })
})
