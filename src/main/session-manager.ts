import { createHash, randomUUID } from 'node:crypto'
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
import {
  dialog,
  type BrowserWindow,
  type MessageBoxOptions,
  type OpenDialogOptions
} from 'electron'
import { normalizeRemotePath, sortRemoteEntries } from '@shared/sftp'
import { DEFAULT_SERVER_BRAND_ID, resolveServerBrandFromOsRelease } from '@shared/server-brands'
import {
  type ConnectionSecretInput,
  ConnectionRequest,
  PortForwardInput,
  PortForwardRule,
  PortForwardStateEvent,
  RemoteEntry,
  type RemoteEntryKind,
  type SecretKind,
  SESSION_RESOURCE_MONITOR_LINUX_ONLY,
  SESSION_RESOURCE_MONITOR_UNAVAILABLE,
  type Server,
  SessionConnectFailureCode,
  SessionConnectResult,
  type SessionConnectionPhase,
  SessionDataEvent,
  SessionErrorEvent,
  SessionExitEvent,
  SESSION_CONNECTION_PHASES,
  type SessionResourceSnapshot,
  SessionStateEvent,
  SessionSummary,
  TransferProgressEvent
} from '@shared/types'
import type { DatabaseService } from './database'
import type { MainTranslator } from './localization'
import type { SecureStoreService } from './secure-store'

type WindowProvider = () => BrowserWindow | null
type AcceptTcpConnection = () => ClientChannel
type RejectConnection = () => void

