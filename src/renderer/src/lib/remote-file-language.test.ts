import { describe, expect, it } from 'vitest'
import { getRemoteFileLanguage } from '@/lib/remote-file-language'

describe('getRemoteFileLanguage', () => {
  it.each([
    ['/home/alice/.bashrc', 'shell'],
    ['/home/alice/.bash_profile', 'shell'],
    ['/home/alice/.zshrc', 'shell'],
    ['/app/.env', 'ini'],
    ['/app/.env.local', 'ini'],
    ['/app/.env.production', 'ini'],
    ['/app/.envrc', 'shell'],
    ['/repo/.babelrc', 'json'],
    ['/repo/.editorconfig', 'ini'],
    ['/repo/.gitignore', 'plaintext'],
    ['/repo/.npmrc', 'ini'],
    ['/repo/.prettierrc', 'json'],
    ['/repo/Dockerfile', 'dockerfile'],
    ['/repo/Makefile', 'shell'],
    ['/repo/docker-compose.yml', 'yaml'],
    ['/repo/package-lock.json', 'json'],
    ['/repo/settings.jsonc', 'json'],
    ['/repo/src/App.tsx', 'typescript'],
    ['/repo/scripts/deploy.sh', 'shell']
  ])('maps %s to %s', (remotePath, expectedLanguage) => {
    expect(getRemoteFileLanguage(remotePath)).toBe(expectedLanguage)
  })
})
