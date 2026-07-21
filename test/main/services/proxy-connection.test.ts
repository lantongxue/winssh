import { createServer, type AddressInfo, type Server, type Socket } from 'node:net'
import { connectThroughProxy } from '@main/services/proxy-connection'

const openServers: Server[] = []
const openSockets = new Set<Socket>()

async function listen(server: Server): Promise<number> {
  openServers.push(server)
  server.on('connection', (socket) => {
    openSockets.add(socket)
    socket.once('close', () => openSockets.delete(socket))
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })

  return (server.address() as AddressInfo).port
}

afterEach(async () => {
  for (const socket of openSockets) {
    socket.destroy()
  }
  openSockets.clear()

  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve())
        })
    )
  )
})

describe('connectThroughProxy', () => {
  it('rejects HTTP destinations that could inject CONNECT headers', async () => {
    await expect(
      connectThroughProxy(
        { type: 'http', host: '127.0.0.1', port: 3128 },
        { host: 'example.com\r\nX-Injected: yes', port: 22 }
      )
    ).rejects.toThrow('Proxy destination host is invalid')
  })

  it('establishes an HTTP CONNECT tunnel', async () => {
    let request = ''
    const server = createServer((socket) => {
      socket.once('data', (chunk) => {
        request = chunk.toString('latin1')
        socket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      })
    })
    const port = await listen(server)

    const socket = await connectThroughProxy(
      { type: 'http', host: '127.0.0.1', port },
      { host: 'ssh.example.com', port: 2222 }
    )

    expect(request).toContain('CONNECT ssh.example.com:2222 HTTP/1.1')
    expect(request).toContain('Host: ssh.example.com:2222')
    socket.destroy()
  })

  it('establishes a SOCKS5 tunnel', async () => {
    let requestedHost = ''
    let requestedPort = 0
    const server = createServer((socket) => {
      let stage: 'greeting' | 'request' = 'greeting'
      let buffered = Buffer.alloc(0)

      socket.on('data', (chunk) => {
        buffered = Buffer.concat([buffered, chunk])

        if (stage === 'greeting' && buffered.byteLength >= 3) {
          expect([...buffered.subarray(0, 3)]).toEqual([5, 1, 0])
          buffered = buffered.subarray(3)
          stage = 'request'
          socket.write(Buffer.from([5, 0]))
        }

        if (stage === 'request' && buffered.byteLength >= 10) {
          expect([...buffered.subarray(0, 4)]).toEqual([5, 1, 0, 1])
          requestedHost = [...buffered.subarray(4, 8)].join('.')
          requestedPort = buffered.readUInt16BE(8)
          buffered = buffered.subarray(10)
          socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0]))
        }
      })
    })
    const port = await listen(server)

    const socket = await connectThroughProxy(
      { type: 'socks5', host: '127.0.0.1', port },
      { host: '192.0.2.10', port: 22 }
    )

    expect(requestedHost).toBe('192.0.2.10')
    expect(requestedPort).toBe(22)
    socket.destroy()
  })
})
