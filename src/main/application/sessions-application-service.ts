import type {
  ConnectionRequest,
  PortForwardInput,
  SessionConnectResult,
  SessionResourceSnapshot,
  SessionSummary
} from '@shared/types'
import type { LocalTerminalManager } from '../local-terminal-manager'
import { createLogger, createOperationContext } from '../observability'
import type { SessionManager } from '../session-manager'

export class SessionsApplicationService {
  private readonly logger = createLogger('main')

  constructor(
    private readonly sessionManager: SessionManager,
    private readonly localTerminalManager: LocalTerminalManager
  ) {}

  connect(request: ConnectionRequest): Promise<SessionConnectResult> {
    const context = createOperationContext('main', 'sessions', 'connect', {
      serverId: request.serverId,
      sessionId: request.sessionId
    })
    this.logger.info('Connecting session', { context })
    return this.sessionManager.connect(request)
  }

  disconnect(sessionId: string) {
    const context = createOperationContext('main', 'sessions', 'disconnect', { sessionId })
    this.logger.info('Disconnecting session', { context })
    return this.sessionManager.disconnect(sessionId)
  }

  reconnect(sessionId: string): Promise<SessionSummary> {
    const context = createOperationContext('main', 'sessions', 'reconnect', { sessionId })
    this.logger.info('Reconnecting session', { context })
    return this.sessionManager.reconnect(sessionId)
  }

  getResourceSnapshot(sessionId: string): Promise<SessionResourceSnapshot> {
    return this.sessionManager.getResourceSnapshot(sessionId)
  }

  write(sessionId: string, data: string) {
    return this.sessionManager.write(sessionId, data)
  }

  resize(sessionId: string, columns: number, rows: number) {
    return this.sessionManager.resize(sessionId, columns, rows)
  }

  listDirectory(sessionId: string, remotePath: string) {
    return this.sessionManager.listDirectory(sessionId, remotePath)
  }

  createFile(sessionId: string, remotePath: string, name: string) {
    return this.sessionManager.createFile(sessionId, remotePath, name)
  }

  makeDirectory(sessionId: string, remotePath: string, name: string) {
    return this.sessionManager.makeDirectory(sessionId, remotePath, name)
  }

  rename(sessionId: string, remotePath: string, newName: string) {
    return this.sessionManager.rename(sessionId, remotePath, newName)
  }

  remove(sessionId: string, remotePath: string) {
    return this.sessionManager.remove(sessionId, remotePath)
  }

  uploadFiles(sessionId: string, targetPath: string) {
    return this.sessionManager.uploadFiles(sessionId, targetPath)
  }

  uploadPaths(sessionId: string, targetPath: string, localPaths: string[]) {
    return this.sessionManager.uploadPaths(sessionId, targetPath, localPaths)
  }

  downloadFile(sessionId: string, remotePath: string) {
    return this.sessionManager.downloadFile(sessionId, remotePath)
  }

  listPortForwards(sessionId: string) {
    return this.sessionManager.listPortForwards(sessionId)
  }

  createPortForward(sessionId: string, input: PortForwardInput) {
    return this.sessionManager.createPortForward(sessionId, input)
  }

  startPortForward(sessionId: string, ruleId: string) {
    return this.sessionManager.startPortForward(sessionId, ruleId)
  }

  stopPortForward(sessionId: string, ruleId: string) {
    return this.sessionManager.stopPortForward(sessionId, ruleId)
  }

  removePortForward(sessionId: string, ruleId: string) {
    return this.sessionManager.removePortForward(sessionId, ruleId)
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
}

