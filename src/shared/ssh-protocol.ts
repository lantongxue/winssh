import { z } from 'zod'
import { SESSION_CONNECTION_PHASES } from './types'

const terminalSizeSchema = z.object({
  cols: z.number().int().positive(),
  rows: z.number().int().positive()
})

export const sshConnectConfigSchema = z.object({
  sessionId: z.string().min(1),
  serverId: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  authType: z.enum(['password', 'privateKey']),
  terminal: terminalSizeSchema
})

export type SshConnectConfig = z.infer<typeof sshConnectConfigSchema>

export const sshCoreInboundSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('connect'),
    requestId: z.string().min(1),
    correlationId: z.string().min(1),
    config: sshConnectConfigSchema
  }),
  z.object({
    type: z.literal('disconnect'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1)
  }),
  z.object({
    type: z.literal('resize'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    cols: z.number().int().positive(),
    rows: z.number().int().positive()
  }),
  z.object({
    type: z.literal('write'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    data: z.instanceof(ArrayBuffer)
  })
])

export type SshCoreInbound = z.infer<typeof sshCoreInboundSchema>

export const sshCoreOutboundSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('state'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    phase: z.enum(SESSION_CONNECTION_PHASES)
  }),
  z.object({
    type: z.literal('data'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    frame: z.instanceof(ArrayBuffer),
    seq: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal('exit'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    code: z.number().int(),
    signal: z.string().optional()
  }),
  z.object({
    type: z.literal('error'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    message: z.string().min(1),
    code: z.string().optional()
  })
])

export type SshCoreOutbound = z.infer<typeof sshCoreOutboundSchema>
