import { describe, expect, it } from 'vitest'
import type { AppFocusEvent, AppActivityEvent } from '@shared/types'
import type { IpcChannelMap } from '@shared/ipc-channels'

describe('AppFocusEvent', () => {
  it('accepts blurred phase', () => {
    const event: AppFocusEvent = { phase: 'blurred' }
    expect(event.phase).toBe('blurred')
  })

  it('accepts focused phase', () => {
    const event: AppFocusEvent = { phase: 'focused' }
    expect(event.phase).toBe('focused')
  })
})

describe('AppActivityEvent', () => {
  it('accepts sleep phase', () => {
    const event: AppActivityEvent = { phase: 'sleep' }
    expect(event.phase).toBe('sleep')
  })

  it('accepts wake phase', () => {
    const event: AppActivityEvent = { phase: 'wake' }
    expect(event.phase).toBe('wake')
  })

  it('accepts lock-screen phase', () => {
    const event: AppActivityEvent = { phase: 'lock-screen' }
    expect(event.phase).toBe('lock-screen')
  })

  it('accepts unlock-screen phase', () => {
    const event: AppActivityEvent = { phase: 'unlock-screen' }
    expect(event.phase).toBe('unlock-screen')
  })
})

describe('IpcChannelMap — away reminder channels', () => {
  it('system:appFocus resolves to AppFocusEvent type', () => {
    type ChannelPayload = IpcChannelMap['system:appFocus']
    // This test primarily verifies that the channel exists and maps to AppFocusEvent
    const payload: ChannelPayload = { phase: 'blurred' }
    expect(payload.phase).toBe('blurred')
  })

  it('system:appActivity resolves to AppActivityEvent type', () => {
    type ChannelPayload = IpcChannelMap['system:appActivity']
    // This test primarily verifies that the channel exists and maps to AppActivityEvent
    const payload: ChannelPayload = { phase: 'sleep' }
    expect(payload.phase).toBe('sleep')
  })
})
