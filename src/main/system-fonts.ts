import { execFile, spawnSync } from 'node:child_process'
import { constants as fsConstants } from 'node:fs'
import { access, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import { app } from 'electron'

const execFileAsync = promisify(execFile)
const MAX_BUFFER_BYTES = 16 * 1024 * 1024
const MAC_FONT_HELPER_NAME = 'macos-list-fonts'
const MACOS_SYSTEM_PROFILER_PATH = '/usr/sbin/system_profiler'
const MACOS_XCRUN_PATH = '/usr/bin/xcrun'

type RunCommand = (command: string, args: string[]) => Promise<string>

type SystemFontServiceOptions = {
  getAppPath?: () => string
  getCurrentDirectory?: () => string
  getResourcesPath?: () => string
  getWorkingDirectory?: () => string
  platform?: NodeJS.Platform
  runCommand?: RunCommand
}

function normalizeFontNames(values: string[]): string[] {
  return [
    ...new Set(values.map((value) => value.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean))
  ].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
}

function parseLineSeparatedFonts(stdout: string): string[] {
  return normalizeFontNames(stdout.split(/\r?\n/))
}

function parseFontconfigFonts(stdout: string): string[] {
  return normalizeFontNames(
    stdout.split(/\r?\n/).flatMap((line) => {
      const [families = ''] = line.split(':', 1)
      return families.split(',')
    })
  )
}

function parseWindowsRegistryFonts(stdout: string): string[] {
  return normalizeFontNames(
    stdout
      .split(/\r?\n/)
      .map((line) => line.match(/^\s+(.+?)\s+REG_\w+\s+/)?.[1] ?? '')
      .map((line) => line.replace(/\s*\([^()]+\)\s*$/u, ''))
  )
}

function parseMacSystemProfilerFonts(stdout: string): string[] {
  try {
    const parsed = JSON.parse(stdout) as {
      SPFontsDataType?: Array<{
        _name?: string
      }>
    }

    return normalizeFontNames(
      (parsed.SPFontsDataType ?? []).map((entry) =>
        typeof entry._name === 'string' ? entry._name : ''
      )
    )
  } catch {
    return []
  }
}

function getMacFontHelperCandidates(candidateRoots: string[]): string[] {
  return [...new Set(candidateRoots.map((root) => join(root, 'bin', MAC_FONT_HELPER_NAME)))]
}

async function hasExecutableAccess(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.X_OK)
    return true
  } catch {
    return false
  }
}

async function hasFileAccess(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.F_OK)
    return true
  } catch {
    return false
  }
}

function compileMacFontHelper(sourcePath: string, outputPath: string): boolean {
  const result = spawnSync(
    MACOS_XCRUN_PATH,
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
      stdio: 'ignore'
    }
  )

  return result.status === 0
}

function logFontDebug(message: string, ...details: string[]) {
  if (app.isPackaged) {
    return
  }

  console.info('[system-fonts]', message, ...details)
}

async function runCommand(command: string, args: string[]): Promise<string> {
  try {
    const { stdout } = await execFileAsync(command, args, {
      maxBuffer: MAX_BUFFER_BYTES,
      windowsHide: true
    })
    return stdout
  } catch {
    return ''
  }
}

async function listWindowsFonts(runCommandImpl: RunCommand): Promise<string[]> {
  const powershellFonts = parseLineSeparatedFonts(
    await runCommandImpl('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-STA',
      '-Command',
      'Add-Type -AssemblyName PresentationCore; [System.Windows.Media.Fonts]::SystemFontFamilies | ForEach-Object { $_.Source }'
    ])
  )

  if (powershellFonts.length > 0) {
    return powershellFonts
  }

  const registryFonts = parseWindowsRegistryFonts(
    [
      await runCommandImpl('reg.exe', [
        'query',
        'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'
      ]),
      await runCommandImpl('reg.exe', [
        'query',
        'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'
      ])
    ].join('\n')
  )

  return registryFonts
}

async function listLinuxFonts(runCommandImpl: RunCommand): Promise<string[]> {
  return parseFontconfigFonts(await runCommandImpl('fc-list', [':', 'family']))
}

