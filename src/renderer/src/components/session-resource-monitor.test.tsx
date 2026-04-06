import { act, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SESSION_RESOURCE_MONITOR_LINUX_ONLY,
  type SessionResourceSnapshot
} from '@shared/types'
import i18n from '@/i18n'
import { SessionResourceMonitor } from '@/components/session-resource-monitor'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import type { SessionTab } from '@/store/sessions-store'

const baseSession: SessionTab = {
  connectedAt: new Date().toISOString(),
  currentPath: '/root',
  host: '127.0.0.1',
  port: 22,
  serverId: 'server-1',
  serverName: 'alpha',
  sessionId: 'session-1',
  status: 'ready'
}

function createSnapshot(): SessionResourceSnapshot {
  return {
    cpu: {
      usagePercent: 42.5
    },
    disk: {
      mountPath: '/',
      totalBytes: 512 * 1024 * 1024 * 1024,
      usedBytes: 256 * 1024 * 1024 * 1024,
      usagePercent: 50
    },
    memory: {
      totalBytes: 8 * 1024 * 1024 * 1024,
      usedBytes: 3 * 1024 * 1024 * 1024,
      usagePercent: 37.5
    },
    network: {
      rxBytesPerSecond: 128 * 1024,
      txBytesPerSecond: 64 * 1024
    },
    platform: 'linux',
    sampledAt: new Date().toISOString(),
    sessionId: 'session-1'
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })
}

function renderMonitor({
  active = true,
  expanded = true,
  queryClient = createQueryClient(),
  session = baseSession
}: {
  active?: boolean
  expanded?: boolean
  queryClient?: QueryClient
  session?: SessionTab
} = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <SessionResourceMonitor
        active={active}
        expanded={expanded}
        session={session}
      />
    </QueryClientProvider>
  )
}

describe('SessionResourceMonitor', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en-US')
    window.winsshApi = createWinsshApiMock()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('polls only while the session tab is active and ready', async () => {
    vi.useFakeTimers()
    const getResourceSnapshot = vi.fn().mockResolvedValue(createSnapshot())
    window.winsshApi = createWinsshApiMock({
      sessions: {
        getResourceSnapshot
      }
    })

    const queryClient = createQueryClient()
    const { rerender } = renderMonitor({ active: false, queryClient })
    expect(getResourceSnapshot).not.toHaveBeenCalled()

    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <SessionResourceMonitor
            active
            expanded
            session={baseSession}
          />
        </QueryClientProvider>
      )
      await Promise.resolve()
    })
    expect(getResourceSnapshot).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(2_100)
      await Promise.resolve()
    })
    expect(getResourceSnapshot).toHaveBeenCalledTimes(2)

    await act(async () => {
      rerender(
        <QueryClientProvider client={queryClient}>
          <SessionResourceMonitor
            active={false}
            expanded
            session={baseSession}
          />
        </QueryClientProvider>
      )
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(2_100)
      await Promise.resolve()
    })

    expect(getResourceSnapshot).toHaveBeenCalledTimes(2)
  })

  it('does not poll when the session is not ready', async () => {
    const getResourceSnapshot = vi.fn().mockResolvedValue(createSnapshot())
    window.winsshApi = createWinsshApiMock({
      sessions: {
        getResourceSnapshot
      }
    })

    renderMonitor({
      session: {
        ...baseSession,
        status: 'connecting'
      }
    })

    expect(getResourceSnapshot).not.toHaveBeenCalled()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })

  it('shows a Linux-only hint for unsupported platforms', async () => {
    window.winsshApi = createWinsshApiMock({
      sessions: {
        getResourceSnapshot: vi
          .fn()
          .mockRejectedValue(new Error(SESSION_RESOURCE_MONITOR_LINUX_ONLY))
      }
    })

    renderMonitor()

    expect(await screen.findByText('Linux only')).toBeInTheDocument()
  })

  it('shows an unavailable hint for sampling failures', async () => {
    window.winsshApi = createWinsshApiMock({
      sessions: {
        getResourceSnapshot: vi.fn().mockRejectedValue(new Error('boom'))
      }
    })

    renderMonitor()

    expect(await screen.findByText('Unavailable')).toBeInTheDocument()
  })
})
