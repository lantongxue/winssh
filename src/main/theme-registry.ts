import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, normalize, resolve } from 'node:path'
import type { AppSettings } from '@shared/types'
import {
  createThemeDefinition,
  SYSTEM_THEME_ID,
  TERMINAL_COLOR_KEYS,
  THEME_COLOR_KEYS,
  themeDocumentSchema,
  themePluginManifestSchema,
  type TerminalColorKey,
  type ThemeAppearance,
  type ThemeColorKey,
  type ThemeColorOverrides,
  type ThemeDefinition,
  type ThemePluginManifest,
  type ThemeSource,
  type ThemeTerminalOverrides,
  getDefaultThemeId,
  resolveThemeAppearance
} from '@shared/themes'

function isPathWithin(parentPath: string, targetPath: string) {
  const normalizedParent = normalize(resolve(parentPath))
  const normalizedTarget = normalize(resolve(targetPath))

  return (
    normalizedTarget === normalizedParent ||
    normalizedTarget.startsWith(`${normalizedParent}\\`) ||
    normalizedTarget.startsWith(`${normalizedParent}/`)
  )
}

function readJsonFile(filePath: string) {
  return JSON.parse(readFileSync(filePath, 'utf8')) as unknown
}

function warnTheme(message: string) {
  console.warn(`[themes] ${message}`)
}

function pickOverrides<Key extends string>(
  collectionName: string,
  keys: readonly Key[],
  raw: Record<string, string>,
  themeId: string
): Partial<Record<Key, string>> {
  const knownKeys = new Set<string>(keys)
  const next: Partial<Record<Key, string>> = {}

  for (const [key, value] of Object.entries(raw)) {
    if (!knownKeys.has(key)) {
      warnTheme(`ignoring unknown ${collectionName} token "${key}" in theme "${themeId}"`)
      continue
    }

    next[key as Key] = value
  }

  return next
}

function createFallbackTheme(appearance: ThemeAppearance): ThemeDefinition {
  return createThemeDefinition({
    appearance,
    id: getDefaultThemeId(appearance),
    label: appearance === 'dark' ? 'Dark+' : 'Light+',
    pluginDisplayName: 'WinSSH Fallback Theme',
    pluginId: 'winssh.fallback-theme',
    source: 'builtin',
    version: '0.0.0'
  })
}

export class ThemeRegistry {
  private themes: ThemeDefinition[] = []
  private themeMap = new Map<string, ThemeDefinition>()

  constructor(
    private readonly builtInRoot: string,
    private readonly userRoot: string
  ) {
    this.refresh()
  }

  refresh(): void {
    const loadedThemes = [
      ...this.loadThemeSource(this.builtInRoot, 'builtin'),
      ...this.loadThemeSource(this.userRoot, 'user')
    ]
    const seen = new Set<string>()
    const nextThemes: ThemeDefinition[] = []

    for (const theme of loadedThemes) {
      if (seen.has(theme.id)) {
        warnTheme(`duplicate theme id "${theme.id}" detected, keeping the first definition`)
        continue
      }

      seen.add(theme.id)
      nextThemes.push(theme)
    }

    if (nextThemes.length === 0) {
      nextThemes.push(createFallbackTheme('light'))
    }

    this.themes = nextThemes
    this.themeMap = new Map(nextThemes.map((theme) => [theme.id, theme]))
  }

  listThemes(): ThemeDefinition[] {
    return this.themes
  }

  hasTheme(themeId: string): boolean {
    return this.themeMap.has(themeId)
  }

  isValidSelection(themeSelection: string): boolean {
    return themeSelection === SYSTEM_THEME_ID || this.hasTheme(themeSelection)
  }

  normalizeSelection(themeSelection: string): string {
    return this.isValidSelection(themeSelection) ? themeSelection : SYSTEM_THEME_ID
  }

  normalizeSettings(settings: AppSettings): AppSettings {
    return {
      ...settings,
      theme: this.normalizeSelection(settings.theme)
    }
  }

  resolveTheme(themeSelection: string, prefersDark: boolean): ThemeDefinition {
    const normalizedSelection = this.normalizeSelection(themeSelection)
    const themeId =
      normalizedSelection === SYSTEM_THEME_ID
        ? getDefaultThemeId(prefersDark ? 'dark' : 'light')
        : normalizedSelection

    return (
      this.themeMap.get(themeId) ??
      this.themeMap.get(getDefaultThemeId('light')) ??
      this.themes[0] ??
      createFallbackTheme(prefersDark ? 'dark' : 'light')
    )
  }

  getWindowBackgroundColor(themeSelection: string, prefersDark: boolean): string {
    return this.resolveTheme(themeSelection, prefersDark).colors['workbench-bg']
  }

  private loadThemeSource(rootPath: string, source: ThemeSource): ThemeDefinition[] {
    if (!existsSync(rootPath)) {
      return []
    }

    return readdirSync(rootPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name))
      .flatMap((entry) => this.loadPlugin(join(rootPath, entry.name), source))
  }

  private loadPlugin(pluginPath: string, source: ThemeSource): ThemeDefinition[] {
    const manifestPath = join(pluginPath, 'package.json')

    if (!existsSync(manifestPath)) {
      return []
    }

    let manifest: ThemePluginManifest

    try {
      manifest = themePluginManifestSchema.parse(readJsonFile(manifestPath))
    } catch (error) {
      warnTheme(`failed to parse theme plugin manifest at "${manifestPath}": ${String(error)}`)
      return []
    }

    const pluginId = `${manifest.publisher}.${manifest.name}`
    const pluginDisplayName = manifest.displayName ?? manifest.name

    return manifest.contributes.themes.flatMap((contribution) => {
      const themePath = resolve(pluginPath, contribution.path)

      if (!isPathWithin(pluginPath, themePath)) {
        warnTheme(`theme path "${contribution.path}" escapes plugin "${pluginId}" and was ignored`)
        return []
      }

      if (!existsSync(themePath)) {
        warnTheme(`theme file "${themePath}" declared by "${pluginId}" does not exist`)
        return []
      }

      try {
        const themeDocument = themeDocumentSchema.parse(readJsonFile(themePath))
        const colors = pickOverrides<ThemeColorKey>(
          'color',
          THEME_COLOR_KEYS,
          themeDocument.colors,
          contribution.id
        ) as ThemeColorOverrides
        const terminal = pickOverrides<TerminalColorKey>(
          'terminal',
          TERMINAL_COLOR_KEYS,
          themeDocument.terminal,
          contribution.id
        ) as ThemeTerminalOverrides

        return [
          createThemeDefinition({
            appearance: resolveThemeAppearance(contribution.uiTheme),
            colors,
            description: contribution.description,
            id: contribution.id,
            label: contribution.label,
            pluginDisplayName,
            pluginId,
            source,
            terminal,
            terminalDefaults: themeDocument.terminalDefaults,
            version: manifest.version
          })
        ]
      } catch (error) {
        warnTheme(`failed to parse theme "${contribution.id}" from "${themePath}": ${String(error)}`)
        return []
      }
    })
  }
}
