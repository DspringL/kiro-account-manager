# GitHub Actions 构建流程说明

## 📋 概述

本项目配置了三个 GitHub Actions 工作流，用于自动化构建和发布流程：

1. **release.yml** - 正式发布工作流（推送 tag 或手动触发）
2. **manual.yml** - 手动构建工作流（仅手动触发，用于测试）
3. **version-management.yml** - 版本管理工作流

## 🚀 使用方式

### 方式一：使用快速发布脚本（最推荐）

```bash
# 补丁版本（1.8.3 → 1.8.4）
./scripts/quick-release.sh patch

# 次版本（1.8.3 → 1.9.0）
./scripts/quick-release.sh minor

# 主版本（1.8.3 → 2.0.0）
./scripts/quick-release.sh major

# 自定义版本
./scripts/quick-release.sh 1.8.4
```

**脚本会自动**：
- ✅ 检查分支和未提交更改
- ✅ 更新 package.json、tauri.conf.json、Cargo.toml
- ✅ 创建 Git 标签
- ✅ 推送到远程仓库
- ✅ 触发 GitHub Actions 构建

### 方式二：推送 Tag 自动构建

当你推送版本标签时，会自动触发构建和发布：

```bash
# 1. 更新版本号
npm version patch  # 或 minor, major

# 2. 手动更新其他文件
# src-tauri/tauri.conf.json
# src-tauri/Cargo.toml

# 3. 推送标签
git push origin v1.8.4
```

**触发条件**：推送 `v*` 格式的标签（如 v1.8.4, v2.0.0）

**自动执行**：
- ✅ 构建 macOS (Intel & Apple Silicon)
- ✅ 构建 Windows
- ✅ 构建 Linux (deb, AppImage, rpm)
- ✅ 创建 GitHub Release
- ✅ 上传所有构建产物
- ✅ 生成 Linux 更新 JSON

### 方式三：手动触发正式发布

用于正式发布或测试：

1. 进入仓库的 **Actions** 标签页
2. 选择 **Release** 工作流
3. 点击 **Run workflow**
4. 填写参数：
   - **Release tag**: 版本号（必填），如 `v1.8.4`
   - **Release name**: 发布名称（可选）
   - **Create as draft release**: 是否创建为草稿（默认否）
   - **Mark as prerelease**: 是否标记为预发布（默认否）
5. 点击运行

### 方式四：手动构建（测试用）

用于测试构建，不影响正式 Release：

1. 进入仓库的 **Actions** 标签页
2. 选择 **Manual Build** 工作流
3. 点击 **Run workflow**
4. 填写参数：
   - **Release tag**: 版本号（必填），如 `v1.8.4-test`
   - **Release name**: 构建名称（可选）
   - **Create as draft release**: 是否创建为草稿（默认是）
   - **Mark as prerelease**: 是否标记为预发布（默认是）
5. 点击运行

**注意**：手动构建默认创建草稿和预发布，不会影响正式版本。

### 方式五：使用版本管理工作流

使用专门的版本管理工作流自动更新版本号并触发构建：

1. 进入仓库的 **Actions** 标签页
2. 选择 **Version Management** 工作流（版本管理工作流）
3. 点击 **Run workflow**
4. 选择版本更新类型：
   - **Version bump type**: patch/minor/major（版本更新类型）
   - **Custom version**: 自定义版本号（可选）（自定义版本号）
   - **Only create tag**: 是否仅创建标签（不触发构建）（仅创建标签）
5. 点击运行

**自动执行**：
- ✅ 更新 package.json 版本号（更新版本号）
- ✅ 更新 tauri.conf.json 版本号（更新版本号）
- ✅ 更新 Cargo.toml 版本号（更新版本号）
- ✅ 创建 Git 标签（创建标签）
- ✅ 推送到仓库（推送标签）（推送标签）
- ✅ 自动触发构建工作流（除非选择仅创建标签）（自动触发构建）

## 📦 构建产物

### macOS
- `.dmg` - 磁盘镜像安装包（磁盘镜像安装包）
- `.app` - 应用程序包（应用程序包）

### Windows
- `.msi` - Windows 安装包（Windows 安装包）

### Linux
- `.deb` - Debian/Ubuntu 安装包（Debian/Ubuntu 安装包）
- `.AppImage` - 通用 Linux 应用包（通用 Linux 应用包）
- `.rpm` - RedHat/CentOS 安装包（RedHat/CentOS 安装包）

## 🔐 安全配置

### 必需的环境变量（Secrets）

在仓库的 **Settings > Secrets and variables > Actions** 中配置：

