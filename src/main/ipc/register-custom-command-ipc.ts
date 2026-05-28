import { ipcMain } from 'electron'
import type { CustomCommandInput } from '@shared/types'
import { customCommandSchema, customCommandUpdateSchema } from '@shared/validation'
import type { DatabaseService } from '../database'
import { createLogger } from '../observability'

function parseInput<T>(parser: { parse: (value: unknown) => T }, value: unknown): T {
  return parser.parse(value)
}

export function registerCustomCommandIpc(database: DatabaseService) {
  const logger = createLogger('main')
  logger.info('Registering custom command IPC handlers', {
    data: { scope: 'customCommands' }
  })

  ipcMain.handle('customCommands:list', () => database.listCustomCommands())
  ipcMain.handle('customCommands:create', (_event, input: CustomCommandInput) => {
    const parsed = parseInput(customCommandSchema, input)
    return database.createCustomCommand(parsed)
  })
  ipcMain.handle(
    'customCommands:update',
    (_event, id: string, input: Partial<CustomCommandInput>) => {
      const parsed = parseInput(customCommandUpdateSchema, input)
      return database.updateCustomCommand(id, parsed)
    }
  )
  ipcMain.handle('customCommands:delete', (_event, id: string) => database.deleteCustomCommand(id))
}
