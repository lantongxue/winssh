module.exports = {
  git: {
    requireCleanWorkingDir: true,
    requireUpstream: true,
    requireBranch: false,
    requireCommits: true,
    commit: true,
    commitMessage: 'chore: release v${version}',
    tag: true,
    tagName: 'v${version}',
    tagAnnotation: 'v${version}\n\n${changelog}',
    push: true,
    pushArgs: ['--follow-tags']
  },

  npm: {
    publish: false
  },

  github: {
    release: false
  },

  gitlab: {
    release: false
  },

  hooks: {
    'before:init': 'git fetch --tags origin'
  },

  plugins: {
    '@release-it/conventional-changelog': {
      infile: 'CHANGELOG.md',
      preset: 'conventionalcommits'
    }
  }
}
