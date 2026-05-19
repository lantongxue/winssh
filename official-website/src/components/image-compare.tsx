import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface ImageCompareProps {
  leftSrc: string
  leftAlt: string
  leftLabel: string
  rightSrc: string
  rightAlt: string
  rightLabel: string
  initialPosition?: number
  ariaLabel: string
  ariaValueTextFormat?: (pct: number) => string
}

export function ImageCompare({
  leftSrc,
  leftAlt,
  leftLabel,
  rightSrc,
  rightAlt,
  rightLabel,
  initialPosition = 50,
  ariaLabel,
  ariaValueTextFormat
}: ImageCompareProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [position, setPosition] = useState(initialPosition)

  const setFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setPosition(pct)
  }, [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    setFromClientX(e.clientX)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    setFromClientX(e.clientX)
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = e.shiftKey ? 10 : 2
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setPosition((p) => Math.max(0, p - step))
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      setPosition((p) => Math.min(100, p + step))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setPosition(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setPosition(100)
    }
  }

  const pct = Math.round(position)
  const valueText = ariaValueTextFormat ? ariaValueTextFormat(pct) : `${pct}%`

  return (
    <div
      ref={containerRef}
      className="vsc-compare"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Base image (left) establishes natural height */}
      <img
        src={leftSrc}
        alt={leftAlt}
        className="vsc-compare-base"
        draggable={false}
        decoding="async"
        loading="lazy"
      />
      {/* Overlay (right) clipped from the position to 100% */}
      <div
        className="vsc-compare-overlay"
        style={{
          clipPath: `polygon(${position}% 0, 100% 0, 100% 100%, ${position}% 100%)`
        }}
        aria-hidden="true"
      >
        <img
          src={rightSrc}
          alt=""
          className="vsc-compare-overlay-img"
          draggable={false}
          decoding="async"
          loading="lazy"
        />
      </div>
      {/* Hidden image for screen readers (overlay has alt="") */}
      <span className="vsc-sr-only">{rightAlt}</span>

      <span className="vsc-compare-label vsc-compare-label-left" aria-hidden="true">
        {leftLabel}
      </span>
      <span className="vsc-compare-label vsc-compare-label-right" aria-hidden="true">
        {rightLabel}
      </span>

      <div className="vsc-compare-divider" style={{ left: `${position}%` }} aria-hidden="true" />

      <button
        type="button"
        className="vsc-compare-handle"
        style={{ left: `${position}%` }}
        role="slider"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={valueText}
        onKeyDown={onKeyDown}
      >
        <ChevronLeft size={14} strokeWidth={2.5} aria-hidden="true" />
        <ChevronRight size={14} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  )
}
