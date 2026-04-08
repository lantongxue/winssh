import { z } from 'zod'

export const SYSTEM_THEME_ID = 'system'
export const DEFAULT_LIGHT_THEME_ID = 'winssh.light-plus'
export const DEFAULT_DARK_THEME_ID = 'winssh.dark-plus'
export const DEFAULT_PIXEL_THEME_ID = 'winssh.pixel-crt'

export const THEME_UI_OPTIONS = ['vs', 'vs-dark'] as const
export const THEME_APPEARANCE_OPTIONS = ['light', 'dark'] as const
export const THEME_SOURCE_OPTIONS = ['builtin', 'user'] as const

export type ThemeSelection = string
export type ThemeUiOption = (typeof THEME_UI_OPTIONS)[number]
export type ThemeAppearance = (typeof THEME_APPEARANCE_OPTIONS)[number]
export type ThemeSource = (typeof THEME_SOURCE_OPTIONS)[number]

export const THEME_COLOR_KEYS = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'border',
  'input',
  'ring',
  'radius',
  'sidebar',
  'sidebar-foreground',
  'sidebar-primary',
  'sidebar-primary-foreground',
  'sidebar-accent',
  'sidebar-accent-foreground',
  'sidebar-border',
  'sidebar-ring',
  'workbench-bg',
  'workbench-titlebar',
  'workbench-window-control-hover',
  'workbench-window-control-hover-foreground',
  'workbench-activity-bar',
  'workbench-sidebar',
  'workbench-tabs',
  'workbench-editor',
  'workbench-panel',
  'workbench-border',
  'workbench-hover',
  'workbench-active',
  'workbench-logo',
  'workbench-statusbar',
  'workbench-statusbar-foreground',
  'workbench-muted',
  'workbench-input',
  'workbench-card-radius',
  'workbench-hero-radius',
  'workbench-list-radius',
  'workbench-metric-radius',
  'workbench-panel-frame-radius',
  'workbench-tab-radius',
  'toast-info',
  'toast-success',
  'toast-warning',
  'toast-shadow',
  'toast-highlight',
  'toast-radius',
  'toast-button-radius',
  'toast-backdrop-blur',
  'glass-surface',
  'glass-surface-strong',
  'glass-surface-elevated',
  'glass-surface-interactive',
  'glass-surface-interactive-hover',
  'glass-border',
  'glass-border-strong',
  'glass-highlight',
  'glass-shadow',
  'glass-shadow-strong',
  'glass-glow',
  'glass-blur',
  'glass-saturate',
  'terminal-surface-bg',
  'terminal-overlay-backdrop',
  'terminal-overlay-panel',
  'terminal-overlay-border',
  'terminal-overlay-text',
  'terminal-overlay-muted',
  'terminal-overlay-label',
  'terminal-overlay-accent',
  'terminal-overlay-accent-strong',
  'terminal-overlay-accent-soft',
  'terminal-overlay-progress',
  'terminal-overlay-step-border',
  'terminal-overlay-warning',
  'terminal-overlay-warning-soft',
  'terminal-overlay-radius',
  'terminal-overlay-backdrop-blur',
  'terminal-scanline-opacity',
  'terminal-scanline-color',
  'terminal-scanline-size'
] as const

export const TERMINAL_COLOR_KEYS = [
  'background',
  'foreground',
  'cursor',
  'selectionBackground',
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
  'brightBlack',
  'brightRed',
  'brightGreen',
  'brightYellow',
  'brightBlue',
  'brightMagenta',
  'brightCyan',
  'brightWhite'
] as const

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number]
export type TerminalColorKey = (typeof TERMINAL_COLOR_KEYS)[number]
export type ThemeColorOverrides = Partial<Record<ThemeColorKey, string>>
export type ThemeTerminalOverrides = Partial<Record<TerminalColorKey, string>>
export type ThemeColorMap = Record<ThemeColorKey, string>
export type ThemeTerminalMap = Record<TerminalColorKey, string>

export interface ThemeTerminalDefaults {
  fontFamily?: string
  fontSize?: number
  lineHeight?: number
}

export interface ThemeDefinitionInput {
  appearance: ThemeAppearance
  colors?: ThemeColorOverrides
  description?: string
  id: string
  label: string
  pluginDisplayName: string
  pluginId: string
  source: ThemeSource
  terminal?: ThemeTerminalOverrides
  terminalDefaults?: ThemeTerminalDefaults
  version: string
}

export interface ThemeDefinition {
  appearance: ThemeAppearance
  colors: ThemeColorMap
  description?: string
  id: string
  label: string
  pluginDisplayName: string
  pluginId: string
  source: ThemeSource
  terminal: ThemeTerminalMap
  terminalDefaults?: ThemeTerminalDefaults
  version: string
}

