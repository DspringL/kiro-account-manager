---
inclusion: always
---

# 项目信息

## 产品介绍

基于 Tauri 构建的桌面应用（Rust 后端 + React 前端），用于管理 Kiro IDE 账号。

### 核心功能

**账号管理**
- 多账号管理：支持 Google、GitHub、BuilderId、Enterprise 登录
- 卡片网格布局：直观展示账号状态、配额、订阅类型
- 配额监控：实时查看主配额、试用、奖励使用情况
- 一键切换：快速切换账号，可选自动重置机器 ID
- 批量操作：批量刷新、批量删除、批量导入导出
- Token 自动刷新：定时刷新过期 Token
- 从 Kiro 导入：自动检测并导入 Kiro IDE 中已登录的账号

**IDE 集成**
- IDE 设置同步：代理、模型配置
- 机器 ID 管理：重置 Kiro IDE 机器 ID
- 系统机器码管理：备份/恢复/重置 Windows MachineGuid

**配置管理**
- MCP 服务器管理：查看、添加、编辑、启用/禁用 MCP 配置
- Steering 规则管理：查看、编辑规则文件

**界面特性**
- 主题切换：浅色、深色、紫色、绿色
- 自动更新：检查并下载新版本
- 本地存储：数据不上传，隐私安全

### 页面结构

1. **首页** - 统计卡片、当前登录账号、配额总览
2. **账号管理** - 卡片网格展示、搜索、添加、导入导出、批量操作
3. **Kiro 配置** - MCP 服务器面板 + Steering 规则面板（Tab 切换）
4. **Desktop OAuth** - Google/GitHub/BuilderId/Enterprise 桌面授权登录
5. **Web Portal OAuth** - WebView 窗口授权登录
6. **设置** - 主题、模型、账号、浏览器、代理、机器码
7. **关于** - 版本、更新、技术栈、赞赏

### 目标用户

需要管理多个 Kiro IDE 账号或监控配额的开发者。

### 界面语言

应用界面和代码注释均为中文，支持国际化扩展。

---

## 技术栈

### UI 组件库搭配

本项目采用**三层 UI 架构**，各司其职：

| 层级 | 技术 | 职责 | 示例 |
|------|------|------|------|
| **布局/样式** | Tailwind CSS v4 | 原子化 CSS，布局和自定义样式 | `flex`, `gap-4`, `rounded-xl` |
| **弹窗** | Headless UI | Dialog 组件，无样式可访问 | `<Dialog>`, `<Transition>` |
| **表单/展示** | Mantine | 表单组件和展示组件 | `<Select>`, `<Alert>`, `<Progress>` |

**为什么这样搭配？**
- **Tailwind CSS v4**：最新版本，性能提升 10 倍，内置现代 CSS 特性
- **Headless UI**：Tailwind Labs 官方推荐，API 简洁，完美集成
- **Mantine**：表单组件功能完善（验证、错误提示），节省开发时间

**不冲突吗？**
- ✅ 完全不冲突！各自负责不同领域
- ✅ Headless UI 只负责弹窗逻辑，样式用 Tailwind
- ✅ Mantine 组件通过 `classNames` 属性使用 Tailwind 样式

### 前端
- React 18 + JSX（非 TypeScript）
- Vite 5 打包
- **Tailwind CSS v4** 样式（最新版本，性能提升 10 倍）
- Lucide React 图标
- Tauri API v2 通信（`@tauri-apps/api/core`）
- i18next + react-i18next 国际化（i18n）
- **Headless UI** 弹窗组件（Tailwind Labs 官方）
- **Mantine** 表单组件（Select、TextInput、Alert 等）

### 后端（Rust）
- Tauri 2.x 框架
- Tokio 异步运行时
- Reqwest HTTP 请求
- Serde 序列化
- JSON 文件本地存储
- Chrono 日期时间处理
- SHA2/Hex 哈希计算

### Tauri 插件
- `tauri-plugin-shell` - Shell 命令执行
- `tauri-plugin-process` - 进程管理
- `tauri-plugin-updater` - 自动更新
- `tauri-plugin-opener` - 打开 URL/文件
- `tauri-plugin-dialog` - 系统对话框
- `tauri-plugin-fs` - 文件系统操作
- `tauri-plugin-deep-link` - Deep Link 处理（OAuth 回调）

### 依赖管理

- 新增/删除/更新依赖后必须运行 `npm install` 同步 package-lock.json
- 只改版本号不需要 npm install
- 提交代码前确保 **3 个文件**版本号一致，否则 CI 构建会失败：
  - `package.json`
  - `src-tauri/tauri.conf.json`
  - `src-tauri/Cargo.toml`

