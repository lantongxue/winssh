import { describe, expect, it, beforeEach } from 'vitest'
import {
  applyTheme,
  resolveInitialThemeSelection,
  persistThemeSelection,
  SITE_DARK_THEME_ID,
  SITE_LIGHT_THEME_ID,
  SITE_THEME_STORAGE_KEY,
  SITE_THEME_SYSTEM
} from '@/lib/theme'

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('data-theme-appearance')
    document.documentElement.style.cssText = ''
    document.documentElement.classList.remove('dark')
  })

  it('defaults to system selection when storage is empty', () => {
    expect(resolveInitialThemeSelection()).toBe(SITE_THEME_SYSTEM)
  })

  it('persists explicit selection', () => {
    persistThemeSelection(SITE_DARK_THEME_ID)
    expect(localStorage.getItem(SITE_THEME_STORAGE_KEY)).toBe(SITE_DARK_THEME_ID)
    expect(resolveInitialThemeSelection()).toBe(SITE_DARK_THEME_ID)
  })

  it('applies light theme tokens onto root', () => {
    const resolved = applyTheme(document.documentElement, SITE_LIGHT_THEME_ID, 'light')
    expect(resolved.appearance).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.getPropertyValue('--workbench-active')).toBeTruthy()
  })

  it('applies dark theme tokens onto root', () => {
    const resolved = applyTheme(document.documentElement, SITE_DARK_THEME_ID, 'dark')
    expect(resolved.appearance).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
