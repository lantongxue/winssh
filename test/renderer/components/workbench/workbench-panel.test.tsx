import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import { TooltipProvider } from '@/components/ui/tooltip'
import { WorkbenchPanel } from '@/components/workbench/workbench-panel'
import { useWorkbenchStore } from '@/store/workbench-store'

describe('WorkbenchPanel', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en-US')
    localStorage.clear()
    useWorkbenchStore.getState().reset()
  })

  it('renders transfer sizes using readable units', async () => {
    const store = useWorkbenchStore.getState()

    store.setActivePanel('transfers')
    store.upsertTransfer({
      direction: 'upload',
      fileName: 'archive.tar.gz',
      remotePath: '/var/www/archive.tar.gz',
      sessionId: 'session-1',
      status: 'running',
      total: 5 * 1024 * 1024,
      transferred: 1536
    })

    render(
      <TooltipProvider>
        <WorkbenchPanel />
      </TooltipProvider>
    )

    expect(screen.getByText('archive.tar.gz')).toBeInTheDocument()
    expect(screen.getByText(/1\.50 KB \/ 5\.00 MB .* Running/)).toBeInTheDocument()
  })

  it('renders download batch progress at the top of transfers', async () => {
    const store = useWorkbenchStore.getState()

    store.setActivePanel('transfers')
    store.upsertTransfer({
      batchId: 'download:session-1:test',
      batchTotal: 1,
      direction: 'download',
      fileName: 'backup.zip',
      localPath: 'C:\\Users\\mrkin\\Downloads\\backup.zip',
      remotePath: '/var/www/backup.zip',
      sessionId: 'session-1',
      status: 'running',
      total: 1024,
      transferred: 512
    })

    render(
      <TooltipProvider>
        <WorkbenchPanel />
      </TooltipProvider>
    )

    expect(screen.getByText('0 / 1 files')).toBeInTheDocument()
    expect(screen.getByText('backup.zip')).toBeInTheDocument()
  })
})
