# AWS Builder ID 自动注册脚本

## 功能说明

使用 Camoufox（反检测浏览器）自动注册 AWS Builder ID 账号，并获取 SSO Token。

## 环境要求

- Python 3.8+
- pip
- 网络连接（可选代理）

## 安装步骤

### macOS / Linux

```bash
# 1. 安装 Python 依赖
pip install -r requirements.txt

# 2. 下载 Camoufox 浏览器
python -m camoufox fetch

# 3. 验证安装
python -c "from camoufox.async_api import AsyncCamoufox; print('安装成功!')"
```

### Windows

```powershell
# 1. 安装 Python 依赖
pip install -r requirements.txt

# 2. 下载 Camoufox 浏览器
python -m camoufox fetch

# 3. 验证安装
python -c "from camoufox.async_api import AsyncCamoufox; print('安装成功!')"
```

## 使用方法

### 方式 1: 通过 Kiro Account Manager 使用（推荐）

1. 启动 Kiro Account Manager
2. 进入"账号注册"页面
3. 配置临时邮箱 API
4. 点击"开始注册"

### 方式 2: 命令行使用

```bash
# 准备输入数据
cat > input.json << EOF
{
  "email": "test@example.com",
  "verification_code": "123456",
  "proxy_url": null
}
EOF

# 运行脚本
cat input.json | python3 auto_register.py
```

## 输入参数

```json
{
  "email": "邮箱地址",
  "verification_code": "6位验证码",
  "proxy_url": "代理地址（可选）"
}
```

## 输出格式

### 实时日志

```json
{
  "type": "log",
  "email": "test@example.com",
  "message": "日志消息"
}
```

### 最终结果

```json
{
  "type": "result",
  "data": {
    "success": true,
    "sso_token": "eyJ...",
    "refresh_token": null,
    "name": "John Smith",
    "email": "test@example.com"
  }
}
```

### 错误信息

```json
{
  "type": "error",
  "message": "错误描述"
}
```

## 工作流程

1. **启动浏览器**: 使用 Camoufox 启动反检测浏览器
2. **访问注册页面**: 进入 AWS Builder ID 注册页面
3. **输入邮箱**: 填写邮箱地址
4. **等待验证码**: 等待用户提供验证码（由 Rust 层获取）
5. **输入验证码**: 填写验证码
6. **输入姓名**: 填写随机生成的姓名
7. **设置密码**: 设置固定密码 `admin123456aA!`
8. **获取 Token**: 从 Cookie 中获取 SSO Token
9. **返回结果**: 返回注册结果

## 注意事项

### 1. 浏览器模式

- 默认使用**非无头模式**（headless=False）
- 可以看到浏览器操作过程
- 方便调试和排查问题

### 2. 代理配置

如果需要使用代理：

```json
{
  "proxy_url": "http://127.0.0.1:7890"
}
```

支持的代理协议：
- HTTP: `http://host:port`
- HTTPS: `https://host:port`
- SOCKS5: `socks5://host:port`

### 3. 验证码获取

验证码由 Rust 层通过临时邮箱 API 获取，Python 脚本只负责输入。

### 4. 密码设置

所有账号使用相同的密码：`admin123456aA!`

如需修改，请编辑脚本中的 `password` 变量。

### 5. 姓名生成

姓名从预定义列表中随机选择：
- 名字: James, Robert, John, Michael, David, William, Richard, Maria, Elizabeth, Jennifer
- 姓氏: Smith, Johnson, Williams, Brown, Jones, Garcia, Miller, Davis, Rodriguez, Martinez

### 6. 超时设置

- 页面加载超时: 60 秒
- 元素等待超时: 30 秒
- 验证码输入超时: 30 秒

## 常见问题

### Q1: Camoufox 安装失败

**A**: 尝试以下方法：

```bash
# 方法 1: 使用国内镜像
pip install -i https://pypi.tuna.tsinghua.edu.cn/simple camoufox

# 方法 2: 手动下载
python -m camoufox fetch --verbose

# 方法 3: 检查网络
curl -I https://pypi.org/simple/camoufox/
```

### Q2: 浏览器启动失败

**A**: 检查以下内容：

1. Camoufox 是否正确安装
2. 系统是否有足够的内存（建议 > 2GB）
3. 是否有其他浏览器进程占用资源

### Q3: 元素未找到

**A**: 可能原因：

1. AWS 页面结构变化 → 更新选择器
2. 网络延迟 → 增加等待时间
3. 页面加载失败 → 检查网络连接

### Q4: SSO Token 获取失败

**A**: 检查：

1. 是否完成了整个注册流程
2. Cookie 是否被正确设置
3. 是否有网络拦截

## 开发调试

### 启用详细日志

修改脚本，添加更多日志输出：

```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

### 截图调试

在关键步骤添加截图：

```python
await page.screenshot(path=f"debug_{step}.png")
```

### 暂停执行

在需要检查的地方添加：

```python
await asyncio.sleep(10)  # 暂停 10 秒
```

## 性能优化

### 1. 并发注册

不建议并发，因为：
- 浏览器占用资源大
- 可能触发 AWS 限流
- 临时邮箱 API 可能有限制

### 2. 无头模式

如果不需要看到浏览器：

```python
browser_args = {
    'headless': True,  # 改为 True
}
```

### 3. 减少等待时间

如果网络很快，可以减少等待时间：

```python
await asyncio.sleep(0.5)  # 从 1 秒改为 0.5 秒
```

## 安全建议

1. **不要提交密码**: 密码应该从环境变量或配置文件读取
2. **不要提交 Token**: SSO Token 是敏感信息
3. **使用 HTTPS**: 确保 API 通信使用 HTTPS
4. **定期更新**: 保持 Camoufox 和依赖库最新

## 许可证

CC BY-NC-SA 4.0

## 贡献

欢迎提交 Issue 和 Pull Request！

---

最后更新: 2026-04-16
