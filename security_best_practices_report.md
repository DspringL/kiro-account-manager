# Security Best Practices Report (Kiro Account Manager)

## Executive Summary
本次仅覆盖前端 React 代码与 Tauri 配置的安全检查（未深入 Rust 后端实现）。
发现 3 项需要关注的问题：
- 1 项高风险（CSP 被禁用）
- 2 项中低风险（未校验外部链接、全局 Tauri API 暴露）

---

## Critical
（无）

## High

### S-001 禁用 CSP（Tauri 配置）
- **Location:** `src-tauri/tauri.conf.json:34-36`
- **Evidence:**
  ```json
  "security": {
    "csp": null
  }
  ```
- **Impact:** 无 CSP 保护，若出现 DOM XSS，将缺少浏览器侧的防护；结合桌面应用环境，攻击面更大。
- **Fix:** 设置合适的 CSP（建议从 `default-src 'self'`、`script-src 'self'` 起步），并避免依赖 `unsafe-inline`。当前 `index.html` 有内联脚本，需改为外部脚本或使用 nonce/hash。
- **Mitigation:** 若短期无法完全落地，先使用报告模式（report-only）并逐步收敛。

## Medium

### S-002 未校验的外部 URL（公告 API 与推荐 Power）
- **Location:**
  - `src/components/modals/AnnouncementModal.jsx:26-66, 115-199`
  - `src/components/features/KiroConfig/PowersPanel.jsx:78-80`
- **Evidence:**
  - 公告内容来自远端 API，直接写入 `href`：
    ```jsx
    href={announcement.websiteUrl}
    ```
  - 推荐 Power 直接打开传入 URL：
    ```js
    window.__TAURI__?.shell?.open?.(url) || window.open(url, '_blank')
    ```
- **Impact:** 若远端数据被污染或被恶意构造，可能触发 `javascript:` / `file:` / 自定义协议等不安全跳转，导致钓鱼或本机协议滥用。
- **Fix:** 对所有外部 URL 做 allowlist 校验（仅允许 `https:`/`http:`，必要时限制域名），不通过校验则拒绝或回退到安全默认值。
- **Mitigation:** 对来自 API 的链接进行显式标记与提示，避免静默跳转。

## Low

### S-003 全局 Tauri API 暴露
- **Location:** `src-tauri/tauri.conf.json:12-14`
- **Evidence:**
  ```json
  "withGlobalTauri": true
  ```
- **Impact:** 一旦出现 XSS，攻击脚本更容易直接访问全局 Tauri API，放大危害。
- **Fix:** 若非必须，关闭 `withGlobalTauri`，统一通过 `@tauri-apps/api` 模块调用。
- **Mitigation:** 配合 CSP 与严格的 DOM XSS 防护降低风险。

---

## Notes / Non-Issues Observed
- 未发现 `dangerouslySetInnerHTML`、`eval`、`new Function`、`postMessage` 等高危前端模式。
- 未发现将 token/session 存入 `localStorage` 的用法（仅用于 UI 状态）。

## Scope Limits
- 未对 Rust 侧（`src-tauri/src/`）进行深入安全审查，仅检查了配置层。
