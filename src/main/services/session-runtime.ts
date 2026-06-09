import type {
  ConnectionRequest,
  HostTrustResult,
  PortForwardInput,
  PortForwardRule,
  SessionConnectResult,
  SessionResourceSnapshot,
  SessionSummary,
  SftpFileReadStreamStart,
  SftpFileWriteStreamStart,
  SftpListResult
} from '@shared/types'

export interface SessionRuntime {
  connect(request: ConnectionRequest): Promise<SessionConnectResult>
  disconnect(sessionId: string): Promise<void>
  reconnect(sessionId: string): Promise<SessionSummary>
  getResourceSnapshot(sessionId: string): Promise<SessionResourceSnapshot>
  write(sessionId: string, data: string): void
  resize(sessionId: string, columns: number, rows: number): Promise<void>
  listDirectory(sessionId: string, remotePath: string): Promise<SftpListResult>
  createFile(sessionId: string, remotePath: string, name: string): Promise<void>
  openFileReadStream(sessionId: string, remotePath: string): Promise<SftpFileReadStreamStart>
  startFileReadStream(streamId: string): void
  openFileWriteStream(
    sessionId: string,
    remotePath: string,
    encoding: string
  ): Promise<SftpFileWriteStreamStart>
  writeFileChunk(streamId: string, chunk: string): Promise<void>
  closeFileWriteStream(streamId: string): Promise<void>
  cancelFileStream(streamId: string): void
  makeDirectory(sessionId: string, remotePath: string, name: string): Promise<void>
  rename(sessionId: string, remotePath: string, newName: string): Promise<void>
  move(sessionId: string, sourcePath: string, destinationDirPath: string): Promise<void>
  remove(sessionId: string, remotePath: string): Promise<void>
  uploadFiles(sessionId: string, targetPath: string): Promise<void>
  uploadPaths(sessionId: string, targetPath: string, localPaths: string[]): Promise<void>
  downloadFile(sessionId: string, remotePath: string): Promise<void>
  cancelTransfer(batchId: string): void
  cancelAllTransfers(): void
  listPortForwards(sessionId: string): PortForwardRule[]
  createPortForward(sessionId: string, input: PortForwardInput): Promise<PortForwardRule>
  startPortForward(sessionId: string, ruleId: string): Promise<PortForwardRule>
  stopPortForward(sessionId: string, ruleId: string): Promise<PortForwardRule>
  removePortForward(sessionId: string, ruleId: string): Promise<void>
  resolveHostTrust(result: HostTrustResult): void
  dispose(): void
}
