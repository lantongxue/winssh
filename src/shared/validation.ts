import { z } from 'zod'
import { COLOR_PRESETS } from './constants'

const colorSchema = z.enum(COLOR_PRESETS)

export const groupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'validation.group.name.required')
    .max(40, 'validation.group.name.max'),
  color: colorSchema
})

export const tagSchema = z.object({
  name: z.string().trim().min(1, 'validation.tag.name.required').max(32, 'validation.tag.name.max'),
  color: colorSchema
})

export const serverSchema = z
  .object({
    id: z.string().optional(),
    name: z
      .string()
      .trim()
      .min(1, 'validation.server.name.required')
      .max(60, 'validation.server.name.max'),
    host: z
      .string()
      .trim()
      .min(1, 'validation.server.host.required')
      .max(255, 'validation.server.host.max'),
    port: z.coerce
      .number()
      .int()
      .min(1, 'validation.server.port.min')
      .max(65535, 'validation.server.port.max'),
    username: z
      .string()
      .trim()
      .min(1, 'validation.server.username.required')
      .max(64, 'validation.server.username.max'),
    authType: z.enum(['password', 'privateKey']),
    privateKey: z.string().optional(),
    note: z.string().trim().max(400, 'validation.server.note.max').optional(),
    groupId: z.string().trim().nullable().optional(),
    tagIds: z.array(z.string()).default([]),
    favorite: z.boolean().default(false),
    password: z.string().optional(),
    passphrase: z.string().optional(),
    rememberPassword: z.boolean().default(true),
    rememberPassphrase: z.boolean().default(false)
  })
  .superRefine((value, ctx) => {
    if (value.authType === 'privateKey' && !value.privateKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['privateKey'],
        message: 'validation.server.privateKey.required'
      })
    }
  })

export const connectionRequestSchema = z.object({
  serverId: z.string().min(1, 'validation.connectionRequest.serverId.required'),
  password: z.string().optional(),
  passphrase: z.string().optional(),
  rememberPassword: z.boolean().optional(),
  rememberPassphrase: z.boolean().optional()
})

const portForwardHostSchema = z
  .string()
  .trim()
  .min(1, 'validation.portForward.host.required')
  .max(255, 'validation.portForward.host.max')

const portForwardPortSchema = z.coerce
  .number()
  .int()
  .min(1, 'validation.portForward.port.min')
  .max(65535, 'validation.portForward.port.max')

export const portForwardSchema = z.object({
  kind: z.enum(['local', 'remote']),
  bindHost: portForwardHostSchema,
  bindPort: portForwardPortSchema,
  targetHost: portForwardHostSchema,
  targetPort: portForwardPortSchema
})

export const settingsSchema = z.object({
  language: z.enum(['system', 'zh-CN', 'en-US']),
  theme: z.string().trim().min(1).max(120),
  terminalFontSize: z.coerce.number().int().min(10).max(24),
  terminalFontFamily: z.string().trim().min(1).max(120),
  cursorStyle: z.enum(['block', 'underline', 'bar']),
  cursorBlink: z.boolean(),
  copyOnSelect: z.boolean(),
  windowTitleBarStyle: z.enum(['native', 'custom'])
})

export type ServerFormValues = z.infer<typeof serverSchema>
export type GroupFormValues = z.infer<typeof groupSchema>
export type TagFormValues = z.infer<typeof tagSchema>
export type PortForwardFormValues = z.infer<typeof portForwardSchema>
export type SettingsFormValues = z.infer<typeof settingsSchema>
