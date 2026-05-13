/**
 * Generic async concurrency pool that limits the number of concurrent operations.
 * Supports cancellation via AbortSignal.
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  handler: (item: T, signal: AbortSignal) => Promise<void>,
  signal?: AbortSignal
): Promise<void> {
  if (items.length === 0) {
    return
  }

  // If already aborted, skip all items
  if (signal?.aborted) {
    return
  }

  const effectiveConcurrency = Math.min(Math.max(1, concurrency), items.length)
  const queue = [...items]
  const activePromises = new Set<Promise<void>>()
  let aborted = false

  const onAbort = () => {
    aborted = true
  }

  signal?.addEventListener('abort', onAbort, { once: true })

  const processNext = async (): Promise<void> => {
    if (aborted) {
      return
    }

    const item = queue.shift()
    if (item === undefined) {
      return
    }

    const promise = handler(item, signal ?? new AbortController().signal).finally(() => {
      activePromises.delete(promise)
    })

    activePromises.add(promise)

    // When current item finishes, process next one
    await promise
    if (queue.length > 0 && !aborted) {
      await processNext()
    }
  }

  // Start initial batch of concurrent operations
  const initialBatch = Array.from({ length: effectiveConcurrency }, () => processNext())
  await Promise.allSettled(initialBatch)

  signal?.removeEventListener('abort', onAbort)
}
