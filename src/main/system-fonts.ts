import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const MAX_BUFFER_BYTES = 16 * 1024 * 1024

function normalizeFontNames(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' })
  )
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
      (parsed.SPFontsDataType ?? []).map((entry) => (typeof entry._name === 'string' ? entry._name : ''))
    )
  } catch {
    return []
  }
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

async function listWindowsFonts(): Promise<string[]> {
  const powershellFonts = parseLineSeparatedFonts(
    await runCommand('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-STA',
      '-Command',
      "Add-Type -AssemblyName PresentationCore; [System.Windows.Media.Fonts]::SystemFontFamilies | ForEach-Object { $_.Source }"
    ])
  )

  if (powershellFonts.length > 0) {
    return powershellFonts
  }

  const registryFonts = parseWindowsRegistryFonts(
    [
      await runCommand('reg.exe', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts']),
      await runCommand('reg.exe', ['query', 'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'])
    ].join('\n')
  )

  return registryFonts
}

async function listLinuxFonts(): Promise<string[]> {
  return parseFontconfigFonts(await runCommand('fc-list', [':', 'family']))
}

async function listMacFonts(): Promise<string[]> {
  const systemProfilerFonts = parseMacSystemProfilerFonts(
    await runCommand('system_profiler', ['-json', 'SPFontsDataType'])
  )

  if (systemProfilerFonts.length > 0) {
    return systemProfilerFonts
  }

  return listLinuxFonts()
}

export class SystemFontService {
  private fontsPromise: Promise<string[]> | null = null

  listFonts(): Promise<string[]> {
    if (!this.fontsPromise) {
      this.fontsPromise = this.loadFonts()
    }

    return this.fontsPromise
  }

  private async loadFonts(): Promise<string[]> {
    switch (process.platform) {
      case 'win32':
        return listWindowsFonts()
      case 'darwin':
        return listMacFonts()
      case 'linux':
        return listLinuxFonts()
      default:
        return []
    }
  }
}
