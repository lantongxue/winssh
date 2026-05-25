import { ipcMain } from 'electron'
import type {
  CommandHistoryListInput,
  CommandHistoryScope,
  CommandHistorySearchInput
} from '@shared/types'
import type { DatabaseService } from '../database'
import { createLogger } from '../observability'

export function registerCommandHistoryIpc(database: DatabaseService) {
  const logger = createLogger('main')
  logger.info('Registering command history IPC handlers', {
    data: { scope: 'commandHistory' }
  })

  ipcMain.handle('commandHistory:list', (_event, input: CommandHistoryListInput) =>
    database.listCommands(input)
  )
  ipcMain.handle('commandHistory:search', (_event, input: CommandHistorySearchInput) =>
    database.searchCommands(input)
  )
  ipcMain.handle('commandHistory:clear', (_event, scope: CommandHistoryScope) =>
    database.clearCommands(scope)
  )
  ipcMain.handle('commandHistory:clearAll', () => database.clearAllCommands())
  ipcMain.handle('commandHistory:deleteEntry', (_event, id: string) => database.deleteCommand(id))
  ipcMain.handle('commandHistory:setServerCapture', (_event, serverId: string, enabled: boolean) =>
    database.setServerCaptureCommandHistory(serverId, enabled)
  )
}
