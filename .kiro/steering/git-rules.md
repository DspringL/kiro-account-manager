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
- ✅ **只允许** 使用以下工具操作公开仓库：
  - `mcp_github_create_or_update_file` - 更新小文件（`README.md`、`LICENSE`、`.github/workflows/`）
  - `gh api` - 更新大文件（`Cargo.lock`）、打 tag、编辑 Release
  - `mcp_github_list_commits` - 获取最新 commit SHA（打 tag 需要）

- ✅ **只允许** 使用以下工具操作公开仓库：
  - `mcp_github_create_or_update_file` - 更新小文件（`README.md`、`LICENSE`、`.github/workflows/`）
  - `gh api` - 更新大文件（`Cargo.lock`）、打 tag、编辑 Release

## 更新公开仓库文件的方法

### 小文件（< 1MB）- 使用 MCP GitHub 工具

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

### 大文件（Cargo.lock）- 使用 gh api

**原因**：Cargo.lock 文件太大（通常几千行），不能直接用 MCP 工具上传，需要用 `gh api` 上传。

```powershell
# 1. 读取文件并转换为 Base64
$content = Get-Content "src-tauri/Cargo.lock" -Raw
$base64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content))

# 2. 创建 JSON 文件
@{
  message = "chore: 更新 Cargo.lock"
  content = $base64
  sha = "旧文件的 SHA"
} | ConvertTo-Json | Out-File -FilePath "update_cargo_lock.json" -Encoding UTF8

# 3. 上传文件
gh api -X PUT repos/hj01857655/kiro-account-manager/contents/src-tauri/Cargo.lock --input update_cargo_lock.json --jq '.commit.sha'

# 4. 清理临时文件
Remove-Item "update_cargo_lock.json" -Force
```

**获取文件 SHA**（更新现有文件时需要）：

```bash
gh api repos/hj01857655/kiro-account-manager/contents/README.md --jq '.sha'
gh api repos/hj01857655/kiro-account-manager/contents/src-tauri/Cargo.lock --jq '.sha'
```

## 安全保障

**发布脚本自动检查**：
- 检测是否配置了公开仓库为 remote
- 如果检测到，拒绝执行并提示删除

**AI 助手规则**：
- 禁止执行任何 `git push` 到公开仓库
- 禁止执行 `git remote add` 添加公开仓库
- 小文件用 `mcp_github_create_or_update_file` 更新
- 大文件（Cargo.lock）用 `gh api` 上传
- 打 tag 用 `gh api`
- 编辑 Release 用 `gh release edit`

## 日常开发流程

1. 所有代码修改提交到私有仓库 `kiro-account-manager_dev` 的 `dev` 分支
2. 发布时只在公开仓库的 `releases` 分支打 tag 触发 Actions 构建
3. 绝对不要执行任何 `git push` 到公开仓库

## 发布流程

必须按照 `.kiro/hooks/release.kiro.hook` 定义的流程执行，不允许私自操作公开仓库。

## 发布失败处理

⚠️ **强制规则**：发布失败后，**必须先执行完整清理流程**，再重新开始！

### 完整清理流程（按顺序执行）

#### 1. 删除公开仓库的 tag
```bash
gh api -X DELETE repos/hj01857655/kiro-account-manager/git/refs/tags/vX.X.X
```

#### 2. 删除公开仓库的 Release（如已创建）
```bash
gh release delete vX.X.X -R hj01857655/kiro-account-manager --yes
```

#### 3. 删除公开仓库失败的 Actions 记录
```bash
# 批量删除失败的 Actions
gh run list -R hj01857655/kiro-account-manager --status failure --limit 10 --json databaseId --jq '.[].databaseId' | ForEach-Object { gh run delete $_ -R hj01857655/kiro-account-manager }
```

#### 4. 删除私有仓库的 tag
```bash
git tag -d vX.X.X
git push origin --delete vX.X.X
```

#### 5. 修复问题后，重新打 tag
```bash
# 提交修复代码
git add .
git commit -m "fix: 修复问题描述"
git push origin dev

# 重新打 tag
git tag vX.X.X
git push origin vX.X.X
```

#### 6. 在公开仓库重新打 tag 触发构建
```bash
# 获取公开仓库最新 commit SHA
gh api repos/hj01857655/kiro-account-manager/commits/main --jq '.sha'

# 打 tag
gh api -X POST repos/hj01857655/kiro-account-manager/git/refs -f ref="refs/tags/vX.X.X" -f sha="<commit-sha>"
```

### ⚠️ 常见错误

**错误 1**：不清理就重新打 tag
```bash
# ❌ 错误：tag 已存在
gh api -X POST repos/.../git/refs -f ref="refs/tags/v1.7.7" -f sha="..."
# 报错：Reference already exists
```

**错误 2**：忘记删除失败的 Actions
- 导致 Actions 列表混乱
- 无法判断哪次构建是最新的

**错误 3**：只删除公开仓库 tag，不删除私有仓库 tag
- 导致私有仓库和公开仓库 tag 指向不同的 commit
- workflow checkout 私有仓库时会拉取旧代码

### ✅ 正确流程示例

```bash
# 1. 清理公开仓库
gh api -X DELETE repos/hj01857655/kiro-account-manager/git/refs/tags/v1.7.7
gh release delete v1.7.7 -R hj01857655/kiro-account-manager --yes
gh run list -R hj01857655/kiro-account-manager --status failure --limit 10 --json databaseId --jq '.[].databaseId' | ForEach-Object { gh run delete $_ -R hj01857655/kiro-account-manager }

# 2. 清理私有仓库
git tag -d v1.7.7
git push origin --delete v1.7.7

# 3. 修复问题
git add src-tauri/Cargo.toml
git commit -m "fix: 禁用 strip 避免 Tauri 更新器问题"
git push origin dev

# 4. 重新打 tag
git tag v1.7.7
git push origin v1.7.7

# 5. 触发构建
gh api repos/hj01857655/kiro-account-manager/commits/main --jq '.sha'
gh api -X POST repos/hj01857655/kiro-account-manager/git/refs -f ref="refs/tags/v1.7.7" -f sha="<commit-sha>"
```

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
