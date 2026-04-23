import {
  Menu,
  type BrowserWindow,
  type MenuItemConstructorOptions
} from 'electron'
import type { SystemMenuAction } from '@shared/types'
import type { MainTranslator } from './localization'
import type { UpdateService } from './update-service'

type CreateMacApplicationMenuTemplateOptions = {
  appName: string
  isDevelopment: boolean
  onCheckForUpdates: () => void
  onMenuAction: (action: SystemMenuAction) => void
  translate: MainTranslator
}

export function createMacApplicationMenuTemplate(
  options: CreateMacApplicationMenuTemplateOptions
): MenuItemConstructorOptions[] {
  const { appName, isDevelopment, onCheckForUpdates, onMenuAction, translate } = options
  const viewSubmenu: MenuItemConstructorOptions[] = [
    {
      accelerator: 'Command+P',
      click: () => onMenuAction('openCommandPalette'),
      label: translate('menu.view.commandPalette')
    },
    { type: 'separator' },
    {
      accelerator: 'Command+B',
      click: () => onMenuAction('toggleSidebar'),
      label: translate('menu.view.toggleSidebar')
    },
    {
      accelerator: 'Command+J',
      click: () => onMenuAction('togglePanel'),
      label: translate('menu.view.togglePanel')
    },
    ...(isDevelopment
      ? ([
          { type: 'separator' },
          {
            label: translate('menu.view.reload'),
            role: 'reload'
          },
          {
            label: translate('menu.view.forceReload'),
            role: 'forceReload'
          },
          {
            label: translate('menu.view.toggleDeveloperTools'),
            role: 'toggleDevTools'
          }
        ] satisfies MenuItemConstructorOptions[])
      : []),
    { type: 'separator' },
    {
      label: translate('menu.view.actualSize'),
      role: 'resetZoom'
    },
    {
      label: translate('menu.view.zoomIn'),
      role: 'zoomIn'
    },
    {
      label: translate('menu.view.zoomOut'),
      role: 'zoomOut'
    },
    { type: 'separator' },
    {
      label: translate('menu.view.toggleFullScreen'),
      role: 'togglefullscreen'
    }
  ]

  return [
    {
      label: appName,
      submenu: [
        {
          label: translate('menu.app.about', { appName }),
          role: 'about'
        },
        { type: 'separator' },
        {
          accelerator: 'Command+,',
          click: () => onMenuAction('openSettings'),
          label: translate('menu.app.settings')
        },
        { type: 'separator' },
        {
          label: translate('menu.app.services'),
          role: 'services',
          submenu: []
        },
        { type: 'separator' },
        {
          label: translate('menu.app.hide', { appName }),
          role: 'hide'
        },
        {
          label: translate('menu.app.hideOthers'),
          role: 'hideOthers'
        },
        {
          label: translate('menu.app.showAll'),
          role: 'unhide'
        },
        { type: 'separator' },
        {
          label: translate('menu.app.quit', { appName }),
          role: 'quit'
        }
      ]
    },
    {
      label: translate('menu.file.title'),
      submenu: [
        {
          accelerator: 'Command+N',
          click: () => onMenuAction('openNewConnection'),
          label: translate('menu.file.newConnection')
        },
        {
          accelerator: 'Command+Shift+N',
          click: () => onMenuAction('openLocalTerminal'),
          label: translate('menu.file.openLocalTerminal')
        },
        { type: 'separator' },
        {
          accelerator: 'Command+Shift+P',
          click: () => onMenuAction('openQuickOpen'),
          label: translate('menu.file.quickConnect')
        },
        { type: 'separator' },
        {
          accelerator: 'Command+S',
          click: () => onMenuAction('saveActiveDocument'),
          label: translate('menu.file.save')
        },
        {
          accelerator: 'Command+W',
          click: () => onMenuAction('closeActiveDocument'),
          label: translate('menu.file.closeTab')
        }
      ]
    },
    {
      label: translate('menu.edit.title'),
      submenu: [
        {
          label: translate('menu.edit.undo'),
          role: 'undo'
        },
        {
          label: translate('menu.edit.redo'),
          role: 'redo'
        },
        { type: 'separator' },
        {
          label: translate('menu.edit.cut'),
          role: 'cut'
        },
        {
          label: translate('menu.edit.copy'),
          role: 'copy'
        },
        {
          label: translate('menu.edit.paste'),
          role: 'paste'
        },
        { type: 'separator' },
        {
          label: translate('menu.edit.selectAll'),
          role: 'selectAll'
        }
      ]
    },
    {
      label: translate('menu.view.title'),
      submenu: viewSubmenu
    },
    {
      label: translate('menu.window.title'),
      submenu: [
        {
          label: translate('menu.window.minimize'),
          role: 'minimize'
        },
        {
          label: translate('menu.window.zoom'),
          role: 'zoom'
        },
        { type: 'separator' },
        {
          label: translate('menu.window.bringAllToFront'),
          role: 'front'
        }
      ]
    },
    {
      label: translate('menu.help.title'),
      submenu: [
        {
          click: onCheckForUpdates,
          label: translate('menu.app.checkForUpdates')
        }
      ]
    }
  ]
}

export function syncApplicationMenu(options: {
  appName: string
  getMainWindow: () => BrowserWindow | null
  isDevelopment: boolean
  platform: NodeJS.Platform
  translate: MainTranslator
  updateService: Pick<UpdateService, 'check'>
}) {
  if (options.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }

  const emitMenuAction = (action: SystemMenuAction) => {
    options.getMainWindow()?.webContents.send('system:menuAction', action)
  }

  const menu = Menu.buildFromTemplate(
    createMacApplicationMenuTemplate({
      appName: options.appName,
      isDevelopment: options.isDevelopment,
      onCheckForUpdates: () => {
        emitMenuAction('openUpdates')
        void options.updateService.check()
      },
      onMenuAction: emitMenuAction,
      translate: options.translate
    })
  )

  Menu.setApplicationMenu(menu)
}
