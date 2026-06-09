import { z } from 'zod'
import { SESSION_CONNECTION_PHASES } from './types'

const terminalSizeSchema = z.object({
  cols: z.number().int().positive(),
  rows: z.number().int().positive()
})

const sshResolvedAuthSchema = z.object({
  password: z.string().optional(),
  passphrase: z.string().optional(),
  privateKey: z.string().optional()
})

const sshResolvedServerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1),
  authType: z.enum(['password', 'privateKey']),
  auth: sshResolvedAuthSchema
})

export const sshConnectConfigSchema = z.object({
  sessionId: z.string().min(1),
  target: sshResolvedServerSchema,
  jump: sshResolvedServerSchema.optional(),
  commandHistory: z.boolean().optional(),
  terminal: terminalSizeSchema
})

export type SshResolvedAuth = z.infer<typeof sshResolvedAuthSchema>
export type SshResolvedServer = z.infer<typeof sshResolvedServerSchema>
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
    requestId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1)
  }),
  z.object({
    type: z.literal('resize'),
    requestId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    cols: z.number().int().positive(),
    rows: z.number().int().positive()
  }),
  z.object({
    type: z.literal('write'),
    requestId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    data: z.instanceof(ArrayBuffer)
  }),
  z.object({
    type: z.literal('hostTrustResult'),
    requestId: z.string().min(1),
    ok: z.boolean(),
    trusted: z.boolean().optional(),
    message: z.string().optional()
  }),
  z.object({
    type: z.literal('sftp:listDirectory'),
    requestId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    remotePath: z.string().min(1)
  }),
  z.object({
    type: z.literal('sftp:createFile'),
    requestId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    remotePath: z.string().min(1)
  }),
  z.object({
    type: z.literal('sftp:openFileReadStream'),
    requestId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    remotePath: z.string().min(1)
  }),
  z.object({
    type: z.literal('sftp:openFileWriteStream'),
    requestId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    remotePath: z.string().min(1),
    encoding: z.string().min(1)
  }),
  z.object({
    type: z.literal('sftp:writeFileChunk'),
    requestId: z.string().min(1),
    streamId: z.string().min(1),
    chunk: z.string()
  }),
  z.object({
    type: z.literal('sftp:closeFileWriteStream'),
    requestId: z.string().min(1),
    streamId: z.string().min(1)
  }),
  z.object({
    type: z.literal('sftp:cancelFileStream'),
    requestId: z.string().min(1),
    streamId: z.string().min(1)
  }),
  z.object({
    type: z.literal('sftp:makeDirectory'),
    requestId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    remotePath: z.string().min(1)
  }),
  z.object({
    type: z.literal('sftp:rename'),
    requestId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    sourcePath: z.string().min(1),
    targetPath: z.string().min(1)
  }),
  z.object({
    type: z.literal('sftp:remove'),
    requestId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    remotePath: z.string().min(1)
  })
])

export type SshCoreInbound = z.infer<typeof sshCoreInboundSchema>

export const sshCoreOutboundSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ack'),
    requestId: z.string().min(1),
    ok: z.boolean(),
    message: z.string().optional(),
    result: z.unknown().optional()
  }),
  z.object({
    type: z.literal('cwd'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    cwd: z.string().min(1)
  }),
  z.object({
    type: z.literal('shellIntegrationInstall'),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1)
  }),
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
  }),
  z.object({
    type: z.literal('hostTrust'),
    requestId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    serverName: z.string().min(1),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    key: z.instanceof(ArrayBuffer)
  }),
  z.object({
    type: z.literal('sftp:fileChunk'),
    streamId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    remotePath: z.string().min(1),
    chunk: z.string(),
    transferred: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
  }),
  z.object({
    type: z.literal('sftp:fileStreamState'),
    streamId: z.string().min(1),
    sessionId: z.string().min(1),
    correlationId: z.string().min(1),
    remotePath: z.string().min(1),
    direction: z.enum(['upload', 'download']),
    status: z.enum(['running', 'completed', 'error', 'cancelled']),
    transferred: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    encoding: z.string().optional(),
    error: z.string().optional()
  })
])

export type SshCoreOutbound = z.infer<typeof sshCoreOutboundSchema>
