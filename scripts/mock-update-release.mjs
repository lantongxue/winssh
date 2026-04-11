import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { cwd, exit } from 'node:process'

const RELEASE_ROOT = resolve(cwd(), 'release')

function printHelp() {
  console.log(`WinSSH mock update release generator

Usage:
  npm run updates:mock -- --from 1.0.0 --to 1.0.1

Options:
  --from <version>   Source release directory under ./release
  --to <version>     Target mock release directory under ./release
  --notes <text>     Optional release notes text injected into latest.yml
  --help             Show this help text.
`)
}

function parseArgs(argv) {
  const parsed = {
    from: null,
    help: false,
    notes: null,
    to: null
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]

    if (argument === '--help' || argument === '-h') {
      parsed.help = true
      continue
    }

    if (argument === '--from') {
      parsed.from = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (argument === '--to') {
      parsed.to = argv[index + 1] ?? null
      index += 1
      continue
    }

    if (argument === '--notes') {
      parsed.notes = argv[index + 1] ?? null
      index += 1
    }
  }

  return parsed
}

function escapeYamlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`
}

function replaceVersionInFileName(fileName, fromVersion, toVersion) {
  return fileName.includes(fromVersion) ? fileName.replaceAll(fromVersion, toVersion) : fileName
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  if (!options.from || !options.to) {
    console.error('Both --from and --to are required.')
    printHelp()
    exit(1)
  }

  const sourceDirectory = join(RELEASE_ROOT, options.from)
  const targetDirectory = join(RELEASE_ROOT, options.to)
  const sourceManifestPath = join(sourceDirectory, 'latest.yml')

  if (!existsSync(sourceDirectory) || !existsSync(sourceManifestPath)) {
    console.error(`Source release is missing: ${sourceDirectory}`)
    exit(1)
  }

  const manifestText = await readFile(sourceManifestPath, 'utf8')

  const sourcePathMatch = manifestText.match(/^path:\s+(.+)$/m)
  if (!sourcePathMatch?.[1]) {
    console.error(`Could not find installer path in ${sourceManifestPath}`)
    exit(1)
  }

  const sourceInstallerName = sourcePathMatch[1].trim()
  const targetInstallerName = replaceVersionInFileName(
    sourceInstallerName,
    options.from,
    options.to
  )
  const sourceInstallerPath = join(sourceDirectory, sourceInstallerName)
  const targetInstallerPath = join(targetDirectory, targetInstallerName)

  if (!existsSync(sourceInstallerPath)) {
    console.error(`Source installer is missing: ${sourceInstallerPath}`)
    exit(1)
  }

  const sourceBlockmapName = `${sourceInstallerName}.blockmap`
  const targetBlockmapName = `${targetInstallerName}.blockmap`
  const sourceBlockmapPath = join(sourceDirectory, sourceBlockmapName)
  const sourceZipPath = join(
    sourceDirectory,
    replaceVersionInFileName(`WinSSH-Windows-${options.from}-x64.zip`, options.from, options.from)
  )
  const targetZipName = replaceVersionInFileName(basename(sourceZipPath), options.from, options.to)
  const targetZipPath = join(targetDirectory, targetZipName)

  await rm(targetDirectory, { force: true, recursive: true })
  await mkdir(targetDirectory, { recursive: true })

  await copyFile(sourceInstallerPath, targetInstallerPath)

  if (existsSync(sourceBlockmapPath)) {
    await copyFile(sourceBlockmapPath, join(targetDirectory, targetBlockmapName))
  }

  if (existsSync(sourceZipPath)) {
    await copyFile(sourceZipPath, targetZipPath)
  }

  let nextManifestText = manifestText
    .replace(/^version:\s+.+$/m, `version: ${options.to}`)
    .replace(/^releaseDate:\s+.+$/m, `releaseDate: ${escapeYamlString(new Date().toISOString())}`)
    .replace(
      new RegExp(sourceInstallerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      targetInstallerName
    )

  if (/^releaseNotes:\s+/m.test(nextManifestText)) {
    nextManifestText = nextManifestText.replace(
      /^releaseNotes:\s+.+$/m,
      `releaseNotes: ${escapeYamlString(
        options.notes ?? `Simulated update feed ${options.from} -> ${options.to}`
      )}`
    )
  } else {
    nextManifestText = `${nextManifestText.trimEnd()}\nreleaseNotes: ${escapeYamlString(
      options.notes ?? `Simulated update feed ${options.from} -> ${options.to}`
    )}\n`
  }

  await writeFile(join(targetDirectory, 'latest.yml'), nextManifestText, 'utf8')

  const noteText = [
    `This is a simulated update feed generated from ${options.from}.`,
    `Target version: ${options.to}.`,
    '',
    'Important:',
    '- Metadata reports the new version number.',
    `- The copied installer binary still comes from ${options.from}.`,
    '- This is suitable for update detection and download flow testing.',
    '- For a real install/upgrade test, build an actual packaged app at the target version.'
  ].join('\n')

  await writeFile(join(targetDirectory, 'SIMULATION-NOTE.txt'), noteText, 'utf8')

  console.log(`Created mock update release: ${targetDirectory}`)
  console.log(`Manifest: ${join(targetDirectory, 'latest.yml')}`)
  console.log(`Installer: ${targetInstallerPath}`)
}

void main()
