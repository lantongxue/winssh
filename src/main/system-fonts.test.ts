import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getAppPath: vi.fn(() => '/repo')
  }
}))

import { SystemFontService } from './system-fonts'

describe('SystemFontService', () => {
  it('uses the native macOS helper before falling back to system_profiler', async () => {
    const runCommand = vi.fn(async (command: string) => {
      if (command === '/packaged/Resources/bin/macos-list-fonts') {
        return 'SF Mono\nMenlo\n'
      }

      return ''
    })

    const service = new SystemFontService({
      getAppPath: () => '/repo',
      getCurrentDirectory: () => '/repo/out/main',
      getResourcesPath: () => '/packaged/Resources',
      getWorkingDirectory: () => '/repo',
      platform: 'darwin',
      runCommand
    })

    await expect(service.listFonts()).resolves.toEqual(['Menlo', 'SF Mono'])
    expect(runCommand).toHaveBeenCalledTimes(1)
    expect(runCommand).toHaveBeenCalledWith('/packaged/Resources/bin/macos-list-fonts', [])
  })

  it('falls back to system_profiler when the native helper is unavailable', async () => {
    const runCommand = vi.fn(async (command: string) => {
      if (command === '/usr/sbin/system_profiler') {
        return JSON.stringify({
          SPFontsDataType: [{ _name: 'Menlo' }, { _name: 'SF Mono' }]
        })
      }

      return ''
    })

    const service = new SystemFontService({
      getAppPath: () => '/repo',
      getCurrentDirectory: () => '/repo/out/main',
      getResourcesPath: () => '/packaged/Resources',
      getWorkingDirectory: () => '/repo',
      platform: 'darwin',
      runCommand
    })

    await expect(service.listFonts()).resolves.toEqual(['Menlo', 'SF Mono'])
    expect(runCommand).toHaveBeenNthCalledWith(1, '/packaged/Resources/bin/macos-list-fonts', [])
    expect(runCommand).toHaveBeenNthCalledWith(2, '/repo/resources/bin/macos-list-fonts', [])
    expect(runCommand).toHaveBeenNthCalledWith(3, '/usr/sbin/system_profiler', [
      '-json',
      'SPFontsDataType'
    ])
  })

  it('falls back to fc-list after system_profiler if needed', async () => {
    const runCommand = vi.fn(async (command: string, args: string[]) => {
      if (command === 'fc-list') {
        expect(args).toEqual([':', 'family'])
        return 'SF Mono:style=Regular\nMenlo:style=Regular\n'
      }

      return ''
    })

    const service = new SystemFontService({
      getAppPath: () => '/repo',
      getCurrentDirectory: () => '/repo/out/main',
      getResourcesPath: () => '/packaged/Resources',
      getWorkingDirectory: () => '/repo',
      platform: 'darwin',
      runCommand
    })

    await expect(service.listFonts()).resolves.toEqual(['Menlo', 'SF Mono'])
    expect(runCommand).toHaveBeenNthCalledWith(1, '/packaged/Resources/bin/macos-list-fonts', [])
    expect(runCommand).toHaveBeenNthCalledWith(2, '/repo/resources/bin/macos-list-fonts', [])
    expect(runCommand).toHaveBeenNthCalledWith(3, '/usr/sbin/system_profiler', [
      '-json',
      'SPFontsDataType'
    ])
    expect(runCommand).toHaveBeenNthCalledWith(4, 'fc-list', [':', 'family'])
  })
})
