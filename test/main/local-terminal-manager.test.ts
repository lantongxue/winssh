import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('LocalTerminalManager shell integration', () => {
  it('does not install shell integration through visible temporary files', () => {
    const source = readFileSync('src/main/local-terminal-manager.ts', 'utf8')

    expect(source).not.toContain('.winssh_init_')
    expect(source).not.toContain('writeFileSync(tempFilePath')
  })
})
