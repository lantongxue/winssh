import { readFile } from 'node:fs/promises'
import { parentPort } from 'node:worker_threads'
import type { SessionResourceSnapshot } from '@shared/types'

type NodePlatform = NodeJS.Platform

export interface ResourceMonitorSnapshotInput {
  sessionId: string
  platform?: NodePlatform
  readTextFile?: (path: string) => Promise<string>
}

type ResourceMonitorWorkerRequest = {
  type: 'snapshot'
  requestId: string
  sessionId: string
  platform?: NodePlatform
}

export async function createResourceMonitorSnapshot(
  input: ResourceMonitorSnapshotInput
): Promise<SessionResourceSnapshot> {
  const platform = toSnapshotPlatform(input.platform ?? process.platform)
  const sampledAt = new Date().toISOString()

  if (platform !== 'linux') {
    return createEmptySnapshot(input.sessionId, sampledAt, platform)
  }

  const readText = input.readTextFile ?? ((path: string) => readFile(path, 'utf8'))
  const [stat, meminfo] = await Promise.all([
    readText('/proc/stat').catch(() => ''),
    readText('/proc/meminfo').catch(() => '')
  ])

  return {
    sessionId: input.sessionId,
    sampledAt,
    platform,
    latency: { rttMs: null },
    cpu: parseCpuSnapshot(stat),
    memory: parseMemorySnapshot(meminfo),
    network: null,
    disk: null
  }
}

function createEmptySnapshot(
  sessionId: string,
  sampledAt: string,
  platform: SessionResourceSnapshot['platform']
): SessionResourceSnapshot {
  return {
    sessionId,
    sampledAt,
    platform,
    latency: { rttMs: null },
    cpu: null,
    memory: null,
    network: null,
    disk: null
  }
}

function toSnapshotPlatform(platform: NodePlatform): SessionResourceSnapshot['platform'] {
  if (platform === 'linux') {
    return 'linux'
  }
  if (platform === 'darwin') {
    return 'darwin'
  }
  if (platform === 'win32') {
    return 'windows'
  }
  return 'unknown'
}

function parseCpuSnapshot(stat: string): SessionResourceSnapshot['cpu'] {
  const cpuLine = stat
    .split(/\r?\n/)
    .find((line) => line.startsWith('cpu '))
    ?.trim()
  if (!cpuLine) {
    return null
  }

  const values = cpuLine
    .split(/\s+/)
    .slice(1)
    .map((value) => Number.parseInt(value, 10))
    .filter(Number.isFinite)
  if (values.length < 4) {
    return null
  }

  const idle = values[3] + (values[4] ?? 0)
  const total = values.reduce((sum, value) => sum + value, 0)
  if (total <= 0) {
    return null
  }

  return {
    usagePercent: Number((((total - idle) / total) * 100).toFixed(1))
  }
}

function parseMemorySnapshot(meminfo: string): SessionResourceSnapshot['memory'] {
  const values = new Map<string, number>()
  for (const line of meminfo.split(/\r?\n/)) {
    const match = /^([A-Za-z_()]+):\s+(\d+)\s+kB$/.exec(line)
    if (match) {
      values.set(match[1], Number.parseInt(match[2], 10) * 1024)
    }
  }

  const totalBytes = values.get('MemTotal')
  const availableBytes = values.get('MemAvailable')
  if (!totalBytes || availableBytes === undefined) {
    return null
  }

  const usedBytes = Math.max(0, totalBytes - availableBytes)
  return {
    usedBytes,
    totalBytes,
    usagePercent: Number(((usedBytes / totalBytes) * 100).toFixed(1))
  }
}

if (parentPort) {
  const port = parentPort
  port.on('message', (message: ResourceMonitorWorkerRequest) => {
    if (message.type !== 'snapshot') {
      return
    }

    void createResourceMonitorSnapshot({
      sessionId: message.sessionId,
      platform: message.platform
    })
      .then((result) => {
        port.postMessage({ type: 'ack', requestId: message.requestId, ok: true, result })
      })
      .catch((error) => {
        port.postMessage({
          type: 'ack',
          requestId: message.requestId,
          ok: false,
          message: error instanceof Error ? error.message : 'Resource snapshot failed'
        })
      })
  })
}
