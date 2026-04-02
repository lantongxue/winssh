import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_DARK_THEME_ID, DEFAULT_LIGHT_THEME_ID, SYSTEM_THEME_ID } from '@shared/themes'
import { ThemeRegistry } from './theme-registry'

function writeJson(filePath: string, value: unknown) {
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(value, null, 2))
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
        'workbench-logo': '#8ed7ff'
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
    expect(themes[2]?.terminal.cursor).toBe('#73c2fb')
    expect(themes[2]?.terminal.background).toBe('#09090b')
  })

  it('normalizes invalid selections and resolves system defaults', () => {
    const root = mkdtempSync(join(tmpdir(), 'winssh-theme-registry-'))
    tempDirs.push(root)

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

    const registry = new ThemeRegistry(join(root, 'builtin'), join(root, 'user'))

    expect(registry.normalizeSelection('missing.theme')).toBe(SYSTEM_THEME_ID)
    expect(registry.resolveTheme(SYSTEM_THEME_ID, false).id).toBe(DEFAULT_LIGHT_THEME_ID)
    expect(registry.resolveTheme(SYSTEM_THEME_ID, true).id).toBe(DEFAULT_DARK_THEME_ID)
  })
})
