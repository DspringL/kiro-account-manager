# 账号自动注册功能 - 快速开始指南

## 🚀 快速开始

### 前置准备

#### 1. 安装 Camoufox
```bash
cd kiro-account-manager/src-tauri/scripts
chmod +x setup.sh
./setup.sh
```

或手动安装:
```bash
pip3 install camoufox
python3 -m camoufox fetch
```

#### 2. 部署临时邮箱服务
使用 cloudflare_temp_email 项目:
```bash
# 参考: https://github.com/dreamhunter2333/cloudflare_temp_email
# 部署到 Cloudflare Workers
# 记录 API 地址和 admin 密码
```

### 启动应用

```bash
# 安装依赖
npm install

# 启动开发模式
npm run tauri dev
```

### 使用步骤

#### 步骤 1: 配置临时邮箱
1. 打开应用,点击侧边栏"账号注册"
2. 填写配置:
   - **API 地址**: `https://your-api.workers.dev`
   - **Admin 密码**: 你的 admin 密码
   - **代理地址** (可选): `http://127.0.0.1:7890`
3. 配置会自动保存

#### 步骤 2: 检查 Camoufox
1. 点击右上角"检查 Camoufox"按钮
2. 确认显示"Camoufox 已安装"
3. 如果未安装,运行安装脚本

#### 步骤 3: 开始注册
1. 设置注册数量 (建议先测试 1 个)
2. 点击"开始注册"按钮
3. 观察日志输出
4. 等待注册完成

#### 步骤 4: 验证结果
1. 查看统计信息 (成功/失败)
2. 切换到"账号管理"页面
3. 确认新账号已添加
4. 测试账号切换功能

---

## 📋 完整功能列表

### ✅ 已实现
- [x] 临时邮箱 API 集成
- [x] Camoufox 浏览器自动化
- [x] AWS Builder ID 注册流程
- [x] 验证码自动获取
- [x] SSO Token 获取
- [x] SSO Token 转 refresh_token (待测试)
- [x] 账号自动导入
- [x] 批量注册支持
- [x] 实时日志显示
- [x] 统计信息展示
- [x] 配置持久化

### 🔄 待完善
- [ ] SSO Token 转换验证
- [ ] 错误重试机制
- [ ] 进度条显示
- [ ] 暂停/恢复功能
- [ ] 日志导出
- [ ] Python 运行时内嵌

---

## 🔧 技术实现

### 架构图
```
用户界面 (React)
    ↓
Tauri 命令层
    ↓
┌─────────────────────────────────┐
│  Rust 服务层                     │
│  ├─ 临时邮箱 API                 │
│  ├─ 浏览器自动化                 │
│  └─ SSO Token 转换               │
└─────────────────────────────────┘
    ↓
Python 脚本 (Camoufox)
```

### 核心文件
```
src-tauri/
├── src/
│   ├── commands/
│   │   └── auto_register_cmd.rs      # 注册命令
│   ├── services/
│   │   ├── tempmail_api.rs            # 临时邮箱
│   │   ├── browser_automation.rs      # 浏览器自动化
│   │   └── sso_token_converter.rs     # Token 转换
│   └── types/
│       └── register.rs                # 类型定义
└── scripts/
    ├── auto_register.py               # Python 脚本
    ├── requirements.txt               # Python 依赖
    └── setup.sh                       # 安装脚本

src/
└── components/
    └── features/
        └── AutoRegister/
            └── index.jsx              # 前端界面
```

---

## 🐛 故障排查

### 问题 1: Camoufox 未安装
**症状**: 点击"开始注册"后提示 Camoufox 未安装

**解决**:
```bash
cd src-tauri/scripts
./setup.sh
```

### 问题 2: 临时邮箱 API 连接失败
**症状**: 日志显示"创建临时邮箱失败"

**检查**:
1. API 地址是否正确
2. Admin 密码是否正确
3. 网络是否可访问
4. 使用 curl 测试:
```bash
curl -X POST "https://your-api.workers.dev/admin/new_address" \
  -H "x-admin-auth: your-password" \
  -H "Content-Type: application/json" \
  -d '{"enablePrefix":false,"name":"test"}'
```

### 问题 3: 验证码获取超时
**症状**: 等待验证码超过 120 秒

**可能原因**:
- AWS 邮件发送延迟
- 临时邮箱 API 不稳定
- 邮件被过滤

**解决**:
1. 检查临时邮箱 API 日志
2. 手动访问邮箱查看是否收到邮件
3. 增加等待时间 (修改代码)

### 问题 4: 账号导入失败
**症状**: 注册成功但账号未添加到管理器

**可能原因**:
- SSO Token 转换失败
- refresh_token 格式不正确
- 账号已存在

**解决**:
1. 查看日志中的错误信息
2. 检查 SSO Token 是否获取成功
3. 手动测试 Token 转换 (参考 sso_token_test.md)

### 问题 5: 浏览器自动化失败
**症状**: 浏览器打开但无法完成注册

**可能原因**:
- AWS 页面结构变化
- 网络问题
- 选择器失效

**解决**:
1. 检查 Python 脚本日志
2. 手动测试注册流程
3. 更新选择器 (修改 auto_register.py)

---

## 📊 性能建议

### 批量注册
- **建议数量**: 每次 1-5 个
- **间隔时间**: 每个账号间隔 10-30 秒
- **并发限制**: 不建议并发注册

### 代理使用
- **场景**: 注册失败率高时使用
- **类型**: HTTP/HTTPS/SOCKS5
- **注意**: 确保代理稳定

### 资源占用
- **内存**: 每个浏览器实例约 500MB
- **CPU**: 中等占用
- **网络**: 取决于代理和 API 响应速度

---

## 🔐 安全建议

1. **临时邮箱 API**
   - 使用 HTTPS
   - 定期更换 admin 密码
   - 限制 API 访问频率

2. **代理配置**
   - 使用可信的代理服务
   - 避免使用免费公共代理
   - 定期检查代理日志

3. **账号管理**
   - 定期备份账号数据
   - 使用强密码
   - 启用机器码绑定

---

## 📚 相关文档

- [实现状态](./implementation_status.md) - 详细的实现状态
- [测试指南](./testing_guide.md) - 完整的测试步骤
- [SSO Token 测试](./sso_token_test.md) - Token 转换测试方案
- [进度跟踪](./progress.md) - 开发进度记录

---

## 💡 提示

1. **首次使用**: 建议先注册 1 个账号测试
2. **批量注册**: 确认单个成功后再批量
3. **日志查看**: 遇到问题先查看日志
4. **配置保存**: 配置会自动保存到 localStorage
5. **Camoufox**: 首次运行会下载浏览器文件 (约 100MB)

---

## 🆘 获取帮助

如果遇到问题:
1. 查看日志输出
2. 参考故障排查部分
3. 查看相关文档
4. 提交 Issue 到 GitHub

---

最后更新: 2026-04-16