### 常用命令

```bash
# 安装依赖（同时更新 lock 文件）
npm install

# 开发模式（启动 Vite + Tauri 开发服务器）
npm run tauri dev

# 构建生产版本
npm run tauri build

# 仅前端开发
npm run dev

# 仅前端构建
npm run build

# 提取国际化文本
npm run extract

# 编译国际化文件
npm run compile
```

### 配置文件
- `vite.config.js` - Vite 配置（端口 1420）
- `tailwind.config.js` - TailwindCSS 配置
- `locales/*.json` - i18next 语言包（zh-CN、en-US、ru-RU）
- `src-tauri/tauri.conf.json` - Tauri 应用配置
- `src-tauri/Cargo.toml` - Rust 依赖

### 平台支持
- Windows 10/11 (64位) - 需要 WebView2
- macOS 10.15+（Intel/Apple Silicon）

### 界面主题
- 浅色（light）
- 深色（dark）
- 紫色（purple）
- 绿色（green）

---

## 项目结构

```
├── src/                      # React 前端
│   ├── main.jsx              # 应用入口
│   ├── App.jsx               # 根组件，路由管理
│   ├── i18n.jsx              # 国际化配置
│   ├── index.css             # 全局样式（Tailwind）
│   ├── assets/               # 静态资源
│   │   └── donate/           # 赞赏二维码图片
│   ├── components/           # React 组件
│   │   ├── features/         # 功能组件
│   │   │   ├── AccountManager/   # 账号管理功能（卡片网格布局）
│   │   │   │   ├── index.jsx     # 主容器
│   │   │   │   ├── hooks/        # 自定义 hooks
│   │   │   │   │   ├── useAccounts.js    # 账号数据管理
│   │   │   │   │   └── useAccountStats.js # 账号统计
│   │   │   │   ├── AccountHeader.jsx     # 顶部工具栏
│   │   │   │   ├── AccountTable.jsx      # 卡片网格容器
│   │   │   │   ├── AccountCard.jsx       # 账号卡片组件（含右键菜单）
│   │   │   │   ├── AccountPagination.jsx # 分页控件
│   │   │   │   ├── AddAccountModal.jsx   # 添加账号弹窗
│   │   │   │   ├── ImportAccountModal.jsx # 导入账号弹窗（3-Tab：JSON/SSO Token/从 Kiro 导入）
│   │   │   │   ├── EditAccountModal.jsx  # 编辑备注弹窗
│   │   │   │   ├── RefreshProgressModal.jsx # 刷新进度弹窗
│   │   │   │   └── ConfirmModal.jsx      # 确认弹窗
│   │   │   ├── KiroConfig/       # Kiro 配置管理
│   │   │   │   ├── index.jsx     # 配置主页（Tab 切换）
│   │   │   │   ├── MCPPanel.jsx  # MCP 服务器面板
│   │   │   │   └── SteeringPanel.jsx # Steering 规则面板
│   │   │   ├── Home.jsx          # 首页（统计+配额）
│   │   │   ├── Login.jsx         # Desktop OAuth 登录页
│   │   │   ├── Settings.jsx      # 设置页
│   │   │   └── About.jsx         # 关于页
│   │   ├── modals/           # 弹窗组件
│   │   │   └── AccountDetailModal.jsx # 账号详情弹窗
│   │   ├── ui/               # UI 基础组件
│   │   │   ├── dialog.jsx    # Dialog 组件（基于 Headless UI）
│   │   │   └── button.jsx    # Button 组件
│   │   ├── Sidebar.jsx       # 侧边栏导航
│   │   ├── UpdateChecker.jsx # 更新检查组件
│   │   ├── Watermark.jsx     # 水印组件
│   │   └── AuthCallback.jsx  # OAuth 回调处理
│   ├── contexts/             # React Context
│   │   ├── ThemeContext.jsx  # 主题管理（浅色/深色/紫色/绿色）
│   │   └── DialogContext.jsx # 全局弹窗管理
│   ├── hooks/                # 全局 hooks
│   │   └── useApp.js         # 应用全局 hook
│   ├── locales/              # 国际化语言包
│   └── utils/                # 工具函数
│       └── accountStats.js   # 账号统计工具
│
├── src-tauri/                # Rust 后端
│   ├── src/
│   │   ├── main.rs           # Tauri 入口，命令注册
│   │   ├── commands/         # Tauri 命令处理
│   │   │   ├── mod.rs            # 模块导出
│   │   │   ├── account_cmd.rs    # 账号增删改查
│   │   │   ├── auth_cmd.rs       # 认证命令
│   │   │   ├── app_settings_cmd.rs   # 应用设置命令
│   │   │   ├── kiro_settings_cmd.rs  # Kiro IDE 设置命令
│   │   │   ├── machine_guid_cmd.rs   # 系统机器码命令
│   │   │   ├── mcp_cmd.rs        # MCP 管理命令
│   │   │   ├── proxy_cmd.rs      # 代理检测命令
│   │   │   ├── sso_import_cmd.rs # SSO Token 导入命令
│   │   │   ├── steering_cmd.rs   # Steering 规则命令
│   │   │   ├── fingerprint_cmd.rs # 指纹管理命令
│   │   │   └── update_cmd.rs     # 更新检查命令
│   │   ├── providers/        # 认证提供者实现
│   │   │   ├── mod.rs        # 模块导出
│   │   │   ├── base.rs       # 基础 trait
│   │   │   ├── factory.rs    # 提供者工厂
│   │   │   ├── social.rs     # Google/GitHub OAuth
│   │   │   └── idc.rs        # AWS IAM Identity Center (BuilderId/Enterprise)
│   │   ├── kiro_portal_client.rs # Kiro Portal 客户端（获取配额）
│   │   ├── account.rs        # 账号模型和存储
│   │   ├── auth.rs           # 认证工具
│   │   ├── auth_social.rs    # 社交登录认证
│   │   ├── state.rs          # 应用状态管理
│   │   ├── kiro.rs           # Kiro IDE 集成（切换账号、读取本地账号）
│   │   ├── mcp.rs            # MCP 配置管理
│   │   ├── process.rs        # 进程管理
│   │   ├── browser.rs        # 浏览器操作
│   │   ├── kiro_auth_client.rs       # Kiro 认证客户端
│   │   ├── codewhisperer_client.rs   # CodeWhisperer 客户端
│   │   ├── aws_sso_client.rs         # AWS SSO 客户端
│   │   ├── deep_link_handler.rs      # Deep Link 处理
│   │   └── steering.rs               # Steering 规则管理
│   ├── tauri.conf.json       # Tauri 配置
│   └── Cargo.toml            # Rust 依赖
│
├── docs/                     # 文档
│   ├── 开发规范文档.md       # 完整开发规范
│   ├── Kiro配置文件说明.md   # Kiro IDE 配置说明
│   ├── MCP管理功能规划.md    # MCP 功能规划
│   ├── 批量导入功能规划.md   # 批量导入规划
│   └── api/                  # API 文档
└── scripts/                  # 构建/工具脚本
    ├── check_kiro_db.py      # Kiro 数据库检查
    └── read_kiro_db.py       # Kiro 数据库读取
```

