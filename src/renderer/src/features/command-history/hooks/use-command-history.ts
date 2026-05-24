import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CommandHistoryEntry, CommandHistoryScope } from '@shared/types'
import { commandHistoryClient } from '@/features/command-history/api/command-history-client'
import { queryKeys } from '@/features/shared/query-keys'

function scopesEqual(a: CommandHistoryScope, b: CommandHistoryScope): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'ssh' && b.kind === 'ssh') return a.serverId === b.serverId
  return true
}

export function useCommandHistory(scope: CommandHistoryScope | null) {
  const queryClient = useQueryClient()

  const query = useQuery<CommandHistoryEntry[]>({
    queryKey: scope ? queryKeys.commandHistory(scope) : ['command-history', 'disabled'],
    queryFn: () => commandHistoryClient.list({ scope: scope as CommandHistoryScope, limit: 500 }),
    enabled: scope !== null
  })

  useEffect(() => {
    if (!scope) return undefined
    const unsubscribe = commandHistoryClient.onCommandAdded((event) => {
      if (!scopesEqual(event.scope, scope)) return
      queryClient.setQueryData<CommandHistoryEntry[] | undefined>(
        queryKeys.commandHistory(scope),
        (previous) => {
          if (!previous) return [event.entry]
          if (previous.some((entry) => entry.id === event.entry.id)) return previous
          return [event.entry, ...previous]
        }
      )
    })
    return () => unsubscribe()
  }, [scope, queryClient])

  const clearMutation = useMutation({
    mutationFn: () => commandHistoryClient.clear(scope as CommandHistoryScope),
    onSuccess: () => {
      if (scope) {
        queryClient.setQueryData<CommandHistoryEntry[]>(queryKeys.commandHistory(scope), [])
      }
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => commandHistoryClient.deleteEntry(id),
    onSuccess: (_void, id) => {
      if (scope) {
        queryClient.setQueryData<CommandHistoryEntry[] | undefined>(
          queryKeys.commandHistory(scope),
          (previous) => previous?.filter((entry) => entry.id !== id)
        )
      }
    }
  })

  return {
    entries: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    clear: () => clearMutation.mutateAsync(),
    deleteEntry: (id: string) => deleteMutation.mutateAsync(id)
  }
}
