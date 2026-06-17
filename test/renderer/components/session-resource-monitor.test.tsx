import { act, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type SessionResourceSnapshot } from '@shared/types'
import i18n from '@/i18n'
import { SessionResourceMonitor } from '@/components/session-resource-monitor'
import { createWinsshApiMock } from '@test/renderer/helpers/create-winssh-api'
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
    latency: {
      rttMs: 23
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
      <SessionResourceMonitor active={active} expanded={expanded} session={session} />
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
          <SessionResourceMonitor active expanded session={baseSession} />
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
          <SessionResourceMonitor active={false} expanded session={baseSession} />
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
        getResourceSnapshot: vi.fn().mockResolvedValue({
          sessionId: 'session-1',
          sampledAt: new Date().toISOString(),
          platform: 'darwin',
          latency: { rttMs: 45 },
          cpu: null,
          memory: null,
          network: null,
          disk: null
        })
      }
    })

    renderMonitor()

    expect(await screen.findByText('Linux only')).toBeInTheDocument()
    expect(screen.getByText('45 ms')).toBeInTheDocument()
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

  it('keeps the monitor strip right-aligned while remaining scrollable', async () => {
    renderMonitor()

    const monitor = screen.getByTestId('session-resource-monitor')
    const content = screen.getByTestId('session-resource-monitor-content')
    const viewport = screen.getByTestId('session-resource-monitor-viewport')
    expect(monitor.className).toContain('justify-end')
    expect(monitor.className).not.toContain('justify-center')
    expect(content.className).toContain('w-full')
    expect(content.className).toContain('max-w-[920px]')
    expect(content.className).not.toContain('flex-1')
    expect(viewport.className).toContain('min-w-full')
    expect(viewport.className).toContain('justify-end')
    expect(await screen.findByText('CPU')).toBeInTheDocument()
  })

  it('renders loading placeholders inside matching metric pill shells', async () => {
    renderMonitor({ active: false })

    const placeholders = screen.getAllByTestId('session-resource-monitor-skeleton-pill')
    expect(placeholders).toHaveLength(5)

    for (const placeholder of placeholders) {
      expect(placeholder.className).toContain('h-8')
      expect(placeholder.className).toContain('border')
      expect(placeholder.className).toContain('items-center')
      expect(placeholder.querySelector('[data-slot="skeleton"]')).toBeInTheDocument()
    }
  })
})