### 关键模式

**前后端通信**
使用 `invoke()` 调用 Rust 命令：
```javascript
import { invoke } from '@tauri-apps/api/core'
const accounts = await invoke('get_accounts')
```

**Tauri 命令**
命令定义在 `src-tauri/src/commands/`，在 `main.rs` 中注册：
```rust
#[tauri::command]
pub fn get_accounts(state: State<AppState>) -> Vec<Account> {
    state.store.lock().unwrap().get_all()
}
```

**组件组织**
- 功能组件放在 `src/components/features/` 文件夹
- 弹窗组件放在 `src/components/modals/` 文件夹
- UI 基础组件放在 `src/components/ui/` 文件夹
- 自定义 hooks 放在 `hooks/` 子文件夹
- 共享 Context 放在 `src/contexts/`
- 账号管理采用卡片网格布局（AccountCard.jsx）

**状态管理**
- React Context 管理 UI 状态（主题、弹窗）
- Tauri AppState（Mutex 包装）管理后端状态
- 本地文件持久化存储（accounts.json、settings.json）

**数据存储路径**
- 账号数据：`%APPDATA%\.kiro-account-manager\accounts.json`
- 应用设置：`%APPDATA%\.kiro-account-manager\settings.json`
- MCP 配置：`~/.kiro/settings/mcp.json`

**认证架构**
- 2 种 AuthMethod：Social（Google、GitHub）、Idc（BuilderId、Enterprise）
- 4 种 Provider：Google、GitHub、BuilderId、Enterprise
- 2 个实现类：SocialProvider、IdcProvider
- Enterprise 和 BuilderId 使用完全相同的流程和接口，只是 Start URL 不同
