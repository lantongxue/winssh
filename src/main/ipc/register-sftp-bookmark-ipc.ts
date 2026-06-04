import { ipcMain } from 'electron'
import type { DatabaseService } from '../database'
import { createLogger } from '../observability'

export function registerSftpBookmarkIpc(database: DatabaseService) {
  const logger = createLogger('main')
  logger.info('Registering SFTP bookmark IPC handlers', {
    data: { scope: 'sftpBookmarks' }
  })

  ipcMain.handle('sftpBookmarks:list', (_event, serverId: string) => {
    return database.listSftpBookmarks(serverId)
  })

  ipcMain.handle('sftpBookmarks:add', (_event, serverId: string, path: string) => {
    return database.createSftpBookmark(serverId, path)
  })

  ipcMain.handle('sftpBookmarks:delete', (_event, id: string) => {
    return database.deleteSftpBookmark(id)
  })

  ipcMain.handle('sftpBookmarks:deleteByPath', (_event, serverId: string, path: string) => {
    return database.deleteSftpBookmarkByPath(serverId, path)
  })
}
