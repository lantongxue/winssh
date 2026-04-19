import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { AppSettings } from '@shared/types'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { queryKeys } from '@/features/shared/query-keys'
import { settingsClient } from '@/features/settings/api/settings-client'

type SaveFieldOptions<K extends keyof AppSettings> = {
  onRevert?: (value: AppSettings[K]) => void
  onSuccess?: (settings: AppSettings, previousSettings: AppSettings) => void
}

export function useSettingsAutoSave(settings: AppSettings | undefined) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const savedSettingsRef = useRef<AppSettings | null>(settings ?? null)
  const saveQueueRef = useRef(Promise.resolve<void>(undefined))

  const syncSavedSettings = useCallback(
    (nextSettings: AppSettings) => {
      savedSettingsRef.current = nextSettings
      queryClient.setQueryData(queryKeys.settings, nextSettings)
    },
    [queryClient]
  )

  useEffect(() => {
    if (!settings) {
      return
    }

    syncSavedSettings(settings)
  }, [settings, syncSavedSettings])

  const saveField = useCallback(
    <K extends keyof AppSettings>(
      field: K,
      value: AppSettings[K],
      options: SaveFieldOptions<K> = {}
    ) => {
      const currentSettings = savedSettingsRef.current

      if (!currentSettings || Object.is(currentSettings[field], value)) {
        return Promise.resolve(true)
      }

      const saveTask = saveQueueRef.current.then(async () => {
        const latestSavedSettings = savedSettingsRef.current

        if (!latestSavedSettings || Object.is(latestSavedSettings[field], value)) {
          return true
        }

        const previousSettings = latestSavedSettings

        try {
          const nextSettings = await settingsClient.update({
            [field]: value
          } as Pick<AppSettings, K>)

          syncSavedSettings(nextSettings)
          options.onSuccess?.(nextSettings, previousSettings)
          return true
        } catch (error) {
          options.onRevert?.((savedSettingsRef.current?.[field] ?? previousSettings[field]) as AppSettings[K])
          toast.error(
            error instanceof Error ? error.message : t('workbench.settings.validation.failed')
          )
          return false
        }
      })

      saveQueueRef.current = saveTask.then(
        () => undefined,
        () => undefined
      )

      return saveTask
    },
    [syncSavedSettings, t]
  )

  return {
    saveField,
    savedSettingsRef,
    syncSavedSettings
  }
}
