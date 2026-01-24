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
- ✅ **例外允许** 通过 `gh api` 更新 `README.md`、`LICENSE` 和 `.github/workflows/`

## 安全保障

**发布脚本自动检查**：
- 检测是否配置了公开仓库为 remote
- 如果检测到，拒绝执行并提示删除

**AI 助手规则**：
- 禁止执行任何 `git push` 到公开仓库
- 禁止执行 `git remote add` 添加公开仓库
- 只允许使用 `gh api` 操作公开仓库

## 日常开发流程

1. 所有代码修改提交到私有仓库 `kiro-account-manager_dev` 的 `dev` 分支
2. 发布时只在公开仓库的 `releases` 分支打 tag 触发 Actions 构建
3. 绝对不要执行任何 `git push` 到公开仓库

## 发布流程

必须按照 `.kiro/hooks/release.kiro.hook` 定义的流程执行，不允许私自操作公开仓库。

## 发布失败处理

如果发布过程中出错，必须清理所有已创建的资源后才能重新开始：
- 删除私有仓库的 tag：`git tag -d vX.X.X` 然后 `git push origin --delete vX.X.X`
- 删除公开仓库的 tag：`gh api -X DELETE repos/hj01857655/kiro-account-manager/git/refs/tags/vX.X.X`
- 删除公开仓库的 Release（如已创建）：`gh release delete vX.X.X -R hj01857655/kiro-account-manager --yes`
- 删除公开仓库失败的 Actions 记录：`gh run delete <run-id> -R hj01857655/kiro-account-manager`
- 确认清理完成后再重新执行发布流程

## Release Notes 规则

- ❌ **禁止** 在 Release Notes 中提及 `scripts/` 目录下的任何内容（注册脚本、工具脚本等）
- ❌ **禁止** 提及私有仓库名称 `kiro-account-manager_dev`
- ❌ **禁止** 提及 `vercel-api/` 目录的内容
- ✅ 只写用户可见的功能、优化、修复
- ✅ 使用简洁的用户语言，不要技术术语
