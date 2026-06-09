import { randomUUID } from 'node:crypto'
import { promises as fs, type Stats as FsStats } from 'node:fs'
import net, { type Server as NetServer, type Socket } from 'node:net'
import path, { basename, posix } from 'node:path'
import {
  Client,
  type ClientChannel,
  type ConnectConfig,
  type SFTPWrapper,
  type Stats,
  type TcpConnectionDetails
} from 'ssh2'
import { dialog, type BrowserWindow, type OpenDialogOptions } from 'electron'
import { normalizeRemotePath, sortRemoteEntries } from '@shared/sftp'
import { runWithConcurrency } from './concurrency-pool'
import { createIncrementalTextDecoder, smartDecode, encodeContent } from './encoding'
import { DEFAULT_SERVER_BRAND_ID, resolveServerBrandFromOsRelease } from '@shared/server-brands'
import {
  type ConnectionSecretInput,
  ConnectionRequest,
  type CommandHistoryEntry,
  type CommandRecordedEvent,
  PortForwardInput,
  PortForwardRule,
  PortForwardStateEvent,
  RemoteEntry,
  type RemoteEntryKind,
  SESSION_RESOURCE_MONITOR_UNAVAILABLE,
  type Server,
  SessionConnectResult,
  type SessionConnectionPhase,
  SessionDataEvent,
  SessionErrorEvent,
  SessionExitEvent,
  SESSION_CONNECTION_PHASES,
  type SessionResourceSnapshot,
  SessionStateEvent,
  SessionSummary,
  SftpFileChunkEvent,
  SftpFileReadStreamStart,
  SftpFileStreamDirection,
  SftpFileStreamStateEvent,
  SftpFileWriteStreamStart,
  TransferProgressEvent,
  type HostTrustResult,
  SessionCwdEvent
} from '@shared/types'
import type { DatabaseService } from './database'
import type { MainTranslator } from './localization'
import { createOscScannerState, scanOscChunk, type OscScannerState } from './osc-scanner'
import {
  ConnectionFailure,
  getSecretKindForServer,
  isAuthenticationFailure
} from './services/ssh-connection-errors'
import {
  SshConnectionResolver,
  type ResolvedConnectionAuth
} from './services/ssh-connection-resolver'
import { HostTrustService } from './services/host-trust-service'
import {
  isShellIntegrationInternal,
  createShellIntegrationScript,
  stripShellIntegrationInstallEcho
} from './shell-integration'
type WindowProvider = () => BrowserWindow | null
type AcceptTcpConnection = () => ClientChannel
type RejectConnection = () => void

type EventMap = {
  'sessions:data': SessionDataEvent
  'sessions:error': SessionErrorEvent
  'sessions:exit': SessionExitEvent
  'sessions:state': SessionStateEvent
  'sftp:fileChunk': SftpFileChunkEvent
  'sftp:fileStreamState': SftpFileStreamStateEvent
  'sftp:transfer': TransferProgressEvent
  'portForwards:state': PortForwardStateEvent
  'commandHistory:added': CommandRecordedEvent
  'sessions:cwdChanged': SessionCwdEvent
}

interface BasePortForwardRuntime {
  ruleId: string
  sockets: Set<Socket>
  channels: Set<ClientChannel>
}

interface LocalPortForwardRuntime extends BasePortForwardRuntime {
  kind: 'local'
  server: NetServer
}

interface RemotePortForwardRuntime extends BasePortForwardRuntime {
  kind: 'remote'
}

type ActivePortForward = LocalPortForwardRuntime | RemotePortForwardRuntime

interface PendingCommand {
  text: string | null
  startedAt: number | null
  cwd: string | null
}

interface SessionRuntime {
  sessionId: string
  client: Client
  upstreamClients: Client[]
  shell: ClientChannel
  sftp: SFTPWrapper
  summary: SessionSummary
  portForwards: Map<string, ActivePortForward>
  lastError?: string
  lastExit?: SessionExitEvent
  finalizing?: boolean
  oscState: OscScannerState
  pendingCommand: PendingCommand
  historyCaptureEnabled: boolean
  historyCaptureStatus: 'pending' | 'active' | 'unavailable'
  historyProbeTimer?: NodeJS.Timeout
  integrationBuffer?: string
  integrationTimeoutTimer?: NodeJS.Timeout
  integrationState?: 'none' | 'waiting' | 'delayed' | 'active' | 'failed'
  integrationDelayTimer?: NodeJS.Timeout
}

interface EditorFileReadTask {
  kind: 'read'
  streamId: string
  sessionId: string
  remotePath: string
  fileName: string
  total: number
  transferred: number
  controller: AbortController
  handle?: Buffer
}

interface EditorFileWriteTask {
  kind: 'write'
  streamId: string
  sessionId: string
  remotePath: string
  fileName: string
  encoding: string
  transferred: number
  handle: Buffer
  sftp: SFTPWrapper
}

interface ExecResult {
  stdout: string
  stderr: string
  code: number | null
  signal?: string
}

interface CpuTimesSample {
  idle: number
  total: number
}

interface NetworkBytesSample {
  rxBytes: number
  sampledAt: number
  txBytes: number
}

const RESOURCE_MONITOR_MARKERS = {
  df: '__WINSSH_DF__',
  platform: '__WINSSH_PLATFORM__',
  procMeminfo: '__WINSSH_PROC_MEMINFO__',
  procNetDev: '__WINSSH_PROC_NET_DEV__',
  procStat: '__WINSSH_PROC_STAT__'
} as const

const LINUX_RESOURCE_SNAPSHOT_COMMAND = `LC_ALL=C sh -lc '
set -eu
platform="$(uname -s 2>/dev/null || echo unknown)"
printf "%s\\n%s\\n" "${RESOURCE_MONITOR_MARKERS.platform}" "$platform"
if [ "$platform" != "Linux" ]; then
  exit 0
fi
printf "%s\\n" "${RESOURCE_MONITOR_MARKERS.procStat}"
cat /proc/stat
printf "%s\\n" "${RESOURCE_MONITOR_MARKERS.procMeminfo}"
cat /proc/meminfo
printf "%s\\n" "${RESOURCE_MONITOR_MARKERS.procNetDev}"
cat /proc/net/dev
printf "%s\\n" "${RESOURCE_MONITOR_MARKERS.df}"
df -P -B1 /
'`

function now() {
  return new Date().toISOString()
}

function getPermissionTypePrefix(kind: RemoteEntryKind): string {
  if (kind === 'directory') {
    return 'd'
  }

  if (kind === 'symlink') {
    return 'l'
  }

  return '-'
}

function formatPermissionTriad(
  mode: number,
  readBit: number,
  writeBit: number,
  executeBit: number,
  specialBit: number,
  specialEnabled: string,
  specialDisabled: string
): string {
  const readable = mode & readBit ? 'r' : '-'
  const writable = mode & writeBit ? 'w' : '-'
  const executable = mode & executeBit ? 'x' : '-'

  if (!(mode & specialBit)) {
    return `${readable}${writable}${executable}`
  }

  return `${readable}${writable}${mode & executeBit ? specialEnabled : specialDisabled}`
}

export function formatRemoteEntryPermissions(mode: number, kind: RemoteEntryKind) {
  const octal = (mode & 0o7777).toString(8).padStart(4, '0')
  const symbolic =
    getPermissionTypePrefix(kind) +
    formatPermissionTriad(mode, 0o400, 0o200, 0o100, 0o4000, 's', 'S') +
    formatPermissionTriad(mode, 0o040, 0o020, 0o010, 0o2000, 's', 'S') +
    formatPermissionTriad(mode, 0o004, 0o002, 0o001, 0o1000, 't', 'T')

  return {
    octal,
    symbolic
  }
}

function sftpRealpath(sftp: SFTPWrapper, remotePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sftp.realpath(remotePath, (error, absolutePath) => {
      if (error) {
        reject(error)
        return
      }

      resolve(absolutePath)
    })
  })
}

function sftpOpen(sftp: SFTPWrapper, remotePath: string, flags: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    sftp.open(remotePath, flags as never, (error, handle) => {
      if (error) {
        reject(error)
        return
      }

      resolve(handle)
    })
  })
}

function sftpClose(sftp: SFTPWrapper, handle: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.close(handle, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function sftpRead(
  sftp: SFTPWrapper,
  handle: Buffer,
  buffer: Buffer,
  offset: number,
  length: number,
  position: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    sftp.read(handle, buffer, offset, length, position, (error, bytesRead) => {
      if (error) {
        reject(error)
        return
      }

      resolve(bytesRead)
    })
  })
}

function sftpWrite(
  sftp: SFTPWrapper,
  handle: Buffer,
  buffer: Buffer,
  offset: number,
  length: number,
  position: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.write(handle, buffer, offset, length, position, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

type SftpReadFileProgressCallback = (transferred: number, total: number) => void

class SftpReadCancelledError extends Error {
  constructor() {
    super('SFTP read cancelled')
    this.name = 'SftpReadCancelledError'
  }
}

async function sftpReadFile(
  sftp: SFTPWrapper,
  remotePath: string,
  onProgress?: SftpReadFileProgressCallback,
  totalSize?: number,
  signal?: AbortSignal
): Promise<{ content: string; encoding: string }> {
  const handle = await sftpOpen(sftp, remotePath, 'r')
  const chunks: Buffer[] = []
  let position = 0

  try {
    while (true) {
      if (signal?.aborted) {
        throw new SftpReadCancelledError()
      }

      const chunk = Buffer.allocUnsafe(32768)
      const bytesRead = await sftpRead(sftp, handle, chunk, 0, chunk.byteLength, position)
      if (bytesRead <= 0) {
        break
      }

      chunks.push(chunk.subarray(0, bytesRead))
      position += bytesRead

      if (onProgress && totalSize !== undefined) {
        onProgress(position, totalSize)
      }

      if (bytesRead < chunk.byteLength) {
        break
      }
    }

    if (onProgress && totalSize !== undefined) {
      onProgress(totalSize, totalSize)
    }

    return smartDecode(Buffer.concat(chunks))
  } finally {
    await sftpClose(sftp, handle).catch(() => undefined)
  }
}

function sftpReadDir(sftp: SFTPWrapper, remotePath: string): Promise<RemoteEntry[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(remotePath, (error, entries) => {
      if (error) {
        reject(error)
        return
      }

      const mapped = (entries ?? []).map((entry) => {
        const fullPath = normalizeRemotePath(posix.join(remotePath, entry.filename))
        const attrs = entry.attrs
        const kind = attrs.isDirectory() ? 'directory' : attrs.isSymbolicLink() ? 'symlink' : 'file'

        return {
          name: entry.filename,
          path: fullPath,
          kind,
          size: attrs.size ?? 0,
          modifiedAt: attrs.mtime ? new Date(attrs.mtime * 1000).toISOString() : null,
          permissions:
            typeof attrs.mode === 'number' ? formatRemoteEntryPermissions(attrs.mode, kind) : null
        } as RemoteEntry
      })

      resolve(sortRemoteEntries(mapped))
    })
  })
}

