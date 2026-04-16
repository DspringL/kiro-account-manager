# 手动测试指南

## 测试前准备

### 1. 环境检查

```bash
# 检查 Python 环境
./check_python_env.sh

# 检查 Rust 编译
./test_build.sh
```

### 2. 安装 Camoufox

```bash
cd src-tauri/scripts
pip install -r requirements.txt
python -m camoufox fetch
```

### 3. 配置临时邮箱 API

确保你已经部署了 cloudflare_temp_email 服务，并获取：
- API 地址（例如：`https://apimail.example.com`）
- Admin 密码（x-admin-auth 的值）

---

## 测试步骤

### 测试 1: 临时邮箱 API 测试

#### 1.1 创建临时邮箱

```bash
curl -X POST https://apimail.example.com/admin/new_address \
  -H "x-admin-auth: YOUR_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{
    "enablePrefix": false,
    "name": "test123"
  }'
```

**预期结果**:
```json
{
  "jwt": "eyJ...",
  "address": "test123@example.com",
  "address_id": 1
}
```

#### 1.2 获取邮件列表

```bash
curl -X GET "https://apimail.example.com/api/mails?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT"
```

**预期结果**:
```json
{
  "results": [],
  "count": 0
}
```

#### 1.3 删除临时邮箱

```bash
curl -X DELETE https://apimail.example.com/admin/delete_address/1 \
  -H "x-admin-auth: YOUR_PASSWORD"
```

---

### 测试 2: Python 脚本测试

#### 2.1 准备测试数据

创建测试输入文件 `test_input.json`:

```json
{
  "email": "test@example.com",
  "verification_code": "123456",
  "proxy_url": null
}
```

#### 2.2 运行脚本

```bash
cd src-tauri/scripts
cat test_input.json | python3 auto_register.py
```

**预期输出**:
- 实时日志（type: "log"）
- 最终结果（type: "result"）
- 或错误信息（type: "error"）

---

### 测试 3: Rust 编译测试

```bash
cd src-tauri
cargo check
cargo clippy
cargo test
```

**预期结果**:
- `cargo check`: 编译通过，无错误
- `cargo clippy`: 无警告或只有少量可忽略的警告
- `cargo test`: 所有测试通过

---

### 测试 4: 前端开发测试

```bash
npm run dev
```

访问 `http://localhost:1420`，检查：
- [ ] 侧边栏显示"账号注册"菜单
- [ ] 点击进入注册页面
- [ ] 页面布局正常
- [ ] 输入框可以正常输入
- [ ] 按钮可以点击

---

### 测试 5: 完整流程测试

#### 5.1 启动应用

```bash
npm run tauri dev
```

#### 5.2 配置临时邮箱

1. 进入"账号注册"页面
2. 填写：
   - API 地址：`https://apimail.example.com`
   - Admin 密码：`YOUR_PASSWORD`
   - 代理地址：（可选）`http://127.0.0.1:7890`
   - 注册数量：`1`

#### 5.3 检查 Camoufox

点击"检查 Camoufox"按钮，确认显示"Camoufox 已安装"。

#### 5.4 开始注册

1. 点击"开始注册"按钮
2. 观察日志输出：
   - [ ] 创建临时邮箱成功
   - [ ] 浏览器启动
   - [ ] 进入 AWS 注册页面
   - [ ] 输入邮箱
   - [ ] 等待验证码
   - [ ] 获取验证码成功
   - [ ] 输入验证码
   - [ ] 输入姓名
   - [ ] 设置密码
   - [ ] 获取 SSO Token
   - [ ] 转换为 refresh_token（可能失败）
   - [ ] 导入账号成功
   - [ ] 清理临时邮箱

#### 5.5 验证结果

1. 进入"账号管理"页面
2. 检查是否有新增的账号
3. 尝试切换到新账号
4. 验证账号是否可用

---

## 常见问题排查

### 问题 1: Camoufox 未安装

**症状**: 点击"检查 Camoufox"显示未安装

**解决方法**:
```bash
cd src-tauri/scripts
pip install camoufox
python -m camoufox fetch
```

### 问题 2: 临时邮箱 API 连接失败

**症状**: 日志显示"创建临时邮箱失败"

**排查步骤**:
1. 检查 API 地址是否正确
2. 检查 Admin 密码是否正确
3. 使用 curl 测试 API 是否可访问
4. 检查网络连接

### 问题 3: 验证码获取超时

**症状**: 日志显示"等待验证码超时"

**可能原因**:
1. AWS 邮件发送延迟
2. 邮箱地址被 AWS 拒绝
3. 临时邮箱服务问题

**解决方法**:
1. 增加等待时间（修改 `max_wait_seconds`）
2. 更换邮箱地址
3. 检查临时邮箱服务日志

### 问题 4: SSO Token 转换失败

**症状**: 日志显示"转换失败"，但使用 SSO Token 作为 fallback

**说明**: 这是预期行为，SSO Token 转换功能可能需要调整

**后续工作**:
1. 参考 `.ai/sso_token_test.md` 进行测试
2. 根据测试结果调整实现
3. 如果转换失败，账号仍然可以导入（使用 SSO Token）

### 问题 5: 浏览器自动化失败

**症状**: 日志显示"未找到 XXX 输入框"

**可能原因**:
1. AWS 页面结构变化
2. 网络延迟导致元素未加载
3. 选择器不正确

**解决方法**:
1. 增加等待时间
2. 更新选择器
3. 检查 AWS 页面是否有变化

---

## 性能测试

### 单个账号注册

- **预期时间**: 2-3 分钟
- **内存占用**: < 500MB
- **CPU 使用率**: < 50%

### 批量注册（10 个）

- **预期时间**: 20-30 分钟
- **内存占用**: < 1GB
- **CPU 使用率**: < 60%

---

## 测试检查清单

### 功能测试
- [ ] 临时邮箱 API 可用
- [ ] Python 脚本可以运行
- [ ] Rust 代码可以编译
- [ ] 前端页面可以访问
- [ ] 单个账号注册成功
- [ ] 账号可以导入到管理器
- [ ] 账号可以正常使用

### 错误处理测试
- [ ] API 地址错误时有提示
- [ ] Admin 密码错误时有提示
- [ ] Camoufox 未安装时有提示
- [ ] 验证码超时时有提示
- [ ] 注册失败时有提示

### UI 测试
- [ ] 亮色主题显示正常
- [ ] 暗色主题显示正常
- [ ] 输入框占位符可见
- [ ] 按钮 hover 效果正常
- [ ] 日志滚动正常
- [ ] 统计信息更新正常

### 性能测试
- [ ] 单个注册时间 < 5 分钟
- [ ] 内存占用 < 1GB
- [ ] CPU 使用率 < 80%
- [ ] 无内存泄漏

---

## 测试报告模板

```markdown
# 测试报告

**测试日期**: 2026-04-XX
**测试人员**: XXX
**测试环境**: macOS / Windows / Linux

## 测试结果

### 功能测试
- 临时邮箱 API: ✅ / ❌
- Python 脚本: ✅ / ❌
- Rust 编译: ✅ / ❌
- 前端页面: ✅ / ❌
- 单个注册: ✅ / ❌
- 批量注册: ✅ / ❌

### 性能数据
- 单个注册时间: XX 分钟
- 内存占用: XX MB
- CPU 使用率: XX%

### 发现的问题
1. 问题描述
   - 重现步骤
   - 预期结果
   - 实际结果
   - 截图/日志

### 建议
1. 建议内容

## 总结
测试通过 / 测试失败
```

---

最后更新: 2026-04-16
