import { describe, expect, it, vi } from 'vitest'
import {
  configureHardwareAcceleration,
  HARDWARE_ACCELERATION_ENV,
  shouldDisableHardwareAcceleration
} from './gpu-config'

describe('shouldDisableHardwareAcceleration', () => {
  it('disables hardware acceleration by default on Windows', () => {
    expect(shouldDisableHardwareAcceleration('win32', {})).toBe(true)
  })

  it('keeps hardware acceleration enabled by default on non-Windows platforms', () => {
    expect(shouldDisableHardwareAcceleration('darwin', {})).toBe(false)
    expect(shouldDisableHardwareAcceleration('linux', {})).toBe(false)
  })

  it('allows explicitly re-enabling hardware acceleration through the environment', () => {
    expect(
      shouldDisableHardwareAcceleration('win32', {
        [HARDWARE_ACCELERATION_ENV]: 'true'
      })
    ).toBe(false)
  })

  it('allows explicitly disabling hardware acceleration through the environment', () => {
    expect(
      shouldDisableHardwareAcceleration('linux', {
        [HARDWARE_ACCELERATION_ENV]: 'off'
      })
    ).toBe(true)
  })
})

describe('configureHardwareAcceleration', () => {
  it('calls into Electron when acceleration should be disabled', () => {
    const disableHardwareAcceleration = vi.fn()

    configureHardwareAcceleration({ disableHardwareAcceleration }, 'win32', {})

    expect(disableHardwareAcceleration).toHaveBeenCalledOnce()
  })

  it('does nothing when acceleration remains enabled', () => {
    const disableHardwareAcceleration = vi.fn()

    configureHardwareAcceleration(
      { disableHardwareAcceleration },
      'win32',
      {
        [HARDWARE_ACCELERATION_ENV]: 'on'
      }
    )

    expect(disableHardwareAcceleration).not.toHaveBeenCalled()
  })
})
