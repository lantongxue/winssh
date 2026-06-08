import { z } from 'zod'

export const TERMINAL_DEGRADED_REASONS = [
  'offscreen_canvas_unavailable',
  'shared_array_buffer_unavailable',
  'terminal_worker_crashed',
  'worker_init_failed'
] as const

export type TerminalDegradedReason = (typeof TERMINAL_DEGRADED_REASONS)[number]

export const terminalWorkerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('attach'),
    sessionId: z.string().min(1),
    useOffscreenCanvas: z.boolean()
  }),
  z.object({
    type: z.literal('resize'),
    sessionId: z.string().min(1),
    cols: z.number().int().positive(),
    rows: z.number().int().positive()
  }),
  z.object({
    type: z.literal('focus'),
    sessionId: z.string().min(1)
  }),
  z.object({
    type: z.literal('dispose'),
    sessionId: z.string().min(1)
  }),
  z.object({
    type: z.literal('degraded'),
    sessionId: z.string().min(1),
    reason: z.enum(TERMINAL_DEGRADED_REASONS)
  }),
  z.object({
    type: z.literal('ready'),
    sessionId: z.string().min(1)
  })
])

export type TerminalWorkerMessage = z.infer<typeof terminalWorkerMessageSchema>
