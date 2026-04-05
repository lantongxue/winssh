import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, basename, dirname, normalize, resolve } from 'node:path'
import { tmpdir } from 'node:os'
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
  type ThemeImportResult,
  type ThemePluginManifest,
  type ThemeSource,
  type ThemeTerminalOverrides,
  getDefaultThemeId,
  resolveThemeAppearance
} from '@shared/themes'

const require = createRequire(import.meta.url)
const AdmZip = require('adm-zip') as typeof import('adm-zip')

type ThemeLoadMode = 'warn' | 'throw'

export type ThemeRegistryErrorCode =
  | 'archiveEmpty'
  | 'archiveInvalid'
  | 'archiveLayoutInvalid'
  | 'builtinThemeConflict'
  | 'invalidPlugin'
  | 'invalidPluginDirectoryName'
  | 'pluginDeleteBuiltin'
  | 'pluginNotFound'

type ThemeRegistryErrorContext = {
  detail?: string
  pluginId?: string
  themeId?: string
}

export class ThemeRegistryError extends Error {
  constructor(
    readonly code: ThemeRegistryErrorCode,
    readonly context: ThemeRegistryErrorContext = {}
  ) {
    super(context.detail ? `${code}: ${context.detail}` : code)
    this.name = 'ThemeRegistryError'
  }
}

interface LoadedThemePlugin {
  pluginDisplayName: string
  pluginId: string
  pluginPath: string
  source: ThemeSource
  themes: ThemeDefinition[]
  version: string
}

interface ThemePluginRecord {
  pluginDisplayName: string
  pluginId: string
  pluginPath: string
  source: ThemeSource
  themeIds: string[]
  version: string
}

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

function isIgnorableArchiveEntry(entryName: string) {
  const normalized = entryName.replaceAll('\\', '/')

  return (
    normalized === '.DS_Store' || normalized.startsWith('__MACOSX/') || normalized === '__MACOSX'
  )
}

function sanitizeArchiveEntryPath(entryName: string): string | null {
  if (!entryName.trim() || isIgnorableArchiveEntry(entryName)) {
    return null
  }

  const normalized = entryName.replaceAll('\\', '/')

  if (normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new ThemeRegistryError('archiveInvalid')
  }

  const segments = normalized.split('/').filter(Boolean)
  if (segments.length === 0) {
    return null
  }

  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new ThemeRegistryError('archiveInvalid')
  }

  return segments.join('/')
}

function isSafePluginDirectoryName(pluginId: string) {
  return /^[-._a-zA-Z0-9]+$/.test(pluginId)
}

function pathExists(filePath: string) {
  return existsSync(filePath)
}

export class ThemeRegistry {
  private themes: ThemeDefinition[] = []
  private themeMap = new Map<string, ThemeDefinition>()
  private pluginMap = new Map<string, ThemePluginRecord>()

  constructor(
    private readonly builtInRoot: string,
    private readonly userRoot: string
  ) {
    this.refresh()
  }

  refresh(): void {
    const loadedPlugins = [
      ...this.loadThemeSource(this.builtInRoot, 'builtin'),
      ...this.loadThemeSource(this.userRoot, 'user')
    ]
    const seenThemeIds = new Set<string>()
    const nextThemes: ThemeDefinition[] = []
    const nextPluginMap = new Map<string, ThemePluginRecord>()

    for (const plugin of loadedPlugins) {
      const themeIds: string[] = []

      for (const theme of plugin.themes) {
        if (seenThemeIds.has(theme.id)) {
          warnTheme(`duplicate theme id "${theme.id}" detected, keeping the first definition`)
          continue
        }

        seenThemeIds.add(theme.id)
        themeIds.push(theme.id)
        nextThemes.push(theme)
      }

      if (themeIds.length > 0) {
        nextPluginMap.set(plugin.pluginId, {
          pluginDisplayName: plugin.pluginDisplayName,
          pluginId: plugin.pluginId,
          pluginPath: plugin.pluginPath,
          source: plugin.source,
          themeIds,
          version: plugin.version
        })
      }
    }

    if (nextThemes.length === 0) {
      nextThemes.push(createFallbackTheme('light'))
    }

    this.themes = nextThemes
    this.themeMap = new Map(nextThemes.map((theme) => [theme.id, theme]))
    this.pluginMap = nextPluginMap
  }

  listThemes(): ThemeDefinition[] {
    return this.themes
  }

  getTheme(themeId: string): ThemeDefinition | null {
    return this.themeMap.get(themeId) ?? null
  }

