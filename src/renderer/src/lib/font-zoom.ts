export const FONT_ZOOM_MIN_SIZE = 10
export const FONT_ZOOM_MAX_SIZE = 24

export function clampFontZoomSize(size: number) {
  return Math.max(FONT_ZOOM_MIN_SIZE, Math.min(FONT_ZOOM_MAX_SIZE, size))
}

export function getWheelFontZoomDelta(event: Pick<WheelEvent, 'deltaY'>) {
  if (event.deltaY < 0) {
    return 1
  }

  if (event.deltaY > 0) {
    return -1
  }

  return 0
}

export function resolveTemporaryFontSize(baseSize: number, offset: number) {
  return clampFontZoomSize(baseSize + offset)
}
