# AWS Builder ID 账号注册逻辑说明

本目录提取自项目真实代码，包含两种完整的注册方式。

## 文件清单

| 文件 | 语言 | 说明 |
|------|------|------|
| `auto_register.py` | Python | 浏览器自动化脚本（两种模式的核心） |
| `auto_register_cmd.rs` | Rust | Tauri 命令层，协调两种流程 |
| `sso_token_converter.rs` | Rust | 设备码申请 + 轮询 token + SSO Token 转换 |
| `aws_sso_client.rs` | Rust | AWS OIDC HTTP 客户端（授权码流程） |

---

## 两种注册方式概览

```
方式一：设备码注册（register 模式）
  Rust 申请设备码 → Python 浏览器注册 → Rust 轮询拿 token

方式二：授权码注册（authorize 模式）
  Rust 生成授权 URL + 启动本地回调服务器 → Python 浏览器注册 → 浏览器跳转回调 → Rust 用 code 换 token
```

---

## 方式一：设备码注册（register 模式）

### 整体流程

```
┌─────────────────────────────────────────────────────────────────┐
│ Rust: auto_register_cmd.rs                                      │
│                                                                 │
│  1. request_device_code("us-east-1")                           │
│     ├─ POST /client/register  → clientId, clientSecret         │
│     └─ POST /device_authorization → deviceCode, userCode       │
│                                                                 │
│  2. 把 userCode 传给 Python 脚本                                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ userCode（如 ABCD-EFGH）
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Python: auto_register.py → register_aws()                       │
│                                                                 │
│  1. 创建临时邮箱（POST /admin/new_address）                     │
│  2. 打开浏览器，访问：                                          │
│     https://view.awsapps.com/start/#/device?user_code=XXXX-XXXX│
│  3. 输入邮箱 → 点击继续                                        │
│  4. 输入姓名 → 点击继续                                        │
│  5. 等待验证码邮件（轮询临时邮箱 API）                         │
│  6. 输入验证码 → 点击继续                                      │
│  7. 输入密码 + 确认密码 → 点击继续                             │
│  8. 等待 SSO Cookie（x-amz-sso_authn）写入                     │
│  9. 点击 "Confirm and continue"                                 │
│ 10. 点击 "Allow access"（完成设备授权关联）                    │
│ 11. 输出 { success, sso_token, email, name }                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 注册完成，deviceCode 已与账号关联
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Rust: sso_token_converter.rs → poll_token_after_register()      │
│                                                                 │
│  轮询 POST /token（grantType: device_code）                    │
│  ├─ authorization_pending → 继续等待                           │
│  └─ 200 OK → accessToken + refreshToken ✓                      │
└─────────────────────────────────────────────────────────────────┘
```

### 关键代码位置

**Step 1 — 申请设备码**（`sso_token_converter.rs: request_device_code`）

```rust
// 注册 OIDC 客户端（device_code 类型）
POST https://oidc.us-east-1.amazonaws.com/client/register
{
  "clientName": "Kiro Account Manager",
  "clientType": "public",
  "scopes": ["codewhisperer:completions", ...],
  "grantTypes": ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"],
  "issuerUrl": "https://view.awsapps.com/start"
}
→ { clientId, clientSecret }

// 发起设备授权
POST https://oidc.us-east-1.amazonaws.com/device_authorization
{ "clientId": "...", "clientSecret": "...", "startUrl": "https://view.awsapps.com/start" }
→ { deviceCode, userCode, interval }
```

**Step 2 — 浏览器注册**（`auto_register.py: register_aws`）

注册页面 URL 格式：
```
https://view.awsapps.com/start/#/device?user_code=XXXX-XXXX
```

页面操作顺序：
```
input[placeholder="username@example.com"]  ← 邮箱
button[data-testid="test-primary-button"]  ← 继续

input[placeholder="Maria José Silva"]      ← 姓名
button[data-testid="signup-next-button"]   ← 继续

input[placeholder="6 位数"]               ← 验证码
button[data-testid="email-verification-verify-button"] ← 继续

input[placeholder="Enter password"]        ← 密码
input[placeholder="Re-enter password"]     ← 确认密码
button[data-testid="test-primary-button"]  ← 继续

等待 cookie: x-amz-sso_authn              ← SSO Token

button:has-text("Confirm and continue")    ← 授权确认
button:has-text("Allow access")            ← 允许访问（关键！完成设备码关联）
```

