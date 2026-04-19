import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateState } from '@shared/types'
import { WorkbenchActivityBar } from '@/components/workbench/workbench-activity-bar'
import { WorkbenchProvider } from '@/components/workbench/workbench-context'
import { TooltipProvider } from '@/components/ui/tooltip'
import i18n from '@/i18n'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'
import { useSessionsStore } from '@/store/sessions-store'
import { useWorkbenchStore } from '@/store/workbench-store'
import { createWinsshApiMock } from '@/test/create-winssh-api'

function renderActivityBar() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  const view = render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WorkbenchProvider>
          <WorkbenchActivityBar />
        </WorkbenchProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )

  return {
    queryClient,
    ...view
  }
}

function openSettingsMenu() {
  fireEvent.pointerDown(screen.getByTestId('activity-settings-menu'), {
    button: 0,
    ctrlKey: false
  })
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  useSessionsStore.getState().clear()
  useLocalTerminalsStore.getState().clear()

  window.winsshApi = createWinsshApiMock({
    servers: {
      list: vi.fn().mockResolvedValue([])
    }
  })
})

describe('WorkbenchActivityBar', () => {
  it('keeps settings out of the primary activity list and renders a bottom menu button', () => {
    renderActivityBar()

    expect(screen.getByTestId('activity-explorer')).toBeInTheDocument()
    expect(screen.getByTestId('activity-terminal')).toBeInTheDocument()
    expect(screen.queryByTestId('activity-settings')).not.toBeInTheDocument()
    expect(screen.getByTestId('activity-settings-menu')).toBeInTheDocument()
  })

  it('opens the settings editor from the bottom settings menu', async () => {
    renderActivityBar()

    openSettingsMenu()
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Settings' }))

    await waitFor(() => {
      const state = useWorkbenchStore.getState()

      expect(state.activeActivityId).toBe('settings')
      expect(state.activeDocumentId).toBe('settings-editor')
    })
  })

  it('checks for updates from the bottom settings menu', async () => {
    const updateState: UpdateState = {
      autoCheckEnabled: true,
      availableUpdate: null,
      currentVersion: '1.0.0',
      downloadProgressPercent: null,
      errorMessage: null,
      phase: 'not-available',
      supported: true,
      unsupportedReason: null
    }
    const check = vi.fn().mockResolvedValue(updateState)
    const { queryClient } = renderActivityBar()

    window.winsshApi = createWinsshApiMock({
      servers: {
        list: vi.fn().mockResolvedValue([])
      },
      updates: {
        check
      }
    })

    queryClient.setQueryData<UpdateState>(['updates', 'state'], {
      ...updateState,
      phase: 'idle'
    })

    openSettingsMenu()
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Check for Updates' }))

    await waitFor(() => {
      expect(check).toHaveBeenCalledTimes(1)
      expect(useWorkbenchStore.getState().activeDocumentId).toBe('updates-editor')
      expect(queryClient.getQueryData(['updates', 'state'])).toEqual(updateState)
    })
  })
})
