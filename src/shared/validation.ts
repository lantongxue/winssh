import { z } from 'zod'
import { COLOR_PRESETS } from './constants'

const colorSchema = z.enum(COLOR_PRESETS)

export const groupSchema = z.object({
  name: z.string().trim().min(1, '请输入分组名称').max(40, '分组名称不能超过 40 个字符'),
  color: colorSchema
})

export const tagSchema = z.object({
  name: z.string().trim().min(1, '请输入标签名称').max(32, '标签名称不能超过 32 个字符'),
  color: colorSchema
})

export const serverSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(1, '请输入服务器名称').max(60, '服务器名称不能超过 60 个字符'),
    host: z.string().trim().min(1, '请输入主机地址').max(255, '主机地址过长'),
    port: z.coerce.number().int().min(1, '端口最小为 1').max(65535, '端口最大为 65535'),
    username: z.string().trim().min(1, '请输入用户名').max(64, '用户名不能超过 64 个字符'),
    authType: z.enum(['password', 'privateKey']),
    privateKeyPath: z.string().trim().nullable().optional(),
    note: z.string().trim().max(400, '备注不能超过 400 个字符').optional(),
    groupId: z.string().trim().nullable().optional(),
    tagIds: z.array(z.string()).default([]),
    favorite: z.boolean().default(false),
    password: z.string().optional(),
    passphrase: z.string().optional(),
    rememberPassword: z.boolean().default(true),
    rememberPassphrase: z.boolean().default(false)
  })
  .superRefine((value, ctx) => {
    if (value.authType === 'privateKey' && !value.privateKeyPath?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['privateKeyPath'],
        message: '私钥认证需要选择私钥文件'
      })
    }
  })

export const connectionRequestSchema = z.object({
  serverId: z.string().min(1, '缺少服务器 ID'),
  password: z.string().optional(),
  passphrase: z.string().optional(),
  rememberPassword: z.boolean().optional(),
  rememberPassphrase: z.boolean().optional()
})

export const settingsSchema = z.object({
  theme: z.enum(['system', 'light', 'dark']),
  terminalFontSize: z.coerce.number().int().min(10).max(24),
  terminalFontFamily: z.string().trim().min(1).max(120),
  cursorStyle: z.enum(['block', 'underline', 'bar']),
  cursorBlink: z.boolean(),
  copyOnSelect: z.boolean()
})

export type ServerFormValues = z.infer<typeof serverSchema>
export type GroupFormValues = z.infer<typeof groupSchema>
export type TagFormValues = z.infer<typeof tagSchema>
export type SettingsFormValues = z.infer<typeof settingsSchema>
