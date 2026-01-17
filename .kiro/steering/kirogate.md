# KiroGate 参考规范

## 项目信息

- **GitHub**: https://github.com/aliom-v/KiroGate
- **本地路径**: `E:\VSCodeSpace\Kiro\KiroGate`
- **维护状态**: 与 aliom-v 共同维护
- **技术栈**: Python + FastAPI

## 参考说明

KiroGate 是与 aliom-v 共同维护的项目，本项目（kiro-gateway）部分功能参考了 KiroGate 的实现。开发相关功能时可以直接参考和借鉴其代码。

## 可参考的功能

- Token 刷新逻辑
- 配额获取接口
- AWS SSO OIDC 认证流程
- Kiro API 调用方式

## 访问方式

KiroGate 项目在工作区外，需要通过 PowerShell 访问：
```powershell
Get-Content "E:\VSCodeSpace\Kiro\KiroGate\文件路径" -Raw
```

## 开发建议

- 可以直接参考和借鉴 KiroGate 的实现思路
- 注意技术栈差异：kiro-gateway 使用 Rust + Axum，KiroGate 使用 Python + FastAPI
- 接口调用方式可能有差异，需要适配到 Rust 生态
- 有问题可以与 aliom-v 讨论
