# 账号自动注册功能测试指南

## 前置条件

### 1. 安装 Camoufox
```bash
cd src-tauri/scripts
./setup.sh
```

或手动安装:
```bash
pip3 install camoufox
python3 -m camoufox fetch
```

### 2. 配置临时邮箱 API
- 确保已部署 cloudflare_temp_email 服务
- 记录 API 地址和 admin 密码

### 3. 启动应用
```bash
npm run tauri dev
```

## 测试步骤

### 测试 1: 检查 Camoufox 安装状态
1. 打开应用,进入"账号注册"页面
2. 查看右上角的 Camoufox 状态
3. 如果显示"未安装",点击"检查 Camoufox"按钮
4. 预期结果: 显示"Camoufox 已安装"或"Camoufox 未安装"

### 测试 2: 配置临时邮箱
1. 在"临时邮箱配置"区域填写:
   - API 地址: `https://your-api-url.com`
   - Admin 密码: `your-admin-password`
   - 代理地址(可选): `http://127.0.0.1:7890`
2. 设置注册数量: 1
3. 配置会自动保存到 localStorage

### 测试 3: 单个账号注册
1. 点击"开始注册"按钮
2. 观察日志输出:
   - 创建临时邮箱
   - 启动浏览器
   - 输入邮箱
   - 等待验证码
   - 输入验证码
   - 完成注册
   - 获取 SSO Token
   - 导入账号
3. 预期结果:
   - 日志显示"注册成功"
   - 统计信息显示"成功 1"
   - 账号自动添加到账号管理器

### 测试 4: 批量注册
1. 设置注册数量: 3
2. 点击"开始注册"
3. 观察每个账号的注册过程
4. 预期结果:
   - 3 个账号依次注册
   - 统计信息正确显示成功/失败数量
   - 所有成功的账号都添加到管理器

### 测试 5: 错误处理
1. 故意输入错误的 API 地址
2. 点击"开始注册"
3. 预期结果: 显示"创建临时邮箱失败"错误

## 已知问题

### 问题 1: SSO Token 无法直接用作 refresh_token
**现象**: 账号导入失败,提示 Token 无效

**原因**: SSO Token (x-amz-sso_authn) 不是标准的 OAuth2 refresh_token

**解决方案**: 需要实现 SSO Token 转 refresh_token 的逻辑
- 调用 AWS SSO OIDC API
- 使用 SSO Token 交换 access_token 和 refresh_token

**临时方案**: 
1. 手动从浏览器 Cookie 中获取 SSO Token
2. 使用 Kiro IDE 登录一次,获取 refresh_token
3. 将 refresh_token 手动添加到账号管理器

### 问题 2: Camoufox 安装失败
**现象**: `pip install camoufox` 失败

**解决方案**:
1. 确保 Python 3.8+ 已安装
2. 升级 pip: `pip3 install --upgrade pip`
3. 使用国内镜像: `pip3 install -i https://pypi.tuna.tsinghua.edu.cn/simple camoufox`

### 问题 3: 验证码获取超时
**现象**: 等待验证码超过 120 秒

**可能原因**:
1. 临时邮箱 API 不稳定
2. AWS 邮件发送延迟
3. 邮件被过滤

**解决方案**:
1. 检查临时邮箱 API 是否正常
2. 增加等待时间
3. 检查邮件过滤规则

## 调试技巧

### 1. 查看 Rust 日志
```bash
# 在 src-tauri 目录
cargo run
```

### 2. 查看 Python 脚本输出
```bash
# 手动运行 Python 脚本
cd src-tauri/scripts
echo '{"email":"test@example.com","verification_code":"123456"}' | python3 auto_register.py
```

### 3. 查看浏览器 Cookie
1. 注册过程中,浏览器会保持打开
2. 按 F12 打开开发者工具
3. Application -> Cookies
4. 查找 `x-amz-sso_authn` Cookie

### 4. 测试临时邮箱 API
```bash
# 创建邮箱
curl -X POST "https://your-api-url.com/admin/new_address" \
  -H "x-admin-auth: your-password" \
  -H "Content-Type: application/json" \
  -d '{"enablePrefix":false,"name":"test"}'

# 获取邮件
curl "https://your-api-url.com/api/mails?limit=20" \
  -H "Authorization: Bearer YOUR_JWT"
```

## 性能优化建议

1. **批量注册间隔**: 建议每个账号之间间隔 5-10 秒
2. **代理使用**: 如果注册失败率高,尝试使用代理
3. **并发限制**: 不建议同时注册超过 3 个账号
4. **错误重试**: 失败的账号可以单独重试

## 下一步开发

1. **实现 SSO Token 转 refresh_token**
   - 研究 AWS SSO OIDC API
   - 在 Rust 或 Python 中实现转换逻辑
   - 测试转换后的 refresh_token 是否有效

2. **优化用户体验**
   - 添加进度条
   - 优化日志显示
   - 添加暂停/恢复功能

3. **错误处理**
   - 添加自动重试
   - 更详细的错误提示
   - 错误日志导出

4. **Python 运行时内嵌**
   - 研究打包方案
   - 配置 Tauri 资源打包
   - 跨平台测试

---

最后更新: 2026-04-16