> **为什么必须点 "Allow access"？**
> 设备码流程中，`deviceCode` 需要用户在浏览器完成授权后才能换取 token。
> 点击 "Allow access" 就是完成这个关联动作，之后 Rust 侧轮询才能拿到 token。

**Step 3 — 轮询 token**（`sso_token_converter.rs: poll_token_after_register`）

```rust
// 每隔 poll_interval 秒轮询一次
POST https://oidc.us-east-1.amazonaws.com/token
{
  "clientId": "...",
  "clientSecret": "...",
  "grantType": "urn:ietf:params:oauth:grant-type:device_code",
  "deviceCode": "..."
}
// authorization_pending → 继续等
// 200 OK → { accessToken, refreshToken, expiresIn }
```

### 降级方案：SSO Token 转换

如果直接轮询失败，会尝试用浏览器拿到的 `x-amz-sso_authn` Cookie 换取 token（`sso_device_auth`）：

```
SSO Token → whoAmI 验证 → 获取设备会话令牌 → 接受 userCode → 批准授权 → 轮询 token
```

具体步骤（`sso_token_converter.rs: sso_device_auth`）：

```
Step 3: GET  https://portal.sso.us-east-1.amazonaws.com/token/whoAmI
        Authorization: Bearer <sso_token>

Step 4: POST https://portal.sso.us-east-1.amazonaws.com/session/device
        → { token: deviceSessionToken }

Step 5: POST https://oidc.us-east-1.amazonaws.com/device_authorization/accept_user_code
        { "userCode": "...", "userSessionId": deviceSessionToken }
        → { deviceContext: { deviceContextId, clientId, clientType } }

Step 6: POST https://oidc.us-east-1.amazonaws.com/device_authorization/associate_token
        { "deviceContext": {...}, "userSessionId": deviceSessionToken }

Step 7: 轮询 POST /token（同上）
```

---

## 方式二：授权码注册（authorize 模式）

### 整体流程

```
┌─────────────────────────────────────────────────────────────────┐
│ Rust: auto_register_cmd.rs + browser_automation.rs              │
│                                                                 │
│  1. 启动本地 HTTP 服务器（随机端口，如 :54321）                 │
│     redirect_uri = http://127.0.0.1:54321/oauth/callback        │
│                                                                 │
│  2. 注册 OIDC 客户端（authorization_code 类型）                 │
│     POST /client/register                                       │
│     → clientId, clientSecret                                    │
│                                                                 │
│  3. 生成 PKCE（code_verifier + code_challenge）                 │
│                                                                 │
│  4. 构建授权 URL：                                              │
│     https://oidc.us-east-1.amazonaws.com/authorize              │
│       ?response_type=code                                       │
│       &client_id=...                                            │
│       &redirect_uri=http://127.0.0.1:54321/oauth/callback       │
│       &scopes=codewhisperer:completions,...                     │
│       &state=<uuid>                                             │
│       &code_challenge=<S256>                                    │
│       &code_challenge_method=S256                               │
│                                                                 │
│  5. 后台线程监听本地服务器，等待 AWS 回调                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ authorize_url
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Python: auto_register.py → register_aws_authorize()             │
│                                                                 │
│  1. 打开浏览器，访问 authorize_url                              │
│  2. 创建临时邮箱                                                │
│  3. 输入邮箱 → 点击继续                                        │
│  4. 输入姓名 → 点击继续                                        │
│  5. 等待验证码邮件（轮询临时邮箱 API）                         │
│  6. 输入验证码 → 点击继续                                      │
│  7. 输入密码 + 确认密码 → 点击继续                             │
│  8. 等待 SSO Cookie（x-amz-sso_authn）写入                     │
│  9. 点击 "Allow access"（触发 AWS 回调跳转）                   │
│ 10. 浏览器跳转到 http://127.0.0.1:54321/oauth/callback?code=...│
│ 11. 输出 { success, sso_token, email, name }                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ 浏览器跳转触发本地服务器收到 code
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Rust: auto_register_cmd.rs                                      │
│                                                                 │
│  本地服务器解析回调 URL，提取 code 和 state                     │
│  验证 state 一致性                                              │
│                                                                 │
│  POST https://oidc.us-east-1.amazonaws.com/token               │
│  {                                                              │
│    "clientId": "...",                                           │
│    "clientSecret": "...",                                       │
│    "grantType": "authorization_code",                           │
│    "code": "<从回调获取>",                                      │
│    "codeVerifier": "<PKCE verifier>",                           │
│    "redirectUri": "http://127.0.0.1:54321/oauth/callback"       │
│  }                                                              │
│  → { accessToken, refreshToken, expiresIn } ✓                  │
└─────────────────────────────────────────────────────────────────┘
```

