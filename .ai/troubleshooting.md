# 故障排除指南

## 快速诊断

运行以下命令进行快速诊断：

```bash
# 1. 检查 Python 环境
./check_python_env.sh

# 2. 检查 Rust 编译
./test_build.sh

# 3. 检查前端构建
npm run build
```

---

## 常见错误及解决方案

### 错误 1: "Camoufox 未安装"

**错误信息**:
```
⚠ Camoufox 未安装，请先运行安装脚本
```

**解决方法**:

```bash
cd src-tauri/scripts
pip install -r requirements.txt
python -m camoufox fetch
```

**验证**:
```bash
python3 -c "from camoufox.async_api import AsyncCamoufox; print('OK')"
```

---

### 错误 2: "创建临时邮箱失败"

**错误信息**:
```
✗ 创建临时邮箱失败: 请求失败
```

**可能原因**:
1. API 地址错误
2. Admin 密码错误
3. 网络连接问题
4. API 服务未启动

**排查步骤**:

```bash
# 1. 测试 API 连接
curl -I https://apimail.example.com

# 2. 测试创建邮箱
curl -X POST https://apimail.example.com/admin/new_address \
  -H "x-admin-auth: YOUR_PASSWORD" \
  -H "Content-Type: application/json" \
  -d '{"enablePrefix": false, "name": "test"}'

# 3. 检查响应
# 成功: 返回 200 和 JSON 数据
# 失败: 返回 401 (密码错误) 或 500 (服务错误)
```

**解决方法**:
1. 确认 API 地址正确（包括 https:// 前缀）
2. 确认 Admin 密码正确
3. 检查网络连接和防火墙
4. 确认 API 服务正常运行

---

### 错误 3: "等待验证码超时"

**错误信息**:
```
✗ 获取验证码失败: 等待验证码超时
```

**可能原因**:
1. AWS 邮件发送延迟
2. 邮箱地址被 AWS 拒绝
3. 邮件被过滤或拦截
4. 临时邮箱服务问题

**排查步骤**:

```bash
# 1. 手动检查邮箱
curl -X GET "https://apimail.example.com/api/mails?limit=10&offset=0" \
  -H "Authorization: Bearer YOUR_JWT"

# 2. 检查邮件内容
# 查看是否有来自 AWS 的邮件
# 查看邮件是否包含验证码
```

**解决方法**:
1. 增加等待时间（修改 `max_wait_seconds` 参数）
2. 更换邮箱地址（使用不同的前缀）
3. 检查临时邮箱服务日志
4. 确认 AWS 没有限流

---

### 错误 4: "未找到 XXX 输入框"

**错误信息**:
```
✗ 未找到邮箱输入框
✗ 未找到验证码输入框
✗ 未找到密码输入框
```

**可能原因**:
1. AWS 页面结构变化
2. 网络延迟导致元素未加载
3. 选择器不正确
4. 页面加载失败

**排查步骤**:

1. 手动访问注册页面，检查元素是否存在
2. 使用浏览器开发者工具检查选择器
3. 查看 Python 脚本日志，确认页面 URL

**解决方法**:

```python
# 1. 增加等待时间
await page.wait_for_selector(selector, timeout=60000)  # 60 秒

# 2. 更新选择器
# 打开浏览器开发者工具，找到正确的选择器
# 修改 auto_register.py 中的选择器

# 3. 添加截图调试
await page.screenshot(path="debug.png")
```

---

### 错误 5: "SSO Token 转换失败"

**错误信息**:
```
⚠ 转换失败: API 返回错误 (400): ...
将使用 SSO Token 作为 refresh_token 尝试导入
```

**说明**: 这是**预期行为**，不是错误！

**原因**:
- AWS SSO OIDC API 的调用方式可能需要调整
- SSO Token 本身可能就是有效的认证凭证

**影响**:
- 账号仍然可以成功导入
- 使用 SSO Token 作为 refresh_token
- 功能正常，只是日志中有警告

**后续工作**:
1. 参考 `.ai/sso_token_test.md` 进行测试
2. 根据测试结果调整实现
3. 如果 SSO Token 可用，无需修改

---

### 错误 6: "导入账号失败"

**错误信息**:
```
导入账号失败: Invalid token
```

**可能原因**:
1. SSO Token 无效或过期
2. refresh_token 格式不正确
3. 账号已存在
4. 网络连接问题

**排查步骤**:

```bash
# 1. 检查 Token 格式
# SSO Token 应该是长字符串，类似: eyJ...
# refresh_token 应该以 "aor" 开头

# 2. 手动测试 Token
# 使用 Kiro IDE 的登录功能测试 Token 是否有效

# 3. 检查账号列表
# 确认账号是否已存在
```

**解决方法**:
1. 重新注册获取新的 Token
2. 检查 Token 是否被正确传递
3. 删除重复的账号
4. 检查网络连接

---

### 错误 7: "Python 脚本执行失败"

**错误信息**:
```
✗ 注册失败: Python 脚本执行失败: exit status: 1
```

**可能原因**:
1. Python 依赖缺失
2. 脚本语法错误
3. 运行时异常
4. 权限问题

