import { memo, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'
import { actionIcons } from '@/lib/action-icons'
import { usePrefersDark } from '@/hooks/use-prefers-dark'
import { resolveThemeDefinition } from '@/lib/theme'
import { TerminalSurface } from '@/components/terminal-surface'
import { useWorkbenchContext } from '@/components/workbench/workbench-context'
import { Button } from '@/components/ui/button'
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
  const terminal = useLocalTerminalsStore(
    (state) => state.tabs.find((tab) => tab.terminalId === terminalId) ?? null
  )
  const settingsQuery = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.winsshApi.settings.get(),
    initialData: DEFAULT_APP_SETTINGS
  })
  const themesQuery = useQuery({
    queryKey: ['themes'],
    queryFn: () => window.winsshApi.themes.list()
  })
  const CloseIcon = actionIcons.close

  const transport = useMemo(
    () => ({
      onData: (callback: (data: string) => void) =>
        window.winsshApi.localTerminals.onData((event) => {
          if (event.terminalId === terminalId) {
            callback(event.data)
          }
        }),
      resize: (columns: number, rows: number) =>
        window.winsshApi.localTerminals.resize(terminalId, columns, rows),
      write: (data: string) => window.winsshApi.localTerminals.write(terminalId, data)
    }),
    [terminalId]
  )

  if (!terminal) {
    return (
      <div className="liquid-glass-page flex h-full items-center justify-center bg-[var(--workbench-editor)] px-6">
        <div className="liquid-glass-hero max-w-md border border-[var(--workbench-border)] px-8 py-10 text-center">
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
    <div className="liquid-glass-page flex h-full min-h-0 flex-col bg-[var(--workbench-editor)]">
      <div className="liquid-glass-toolbar flex h-10 shrink-0 items-center justify-between border-b border-[var(--workbench-border)] px-3">
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

      <div className="min-h-0 flex-1 p-3">
        <TerminalSurface
          active={active}
          settings={settingsQuery.data}
          theme={resolvedTheme}
          transport={transport}
        />
      </div>
    </div>
  )
}

export const WorkbenchLocalTerminalEditor = memo(WorkbenchLocalTerminalEditorImpl)
WorkbenchLocalTerminalEditor.displayName = 'WorkbenchLocalTerminalEditor'
