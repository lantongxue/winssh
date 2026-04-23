import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createMainTranslator } from './localization'

const { buildFromTemplateMock, setApplicationMenuMock } = vi.hoisted(() => ({
  buildFromTemplateMock: vi.fn((template: MenuItemConstructorOptions[]) => ({ template })),
  setApplicationMenuMock: vi.fn()
}))

vi.mock('electron', () => ({
  Menu: {
    buildFromTemplate: buildFromTemplateMock,
    setApplicationMenu: setApplicationMenuMock
  }
}))

import { createMacApplicationMenuTemplate, syncApplicationMenu } from './app-menu'

describe('app menu', () => {
  beforeEach(() => {
    buildFromTemplateMock.mockClear()
    setApplicationMenuMock.mockClear()
  })

  it('builds a localized macOS menu template', () => {
    const translate = createMainTranslator(() => 'zh-CN')
    const onMenuAction = vi.fn()
    const template = createMacApplicationMenuTemplate({
      appName: 'WinSSH',
      isDevelopment: false,
      onCheckForUpdates: vi.fn(),
      onMenuAction,
      translate
    })

    const fileMenu = template[1]
    const fileSubmenu = fileMenu?.submenu as MenuItemConstructorOptions[]
    const viewMenu = template[3]
    const viewSubmenu = viewMenu?.submenu as MenuItemConstructorOptions[]

    expect(fileMenu?.label).toBe('文件')
    expect(fileSubmenu[0]?.label).toBe('新建连接')
    expect(fileSubmenu[0]?.accelerator).toBe('Command+N')
    expect(viewMenu?.label).toBe('显示')
    expect(viewSubmenu[0]?.label).toBe('命令面板')
    expect(viewSubmenu.some((item) => item.role === 'reload')).toBe(false)
  })

  it('includes development-only view actions when requested', () => {
    const translate = createMainTranslator(() => 'en-US')
    const template = createMacApplicationMenuTemplate({
      appName: 'WinSSH',
      isDevelopment: true,
      onCheckForUpdates: vi.fn(),
      onMenuAction: vi.fn(),
      translate
    })

    const viewSubmenu = template[3]?.submenu as MenuItemConstructorOptions[]

    expect(viewSubmenu.some((item) => item.role === 'reload')).toBe(true)
    expect(viewSubmenu.some((item) => item.role === 'forceReload')).toBe(true)
    expect(viewSubmenu.some((item) => item.role === 'toggleDevTools')).toBe(true)
  })

  it('syncs the macOS menu and routes update checks through the app shell', () => {
    const check = vi.fn(async () => ({
      autoCheckEnabled: true,
      availableUpdate: null,
      currentVersion: '1.0.0',
      downloadProgressPercent: null,
      errorMessage: null,
      phase: 'idle' as const,
      supported: false,
      unsupportedReason: 'platform_not_supported' as const
    }))
    const send = vi.fn()
    const translate = createMainTranslator(() => 'en-US')

    syncApplicationMenu({
      appName: 'WinSSH',
      getMainWindow: () =>
        ({
          webContents: {
            send
          }
        }) as never,
      isDevelopment: false,
      platform: 'darwin',
      translate,
      updateService: { check }
    })

    expect(buildFromTemplateMock).toHaveBeenCalledTimes(1)
    expect(setApplicationMenuMock).toHaveBeenCalledWith({
      template: buildFromTemplateMock.mock.calls[0]?.[0]
    })

    const template = buildFromTemplateMock.mock.calls[0]?.[0] as MenuItemConstructorOptions[]
    const helpSubmenu = template[5]?.submenu as MenuItemConstructorOptions[]
    helpSubmenu[0]?.click?.({} as never, {} as never, {} as never)

    expect(send).toHaveBeenCalledWith('system:menuAction', 'openUpdates')
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('removes the application menu outside macOS', () => {
    syncApplicationMenu({
      appName: 'WinSSH',
      getMainWindow: () => null,
      isDevelopment: false,
      platform: 'linux',
      translate: createMainTranslator(() => 'en-US'),
      updateService: {
        check: vi.fn(async () => ({
          autoCheckEnabled: true,
          availableUpdate: null,
          currentVersion: '1.0.0',
          downloadProgressPercent: null,
          errorMessage: null,
          phase: 'idle' as const,
          supported: false,
          unsupportedReason: 'platform_not_supported' as const
        }))
      }
    })

    expect(setApplicationMenuMock).toHaveBeenCalledWith(null)
    expect(buildFromTemplateMock).not.toHaveBeenCalled()
  })
})
