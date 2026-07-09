import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { AppFocusEvent, AppActivityEvent } from '@shared/types'
import { systemClient } from '@/features/system/api/system-client'
import { settingsClient } from '@/features/settings/api/settings-client'
import { queryKeys } from '@/features/shared/query-keys'
import { useAwayReminderStore } from '@/store/away-reminder-store'
import { useWorkbenchStore } from '@/store/workbench-store'

export function useAwayDetector() {
  const settingsQuery = useQuery({
    queryKey: queryKeys.settings,
    queryFn: () => settingsClient.get()
  })

  const settingsRef = useRef(settingsQuery.data)
  settingsRef.current = settingsQuery.data

  const prevEnabledRef = useRef<boolean | undefined>(undefined)

  useEffect(() => {
    const settings = settingsRef.current
    const awayReminderEnabled = settings?.awayReminderEnabled ?? true

    if (prevEnabledRef.current === true && awayReminderEnabled === false) {
      useAwayReminderStore.getState().reset()
    }

    prevEnabledRef.current = awayReminderEnabled

    if (!awayReminderEnabled) {
      return
    }

    const hasActiveSession = () =>
      useWorkbenchStore
        .getState()
        .openDocuments.some((document) => document.kind === 'session-editor')

    const handleFocusEvent = (event: AppFocusEvent) => {
      if (event.phase === 'blurred') {
        if (hasActiveSession()) {
          useAwayReminderStore.getState().markAway()
        }
        return
      }

      if (event.phase === 'focused') {
        if (!hasActiveSession()) {
          useAwayReminderStore.getState().reset()
          return
        }
        const timeoutMs = settingsRef.current?.awayReminderTimeoutMs ?? 30000
        useAwayReminderStore.getState().handleFocusReturn(timeoutMs)
      }
    }

    const handleActivityEvent = (event: AppActivityEvent) => {
      if (event.phase === 'sleep' || event.phase === 'lock-screen') {
        if (hasActiveSession()) {
          useAwayReminderStore.getState().markAway()
        }
        return
      }

      if (event.phase === 'wake' || event.phase === 'unlock-screen') {
        if (!hasActiveSession()) {
          useAwayReminderStore.getState().reset()
          return
        }
        const timeoutMs = settingsRef.current?.awayReminderTimeoutMs ?? 30000
        useAwayReminderStore.getState().handleFocusReturn(timeoutMs)
      }
    }

    const unsubscribeFocus = systemClient.appFocus.onStateChange(handleFocusEvent)
    const unsubscribeActivity = systemClient.appActivity.onStateChange(handleActivityEvent)

    return () => {
      unsubscribeFocus()
      unsubscribeActivity()
    }
  }, [settingsQuery.data?.awayReminderEnabled, settingsQuery.data?.awayReminderTimeoutMs])
}
