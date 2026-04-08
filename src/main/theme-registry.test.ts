// @vitest-environment node

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_DARK_THEME_ID, DEFAULT_LIGHT_THEME_ID, SYSTEM_THEME_ID } from '@shared/themes'
import { ThemeRegistry } from './theme-registry'

const require = createRequire(import.meta.url)
const AdmZip = require('adm-zip') as typeof import('adm-zip')

function writeJson(filePath: string, value: unknown) {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(value, null, 2))
}

function writeDefaultThemes(root: string) {
  writeJson(join(root, 'builtin', 'defaults', 'package.json'), {
    name: 'default-themes',
    publisher: 'winssh',
    version: '0.1.0',
    contributes: {
      themes: [
        {
          id: DEFAULT_LIGHT_THEME_ID,
          label: 'Light+',
          uiTheme: 'vs',
          path: './themes/light.json'
        },
        {
          id: DEFAULT_DARK_THEME_ID,
          label: 'Dark+',
          uiTheme: 'vs-dark',
          path: './themes/dark.json'
        }
      ]
    }
  })
  writeJson(join(root, 'builtin', 'defaults', 'themes', 'light.json'), {
    colors: {}
  })
  writeJson(join(root, 'builtin', 'defaults', 'themes', 'dark.json'), {
    colors: {}
  })
}

async function writeThemeArchive(filePath: string, files: Record<string, unknown>) {
  const archive = new AdmZip()

  for (const [entryPath, value] of Object.entries(files)) {
    const content = typeof value === 'string' ? value : JSON.stringify(value, null, 2)

    archive.addFile(entryPath, Buffer.from(content))
  }

  archive.writeZip(filePath)

  const verifier = new AdmZip(filePath)
  const packageEntry = verifier
    .getEntries()
    .find((entry) => entry.entryName.endsWith('package.json'))
  const packageManifest = packageEntry ? verifier.readAsText(packageEntry) : ''

  if (!packageManifest.trim()) {
    throw new Error(`archive verification failed for "${filePath}"`)
  }
}

