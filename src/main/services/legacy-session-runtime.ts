import type { HostTrustResult, PortForwardInput } from '@shared/types'
import type { SessionManager } from '../session-manager'
import type { SessionRuntime } from './session-runtime'

export class LegacySessionRuntime implements SessionRuntime {
  constructor(private readonly sessionManager: SessionManager) {}

  connect(request: Parameters<SessionRuntime['connect']>[0]) {
    return this.sessionManager.connect(request)
  }

  disconnect(sessionId: string) {
    return this.sessionManager.disconnect(sessionId)
  }

  reconnect(sessionId: string) {
    return this.sessionManager.reconnect(sessionId)
  }

  getResourceSnapshot(sessionId: string) {
    return this.sessionManager.getResourceSnapshot(sessionId)
  }

  write(sessionId: string, data: string): void {
    this.sessionManager.write(sessionId, data)
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

  openFileReadStream(sessionId: string, remotePath: string) {
    return this.sessionManager.openFileReadStream(sessionId, remotePath)
  }

  openFileWriteStream(sessionId: string, remotePath: string, encoding: string) {
    return this.sessionManager.openFileWriteStream(sessionId, remotePath, encoding)
  }

  writeFileChunk(streamId: string, chunk: string) {
    return this.sessionManager.writeFileChunk(streamId, chunk)
  }

  closeFileWriteStream(streamId: string) {
    return this.sessionManager.closeFileWriteStream(streamId)
  }

  cancelFileStream(streamId: string): void {
    this.sessionManager.cancelFileStream(streamId)
  }

  makeDirectory(sessionId: string, remotePath: string, name: string) {
    return this.sessionManager.makeDirectory(sessionId, remotePath, name)
  }

  rename(sessionId: string, remotePath: string, newName: string) {
    return this.sessionManager.rename(sessionId, remotePath, newName)
  }

  move(sessionId: string, sourcePath: string, destinationDirPath: string) {
    return this.sessionManager.move(sessionId, sourcePath, destinationDirPath)
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

  cancelTransfer(batchId: string): void {
    this.sessionManager.cancelTransfer(batchId)
  }

  cancelAllTransfers(): void {
    this.sessionManager.cancelAllTransfers()
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

  resolveHostTrust(result: HostTrustResult): void {
    this.sessionManager.resolveHostTrust(result)
  }

  dispose(): void {
    this.sessionManager.dispose()
  }
}