export interface ThemeImportEntry {
  id: string
  label: string
}

export interface ThemeImportResult {
  pluginId: string
  pluginDisplayName: string
  themes: ThemeImportEntry[]
}

export interface ThemeDeleteResult {
  pluginId: string
  pluginDisplayName: string
  deletedThemeIds: string[]
  nextThemeSelection: ThemeSelection | null
}

export interface ThemePluginContribution {
  id: string
  label: string
  description?: string
  path: string
  uiTheme: ThemeUiOption
}

export interface ThemePluginManifest {
  contributes: {
    themes: ThemePluginContribution[]
  }
  displayName?: string
  name: string
  publisher: string
  version: string
}

export interface ThemeDocument {
  colors: Record<string, string>
  terminal: Record<string, string>
  terminalDefaults?: ThemeTerminalDefaults
}

export const lightThemeColors = {
  background: '#fdfdfd',
  foreground: '#1f2328',
  card: '#ffffff',
  'card-foreground': '#1f2328',
  popover: '#ffffff',
  'popover-foreground': '#1f2328',
  primary: '#0f6cbd',
  'primary-foreground': '#ffffff',
  secondary: '#eef2f6',
  'secondary-foreground': '#1f2328',
  muted: '#f3f5f7',
  'muted-foreground': '#5f6b7a',
  accent: '#e8edf3',
  'accent-foreground': '#1f2328',
  destructive: '#c72e0f',
  'destructive-foreground': '#ffffff',
  border: '#d7dce2',
  input: '#f6f8fa',
  ring: '#0078d4',
  radius: '0px',
  sidebar: '#f6f8fa',
  'sidebar-foreground': '#1f2328',
  'sidebar-primary': '#0f6cbd',
  'sidebar-primary-foreground': '#ffffff',
  'sidebar-accent': '#e8edf3',
  'sidebar-accent-foreground': '#1f2328',
  'sidebar-border': '#d7dce2',
  'sidebar-ring': '#0078d4',
  'workbench-bg': '#f3f5f7',
  'workbench-titlebar': '#f3f5f7',
  'workbench-window-control-hover': 'rgba(15, 23, 42, 0.12)',
  'workbench-window-control-hover-foreground': '#1f2328',
  'workbench-activity-bar': '#eef2f6',
  'workbench-sidebar': '#f6f8fa',
  'workbench-tabs': '#eef2f6',
  'workbench-editor': '#ffffff',
  'workbench-panel': '#f6f8fa',
  'workbench-border': '#d7dce2',
  'workbench-hover': 'rgba(15, 23, 42, 0.06)',
  'workbench-active': '#0f6cbd',
  'workbench-logo': '#01364f',
  'workbench-statusbar': '#007acc',
  'workbench-statusbar-foreground': '#ffffff',
  'workbench-muted': '#5f6b7a',
  'workbench-input': '#ffffff',
  'workbench-card-radius': 'var(--radius)',
  'workbench-hero-radius': 'var(--radius)',
  'workbench-list-radius': 'var(--radius)',
  'workbench-metric-radius': 'var(--radius)',
  'workbench-panel-frame-radius': 'var(--radius)',
  'workbench-tab-radius': 'var(--radius)',
  'toast-info': '#0f6cbd',
  'toast-success': '#0f8f52',
  'toast-warning': '#b7791f',
  'toast-shadow': '0 18px 42px rgba(15, 23, 42, 0.16)',
  'toast-highlight': 'rgba(255, 255, 255, 0.75)',
  'toast-radius': '0px',
  'toast-button-radius': '0px',
  'toast-backdrop-blur': '18px',
  'glass-surface': 'rgba(255, 255, 255, 0.82)',
  'glass-surface-strong': 'rgba(255, 255, 255, 0.92)',
  'glass-surface-elevated': 'rgba(255, 255, 255, 0.97)',
  'glass-surface-interactive': 'rgba(255, 255, 255, 0.74)',
  'glass-surface-interactive-hover': 'rgba(255, 255, 255, 0.94)',
  'glass-border': 'rgba(15, 23, 42, 0.08)',
  'glass-border-strong': 'rgba(15, 23, 42, 0.16)',
  'glass-highlight': 'rgba(255, 255, 255, 0.88)',
  'glass-shadow': '0 18px 42px rgba(15, 23, 42, 0.10)',
  'glass-shadow-strong': '0 28px 72px rgba(15, 23, 42, 0.18)',
  'glass-glow': '0 0 0 1px rgba(255, 255, 255, 0.25), 0 12px 28px rgba(15, 108, 189, 0.12)',
  'glass-blur': '0px',
  'glass-saturate': '100%',
  'terminal-surface-bg': '#1e1e1e',
  'terminal-overlay-backdrop': 'rgba(0, 0, 0, 0.45)',
  'terminal-overlay-panel': 'rgba(9, 9, 11, 0.95)',
  'terminal-overlay-border': 'rgba(255, 255, 255, 0.1)',
  'terminal-overlay-text': '#f4f4f5',
  'terminal-overlay-muted': '#a1a1aa',
  'terminal-overlay-label': '#71717a',
  'terminal-overlay-accent': '#7dd3fc',
  'terminal-overlay-accent-strong': '#38bdf8',
  'terminal-overlay-accent-soft': 'rgba(14, 165, 233, 0.15)',
  'terminal-overlay-progress': '#38bdf8',
  'terminal-overlay-step-border': '#3f3f46',
  'terminal-overlay-warning': '#fcd34d',
  'terminal-overlay-warning-soft': 'rgba(245, 158, 11, 0.12)',
  'terminal-overlay-radius': '0px',
  'terminal-overlay-backdrop-blur': '0px',
  'terminal-scanline-opacity': '0',
  'terminal-scanline-color': 'rgba(255, 255, 255, 0)',
  'terminal-scanline-size': '3px'
} satisfies ThemeColorMap

