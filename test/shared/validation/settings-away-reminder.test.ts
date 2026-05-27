import { describe, expect, it } from 'vitest'
import { settingsSchema } from '@shared/validation'
import { DEFAULT_APP_SETTINGS } from '@shared/constants'

const validSettingsBase = {
  ...DEFAULT_APP_SETTINGS,
  awayReminderEnabled: true,
  awayReminderTimeoutMs: 30000
}

describe('settingsSchema — awayReminderEnabled', () => {
  it('accepts true (default)', () => {
    const result = settingsSchema.safeParse(validSettingsBase)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.awayReminderEnabled).toBe(true)
    }
  })

  it('accepts false', () => {
    const result = settingsSchema.safeParse({ ...validSettingsBase, awayReminderEnabled: false })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.awayReminderEnabled).toBe(false)
    }
  })

  it('rejects non-boolean value', () => {
    const result = settingsSchema.safeParse({ ...validSettingsBase, awayReminderEnabled: 'true' })
    expect(result.success).toBe(false)
  })
})

describe('settingsSchema — awayReminderTimeoutMs', () => {
  const baseInput = validSettingsBase

  it('accepts default value 30000', () => {
    const result = settingsSchema.safeParse(baseInput)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.awayReminderTimeoutMs).toBe(30000)
    }
  })

  it('accepts minimum boundary value 5000', () => {
    const result = settingsSchema.safeParse({ ...baseInput, awayReminderTimeoutMs: 5000 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.awayReminderTimeoutMs).toBe(5000)
    }
  })

  it('accepts maximum boundary value 3600000', () => {
    const result = settingsSchema.safeParse({ ...baseInput, awayReminderTimeoutMs: 3600000 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.awayReminderTimeoutMs).toBe(3600000)
    }
  })

  it('rejects value below minimum (4999)', () => {
    const result = settingsSchema.safeParse({ ...baseInput, awayReminderTimeoutMs: 4999 })
    expect(result.success).toBe(false)
  })

  it('rejects value above maximum (3600001)', () => {
    const result = settingsSchema.safeParse({ ...baseInput, awayReminderTimeoutMs: 3600001 })
    expect(result.success).toBe(false)
  })

  it('coerces string input to number', () => {
    const result = settingsSchema.safeParse({ ...baseInput, awayReminderTimeoutMs: '30000' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.awayReminderTimeoutMs).toBe(30000)
    }
  })

  it('rejects non-numeric string input', () => {
    const result = settingsSchema.safeParse({ ...baseInput, awayReminderTimeoutMs: 'abc' })
    expect(result.success).toBe(false)
  })
})