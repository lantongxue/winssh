export const FONT_ZOOM_MIN_SIZE = 10
export const FONT_ZOOM_MAX_SIZE = 24

export type FontZoomKeyboardAction = 'increase' | 'decrease' | 'reset'

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

export function getKeyboardFontZoomAction(
  event: Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'key' | 'metaKey' | 'shiftKey'>
): FontZoomKeyboardAction | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) {
    return null
  }

  if (event.key === '0') {
    return 'reset'
  }

  if (event.key === '+' || event.key === '=') {
    return 'increase'
  }

  if (event.key === '-' || event.key === '_') {
    return 'decrease'
  }

  return null
}