  getPlugin(pluginId: string): ThemePluginRecord | null {
    return this.pluginMap.get(pluginId) ?? null
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

  async importArchive(archivePath: string): Promise<ThemeImportResult> {
    await mkdir(this.userRoot, { recursive: true })

    const extractionRoot = await mkdtemp(join(tmpdir(), 'winssh-theme-import-'))
    const stagingRoot = await mkdtemp(join(this.userRoot, '.winssh-theme-stage-'))
    const backupRoot = await mkdtemp(join(tmpdir(), 'winssh-theme-backup-'))
    const backups: Array<{ backupPath: string; originalPath: string }> = []
    let finalPluginPath = ''
    let installCompleted = false

    try {
      await this.extractArchive(archivePath, extractionRoot)

      const extractedPluginPath = await this.resolveExtractedPluginPath(extractionRoot)
      const importedPlugin = this.loadPlugin(extractedPluginPath, 'user', 'throw')
      if (!importedPlugin) {
        throw new ThemeRegistryError('invalidPlugin')
      }

      if (!isSafePluginDirectoryName(importedPlugin.pluginId)) {
        throw new ThemeRegistryError('invalidPluginDirectoryName', {
          pluginId: importedPlugin.pluginId
        })
      }

      const conflictingPlugins = this.resolveImportConflicts(importedPlugin)
      const stagedPluginPath = join(stagingRoot, importedPlugin.pluginId)
      finalPluginPath = join(this.userRoot, importedPlugin.pluginId)

      if (!isPathWithin(this.userRoot, finalPluginPath)) {
        throw new ThemeRegistryError('invalidPluginDirectoryName', {
          pluginId: importedPlugin.pluginId
        })
      }

      await cp(extractedPluginPath, stagedPluginPath, {
        errorOnExist: true,
        force: false,
        recursive: true
      })

      for (const plugin of conflictingPlugins) {
        const backupPath = join(backupRoot, basename(plugin.pluginPath))
        await rename(plugin.pluginPath, backupPath)
        backups.push({
          backupPath,
          originalPath: plugin.pluginPath
        })
      }

      if (pathExists(finalPluginPath)) {
        const backupPath = join(backupRoot, basename(finalPluginPath))
        await rename(finalPluginPath, backupPath)
        backups.push({
          backupPath,
          originalPath: finalPluginPath
        })
      }

      await rename(stagedPluginPath, finalPluginPath)
      installCompleted = true
      this.refresh()

      const installedPlugin = this.pluginMap.get(importedPlugin.pluginId)
      if (!installedPlugin) {
        throw new ThemeRegistryError('invalidPlugin')
      }

      return {
        pluginDisplayName: installedPlugin.pluginDisplayName,
        pluginId: installedPlugin.pluginId,
        themes: installedPlugin.themeIds.map((themeId) => ({
          id: themeId,
          label: this.themeMap.get(themeId)?.label ?? themeId
        }))
      }
    } catch (error) {
      if (installCompleted && finalPluginPath) {
        await rm(finalPluginPath, { force: true, recursive: true })
      }

      for (const backup of backups.toReversed()) {
        if (pathExists(backup.backupPath)) {
          await rename(backup.backupPath, backup.originalPath)
        }
      }

      this.refresh()

      throw error
    } finally {
      await rm(extractionRoot, { force: true, recursive: true })
      await rm(stagingRoot, { force: true, recursive: true })
      await rm(backupRoot, { force: true, recursive: true })
    }
  }

  async deletePlugin(
    pluginId: string
  ): Promise<
    Pick<ThemeImportResult, 'pluginDisplayName' | 'pluginId'> & { deletedThemeIds: string[] }
  > {
    const plugin = this.pluginMap.get(pluginId)
    if (!plugin) {
      throw new ThemeRegistryError('pluginNotFound', { pluginId })
    }

    if (plugin.source !== 'user') {
      throw new ThemeRegistryError('pluginDeleteBuiltin', { pluginId })
    }

    if (!isPathWithin(this.userRoot, plugin.pluginPath)) {
      throw new ThemeRegistryError('invalidPluginDirectoryName', { pluginId })
    }

    const deletedThemeIds = [...plugin.themeIds]

    await rm(plugin.pluginPath, { force: true, recursive: true })
    this.refresh()

    return {
      deletedThemeIds,
      pluginDisplayName: plugin.pluginDisplayName,
      pluginId: plugin.pluginId
    }
  }

  private async extractArchive(archivePath: string, extractionRoot: string) {
    const zip = new AdmZip(archivePath)
    const entries = zip.getEntries()

    if (entries.length === 0) {
      throw new ThemeRegistryError('archiveEmpty')
    }

    let extractedEntries = 0

    for (const entry of entries) {
      const sanitizedEntryPath = sanitizeArchiveEntryPath(entry.entryName)

      if (!sanitizedEntryPath) {
        continue
      }

      const outputPath = join(extractionRoot, sanitizedEntryPath)
      if (!isPathWithin(extractionRoot, outputPath)) {
        throw new ThemeRegistryError('archiveInvalid')
      }

      if (entry.isDirectory) {
        mkdirSync(outputPath, { recursive: true })
        extractedEntries += 1
        continue
      }

      mkdirSync(dirname(outputPath), { recursive: true })
      await writeFile(outputPath, entry.getData())
      extractedEntries += 1
    }

    if (extractedEntries === 0) {
      throw new ThemeRegistryError('archiveEmpty')
    }
  }

  private async resolveExtractedPluginPath(extractionRoot: string): Promise<string> {
    const manifestPath = join(extractionRoot, 'package.json')
    if (pathExists(manifestPath)) {
      return extractionRoot
    }

    const entries = await readdir(extractionRoot, { withFileTypes: true })
    const meaningfulEntries = entries.filter((entry) => !isIgnorableArchiveEntry(entry.name))
    const topLevelDirectories = meaningfulEntries.filter((entry) => entry.isDirectory())
    const topLevelFiles = meaningfulEntries.filter((entry) => !entry.isDirectory())

    if (topLevelDirectories.length === 1 && topLevelFiles.length === 0) {
      const candidatePath = join(extractionRoot, topLevelDirectories[0]!.name)
      if (pathExists(join(candidatePath, 'package.json'))) {
        return candidatePath
      }
    }

    throw new ThemeRegistryError('archiveLayoutInvalid')
  }

  private resolveImportConflicts(importedPlugin: LoadedThemePlugin): ThemePluginRecord[] {
    const conflicts = new Map<string, ThemePluginRecord>()
    const existingPlugin = this.pluginMap.get(importedPlugin.pluginId)

    if (existingPlugin) {
      if (existingPlugin.source === 'builtin') {
        throw new ThemeRegistryError('builtinThemeConflict', {
          pluginId: existingPlugin.pluginId
        })
      }

      conflicts.set(existingPlugin.pluginId, existingPlugin)
    }

    for (const theme of importedPlugin.themes) {
      const existingTheme = this.themeMap.get(theme.id)
      if (!existingTheme) {
        continue
      }

      if (existingTheme.source === 'builtin') {
        throw new ThemeRegistryError('builtinThemeConflict', {
          themeId: theme.id
        })
      }

      const conflictPlugin = this.pluginMap.get(existingTheme.pluginId)
      if (conflictPlugin) {
        conflicts.set(conflictPlugin.pluginId, conflictPlugin)
      }
    }

    return [...conflicts.values()]
  }

  private loadThemeSource(rootPath: string, source: ThemeSource): LoadedThemePlugin[] {
    if (!existsSync(rootPath)) {
      return []
    }

    return readdirSync(rootPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((entry) => this.loadPlugin(join(rootPath, entry.name), source, 'warn'))
      .filter((plugin): plugin is LoadedThemePlugin => plugin !== null)
  }

  private loadPlugin(
    pluginPath: string,
    source: ThemeSource,
    mode: ThemeLoadMode
  ): LoadedThemePlugin | null {
    const manifestPath = join(pluginPath, 'package.json')

    if (!existsSync(manifestPath)) {
      if (mode === 'warn') {
        return null
      }

      throw new ThemeRegistryError('invalidPlugin')
    }

    let manifest: ThemePluginManifest

    try {
      manifest = themePluginManifestSchema.parse(readJsonFile(manifestPath))
    } catch (error) {
      if (mode === 'warn') {
        warnTheme(`failed to parse theme plugin manifest at "${manifestPath}": ${String(error)}`)
        return null
      }

      throw new ThemeRegistryError('invalidPlugin', {
        detail: `${String(error)} @ ${manifestPath} => ${JSON.stringify(readFileSync(manifestPath, 'utf8'))}`
      })
    }

    const pluginId = `${manifest.publisher}.${manifest.name}`
    const pluginDisplayName = manifest.displayName ?? manifest.name

    if (!isSafePluginDirectoryName(pluginId)) {
      if (mode === 'warn') {
        warnTheme(`ignoring theme plugin "${pluginId}" because its id is not safe for installation`)
        return null
      }

      throw new ThemeRegistryError('invalidPluginDirectoryName', { pluginId })
    }

    const themes: ThemeDefinition[] = []
    const seenThemeIds = new Set<string>()

    for (const contribution of manifest.contributes.themes) {
      const themePath = resolve(pluginPath, contribution.path)

      if (!isPathWithin(pluginPath, themePath)) {
        if (mode === 'warn') {
          warnTheme(
            `theme path "${contribution.path}" escapes plugin "${pluginId}" and was ignored`
          )
          continue
        }

        throw new ThemeRegistryError('invalidPlugin')
      }

      if (!existsSync(themePath)) {
        if (mode === 'warn') {
          warnTheme(`theme file "${themePath}" declared by "${pluginId}" does not exist`)
          continue
        }

        throw new ThemeRegistryError('invalidPlugin')
      }

      if (seenThemeIds.has(contribution.id)) {
        if (mode === 'warn') {
          warnTheme(`duplicate theme id "${contribution.id}" detected inside plugin "${pluginId}"`)
          continue
        }

        throw new ThemeRegistryError('invalidPlugin')
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

        seenThemeIds.add(contribution.id)
        themes.push(
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
        )
      } catch (error) {
        if (mode === 'warn') {
          warnTheme(
            `failed to parse theme "${contribution.id}" from "${themePath}": ${String(error)}`
          )
          continue
        }

        throw new ThemeRegistryError('invalidPlugin')
      }
    }

    if (themes.length === 0) {
      if (mode === 'warn') {
        return null
      }

      throw new ThemeRegistryError('invalidPlugin')
    }

    return {
      pluginDisplayName,
      pluginId,
      pluginPath,
      source,
      themes,
      version: manifest.version
    }
  }
}
