# Camoufox 安装指南

## 什么是 Camoufox？

Camoufox 是一个基于 Firefox 的反检测浏览器，用于自动注册 AWS Builder ID 账号。

## 安装步骤

### 方式 1: 使用自动安装脚本 (推荐)

```bash
cd src-tauri/scripts
./setup.sh
```

### 方式 2: 手动安装

1. **安装 Python 依赖**
   ```bash
   pip3 install -r requirements.txt
   ```

2. **下载 Camoufox 浏览器**
   ```bash
   python3 -m camoufox fetch
   ```

3. **验证安装**
   ```bash
   python3 -c "from camoufox.async_api import AsyncCamoufox; print('安装成功')"
   ```

## 系统要求

- Python 3.8 或更高版本
- pip3
- 约 300MB 磁盘空间 (用于 Camoufox 浏览器)

## 常见问题

### Q: 为什么需要安装 Camoufox？
A: Camoufox 是专业的反检测浏览器，可以避免被 AWS 检测为自动化工具。

### Q: 不安装 Camoufox 会怎样？
A: 应用的其他功能正常使用，只有账号自动注册功能不可用。

### Q: Camoufox 安全吗？
A: Camoufox 是开源项目，代码托管在 GitHub: https://github.com/daijro/camoufox

### Q: 如何卸载 Camoufox？
A: 运行以下命令：
```bash
pip3 uninstall camoufox
rm -rf ~/.camoufox
```

## 技术支持

如果遇到问题，请查看：
- Camoufox 官方文档: https://camoufox.com
- 项目 Issues: https://github.com/liwenzhen/kiro-account-manager/issues
