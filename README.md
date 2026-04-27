# Kiro Account Manager

<p align="center">
  <img src="src-tauri/icons/128x128.png" alt="Logo" width="80">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform">
  <img src="https://img.shields.io/github/v/release/hj01857655/kiro-account-manager?label=Version&color=green" alt="Version">
  <img src="https://img.shields.io/github/downloads/hj01857655/kiro-account-manager/total?color=brightgreen" alt="Downloads">
  <img src="https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-orange" alt="License">
  <img src="https://img.shields.io/badge/QQ群1-1020204332-12B7F5?logo=tencentqq" alt="QQ群1">
  <img src="https://img.shields.io/badge/QQ群2-1080919449-12B7F5?logo=tencentqq" alt="QQ群2">
  <img src="https://img.shields.io/badge/语言-简体中文-red" alt="语言">
</p>

<p align="center">
  <b>🚀 智能管理 Kiro IDE 账号，一键切换，配额监控</b>
</p>

<p align="center">
  🌐 <b><a href="https://kiro-website-six.vercel.app">官方网站</a></b> | 
  📥 <b><a href="#-下载">立即下载</a></b> | 
  💬 <b><a href="https://qm.qq.com/q/xi0AglEqGs">加入 QQ 2群</a></b>
</p>

> **📢 语言支持**：从当前版本开始，本项目**仅支持简体中文界面**，已移除英文和俄语翻译。这样可以简化维护，专注于功能开发。

---

## ⚠️ 代码盗用警告

**本项目遵循 MIT 协议开源，但请遵守署名要求。违规行为将被记录在 [耻辱柱](HALL_OF_SHAME.md)。**

