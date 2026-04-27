// Standard Version 配置
module.exports = {
  // 不自动推送 tag（因为需要手动处理双仓库）
  skip: {
    tag: true
  },
  
  // 生成的文件
  infile: 'CHANGELOG.md',
  
  // Commit message 格式
  header: '# 更新日志\n\n所有重要的变更都会记录在这个文件中。\n\n',
  
  // 类型映射（中文）
  types: [
    { type: 'feat', section: '✨ 新功能' },
    { type: 'fix', section: '🐛 Bug 修复' },
    { type: 'perf', section: '⚡ 性能优化' },
    { type: 'refactor', section: '♻️ 代码重构' },
    { type: 'docs', section: '📝 文档更新' },
    { type: 'style', section: '💄 代码格式' },
    { type: 'test', section: '✅ 测试' },
    { type: 'build', section: '📦 构建系统' },
    { type: 'ci', section: '👷 CI 配置' },
    { type: 'chore', section: '🔧 其他变更' }
  ]
}