export const darkThemeColors = {
  background: '#181a1f',
  foreground: '#d7dbe0',
  card: '#20242b',
  'card-foreground': '#d7dbe0',
  popover: '#20242b',
  'popover-foreground': '#d7dbe0',
  primary: '#3794ff',
  'primary-foreground': '#ffffff',
  secondary: '#2a2f38',
  'secondary-foreground': '#d7dbe0',
  muted: '#20242b',
  'muted-foreground': '#97a3b6',
  accent: '#2a2f38',
  'accent-foreground': '#ffffff',
  destructive: '#f14c4c',
  'destructive-foreground': '#ffffff',
  border: '#2a3038',
  input: '#20242b',
  ring: '#3794ff',
  radius: '0px',
  sidebar: '#20242b',
  'sidebar-foreground': '#d7dbe0',
  'sidebar-primary': '#3794ff',
  'sidebar-primary-foreground': '#ffffff',
  'sidebar-accent': '#2a2f38',
  'sidebar-accent-foreground': '#ffffff',
  'sidebar-border': '#2a3038',
  'sidebar-ring': '#3794ff',
  'workbench-bg': '#181a1f',
  'workbench-titlebar': '#181a1f',
  'workbench-window-control-hover': 'rgba(255, 255, 255, 0.14)',
  'workbench-window-control-hover-foreground': '#f3f6fa',
  'workbench-activity-bar': '#20242b',
  'workbench-sidebar': '#20242b',
  'workbench-tabs': '#20242b',
  'workbench-editor': '#181a1f',
  'workbench-panel': '#15171b',
  'workbench-border': '#2a3038',
  'workbench-hover': 'rgba(255, 255, 255, 0.07)',
  'workbench-active': '#3794ff',
  'workbench-logo': '#3794ff',
  'workbench-statusbar': '#007acc',
  'workbench-statusbar-foreground': '#ffffff',
  'workbench-muted': '#97a3b6',
  'workbench-input': '#20242b',
  'workbench-card-radius': 'var(--radius)',
  'workbench-hero-radius': 'var(--radius)',
  'workbench-list-radius': 'var(--radius)',
  'workbench-metric-radius': 'var(--radius)',
  'workbench-panel-frame-radius': 'var(--radius)',
  'workbench-tab-radius': 'var(--radius)',
  'toast-info': '#3794ff',
  'toast-success': '#33c481',
  'toast-warning': '#f0b44c',
  'toast-shadow': '0 22px 54px rgba(0, 0, 0, 0.42)',
  'toast-highlight': 'rgba(255, 255, 255, 0.04)',
  'toast-radius': '0px',
  'toast-button-radius': '0px',
  'toast-backdrop-blur': '18px',
  'glass-surface': 'rgba(32, 36, 43, 0.78)',
  'glass-surface-strong': 'rgba(40, 45, 54, 0.88)',
  'glass-surface-elevated': 'rgba(47, 53, 63, 0.94)',
  'glass-surface-interactive': 'rgba(47, 53, 63, 0.72)',
  'glass-surface-interactive-hover': 'rgba(58, 65, 77, 0.92)',
  'glass-border': 'rgba(148, 163, 184, 0.16)',
  'glass-border-strong': 'rgba(191, 219, 254, 0.24)',
  'glass-highlight': 'rgba(255, 255, 255, 0.08)',
  'glass-shadow': '0 22px 54px rgba(0, 0, 0, 0.36)',
  'glass-shadow-strong': '0 32px 80px rgba(0, 0, 0, 0.54)',
  'glass-glow': '0 0 0 1px rgba(125, 211, 252, 0.14), 0 16px 36px rgba(56, 189, 248, 0.16)',
  'glass-blur': '0px',
  'glass-saturate': '100%',
  'terminal-surface-bg': '#1e1e1e',
  'terminal-overlay-backdrop': 'rgba(0, 0, 0, 0.45)',
  'terminal-overlay-panel': 'rgba(9, 9, 11, 0.95)',
  'terminal-overlay-border': 'rgba(255, 255, 255, 0.1)',
  'terminal-overlay-text': '#f4f4f5',
  'terminal-overlay-muted': '#a1a1aa',
  'terminal-overlay-label': '#71717a',
  'terminal-overlay-accent': '#7dd3fc',
  'terminal-overlay-accent-strong': '#38bdf8',
  'terminal-overlay-accent-soft': 'rgba(14, 165, 233, 0.15)',
  'terminal-overlay-progress': '#38bdf8',
  'terminal-overlay-step-border': '#3f3f46',
  'terminal-overlay-warning': '#fcd34d',
  'terminal-overlay-warning-soft': 'rgba(245, 158, 11, 0.12)',
  'terminal-overlay-radius': '0px',
  'terminal-overlay-backdrop-blur': '0px',
  'terminal-scanline-opacity': '0',
  'terminal-scanline-color': 'rgba(255, 255, 255, 0)',
  'terminal-scanline-size': '3px'
} satisfies ThemeColorMap