function sftpMkdir(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.mkdir(remotePath, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function sftpCreateFile(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.open(remotePath, 'w', (error, handle) => {
      if (error) {
        reject(error)
        return
      }

      sftp.close(handle, (closeError) => {
        if (closeError) {
          reject(closeError)
          return
        }

        resolve()
      })
    })
  })
}

function sftpRename(sftp: SFTPWrapper, fromPath: string, toPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rename(fromPath, toPath, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function sftpStat(sftp: SFTPWrapper, remotePath: string): Promise<Stats> {
  return new Promise((resolve, reject) => {
    sftp.stat(remotePath, (error, stats) => {
      if (error) {
        reject(error)
        return
      }

      resolve(stats)
    })
  })
}

function sftpLstat(sftp: SFTPWrapper, remotePath: string): Promise<Stats> {
  return new Promise((resolve, reject) => {
    sftp.lstat(remotePath, (error, stats) => {
      if (error) {
        reject(error)
        return
      }

      resolve(stats)
    })
  })
}

function sftpUnlink(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.unlink(remotePath, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function sftpRmdir(sftp: SFTPWrapper, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.rmdir(remotePath, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function openShell(client: Client): Promise<ClientChannel> {
  return new Promise((resolve, reject) => {
    client.shell({ term: 'xterm-256color', rows: 30, cols: 120 }, (error, stream) => {
      if (error) {
        reject(error)
        return
      }

      resolve(stream)
    })
  })
}

function openSftp(client: Client): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) {
        reject(error)
        return
      }

      resolve(sftp)
    })
  })
}

function appendChunk(chunks: Buffer[], chunk: Buffer | string): void {
  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
}

function execCommand(client: Client, command: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    client.exec(command, (error, channel) => {
      if (error) {
        reject(error)
        return
      }

      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      let settled = false

      const finish = (code?: number, signal?: string) => {
        if (settled) {
          return
        }

        settled = true
        resolve({
          code: typeof code === 'number' ? code : null,
          signal,
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          stdout: Buffer.concat(stdoutChunks).toString('utf8')
        })
      }

      channel.on('data', (chunk: Buffer | string) => appendChunk(stdoutChunks, chunk))
      channel.stderr.on('data', (chunk: Buffer | string) => appendChunk(stderrChunks, chunk))
      channel.once('error', (channelError) => {
        if (settled) {
          return
        }

        settled = true
        reject(channelError)
      })
      channel.once('close', finish)
    })
  })
}

function parseSectionedOutput(stdout: string): Map<string, string> {
  const markers = new Set(Object.values(RESOURCE_MONITOR_MARKERS))
  const sections = new Map<string, string[]>()
  let currentMarker: string | null = null

  for (const line of stdout.split(/\r?\n/)) {
    const candidate = line.trim()
    if (
      markers.has(
        candidate as (typeof RESOURCE_MONITOR_MARKERS)[keyof typeof RESOURCE_MONITOR_MARKERS]
      )
    ) {
      currentMarker = candidate
      sections.set(candidate, [])
      continue
    }

    if (!currentMarker) {
      continue
    }

    sections.get(currentMarker)?.push(line)
  }

  return new Map(
    [...sections.entries()].map(([marker, lines]) => [marker, lines.join('\n').trim()])
  )
}

function parseCpuTimes(section: string): CpuTimesSample {
  const line = section
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('cpu '))

  if (!line) {
    throw new Error(SESSION_RESOURCE_MONITOR_UNAVAILABLE)
  }

  const counters = line
    .split(/\s+/)
    .slice(1)
    .map((value) => Number.parseInt(value, 10))

  if (counters.length < 4 || counters.some((value) => !Number.isFinite(value))) {
    throw new Error(SESSION_RESOURCE_MONITOR_UNAVAILABLE)
  }

  return {
    idle: counters[3] + (counters[4] ?? 0),
    total: counters.reduce((sum, value) => sum + value, 0)
  }
}

function parseMemInfo(section: string) {
  const values = new Map<string, number>()

  for (const line of section.split(/\r?\n/)) {
    const match = /^([A-Za-z_()]+):\s+(\d+)\s+kB$/i.exec(line.trim())
    if (!match) {
      continue
    }

    values.set(match[1], Number.parseInt(match[2], 10) * 1024)
  }

  const totalBytes = values.get('MemTotal')
  const availableBytes = values.get('MemAvailable')

  if (
    totalBytes === undefined ||
    availableBytes === undefined ||
    !Number.isFinite(totalBytes) ||
    !Number.isFinite(availableBytes) ||
    totalBytes <= 0 ||
    availableBytes < 0
  ) {
    throw new Error(SESSION_RESOURCE_MONITOR_UNAVAILABLE)
  }

  const usedBytes = Math.max(0, totalBytes - availableBytes)
  return {
    totalBytes,
    usedBytes,
    usagePercent: Number(((usedBytes / totalBytes) * 100).toFixed(1))
  }
}

function parseNetworkBytes(section: string): Omit<NetworkBytesSample, 'sampledAt'> {
  let rxBytes = 0
  let txBytes = 0

  for (const line of section.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.includes(':')) {
      continue
    }

    const [interfaceNameRaw, countersRaw] = trimmed.split(':', 2)
    const interfaceName = interfaceNameRaw.trim()
    if (!interfaceName || interfaceName === 'lo') {
      continue
    }

    const counters = countersRaw
      .trim()
      .split(/\s+/)
      .map((value) => Number.parseInt(value, 10))

    if (counters.length < 16 || counters.some((value) => !Number.isFinite(value))) {
      continue
    }

    rxBytes += counters[0]
    txBytes += counters[8]
  }

  if (!Number.isFinite(rxBytes) || !Number.isFinite(txBytes)) {
    throw new Error(SESSION_RESOURCE_MONITOR_UNAVAILABLE)
  }

  return {
    rxBytes,
    txBytes
  }
}

function parseDiskUsage(section: string) {
  const lines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    throw new Error(SESSION_RESOURCE_MONITOR_UNAVAILABLE)
  }

  const fields = lines[1].split(/\s+/)
  const totalBytes = Number.parseInt(fields[1] ?? '', 10)
  const usedBytes = Number.parseInt(fields[2] ?? '', 10)
  const usagePercent = Number.parseInt((fields[4] ?? '').replace('%', ''), 10)
  const mountPath = fields.at(-1)

  if (
    !Number.isFinite(totalBytes) ||
    !Number.isFinite(usedBytes) ||
    !Number.isFinite(usagePercent) ||
    totalBytes <= 0 ||
    usedBytes < 0 ||
    mountPath !== '/'
  ) {
    throw new Error(SESSION_RESOURCE_MONITOR_UNAVAILABLE)
  }

  return {
    mountPath: '/' as const,
    totalBytes,
    usedBytes,
    usagePercent
  }
}

function connectForwardOut(
  client: Client,
  srcIP: string,
  srcPort: number,
  dstIP: string,
  dstPort: number
): Promise<ClientChannel> {
  return new Promise((resolve, reject) => {
    client.forwardOut(srcIP, srcPort, dstIP, dstPort, (error, stream) => {
      if (error) {
        reject(error)
        return
      }

      resolve(stream)
    })
  })
}

function startForwardIn(client: Client, bindHost: string, bindPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    client.forwardIn(bindHost, bindPort, (error, assignedPort) => {
      if (error) {
        reject(error)
        return
      }

      resolve(assignedPort ?? bindPort)
    })
  })
}