type EventMap = {
  'sessions:data': SessionDataEvent
  'sessions:error': SessionErrorEvent
  'sessions:exit': SessionExitEvent
  'sessions:state': SessionStateEvent
  'sftp:transfer': TransferProgressEvent
  'portForwards:state': PortForwardStateEvent
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

function toFingerprint(key: Buffer): string {
  return `SHA256:${createHash('sha256').update(key).digest('base64')}`
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

async function sftpReadFile(sftp: SFTPWrapper, remotePath: string): Promise<string> {
  const handle = await sftpOpen(sftp, remotePath, 'r')
  const chunks: Buffer[] = []
  let position = 0

  try {
    while (true) {
      const chunk = Buffer.allocUnsafe(4096)
      const bytesRead = await sftpRead(sftp, handle, chunk, 0, chunk.byteLength, position)
      if (bytesRead <= 0) {
        break
      }

      chunks.push(chunk.subarray(0, bytesRead))
      position += bytesRead

      if (bytesRead < chunk.byteLength) {
        break
      }
    }

    return Buffer.concat(chunks).toString('utf8')
  } finally {
    await sftpClose(sftp, handle).catch(() => undefined)
  }
}

async function sftpWriteFile(
  sftp: SFTPWrapper,
  remotePath: string,
  contents: string
): Promise<void> {
  const handle = await sftpOpen(sftp, remotePath, 'w')
  const buffer = Buffer.from(contents, 'utf8')
  let position = 0

  try {
    while (position < buffer.byteLength) {
      const length = Math.min(32768, buffer.byteLength - position)
      await sftpWrite(sftp, handle, buffer, position, length, position)
      position += length
    }
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
    if (markers.has(candidate as (typeof RESOURCE_MONITOR_MARKERS)[keyof typeof RESOURCE_MONITOR_MARKERS])) {
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

class ConnectionFailure extends Error {
  constructor(
    readonly code: SessionConnectFailureCode,
    message: string,
    readonly serverId?: string,
    readonly secretKind?: SecretKind
  ) {
    super(message)
    this.name = 'ConnectionFailure'
  }
}

function getSecretKindForServer(server: Server): SecretKind {
  return server.authType === 'password' ? 'password' : 'passphrase'
}

function isAuthenticationFailure(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const level = (error as Error & { level?: string }).level
  if (level === 'client-authentication') {
    return true
  }

  return /all configured authentication methods failed|permission denied/i.test(error.message)
}

export class SessionManager {
  private readonly sessions = new Map<string, SessionRuntime>()
  private readonly history = new Map<string, ConnectionRequest>()
  private readonly portForwardSnapshots = new Map<string, PortForwardRule[]>()
  private readonly resourceCpuBaselines = new Map<string, CpuTimesSample>()
  private readonly resourceNetworkBaselines = new Map<string, NetworkBytesSample>()

  constructor(
    private readonly database: DatabaseService,
    private readonly secureStore: SecureStoreService,
    private readonly getWindow: WindowProvider,
    private readonly emitToRenderer: <T extends keyof EventMap>(
      channel: T,
      payload: EventMap[T]
    ) => void,
    private readonly t: MainTranslator
  ) {}

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

    try {
      const result = await execCommand(runtime.client, LINUX_RESOURCE_SNAPSHOT_COMMAND)
      if ((result.code ?? 0) !== 0) {
        throw new Error(SESSION_RESOURCE_MONITOR_UNAVAILABLE)
      }

      const sections = parseSectionedOutput(result.stdout)
      const platform = sections.get(RESOURCE_MONITOR_MARKERS.platform)
      if (platform !== 'Linux') {
        throw new Error(SESSION_RESOURCE_MONITOR_LINUX_ONLY)
      }

      const sampledAt = now()
      const sampledAtMs = Date.parse(sampledAt)
      const cpuTimes = parseCpuTimes(sections.get(RESOURCE_MONITOR_MARKERS.procStat) ?? '')
      const memory = parseMemInfo(sections.get(RESOURCE_MONITOR_MARKERS.procMeminfo) ?? '')
      const networkBytes = parseNetworkBytes(sections.get(RESOURCE_MONITOR_MARKERS.procNetDev) ?? '')
      const disk = parseDiskUsage(sections.get(RESOURCE_MONITOR_MARKERS.df) ?? '')

      const previousCpuTimes = this.resourceCpuBaselines.get(sessionId)
      this.resourceCpuBaselines.set(sessionId, cpuTimes)
      const previousNetworkBytes = this.resourceNetworkBaselines.get(sessionId)
      this.resourceNetworkBaselines.set(sessionId, {
        ...networkBytes,
        sampledAt: sampledAtMs
      })

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
        cpu: {
          usagePercent: cpuUsagePercent
        },
        disk,
        memory,
        network: {
          rxBytesPerSecond,
          txBytesPerSecond
        },
        platform: 'linux',
        sampledAt,
        sessionId
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === SESSION_RESOURCE_MONITOR_LINUX_ONLY ||
          error.message === SESSION_RESOURCE_MONITOR_UNAVAILABLE)
      ) {
        throw error
      }

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
    const jumpServer = this.resolveJumpServer(server)
    const upstreamClients: Client[] = []
    let client: Client | null = null

    try {
      this.emitConnectionPhase(sessionId, 'handshake')

      let targetSocket: ClientChannel | undefined

      if (jumpServer) {
        const jumpAuth = await this.resolveConnectionAuth(jumpServer, request)
        const jumpClient = await this.connectToServer(jumpServer, jumpAuth)
        upstreamClients.push(jumpClient)
        targetSocket = await connectForwardOut(jumpClient, '127.0.0.1', 0, server.host, server.port)
      }

      const targetAuth = await this.resolveConnectionAuth(server, request)
      client = await this.connectToServer(server, targetAuth, targetSocket)

      this.emitConnectionPhase(sessionId, 'prepare')
      const [shell, sftp] = await Promise.all([openShell(client), openSftp(client)])
      const currentPath = normalizeRemotePath(await sftpRealpath(sftp, '.').catch(() => '/'))
      await this.detectAndStoreServerBrand(server, sftp)
      const summary: SessionSummary = {
        ...baseSummary,
        status: 'ready',
        currentPath
      }

      this.emitConnectionPhase(sessionId, 'attach')

      const runtime: SessionRuntime = {
        sessionId,
        client,
        upstreamClients,
        shell,
        sftp,
        summary,
        portForwards: new Map()
      }

      shell.on('data', (chunk: Buffer | string) => {
        this.emitToRenderer('sessions:data', this.withObservableMetadata(sessionId, {
          sessionId,
          data: chunk.toString()
        }))
      })
      shell.stderr.on('data', (chunk: Buffer | string) => {
        this.emitToRenderer('sessions:data', this.withObservableMetadata(sessionId, {
          sessionId,
          data: chunk.toString()
        }))
      })
      shell.on('close', (code?: number, signal?: string) => {
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

  async write(sessionId: string, data: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    runtime.shell.write(data)
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

  async readFile(sessionId: string, remotePath: string): Promise<string> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const stats = await sftpStat(runtime.sftp, normalized)

    if (stats.isDirectory()) {
      throw new Error(`Remote path is a directory: ${normalized}`)
    }

    return sftpReadFile(runtime.sftp, normalized)
  }

  async writeFile(sessionId: string, remotePath: string, contents: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    await sftpWriteFile(runtime.sftp, normalized, contents)
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

    for (const localPath of uniqueLocalPaths) {
      const remotePath = posix.join(normalizedTargetPath, basename(localPath))
      await this.uploadLocalEntry(sessionId, runtime.sftp, localPath, remotePath)
    }
  }

  async downloadFile(sessionId: string, remotePath: string): Promise<void> {
    const runtime = this.requireSession(sessionId)
    const normalized = normalizeRemotePath(remotePath)
    const window = this.getWindow()
    const fileName = path.posix.basename(normalized)
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

    await new Promise<void>((resolve, reject) => {
      runtime.sftp.fastGet(
        normalized,
        saveResult.filePath as string,
        {
          step: (transferred, _chunk, total) => {
            this.emitToRenderer('sftp:transfer', this.withObservableMetadata(sessionId, {
              sessionId,
              direction: 'download',
              fileName,
              localPath: saveResult.filePath as string,
              remotePath: normalized,
              transferred,
              total,
              status: 'running'
            }))
          }
        },
        (error) => {
          if (error) {
            this.emitToRenderer('sftp:transfer', this.withObservableMetadata(sessionId, {
              sessionId,
              direction: 'download',
              fileName,
              localPath: saveResult.filePath as string,
              remotePath: normalized,
              transferred: 0,
              total: 0,
              status: 'error',
              error: error.message
            }))
            reject(error)
            return
          }

          this.emitToRenderer('sftp:transfer', this.withObservableMetadata(sessionId, {
            sessionId,
            direction: 'download',
            fileName,
            localPath: saveResult.filePath as string,
            remotePath: normalized,
            transferred: 1,
            total: 1,
            status: 'completed'
          }))
          resolve()
        }
      )
    })
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

  private resolveJumpServer(server: Server): Server | null {
    if (!server.jumpServerId) {
      return null
    }

    const jumpServer = this.database.getServerById(server.jumpServerId)
    if (!jumpServer) {
      throw new ConnectionFailure('connection_failed', this.t('errors.jumpServerNotFound'))
    }

    if (jumpServer.id === server.id || jumpServer.jumpServerId) {
      throw new ConnectionFailure('connection_failed', this.t('errors.jumpServerChainUnsupported'))
    }

    return jumpServer
  }

  private async resolveConnectionAuth(
    server: Server,
    request: ConnectionRequest
  ): Promise<{
    password?: string
    passphrase?: string
    privateKey?: string
  }> {
    const requestSecrets = request.secrets?.[server.id]
    const password =
      requestSecrets?.password ?? (await this.secureStore.getSecret(server.id, 'password')) ?? undefined
    const passphrase =
      requestSecrets?.passphrase ??
      (await this.secureStore.getSecret(server.id, 'passphrase')) ??
      undefined

    if (server.authType === 'password' && !password) {
      throw new ConnectionFailure(
        'secret_required',
        this.t('errors.passwordRequired'),
        server.id,
        'password'
      )
    }

    let privateKey: string | undefined
    if (server.authType === 'privateKey') {
      const storedPrivateKey = this.database.getServerPrivateKey(server.id)
      if (storedPrivateKey?.trim()) {
        privateKey = storedPrivateKey
      } else if (server.privateKeyPath) {
        privateKey = await fs.readFile(server.privateKeyPath, 'utf8')
      }

      if (!privateKey) {
        throw new ConnectionFailure('connection_failed', this.t('errors.privateKeyMissing'))
      }
    }

    return {
      password,
      passphrase,
      privateKey
    }
  }

  private createConnectConfig(
    server: Server,
    auth: {
      password?: string
      passphrase?: string
      privateKey?: string
    },
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
        this.verifyHost(server.name, server.host, server.port, key)
          .then(verify)
          .catch(() => verify(false))
      }
    }
  }

  private async connectToServer(
    server: Server,
    auth: {
      password?: string
      passphrase?: string
      privateKey?: string
    },
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

  private async detectAndStoreServerBrand(server: Server, sftp: SFTPWrapper): Promise<void> {
    if (server.brandId !== null) {
      return
    }

    let brandId = DEFAULT_SERVER_BRAND_ID

    try {
      for (const remotePath of ['/etc/os-release', '/usr/lib/os-release']) {
        try {
          const contents = await sftpReadFile(sftp, remotePath)
          brandId = resolveServerBrandFromOsRelease(contents)
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
        await this.secureStore.deleteSecret(serverId, 'password')
      } else if (request.rememberPassword && request.password) {
        await this.secureStore.setSecret(serverId, 'password', request.password)
      }

      return
    }

    if (request.rememberPassphrase === false) {
      await this.secureStore.deleteSecret(serverId, 'passphrase')
    } else if (request.rememberPassphrase && request.passphrase) {
      await this.secureStore.setSecret(serverId, 'passphrase', request.passphrase)
    }
  }

  private async uploadLocalEntry(
    sessionId: string,
    sftp: SFTPWrapper,
    localPath: string,
    remotePath: string
  ): Promise<void> {
    const localStats = await fs.lstat(localPath)
    const normalizedRemotePath = normalizeRemotePath(remotePath)

    if (localStats.isDirectory()) {
      await this.ensureRemoteDirectory(sftp, normalizedRemotePath)
      const childNames = await fs.readdir(localPath)

      for (const childName of childNames) {
        await this.uploadLocalEntry(
          sessionId,
          sftp,
          path.join(localPath, childName),
          posix.join(normalizedRemotePath, childName)
        )
      }

      return
    }

    if (!localStats.isFile()) {
      throw new Error(`Unsupported local upload entry: ${localPath}`)
    }

    await this.uploadLocalFile(sessionId, sftp, localPath, normalizedRemotePath, localStats)
  }

  private async uploadLocalFile(
    sessionId: string,
    sftp: SFTPWrapper,
    localPath: string,
    remotePath: string,
    localStats: FsStats
  ): Promise<void> {
    const fileName = basename(localPath)
    let transferred = 0
    let total = Math.max(localStats.size, 1)

    await new Promise<void>((resolve, reject) => {
      sftp.fastPut(
        localPath,
        remotePath,
        {
          step: (nextTransferred, _chunk, nextTotal) => {
            transferred = nextTransferred
            total = Math.max(nextTotal, 1)
            this.emitToRenderer('sftp:transfer', this.withObservableMetadata(sessionId, {
              sessionId,
              direction: 'upload',
              fileName,
              localPath,
              remotePath,
              transferred,
              total,
              status: 'running'
            }))
          }
        },
        (error) => {
          if (error) {
            this.emitToRenderer('sftp:transfer', this.withObservableMetadata(sessionId, {
              sessionId,
              direction: 'upload',
              fileName,
              localPath,
              remotePath,
              transferred,
              total,
              status: 'error',
              error: error.message
            }))
            reject(error)
            return
          }

          this.emitToRenderer('sftp:transfer', this.withObservableMetadata(sessionId, {
            sessionId,
            direction: 'upload',
            fileName,
            localPath,
            remotePath,
            transferred: total,
            total,
            status: 'completed'
          }))
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
    this.emitToRenderer('portForwards:state', this.withObservableMetadata(rule.sessionId, {
      sessionId: rule.sessionId,
      rule: clonePortForwardRule(rule)
    }))
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

  private async verifyHost(
    serverName: string,
    host: string,
    port: number,
    key: Buffer
  ): Promise<boolean> {
    const fingerprint = toFingerprint(key)
    const known = this.database.getKnownHost(host, port)

    if (known?.fingerprint === fingerprint) {
      return true
    }

    const window = this.getWindow()

    if (known && known.fingerprint !== fingerprint) {
      const warningOptions: MessageBoxOptions = {
        type: 'warning',
        buttons: [
          this.t('dialogs.hostChanged.buttons.cancel'),
          this.t('dialogs.hostChanged.buttons.trust')
        ],
        cancelId: 0,
        defaultId: 0,
        title: this.t('dialogs.hostChanged.title'),
        message: this.t('dialogs.hostChanged.message', { serverName }),
        detail: this.t('dialogs.hostChanged.detail', {
          fingerprint,
          knownFingerprint: known.fingerprint
        })
      }
      const changed = window
        ? await dialog.showMessageBox(window, warningOptions)
        : await dialog.showMessageBox(warningOptions)

      if (changed.response !== 1) {
        return false
      }
    } else {
      const trustOptions: MessageBoxOptions = {
        type: 'question',
        buttons: [
          this.t('dialogs.hostFirstSeen.buttons.reject'),
          this.t('dialogs.hostFirstSeen.buttons.trust')
        ],
        cancelId: 0,
        defaultId: 1,
        title: this.t('dialogs.hostFirstSeen.title'),
        message: this.t('dialogs.hostFirstSeen.message', { serverName }),
        detail: this.t('dialogs.hostFirstSeen.detail', { fingerprint, host, port })
      }
      const firstTrust = window
        ? await dialog.showMessageBox(window, trustOptions)
        : await dialog.showMessageBox(trustOptions)

      if (firstTrust.response !== 1) {
        return false
      }
    }

    this.database.upsertKnownHost({
      host,
      port,
      algorithm: 'sha256',
      fingerprint,
      verifiedAt: now()
    })

    return true
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
    this.emitToRenderer('sessions:state', this.withObservableMetadata(sessionId, {
      sessionId,
      status,
      phase,
      message
    }))
  }

  private withObservableMetadata<TPayload extends object>(correlationId: string, payload: TPayload) {
    return {
      ...payload,
      correlationId,
      source: 'main' as const,
      timestamp: now()
    }
  }
}
