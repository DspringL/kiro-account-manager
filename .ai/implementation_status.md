# 账号自动注册功能实现状态

## 最新更新: 2026-04-16

### 已实现的功能模块

#### 1. 临时邮箱 API (✅ 完成)
**文件**: `src-tauri/src/services/tempmail_api.rs`

**功能**:
- 创建临时邮箱地址
- 获取邮件列表
- 提取验证码(支持多种格式)
- 轮询等待验证码
- 删除邮箱地址

**状态**: 已完成并测试通过

---

#### 2. 浏览器自动化 (✅ 完成)
**文件**: 
- `src-tauri/scripts/auto_register.py` - Python 脚本
- `src-tauri/src/services/browser_automation.rs` - Rust 调用层

**功能**:
- 使用 Camoufox 进行浏览器自动化
- 支持注册和登录两种流程
- 自动填充表单
- 获取 SSO Token
- 实时日志输出

**状态**: 已完成,支持完整的注册流程

---

#### 3. SSO Token 转换器 (🔄 新增)
**文件**: `src-tauri/src/services/sso_token_converter.rs`

**功能**:
- 将 SSO Token (x-amz-sso_authn) 转换为 refresh_token
- 支持多种转换方法:
  - 方法 1: token-exchange grant type
  - 方法 2: 直接使用 SSO Token 作为 access_token
  - 方法 3: Fallback 机制

**实现细节**:
```rust
// AWS Builder ID 的固定 client_id
const BUILDER_ID_CLIENT_ID: &str = "arn:aws:sso::aws:app/ssoins-722377b1a6e95e8c/apl-080bf5c0c5d04f4f";

// Token 端点
let token_url = "https://oidc.us-east-1.amazonaws.com/token";

// Grant Type
"urn:ietf:params:oauth:grant-type:token-exchange"
```

**状态**: 已实现,待测试验证

**注意事项**:
1. AWS SSO OIDC API 的具体行为可能需要根据实际测试调整
2. 如果转换失败,会 fallback 到使用 SSO Token 作为 refresh_token
3. 需要验证转换后的 refresh_token 是否能正常使用

---

#### 4. 注册命令 (✅ 完成)
**文件**: `src-tauri/src/commands/auto_register_cmd.rs`

**功能**:
- `check_camoufox_installed` - 检查 Camoufox 是否已安装
- `auto_register_with_tempmail` - 完整的注册流程

**流程**:
1. 创建临时邮箱
2. 启动浏览器,进入注册页面
3. 等待验证码
4. 完成注册
5. 获取 SSO Token
6. **转换 SSO Token 为 refresh_token** (新增)
7. 返回结果

**状态**: 已完成,集成了 SSO Token 转换

---

#### 5. 前端界面 (✅ 完成)
**文件**: `src/components/features/AutoRegister/index.jsx`

**功能**:
- 临时邮箱配置
- 代理配置
- 注册数量设置
- Camoufox 安装状态检查
- 实时日志显示
- 统计信息
- 自动导入账号

**状态**: 已完成,UI 完整

---

### 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (React)                          │
│  - 配置界面                                                    │
│  - 日志显示                                                    │
│  - 统计信息                                                    │
└────────────────────┬────────────────────────────────────────┘
                     │ Tauri IPC
┌────────────────────▼────────────────────────────────────────┐
│                    Rust 后端 (Tauri)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  auto_register_cmd.rs (命令层)                        │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  tempmail_api.rs (临时邮箱 API)                       │   │
│  │  - 创建邮箱                                            │   │
│  │  - 获取验证码                                          │   │
│  │  - 删除邮箱                                            │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  browser_automation.rs (浏览器自动化)                 │   │
│  │  - 调用 Python 脚本                                    │   │
│  │  - 实时日志传输                                        │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  sso_token_converter.rs (SSO Token 转换)              │   │
│  │  - token-exchange                                      │   │
│  │  - fallback 机制                                       │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ Process
┌────────────────────▼────────────────────────────────────────┐
│                  Python (Camoufox)                            │
│  - auto_register.py                                           │
│  - 浏览器自动化                                                │
│  - 表单填充                                                    │
│  - Cookie 获取                                                 │
└───────────────────────────────────────────────────────────────┘
```

---

### 数据流

```
1. 用户配置
   ↓
