import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ShieldCheck } from 'lucide-react'
import { queryKeys } from '@/features/shared/query-keys'
import { settingsClient } from '@/features/settings/api/settings-client'
import { serversClient } from '@/features/servers/api/servers-client'
import { useAwayReminderStore } from '@/store/away-reminder-store'
import { useSessionsStore } from '@/store/sessions-store'
import { useLocalTerminalsStore } from '@/store/local-terminals-store'
import { useWorkbenchStore } from '@/store/workbench-store'
import { Button } from '@/components/ui/button'
import type { Server } from '@shared/types'

export function WorkbenchAwayReminderOverlay() {
  const { t } = useTranslation()

  const overlayVisible = useAwayReminderStore((state) => state.overlayVisible)
  const dismissOverlay = useAwayReminderStore((state) => state.dismissOverlay)
  const openDocuments = useWorkbenchStore((state) => state.openDocuments)
  const sessionTabs = useSessionsStore((state) => state.tabs)
  const localTerminalTabs = useLocalTerminalsStore((state) => state.tabs)

  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsClient.get()
  })

  const serversQuery = useQuery({
    queryKey: queryKeys.servers,
    queryFn: () => serversClient.list()
  })

  const awayReminderEnabled = settingsQuery.data?.awayReminderEnabled ?? true

  const shouldShowOverlay = overlayVisible && awayReminderEnabled && openDocuments.length > 0

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter') {
        dismissOverlay()
      }
    },
    [dismissOverlay]
  )

  if (!shouldShowOverlay) {
    return null
  }

  const servers = (serversQuery.data ?? []) as Server[]
  const serverMap = new Map(servers.map((server) => [server.id, server]))

  const identityItems = openDocuments
    .filter(
      (document) => document.kind === 'session-editor' || document.kind === 'local-terminal-editor'
    )
    .map((document) => {
      if (document.kind === 'session-editor') {
        const sessionTab = sessionTabs.find((tab) => tab.sessionId === document.sessionId)
        const server = serverMap.get(sessionTab?.serverId ?? '')
        const username = server?.username ?? ''
        const serverName = sessionTab?.serverName ?? ''
        const host = sessionTab?.host ?? ''
        const port = sessionTab?.port ?? 22

        return {
          id: document.id,
          type: 'ssh' as const,
          username,
          serverName,
          host,
          port
        }
      }

      const localTerminalTab = localTerminalTabs.find(
        (tab) => tab.terminalId === document.terminalId
      )
      const shell = localTerminalTab?.shell ?? ''

      return {
        id: document.id,
        type: 'local' as const,
        shell
      }
    })

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[var(--terminal-overlay-backdrop)] backdrop-blur-[var(--terminal-overlay-backdrop-blur)]"
      onKeyDown={handleKeyDown}
    >
      <div className="flex w-[min(560px,calc(100%-2rem))] flex-col gap-4 rounded-[var(--terminal-overlay-radius)] border border-[var(--terminal-overlay-border)] bg-[var(--terminal-overlay-panel)] px-6 py-5 text-left shadow-xl">
        <div className="flex items-start gap-4">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[var(--terminal-overlay-accent-soft)] text-[var(--terminal-overlay-accent)]">
            <ShieldCheck className="size-5" />
          </div>
          <div className="space-y-2">
            <div className="font-medium text-[var(--terminal-overlay-text)]">
              {t('workbench.awayReminder.title')}
            </div>
            <div className="text-sm text-[var(--terminal-overlay-muted)]">
              {t('workbench.awayReminder.description')}
            </div>
          </div>
        </div>

        {identityItems.length > 0 ? (
          <div className="rounded-[calc(var(--terminal-overlay-radius)-1px)] border border-[var(--terminal-overlay-border)] bg-[color-mix(in_srgb,var(--terminal-overlay-panel)_82%,transparent)] p-3">
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--terminal-overlay-label)]">
              {t('workbench.awayReminder.serverIdentity')}
            </div>
            <div className="mt-2 space-y-2">
              {identityItems.map((item) => {
                if (item.type === 'ssh') {
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-1 py-1"
                    >
                      {item.serverName ? (
                        <div className="flex items-center gap-1.5 text-base font-bold text-[var(--terminal-overlay-text)]">
                          <span>{t('workbench.awayReminder.currentSession')}</span>
                          <span className="text-[var(--terminal-overlay-accent)]">
                            {item.serverName}
                          </span>
                        </div>
                      ) : (
                        <div className="text-base font-bold text-[var(--terminal-overlay-text)]">
                          {item.username}@{item.host}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-base font-bold text-[var(--terminal-overlay-text)]">
                        <span>{t('workbench.awayReminder.sshInfo')}</span>
                        {item.serverName && (
                          <>
                            <span className="text-[var(--terminal-overlay-accent)]">
                              {item.username}
                            </span>
                            <span className="text-[var(--terminal-overlay-accent)]">
                              @{item.host}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-1 border-l-2 border-[var(--terminal-overlay-border)] pl-3 py-1"
                  >
                    <div className="text-base font-bold text-[var(--terminal-overlay-text)]">
                      {item.shell}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-[var(--terminal-overlay-muted)]">
                      <span className="text-[var(--terminal-overlay-label)]">
                        {t('workbench.awayReminder.localTerminal')}
                      </span>
                      <span>•</span>
                      <span className="text-[var(--terminal-overlay-label)]">
                        {t('workbench.awayReminder.shellType')}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        <Button onClick={dismissOverlay}>{t('workbench.awayReminder.confirmButton')}</Button>
      </div>
    </div>
  )
}
