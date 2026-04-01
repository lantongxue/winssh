import { useTranslation } from 'react-i18next'
import { formatTime } from '@/i18n/format'
import { actionIcons } from '@/lib/action-icons'
import { workbenchPanels } from '@/lib/workbench'
import { cn } from '@/lib/utils'
import { useWorkbenchStore } from '@/store/workbench-store'
import { Button } from '@/components/ui/button'

export function WorkbenchPanel() {
  const { t } = useTranslation()
  const activePanelId = useWorkbenchStore((state) => state.activePanelId)
  const outputEntries = useWorkbenchStore((state) => state.outputEntries)
  const problems = useWorkbenchStore((state) => state.problems)
  const transferEntries = useWorkbenchStore((state) => state.transferEntries)
  const clearProblems = useWorkbenchStore((state) => state.clearProblems)
  const clearTransfers = useWorkbenchStore((state) => state.clearTransfers)
  const setActivePanel = useWorkbenchStore((state) => state.setActivePanel)
  const setPanelOpen = useWorkbenchStore((state) => state.setPanelOpen)
  const ClearIcon = actionIcons.clear
  const CloseIcon = actionIcons.close

  return (
    <section className="flex h-full min-h-0 flex-col bg-[var(--workbench-panel)]">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--workbench-border)] px-2">
        <div className="flex min-w-0 items-center">
          {workbenchPanels.map((panel) => (
            <button
              key={panel.id}
              type="button"
              className={cn(
                'rounded-sm px-2.5 py-1 text-[11px] tracking-[0.12em] text-[var(--workbench-muted)] transition-colors hover:bg-[var(--workbench-hover)] hover:text-foreground',
                panel.id === activePanelId && 'bg-[var(--workbench-hover)] text-foreground'
              )}
              onClick={() => setActivePanel(panel.id)}
            >
              {t(`workbench.panel.labels.${panel.id}`).toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {activePanelId === 'problems' ? (
            <Button variant="ghost" size="sm" onClick={clearProblems}>
              <ClearIcon className="size-4" />
              {t('workbench.panel.clearProblems')}
            </Button>
          ) : null}
          {activePanelId === 'transfers' ? (
            <Button variant="ghost" size="sm" onClick={clearTransfers}>
              <ClearIcon className="size-4" />
              {t('workbench.panel.clearTransfers')}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded-sm text-[var(--workbench-muted)] hover:bg-[var(--workbench-hover)] hover:text-foreground"
            onClick={() => setPanelOpen(false)}
          >
            <CloseIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {activePanelId === 'output' ? (
          <div className="space-y-px bg-[var(--workbench-border)]">
            {outputEntries.length === 0 ? (
              <div className="bg-[var(--workbench-panel)] px-4 py-6 text-sm text-muted-foreground">
                {t('workbench.panel.empty.output')}
              </div>
            ) : (
              outputEntries.map((entry) => (
                <div key={entry.id} className="bg-[var(--workbench-panel)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-foreground">{entry.message}</div>
                    <div className="text-[11px] text-muted-foreground">{formatTime(entry.createdAt)}</div>
                  </div>
                  {entry.detail ? (
                    <div className="mt-1 text-xs text-muted-foreground">{entry.detail}</div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        ) : null}

        {activePanelId === 'transfers' ? (
          <div className="space-y-px bg-[var(--workbench-border)]">
            {transferEntries.length === 0 ? (
              <div className="bg-[var(--workbench-panel)] px-4 py-6 text-sm text-muted-foreground">
                {t('workbench.panel.empty.transfers')}
              </div>
            ) : (
              transferEntries.map((entry) => {
                const ratio = entry.total > 0 ? Math.min(entry.transferred / entry.total, 1) : 0
                return (
                  <div key={entry.id} className="bg-[var(--workbench-panel)] px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-foreground">{entry.fileName}</div>
                      <div className="text-[11px] uppercase text-muted-foreground">
                        {t(`workbench.panel.transfer.${entry.direction}`)}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{entry.remotePath}</div>
                    <div className="mt-3 h-1.5 rounded-full bg-[var(--workbench-hover)]">
                      <div
                        className="h-full rounded-full bg-[var(--workbench-active)]"
                        style={{ width: `${ratio * 100}%` }}
                      />
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      {entry.transferred} / {entry.total || t('workbench.panel.transfer.unknown')} ·{' '}
                      {t(`workbench.panel.transfer.${entry.status}`)}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        ) : null}

        {activePanelId === 'problems' ? (
          <div className="space-y-px bg-[var(--workbench-border)]">
            {problems.length === 0 ? (
              <div className="bg-[var(--workbench-panel)] px-4 py-6 text-sm text-muted-foreground">
                {t('workbench.panel.empty.problems')}
              </div>
            ) : (
              problems.map((problem) => (
                <div key={problem.id} className="bg-[var(--workbench-panel)] px-4 py-3 text-sm">
                  <div className="font-medium text-foreground">{problem.title}</div>
                  {problem.detail ? (
                    <div className="mt-1 text-xs text-muted-foreground">{problem.detail}</div>
                  ) : null}
                  <div className="mt-2 text-[11px] uppercase text-muted-foreground">
                    {t(`workbench.panel.severities.${problem.severity}`)}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
