import { isIP, createConnection as createTcpConnection, type Socket } from 'node:net'
import { SocksClient } from 'socks'
import type { ProxyConfiguration } from '@shared/types'

const PROXY_CONNECT_TIMEOUT_MS = 15_000
const MAX_HTTP_PROXY_RESPONSE_BYTES = 64 * 1024

export interface ProxyDestination {
  host: string
  port: number
}

function formatAuthority(destination: ProxyDestination): string {
  if (/[\r\n]/.test(destination.host)) {
    throw new Error('Proxy destination host is invalid')
  }

  const host = isIP(destination.host) === 6 ? `[${destination.host}]` : destination.host
  return `${host}:${destination.port}`
}

async function connectThroughSocks5(
  proxy: ProxyConfiguration,
  destination: ProxyDestination
): Promise<Socket> {
  const result = await SocksClient.createConnection({
    command: 'connect',
    destination,
    proxy: {
      host: proxy.host,
      port: proxy.port,
      type: 5
    },
    set_tcp_nodelay: true,
    timeout: PROXY_CONNECT_TIMEOUT_MS
  })

  return result.socket
}

function connectThroughHttp(
  proxy: ProxyConfiguration,
  destination: ProxyDestination
): Promise<Socket> {
  return new Promise<Socket>((resolve, reject) => {
    const authority = formatAuthority(destination)
    const socket = createTcpConnection({ host: proxy.host, port: proxy.port })
    let response = Buffer.alloc(0)
    let settled = false

    const cleanup = () => {
      socket.setTimeout(0)
      socket.removeListener('connect', handleConnect)
      socket.removeListener('data', handleData)
      socket.removeListener('error', handleError)
      socket.removeListener('timeout', handleTimeout)
    }

    const fail = (error: Error) => {
      if (settled) {
        return
      }

      settled = true
      cleanup()
      socket.destroy()
      reject(error)
    }

    const handleConnect = () => {
      socket.write(
        `CONNECT ${authority} HTTP/1.1\r\nHost: ${authority}\r\nProxy-Connection: Keep-Alive\r\n\r\n`
      )
    }

    const handleData = (chunk: Buffer) => {
      response = Buffer.concat([response, chunk])
      if (response.byteLength > MAX_HTTP_PROXY_RESPONSE_BYTES) {
        fail(new Error('HTTP proxy response headers are too large'))
        return
      }

      const headerEnd = response.indexOf('\r\n\r\n')
      if (headerEnd === -1) {
        return
      }

      const statusLine = response.subarray(0, headerEnd).toString('latin1').split('\r\n', 1)[0]
      const statusMatch = /^HTTP\/\d(?:\.\d)?\s+(\d{3})(?:\s|$)/i.exec(statusLine)
      const statusCode = statusMatch ? Number(statusMatch[1]) : 0
      if (statusCode !== 200) {
        fail(new Error(`HTTP proxy CONNECT failed: ${statusLine || 'invalid response'}`))
        return
      }

      settled = true
      cleanup()
      socket.pause()

      const remaining = response.subarray(headerEnd + 4)
      if (remaining.byteLength > 0) {
        socket.unshift(remaining)
      }

      resolve(socket)
      queueMicrotask(() => socket.resume())
    }

    const handleError = (error: Error) => fail(error)
    const handleTimeout = () => fail(new Error('HTTP proxy connection timed out'))

    socket.setNoDelay(true)
    socket.setTimeout(PROXY_CONNECT_TIMEOUT_MS)
    socket.once('connect', handleConnect)
    socket.on('data', handleData)
    socket.once('error', handleError)
    socket.once('timeout', handleTimeout)
  })
}

export function connectThroughProxy(
  proxy: ProxyConfiguration,
  destination: ProxyDestination
): Promise<Socket> {
  if (proxy.type === 'socks5') {
    return connectThroughSocks5(proxy, destination)
  }

  return connectThroughHttp(proxy, destination)
}