2. 创建临时邮箱 (Rust API)
   ↓
3. 启动 Python 脚本 (Camoufox)
   ↓
4. 进入 AWS 注册页面
   ↓
5. 输入邮箱
   ↓
6. 等待验证码 (Rust 轮询临时邮箱 API)
   ↓
7. 输入验证码
   ↓
8. 完成注册
   ↓
9. 获取 SSO Token (Python 从 Cookie)
   ↓
10. 转换为 refresh_token (Rust 调用 AWS API) ← 新增
   ↓
11. 导入账号 (调用 add_account_by_social)
   ↓
12. 清理临时邮箱
```

---

### Git 提交历史

1. `feat: 添加临时邮箱 API 基础模块`
2. `feat: 添加 Python 注册脚本和 Camoufox 安装脚本`
3. `feat: 添加 Rust 集成层 - 浏览器自动化和注册命令`
4. `feat: 添加前端注册页面和路由配置`
5. `feat: 添加 refresh_token 支持到注册流程`
6. `feat: 完善注册流程 - 支持 SSO Token 导入`
7. **`feat: 实现 SSO Token 转 refresh_token 功能`** (待提交)

---

### 待测试项目

#### 高优先级
- [ ] SSO Token 转 refresh_token 是否成功
- [ ] 转换后的 refresh_token 是否能正常使用
- [ ] 账号是否能成功导入到管理器
- [ ] 完整的注册流程端到端测试

#### 中优先级
- [ ] 批量注册稳定性
- [ ] 错误处理和重试机制
- [ ] 代理配置是否生效
- [ ] 日志输出是否完整

#### 低优先级
- [ ] 性能优化
- [ ] UI/UX 改进
- [ ] 跨平台兼容性

---

### 已知问题和解决方案

#### 问题 1: AWS SSO OIDC API 的具体参数
**状态**: 待验证

**可能的解决方案**:
1. 参考 AWS SDK 源码
2. 抓包分析 Kiro IDE 的登录流程
3. 查阅 AWS 官方文档

**当前实现**:
- 使用 token-exchange grant type
- 如果失败,fallback 到直接使用 SSO Token

#### 问题 2: SSO Token 的有效期
**状态**: 未知

**影响**:
- 如果 SSO Token 有效期很短,可能在转换前就过期
- 需要尽快完成转换

**解决方案**:
- 在获取 SSO Token 后立即转换
- 添加超时和重试机制

#### 问题 3: refresh_token 的格式验证
**状态**: 待实现

**需要**:
- 验证 refresh_token 是否以 "aor" 开头
- 验证 refresh_token 的长度和格式
- 在导入前进行预检查

---

### 下一步计划

#### 立即执行 (今天)
1. ✅ 实现 SSO Token 转换器
2. ✅ 集成到注册命令
3. ⏳ 编译测试
4. ⏳ 端到端功能测试

#### 本周完成
1. 完善错误处理
2. 添加重试机制
3. 优化日志输出
4. 编写测试文档

#### 本月完成
1. Python 运行时内嵌
2. 跨平台测试
3. 性能优化
4. 发布第一个可用版本

---

### 测试命令

```bash
# 编译检查
cd src-tauri
cargo check

# 运行测试
cargo test

# 启动开发模式
cd ..
npm run tauri dev

# 构建发布版本
npm run tauri build
```

---

### API 参考

#### AWS SSO OIDC Token 端点
```
POST https://oidc.us-east-1.amazonaws.com/token
Content-Type: application/x-amz-json-1.1
X-Amz-Target: AWSIEPortalService.CreateToken

{
  "clientId": "arn:aws:sso::aws:app/ssoins-722377b1a6e95e8c/apl-080bf5c0c5d04f4f",
  "grantType": "urn:ietf:params:oauth:grant-type:token-exchange",
  "subjectToken": "<SSO_TOKEN>",
  "subjectTokenType": "urn:ietf:params:oauth:token-type:access_token"
}
```

#### 临时邮箱 API
```
# 创建邮箱
POST /admin/new_address
x-admin-auth: <PASSWORD>

# 获取邮件
GET /api/mails?limit=20
Authorization: Bearer <JWT>

# 删除邮箱
DELETE /admin/delete_address/<ID>
x-admin-auth: <PASSWORD>
```

---

最后更新: 2026-04-16 21:30
