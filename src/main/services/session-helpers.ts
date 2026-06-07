import type { Client } from 'ssh2'

export interface ExecResult {
  stdout: string
  stderr: string
  code: number | null
  signal?: string
}

export function appendChunk(chunks: Buffer[], chunk: Buffer | string): void {
  chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
}

export function execCommand(client: Client, command: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    client.exec(command, (error, channel) => {
      if (error) {
        reject(error)
        return
      }

      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []
      let settled = false

      const finish = (code?: number, signal?: string) => {
        if (settled) {
          return
        }

        settled = true
        resolve({
          code: typeof code === 'number' ? code : null,
          signal,
          stderr: Buffer.concat(stderrChunks).toString('utf8'),
          stdout: Buffer.concat(stdoutChunks).toString('utf8')
        })
      }

      channel.on('data', (chunk: Buffer | string) => appendChunk(stdoutChunks, chunk))
      channel.stderr.on('data', (chunk: Buffer | string) => appendChunk(stderrChunks, chunk))
      channel.once('error', (channelError) => {
        if (settled) {
          return
        }

        settled = true
        reject(channelError)
      })
      channel.once('close', finish)
    })
  })
}
