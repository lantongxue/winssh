import { ipcMain } from 'electron'
import type { CredentialUpsertInput, GroupInput, ServerUpsertInput, TagInput } from '@shared/types'
import {
  credentialSchema,
  groupSchema,
  serverSchema,
  tagSchema
} from '@shared/validation'
import type { ServersApplicationService } from '../application/servers-application-service'
import type { DatabaseService } from '../database'
import { createLogger } from '../observability'

function parseInput<T>(parser: { parse: (value: unknown) => T }, value: unknown): T {
  return parser.parse(value)
}

export function registerServerIpc(options: {
  database: DatabaseService
  serversService: ServersApplicationService
}) {
  const logger = createLogger('main')
  const { database, serversService } = options

  logger.info('Registering entity IPC handlers', {
    data: { scope: 'servers' }
  })

  ipcMain.handle('credentials:list', () => database.listCredentials())
  ipcMain.handle('credentials:getSecret', (_event, id: string) => {
    const secret = database.getCredentialSecret(id)
    return secret ?? { password: null, privateKey: null, passphrase: null }
  })
  ipcMain.handle('credentials:create', (_event, input: CredentialUpsertInput) =>
    database.createCredential(parseInput(credentialSchema, input) as CredentialUpsertInput)
  )
  ipcMain.handle('credentials:update', (_event, id: string, input: CredentialUpsertInput) =>
    database.updateCredential(id, parseInput(credentialSchema, input) as CredentialUpsertInput)
  )
  ipcMain.handle('credentials:delete', (_event, id: string) => {
    database.deleteCredential(id)
  })

  ipcMain.handle('groups:list', () => database.listGroups())
  ipcMain.handle('groups:create', (_event, input: GroupInput) =>
    database.createGroup(parseInput(groupSchema, input))
  )
  ipcMain.handle('groups:update', (_event, id: string, input: GroupInput) =>
    database.updateGroup(id, parseInput(groupSchema, input))
  )
  ipcMain.handle('groups:delete', (_event, id: string) => {
    database.deleteGroup(id)
  })

  ipcMain.handle('tags:list', () => database.listTags())
  ipcMain.handle('tags:create', (_event, input: TagInput) =>
    database.createTag(parseInput(tagSchema, input))
  )
  ipcMain.handle('tags:update', (_event, id: string, input: TagInput) =>
    database.updateTag(id, parseInput(tagSchema, input))
  )
  ipcMain.handle('tags:delete', (_event, id: string) => {
    database.deleteTag(id)
  })

  ipcMain.handle('servers:list', () => serversService.listServers())
  ipcMain.handle('servers:getSecrets', (_event, id: string) => serversService.getSecrets(id))
  ipcMain.handle('servers:create', (_event, input: ServerUpsertInput) =>
    serversService.create(parseInput(serverSchema, input))
  )
  ipcMain.handle('servers:update', (_event, id: string, input: ServerUpsertInput) =>
    serversService.update(id, parseInput(serverSchema, { ...input, id }))
  )
  ipcMain.handle('servers:delete', (_event, id: string) => serversService.delete(id))
  ipcMain.handle('servers:toggleFavorite', (_event, id: string) =>
    serversService.toggleFavorite(id)
  )
  ipcMain.handle('servers:listRecent', () => serversService.listRecentSessions())
  ipcMain.handle('servers:clearRecent', () => {
    serversService.clearRecentSessions()
  })
}

