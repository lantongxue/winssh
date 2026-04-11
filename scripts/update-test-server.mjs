import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import http from 'node:http'
import { extname, join, normalize, resolve } from 'node:path'
import { cwd, exit } from 'node:process'
import { URL } from 'node:url'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 5500
const RELEASE_ROOT = resolve(cwd(), 'release')

const MIME_TYPES = {
  '.7z': 'application/x-7z-compressed',
  '.blockmap': 'application/octet-stream',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.yml': 'text/yaml; charset=utf-8',
  '.yaml': 'text/yaml; charset=utf-8',
  '.zip': 'application/zip'
}

function printHelp() {
  console.log(`WinSSH local update test server

Usage:
  npm run updates:serve
  npm run updates:serve -- --version 1.0.0
  npm run updates:serve -- --dir release/1.0.0 --port 5600 --host 0.0.0.0

Options:
  --dir <path>      Directory that contains latest.yml and update artifacts.
  --version <name>  Version folder under ./release to serve.
  --host <host>     Bind host. Default: ${DEFAULT_HOST}
  --port <port>     Bind port. Default: ${DEFAULT_PORT}
  --help            Show this help text.
`)
}

function parseArgs(argv) {
  const parsed = {
    dir: null,
    help: false,
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
    version: null
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--help' || argument === '-h') {
      parsed.help = true
      continue
    }

    if (argument === '--dir') {
      parsed.dir = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (argument === '--version') {
      parsed.version = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (argument === '--host') {
      parsed.host = argv[index + 1] ?? DEFAULT_HOST
      index += 1
      continue
    }

    if (argument === '--port') {
      parsed.port = Number.parseInt(argv[index + 1] ?? `${DEFAULT_PORT}`, 10)
      index += 1
    }
  }

  return parsed
}

function findNewestReleaseDirectory(rootDirectory) {
  if (!existsSync(rootDirectory)) {
    return null
  }

  const candidates = readdirSync(rootDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = join(rootDirectory, entry.name)
      const latestManifestPath = join(fullPath, 'latest.yml')

      if (!existsSync(latestManifestPath)) {
        return null
      }

      return {
        mtimeMs: statSync(fullPath).mtimeMs,
        name: entry.name,
        path: fullPath
      }
    })
    .filter(Boolean)
    .sort((left, right) => right.mtimeMs - left.mtimeMs)

  return candidates[0]?.path ?? null
}

function resolveServeDirectory(options) {
  if (options.dir) {
    return resolve(cwd(), options.dir)
  }

  if (options.version) {
    return resolve(RELEASE_ROOT, options.version)
  }

  return findNewestReleaseDirectory(RELEASE_ROOT)
}

function createIndexHtml({ host, port, serveDirectory, files }) {
  const encodedFiles = files
    .map(
      (file) =>
        `<li><a href="/${encodeURI(file)}">${file}</a></li>`
    )
    .join('\n')

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>WinSSH Local Update Feed</title>
    <style>
      body {
        margin: 0;
        padding: 32px;
        font-family: "Segoe UI", sans-serif;
        background: #0f172a;
        color: #e2e8f0;
      }
      main {
        max-width: 820px;
        margin: 0 auto;
      }
      .card {
        background: rgba(15, 23, 42, 0.86);
        border: 1px solid rgba(148, 163, 184, 0.2);
        border-radius: 16px;
        padding: 20px;
        margin-top: 16px;
      }
      code, pre {
        font-family: "Cascadia Mono", Consolas, monospace;
      }
      a { color: #7dd3fc; }
      ul { padding-left: 20px; }
    </style>
  </head>
  <body>
    <main>
      <h1>WinSSH Local Update Feed</h1>
      <div class="card">
        <p>Serving update artifacts from:</p>
        <pre><code>${serveDirectory}</code></pre>
        <p>Feed URL:</p>
        <pre><code>http://${host}:${port}</code></pre>
        <p>Use this before launching the packaged app:</p>
        <pre><code>set WINSSH_UPDATE_BASE_URL=http://${host}:${port}</code></pre>
      </div>
      <div class="card">
        <h2>Available Files</h2>
        <ul>${encodedFiles}</ul>
      </div>
    </main>
  </body>
</html>`
}

function getContentType(filePath) {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

async function ensureReadableFile(filePath) {
  await access(filePath)
  const stats = statSync(filePath)
  return stats.isFile()
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  if (!Number.isInteger(options.port) || options.port <= 0 || options.port > 65535) {
    console.error(`Invalid port: ${options.port}`)
    exit(1)
  }

  const serveDirectory = resolveServeDirectory(options)
  if (!serveDirectory || !existsSync(serveDirectory)) {
    console.error('Could not find a release directory to serve.')
    console.error('Build a Windows release first, or pass --dir / --version explicitly.')
    exit(1)
  }

  const manifestPath = join(serveDirectory, 'latest.yml')
  if (!existsSync(manifestPath)) {
    console.error(`Missing latest.yml in ${serveDirectory}`)
    exit(1)
  }

  const files = readdirSync(serveDirectory)
    .filter((entry) => statSync(join(serveDirectory, entry)).isFile())
    .sort((left, right) => left.localeCompare(right))

  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
    const pathname = decodeURIComponent(requestUrl.pathname)

    if (pathname === '/' || pathname === '/index.html') {
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8'
      })
      response.end(
        createIndexHtml({
          files,
          host: options.host,
          port: options.port,
          serveDirectory
        })
      )
      return
    }

    if (pathname === '/health') {
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8'
      })
      response.end(
        JSON.stringify({
          ok: true,
          serveDirectory
        })
      )
      return
    }

    const relativePath = normalize(pathname).replace(/^([/\\])+/, '')
    const filePath = resolve(serveDirectory, relativePath)
    if (!filePath.startsWith(resolve(serveDirectory))) {
      response.writeHead(403, {
        'Content-Type': 'text/plain; charset=utf-8'
      })
      response.end('Forbidden')
      return
    }

    try {
      const isFile = await ensureReadableFile(filePath)
      if (!isFile) {
        throw new Error('Not a file')
      }

      if (extname(filePath).toLowerCase() === '.yml') {
        const body = await readFile(filePath)
        response.writeHead(200, {
          'Cache-Control': 'no-store',
          'Content-Type': getContentType(filePath)
        })
        response.end(body)
        return
      }

      response.writeHead(200, {
        'Cache-Control': 'no-store',
        'Content-Type': getContentType(filePath)
      })
      createReadStream(filePath).pipe(response)
    } catch {
      response.writeHead(404, {
        'Content-Type': 'text/plain; charset=utf-8'
      })
      response.end('Not Found')
    }
  })

  server.listen(options.port, options.host, () => {
    console.log(`WinSSH update test server listening on http://${options.host}:${options.port}`)
    console.log(`Serving directory: ${serveDirectory}`)
    console.log(`Feed manifest: http://${options.host}:${options.port}/latest.yml`)
  })
}

void main()
