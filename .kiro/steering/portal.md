---
inclusion: always
---

# Portal 规范

## ⚠️ 重要变更

**官网已迁移到独立仓库**：
- **仓库地址**：`https://github.com/hj01857655/kiro-website`（私有）
- **技术栈**：React 18 + Vite + Tailwind CSS + React Router
- **部署平台**：Vercel

## 目录结构

官网项目在独立仓库 `kiro-website` 中，不再位于 `portal/` 目录。

```
kiro-website/
├── src/
│   ├── components/      # React 组件
│   ├── pages/          # 页面（Home、Gateway）
│   ├── main.jsx        # 入口文件
│   └── index.css       # 样式
├── api/                # Vercel Serverless Functions
│   ├── announcement.ts # 公告 API
│   ├── usage.ts        # 配额查询 API
│   └── refresh.ts      # Token 刷新 API
├── public/             # 静态资源
├── vite.config.js      # Vite 配置
└── vercel.json         # Vercel 配置
```

## 开发流程

### 本地开发

```powershell
# 克隆仓库（工作区外）
git clone https://github.com/hj01857655/kiro-website.git

# 安装依赖
cd kiro-website
npm install

# 启动开发服务器
npm run dev
```

### 构建

```powershell
npm run build
```

### 部署

```powershell
vercel --prod
```

## 公告管理

### 公告内容配置

公告内容在 `api/announcement.ts` 中配置。

**修改公告后部署**：
```powershell
# 方法 1：直接部署（推荐）
Push-Location "E:\VSCodeSpace\Kiro\kiro-website"
vercel --prod --yes
Pop-Location

# 方法 2：推送到 GitHub（自动部署）
cd E:\VSCodeSpace\Kiro\kiro-website
git add api/announcement.ts
git commit -m "chore: 更新公告内容"
git push
```

### 公告字段说明

- `id` - 公告唯一标识，改变此值会让所有用户重新看到公告
- `enabled` - 是否启用
- `title` - 标题
- `content` - 内容数组（每项一段）
- `websiteUrl` - 官网地址
- `officialUrl` - GitHub 仓库地址
- `tutorialUrl` - 使用教程地址
- `qqGroup` - QQ 交流群号
- `qqGroupUrl` - QQ 交流群链接
- `buyGroup` - 续杯交流群名称（可选）
- `buyGroupUrl` - 续杯交流群链接（可选）
- `buyUrl` - 在线购买链接（可选）
- `refillTutorialUrl` - 续杯教程链接（可选）

### 公告内容规范

**✅ 应该显示的内容**：
- 软件免费声明（防止被骗）
- 重要功能更新通知
- 安全提示和注意事项
- 官方渠道和联系方式
- 使用教程和帮助文档

**❌ 不应该显示的内容**：
- 版本更新信息（由 `UpdateChecker` 组件负责）
- Release Notes（由应用内更新检测显示）
- 详细的代码变更日志

### 当前公告内容

**标题**：⚠️ 重要提示：本软件永久免费

**内容**：
- ⚠️ 本软件完全开源免费，任何人不得以任何形式收费！
- ✅ 软件本身永久免费，无需付费购买
- ✅ 所有功能完全开放，无任何限制
- ✅ 源码托管在 GitHub，接受社区监督
- ❌ 如有人向您收费，请立即举报
- 💡 如需 Kiro IDE 账号，请通过官方渠道自行注册或购买
- 📢 软件免费 ≠ 账号免费，请勿混淆

### 公告显示逻辑

**客户端实现**（`src/components/modals/AnnouncementModal.jsx`）：
- 启动时从 `https://kiro-website-six.vercel.app/api/announcement` 获取公告
- 只显示 `enabled: true` 的第一条公告
- 用户点击"不再提醒"会保存公告 ID 到 `localStorage`
- 已读的公告不会再次显示
- 点击"我知道了"不保存已读状态，下次启动还会显示

**职责分离**：
- **公告系统**：显示运营公告、安全提示、重要通知
- **UpdateChecker**：检测应用更新、下载安装包、显示 Release Notes

## 页面

- `/` - 项目官网首页（Kiro Account Manager）
- `/gateway` - Kiro Gateway 页面

## API 端点

- `/api/announcement` - GET 获取公告列表
- `/api/usage` - POST 获取账号配额
- `/api/refresh` - POST 刷新 Token

## 访问方式

由于官网在工作区外，必须使用 PowerShell 访问：

```powershell
# 读取文件
Get-Content "E:\VSCodeSpace\Kiro\kiro-website\src\pages\Home.jsx" -Raw

# 列出文件
Get-ChildItem "E:\VSCodeSpace\Kiro\kiro-website\src"

# 搜索内容
Select-String -Path "E:\VSCodeSpace\Kiro\kiro-website\src\**\*.jsx" -Pattern "关键词"
```
