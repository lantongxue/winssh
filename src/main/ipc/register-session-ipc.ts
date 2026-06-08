import { ipcMain, type MessagePortMain } from 'electron'
import type { ConnectionRequest, PortForwardInput } from '@shared/types'
import { connectionRequestSchema, portForwardSchema } from '@shared/validation'
import type { SessionsApplicationService } from '../application/sessions-application-service'
import { createLogger } from '../observability'
import type { SshDataAggregator } from '../services/ssh-data-aggregator'

function parseInput<T>(parser: { parse: (value: unknown) => T }, value: unknown): T {
  return parser.parse(value)
}

export function registerSessionIpc(
  service: SessionsApplicationService,
  dataAggregator?: Pick<SshDataAggregator, 'registerSessionPort'>
) {
  const logger = createLogger('main')
  logger.info('Registering session IPC handlers', {
    data: { scope: 'sessions' }
  })

  ipcMain.handle('sessions:connect', (_event, request: ConnectionRequest) =>
    service.connect(parseInput(connectionRequestSchema, request))
  )
  ipcMain.handle('sessions:disconnect', (_event, sessionId: string) =>
    service.disconnect(sessionId)
  )
  ipcMain.handle('sessions:reconnect', (_event, sessionId: string) => service.reconnect(sessionId))
  ipcMain.handle('sessions:getResourceSnapshot', (_event, sessionId: string) =>
    service.getResourceSnapshot(sessionId)
  )
  ipcMain.on('sessions:write', (_event, sessionId: string, data: string) => {
    try {
      service.write(sessionId, data)
    } catch (error) {
      logger.warn('Failed to write session input', {
        data: { sessionId, error }
      })
    }
  })
  ipcMain.handle('sessions:resize', (_event, sessionId: string, columns: number, rows: number) =>
    service.resize(sessionId, columns, rows)
  )
  ipcMain.on('sessions:registerDataPort', (event, payload: { sessionId?: string }) => {
    const port = event.ports[0] as MessagePortMain | undefined
    const sessionId = payload?.sessionId
    if (!port || !sessionId || !dataAggregator) {
      port?.close()
      return
    }

    port.start()
    dataAggregator.registerSessionPort(sessionId, {
      postMessage: (message, transferList) => {
        port.postMessage(message, transferList as never)
      },
      close: () => port.close()
    })
  })

  ipcMain.handle('localTerminals:create', () => service.createLocalTerminal())
  ipcMain.handle('localTerminals:close', (_event, terminalId: string) =>
    service.closeLocalTerminal(terminalId)
  )
  ipcMain.on('localTerminals:write', (_event, terminalId: string, data: string) => {
    service.writeLocalTerminal(terminalId, data)
  })
  ipcMain.handle(
    'localTerminals:resize',
    (_event, terminalId: string, columns: number, rows: number) =>
      service.resizeLocalTerminal(terminalId, columns, rows)
  )

  ipcMain.handle('sftp:list', (_event, sessionId: string, remotePath: string) =>
    service.listDirectory(sessionId, remotePath)
  )
  ipcMain.handle('sftp:refresh', (_event, sessionId: string, remotePath: string) =>
    service.listDirectory(sessionId, remotePath)
  )
  ipcMain.handle('sftp:createFile', (_event, sessionId: string, remotePath: string, name: string) =>
    service.createFile(sessionId, remotePath, name)
  )
  ipcMain.handle('sftp:readFile', (_event, sessionId: string, remotePath: string) =>
    service.readFile(sessionId, remotePath)
  )
  ipcMain.on('sftp:cancelReadFile', (_event, sessionId: string, remotePath: string) =>
    service.cancelReadFile(sessionId, remotePath)
  )
  ipcMain.handle(
    'sftp:writeFile',
    (_event, sessionId: string, remotePath: string, contents: string, encoding?: string) =>
      service.writeFile(sessionId, remotePath, contents, encoding)
  )
  ipcMain.handle('sftp:mkdir', (_event, sessionId: string, remotePath: string, name: string) =>
    service.makeDirectory(sessionId, remotePath, name)
  )
  ipcMain.handle('sftp:rename', (_event, sessionId: string, remotePath: string, newName: string) =>
    service.rename(sessionId, remotePath, newName)
  )
  ipcMain.handle(
    'sftp:move',
    (_event, sessionId: string, sourcePath: string, destinationDirPath: string) =>
      service.move(sessionId, sourcePath, destinationDirPath)
  )
  ipcMain.handle('sftp:remove', (_event, sessionId: string, remotePath: string) =>
    service.remove(sessionId, remotePath)
  )
  ipcMain.handle('sftp:uploadFiles', (_event, sessionId: string, targetPath: string) =>
    service.uploadFiles(sessionId, targetPath)
  )
  ipcMain.handle(
    'sftp:uploadPaths',
    (_event, sessionId: string, targetPath: string, localPaths: string[]) =>
      service.uploadPaths(sessionId, targetPath, localPaths)
  )
  ipcMain.handle('sftp:downloadFile', (_event, sessionId: string, remotePath: string) =>
    service.downloadFile(sessionId, remotePath)
  )
  ipcMain.handle('sftp:cancelTransfer', (_event, batchId: string) =>
    service.cancelTransfer(batchId)
  )
  ipcMain.handle('sftp:cancelAllTransfers', () => service.cancelAllTransfers())

  ipcMain.handle('portForwards:list', (_event, sessionId: string) =>
    service.listPortForwards(sessionId)
  )
  ipcMain.handle('portForwards:create', (_event, sessionId: string, input: PortForwardInput) =>
    service.createPortForward(sessionId, parseInput(portForwardSchema, input))
  )
  ipcMain.handle('portForwards:start', (_event, sessionId: string, ruleId: string) =>
    service.startPortForward(sessionId, ruleId)
  )
  ipcMain.handle('portForwards:stop', (_event, sessionId: string, ruleId: string) =>
    service.stopPortForward(sessionId, ruleId)
  )
  ipcMain.handle('portForwards:remove', (_event, sessionId: string, ruleId: string) =>
    service.removePortForward(sessionId, ruleId)
  )
}
