---
inclusion: manual
---

# 项目文档索引

当需要查看项目文档时，使用 `#docs-reference` 引用此规则。

## 开发规范

- **开发规范文档**：#[[file:docs/开发规范文档.md]]
- **提交规范**：#[[file:docs/COMMIT_GUIDE.md]]
- **发布流程**：#[[file:docs/release.md]]
- **注册脚本规则**：#[[file:docs/register-script-rules.md]]
- **Hooks 使用指南**：#[[file:docs/hooks-guide.md]]

## 功能说明

- **使用教程**：#[[file:docs/使用教程.md]]
- **从 Kiro 导入功能**：#[[file:docs/从Kiro导入功能说明.md]]
- **批量导入功能规划**：#[[file:docs/批量导入功能规划.md]]
- **MCP 管理功能规划**：#[[file:docs/MCP管理功能规划.md]]
- **手动修改 Token 教程**：#[[file:docs/手动修改Token教程.md]]

## 技术文档

- **Kiro API**：#[[file:docs/Kiro API.md]]
- **CodeWhisperer API**：#[[file:docs/CodeWhispererRuntimeService API.md]]
- **Kiro Desktop Auth Provider**：#[[file:docs/Kiro Desktop Auth Provider.md]]
- **Enterprise vs BuilderId**：#[[file:docs/Enterprise-vs-BuilderId.md]]
- **API 端点列表**：#[[file:docs/api-endpoints.md]]
- **Essential Endpoints**：#[[file:docs/essential-endpoints.md]]
- **Get Usage API**：#[[file:docs/get-usage.md]]

## 系统机制

- **机器 ID 替换方案对比**：#[[file:docs/机器ID替换方案对比.md]]
- **系统机器码说明**：#[[file:docs/系统机器码说明.md]]
- **封禁检测逻辑**：#[[file:docs/封禁检测逻辑.md]]
- **Windows 安装包说明**：#[[file:docs/Windows安装包说明.md]]

## Kiro IDE 源码分析

- **源码分析 README**：#[[file:docs/kiro-source-analysis/README.md]]
- **Machine ID**：#[[file:docs/kiro-source-analysis/machine-id.md]]
- **Social Auth Provider**：#[[file:docs/kiro-source-analysis/social-auth-provider.md]]
- **SSO OIDC Client**：#[[file:docs/kiro-source-analysis/sso-oidc-client.md]]
- **Embedding Model**：#[[file:docs/kiro-source-analysis/embedding-model.md]]
- **XHR Sync Worker**：#[[file:docs/kiro-source-analysis/xhr-sync-worker.md]]

## API 详细文档

### AuthDesktopService

- **Social Login (Google & GitHub)**：#[[file:docs/api/AuthDesktopService/Social Login(Google&GitHub).md]]
- **AWS SSO OIDC (BuilderId & Enterprise)**：#[[file:docs/api/AuthDesktopService/AWS SSO OIDC(BuilderId&Enterprise).md]]
- **AWS IAM Identity Center (Device Flow)**：#[[file:docs/api/AuthDesktopService/AWS IAM Identity Center(Device Flow).md]]
- **Kiro Desktop Auth**：#[[file:docs/api/AuthDesktopService/Kiro Desktop Auth.md]]

### KiroWebPortalService

- **Web OAuth (Cognito)**：#[[file:docs/api/KiroWebPortalService/Web OAuth(Cognito).md]]
- **Exchange Token**：#[[file:docs/api/KiroWebPortalService/1.ExchangeToken.md]]
- **Refresh Token**：#[[file:docs/api/KiroWebPortalService/2.RefreshToken.md]]
- **Get User Info**：#[[file:docs/api/KiroWebPortalService/3.GetUserInfo.md]]
- **Get Usage and Limits**：#[[file:docs/api/KiroWebPortalService/4.GetUserUsageAndLimits.md]]
- **Get Subscription Plans**：#[[file:docs/api/KiroWebPortalService/5.GetAvailableSubscriptionPlans.md]]

### CodeWhispererRuntimeService

- **API 概览**：#[[file:docs/api/CodeWhispererRuntimeService/0.API概览.md]]

## UI 设计

- **Dialog/Modal 最佳实践**：#[[file:docs/dialog-modal-best-practices.md]]

## 其他参考

- **KiroGate 实现总结**：#[[file:docs/kirogate-implementation-summary.md]]
- **OpenSkills 教程**：#[[file:docs/openskills-tutorial.md]]
- **Enterprise 响应格式**：#[[file:docs/enterprise-response-format.md]]
- **JWT Payload 示例**：#[[file:docs/jwt-payload-decoded.json]]

## Token 格式模板

- **Social Token Cache**：#[[file:docs/templates/Social Token Cache.md]]
- **BuilderId Token Cache**：#[[file:docs/templates/BuilderId Token Cache.md]]
- **Enterprise Token Cache**：#[[file:docs/templates/Enterprise Token Cache.md]]
- **Token 格式对比**：#[[file:docs/templates/Token Format Comparison.md]]
- **JWT 分析**：#[[file:docs/templates/jwt-analysis.md]]

---

## 使用方式

在对话中输入 `#docs-reference` 即可加载此文档索引，然后根据需要查看具体文档。

例如：
- 需要查看 API 文档时：先加载 `#docs-reference`，再查看对应的 API 文件
- 需要了解源码实现时：查看 Kiro IDE 源码分析相关文档
- 需要开发新功能时：查看开发规范和功能规划文档