function stopForwardIn(client: Client, bindHost: string, bindPort: number): Promise<void> {
  return new Promise((resolve, reject) => {
    client.unforwardIn(bindHost, bindPort, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}

function listenOnServer(server: NetServer, host: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const handleError = (error: Error) => {
      server.off('listening', handleListening)
      reject(error)
    }
    const handleListening = () => {
      server.off('error', handleError)
      resolve()
    }

    server.once('error', handleError)
    server.once('listening', handleListening)
    server.listen({ host, port })
  })
}

function closeServer(server: NetServer): Promise<void> {
  return new Promise((resolve) => {
    if (!server.listening) {
      resolve()
      return
    }

    server.close(() => resolve())
  })
}

function clonePortForwardRule(rule: PortForwardRule): PortForwardRule {
  return { ...rule }
}

function isWildcardBindHost(host: string): boolean {
  return host === '0.0.0.0' || host === '::'
}

export class SessionManager {
  private readonly sessions = new Map<string, SessionRuntime>()
  private readonly history = new Map<string, ConnectionRequest>()
  private readonly portForwardSnapshots = new Map<string, PortForwardRule[]>()
  private readonly resourceCpuBaselines = new Map<string, CpuTimesSample>()
  private readonly resourceNetworkBaselines = new Map<string, NetworkBytesSample>()
  private readonly editorFileStreams = new Map<string, EditorFileReadTask | EditorFileWriteTask>()
  private readonly transferControllers = new Map<string, AbortController>()
  private readonly connectionResolver: SshConnectionResolver
  private readonly hostTrustService: HostTrustService

  constructor(
    private readonly database: DatabaseService,
    private readonly getWindow: WindowProvider,
    private readonly emitToRenderer: <T extends keyof EventMap>(
      channel: T,
      payload: EventMap[T]
    ) => void,
    private readonly t: MainTranslator
  ) {
    this.connectionResolver = new SshConnectionResolver(database, t)
    this.hostTrustService = new HostTrustService({ database, getWindow })
  }

  async connect(request: ConnectionRequest): Promise<SessionConnectResult> {
    try {
      const summary = await this.establishConnection(request)
      return { ok: true, summary }
    } catch (error) {
      const failure = this.normalizeConnectionFailure(error)
      return {
        ok: false,
        code: failure.code,
        message: failure.message,
        serverId: failure.serverId,
        secretKind: failure.secretKind
      }
    }
  }

  async reconnect(sessionId: string): Promise<SessionSummary> {
    const request = this.history.get(sessionId)
    if (!request) {
      throw new Error(this.t('errors.reconnectUnavailable'))
    }

    const runtime = this.sessions.get(sessionId)
    if (runtime && !runtime.finalizing) {
      runtime.finalizing = true
      try {
        await this.releaseSessionPortForwards(sessionId)
      } finally {
        this.releaseRuntimeClients(runtime)
        this.sessions.delete(sessionId)
        this.resourceCpuBaselines.delete(sessionId)
        this.resourceNetworkBaselines.delete(sessionId)
      }
    }

    const result = await this.connect({ ...request, sessionId })
    if (!result.ok) {
      throw new Error(result.message)
    }

    if (result.summary.sessionId !== sessionId) {
      this.history.delete(sessionId)
      this.migratePortForwardSnapshots(sessionId, result.summary.sessionId)
    }

    await this.restoreEnabledPortForwards(result.summary.sessionId)
    return result.summary
  }

  async getResourceSnapshot(sessionId: string): Promise<SessionResourceSnapshot> {
    const runtime = this.requireSession(sessionId)
    if (runtime.finalizing || runtime.summary.status !== 'ready') {
      throw new Error(SESSION_RESOURCE_MONITOR_UNAVAILABLE)
    }

    // Phase 1: Latency measurement (cross-platform)
    const latencyStart = Date.now()
    try {
      const latencyResult = await execCommand(
        runtime.client,
        'printf \'%s\\n\' "$(uname -s 2>/dev/null || echo unknown)"'
      )
      const rttMs = Date.now() - latencyStart
      const platformName = latencyResult.stdout.trim()

      const platform: SessionResourceSnapshot['platform'] =
        platformName === 'Linux'
          ? 'linux'
          : platformName === 'Darwin'
            ? 'darwin'
            : platformName === 'Windows' || platformName.startsWith('Windows')
              ? 'windows'
              : 'unknown'

      const sampledAt = now()
      const sampledAtMs = Date.parse(sampledAt)

      // Phase 2: Resource sampling (Linux-only)
      if (platform === 'linux' && (latencyResult.code ?? 0) === 0) {
        try {
          const resourceResult = await execCommand(runtime.client, LINUX_RESOURCE_SNAPSHOT_COMMAND)
          if ((resourceResult.code ?? 0) !== 0) {
            // Resource command failed but latency worked - return partial
            return {
              sessionId,
              sampledAt,
              platform,
              latency: { rttMs },
              cpu: null,
              memory: null,
              network: null,
              disk: null
            }
          }

          const sections = parseSectionedOutput(resourceResult.stdout)
          const cpuTimes = parseCpuTimes(sections.get(RESOURCE_MONITOR_MARKERS.procStat) ?? '')
          const memory = parseMemInfo(sections.get(RESOURCE_MONITOR_MARKERS.procMeminfo) ?? '')
          const networkBytes = parseNetworkBytes(
            sections.get(RESOURCE_MONITOR_MARKERS.procNetDev) ?? ''
          )
          const disk = parseDiskUsage(sections.get(RESOURCE_MONITOR_MARKERS.df) ?? '')

          const previousCpuTimes = this.resourceCpuBaselines.get(sessionId)
          this.resourceCpuBaselines.set(sessionId, cpuTimes)
          const previousNetworkBytes = this.resourceNetworkBaselines.get(sessionId)
          this.resourceNetworkBaselines.set(sessionId, { ...networkBytes, sampledAt: sampledAtMs })

          let cpuUsagePercent: number | null = null
          if (previousCpuTimes) {
            const totalDelta = cpuTimes.total - previousCpuTimes.total
            const idleDelta = cpuTimes.idle - previousCpuTimes.idle
            if (totalDelta > 0) {
              cpuUsagePercent = Number((((totalDelta - idleDelta) / totalDelta) * 100).toFixed(1))
            }
          }

          let rxBytesPerSecond: number | null = null
          let txBytesPerSecond: number | null = null
          if (previousNetworkBytes && sampledAtMs > previousNetworkBytes.sampledAt) {
            const elapsedSeconds = (sampledAtMs - previousNetworkBytes.sampledAt) / 1000
            rxBytesPerSecond = Math.max(
              0,
              Math.round((networkBytes.rxBytes - previousNetworkBytes.rxBytes) / elapsedSeconds)
            )
            txBytesPerSecond = Math.max(
              0,
              Math.round((networkBytes.txBytes - previousNetworkBytes.txBytes) / elapsedSeconds)
            )
          }

          return {
            sessionId,
            sampledAt,
            platform: 'linux',
            latency: { rttMs },
            cpu: { usagePercent: cpuUsagePercent },
            memory,
            network: { rxBytesPerSecond, txBytesPerSecond },
            disk
          }
        } catch {
          // Resource sampling failed on Linux - return partial
          return {
            sessionId,
            sampledAt,
            platform,
            latency: { rttMs },
            cpu: null,
            memory: null,
            network: null,
            disk: null
          }
        }
      }

      // Non-Linux platform - return partial (latency only)
      return {
        sessionId,
        sampledAt,
        platform,
        latency: { rttMs },
        cpu: null,
        memory: null,
        network: null,
        disk: null
      }
    } catch (error) {
      // Phase 1 failed - connection is broken
      throw new Error(SESSION_RESOURCE_MONITOR_UNAVAILABLE)
    }
  }

  private async establishConnection(request: ConnectionRequest): Promise<SessionSummary> {
    const server = this.database.getServerById(request.serverId)
    if (!server) {
      throw new ConnectionFailure('connection_failed', this.t('errors.serverNotFound'))
    }

    const sessionId = request.sessionId ?? randomUUID()
    this.resourceCpuBaselines.delete(sessionId)
    this.resourceNetworkBaselines.delete(sessionId)
    const connectedAt = now()
    const baseSummary: SessionSummary = {
      sessionId,
      serverId: server.id,
      serverName: server.name,
      host: server.host,
      port: server.port,
      status: 'connecting',
      connectedAt,
      currentPath: '/'
    }

    this.emitConnectionPhase(sessionId, 'validate')
    const jumpServer = this.connectionResolver.resolveJumpServer(server)
    const upstreamClients: Client[] = []
    let client: Client | null = null

    try {
      this.emitConnectionPhase(sessionId, 'handshake')

      let targetSocket: ClientChannel | undefined

      if (jumpServer) {
        const jumpAuth = await this.connectionResolver.resolveAuth(jumpServer, request)
        const jumpClient = await this.connectToServer(jumpServer, jumpAuth)
        upstreamClients.push(jumpClient)
        targetSocket = await connectForwardOut(jumpClient, '127.0.0.1', 0, server.host, server.port)
      }

      const targetAuth = await this.connectionResolver.resolveAuth(server, request)
      client = await this.connectToServer(server, targetAuth, targetSocket)

      this.emitConnectionPhase(sessionId, 'prepare')
      const [shell, sftp] = await Promise.all([openShell(client), openSftp(client)])
      const currentPath = normalizeRemotePath(await sftpRealpath(sftp, '.').catch(() => '/'))
      await this.detectAndStoreServerBrand(server, sftp, client)
      const summary: SessionSummary = {
        ...baseSummary,
        status: 'ready',
        currentPath
      }

      this.emitConnectionPhase(sessionId, 'attach')

      const commandHistoryEnabled =
        Boolean(server.captureCommandHistory) && this.database.getSettings().commandHistoryEnabled

      const runtime: SessionRuntime = {
        sessionId,
        client,
        upstreamClients,
        shell,
        sftp,
        summary,
        portForwards: new Map(),
        oscState: createOscScannerState(),
        pendingCommand: { text: null, startedAt: null, cwd: null },
        historyCaptureEnabled: commandHistoryEnabled,
        historyCaptureStatus: commandHistoryEnabled ? 'pending' : 'unavailable',
        integrationState: 'waiting'
      }

      shell.on('data', (chunk: Buffer | string) => {
        this.emitSessionData(runtime, chunk.toString())
      })
      shell.stderr.on('data', (chunk: Buffer | string) => {
        this.emitSessionData(runtime, chunk.toString())
      })
      shell.on('close', (code?: number, signal?: string) => {
        if (runtime.historyProbeTimer) {
          clearTimeout(runtime.historyProbeTimer)
          runtime.historyProbeTimer = undefined
        }
        if (runtime.integrationTimeoutTimer) {
          clearTimeout(runtime.integrationTimeoutTimer)
          runtime.integrationTimeoutTimer = undefined
        }
        if (runtime.integrationDelayTimer) {
          clearTimeout(runtime.integrationDelayTimer)
          runtime.integrationDelayTimer = undefined
        }
        runtime.lastExit = this.withObservableMetadata(sessionId, { sessionId, code, signal })
        client?.end()
      })

      client.on('tcp connection', (details, accept, rejectConnection) => {
        this.handleRemoteTcpConnection(sessionId, details, accept, rejectConnection)
      })

      this.bindRuntimeClient(runtime, client, true)
      for (const upstreamClient of upstreamClients) {
        this.bindRuntimeClient(runtime, upstreamClient)
      }

      this.sessions.set(sessionId, runtime)
      this.history.set(sessionId, {
        ...request,
        sessionId
      })
      this.database.recordRecentSession(server.id)
      await this.persistConnectionSecrets([...(jumpServer ? [jumpServer] : []), server], request)
      this.emitSessionState(sessionId, 'ready', undefined, this.t('session.connected'))

      return summary
    } catch (error) {
      client?.end()
      for (const upstreamClient of upstreamClients) {
        upstreamClient.end()
      }
      throw this.normalizeConnectionFailure(error)
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    const runtime = this.sessions.get(sessionId)

    if (runtime) {
      runtime.finalizing = true
      if (runtime.historyProbeTimer) {
        clearTimeout(runtime.historyProbeTimer)
        runtime.historyProbeTimer = undefined
      }
      if (runtime.integrationTimeoutTimer) {
        clearTimeout(runtime.integrationTimeoutTimer)
        runtime.integrationTimeoutTimer = undefined
      }
      if (runtime.integrationDelayTimer) {
        clearTimeout(runtime.integrationDelayTimer)
        runtime.integrationDelayTimer = undefined
      }
      await this.releaseSessionPortForwards(sessionId)
      this.releaseRuntimeClients(runtime)
      this.sessions.delete(sessionId)
    }

    this.resourceCpuBaselines.delete(sessionId)
    this.resourceNetworkBaselines.delete(sessionId)
    this.history.delete(sessionId)
    this.portForwardSnapshots.delete(sessionId)

    this.emitSessionState(sessionId, 'disconnected', undefined, this.t('session.closed'))
  }

  write(sessionId: string, data: string): void {
    const runtime = this.requireSession(sessionId)
    runtime.shell.write(data)
  }

  private emitSessionData(runtime: SessionRuntime, data: string): void {
    if (!data) {
      return
    }

    if (runtime.integrationState === 'waiting') {
      runtime.integrationState = 'delayed'
      this.emitSessionDataToRenderer(runtime, data)
      runtime.integrationDelayTimer = setTimeout(() => {
        runtime.integrationDelayTimer = undefined
        this.installShellIntegration(runtime)
      }, 200)
      return
    }

    if (runtime.integrationState === 'delayed') {
      this.emitSessionDataToRenderer(runtime, data)
      return
    }

    if (runtime.integrationBuffer !== undefined) {
      runtime.integrationBuffer += data
      const stripped = stripShellIntegrationInstallEcho(runtime.integrationBuffer)

      if (stripped.matched) {
        if (runtime.integrationTimeoutTimer) {
          clearTimeout(runtime.integrationTimeoutTimer)
          runtime.integrationTimeoutTimer = undefined
        }

        runtime.integrationBuffer = undefined
        if (stripped.cleaned) {
          this.emitSessionDataToRenderer(runtime, stripped.cleaned)
        }
      }
      return
    }

    this.emitSessionDataToRenderer(runtime, data)
  }

  private emitSessionDataToRenderer(runtime: SessionRuntime, data: string): void {
    const cleaned = scanOscChunk(runtime.oscState, data, {
      onPromptStart: () => {
        if (runtime.historyCaptureStatus === 'pending') {
          runtime.historyCaptureStatus = 'active'
          if (runtime.historyProbeTimer) {
            clearTimeout(runtime.historyProbeTimer)
            runtime.historyProbeTimer = undefined
          }
        }
      },
      onCommandText: (command) => {
        if (!runtime.historyCaptureEnabled) {
          return
        }
        if (isShellIntegrationInternal(command)) {
          return
        }
        runtime.pendingCommand = {
          text: command,
          startedAt: runtime.pendingCommand.startedAt,
          cwd: runtime.summary.currentPath || null
        }
      },
      onCommandPre: () => {
        if (!runtime.historyCaptureEnabled) {
          return
        }
        if (runtime.pendingCommand.startedAt === null) {
          runtime.pendingCommand.startedAt = Date.now()
        }
        if (!runtime.pendingCommand.cwd) {
          runtime.pendingCommand.cwd = runtime.summary.currentPath || null
        }
      },
      onCommandDone: (exitCode) => {
        if (!runtime.historyCaptureEnabled) {
          return
        }
        this.handleCommandDone(runtime, exitCode)
      },
      onCwd: (cwd) => {
        const normalized = normalizeRemotePath(cwd)
        if (runtime.summary.currentPath !== normalized) {
          runtime.summary.currentPath = normalized
          this.emitToRenderer(
            'sessions:cwdChanged',
            this.withObservableMetadata(runtime.sessionId, {
              sessionId: runtime.sessionId,
              cwd: normalized
            })
          )
        }
      }
    })

    if (!cleaned) {
      return
    }

    this.emitToRenderer(
      'sessions:data',
      this.withObservableMetadata(runtime.sessionId, {
        sessionId: runtime.sessionId,
        data: cleaned
      })
    )
  }

  private async installShellIntegration(runtime: SessionRuntime): Promise<void> {
    try {
      const shell = await this.detectInteractiveShell(runtime.client)
      if (shell !== 'bash' && shell !== 'zsh') {
        runtime.historyCaptureStatus = 'unavailable'
        runtime.integrationState = 'failed'
        return
      }

      runtime.integrationBuffer = ''
      runtime.shell.write(
        createShellIntegrationScript({ commandHistory: runtime.historyCaptureEnabled })
      )

      runtime.integrationTimeoutTimer = setTimeout(() => {
        if (runtime.integrationBuffer !== undefined) {
          const data = runtime.integrationBuffer
          runtime.integrationBuffer = undefined
          if (data) {
            this.emitSessionDataToRenderer(runtime, data)
          }
        }
        runtime.integrationTimeoutTimer = undefined
      }, 1000)
      runtime.integrationState = 'active'
    } catch {
      runtime.historyCaptureStatus = 'unavailable'
      runtime.integrationState = 'failed'
      return
    }

    runtime.historyProbeTimer = setTimeout(() => {
      if (runtime.historyCaptureStatus === 'pending') {
        runtime.historyCaptureStatus = 'unavailable'
      }
      runtime.historyProbeTimer = undefined
    }, 3000)
  }

  private async detectInteractiveShell(client: Client): Promise<'bash' | 'zsh' | 'unknown'> {
    const result = await execCommand(
      client,
      'printf "%s\\n" "${BASH_VERSION:+bash}" "${ZSH_VERSION:+zsh}" "$SHELL" 2>/dev/null'
    ).catch(() => null)

    if (!result || (result.code ?? 0) !== 0) {
      return 'unknown'
    }

    const stdout = result.stdout.toLowerCase()
    if (/\bbash\b/.test(stdout)) {
      return 'bash'
    }
    if (/\bzsh\b/.test(stdout)) {
      return 'zsh'
    }
    return 'unknown'
  }

  private handleCommandDone(runtime: SessionRuntime, exitCode: number | null): void {
    const pending = runtime.pendingCommand
    runtime.pendingCommand = { text: null, startedAt: null, cwd: null }
    if (!pending.text) {
      return
    }
    const executedAt = pending.startedAt
      ? new Date(pending.startedAt).toISOString()
      : new Date().toISOString()
    const durationMs =
      pending.startedAt !== null ? Math.max(0, Date.now() - pending.startedAt) : null

    let entry: CommandHistoryEntry | null = null
    try {
      entry = this.database.recordCommand({
        scope: { kind: 'ssh', serverId: runtime.summary.serverId },
        command: pending.text,
        executedAt,
        cwd: pending.cwd,
        exitCode,
        durationMs
      })
    } catch {
      return
    }

    if (!entry) {
      return
    }

    this.emitToRenderer(
      'commandHistory:added',
      this.withObservableMetadata(runtime.sessionId, {
        scope: { kind: 'ssh', serverId: runtime.summary.serverId },
        entry
      })
    )
  }

  async resize(sessionId: string, columns: number, rows: number): Promise<void> {
    const runtime = this.requireSession(sessionId)
    runtime.shell.setWindow(rows, columns, 0, 0)
  }

  async listDirectory(sessionId: string, remotePath: string) {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath || runtime.summary.currentPath)
    const entries = await sftpReadDir(runtime.sftp, normalized)
    runtime.summary.currentPath = normalized
    return {
      path: normalized,
      entries
    }
  }

  async createFile(sessionId: string, currentPath: string, name: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    await sftpCreateFile(runtime.sftp, posix.join(normalizeRemotePath(currentPath), name.trim()))
  }

  async openFileReadStream(
    sessionId: string,
    remotePath: string
  ): Promise<SftpFileReadStreamStart> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const stats = await sftpStat(runtime.sftp, normalized)

    if (stats.isDirectory()) {
      throw new Error(`Remote path is a directory: ${normalized}`)
    }

    const total = stats.size ?? 0
    const streamId = `sftp-read:${sessionId}:${randomUUID()}`
    const fileName = path.posix.basename(normalized)
    const controller = new AbortController()
    const task: EditorFileReadTask = {
      kind: 'read',
      streamId,
      sessionId,
      remotePath: normalized,
      fileName,
      total,
      transferred: 0,
      controller
    }
    const handle = await sftpOpen(runtime.sftp, normalized, 'r')
    task.handle = handle
    const firstBuffer = Buffer.allocUnsafe(Math.min(32768, total || 32768))
    let firstBytesRead = 0

    try {
      firstBytesRead = await sftpRead(
        runtime.sftp,
        handle,
        firstBuffer,
        0,
        firstBuffer.byteLength,
        0
      )
    } catch (error) {
      await sftpClose(runtime.sftp, handle).catch(() => undefined)
      throw error
    }

    const initialSample = firstBuffer.subarray(0, Math.max(0, firstBytesRead))
    const decoder = createIncrementalTextDecoder(initialSample)
    this.editorFileStreams.set(streamId, task)

    void this.runFileReadStream(runtime.sftp, task, decoder, initialSample, firstBytesRead)

    return {
      streamId,
      sessionId,
      remotePath: normalized,
      fileName,
      total,
      encoding: decoder.encoding
    }
  }

  private async runFileReadStream(
    sftp: SFTPWrapper,
    task: EditorFileReadTask,
    decoder: ReturnType<typeof createIncrementalTextDecoder>,
    initialSample: Buffer,
    firstBytesRead: number
  ): Promise<void> {
    try {
      if (task.controller.signal.aborted) {
        throw new SftpReadCancelledError()
      }

      if (firstBytesRead > 0) {
        task.transferred = firstBytesRead
        this.emitFileChunk(task, decoder.write(initialSample))
        this.emitFileStreamState(task, 'running')
      }

      let position = firstBytesRead

      while (true) {
        if (task.controller.signal.aborted) {
          throw new SftpReadCancelledError()
        }

        const buffer = Buffer.allocUnsafe(32768)
        const bytesRead = await sftpRead(sftp, task.handle!, buffer, 0, buffer.byteLength, position)

        if (task.controller.signal.aborted) {
          throw new SftpReadCancelledError()
        }

        if (bytesRead <= 0) {
          break
        }

        position += bytesRead
        task.transferred = position
        this.emitFileChunk(task, decoder.write(buffer.subarray(0, bytesRead)))
        this.emitFileStreamState(task, 'running')

        if (bytesRead < buffer.byteLength) {
          break
        }
      }

      this.emitFileChunk(task, decoder.end())
      await this.closeReadFileTaskHandle(sftp, task)
      this.editorFileStreams.delete(task.streamId)
      this.emitFileStreamState(task, 'completed')
    } catch (error) {
      await this.closeReadFileTaskHandle(sftp, task)
      this.editorFileStreams.delete(task.streamId)

      if (error instanceof SftpReadCancelledError || task.controller.signal.aborted) {
        this.emitFileStreamState(task, 'cancelled')
        return
      }

      this.emitFileStreamState(task, 'error', error instanceof Error ? error.message : String(error))
    }
  }

  private async closeReadFileTaskHandle(
    sftp: SFTPWrapper,
    task: EditorFileReadTask
  ): Promise<void> {
    const handle = task.handle
    if (!handle) {
      return
    }

    task.handle = undefined
    await sftpClose(sftp, handle).catch(() => undefined)
  }

  private emitFileChunk(task: EditorFileReadTask, chunk: string): void {
    if (!chunk) {
      return
    }

    this.emitToRenderer(
      'sftp:fileChunk',
      this.withObservableMetadata(task.sessionId, {
        streamId: task.streamId,
        sessionId: task.sessionId,
        remotePath: task.remotePath,
        chunk,
        transferred: task.transferred,
        total: task.total
      })
    )
  }

  private emitFileStreamState(
    task: EditorFileReadTask | EditorFileWriteTask,
    status: SftpFileStreamStateEvent['status'],
    error?: string
  ): void {
    const direction: SftpFileStreamDirection = task.kind === 'read' ? 'download' : 'upload'
    const total = task.kind === 'read' ? task.total : task.transferred
    const payload = {
      streamId: task.streamId,
      sessionId: task.sessionId,
      remotePath: task.remotePath,
      direction,
      status,
      transferred: task.transferred,
      total,
      ...(error ? { error } : {})
    }

    this.emitToRenderer(
      'sftp:fileStreamState',
      this.withObservableMetadata(task.sessionId, payload)
    )
    this.emitToRenderer(
      'sftp:transfer',
      this.withObservableMetadata(task.sessionId, {
        sessionId: task.sessionId,
        direction,
        fileName: task.fileName,
        localPath: '__editor__',
        remotePath: task.remotePath,
        transferred: task.transferred,
        total,
        status,
        ...(error ? { error } : {})
      })
    )
  }

  async openFileWriteStream(
    sessionId: string,
    remotePath: string,
    encoding: string
  ): Promise<SftpFileWriteStreamStart> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const handle = await sftpOpen(runtime.sftp, normalized, 'w')
    const streamId = `sftp-write:${sessionId}:${randomUUID()}`
    this.editorFileStreams.set(streamId, {
      kind: 'write',
      streamId,
      sessionId,
      remotePath: normalized,
      fileName: path.posix.basename(normalized),
      encoding,
      transferred: 0,
      handle,
      sftp: runtime.sftp
    })
    return { streamId, sessionId, remotePath: normalized }
  }

  async writeFileChunk(streamId: string, chunk: string): Promise<void> {
    const task = this.requireWriteFileStream(streamId)
    const buffer = encodeContent(chunk, task.encoding)
    await sftpWrite(task.sftp, task.handle, buffer, 0, buffer.byteLength, task.transferred)
    task.transferred += buffer.byteLength
    this.emitFileStreamState(task, 'running')
  }

  async closeFileWriteStream(streamId: string): Promise<void> {
    const task = this.requireWriteFileStream(streamId)
    this.editorFileStreams.delete(streamId)
    await sftpClose(task.sftp, task.handle).catch(() => undefined)
    this.emitFileStreamState(task, 'completed')
  }

  cancelFileStream(streamId: string): void {
    const task = this.editorFileStreams.get(streamId)
    if (!task) {
      return
    }

    this.editorFileStreams.delete(streamId)
    if (task.kind === 'read') {
      task.controller.abort()
    } else {
      void sftpClose(task.sftp, task.handle).catch(() => undefined)
      this.emitFileStreamState(task, 'cancelled')
    }
  }

  private requireWriteFileStream(streamId: string): EditorFileWriteTask {
    const task = this.editorFileStreams.get(streamId)
    if (!task || task.kind !== 'write') {
      throw new Error(`SFTP file stream unavailable: ${streamId}`)
    }

    return task
  }

  async makeDirectory(sessionId: string, currentPath: string, name: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    await sftpMkdir(runtime.sftp, posix.join(normalizeRemotePath(currentPath), name.trim()))
  }

  async rename(sessionId: string, remotePath: string, newName: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const targetPath = posix.join(posix.dirname(normalized), newName.trim())
    await sftpRename(runtime.sftp, normalized, targetPath)
  }

  async move(sessionId: string, sourcePath: string, destinationDirPath: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    const normalizedSource = normalizeRemotePath(sourcePath)
    const normalizedDestDir = normalizeRemotePath(destinationDirPath)
    const entryName = posix.basename(normalizedSource)
    const targetPath = posix.join(normalizedDestDir, entryName)
    await sftpRename(runtime.sftp, normalizedSource, targetPath)
  }

  async remove(sessionId: string, remotePath: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    await this.removeRemoteEntry(runtime.sftp, normalized)
  }

  async uploadFiles(sessionId: string, targetPath: string): Promise<void> {
    const window = this.getWindow()
    const openOptions: OpenDialogOptions = {
      title: this.t('dialogs.uploadFiles.title'),
      properties: ['openFile', 'multiSelections']
    }
    const selection = window
      ? await dialog.showOpenDialog(window, openOptions)
      : await dialog.showOpenDialog(openOptions)

    if (selection.canceled || selection.filePaths.length === 0) {
      return
    }

    await this.uploadPaths(sessionId, targetPath, selection.filePaths)
  }

  private async countLocalFiles(localPath: string): Promise<number> {
    const stats = await fs.lstat(localPath)

    if (!stats.isDirectory()) {
      return stats.isFile() ? 1 : 0
    }

    const children = await fs.readdir(localPath)
    const counts = await Promise.all(
      children.map((child) => this.countLocalFiles(path.join(localPath, child)))
    )

    return counts.reduce((sum, count) => sum + count, 0)
  }

  async uploadPaths(sessionId: string, targetPath: string, localPaths: string[]): Promise<void> {
    const runtime = this.requireSession(sessionId)
    const normalizedTargetPath = normalizeRemotePath(targetPath)
    const uniqueLocalPaths = [
      ...new Set(
        localPaths
          .filter((localPath): localPath is string => typeof localPath === 'string')
          .map((localPath) => localPath.trim())
          .filter(Boolean)
      )
    ]

    const batchId = `upload:${sessionId}:${randomUUID()}`
    const counts = await Promise.all(
      uniqueLocalPaths.map((localPath) => this.countLocalFiles(localPath))
    )
    const batchTotal = counts.reduce((sum, count) => sum + count, 0)

    const { sftpUploadConcurrency } = this.database.getSettings()
    const controller = new AbortController()
    this.transferControllers.set(batchId, controller)

    try {
      await runWithConcurrency(
        uniqueLocalPaths,
        sftpUploadConcurrency,
        async (localPath, signal) => {
          if (signal.aborted) {
            return
          }
          const remotePath = posix.join(normalizedTargetPath, basename(localPath))
          await this.uploadLocalEntry(
            sessionId,
            runtime.sftp,
            localPath,
            remotePath,
            batchId,
            batchTotal,
            signal
          )
        },
        controller.signal
      )
    } finally {
      this.transferControllers.delete(batchId)
    }
  }

  async downloadFile(sessionId: string, remotePath: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const remoteStats = await sftpStat(runtime.sftp, normalized)
    const window = this.getWindow()
    const fileName = path.posix.basename(normalized)

    if (remoteStats.isDirectory()) {
      const selectionOptions: OpenDialogOptions = {
        title: this.t('dialogs.downloadFile.title'),
        properties: ['openDirectory']
      }
      const selection = window
        ? await dialog.showOpenDialog(window, selectionOptions)
        : await dialog.showOpenDialog(selectionOptions)

      if (selection.canceled || selection.filePaths.length === 0) {
        return
      }

      const batchId = `download:${sessionId}:${randomUUID()}`
      const batchTotal = await this.countRemoteFiles(runtime.sftp, normalized)
      const localDirectoryPath = path.join(selection.filePaths[0], fileName)
      const controller = new AbortController()
      this.transferControllers.set(batchId, controller)

      try {
        await this.downloadRemoteEntry(
          sessionId,
          runtime.sftp,
          normalized,
          localDirectoryPath,
          batchId,
          batchTotal,
          controller.signal
        )
      } finally {
        this.transferControllers.delete(batchId)
      }
      return
    }

    const saveOptions = {
      title: this.t('dialogs.downloadFile.title'),
      defaultPath: fileName
    }
    const saveResult = window
      ? await dialog.showSaveDialog(window, saveOptions)
      : await dialog.showSaveDialog(saveOptions)

    if (saveResult.canceled || !saveResult.filePath) {
      return
    }

    const batchId = `download:${sessionId}:${randomUUID()}`
    const batchTotal = 1
    const controller = new AbortController()
    this.transferControllers.set(batchId, controller)

    try {
      await this.downloadRemoteFile(
        sessionId,
        runtime.sftp,
        normalized,
        saveResult.filePath,
        batchId,
        batchTotal,
        controller.signal
      )
    } finally {
      this.transferControllers.delete(batchId)
    }
  }

  private async countRemoteFiles(sftp: SFTPWrapper, remotePath: string): Promise<number> {
    const stats = await sftpStat(sftp, remotePath)

    if (!stats.isDirectory()) {
      return 1
    }

    const entries = await sftpReadDir(sftp, remotePath)
    const counts = await Promise.all(
      entries
        .filter((entry) => entry.name !== '.' && entry.name !== '..')
        .map((entry) => this.countRemoteFiles(sftp, entry.path))
    )

    return counts.reduce((sum, count) => sum + count, 0)
  }

  private async downloadRemoteEntry(
    sessionId: string,
    sftp: SFTPWrapper,
    remotePath: string,
    localPath: string,
    batchId: string,
    batchTotal: number,
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) {
      return
    }

    const stats = await sftpStat(sftp, remotePath)

    if (!stats.isDirectory()) {
      await this.downloadRemoteFile(
        sessionId,
        sftp,
        remotePath,
        localPath,
        batchId,
        batchTotal,
        signal
      )
      return
    }

    await fs.mkdir(localPath, { recursive: true })
    const entries = await sftpReadDir(sftp, remotePath)

    const { sftpDownloadConcurrency } = this.database.getSettings()

    await runWithConcurrency(
      entries.filter((entry) => entry.name !== '.' && entry.name !== '..'),
      sftpDownloadConcurrency,
      async (entry, s) => {
        await this.downloadRemoteEntry(
          sessionId,
          sftp,
          entry.path,
          path.join(localPath, entry.name),
          batchId,
          batchTotal,
          s
        )
      },
      signal
    )
  }

  private async downloadRemoteFile(
    sessionId: string,
    sftp: SFTPWrapper,
    remotePath: string,
    localPath: string,
    batchId: string,
    batchTotal: number,
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) {
      this.emitToRenderer(
        'sftp:transfer',
        this.withObservableMetadata(sessionId, {
          sessionId,
          direction: 'download',
          fileName: path.posix.basename(remotePath),
          localPath,
          remotePath,
          transferred: 0,
          total: 0,
          status: 'cancelled',
          batchId,
          batchTotal
        })
      )
      return
    }

    const fileName = path.posix.basename(remotePath)
    let transferred = 0
    let total = 1

    await fs.mkdir(path.dirname(localPath), { recursive: true })

    return new Promise<void>((resolve, reject) => {
      let aborted = false

      const onAbort = () => {
        aborted = true
        this.emitToRenderer(
          'sftp:transfer',
          this.withObservableMetadata(sessionId, {
            sessionId,
            direction: 'download',
            fileName,
            localPath,
            remotePath,
            transferred,
            total,
            status: 'cancelled',
            batchId,
            batchTotal
          })
        )
        resolve()
      }

      signal?.addEventListener('abort', onAbort, { once: true })

      sftp.fastGet(
        remotePath,
        localPath,
        {
          step: (nextTransferred, _chunk, nextTotal) => {
            if (aborted) {
              return
            }
            transferred = nextTransferred
            total = Math.max(nextTotal, 1)
            this.emitToRenderer(
              'sftp:transfer',
              this.withObservableMetadata(sessionId, {
                sessionId,
                direction: 'download',
                fileName,
                localPath,
                remotePath,
                transferred,
                total,
                status: 'running',
                batchId,
                batchTotal
              })
            )
          }
        },
        (error) => {
          signal?.removeEventListener('abort', onAbort)

          if (aborted) {
            resolve()
            return
          }

          if (error) {
            this.emitToRenderer(
              'sftp:transfer',
              this.withObservableMetadata(sessionId, {
                sessionId,
                direction: 'download',
                fileName,
                localPath,
                remotePath,
                transferred,
                total,
                status: 'error',
                error: error.message,
                batchId,
                batchTotal
              })
            )
            reject(error)
            return
          }

          this.emitToRenderer(
            'sftp:transfer',
            this.withObservableMetadata(sessionId, {
              sessionId,
              direction: 'download',
              fileName,
              localPath,
              remotePath,
              transferred: total,
              total,
              status: 'completed',
              batchId,
              batchTotal
            })
          )
          resolve()
        }
      )
    })
  }

  cancelTransfer(batchId: string): void {
    const controller = this.transferControllers.get(batchId)
    if (controller) {
      controller.abort()
      this.transferControllers.delete(batchId)
    }
  }

  cancelAllTransfers(): void {
    for (const controller of this.transferControllers.values()) {
      controller.abort()
    }
    this.transferControllers.clear()
  }

  async createPortForward(sessionId: string, input: PortForwardInput): Promise<PortForwardRule> {
    this.requireSession(sessionId)

    const createdAt = now()
    const rule: PortForwardRule = {
      id: randomUUID(),
      sessionId,
      enabled: true,
      status: 'starting',
      createdAt,
      updatedAt: createdAt,
      ...input
    }

    this.portForwardSnapshots.set(sessionId, [...this.getPortForwardRules(sessionId), rule])
    this.emitPortForwardState(rule)

    return this.startPortForward(sessionId, rule.id)
  }

  async startPortForward(sessionId: string, ruleId: string): Promise<PortForwardRule> {
    const runtime = this.requireSession(sessionId)
    const existingActive = runtime.portForwards.get(ruleId)

    if (existingActive) {
      await this.releasePortForwardRuntime(sessionId, runtime, existingActive)
    }

    let rule = this.updatePortForwardRule(sessionId, ruleId, (current) => ({
      ...current,
      enabled: true,
      status: 'starting',
      lastError: undefined,
      updatedAt: now()
    }))

    try {
      await this.startPortForwardRuntime(sessionId, runtime, rule)
      rule = this.updatePortForwardRule(sessionId, ruleId, (current) => ({
        ...current,
        enabled: true,
        status: 'active',
        lastError: undefined,
        updatedAt: now()
      }))
    } catch (error) {
      const active = runtime.portForwards.get(ruleId)
      if (active) {
        await this.releasePortForwardRuntime(sessionId, runtime, active)
      }

      const message = error instanceof Error ? error.message : this.t('errors.connectionFailed')
      rule = this.updatePortForwardRule(sessionId, ruleId, (current) => ({
        ...current,
        enabled: true,
        status: 'error',
        lastError: message,
        updatedAt: now()
      }))
    }

    return rule
  }

  async stopPortForward(sessionId: string, ruleId: string): Promise<PortForwardRule> {
    const runtime = this.sessions.get(sessionId)
    const active = runtime?.portForwards.get(ruleId)

    if (runtime && active) {
      await this.releasePortForwardRuntime(sessionId, runtime, active)
    }

    return this.updatePortForwardRule(sessionId, ruleId, (current) => ({
      ...current,
      enabled: false,
      status: 'stopped',
      lastError: undefined,
      updatedAt: now()
    }))
  }

  async removePortForward(sessionId: string, ruleId: string): Promise<void> {
    const runtime = this.sessions.get(sessionId)
    const active = runtime?.portForwards.get(ruleId)

    if (runtime && active) {
      await this.releasePortForwardRuntime(sessionId, runtime, active)
    }

    const rules = this.getPortForwardRules(sessionId)
    const remaining = rules.filter((rule) => rule.id !== ruleId)

    if (remaining.length === rules.length) {
      return
    }

    this.setPortForwardRules(sessionId, remaining)
  }

  listPortForwards(sessionId: string): PortForwardRule[] {
    return this.getPortForwardRules(sessionId).map((rule) => clonePortForwardRule(rule))
  }

  dispose(): void {
    for (const runtime of this.sessions.values()) {
      runtime.finalizing = true
      for (const active of [...runtime.portForwards.values()]) {
        void this.releasePortForwardRuntime(runtime.sessionId, runtime, active)
      }
      this.releaseRuntimeClients(runtime)
    }

    this.sessions.clear()
    this.history.clear()
    this.portForwardSnapshots.clear()
    this.resourceCpuBaselines.clear()
    this.resourceNetworkBaselines.clear()
  }

  private normalizeConnectionFailure(error: unknown): ConnectionFailure {
    if (error instanceof ConnectionFailure) {
      return error
    }

    if (isAuthenticationFailure(error)) {
      return new ConnectionFailure('auth_failed', this.t('errors.authFailed'))
    }

    const message = error instanceof Error ? error.message : this.t('errors.connectionFailed')
    return new ConnectionFailure('connection_failed', message)
  }

  private createConnectConfig(
    server: Server,
    auth: ResolvedConnectionAuth,
    sock?: ClientChannel
  ): ConnectConfig {
    return {
      host: server.host,
      port: server.port,
      username: server.username,
      readyTimeout: 15_000,
      keepaliveInterval: 10_000,
      keepaliveCountMax: 3,
      password: auth.password,
      privateKey: auth.privateKey,
      passphrase: auth.passphrase,
      ...(sock ? { sock } : {}),
      hostVerifier: (key, verify) => {
        this.hostTrustService
          .verifyHost({ serverName: server.name, host: server.host, port: server.port, key })
          .then(verify)
          .catch(() => verify(false))
      }
    }
  }

  private async connectToServer(
    server: Server,
    auth: ResolvedConnectionAuth,
    sock?: ClientChannel
  ): Promise<Client> {
    const client = new Client()

    return new Promise<Client>((resolve, reject) => {
      let settled = false

      const rejectWith = (error: unknown) => {
        if (settled) {
          return
        }

        settled = true
        reject(this.normalizeHopConnectionFailure(server, error))
      }

      client.once('error', (error) => {
        rejectWith(error)
      })
      client.once('ready', () => {
        if (settled) {
          return
        }

        settled = true
        resolve(client)
      })

      try {
        client.connect(this.createConnectConfig(server, auth, sock))
      } catch (error) {
        rejectWith(error)
      }
    })
  }

  private normalizeHopConnectionFailure(server: Server, error: unknown): ConnectionFailure {
    if (error instanceof ConnectionFailure) {
      return error
    }

    if (isAuthenticationFailure(error)) {
      return new ConnectionFailure(
        'auth_failed',
        this.t('errors.authFailed'),
        server.id,
        getSecretKindForServer(server)
      )
    }

    const message = error instanceof Error ? error.message : this.t('errors.connectionFailed')
    return new ConnectionFailure('connection_failed', message, server.id)
  }

  private bindRuntimeClient(runtime: SessionRuntime, client: Client, primary = false): void {
    const sessionId = runtime.sessionId

    client.on('error', (error) => {
      if (runtime.finalizing) {
        return
      }

      runtime.lastError = error.message
      this.emitToRenderer(
        'sessions:error',
        this.withObservableMetadata(sessionId, {
          sessionId,
          code: 'session_runtime_error',
          message: error.message,
          recoverable: !primary
        })
      )
      this.emitSessionState(sessionId, 'error', undefined, error.message)

      if (!primary) {
        runtime.client.end()
      }
    })

    client.on('close', () => {
      if (runtime.finalizing) {
        return
      }

      if (!primary) {
        runtime.lastError = runtime.lastError ?? this.t('session.disconnected')
        runtime.client.end()
      }

      void this.finalizeSession(sessionId)
    })
  }

  private releaseRuntimeClients(runtime: SessionRuntime): void {
    runtime.client.end()
    for (const upstreamClient of runtime.upstreamClients) {
      upstreamClient.end()
    }
  }

  private async persistConnectionSecrets(
    servers: Server[],
    request: ConnectionRequest
  ): Promise<void> {
    for (const server of servers) {
      const secrets = request.secrets?.[server.id]
      if (!secrets) {
        continue
      }

      await this.persistServerConnectionSecrets(server.id, server.authType, secrets)
    }
  }

  private async detectAndStoreServerBrand(
    server: Server,
    sftp: SFTPWrapper,
    client: Client
  ): Promise<void> {
    if (server.brandId !== null) {
      return
    }

    let brandId = DEFAULT_SERVER_BRAND_ID

    try {
      const { stdout } = await execCommand(client, 'uname -s')
      if (stdout.trim() === 'Darwin') {
        brandId = 'macos'
        try {
          this.database.updateServerBrand(server.id, brandId)
        } catch {
          // Best-effort.
        }
        return
      }
    } catch {
      // uname failed; fall through to Linux detection.
    }

    try {
      for (const remotePath of ['/etc/os-release', '/usr/lib/os-release']) {
        try {
          const contents = await sftpReadFile(sftp, remotePath)
          brandId = resolveServerBrandFromOsRelease(contents.content)
          break
        } catch {
          continue
        }
      }
    } catch {
      brandId = DEFAULT_SERVER_BRAND_ID
    }

    try {
      this.database.updateServerBrand(server.id, brandId)
    } catch {
      // Brand detection is best-effort and must not block a successful connection.
    }
  }

  private async persistServerConnectionSecrets(
    serverId: string,
    authType: 'password' | 'privateKey',
    request: ConnectionSecretInput
  ): Promise<void> {
    if (authType === 'password') {
      if (request.rememberPassword === false) {
        this.database.updateServerPassword(serverId, null)
      } else if (request.rememberPassword && request.password) {
        this.database.updateServerPassword(serverId, request.password)
      }

      return
    }

    if (request.rememberPassphrase === false) {
      this.database.updateServerPassphrase(serverId, null)
    } else if (request.rememberPassphrase && request.passphrase) {
      this.database.updateServerPassphrase(serverId, request.passphrase)
    }
  }

  private async uploadLocalEntry(
    sessionId: string,
    sftp: SFTPWrapper,
    localPath: string,
    remotePath: string,
    batchId?: string,
    batchTotal?: number,
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) {
      return
    }

    const localStats = await fs.lstat(localPath)
    const normalizedRemotePath = normalizeRemotePath(remotePath)

    if (localStats.isDirectory()) {
      await this.ensureRemoteDirectory(sftp, normalizedRemotePath)
      const childNames = await fs.readdir(localPath)

      const { sftpUploadConcurrency } = this.database.getSettings()

      await runWithConcurrency(
        childNames,
        sftpUploadConcurrency,
        async (childName, s) => {
          await this.uploadLocalEntry(
            sessionId,
            sftp,
            path.join(localPath, childName),
            posix.join(normalizedRemotePath, childName),
            batchId,
            batchTotal,
            s
          )
        },
        signal
      )

      return
    }

    if (!localStats.isFile()) {
      throw new Error(`Unsupported local upload entry: ${localPath}`)
    }

    await this.uploadLocalFile(
      sessionId,
      sftp,
      localPath,
      normalizedRemotePath,
      localStats,
      batchId,
      batchTotal,
      signal
    )
  }

  private async uploadLocalFile(
    sessionId: string,
    sftp: SFTPWrapper,
    localPath: string,
    remotePath: string,
    localStats: FsStats,
    batchId?: string,
    batchTotal?: number,
    signal?: AbortSignal
  ): Promise<void> {
    if (signal?.aborted) {
      this.emitToRenderer(
        'sftp:transfer',
        this.withObservableMetadata(sessionId, {
          sessionId,
          direction: 'upload',
          fileName: basename(localPath),
          localPath,
          remotePath,
          transferred: 0,
          total: 0,
          status: 'cancelled',
          ...(batchId !== undefined ? { batchId, batchTotal } : {})
        })
      )
      return
    }

    const fileName = basename(localPath)
    let transferred = 0
    let total = Math.max(localStats.size, 1)

    const batchInfo = batchId !== undefined ? { batchId, batchTotal } : {}

    return new Promise<void>((resolve, reject) => {
      let aborted = false

      const onAbort = () => {
        aborted = true
        this.emitToRenderer(
          'sftp:transfer',
          this.withObservableMetadata(sessionId, {
            sessionId,
            direction: 'upload',
            fileName,
            localPath,
            remotePath,
            transferred,
            total,
            status: 'cancelled',
            ...batchInfo
          })
        )
        resolve()
      }

      signal?.addEventListener('abort', onAbort, { once: true })

      sftp.fastPut(
        localPath,
        remotePath,
        {
          step: (nextTransferred, _chunk, nextTotal) => {
            if (aborted) {
              return
            }
            transferred = nextTransferred
            total = Math.max(nextTotal, 1)
            this.emitToRenderer(
              'sftp:transfer',
              this.withObservableMetadata(sessionId, {
                sessionId,
                direction: 'upload',
                fileName,
                localPath,
                remotePath,
                transferred,
                total,
                status: 'running',
                ...batchInfo
              })
            )
          }
        },
        (error) => {
          signal?.removeEventListener('abort', onAbort)

          if (aborted) {
            resolve()
            return
          }

          if (error) {
            this.emitToRenderer(
              'sftp:transfer',
              this.withObservableMetadata(sessionId, {
                sessionId,
                direction: 'upload',
                fileName,
                localPath,
                remotePath,
                transferred,
                total,
                status: 'error',
                error: error.message,
                ...batchInfo
              })
            )
            reject(error)
            return
          }

          this.emitToRenderer(
            'sftp:transfer',
            this.withObservableMetadata(sessionId, {
              sessionId,
              direction: 'upload',
              fileName,
              localPath,
              remotePath,
              transferred: total,
              total,
              status: 'completed',
              ...batchInfo
            })
          )
          resolve()
        }
      )
    })
  }

  private async ensureRemoteDirectory(sftp: SFTPWrapper, remotePath: string): Promise<void> {
    const normalizedRemotePath = normalizeRemotePath(remotePath)
    if (normalizedRemotePath === '/') {
      return
    }

    const existingStats = await sftpStat(sftp, normalizedRemotePath).catch(() => null)
    if (existingStats) {
      if (existingStats.isDirectory()) {
        return
      }

      throw new Error(`Remote path is not a directory: ${normalizedRemotePath}`)
    }

    const parentPath = posix.dirname(normalizedRemotePath)
    if (parentPath !== normalizedRemotePath) {
      await this.ensureRemoteDirectory(sftp, parentPath)
    }

    try {
      await sftpMkdir(sftp, normalizedRemotePath)
    } catch (error) {
      const createdStats = await sftpStat(sftp, normalizedRemotePath).catch(() => null)
      if (createdStats?.isDirectory()) {
        return
      }

      throw error
    }
  }

  private async removeRemoteEntry(sftp: SFTPWrapper, remotePath: string): Promise<void> {
    const normalizedRemotePath = normalizeRemotePath(remotePath)
    const stats = await sftpLstat(sftp, normalizedRemotePath).catch(() =>
      sftpStat(sftp, normalizedRemotePath)
    )

    if (!stats.isDirectory()) {
      await sftpUnlink(sftp, normalizedRemotePath)
      return
    }

    const entries = await sftpReadDir(sftp, normalizedRemotePath)

    for (const entry of entries) {
      if (entry.name === '.' || entry.name === '..') {
        continue
      }

      await this.removeRemoteEntry(sftp, entry.path)
    }

    await sftpRmdir(sftp, normalizedRemotePath)
  }

  private requireSession(sessionId: string): SessionRuntime {
    const runtime = this.sessions.get(sessionId)
    if (!runtime) {
      throw new Error(this.t('errors.sessionUnavailable'))
    }

    return runtime
  }

  private getPortForwardRules(sessionId: string): PortForwardRule[] {
    return this.portForwardSnapshots.get(sessionId) ?? []
  }

  private setPortForwardRules(sessionId: string, rules: PortForwardRule[]): void {
    if (rules.length === 0) {
      this.portForwardSnapshots.delete(sessionId)
      return
    }

    this.portForwardSnapshots.set(sessionId, rules)
  }

  private findPortForwardRule(sessionId: string, ruleId: string): PortForwardRule | null {
    return this.getPortForwardRules(sessionId).find((rule) => rule.id === ruleId) ?? null
  }

  private updatePortForwardRule(
    sessionId: string,
    ruleId: string,
    updater: (rule: PortForwardRule) => PortForwardRule
  ): PortForwardRule {
    let updatedRule: PortForwardRule | null = null
    const rules: PortForwardRule[] = this.getPortForwardRules(sessionId).map((rule) => {
      if (rule.id !== ruleId) {
        return rule
      }

      updatedRule = updater(rule)
      return updatedRule as PortForwardRule
    })

    if (!updatedRule) {
      throw new Error(this.t('errors.portForwardNotFound'))
    }

    this.setPortForwardRules(sessionId, rules)
    this.emitPortForwardState(updatedRule)
    return updatedRule
  }

  private emitPortForwardState(rule: PortForwardRule): void {
    this.emitToRenderer(
      'portForwards:state',
      this.withObservableMetadata(rule.sessionId, {
        sessionId: rule.sessionId,
        rule: clonePortForwardRule(rule)
      })
    )
  }

  private async startPortForwardRuntime(
    sessionId: string,
    runtime: SessionRuntime,
    rule: PortForwardRule
  ): Promise<void> {
    if (rule.kind === 'local') {
      await this.startLocalPortForward(sessionId, runtime, rule)
      return
    }

    await this.startRemotePortForward(runtime, rule)
  }

  private async startLocalPortForward(
    sessionId: string,
    runtime: SessionRuntime,
    rule: PortForwardRule
  ): Promise<void> {
    const server = net.createServer()
    const active: LocalPortForwardRuntime = {
      ruleId: rule.id,
      kind: 'local',
      server,
      sockets: new Set(),
      channels: new Set()
    }

    runtime.portForwards.set(rule.id, active)

    server.on('connection', (socket) => {
      if (!runtime.portForwards.has(rule.id)) {
        socket.destroy()
        return
      }

      void connectForwardOut(
        runtime.client,
        socket.remoteAddress ?? '127.0.0.1',
        socket.remotePort ?? 0,
        rule.targetHost,
        rule.targetPort
      )
        .then((channel) => {
          if (!runtime.portForwards.has(rule.id)) {
            channel.destroy()
            socket.destroy()
            return
          }

          this.attachPortForwardConnection(sessionId, rule.id, active, socket, channel)
        })
        .catch((error) => {
          socket.destroy()
          void this.recordPortForwardConnectionError(sessionId, rule.id, error)
        })
    })

    await listenOnServer(server, rule.bindHost, rule.bindPort)

    server.on('error', (error) => {
      void this.handlePortForwardRuntimeFailure(sessionId, rule.id, error)
    })
  }

  private async startRemotePortForward(
    runtime: SessionRuntime,
    rule: PortForwardRule
  ): Promise<void> {
    const active: RemotePortForwardRuntime = {
      ruleId: rule.id,
      kind: 'remote',
      sockets: new Set(),
      channels: new Set()
    }

    runtime.portForwards.set(rule.id, active)
    await startForwardIn(runtime.client, rule.bindHost, rule.bindPort)
  }

  private attachPortForwardConnection(
    sessionId: string,
    ruleId: string,
    active: ActivePortForward,
    socket: Socket,
    channel: ClientChannel
  ): void {
    active.sockets.add(socket)
    active.channels.add(channel)

    const cleanup = () => {
      active.sockets.delete(socket)
      active.channels.delete(channel)
    }

    socket.on('close', cleanup)
    channel.on('close', cleanup)

    socket.on('error', (error) => {
      channel.destroy()
      void this.recordPortForwardConnectionError(sessionId, ruleId, error)
    })
    channel.on('error', (error) => {
      socket.destroy()
      void this.recordPortForwardConnectionError(sessionId, ruleId, error)
    })

    socket.pipe(channel)
    channel.pipe(socket)
  }

  private async releasePortForwardRuntime(
    sessionId: string,
    runtime: SessionRuntime,
    active: ActivePortForward
  ): Promise<void> {
    runtime.portForwards.delete(active.ruleId)

    for (const socket of active.sockets) {
      socket.destroy()
    }
    for (const channel of active.channels) {
      channel.destroy()
    }

    if (active.kind === 'local') {
      await closeServer(active.server)
      return
    }

    const rule = this.findPortForwardRule(sessionId, active.ruleId)
    if (!rule) {
      return
    }

    await stopForwardIn(runtime.client, rule.bindHost, rule.bindPort).catch(() => undefined)
  }

  private async releaseSessionPortForwards(sessionId: string): Promise<void> {
    const runtime = this.sessions.get(sessionId)
    if (!runtime) {
      return
    }

    for (const active of [...runtime.portForwards.values()]) {
      await this.releasePortForwardRuntime(sessionId, runtime, active)
    }
  }

  private async handlePortForwardRuntimeFailure(
    sessionId: string,
    ruleId: string,
    error: unknown
  ): Promise<void> {
    const runtime = this.sessions.get(sessionId)
    const active = runtime?.portForwards.get(ruleId)
    if (runtime && active) {
      await this.releasePortForwardRuntime(sessionId, runtime, active)
    }

    const rule = this.findPortForwardRule(sessionId, ruleId)
    if (!rule?.enabled) {
      return
    }

    const message = error instanceof Error ? error.message : this.t('errors.connectionFailed')
    this.updatePortForwardRule(sessionId, ruleId, (current) => ({
      ...current,
      status: 'error',
      lastError: message,
      updatedAt: now()
    }))
  }

  private async recordPortForwardConnectionError(
    sessionId: string,
    ruleId: string,
    error: unknown
  ): Promise<void> {
    const runtime = this.sessions.get(sessionId)
    const rule = this.findPortForwardRule(sessionId, ruleId)

    if (!runtime?.portForwards.has(ruleId) || !rule?.enabled) {
      return
    }

    const message = error instanceof Error ? error.message : this.t('errors.connectionFailed')
    this.updatePortForwardRule(sessionId, ruleId, (current) => ({
      ...current,
      lastError: message,
      updatedAt: now()
    }))
  }

  private handleRemoteTcpConnection(
    sessionId: string,
    details: TcpConnectionDetails,
    accept: AcceptTcpConnection,
    rejectConnection: RejectConnection
  ): void {
    const runtime = this.sessions.get(sessionId)
    if (!runtime) {
      rejectConnection()
      return
    }

    const rule = this.getPortForwardRules(sessionId).find((current) => {
      if (current.kind !== 'remote' || !current.enabled || current.bindPort !== details.destPort) {
        return false
      }

      if (current.bindHost === details.destIP) {
        return true
      }

      return isWildcardBindHost(current.bindHost)
    })

    if (!rule) {
      rejectConnection()
      return
    }

    const active = runtime.portForwards.get(rule.id)
    if (!active || active.kind !== 'remote') {
      rejectConnection()
      return
    }

    let channel: ClientChannel
    try {
      channel = accept()
    } catch {
      rejectConnection()
      return
    }

    const socket = net.createConnection({
      host: rule.targetHost,
      port: rule.targetPort
    })

    socket.once('connect', () => {
      this.attachPortForwardConnection(sessionId, rule.id, active, socket, channel)
    })
    socket.once('error', (error) => {
      channel.destroy()
      void this.recordPortForwardConnectionError(sessionId, rule.id, error)
    })
  }

  private migratePortForwardSnapshots(fromSessionId: string, toSessionId: string): void {
    if (fromSessionId === toSessionId) {
      return
    }

    const rules = this.getPortForwardRules(fromSessionId)
    this.portForwardSnapshots.delete(fromSessionId)

    if (rules.length === 0) {
      return
    }

    this.portForwardSnapshots.set(
      toSessionId,
      rules.map((rule) => ({
        ...rule,
        sessionId: toSessionId,
        updatedAt: now()
      }))
    )
  }

  private async restoreEnabledPortForwards(sessionId: string): Promise<void> {
    const restorableRules = this.getPortForwardRules(sessionId).filter((rule) => rule.enabled)

    for (const rule of restorableRules) {
      await this.startPortForward(sessionId, rule.id)
    }
  }

  private async finalizeSession(sessionId: string): Promise<void> {
    const runtime = this.sessions.get(sessionId)
    if (!runtime || runtime.finalizing) {
      return
    }

    runtime.finalizing = true
    await this.releaseSessionPortForwards(sessionId)
    this.releaseRuntimeClients(runtime)
    this.sessions.delete(sessionId)
    this.resourceCpuBaselines.delete(sessionId)
    this.resourceNetworkBaselines.delete(sessionId)

    for (const rule of this.getPortForwardRules(sessionId)) {
      if (!rule.enabled) {
        continue
      }

      this.updatePortForwardRule(sessionId, rule.id, (current) => ({
        ...current,
        status: 'error',
        lastError: runtime.lastError ?? this.t('session.disconnected'),
        updatedAt: now()
      }))
    }

    if (runtime.lastExit) {
      this.emitToRenderer('sessions:exit', runtime.lastExit)
    }

    this.emitSessionState(
      sessionId,
      runtime.lastError ? 'error' : 'disconnected',
      undefined,
      runtime.lastError ?? this.t('session.disconnected')
    )
  }

  resolveHostTrust(result: HostTrustResult): void {
    this.hostTrustService.resolveHostTrust(result)
  }

  private emitConnectionPhase(sessionId: string, phase: SessionConnectionPhase): void {
    if (!SESSION_CONNECTION_PHASES.includes(phase)) {
      return
    }

    this.emitSessionState(sessionId, 'connecting', phase)
  }

  private emitSessionState(
    sessionId: string,
    status: SessionStateEvent['status'],
    phase?: SessionConnectionPhase,
    message?: string
  ): void {
    this.emitToRenderer(
      'sessions:state',
      this.withObservableMetadata(sessionId, {
        sessionId,
        status,
        phase,
        message
      })
    )
  }

  private withObservableMetadata<TPayload extends object>(
    correlationId: string,
    payload: TPayload
  ) {
    return {
      ...payload,
      correlationId,
      source: 'main' as const,
      timestamp: now()
    }
  }
}
