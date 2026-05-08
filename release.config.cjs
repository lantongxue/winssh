module.exports = {
  branches: [
    'main',
    { name: 'develop', prerelease: 'beta' }
  ],
  tagFormat: 'v${version}',
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { breaking: true, release: 'major' },
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { type: 'security', release: 'patch' },
          { type: 'revert', release: 'patch' },
          { type: 'docs', release: 'patch' },
          { type: 'style', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'test', release: false },
          { type: 'build', release: false },
          { type: 'ci', release: false },
          { type: 'chore', release: false }
        ]
      }
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: {
          types: [
            { type: 'feat', section: '✨ 新功能', hidden: false },
            { type: 'fix', section: '🐛 问题修复', hidden: false },
            { type: 'perf', section: '⚡ 性能优化', hidden: false },
            { type: 'security', section: '🔐 安全修复', hidden: false },
            { type: 'revert', section: '⏪ 回滚', hidden: false },
            { type: 'docs', section: '📝 文档', hidden: true },
            { type: 'style', section: '💄 代码格式', hidden: true },
            { type: 'refactor', section: '♻️ 重构', hidden: true },
            { type: 'test', section: '✅ 测试', hidden: true },
            { type: 'build', section: '📦 构建', hidden: true },
            { type: 'ci', section: '👷 CI', hidden: true },
            { type: 'chore', section: '🔧 杂务', hidden: true }
          ]
        }
      }
    ],
    [
      '@semantic-release/changelog',
      {
        changelogFile: 'CHANGELOG.md',
        changelogTitle: '# 更新日志'
      }
    ],
    [
      '@semantic-release/git',
      {
        assets: ['CHANGELOG.md'],
        message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}'
      }
    ]
  ]
};