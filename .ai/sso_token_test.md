# SSO Token 转 refresh_token 测试方案

## 测试目标
验证 SSO Token (x-amz-sso_authn) 能否成功转换为 refresh_token

## 测试环境
- Rust 后端已实现转换逻辑
- Python 脚本能获取 SSO Token
- 前端能接收并使用 refresh_token

## 测试步骤

### 步骤 1: 手动获取 SSO Token
1. 打开浏览器,访问 AWS Builder ID 注册页面
2. 完成注册流程
3. 按 F12 打开开发者工具
4. Application -> Cookies
5. 找到 `x-amz-sso_authn` Cookie
6. 复制其值

### 步骤 2: 测试转换 API
使用 curl 测试 AWS SSO OIDC API:

```bash
# 方法 1: token-exchange
curl -X POST https://oidc.us-east-1.amazonaws.com/token \
  -H "Content-Type: application/x-amz-json-1.1" \
  -H "X-Amz-Target: AWSIEPortalService.CreateToken" \
  -d '{
    "clientId": "arn:aws:sso::aws:app/ssoins-722377b1a6e95e8c/apl-080bf5c0c5d04f4f",
    "grantType": "urn:ietf:params:oauth:grant-type:token-exchange",
    "subjectToken": "YOUR_SSO_TOKEN",
    "subjectTokenType": "urn:ietf:params:oauth:token-type:access_token"
  }'

# 方法 2: 使用 SSO Token 获取用户信息
curl -X GET https://oidc.us-east-1.amazonaws.com/userinfo \
  -H "Authorization: Bearer YOUR_SSO_TOKEN"
```

### 步骤 3: 分析响应
查看 API 返回的内容:
- 是否包含 `access_token`
- 是否包含 `refresh_token`
- `refresh_token` 的格式是否正确 (应该以 "aor" 开头)

### 步骤 4: 调整实现
根据测试结果调整 Rust 代码:

#### 如果方法 1 成功
保持当前实现不变

#### 如果方法 1 失败,尝试其他方法
```rust
// 方法 2: 使用不同的 grant_type
params.insert("grantType", "refresh_token");

// 方法 3: 使用不同的 endpoint
let token_url = "https://portal.sso.us-east-1.amazonaws.com/token";

// 方法 4: 添加额外的参数
params.insert("scope", "sso:account:access");
```

## 已知的 AWS SSO OIDC 端点

### 1. Token 端点
```
POST https://oidc.{region}.amazonaws.com/token
```

### 2. UserInfo 端点
```
GET https://oidc.{region}.amazonaws.com/userinfo
```

### 3. Register Client 端点
```
POST https://oidc.{region}.amazonaws.com/client/register
```

## 可能的 Grant Types

1. `urn:ietf:params:oauth:grant-type:token-exchange`
2. `urn:ietf:params:oauth:grant-type:device_code`
3. `refresh_token`
4. `authorization_code`

## 参考资料

### AWS 官方文档
- [AWS SSO OIDC API Reference](https://docs.aws.amazon.com/singlesignon/latest/OIDCAPIReference/Welcome.html)
- [CreateToken API](https://docs.aws.amazon.com/singlesignon/latest/OIDCAPIReference/API_CreateToken.html)

### 相关 RFC
- [RFC 8693: OAuth 2.0 Token Exchange](https://datatracker.ietf.org/doc/html/rfc8693)
- [RFC 6749: OAuth 2.0 Authorization Framework](https://datatracker.ietf.org/doc/html/rfc6749)

## 备选方案

### 方案 A: 直接使用 SSO Token
如果转换失败,直接使用 SSO Token 作为 refresh_token:
```rust
// 在 auto_register_cmd.rs 中
if convert_result.is_err() {
    log::warn!("SSO Token 转换失败,使用 SSO Token 作为 refresh_token");
    refresh_token = Some(sso_token.clone());
}
```

### 方案 B: 使用 Kiro IDE 的登录流程
1. 获取 SSO Token 后
2. 模拟 Kiro IDE 的登录流程
3. 通过 Kiro IDE 的 API 获取 refresh_token

### 方案 C: 抓包分析
1. 使用 Wireshark/Charles 抓包
2. 分析 Kiro IDE 登录时的网络请求
3. 复制相同的请求流程

## 测试检查清单

- [ ] SSO Token 格式正确
- [ ] API 端点可访问
- [ ] 请求参数正确
- [ ] 响应包含 refresh_token
- [ ] refresh_token 格式正确 (以 "aor" 开头)
- [ ] refresh_token 可以用于刷新 access_token
- [ ] 账号可以成功导入到管理器

## 调试技巧

### 1. 启用详细日志
```rust
// 在 sso_token_converter.rs 中
log::debug!("请求 URL: {}", token_url);
log::debug!("请求参数: {:?}", params);
log::debug!("响应状态: {}", status);
log::debug!("响应内容: {}", body);
```

### 2. 保存响应到文件
```rust
std::fs::write("sso_response.json", &body)?;
```

### 3. 使用 Postman 测试
导入 API 请求到 Postman,方便调试和测试

## 预期结果

### 成功场景
```json
{
  "access_token": "eyJ...",
  "refresh_token": "aor_...",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

### 失败场景
```json
{
  "error": "invalid_grant",
  "error_description": "The provided authorization grant is invalid..."
}
```

## 下一步行动

1. **立即执行**: 手动测试 SSO Token 转换
2. **根据结果**: 调整 Rust 实现
3. **集成测试**: 完整流程测试
4. **文档更新**: 记录最终的工作方案

---

最后更新: 2026-04-16
