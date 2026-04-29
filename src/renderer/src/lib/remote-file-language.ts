const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  '.bash': 'shell',
  '.bat': 'bat',
  '.c': 'c',
  '.cc': 'cpp',
  '.cfg': 'ini',
  '.conf': 'ini',
  '.config': 'ini',
  '.cpp': 'cpp',
  '.cs': 'csharp',
  '.css': 'css',
  '.env': 'ini',
  '.go': 'go',
  '.h': 'cpp',
  '.hpp': 'cpp',
  '.htm': 'html',
  '.html': 'html',
  '.ini': 'ini',
  '.java': 'java',
  '.js': 'javascript',
  '.json': 'json',
  '.jsonc': 'json',
  '.jsx': 'javascript',
  '.less': 'less',
  '.log': 'plaintext',
  '.lua': 'lua',
  '.md': 'markdown',
  '.mjs': 'javascript',
  '.php': 'php',
  '.properties': 'ini',
  '.ps1': 'powershell',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.scss': 'scss',
  '.sh': 'shell',
  '.sql': 'sql',
  '.toml': 'ini',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.txt': 'plaintext',
  '.xml': 'xml',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.zsh': 'shell'
}

const LANGUAGE_BY_FILE_NAME: Record<string, string> = {
  '.bash_aliases': 'shell',
  '.bash_logout': 'shell',
  '.bash_profile': 'shell',
  '.bashrc': 'shell',
  '.editorconfig': 'ini',
  '.babelrc': 'json',
  '.dockerignore': 'plaintext',
  '.eslintrc': 'json',
  '.env': 'ini',
  '.envrc': 'shell',
  '.gitattributes': 'ini',
  '.gitconfig': 'ini',
  '.gitignore': 'plaintext',
  '.npmrc': 'ini',
  '.profile': 'shell',
  '.prettierignore': 'plaintext',
  '.prettierrc': 'json',
  '.stylelintrc': 'json',
  '.swcrc': 'json',
  '.yarnrc': 'ini',
  '.zlogin': 'shell',
  '.zlogout': 'shell',
  '.zprofile': 'shell',
  '.zshenv': 'shell',
  '.zshrc': 'shell',
  config: 'ini',
  dockerfile: 'dockerfile',
  makefile: 'shell'
}

export function getRemoteFileName(remotePath: string) {
  return remotePath.split('/').filter(Boolean).at(-1) ?? remotePath
}

function getRemoteFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex <= 0 || lastDotIndex === fileName.length - 1) {
    return ''
  }

  return fileName.slice(lastDotIndex)
}

export function getRemoteFileLanguage(remotePath: string) {
  const fileName = getRemoteFileName(remotePath).toLowerCase()
  const byName = LANGUAGE_BY_FILE_NAME[fileName]
  if (byName) {
    return byName
  }

  if (fileName.startsWith('.env.')) {
    return 'ini'
  }

  const extension = getRemoteFileExtension(fileName)
  return extension ? (LANGUAGE_BY_EXTENSION[extension] ?? 'plaintext') : 'plaintext'
}