export const defaultTerminalColors = {
  background: '#09090b',
  foreground: '#e4e4e7',
  cursor: '#38bdf8',
  selectionBackground: 'rgba(14, 165, 233, 0.24)',
  black: '#09090b',
  red: '#f87171',
  green: '#4ade80',
  yellow: '#facc15',
  blue: '#60a5fa',
  magenta: '#c084fc',
  cyan: '#22d3ee',
  white: '#f4f4f5',
  brightBlack: '#71717a',
  brightRed: '#fb7185',
  brightGreen: '#86efac',
  brightYellow: '#fde047',
  brightBlue: '#93c5fd',
  brightMagenta: '#d8b4fe',
  brightCyan: '#67e8f9',
  brightWhite: '#fafafa'
} satisfies ThemeTerminalMap

const themePluginContributionSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(200).optional(),
  path: z.string().trim().min(1),
  uiTheme: z.enum(THEME_UI_OPTIONS)
})

export const themePluginManifestSchema = z.object({
  contributes: z.object({
    themes: z.array(themePluginContributionSchema).min(1)
  }),
  displayName: z.string().trim().min(1).max(80).optional(),
  name: z.string().trim().min(1).max(80),
  publisher: z.string().trim().min(1).max(80),
  version: z.string().trim().min(1).max(32)
})

export const themeDocumentSchema = z.object({
  colors: z.record(z.string().trim().min(1), z.string().trim().min(1)).default({}),
  terminal: z.record(z.string().trim().min(1), z.string().trim().min(1)).default({}),
  terminalDefaults: z
    .object({
      fontFamily: z.string().trim().min(1).max(120).optional(),
      fontSize: z.number().int().min(10).max(24).optional(),
      lineHeight: z.number().min(1).max(2).optional()
    })
    .optional()
})

export function resolveThemeAppearance(uiTheme: ThemeUiOption): ThemeAppearance {
  return uiTheme === 'vs' ? 'light' : 'dark'
}

export function getDefaultThemeId(appearance: ThemeAppearance): string {
  return appearance === 'dark' ? DEFAULT_DARK_THEME_ID : DEFAULT_LIGHT_THEME_ID
}

export function getBaseThemeColors(appearance: ThemeAppearance): ThemeColorMap {
  return appearance === 'dark' ? darkThemeColors : lightThemeColors
}

export function createThemeDefinition(input: ThemeDefinitionInput): ThemeDefinition {
  return {
    appearance: input.appearance,
    colors: {
      ...getBaseThemeColors(input.appearance),
      ...input.colors
    },
    description: input.description,
    id: input.id,
    label: input.label,
    pluginDisplayName: input.pluginDisplayName,
    pluginId: input.pluginId,
    source: input.source,
    terminal: {
      ...defaultTerminalColors,
      ...input.terminal
    },
    terminalDefaults: input.terminalDefaults,
    version: input.version
  }
}
