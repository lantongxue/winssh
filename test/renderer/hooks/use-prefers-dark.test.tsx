import { describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { usePrefersDark } from '@/hooks/use-prefers-dark'

interface MatchMediaController {
  restore: () => void
  setMatches: (next: boolean) => void
}

function installMatchMedia(initialMatches: boolean): MatchMediaController {
  const listeners = new Set<() => void>()
  const previousMatchMedia = window.matchMedia
  let matches = initialMatches

  const mediaQueryList = {
    media: '(prefers-color-scheme: dark)',
    matches,
    onchange: null,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    addListener: (listener: () => void) => listeners.add(listener),
    removeListener: (listener: () => void) => listeners.delete(listener),
    dispatchEvent: () => true
  } as unknown as MediaQueryList

  window.matchMedia = vi.fn().mockImplementation(() => mediaQueryList)

  return {
    restore: () => {
      window.matchMedia = previousMatchMedia
    },
    setMatches: (next) => {
      matches = next
      ;(mediaQueryList as unknown as { matches: boolean }).matches = next
      for (const listener of listeners) {
        listener()
      }
    }
  }
}

function TestComponent() {
  const prefersDark = usePrefersDark()
  return <div>{prefersDark ? 'dark' : 'light'}</div>
}

describe('usePrefersDark', () => {
  it('reacts to prefers-color-scheme changes', () => {
    const controller = installMatchMedia(false)

    render(<TestComponent />)
    expect(screen.getByText('light')).toBeInTheDocument()

    act(() => {
      controller.setMatches(true)
    })

    expect(screen.getByText('dark')).toBeInTheDocument()
    controller.restore()
  })
})
