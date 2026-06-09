import {
  clampFontZoomSize,
  getWheelFontZoomDelta,
  resolveTemporaryFontSize
} from '@/lib/font-zoom'

describe('font zoom helpers', () => {
  it('clamps temporary font sizes to the supported range', () => {
    expect(clampFontZoomSize(4)).toBe(10)
    expect(clampFontZoomSize(18)).toBe(18)
    expect(clampFontZoomSize(40)).toBe(24)
  })

  it('maps wheel direction to one point zoom steps', () => {
    expect(getWheelFontZoomDelta({ deltaY: -120 })).toBe(1)
    expect(getWheelFontZoomDelta({ deltaY: 120 })).toBe(-1)
    expect(getWheelFontZoomDelta({ deltaY: 0 })).toBe(0)
  })

  it('resolves temporary offset against the current base size', () => {
    expect(resolveTemporaryFontSize(14, 2)).toBe(16)
    expect(resolveTemporaryFontSize(23, 4)).toBe(24)
    expect(resolveTemporaryFontSize(11, -4)).toBe(10)
  })
})
