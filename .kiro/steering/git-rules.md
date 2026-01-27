---
inclusion: always
---

# Git 仓库规则（项目特定）

## 仓库说明

- **私有仓库**: `hj01857655/kiro-account-manager_dev` - 开发用，所有代码提交到这里
- **公开仓库**: `hj01857655/kiro-account-manager` - **不开源**，仅用于发布 Release

## 私有仓库规则

- ✅ 只允许 `dev` 分支，禁止创建其他分支
- ✅ 所有开发代码提交到 `dev` 分支
- ✅ 允许打 tag（前提：workflow 必须包含 `if: ${{ !endsWith(github.repository, '_dev') }}` 判断）

## 公开仓库规则

⚠️ **严格禁止**: 公开仓库 `kiro-account-manager` **不开源**，源码已冻结在 v1.5.1！

- ❌ **禁止** 推送任何源码到公开仓库
- ❌ **禁止** 执行 `git push` 到公开仓库的任何分支
- ❌ **禁止** 添加公开仓库为 git remote（避免误操作）
- ❌ **禁止** 修改公开仓库的任何分支内容
- ❌ **禁止** 在公开仓库创建、合并 PR
- ✅ **只允许** 使用 `gh api` 在公开仓库打 tag
- ✅ **只允许** 使用 `gh release edit` 更新 Release Notes
- ✅ **例外允许** 使用 `mcp_github_create_or_update_file` 更新 `README.md`、`LICENSE` 和 `.github/workflows/`

## 更新公开仓库文件的方法

**使用 MCP GitHub 工具**（推荐）：

```javascript
// 更新 README.md
mcp_github_create_or_update_file({
  owner: "hj01857655",
  repo: "kiro-account-manager",
  path: "README.md",
  content: "...",  // 文件内容
  message: "docs: 更新 README",
  branch: "main",
  sha: "..."  // 如果是更新现有文件，需要提供 SHA
})

// 更新 workflow
mcp_github_create_or_update_file({
  owner: "hj01857655",
  repo: "kiro-account-manager",
  path: ".github/workflows/release.yml",
  content: "...",
  message: "ci: 更新 release workflow",
  branch: "main",
  sha: "..."
})
```

**获取文件 SHA**（更新现有文件时需要）：

```bash
gh api repos/hj01857655/kiro-account-manager/contents/README.md --jq '.sha'
gh api repos/hj01857655/kiro-account-manager/contents/.github/workflows/release.yml --jq '.sha'
```

## 安全保障

**发布脚本自动检查**：
- 检测是否配置了公开仓库为 remote
- 如果检测到，拒绝执行并提示删除

**AI 助手规则**：
- 禁止执行任何 `git push` 到公开仓库
- 禁止执行 `git remote add` 添加公开仓库
- 只允许使用 `gh api` 打 tag 和编辑 Release
- 只允许使用 `mcp_github_create_or_update_file` 更新 README 和 workflow

## 日常开发流程

1. 所有代码修改提交到私有仓库 `kiro-account-manager_dev` 的 `dev` 分支
2. 发布时只在公开仓库的 `releases` 分支打 tag 触发 Actions 构建
3. 绝对不要执行任何 `git push` 到公开仓库

## 发布流程

必须按照 `.kiro/hooks/release.kiro.hook` 定义的流程执行，不允许私自操作公开仓库。

## 发布失败处理

如果发布过程中出错，必须清理所有已创建的资源后才能重新开始：

### 1. 删除私有仓库的 tag
```bash
git tag -d vX.X.X
git push origin --delete vX.X.X
```

### 2. 删除公开仓库的 tag
```bash
gh api -X DELETE repos/hj01857655/kiro-account-manager/git/refs/tags/vX.X.X
```

### 3. 删除公开仓库的 Release（如已创建）
```bash
gh release delete vX.X.X -R hj01857655/kiro-account-manager --yes
```

### 4. 删除公开仓库失败和取消的 Actions 记录
```bash
# 查找失败的 Actions
gh run list -R hj01857655/kiro-account-manager --status failure --limit 10 --json databaseId --jq '.[].databaseId'

# 查找取消的 Actions
gh run list -R hj01857655/kiro-account-manager --status cancelled --limit 10 --json databaseId --jq '.[].databaseId'

# 删除指定的 Actions 记录
gh run delete <run-id> -R hj01857655/kiro-account-manager

# 批量删除失败的 Actions
gh run list -R hj01857655/kiro-account-manager --status failure --limit 10 --json databaseId --jq '.[].databaseId' | ForEach-Object { gh run delete $_ -R hj01857655/kiro-account-manager }

# 批量删除取消的 Actions
gh run list -R hj01857655/kiro-account-manager --status cancelled --limit 10 --json databaseId --jq '.[].databaseId' | ForEach-Object { gh run delete $_ -R hj01857655/kiro-account-manager }
```

### 5. 确认清理完成后再重新执行发布流程

## Release Notes 规则

**自动生成机制**：
- ✅ GitHub Actions 会自动生成两个 tag 之间的 commit 日志
- ✅ 使用 `Generate Release Notes` 步骤提取 commit 信息
- ✅ 格式：`git log ${PREVIOUS_TAG}..HEAD --pretty=format:"- %s" --no-merges`
- ✅ 自动添加下载链接

**手动编辑规则**（如需修改）：
- ❌ **禁止** 在 Release Notes 中提及 `scripts/` 目录下的任何内容（注册脚本、工具脚本等）
- ❌ **禁止** 提及私有仓库名称 `kiro-account-manager_dev`
- ❌ **禁止** 提及 `vercel-api/` 目录的内容
- ✅ 只写用户可见的功能、优化、修复
- ✅ 使用简洁的用户语言，不要技术术语

**编辑 Release Notes**：
```bash
gh release edit vX.X.X -R hj01857655/kiro-account-manager --notes "新的 Release Notes 内容"
```