已记录违规用户：
- **xxxxr453er (QQ: 372510145)** - License Violation + Code of Conduct Violation ([证据](https://github.com/hj01857655/kiro-account-manager/issues/58))

---

## 🏗️ 项目概览

Kiro Account Manager 是一个基于 **Tauri 2.x** 的桌面应用，用于集中管理 **Kiro IDE** 账号与本地配置。

**技术栈**：
- 前端：React 18 + Vite + shadcn/ui + TailwindCSS 4
- 后端：Rust + Tauri 2.x
- 通信：前端通过 `invoke()` 调用 Tauri commands
- 运行平台：Windows / macOS / Linux

**当前源码包含的核心模块**：
- 账号管理：导入、导出、刷新、验证、分组、标签、远程删除
- 登录认证：Google / GitHub Social OAuth，AWS IAM Identity Center（BuilderId / Enterprise）
- Kiro 集成：切换账号、同步模型 / 代理 / MCP / Steering / Skills / Hooks / Custom Agents / Powers
- 自动化能力：Token 自动刷新、余额不足自动换号、机器 ID 绑定与重置
- 桌面端能力：Deep Link OAuth 回调、单实例、系统托盘、自动更新
- 网关能力：内置 Kiro API Gateway，支持 Anthropic Messages、OpenAI Responses 与流式转发

**数据存储位置**：
- 应用数据：`~/.kiro-account-manager/`
- Kiro 配置：`~/.kiro/`

---

## 💬 交流反馈

- 🐛 [提交 Issue](https://github.com/hj01857655/kiro-account-manager/issues)
- 💬 QQ 1群：[1020204332](https://qm.qq.com/q/Vh7mUrNpa8)
- 💬 QQ 2群：[1080919449](https://qm.qq.com/q/xi0AglEqGs)

---

## 📥 下载

**最新版本 v1.8.5**（发布于 2026-04-27）：请前往 [Releases](https://github.com/hj01857655/kiro-account-manager/releases/latest)（自动保持最新）

> 以下下载链接可能滞后，以 Releases 为准。

| 平台 | 架构 | 文件格式 | 下载链接 |
|------|------|---------|---------|
| 🪟 **Windows** | x64 | MSI 安装包 | [KiroAccountManager_1.8.5_x64_zh-CN.msi](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.8.5/KiroAccountManager_1.8.5_x64_zh-CN.msi) |
| 🍎 **macOS** | Intel (x64) | DMG 镜像 | [KiroAccountManager_1.8.5_x64.dmg](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.8.5/KiroAccountManager_1.8.5_x64.dmg) |
| 🍎 **macOS** | Apple Silicon (M1/M2/M3) | DMG 镜像 | [KiroAccountManager_1.8.5_aarch64.dmg](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.8.5/KiroAccountManager_1.8.5_aarch64.dmg) |
| 🐧 **Linux** | x86_64 | AppImage | [KiroAccountManager_1.8.5_amd64.AppImage](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.8.5/KiroAccountManager_1.8.5_amd64.AppImage) |
| 🐧 **Linux** | x86_64 | DEB 包 | [KiroAccountManager_1.8.5_amd64.deb](https://github.com/hj01857655/kiro-account-manager/releases/download/v1.8.5/KiroAccountManager_1.8.5_amd64.deb) |

> **macOS 样式说明**：若出现样式显示异常，请基于当前仓库源码自行调整（我没有 macOS 设备，无法复现与调试）。

**系统要求**：
- **Windows**: Windows 10/11 (64-bit)，需要 [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (Win11 已内置)
- **macOS**: macOS 10.15+ (Catalina 及以上)
- **Linux**: x86_64 架构，需要 WebKitGTK 4.0+

**安装说明**：
- **Windows**: 双击 `.msi` 文件安装，首次运行可能需要安装 WebView2
- **macOS**: 打开 `.dmg` 文件，拖动应用到 Applications 文件夹，首次运行需要在「系统偏好设置 → 安全性与隐私」中允许
- **Linux AppImage**: 添加执行权限 `chmod +x KiroAccountManager_amd64.AppImage`，然后直接运行
- **Linux DEB**: 使用 `sudo dpkg -i KiroAccountManager_amd64.deb` 安装

---

## 🤝 赞助商

感谢以下赞助商对本项目的支持：

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://fishxcode.com/" target="_blank">
        <b>🐟 FishXCode</b>
      </a>
      <br>
      <sub>稳定的 Claude API 中转服务</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://synai996.space/" target="_blank">
        <b>🤖 SynAI996</b>
      </a>
      <br>
      <sub>高性能 AI 模型 API 代理平台</sub>
    </td>
  </tr>
</table>

> 如需成为赞助商，请联系项目维护者。

---

## 💖 赞赏名单
感谢以下朋友对本项目的支持：
- 🌟 [shiro123444](https://github.com/shiro123444)

如需更新名单，请直接修改此处。

---

## ✨ 核心功能

### 🔐 在线登录

**Social 登录** - 社交账号授权
- Google / GitHub
- 桌面端 OAuth 流程
- 自动刷新 Token

**IdC 登录** - AWS IAM Identity Center
- BuilderId（个人开发者账号）
- 🆕 Enterprise（企业账号）
- 完整支持 SSO OIDC 流程
- 企业账号专属徽章颜色

### 📊 账号管理

**多视图展示**
- 卡片视图 / 列表视图自由切换
- 配额进度条（主配额 / 试用 / 奖励）
- 订阅类型标识（Free / PRO / PRO+）
- Token 过期倒计时
- 状态高亮（正常 / 过期 / 封禁 / 当前使用）

**智能检测**
- 封禁检测（423 Locked / 403 TEMPORARILY_SUSPENDED）
- 默认按试用到期时间排序
- 刷新失败自动通知（封禁 / Token 失效）

### 🔄 一键切号

- 无感切换 Kiro IDE 账号
- 自动重置机器 ID（随机 / 绑定模式）
- 切换进度实时显示
- 封禁账号自动跳过
- 🆕 CLI 2.0 切号支持（检测安装状态、读取数据库快照、切换账号、回滚操作）

### 📦 批量操作

**导入导出**
- JSON 格式（文件导入 / 文本粘贴）
- 🆕 从 Kiro IDE 导入（自动检测已登录账号）
- 🆕 从 kiro-cli 导入（读取 SQLite 数据库）
  - macOS / Linux：可直接安装 `kiro-cli`（`curl -fsSL https://cli.kiro.dev/install | bash`）
  - Windows：Kiro CLI 2.0 原生支持，数据库路径为 `%LOCALAPPDATA%\Kiro-Cli\data.sqlite3`
- 导出为 JSON 文件（支持批量选择）

**JSON 导入格式要求**

所有账号必填字段：
- `refreshToken` - 必须以 `aor` 开头

账号类型自动识别：
- **Social 账号**（Google/GitHub）：必须指定 `provider`，不能有 `clientId` 和 `clientSecret`
- **IdC 账号**（BuilderId/Enterprise）：必须有 `clientId` 和 `clientSecret`，`provider` 可选（根据 `startUrl` 自动判断）

示例：
```json
[
  {
    "refreshToken": "aor...",
    "provider": "Google"
  },
  {
    "refreshToken": "aor...",
    "clientId": "...",
    "clientSecret": "...",
    "provider": "BuilderId"
  },
  {
    "refreshToken": "aor...",
    "clientId": "...",
    "clientSecret": "...",
    "provider": "Enterprise",
    "startUrl": "https://example.awsapps.com/start"
  }
]
```

说明：
- 第 1 个：Google 账号（必须指定 `provider`）
- 第 2 个：BuilderId 账号（可显式指定 `provider: "BuilderId"`，或省略让系统自动识别）
- 第 3 个：Enterprise 账号（可显式指定 `provider: "Enterprise"`，或通过 `startUrl` 自动识别）

可选字段：`accessToken`、`machineId`、`region`、`clientIdHash`、`password`

**批量管理**
- 批量刷新（智能并发控制，自动优化速度）
- 批量删除 / 批量打标签
- 🆕 远程删除（从 AWS 服务端注销，仅 Google/GitHub 且状态正常）
- 关键词搜索过滤

**性能优化**
- 🚀 后端减少不必要的内存克隆，提升响应速度
- 🚀 前端优化组件重渲染，筛选/搜索快 2-3 倍
- 🚀 使用 Map/Set 数据结构，查找性能提升至 O(1)

### 🏷️ 标签与分组

**标签系统**
- 自定义标签（名称 / 颜色）
- 批量设置标签
- 按标签筛选账号

**分组管理**
- 🆕 账号分组功能
- 按分组筛选账号
- 支持无分组 / 有分组筛选

### 🔍 高级筛选

- 按订阅类型筛选（Free / PRO / PRO+）
- 按状态筛选（正常 / 封禁）
- 按使用率 / 添加时间 / 试用到期排序
- 三态排序（降序 → 升序 → 取消）

### 🔌 Kiro 配置

**MCP 服务器管理**
- 增删改查 MCP 配置
- 启用 / 禁用服务器
- autoApprove 通配符支持（`*` / `tool_*` / 正则）
- 环境变量配置
- 实时连接状态检测

**Steering 规则管理**
- 4 种 inclusion 模式：
  - `always` - 始终包含
  - `auto` - 通过 discloseContext 按需激活
  - `fileMatch` - 文件匹配时包含
  - `manual` - 手动引用（`#steering-name`）
- frontmatter 元数据（name / description / keywords）
- 文件引用支持（`#[[file:path]]`）
- Markdown 语法高亮编辑

**Skills 管理**（Kiro v0.9.2+）
- 浏览用户级和项目级 Skills
- 创建 / 编辑 / 删除 SKILL.md
- frontmatter 支持（name / description）
- 快速激活 / 停用

**Hooks 管理**（源码行为总结）
- 存储位置：`<project>/.kiro/hooks/*.kiro.hook`（项目级）
- 触发类型（`when.type`）：`userTriggered` / `fileEdited` / `promptSubmit` / `agentStop`
- 动作类型（`then.type`）：`askAgent` / `runShellCommand`
- 行为语义：保存不做 schema 阻断，读取时做结构校验（`HookSchema.safeParse`）

**Custom Agents 管理**（Kiro v0.9.2+）
- 完整 v0.10.32 schema 支持：
  - `name` / `description` - 基础信息
  - `tools` - 工具权限（read / write / shell / web / spec / mcp / *）
  - `model` - 指定 AI 模型
  - `includeMcpJson` - 包含 MCP 配置
  - `includePowers` - 包含 Powers
- 用户级（~/.kiro/agents/）和项目级（.kiro/agents/）
- JSON 编辑器（语法高亮 + 验证）

**Powers 管理**（Kiro v0.9.2+）
- 浏览已安装的 Powers
- 查看 POWER.md 文档
- 查看包含的 MCP 服务器配置
- 查看 Steering 文件列表
- 一键卸载 Power

**版本变化速览（Kiro）**
- **v0.9.2 引入**：Skills、Custom Agents（sub-agent 更名）、Powers registry-v2
- **v0.10.x 增强（含 v0.10.32）**：
  - Spec：Feature 双工作流（Requirements-First / Design-First）+ Bugfix 工作流（`bugfix.md -> design.md -> tasks.md`）
  - Supervised hunk 级审查（逐块接受/拒绝/讨论）
  - Task Hooks：Pre/Post Task Execution
  - MCP：Prompts / Resource Templates / Elicitation

**项目级配置支持**
- Skills / Steering / Custom Agents / MCP 同时支持：
  - 用户级：`~/.kiro/`（全局生效）
  - 项目级：`<project>/.kiro/`（仅当前项目）
- Hooks：仅项目级（`<project>/.kiro/hooks/`）
- MCP 配置：用户级 `~/.kiro/settings/mcp.json` + 项目级 `<project>/.kiro/settings/mcp.json`（同名服务项目级覆盖用户级；Powers 注入可再覆盖）
- 自动检测并切换配置路径
- 项目级配置优先级更高

### ⚙️ 系统设置

**界面主题**
- 四种主题（浅色 / 深色 / 紫色 / 绿色）

**AI 配置**
- AI 模型选择与锁定
- 代码库索引开关
- 信任命令配置（关闭 / 常用 / 全部）
- 🆕 Agent 自主模式（监督 / 自动驾驶）

**账号管理**
- Token 自动刷新（可配置间隔）
- 切号自动重置机器 ID（随机 / 绑定模式）
- 隐私模式（邮箱脱敏显示）
- 🆕 余额不足自动换号（可配置阈值和检查间隔）

**浏览器与代理**
- 自定义浏览器 / 自动检测
- 默认无痕模式启动（保护隐私，简化 OAuth 流程）
- HTTP 代理配置 / 自动检测系统代理
- TUN 模式检测

### 🔑 机器码管理

- 查看 / 复制 / 重置
- 支持 Windows / macOS / Linux

### 🖥️ IDE 集成

- 检测 Kiro IDE 运行状态
- 一键启动 / 关闭
- 自动同步代理和模型设置

### 🌐 Kiro API 网关

> **✅ 当前源码已包含网关页面与后端实现**。如需体验最新能力，请优先参考当前仓库代码与 Releases 页面，而不是旧分支说明。

**协议支持**
- Anthropic `POST /v1/messages`
- OpenAI `POST /v1/responses`（不提供 Chat Completions 兼容入口）
- `POST /mcp` 透传，可代理执行版本化 `web_search_*` 特殊工具

**格式转换**
- 支持 Anthropic `image`、`image_url` 与 OpenAI `input_image`，自动转换为 Kiro 上游 `images`
- 支持将 Kiro 上游 `application/vnd.amazon.eventstream` 流式响应转换为 Anthropic / OpenAI SSE

**安全与管理**
- 客户端 API Key 鉴权
- `localOnly` 本机限制
- `allowedIps` IP 白名单
- 本地请求日志记录

**便捷接入**
- 内置网关页面，可直接生成 Anthropic / OpenAI 客户端接入配置

---

## 📸 截图

![首页](screenshots/首页.webp)
![账号管理](screenshots/账号管理.webp)
![桌面授权](screenshots/桌面授权.webp)
![规则管理](screenshots/规则管理.webp)
![设置](screenshots/设置.png)
![关于](screenshots/关于.png)

---

## ❓ 常见问题

**Q: 切换账号时提示 "bearer token invalid"**

A: Token 过期了，切换前先点「刷新」按钮。这是 Kiro 服务端返回的错误，不是管理器的问题。

**Q: 刷新 Token 失败**

A: 网络超时，手动再刷新一次或换个网络试试。

**Q: macOS 打开应用提示“已损坏，无法打开”**

A: 这通常是 macOS 给应用打了隔离属性，不是安装包真的坏了。把应用拖到 `/Applications` 后执行：

```bash
xattr -cr /Applications/KiroAccountManager.app
```

然后重新打开应用即可。

**Q: 点击关闭按钮后，应用为什么没有退出？**

A: 当系统托盘可用时，主窗口会隐藏到系统托盘继续后台运行，不会直接退出。

**如何彻底退出**：
- 点击托盘图标菜单中的「退出应用」

**如何恢复窗口**：
- 优先使用托盘菜单中的「显示主窗口」
- 在支持托盘点击恢复的平台上，也可以直接单击托盘图标

**Q: Windows MSI 安装时提示"已安装相同版本"**

A: v1.8.3+ 支持同版本覆盖升级，直接继续安装即可。如果仍有问题，可以先卸载旧版本再安装。

---

## 🌿 分支说明

- `public`：公开源码分支，通常包含最新同步内容
- `dev`：当前开发分支

> 具体默认分支与发布节奏请以 GitHub 仓库页面为准。

---

## 📝 源码说明

本仓库源码会持续同步更新；如仅需安装包，请前往 Releases。

**⚠️ 本项目永久免费！如果有人向你收费，你被骗了！**

### 🔨 自行编译

如需使用最新的开发中功能，可以从源码编译：

**前置要求**：
- Node.js 20+
- Rust 工具链（通过 [rustup](https://rustup.rs/) 安装）
- 系统依赖：
  - Windows: WebView2（Win11 已内置）
  - macOS: Xcode Command Line Tools
  - Linux: `libwebkit2gtk-4.1-dev libappindicator3-dev`

**编译步骤**：
```bash
# 1. 克隆仓库
git clone https://github.com/hj01857655/kiro-account-manager.git
cd kiro-account-manager

# 2. 安装依赖
npm install

# 3. 开发模式运行
# 方式一：一键启动前端 + Tauri
npm run tauri dev

# 方式二：分开启动（调试前端/后端时更灵活）
# 终端 1
npm run dev

# 终端 2
npm run dev:tauri

# 4. 构建发行版
npm run tauri build
```

**开发提示**：
- `npm run tauri dev` 是仓库说明里的主开发命令
- `npm run dev` + `npm run dev:tauri` 适合分别调试前端和桌面壳
- 主窗口默认延迟显示，避免启动阶段白屏
- 生产模式下支持系统托盘；关闭窗口后可能隐藏到托盘而不是直接退出

构建产物位置：
- Windows: `src-tauri/target/release/bundle/msi/`
- macOS: `src-tauri/target/release/bundle/dmg/`
- Linux: `src-tauri/target/release/bundle/deb/` 或 `appimage/`

---

## 💖 赞助

如果这个项目对你有帮助，可以请作者喝杯咖啡 ☕

<p align="center">
  <img src="src/assets/donate/wechat.jpg" alt="微信" width="200">
  <img src="src/assets/donate/alipay.jpg" alt="支付宝" width="200">
</p>

---

## 🗂️ 代码结构速览

```text
src/                  React 前端
  components/         页面、弹窗、布局组件
    features/         功能模块（统一使用 index.jsx）
      About/          关于页面
      AccountManager/ 账号管理
      Gateway/        Kiro API Gateway（含工具文件）
      Home/           首页
      KiroConfig/     Kiro 配置（MCP、Agents、Skills 等）
      Login/          登录页面
      Settings/       系统设置（含工具文件）
    shared/           共享组件
    layout/           布局组件
  contexts/           主题、设置、隐私、对话框等全局上下文
  hooks/              自动刷新、自动换号等业务 Hook
  api/                Tauri invoke 封装
  utils/              业务工具函数

src-tauri/src/        Rust + Tauri 后端
  commands/           所有 Tauri commands
  auth/               认证模块（包含 providers/ 子目录）
  clients/            HTTP 客户端（AWS SSO、Kiro Auth、Kiro Portal）
  core/               核心功能（账号、自动切换、Deep Link）
  kiro/               Kiro 集成（IDE、CLI、Settings）
  utils/              工具函数（浏览器、命令输出）
  gateway/            Kiro API Gateway
  state.rs            全局应用状态
```

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=hj01857655/kiro-account-manager&type=Date)](https://star-history.com/#hj01857655/kiro-account-manager&Date)

---

## 📄 许可证

[CC BY-NC-SA 4.0](LICENSE) - **禁止商业使用**

## ⚠️ 免责声明

本软件仅供学习交流使用，**严禁商业用途**。使用本软件所产生的任何后果由用户自行承担。

---

<p align="center">Made with ❤️ by hj01857655</p>

<p align="center"><sub>最后更新：2026-04-27 | 版本：v1.8.5</sub></p>