#### 代码签名（可选，用于正式发布）
```
TAURI_SIGNING_PRIVATE_KEY         # Tauri 更新签名私钥
TAURI_SIGNING_PRIVATE_KEY_PASSWORD # 私钥密码
APPLE_CERTIFICATE                 # Apple 证书（base64 编码）
APPLE_CERTIFICATE_PASSWORD        # 证书密码
APPLE_SIGNING_IDENTITY            # 签名身份
APPLE_ID                          # Apple ID
APPLE_PASSWORD                    # Apple ID 密码（应用专用密码）
APPLE_TEAM_ID                     # 团队 ID
```

#### GitHub Token（自动提供）
```
GITHUB_TOKEN                # GitHub 自动提供，无需手动配置
```

### 代码签名配置说明

如果不配置 macOS 签名相关密钥：
- ✅ 构建仍然会成功
- ⚠️ 应用未签名，macOS 会显示警告
- ⚠️ 用户需要手动允许运行

**建议**：正式发布时配置 macOS 签名，开发测试时可以跳过。

## 📝 发布流程示例

### 完整发布流程（推荐）

```bash
# 1. 确保代码已提交
git add .
git commit -m "feat: add new feature"
git push origin main

# 2. 使用快速发布脚本
./scripts/quick-release.sh patch  # 或 minor, major, 1.8.4

# 3. GitHub Actions 自动构建并发布
# 等待构建完成，Release 会自动创建
```

### 完整发布流程（手动）

```bash
# 1. 确保代码已提交
git add .
git commit -m "feat: add new feature"
git push origin main

# 2. 方式 A：使用 npm version + 手动更新文件
npm version patch

# 更新 src-tauri/tauri.conf.json
jq ".version = \"$(node -p \"require('./package.json').version\")\"" \
  src-tauri/tauri.conf.json > src-tauri/tauri.conf.json.tmp
mv src-tauri/tauri.conf.json.tmp src-tauri/tauri.conf.json

# 更新 src-tauri/Cargo.toml
sed -i.bak "s/^version = .*/version = \"$(node -p \"require('./package.json').version\")\"/" \
  src-tauri/Cargo.toml
rm -f src-tauri/Cargo.toml.bak

# 3. 创建标签并推送
git add .
git commit -m "chore: release"
git tag v1.8.4
git push origin main --follow-tags

# 4. GitHub Actions 自动构建并发布
```

### 快速测试构建

```bash
# 在 GitHub Actions 页面手动触发
# 使用自定义标签，如 v1.8.4-test
# 勾选 "Create as draft release"
# 构建完成后可在 Drafts 中查看
```

## 🔧 自定义配置

### 修改构建目标

编辑 `.github/workflows/build-release.yml` 中的 matrix 配置：

```yaml
matrix:
  include:
    - os: macos-latest
      target: x86_64-apple-darwin
    - os: macos-latest
      target: aarch64-apple-darwin
    # 添加或删除目标...
```

### 修改触发条件

编辑工作流文件中的 `on` 部分：

```yaml
on:
  push:
    tags:
      - 'v*'        # 匹配所有 v 开头的标签
      - 'release-*' # 添加更多匹配规则
```

### 自定义发布说明

编辑 `create-release` job 中的 `Generate release notes` 步骤，修改模板。

## 🐛 故障排除

### 构建失败

1. 检查 Actions 日志
2. 确认依赖安装完整
3. 验证 Rust 和 Node.js 版本
4. 检查系统依赖（Linux）

### Release 未创建

1. 确认 workflow 权限（contents: write）
2. 检查 GITHUB_TOKEN 权限
3. 确认构建全部成功

### macOS 签名失败

1. 验证证书格式正确（base64）
2. 确认证书未过期
3. 检查应用专用密码

## 📊 工作流关系

```
推送标签 v* ──────────────────┐
                              ↓
                      Build and Release
                              ↑
版本管理 ── 更新版本号 ── 推送到 main ──┘
    ↑
手动触发（选择版本类型）
```

## 🎯 最佳实践

1. **使用快速发布脚本**
   ```bash
   ./scripts/quick-release.sh patch
   ```
   - 自动更新所有文件
   - 自动创建标签
   - 自动触发构建

2. **使用语义化版本号**：遵循 `主版本.次版本.补丁版本` 格式

3. **先测试后发布**：使用 draft release 测试构建

4. **完善 CHANGELOG**：每次发布前更新更新日志

5. **配置代码签名**：正式发布时签名 macOS 应用

6. **监控构建状态**：关注 Actions 通知

## 📚 相关文档

- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [Tauri 构建配置](https://v2.tauri.app/reference/config/)
- [semantic-release 文档](https://github.com/standard-version/standard-version)

## 💡 提示

- 构建过程通常需要 10-20 分钟
- 可以并行构建多个平台
- 失败的构建不会影响其他平台
- Release 支持草稿和预发布模式