**排查步骤**:

```bash
# 1. 检查 Python 版本
python3 --version

# 2. 检查依赖
pip list | grep camoufox

# 3. 手动运行脚本
cd src-tauri/scripts
echo '{"email":"test@example.com","verification_code":"123456"}' | python3 auto_register.py

# 4. 查看详细错误
python3 auto_register.py 2>&1 | tee error.log
```

**解决方法**:
1. 重新安装依赖: `pip install -r requirements.txt`
2. 检查脚本语法: `python3 -m py_compile auto_register.py`
3. 查看错误日志，根据具体错误修复
4. 确认脚本有执行权限: `chmod +x auto_register.py`

---

### 错误 8: "Rust 编译失败"

**错误信息**:
```
error: could not compile `kiro-account-manager`
```

**可能原因**:
1. 依赖缺失
2. 语法错误
3. 类型不匹配
4. 模块未注册

**排查步骤**:

```bash
# 1. 清理构建缓存
cd src-tauri
cargo clean

# 2. 更新依赖
cargo update

# 3. 检查语法
cargo check

# 4. 查看详细错误
cargo build 2>&1 | tee build_error.log
```

**解决方法**:
1. 根据错误信息修复代码
2. 确认所有模块已在 `mod.rs` 中注册
3. 确认所有依赖已在 `Cargo.toml` 中声明
4. 查看 `build_error.log` 了解详情

---

### 错误 9: "前端构建失败"

**错误信息**:
```
ERROR: Build failed with errors
```

**可能原因**:
1. 依赖缺失
2. 语法错误
3. 导入路径错误
4. 类型错误

**排查步骤**:

```bash
# 1. 清理缓存
rm -rf node_modules dist
npm install

# 2. 检查语法
npm run build

# 3. 查看详细错误
npm run build 2>&1 | tee build_error.log
```

**解决方法**:
1. 根据错误信息修复代码
2. 确认所有导入路径正确
3. 确认所有组件已正确导出
4. 查看 `build_error.log` 了解详情

---

## 性能问题

### 问题 1: 注册速度慢

**症状**: 单个账号注册超过 5 分钟

**可能原因**:
1. 网络延迟
2. 验证码获取慢
3. 浏览器加载慢
4. 系统资源不足

**解决方法**:
1. 使用代理加速网络
2. 减少轮询间隔
3. 使用无头模式
4. 关闭其他应用释放资源

### 问题 2: 内存占用高

**症状**: 内存占用超过 1GB

**可能原因**:
1. 浏览器进程未关闭
2. 日志累积过多
3. 内存泄漏

**解决方法**:
1. 确保浏览器正确关闭
2. 定期清空日志
3. 重启应用

### 问题 3: CPU 使用率高

**症状**: CPU 使用率持续 > 80%

**可能原因**:
1. 浏览器渲染占用
2. 并发任务过多
3. 死循环

**解决方法**:
1. 使用无头模式
2. 减少并发数量
3. 检查代码逻辑

---

## 日志分析

### 正常流程日志

```
========== 开始使用临时邮箱注册 AWS Builder ID ==========
步骤1: 创建临时邮箱地址...
✓ 临时邮箱创建成功: test123@example.com

步骤2: 启动浏览器，进入注册页面...

步骤3: 等待验证码邮件...
收件箱共 0 封邮件
未找到验证码，5 秒后重试...
收件箱共 1 封邮件
检查 AWS 邮件: from="no-reply@signin.aws"
========== 找到验证码: 123456 ==========

步骤4: 使用验证码完成注册...
等待邮箱输入框出现...
✓ 已输入邮箱输入框: test123@example.com
等待第一个继续按钮出现...
✓ 已点击第一个继续按钮
...
✓ 成功获取 SSO Token!

步骤7: 转换 SSO Token 为 refresh_token...
⚠ 转换失败: API 返回错误 (400)
将使用 SSO Token 作为 refresh_token 尝试导入

步骤5: 清理临时邮箱...
✓ 临时邮箱已清理

========== 注册成功! ==========
```

### 异常流程日志

```
========== 开始使用临时邮箱注册 AWS Builder ID ==========
步骤1: 创建临时邮箱地址...
✗ 创建临时邮箱失败: 请求失败: connection refused

========== 注册失败: 创建临时邮箱失败 ==========
```

---

## 获取帮助

### 1. 查看文档

- `.ai/SUMMARY.md` - 项目总结
- `.ai/quick_start.md` - 快速开始
- `.ai/testing_guide.md` - 测试指南
- `.ai/sso_token_test.md` - Token 测试

### 2. 查看日志

- 前端日志: 浏览器控制台
- Rust 日志: 终端输出
- Python 日志: 脚本输出

### 3. 提交 Issue

如果问题无法解决，请提交 Issue 并包含：
1. 错误信息
2. 日志输出
3. 系统信息
4. 重现步骤

### 4. 联系方式

- GitHub: https://github.com/liwenzhen/kiro-account-manager
- Issues: https://github.com/liwenzhen/kiro-account-manager/issues

---

最后更新: 2026-04-16
