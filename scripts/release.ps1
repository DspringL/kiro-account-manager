# Kiro Account Manager 发布脚本（PowerShell）
# 处理双仓库机制：私有仓库开发，公开仓库发布
# ⚠️ 严格禁止：不推送任何源码到公开仓库

$ErrorActionPreference = "Stop"

Write-Host "🚀 开始发布流程..." -ForegroundColor Cyan

# 0. 安全检查：确保没有配置公开仓库为远程仓库
$remotes = git remote -v
if ($remotes -match "kiro-account-manager\.git") {
    Write-Host "❌ 错误：检测到公开仓库配置，禁止推送源码！" -ForegroundColor Red
    Write-Host "   请删除公开仓库远程配置：git remote remove <name>" -ForegroundColor Yellow
    exit 1
}

# 1. 确保在 dev 分支
$branch = git branch --show-current
if ($branch -ne "dev") {
    Write-Host "❌ 错误：必须在 dev 分支执行发布" -ForegroundColor Red
    exit 1
}

# 2. 确保工作区干净
$status = git status --porcelain
if ($status) {
    Write-Host "❌ 错误：工作区有未提交的更改" -ForegroundColor Red
    exit 1
}

# 3. 运行 standard-version（生成 CHANGELOG 和更新版本号）
Write-Host "📝 生成 CHANGELOG 和更新版本号..." -ForegroundColor Yellow
npm run release

# 4. 获取新版本号
$packageJson = Get-Content package.json | ConvertFrom-Json
$newVersion = $packageJson.version
Write-Host "✅ 新版本：v$newVersion" -ForegroundColor Green

# 5. 提交版本更新
Write-Host "📦 提交版本更新..." -ForegroundColor Yellow
git add -A
git commit -m "chore: release v$newVersion"
git push origin dev

# 6. 在私有仓库打 tag
Write-Host "🏷️  在私有仓库打 tag..." -ForegroundColor Yellow
git tag "v$newVersion"
git push origin "v$newVersion"

# 7. 在公开仓库打 tag（不推送源码）
Write-Host "🏷️  在公开仓库打 tag..." -ForegroundColor Yellow
$commitSha = git rev-parse HEAD
gh api -X POST repos/hj01857655/kiro-account-manager/git/refs `
  -f ref="refs/tags/v$newVersion" `
  -f sha="$commitSha"

Write-Host ""
Write-Host "✅ 发布完成！" -ForegroundColor Green
Write-Host ""
Write-Host "📦 发布信息：" -ForegroundColor Cyan
Write-Host "   版本：v$newVersion"
Write-Host "   私有仓库：已推送代码和 tag"
Write-Host "   公开仓库：已打 tag（Actions 会自动 checkout 代码并构建）"
Write-Host ""
Write-Host "🔗 查看构建进度："
Write-Host "   https://github.com/hj01857655/kiro-account-manager/actions"
Write-Host ""