describe('ThemeRegistry', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true })
    }
  })

  it('loads builtin and user themes from plugin manifests', () => {
    const root = mkdtempSync(join(tmpdir(), 'winssh-theme-registry-'))
    tempDirs.push(root)

    writeDefaultThemes(root)

    writeJson(join(root, 'user', 'nebula', 'package.json'), {
      name: 'nebula-theme-pack',
      publisher: 'acme',
      version: '1.2.0',
      contributes: {
        themes: [
          {
            id: 'acme.nebula',
            label: 'Nebula',
            uiTheme: 'vs-dark',
            path: './themes/nebula.json'
          }
        ]
      }
    })
    writeJson(join(root, 'user', 'nebula', 'themes', 'nebula.json'), {
      colors: {
        'workbench-bg': '#101522',
        'workbench-active': '#73c2fb',
        'workbench-logo': '#8ed7ff',
        'workbench-card-radius': '18px'
      },
      terminal: {
        cursor: '#73c2fb'
      }
    })

    const registry = new ThemeRegistry(join(root, 'builtin'), join(root, 'user'))
    const themes = registry.listThemes()

    expect(themes.map((theme) => theme.id)).toEqual([
      DEFAULT_LIGHT_THEME_ID,
      DEFAULT_DARK_THEME_ID,
      'acme.nebula'
    ])
    expect(themes[2]?.colors['workbench-bg']).toBe('#101522')
    expect(themes[2]?.colors['workbench-logo']).toBe('#8ed7ff')
    expect(themes[2]?.colors['workbench-card-radius']).toBe('18px')
    expect(themes[2]?.terminal.cursor).toBe('#73c2fb')
    expect(themes[2]?.terminal.background).toBe('#09090b')
  })

  it('normalizes invalid selections and resolves system defaults', () => {
    const root = mkdtempSync(join(tmpdir(), 'winssh-theme-registry-'))
    tempDirs.push(root)

    writeDefaultThemes(root)

    const registry = new ThemeRegistry(join(root, 'builtin'), join(root, 'user'))

    expect(registry.normalizeSelection('missing.theme')).toBe(SYSTEM_THEME_ID)
    expect(registry.resolveTheme(SYSTEM_THEME_ID, false).id).toBe(DEFAULT_LIGHT_THEME_ID)
    expect(registry.resolveTheme(SYSTEM_THEME_ID, true).id).toBe(DEFAULT_DARK_THEME_ID)
  })

  it('derives window theme colors from the resolved theme', () => {
    const root = mkdtempSync(join(tmpdir(), 'winssh-theme-registry-'))
    tempDirs.push(root)

    writeDefaultThemes(root)
    writeJson(join(root, 'user', 'nebula', 'package.json'), {
      name: 'nebula-theme-pack',
      publisher: 'acme',
      version: '1.2.0',
      contributes: {
        themes: [
          {
            id: 'acme.nebula',
            label: 'Nebula',
            uiTheme: 'vs-dark',
            path: './themes/nebula.json'
          }
        ]
      }
    })
    writeJson(join(root, 'user', 'nebula', 'themes', 'nebula.json'), {
      colors: {
        'workbench-bg': '#101522',
        'workbench-titlebar': '#141a29',
        'workbench-muted': '#8fa1b8'
      }
    })

    const registry = new ThemeRegistry(join(root, 'builtin'), join(root, 'user'))

    expect(registry.getWindowThemeColors('acme.nebula', true)).toEqual({
      backgroundColor: '#101522',
      titleBarColor: '#141a29',
      titleBarSymbolColor: '#8fa1b8'
    })
  })

  it('imports a ZIP theme pack into the user theme directory', async () => {
    const root = mkdtempSync(join(tmpdir(), 'winssh-theme-registry-'))
    tempDirs.push(root)
    writeDefaultThemes(root)

    const archivePath = join(root, 'nebula.zip')
    await writeThemeArchive(archivePath, {
      'package.json': {
        name: 'nebula-theme-pack',
        publisher: 'acme',
        version: '1.2.0',
        contributes: {
          themes: [
            {
              id: 'acme.nebula',
              label: 'Nebula',
              uiTheme: 'vs-dark',
              path: './themes/nebula.json'
            }
          ]
        }
      },
      'themes/nebula.json': {
        colors: {
          'workbench-bg': '#101522'
        }
      }
    })

    const registry = new ThemeRegistry(join(root, 'builtin'), join(root, 'user'))
    const imported = await registry.importArchive(archivePath)

    expect(imported.pluginId).toBe('acme.nebula-theme-pack')
    expect(imported.themes).toEqual([
      {
        id: 'acme.nebula',
        label: 'Nebula'
      }
    ])
    expect(registry.listThemes().map((theme) => theme.id)).toContain('acme.nebula')
    expect(registry.getPlugin('acme.nebula-theme-pack')?.source).toBe('user')
  })

  it('imports a ZIP theme pack wrapped in a single top-level folder', async () => {
    const root = mkdtempSync(join(tmpdir(), 'winssh-theme-registry-'))
    tempDirs.push(root)
    writeDefaultThemes(root)

    const archivePath = join(root, 'wrapped-nebula.zip')
    await writeThemeArchive(archivePath, {
      'nebula-pack/package.json': {
        name: 'wrapped-nebula',
        publisher: 'acme',
        version: '1.0.0',
        contributes: {
          themes: [
            {
              id: 'acme.wrapped-nebula',
              label: 'Wrapped Nebula',
              uiTheme: 'vs-dark',
              path: './themes/wrapped-nebula.json'
            }
          ]
        }
      },
      'nebula-pack/themes/wrapped-nebula.json': {
        colors: {
          'workbench-bg': '#151b2f'
        }
      }
    })

    const registry = new ThemeRegistry(join(root, 'builtin'), join(root, 'user'))
    await registry.importArchive(archivePath)

    expect(registry.listThemes().map((theme) => theme.id)).toContain('acme.wrapped-nebula')
  })

  it('deletes imported user theme packs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'winssh-theme-registry-'))
    tempDirs.push(root)
    writeDefaultThemes(root)

    const archivePath = join(root, 'nebula.zip')
    await writeThemeArchive(archivePath, {
      'package.json': {
        name: 'nebula-theme-pack',
        publisher: 'acme',
        version: '1.2.0',
        contributes: {
          themes: [
            {
              id: 'acme.nebula',
              label: 'Nebula',
              uiTheme: 'vs-dark',
              path: './themes/nebula.json'
            }
          ]
        }
      },
      'themes/nebula.json': {
        colors: {
          'workbench-bg': '#101522'
        }
      }
    })

    const registry = new ThemeRegistry(join(root, 'builtin'), join(root, 'user'))
    await registry.importArchive(archivePath)
    const deleted = await registry.deletePlugin('acme.nebula-theme-pack')

    expect(deleted.deletedThemeIds).toEqual(['acme.nebula'])
    expect(registry.listThemes().map((theme) => theme.id)).not.toContain('acme.nebula')
    expect(registry.getPlugin('acme.nebula-theme-pack')).toBeNull()
  })

  it('rejects ZIP theme packs that conflict with built-in theme ids', async () => {
    const root = mkdtempSync(join(tmpdir(), 'winssh-theme-registry-'))
    tempDirs.push(root)
    writeDefaultThemes(root)

    const archivePath = join(root, 'conflicting.zip')
    await writeThemeArchive(archivePath, {
      'package.json': {
        name: 'conflicting-theme-pack',
        publisher: 'acme',
        version: '1.0.0',
        contributes: {
          themes: [
            {
              id: DEFAULT_DARK_THEME_ID,
              label: 'Conflicting Dark',
              uiTheme: 'vs-dark',
              path: './themes/conflicting-dark.json'
            }
          ]
        }
      },
      'themes/conflicting-dark.json': {
        colors: {
          'workbench-bg': '#1b1f2d'
        }
      }
    })

    const registry = new ThemeRegistry(join(root, 'builtin'), join(root, 'user'))

    await expect(registry.importArchive(archivePath)).rejects.toMatchObject({
      code: 'builtinThemeConflict'
    })
  })

  it('rejects deleting built-in theme packs', async () => {
    const root = mkdtempSync(join(tmpdir(), 'winssh-theme-registry-'))
    tempDirs.push(root)
    writeDefaultThemes(root)

    const registry = new ThemeRegistry(join(root, 'builtin'), join(root, 'user'))

    await expect(registry.deletePlugin('winssh.default-themes')).rejects.toMatchObject({
      code: 'pluginDeleteBuiltin'
    })
  })
})
