import { z } from 'zod'
import { INTEGRATED_FONT_IDS } from './integrated-fonts'
import { COLOR_PRESETS } from './constants'
import { MAX_SERVER_ICON_BYTES, SERVER_ICON_MIME_TYPES } from './server-brands'

const colorSchema = z.enum(COLOR_PRESETS)
const serverIconMimeTypeSchema = z.enum(SERVER_ICON_MIME_TYPES)
const serverIconDataSchema = z.custom<Uint8Array>((value) => value instanceof Uint8Array, {
  message: 'validation.server.customIcon.invalid'
})

export const groupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'validation.group.name.required')
    .max(40, 'validation.group.name.max'),
  color: colorSchema,
  parentId: z.string().trim().nullable().optional()
})

export const tagSchema = z.object({
  name: z.string().trim().min(1, 'validation.tag.name.required').max(32, 'validation.tag.name.max'),
  color: colorSchema
})

export const credentialSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'validation.credential.name.required')
      .max(80, 'validation.credential.name.max'),
    kind: z.enum(['password', 'privateKey']),
    username: z.string().trim().max(64, 'validation.credential.username.max').nullable().optional(),
    password: z.string().optional().nullable(),
    privateKey: z.string().optional().nullable(),
    passphrase: z.string().optional().nullable(),
    note: z.string().trim().max(400, 'validation.credential.note.max').optional().nullable()
  })
  .superRefine((value, ctx) => {
    if (value.kind === 'password' && !value.password?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['password'],
        message: 'validation.credential.password.required'
      })
    }
    if (value.kind === 'privateKey' && !value.privateKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['privateKey'],
        message: 'validation.credential.privateKey.required'
      })
    }
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
    privateKey: z.string().optional().nullable(),
    customIconMimeType: serverIconMimeTypeSchema.nullable().optional(),
    customIconData: serverIconDataSchema.nullable().optional(),
    note: z.string().trim().max(400, 'validation.server.note.max').optional(),
    groupId: z.string().trim().nullable().optional(),
    jumpServerId: z.string().trim().nullable().optional(),
    tagIds: z.array(z.string()).default([]),
    favorite: z.boolean().default(false),
    captureCommandHistory: z.boolean().optional(),
    password: z.string().optional(),
    passphrase: z.string().optional(),
    rememberPassword: z.boolean().default(true),
    rememberPassphrase: z.boolean().default(false),
    credentialId: z.string().trim().nullable().optional()
  })
  .superRefine((value, ctx) => {
    if (value.authType === 'privateKey' && !value.credentialId && !value.privateKey?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['privateKey'],
        message: 'validation.server.privateKey.required'
      })
    }

    if (value.id && value.jumpServerId && value.id === value.jumpServerId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['jumpServerId'],
        message: 'validation.server.jumpServer.self'
      })
    }

    const hasMimeType = Object.prototype.hasOwnProperty.call(value, 'customIconMimeType')
    const hasIconData = Object.prototype.hasOwnProperty.call(value, 'customIconData')
    if (!hasMimeType && !hasIconData) {
      return
    }

    const isRemovingCustomIcon = value.customIconMimeType === null && value.customIconData === null
    if (isRemovingCustomIcon) {
      return
    }

    if (!value.customIconMimeType || !value.customIconData) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customIconData'],
        message: 'validation.server.customIcon.required'
      })
      return
    }

    if (value.customIconData.byteLength === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customIconData'],
        message: 'validation.server.customIcon.required'
      })
    }

    if (value.customIconData.byteLength > MAX_SERVER_ICON_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customIconData'],
        message: 'validation.server.customIcon.size'
      })
    }
  })

const connectionSecretInputSchema = z.object({
  password: z.string().optional(),
  passphrase: z.string().optional(),
  rememberPassword: z.boolean().optional(),
  rememberPassphrase: z.boolean().optional()
})

export const connectionRequestSchema = z.object({
  serverId: z.string().min(1, 'validation.connectionRequest.serverId.required'),
  sessionId: z.string().min(1).optional(),
  secrets: z.record(z.string(), connectionSecretInputSchema).optional()
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
  logFilePath: z.string().trim().min(1).max(1024).nullable(),
  theme: z.string().trim().min(1).max(120),
  terminalFontSize: z.coerce.number().int().min(10).max(24),
  uiFontId: z.enum(INTEGRATED_FONT_IDS),
  terminalFontId: z.enum(INTEGRATED_FONT_IDS),
  editorFontId: z.enum(INTEGRATED_FONT_IDS).nullable(),
  autoUpdateCheckEnabled: z.boolean(),
  experimentalTerminalWebgl: z.boolean(),
  cursorStyle: z.enum(['block', 'underline', 'bar']),
  cursorBlink: z.boolean(),
  copyOnSelect: z.boolean(),
  localTerminalShell: z.enum(['cmd', 'powershell', 'bash', 'zsh']),
  windowTitleBarStyle: z.enum(['native', 'custom']),
  webdavBackupEnabled: z.boolean(),
  webdavUrl: z.string().trim().max(512).nullable(),
  webdavUsername: z.string().trim().max(120).nullable(),
  webdavBackupIntervalMinutes: z.coerce.number().int().min(15).max(10080),
  webdavBackupPath: z.string().trim().max(512).nullable(),
  resourceMonitorIntervalMs: z.coerce.number().int().min(500).max(30000),
  sftpUploadConcurrency: z.coerce.number().int().min(1).max(16),
  sftpDownloadConcurrency: z.coerce.number().int().min(1).max(16),
  commandHistoryEnabled: z.boolean(),
  awayReminderEnabled: z.boolean(),
  awayReminderTimeoutMs: z.coerce.number().int().min(5000).max(3600000)
})

export const hostTrustRequestSchema = z.object({
  requestId: z.string().min(1),
  kind: z.enum(['hostChanged', 'hostFirstSeen']),
  serverName: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  fingerprint: z.string().min(1),
  knownFingerprint: z.string().optional()
})

export const hostTrustResultSchema = z.object({
  requestId: z.string().min(1),
  trusted: z.boolean()
})

export const customCommandSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'validation.customCommand.name.required')
    .max(60, 'validation.customCommand.name.max'),
  command: z
    .string()
    .trim()
    .min(1, 'validation.customCommand.command.required')
    .max(2000, 'validation.customCommand.command.max')
})

export const customCommandUpdateSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  command: z.string().trim().min(1).max(2000).optional()
})

export type ServerFormValues = z.infer<typeof serverSchema>
export type GroupFormValues = z.infer<typeof groupSchema>
export type TagFormValues = z.infer<typeof tagSchema>
export type PortForwardFormValues = z.infer<typeof portForwardSchema>
export type SettingsFormValues = z.infer<typeof settingsSchema>
export type CredentialFormValues = z.infer<typeof credentialSchema>
export type CustomCommandFormValues = z.infer<typeof customCommandSchema>

export const sftpBookmarkSchema = z.object({
  serverId: z.string().min(1, 'validation.sftpBookmark.serverId.required'),
  path: z.string().trim().min(1, 'validation.sftpBookmark.path.required')
})

export type SftpBookmarkFormValues = z.infer<typeof sftpBookmarkSchema>
