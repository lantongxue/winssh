import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CustomCommand, CustomCommandInput } from '@shared/types'
import { customCommandsClient } from '@/features/custom-commands/api/custom-commands-client'
import { queryKeys } from '@/features/shared/query-keys'

export function useCustomCommands() {
  const queryClient = useQueryClient()

  const query = useQuery<CustomCommand[]>({
    queryKey: queryKeys.customCommands,
    queryFn: () => customCommandsClient.list()
  })

  const createMutation = useMutation({
    mutationFn: (input: CustomCommandInput) => customCommandsClient.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customCommands })
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CustomCommandInput> }) =>
      customCommandsClient.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customCommands })
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customCommandsClient.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customCommands })
    }
  })

  return {
    commands: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    create: (input: CustomCommandInput) => createMutation.mutateAsync(input),
    update: (id: string, input: Partial<CustomCommandInput>) =>
      updateMutation.mutateAsync({ id, input }),
    delete: (id: string) => deleteMutation.mutateAsync(id),
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending
  }
}