### 关键代码位置

**Step 1-4 — 生成授权 URL**（`browser_automation.rs: generate_authorize_url`）

```rust
// 注册 OIDC 客户端（authorization_code 类型，与 register 模式不同）
POST /client/register
{
  "clientName": "Kiro IDE",
  "clientType": "public",
  "scopes": [...],
  "grantTypes": ["authorization_code", "refresh_token"],  // ← 注意这里
  "redirectUris": ["http://127.0.0.1:{port}/oauth/callback"],
  "issuerUrl": "https://view.awsapps.com/start"
}

// 授权 URL 格式
https://oidc.us-east-1.amazonaws.com/authorize
  ?response_type=code
  &client_id={clientId}
  &redirect_uri=http%3A%2F%2F127.0.0.1%3A{port}%2Foauth%2Fcallback
  &scopes=codewhisperer%3Acompletions%2C...
  &state={uuid}
  &code_challenge={base64url(sha256(code_verifier))}
  &code_challenge_method=S256
```

**Step 5 — 本地回调服务器**（`auto_register_cmd.rs`）

```rust
// 使用 tiny_http 在随机端口启动本地 HTTP 服务器
let server = tiny_http::Server::http("127.0.0.1:0").unwrap();
let port = server.server_addr().to_ip().unwrap().port();

// 后台线程轮询，等待 /oauth/callback 请求
std::thread::spawn(move || {
    loop {
        if let Ok(Some(request)) = server.try_recv() {
            if request.url().starts_with("/oauth/callback") {
                // 解析 ?code=xxx&state=xxx
                // 验证 state，提取 code
                // 通过 oneshot channel 发送给主线程
            }
        }
        std::thread::sleep(Duration::from_millis(100));
    }
});
```

**Step 9 — 浏览器操作**（`auto_register.py: register_aws_authorize`）

与 register 模式的页面操作基本相同，区别在于：
- 打开的是 `authorize_url`（包含 PKCE 参数），而不是 `/device?user_code=...`
- 不需要点 "Confirm and continue"（授权码流程不走设备码路径）
- 点击 "Allow access" 后，AWS 直接把浏览器重定向到 `redirect_uri?code=xxx`

**Step 6 — 用 code 换 token**（`aws_sso_client.rs: create_token`）

```rust
POST https://oidc.us-east-1.amazonaws.com/token
{
  "clientId": "...",
  "clientSecret": "...",
  "grantType": "authorization_code",
  "code": "<从回调 URL 提取>",
  "codeVerifier": "<PKCE verifier>",
  "redirectUri": "http://127.0.0.1:{port}/oauth/callback"
}
→ { accessToken, refreshToken, idToken, expiresIn }
```

---

## 两种方式对比

| 维度 | 设备码（register） | 授权码（authorize） |
|------|-------------------|-------------------|
| **grantType** | `device_code` | `authorization_code` |
| **注册页面 URL** | `/start/#/device?user_code=XXXX` | `/authorize?...&code_challenge=...` |
| **token 获取方式** | 注册完成后轮询 `/token` | 浏览器回调带 `code`，直接换 token |
| **本地服务器** | 不需要 | 需要（接收 OAuth 回调） |
| **PKCE** | 不需要 | 需要（S256） |
| **浏览器最后一步** | 点 "Confirm and continue" + "Allow access" | 只点 "Allow access" |
| **适用场景** | 批量注册，流程更稳定 | 与 Kiro IDE 登录流程一致 |

