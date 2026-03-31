import { useEffect, useRef } from 'react'

interface UseSingleOrDoubleClickOptions {
  delayMs?: number
  onDoubleClick?: () => void
  onSingleClick?: () => void
}

export function useSingleOrDoubleClick({
  delayMs = 300,
  onDoubleClick,
  onSingleClick
}: UseSingleOrDoubleClickOptions) {
  const clickTimeoutRef = useRef<number | null>(null)
  const singleClickRef = useRef(onSingleClick)
  const doubleClickRef = useRef(onDoubleClick)

  const clearPendingClick = () => {
    if (clickTimeoutRef.current === null) {
      return
    }

    window.clearTimeout(clickTimeoutRef.current)
    clickTimeoutRef.current = null
  }

  useEffect(() => {
    singleClickRef.current = onSingleClick
    doubleClickRef.current = onDoubleClick
  }, [onDoubleClick, onSingleClick])

  useEffect(() => clearPendingClick, [])

  const handleClick = () => {
    if (!singleClickRef.current) {
      return
    }

    if (!doubleClickRef.current) {
      singleClickRef.current()
      return
    }

    clearPendingClick()
    clickTimeoutRef.current = window.setTimeout(() => {
      clickTimeoutRef.current = null
      singleClickRef.current?.()
    }, delayMs)
  }

  const handleDoubleClick = () => {
    clearPendingClick()
    doubleClickRef.current?.()
  }

  return {
    onClick: handleClick,
    onDoubleClick: handleDoubleClick
  }
}
