import { spawnSync } from 'node:child_process'
import { mkdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = resolve(repoRoot, 'src/native/macos/list-fonts.m')
const outputPath = resolve(repoRoot, 'resources/bin/macos-list-fonts')

if (process.platform !== 'darwin') {
  process.exit(0)
}

async function shouldRebuild() {
  if (!existsSync(outputPath)) {
    return true
  }

  const [sourceStat, outputStat] = await Promise.all([stat(sourcePath), stat(outputPath)])
  return sourceStat.mtimeMs > outputStat.mtimeMs
}

async function main() {
  if (!(await shouldRebuild())) {
    return
  }

  await mkdir(dirname(outputPath), { recursive: true })

  const result = spawnSync(
    'xcrun',
    [
      '--sdk',
      'macosx',
      'clang',
      '-fobjc-arc',
      '-framework',
      'Foundation',
      '-framework',
      'CoreText',
      sourcePath,
      '-o',
      outputPath
    ],
    {
      stdio: 'inherit'
    }
  )

  if (result.status !== 0) {
    console.warn(
      '[build-macos-font-helper] Failed to compile native macOS font helper. Falling back to system_profiler at runtime.'
    )
  }
}

await main()
