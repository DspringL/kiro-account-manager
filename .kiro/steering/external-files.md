---
inclusion: always
---

# 外部文件访问

## 参考项目

### KiroGate 本地版（已适配 IdC）
- 本地路径：`E:\VSCodeSpace\Kiro\KiroGate`
- 使用 PowerShell 命令访问：`Get-Content "E:\VSCodeSpace\Kiro\KiroGate\文件路径" -Raw`
- 已支持 Social 和 IdC 两种认证类型
- 优先参考此版本

### KiroGate 原版（GitHub）
- GitHub 仓库：https://github.com/aliom-v/KiroGate
- owner: `aliom-v`
- repo: `KiroGate`
- OpenAI 兼容的 Kiro API 代理服务
- 注意：原版只支持 Social 类型（Google/GitHub），没有适配 IdC 类型（BuilderId/Enterprise）

### Kiro Account Manager 参考
- GitHub 仓库：https://github.com/chaogei/Kiro-account-manager
- owner: `chaogei`
- repo: `Kiro-account-manager`
- 用于对比功能实现和学习优化

## 访问 GitHub 仓库
使用 MCP GitHub 工具访问：
```
mcp_github_get_file_contents(owner="aliom-v", repo="KiroGate", path="路径")
mcp_github_get_file_contents(owner="chaogei", repo="Kiro-account-manager", path="路径")
```
