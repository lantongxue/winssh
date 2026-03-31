import { X } from 'lucide-react'
import { workbenchPanels } from '@/lib/workbench'
import { cn } from '@/lib/utils'
import { useWorkbenchStore } from '@/store/workbench-store'
import { Button } from '@/components/ui/button'

export function WorkbenchPanel() {
  const activePanelId = useWorkbenchStore((state) => state.activePanelId)
  const outputEntries = useWorkbenchStore((state) => state.outputEntries)
  const problems = useWorkbenchStore((state) => state.problems)
  const transferEntries = useWorkbenchStore((state) => state.transferEntries)
  const clearProblems = useWorkbenchStore((state) => state.clearProblems)
  const clearTransfers = useWorkbenchStore((state) => state.clearTransfers)
  const setActivePanel = useWorkbenchStore((state) => state.setActivePanel)
  const setPanelOpen = useWorkbenchStore((state) => state.setPanelOpen)

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
              {panel.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {activePanelId === 'problems' ? (
            <Button variant="ghost" size="sm" onClick={clearProblems}>
              Clear
            </Button>
          ) : null}
          {activePanelId === 'transfers' ? (
            <Button variant="ghost" size="sm" onClick={clearTransfers}>
              Clear
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon-xs"
            className="rounded-sm text-[var(--workbench-muted)] hover:bg-[var(--workbench-hover)] hover:text-foreground"
            onClick={() => setPanelOpen(false)}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {activePanelId === 'output' ? (
          <div className="space-y-px bg-[var(--workbench-border)]">
            {outputEntries.length === 0 ? (
              <div className="bg-[var(--workbench-panel)] px-4 py-6 text-sm text-muted-foreground">
                连接日志和工作台输出会显示在这里。
              </div>
            ) : (
              outputEntries.map((entry) => (
                <div key={entry.id} className="bg-[var(--workbench-panel)] px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-foreground">{entry.message}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleTimeString()}
                    </div>
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
                暂无传输任务。
              </div>
            ) : (
              transferEntries.map((entry) => {
                const ratio = entry.total > 0 ? Math.min(entry.transferred / entry.total, 1) : 0
                return (
                  <div key={entry.id} className="bg-[var(--workbench-panel)] px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-foreground">{entry.fileName}</div>
                      <div className="text-[11px] uppercase text-muted-foreground">
                        {entry.direction}
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
                      {entry.transferred} / {entry.total || 'unknown'} · {entry.status}
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
                当前没有工作台级问题。
              </div>
            ) : (
              problems.map((problem) => (
                <div key={problem.id} className="bg-[var(--workbench-panel)] px-4 py-3 text-sm">
                  <div className="font-medium text-foreground">{problem.title}</div>
                  {problem.detail ? (
                    <div className="mt-1 text-xs text-muted-foreground">{problem.detail}</div>
                  ) : null}
                  <div className="mt-2 text-[11px] uppercase text-muted-foreground">
                    {problem.severity}
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