async function listMacFonts(
  runCommandImpl: RunCommand,
  candidateRoots: string[]
): Promise<string[]> {
  for (const helperPath of getMacFontHelperCandidates(candidateRoots)) {
    if (await hasExecutableAccess(helperPath)) {
      logFontDebug('trying macOS font helper', helperPath)
    }

    const helperFonts = parseLineSeparatedFonts(await runCommandImpl(helperPath, []))

    if (helperFonts.length > 0) {
      logFontDebug('macOS font helper returned fonts', helperPath, String(helperFonts.length))
      return helperFonts
    }
  }

  logFontDebug('falling back to system_profiler')
  const systemProfilerFonts = parseMacSystemProfilerFonts(
    await runCommandImpl(MACOS_SYSTEM_PROFILER_PATH, ['-json', 'SPFontsDataType'])
  )

  if (systemProfilerFonts.length > 0) {
    logFontDebug('system_profiler returned fonts', String(systemProfilerFonts.length))
    return systemProfilerFonts
  }

  logFontDebug('falling back to fc-list')
  return listLinuxFonts(runCommandImpl)
}

export class SystemFontService {
  private fontsPromise: Promise<string[]> | null = null
  private readonly getAppPath: () => string
  private readonly getCurrentDirectory: () => string
  private readonly getResourcesPath: () => string
  private readonly getWorkingDirectory: () => string
  private readonly platform: NodeJS.Platform
  private readonly runCommand: RunCommand

  constructor(options: SystemFontServiceOptions = {}) {
    this.getAppPath = options.getAppPath ?? (() => app.getAppPath())
    this.getCurrentDirectory = options.getCurrentDirectory ?? (() => __dirname)
    this.getResourcesPath = options.getResourcesPath ?? (() => process.resourcesPath)
    this.getWorkingDirectory = options.getWorkingDirectory ?? (() => process.cwd())
    this.platform = options.platform ?? process.platform
    this.runCommand = options.runCommand ?? runCommand
  }

  listFonts(): Promise<string[]> {
    if (!this.fontsPromise) {
      this.fontsPromise = this.loadFonts().then((fonts) => {
        if (fonts.length === 0) {
          this.fontsPromise = null
        }

        return fonts
      })
    }

    return this.fontsPromise
  }

  private getMacHelperRoots(appPath: string): string[] {
    return [
      this.getResourcesPath(),
      ...(appPath.endsWith('.asar') ? [join(appPath, '..')] : []),
      join(appPath, 'resources'),
      join(this.getWorkingDirectory(), 'resources'),
      join(this.getCurrentDirectory(), '..', '..', 'resources')
    ]
  }

  private getMacHelperSourceCandidates(appPath: string): string[] {
    return [
      join(appPath, 'src', 'native', 'macos', 'list-fonts.m'),
      join(this.getWorkingDirectory(), 'src', 'native', 'macos', 'list-fonts.m'),
      join(this.getCurrentDirectory(), '..', '..', 'src', 'native', 'macos', 'list-fonts.m')
    ]
  }

  private async ensureMacHelperAvailable(candidateRoots: string[], appPath: string): Promise<void> {
    const helperCandidates = getMacFontHelperCandidates(candidateRoots)

    for (const helperPath of helperCandidates) {
      if (await hasExecutableAccess(helperPath)) {
        logFontDebug('found existing macOS font helper', helperPath)
        return
      }
    }

    if (app.isPackaged) {
      logFontDebug('skipping helper compilation in packaged app')
      return
    }

    let resolvedSourcePath: string | null = null
    for (const candidate of this.getMacHelperSourceCandidates(appPath)) {
      if (await hasFileAccess(candidate)) {
        resolvedSourcePath = candidate
        break
      }
    }

    if (!resolvedSourcePath) {
      logFontDebug('macOS helper source not found')
      return
    }

    for (const root of candidateRoots) {
      const outputPath = join(root, 'bin', MAC_FONT_HELPER_NAME)

      try {
        await mkdir(dirname(outputPath), { recursive: true })
      } catch {
        logFontDebug('failed to create helper directory', dirname(outputPath))
        continue
      }

      logFontDebug('compiling macOS font helper', resolvedSourcePath, outputPath)
      if (compileMacFontHelper(resolvedSourcePath, outputPath)) {
        logFontDebug('compiled macOS font helper', outputPath)
        return
      }

      logFontDebug('failed to compile macOS font helper', outputPath)
    }
  }

  private async loadFonts(): Promise<string[]> {
    switch (this.platform) {
      case 'win32':
        return listWindowsFonts(this.runCommand)
      case 'darwin': {
        const appPath = this.getAppPath()
        const helperRoots = this.getMacHelperRoots(appPath)

        await this.ensureMacHelperAvailable(helperRoots, appPath)

        const fonts = await listMacFonts(this.runCommand, helperRoots)

        if (fonts.length === 0) {
          logFontDebug('native helper unavailable, fell back to empty result', ...helperRoots)
        }

        return fonts
      }
      case 'linux':
        return listLinuxFonts(this.runCommand)
      default:
        return []
    }
  }
}
