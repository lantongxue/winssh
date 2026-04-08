import { describe, expect, it } from 'vitest'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import {
  createThemeDefinition,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  DEFAULT_PIXEL_THEME_ID
} from '@shared/themes'
import {
  applyThemeToRoot,
  formatTerminalFontFamily,
  resolveTerminalAppearance
} from '@/lib/theme'

const themes = [
  createThemeDefinition({
    appearance: 'light',
    id: DEFAULT_LIGHT_THEME_ID,
    label: 'Light+',
    pluginDisplayName: 'WinSSH Default Themes',
    pluginId: 'winssh.default-themes',
    source: 'builtin',
    terminal: {
      background: '#ffffff',
      foreground: '#1f2328',
      cursor: '#0f6cbd',
      selectionBackground: 'rgba(15,108,189,0.18)'
    },
    version: '0.1.0'
  }),
  createThemeDefinition({
    appearance: 'dark',
    id: DEFAULT_DARK_THEME_ID,
    label: 'Dark+',
    pluginDisplayName: 'WinSSH Default Themes',
    pluginId: 'winssh.default-themes',
    source: 'builtin',
    terminal: {
      background: '#181a1f',
      foreground: '#d7dbe0',
      cursor: '#3794ff',
      selectionBackground: 'rgba(55,148,255,0.24)'
    },
    version: '0.1.0'
  }),
  createThemeDefinition({
    appearance: 'dark',
    id: DEFAULT_PIXEL_THEME_ID,
    label: 'Pixel CRT',
    colors: {
      'workbench-logo': '#9ff6a8',
      'workbench-card-radius': '2px',
      'workbench-tab-radius': '2px'
    },
    pluginDisplayName: 'WinSSH Default Themes',
    pluginId: 'winssh.default-themes',
    source: 'builtin',
    terminal: {
      background: '#0b1811',
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
    expect(root.style.getPropertyValue('--workbench-logo')).toBe('#9ff6a8')
    expect(root.style.getPropertyValue('--workbench-card-radius')).toBe('2px')
    expect(root.style.getPropertyValue('--workbench-tab-radius')).toBe('2px')
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
    expect(appearance.theme.background).toBe('#0b1811')
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

  it('uses the bundled terminal palette for built-in dark themes', () => {
    const appearance = resolveTerminalAppearance(
      {
        ...DEFAULT_APP_SETTINGS,
        theme: DEFAULT_DARK_THEME_ID
      },
      themes[1]
    )

    expect(appearance.fontFamily).toBe(DEFAULT_APP_SETTINGS.terminalFontFamily)
    expect(appearance.fontSize).toBe(DEFAULT_APP_SETTINGS.terminalFontSize)
    expect(appearance.theme.background).toBe('#181a1f')
    expect(appearance.theme.cursor).toBe('#3794ff')
  })

  it('uses the bundled terminal palette for built-in light themes', () => {
    const appearance = resolveTerminalAppearance(
      {
        ...DEFAULT_APP_SETTINGS,
        theme: DEFAULT_LIGHT_THEME_ID
      },
      themes[0]
    )

    expect(appearance.theme.background).toBe('#ffffff')
    expect(appearance.theme.foreground).toBe('#1f2328')
  })

  it('formats terminal font stacks so xterm can reliably apply named fonts', () => {
    expect(formatTerminalFontFamily('IBM Plex Mono')).toBe('"IBM Plex Mono", monospace')
    expect(formatTerminalFontFamily('JetBrains Mono, Consolas, monospace')).toBe(
      '"JetBrains Mono", Consolas, monospace'
    )
    expect(formatTerminalFontFamily('"Cascadia Code", ui-monospace')).toBe(
      '"Cascadia Code", ui-monospace'
    )
  })
})
