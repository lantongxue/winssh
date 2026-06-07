import { SESSION_RESOURCE_MONITOR_UNAVAILABLE, type SessionResourceSnapshot } from '@shared/types'
import type { Client } from 'ssh2'
import { execCommand } from './session-helpers'

interface CpuTimesSample {
  idle: number
  total: number
}

interface NetworkBytesSample {
  rxBytes: number
  sampledAt: number
  txBytes: number
}

export const RESOURCE_MONITOR_MARKERS = {
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

function now() {
  return new Date().toISOString()
}

export class ResourceMonitorService {
  private readonly resourceCpuBaselines = new Map<string, CpuTimesSample>()
  private readonly resourceNetworkBaselines = new Map<string, NetworkBytesSample>()

  deleteSession(sessionId: string): void {
    this.resourceCpuBaselines.delete(sessionId)
    this.resourceNetworkBaselines.delete(sessionId)
  }

  clearAllBaselines(): void {
    this.resourceCpuBaselines.clear()
    this.resourceNetworkBaselines.clear()
  }

  hasCpuBaseline(sessionId: string): boolean {
    return this.resourceCpuBaselines.has(sessionId)
  }

  hasNetworkBaseline(sessionId: string): boolean {
    return this.resourceNetworkBaselines.has(sessionId)
  }

  async getResourceSnapshot(client: Client, sessionId: string): Promise<SessionResourceSnapshot> {
    // Phase 1: Latency measurement (cross-platform)
    const latencyStart = Date.now()
    try {
      const latencyResult = await execCommand(
        client,
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
          const resourceResult = await execCommand(client, LINUX_RESOURCE_SNAPSHOT_COMMAND)
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
    } catch {
      // Phase 1 failed - connection is broken
      throw new Error(SESSION_RESOURCE_MONITOR_UNAVAILABLE)
    }
  }
}