---

## 临时邮箱

两种模式都使用自建的临时邮箱服务（Cloudflare Email Worker + D1 数据库），通过 HTTP API 操作：

```python
# 创建邮箱
POST {api_url}/admin/new_address
Headers: x-admin-auth: {admin_password}
Body: { "enablePrefix": false, "name": "随机12位字符串" }
→ { address, jwt, address_id }

# 轮询收件箱（等待 AWS 验证码邮件）
GET {api_url}/api/mails?limit=20&offset=0
Headers: Authorization: Bearer {jwt}
→ { results: [{ source, raw, ... }] }
# 从 raw 字段用正则提取 6 位验证码

# 注册完成后清理
DELETE {api_url}/admin/delete_address/{address_id}
Headers: x-admin-auth: {admin_password}
```

验证码提取正则（按优先级）：
```python
r"verification code is[:\s]*(\d{6})"
r"Your code is[:\s]*(\d{6})"
r"code is[:\s]*(\d{6})"
r">\s*(\d{6})\s*<"
r"\b(\d{6})\b"   # 兜底
```

---

## 反检测机制

Python 脚本内置了完整的反检测方案：

**1. 浏览器指纹（`generate_fingerprint` + `build_fingerprint_script`）**

每次注册随机生成一套指纹，覆盖：
- `navigator.platform` / `hardwareConcurrency` / `deviceMemory` / `language`
- `screen.width` / `height` / `devicePixelRatio`
- Canvas 像素噪声（seeded random，每次不同）
- WebGL vendor/renderer 字符串
- Audio 频率微扰
- 时区（`Date.getTimezoneOffset` + `Intl.DateTimeFormat`）
- 字体列表（`document.fonts.check`）
- ClientRects 微扰（`getBoundingClientRect` 加 0.0001px 噪声）
- 禁用 WebRTC（防 IP 泄露）
- 移除 `navigator.webdriver` 标志

**2. 浏览器引擎选择**

- `camoufox`：内置反检测的 Firefox 变体，推荐用于 register 模式
- `playwright`：标准 Chromium，配合上述指纹脚本注入

**3. 人类行为模拟**

- `simulate_mouse_move`：贝塞尔曲线鼠标轨迹
- `human_type`：逐字符输入，每字符 50-150ms 随机延迟
- `human_click`：移动鼠标到元素中心（带随机偏移）再点击
- `simulate_pre_registration_behavior`：页面加载后先做 2-3 次随机鼠标移动
- `slow_mode`：开启后每步操作前额外等待 1-10s（可配置范围）

**4. 错误弹窗自动处理**

`dismiss_error_banner`：检测 AWS 的 "Sorry, there was an error" 弹窗，自动点关闭按钮后重试。

---

## 最终产物

两种方式成功后都返回相同的结构：

```rust
RegisterResult {
    success: true,
    access_token: Some("..."),    // 短期令牌
    refresh_token: Some("..."),   // 长期令牌，用于后续刷新
    client_id: Some("..."),       // 注册时的 OIDC clientId
    client_secret: Some("..."),   // 注册时的 OIDC clientSecret
    region: Some("us-east-1"),
    email: Some("xxx@tempmail"),
    name: Some("John Smith"),
    sso_token: None,              // 一般不需要，降级时才有
    error: None,
}
```

`refresh_token` + `client_id` + `client_secret` + `region` 是后续刷新 token 的必要参数：

```rust
// 刷新 token（aws_sso_client.rs: refresh_token）
POST https://oidc.{region}.amazonaws.com/token
{
  "clientId": "...",
  "clientSecret": "...",
  "grantType": "refresh_token",
  "refreshToken": "..."
}
→ { accessToken, refreshToken, expiresIn }
```
