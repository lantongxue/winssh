import { beforeEach, describe, expect, it } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import { WorkbenchTitlebar } from '@/components/workbench/workbench-titlebar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createWinsshApiMock } from '@/test/create-winssh-api'
import { useWorkbenchStore } from '@/store/workbench-store'

function renderTitlebar() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WorkbenchTitlebar />
      </TooltipProvider>
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  await i18n.changeLanguage('en-US')
  useWorkbenchStore.getState().reset()
  window.winsshApi = createWinsshApiMock()
})

describe('WorkbenchTitlebar', () => {
  it('renders the app logo on the left side of the title bar with theme-driven color', () => {
    renderTitlebar()

    expect(screen.getByRole('img', { name: 'WinSSH' })).toHaveStyle('color: var(--workbench-logo)')
    expect(screen.getByRole('button', { name: 'Quick Connect' })).toBeInTheDocument()
  })
})
