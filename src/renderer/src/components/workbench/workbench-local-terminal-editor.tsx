import { memo, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { localTerminalsClient } from '@/features/local-terminals/api/local-terminals-client'
import { queryKeys } from '@/features/shared/query-keys'
import { settingsClient } from '@/features/settings/api/settings-client'
import { themesClient } from '@/features/themes/api/themes-client'
import { actionIcons } from '@/lib/action-icons'
import { usePrefersDark } from '@/hooks/use-prefers-dark'
import { resolveThemeDefinition } from '@/lib/theme'
import { CommandHistoryPanel } from '@/components/workbench/command-history-panel'
import { TerminalSurface } from '@/components/terminal-surface'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { Button } from '@/components/ui/button'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup
} from '@/components/ui/resizable'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'

interface WorkbenchLocalTerminalEditorProps {
  terminalId: string
  active?: boolean
}

function WorkbenchLocalTerminalEditorImpl({
  terminalId,
  active = true
}: WorkbenchLocalTerminalEditorProps) {
  const { t } = useTranslation()
  const prefersDark = usePrefersDark()
  const { closeLocalTerminal } = useWorkbenchContext()
  const [historyOpen, setHistoryOpen] = useState(false)
  const terminal = useLocalTerminalsStore(
    useShallow((state) => state.tabs.find((tab) => tab.terminalId === terminalId) ?? null)
  )
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsClient.get(),
    initialData: DEFAULT_APP_SETTINGS
  })
  const themesQuery = useQuery({
    queryKey: queryKeys.themes,
    queryFn: () => themesClient.list()
  })
  const CloseIcon = actionIcons.close

  const transport = useMemo(
    () => ({
      onData: (callback: (data: string) => void) =>
        localTerminalsClient.onData(terminalId, (event) => {
          callback(event.data)
        }),
      resize: (columns: number, rows: number) =>
        localTerminalsClient.resize(terminalId, columns, rows),
      write: (data: string) => localTerminalsClient.write(terminalId, data)
    }),
    [terminalId]
  )

  if (!terminal) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--workbench-editor)] px-6">
        <div className="max-w-md border border-[var(--workbench-border)] px-8 py-10 text-center">
          <div className="text-lg font-semibold text-foreground">
            {t('workbench.localTerminal.closed.title')}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            {t('workbench.localTerminal.closed.description')}
          </div>
        </div>
      </div>
    )
  }

  const resolvedTheme = resolveThemeDefinition(
    settingsQuery.data.theme,
    themesQuery.data ?? [],
    prefersDark
  )

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-[var(--workbench-border)] px-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{terminal.title}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {terminal.shell} · {terminal.cwd}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-[var(--workbench-border)] bg-[var(--workbench-input)] px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t(`workbench.localTerminal.status.${terminal.status}`)}
          </span>
          <Button
            variant={historyOpen ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setHistoryOpen((prev) => !prev)}
            title={t('workbench.commandHistory.toggleButton')}
            aria-label={t('workbench.commandHistory.toggleButton')}
          >
            <History className="size-4" />
            {t('workbench.commandHistory.title')}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => void closeLocalTerminal(terminalId)}>
            <CloseIcon className="size-4" />
            {t('common.actions.close')}
          </Button>
        </div>
      </div>

      {terminal.status !== 'running' ? (
        <div className="border-b border-[var(--workbench-border)] bg-[var(--workbench-input)] px-4 py-3">
          <div className="text-sm font-medium text-foreground">
            {t('workbench.localTerminal.exited.title')}
          </div>
          <div className="text-xs text-muted-foreground">
            {terminal.lastMessage ?? t('workbench.localTerminal.exited.description')}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        {historyOpen ? (
          <ResizablePanelGroup className="h-full" orientation="horizontal">
            <ResizablePanel
              key={`local-terminal-${terminalId}`}
              id={`local-terminal-${terminalId}`}
              minSize="320px"
            >
              <div className="h-full min-w-0 p-3">
                <TerminalSurface
                  active={active}
                  settings={settingsQuery.data}
                  theme={resolvedTheme}
                  transport={transport}
                />
              </div>
            </ResizablePanel>
            <ResizableHandle
              withHandle
              className="bg-[var(--workbench-border)] data-[resize-handle-state=drag]:bg-[var(--workbench-active)]"
            />
            <ResizablePanel
              key={`local-history-${terminalId}`}
              id={`local-history-${terminalId}`}
              defaultSize="360px"
              minSize="280px"
              maxSize="55%"
            >
              <div className="h-full min-w-0 bg-[var(--workbench-sidebar)] p-3">
                <CommandHistoryPanel
                  scope={{ kind: 'local' }}
                  onInsertCommand={(text) => localTerminalsClient.write(terminalId, text)}
                  onClose={() => setHistoryOpen(false)}
                  className="h-full overflow-hidden bg-[var(--workbench-sidebar)]"
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <div className="h-full p-3">
            <TerminalSurface
              active={active}
              settings={settingsQuery.data}
              theme={resolvedTheme}
              transport={transport}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export const WorkbenchLocalTerminalEditor = memo(WorkbenchLocalTerminalEditorImpl)
WorkbenchLocalTerminalEditor.displayName = 'WorkbenchLocalTerminalEditor'
