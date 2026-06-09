import type {
  ConnectionRequest,
  HostTrustResult,
  PortForwardInput,
  SessionConnectResult,
  SessionResourceSnapshot,
  SessionSummary
} from '@shared/types'
import type { LocalTerminalManager } from '../local-terminal-manager'
import { createLogger, createOperationContext } from '../observability'
import type { SessionRuntime } from '../services/session-runtime'

export class SessionsApplicationService {
  private readonly logger = createLogger('main')

  constructor(
    private readonly sessionRuntime: SessionRuntime,
    private readonly localTerminalManager: LocalTerminalManager
  ) {}

  connect(request: ConnectionRequest): Promise<SessionConnectResult> {
    const context = createOperationContext('main', 'sessions', 'connect', {
      serverId: request.serverId,
      sessionId: request.sessionId
    })
    this.logger.info('Connecting session', { context })
    return this.sessionRuntime.connect(request)
  }

  disconnect(sessionId: string) {
    const context = createOperationContext('main', 'sessions', 'disconnect', { sessionId })
    this.logger.info('Disconnecting session', { context })
    return this.sessionRuntime.disconnect(sessionId)
  }

  reconnect(sessionId: string): Promise<SessionSummary> {
    const context = createOperationContext('main', 'sessions', 'reconnect', { sessionId })
    this.logger.info('Reconnecting session', { context })
    return this.sessionRuntime.reconnect(sessionId)
  }

  getResourceSnapshot(sessionId: string): Promise<SessionResourceSnapshot> {
    return this.sessionRuntime.getResourceSnapshot(sessionId)
  }

  write(sessionId: string, data: string): void {
    this.sessionRuntime.write(sessionId, data)
  }

  resize(sessionId: string, columns: number, rows: number) {
    return this.sessionRuntime.resize(sessionId, columns, rows)
  }

  listDirectory(sessionId: string, remotePath: string) {
    return this.sessionRuntime.listDirectory(sessionId, remotePath)
  }

  createFile(sessionId: string, remotePath: string, name: string) {
    return this.sessionRuntime.createFile(sessionId, remotePath, name)
  }

  openFileReadStream(sessionId: string, remotePath: string) {
    return this.sessionRuntime.openFileReadStream(sessionId, remotePath)
  }

  startFileReadStream(streamId: string): void {
    this.sessionRuntime.startFileReadStream(streamId)
  }

  openFileWriteStream(sessionId: string, remotePath: string, encoding: string) {
    return this.sessionRuntime.openFileWriteStream(sessionId, remotePath, encoding)
  }

  writeFileChunk(streamId: string, chunk: string) {
    return this.sessionRuntime.writeFileChunk(streamId, chunk)
  }

  closeFileWriteStream(streamId: string) {
    return this.sessionRuntime.closeFileWriteStream(streamId)
  }

  cancelFileStream(streamId: string): void {
    this.sessionRuntime.cancelFileStream(streamId)
  }

  makeDirectory(sessionId: string, remotePath: string, name: string) {
    return this.sessionRuntime.makeDirectory(sessionId, remotePath, name)
  }

  rename(sessionId: string, remotePath: string, newName: string) {
    return this.sessionRuntime.rename(sessionId, remotePath, newName)
  }

  move(sessionId: string, sourcePath: string, destinationDirPath: string) {
    return this.sessionRuntime.move(sessionId, sourcePath, destinationDirPath)
  }

  remove(sessionId: string, remotePath: string) {
    return this.sessionRuntime.remove(sessionId, remotePath)
  }

  uploadFiles(sessionId: string, targetPath: string) {
    return this.sessionRuntime.uploadFiles(sessionId, targetPath)
  }

  uploadPaths(sessionId: string, targetPath: string, localPaths: string[]) {
    return this.sessionRuntime.uploadPaths(sessionId, targetPath, localPaths)
  }

  downloadFile(sessionId: string, remotePath: string) {
    return this.sessionRuntime.downloadFile(sessionId, remotePath)
  }

  cancelTransfer(batchId: string) {
    this.sessionRuntime.cancelTransfer(batchId)
  }

  cancelAllTransfers() {
    this.sessionRuntime.cancelAllTransfers()
  }

  listPortForwards(sessionId: string) {
    return this.sessionRuntime.listPortForwards(sessionId)
  }

  createPortForward(sessionId: string, input: PortForwardInput) {
    return this.sessionRuntime.createPortForward(sessionId, input)
  }

  startPortForward(sessionId: string, ruleId: string) {
    return this.sessionRuntime.startPortForward(sessionId, ruleId)
  }

  stopPortForward(sessionId: string, ruleId: string) {
    return this.sessionRuntime.stopPortForward(sessionId, ruleId)
  }

  removePortForward(sessionId: string, ruleId: string) {
    return this.sessionRuntime.removePortForward(sessionId, ruleId)
  }

  createLocalTerminal() {
    return this.localTerminalManager.create()
  }

  closeLocalTerminal(terminalId: string) {
    return this.localTerminalManager.close(terminalId)
  }

  writeLocalTerminal(terminalId: string, data: string) {
    return this.localTerminalManager.write(terminalId, data)
  }

  resizeLocalTerminal(terminalId: string, columns: number, rows: number) {
    return this.localTerminalManager.resize(terminalId, columns, rows)
  }

  resolveHostTrust(result: HostTrustResult): void {
    this.sessionRuntime.resolveHostTrust(result)
  }
}
