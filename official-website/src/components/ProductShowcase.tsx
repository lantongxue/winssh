import React, { useState, useRef, useEffect } from 'react'
import { ChevronsLeftRight } from 'lucide-react'

export default function ProductShowcase() {
  const [sliderPosition, setSliderPosition] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Drag handles for the comparison slider
  const handleMove = (clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = clientX - rect.left
    const position = (x / rect.width) * 100
    setSliderPosition(Math.min(100, Math.max(0, position)))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    handleMove(e.clientX)
  }

  useEffect(() => {
    if (!isDragging) return

    const handleWindowMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX)
    }

    const handleWindowMouseUp = () => {
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('mouseup', handleWindowMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove)
      window.removeEventListener('mouseup', handleWindowMouseUp)
    }
  }, [isDragging])

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true)
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    if (e.touches.length > 0) {
      handleMove(e.touches[0].clientX)
    }
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  return (
    <div className="w-full mx-auto">
      {/* Drag Container Screen */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative w-full overflow-hidden select-none cursor-ew-resize touch-none"
      >
        {/* IMAGE A: Underneath Background (Dark Mode) */}
        <img
          src="/assets/winssh-dark.png"
          alt="WinSSH Dark Theme"
          className="w-full h-auto block pointer-events-none"
          referrerPolicy="no-referrer"
        />

        {/* IMAGE B: Clipped Cropped Overlay (Light Mode) */}
        <img
          src="/assets/winssh-light.png"
          alt="WinSSH Light Theme"
          style={{
            clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`
          }}
          className="absolute top-0 left-0 w-full h-full block pointer-events-none"
          referrerPolicy="no-referrer"
        />

        {/* Glowing Dividing Slider Bar Line */}
        <div
          style={{ left: `${sliderPosition}%` }}
          className="absolute top-0 bottom-0 w-[2px] bg-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.85)] pointer-events-none z-30"
        >
          {/* Physical Central Thumb Grabber */}
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 bg-cyan-500 text-white shadow-xl flex items-center justify-center border-2 border-white pointer-events-auto active:scale-110 cursor-ew-resize transition-all">
            <ChevronsLeftRight size={15} className="animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  )
}
