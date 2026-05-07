import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebDAVBackupService } from '@main/webdav-backup-service'

function createService(baseUrl: string) {
  const database = {} as ConstructorParameters<typeof WebDAVBackupService>[0]
  const secureStore = {
    getSecret: vi.fn(async () => 'secret')
  } as unknown as ConstructorParameters<typeof WebDAVBackupService>[1]
  const settingsService = {
    getSettings: vi.fn(() => ({
      webdavBackupEnabled: false,
      webdavBackupIntervalMinutes: 60,
      webdavBackupPath: '/backups',
      webdavUrl: baseUrl,
      webdavUsername: 'alice'
    }))
  } as unknown as ConstructorParameters<typeof WebDAVBackupService>[2]

  return new WebDAVBackupService(database, secureStore, settingsService)
}

describe('WebDAVBackupService delete', () => {
  let requests: Array<{
    authorization: string | undefined
    method: string | undefined
    url: string | undefined
  }>
  let responseHandler: ((request: IncomingMessage, response: ServerResponse) => void) | null
  let server: Server
  let baseUrl: string

  beforeEach(async () => {
    requests = []
    responseHandler = null
    server = createServer((request, response) => {
      requests.push({
        authorization:
          typeof request.headers.authorization === 'string'
            ? request.headers.authorization
            : undefined,
        method: request.method,
        url: request.url
      })

      if (responseHandler) {
        responseHandler(request, response)
        return
      }

      response.statusCode = 500
      response.end()
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}/dav`
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  })

  it('deletes the selected remote backup file over WebDAV', async () => {
    responseHandler = (_request, response) => {
      response.statusCode = 204
      response.end()
    }

    const service = createService(baseUrl)
    const fileName = 'winssh-win32-2026-04-24T08-00-00-000Z.db'

    await service.delete(fileName)

    expect(requests).toEqual([
      {
        authorization: `Basic ${Buffer.from('alice:secret').toString('base64')}`,
        method: 'DELETE',
        url: `/dav/backups/${encodeURIComponent(fileName)}`
      }
    ])
  })

  it('rejects an invalid backup file name before sending a remote delete request', async () => {
    const service = createService(baseUrl)

    await expect(service.delete('../not-a-backup.db')).rejects.toThrow(
      'The selected WebDAV backup file is invalid'
    )
    expect(requests).toEqual([])
  })
})
