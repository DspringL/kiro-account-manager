//! SSO Token → OIDC Token 转换
//!
//! 流程（参考 kiro_auto_register/src/main/index.ts ssoDeviceAuth）：
//! 1. 注册 OIDC 客户端
//! 2. 发起设备授权，获取 deviceCode / userCode
//! 3. 用 SSO Token 验证身份（whoAmI）
//! 4. 获取设备会话令牌
//! 5. 接受用户代码
//! 6. 批准授权
//! 7. 轮询获取最终 accessToken + refreshToken

use serde::{Deserialize, Serialize};
use crate::http_client::build_http_client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoTokenConvertResult {
    pub access_token: String,
    pub refresh_token: String,
    pub client_id: String,
    pub client_secret: String,
    pub region: String,
    pub expires_in: Option<i64>,
}

const SCOPES: &[&str] = &[
    "codewhisperer:analysis",
    "codewhisperer:completions",
    "codewhisperer:conversations",
    "codewhisperer:taskassist",
    "codewhisperer:transformations",
];

const START_URL: &str = "https://view.awsapps.com/start";

pub async fn convert_sso_token_with_fallback(
    sso_token: &str,
) -> Result<SsoTokenConvertResult, String> {
    sso_device_auth(sso_token, "us-east-1").await
}

/// 用 SSO Token（x-amz-sso_authn cookie）换取 OIDC access_token + refresh_token
pub async fn sso_device_auth(
    bearer_token: &str,
    region: &str,
) -> Result<SsoTokenConvertResult, String> {
    let oidc_base = format!("https://oidc.{}.amazonaws.com", region);
    let portal_base = "https://portal.sso.us-east-1.amazonaws.com";

    let client = build_http_client().map_err(|e| format!("创建 HTTP 客户端失败: {e}"))?;

    // ── Step 1: 注册 OIDC 客户端 ──────────────────────────────────────────
    log::info!("[SSO] Step 1: 注册 OIDC 客户端...");
    let reg_body = serde_json::json!({
        "clientName": "Kiro Account Manager",
        "clientType": "public",
        "scopes": SCOPES,
        "grantTypes": [
            "urn:ietf:params:oauth:grant-type:device_code",
            "refresh_token"
        ],
        "issuerUrl": START_URL
    });

    let reg_resp = client
        .post(format!("{oidc_base}/client/register"))
        .json(&reg_body)
        .send()
        .await
        .map_err(|e| format!("注册客户端请求失败: {e}"))?;

    if !reg_resp.status().is_success() {
        let status = reg_resp.status();
        let body = reg_resp.text().await.unwrap_or_default();
        return Err(format!("注册客户端失败 ({status}): {body}"));
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct RegResponse {
        client_id: String,
        client_secret: String,
    }
    let reg: RegResponse = reg_resp.json().await
        .map_err(|e| format!("解析注册响应失败: {e}"))?;
    let client_id = reg.client_id;
    let client_secret = reg.client_secret;
    log::info!("[SSO] 客户端注册成功: {}...", &client_id[..client_id.len().min(30)]);

    // ── Step 2: 发起设备授权 ──────────────────────────────────────────────
    log::info!("[SSO] Step 2: 发起设备授权...");
    let dev_body = serde_json::json!({
        "clientId": client_id,
        "clientSecret": client_secret,
        "startUrl": START_URL
    });

    let dev_resp = client
        .post(format!("{oidc_base}/device_authorization"))
        .json(&dev_body)
        .send()
        .await
        .map_err(|e| format!("设备授权请求失败: {e}"))?;

    if !dev_resp.status().is_success() {
        let status = dev_resp.status();
        let body = dev_resp.text().await.unwrap_or_default();
        return Err(format!("设备授权失败 ({status}): {body}"));
    }

    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct DevResponse {
        device_code: String,
        user_code: String,
        #[serde(default)]
        interval: Option<u64>,
    }
    let dev: DevResponse = dev_resp.json().await
        .map_err(|e| format!("解析设备授权响应失败: {e}"))?;
    let device_code = dev.device_code;
    let user_code = dev.user_code;
    let poll_interval = dev.interval.unwrap_or(1);
    log::info!("[SSO] 设备授权成功，user_code: {}", user_code);

    // ── Step 3: 验证 Bearer Token (whoAmI) ───────────────────────────────
    log::info!("[SSO] Step 3: 验证 SSO Token...");
    let who_resp = client
        .get(format!("{portal_base}/token/whoAmI"))
        .header("Authorization", format!("Bearer {bearer_token}"))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("whoAmI 请求失败: {e}"))?;

    if !who_resp.status().is_success() {
        let status = who_resp.status();
        let body = who_resp.text().await.unwrap_or_default();
        return Err(format!("SSO Token 验证失败 ({status}): {body}"));
    }
    log::info!("[SSO] SSO Token 验证成功");

    // ── Step 4: 获取设备会话令牌 ──────────────────────────────────────────
    log::info!("[SSO] Step 4: 获取设备会话令牌...");
    let sess_resp = client
        .post(format!("{portal_base}/session/device"))
        .header("Authorization", format!("Bearer {bearer_token}"))
        .json(&serde_json::json!({}))
        .send()
        .await
        .map_err(|e| format!("获取设备会话请求失败: {e}"))?;

    if !sess_resp.status().is_success() {
        let status = sess_resp.status();
        let body = sess_resp.text().await.unwrap_or_default();
        return Err(format!("获取设备会话失败 ({status}): {body}"));
    }

    #[derive(Deserialize)]
    struct SessResponse {
        token: String,
    }
    let sess: SessResponse = sess_resp.json().await
        .map_err(|e| format!("解析设备会话响应失败: {e}"))?;
    let device_session_token = sess.token;
    log::info!("[SSO] 设备会话令牌获取成功");

    // ── Step 5: 接受用户代码 ──────────────────────────────────────────────
    log::info!("[SSO] Step 5: 接受用户代码...");
    let accept_body = serde_json::json!({
        "userCode": user_code,
        "userSessionId": device_session_token
    });

    let accept_resp = client
        .post(format!("{oidc_base}/device_authorization/accept_user_code"))
        .header("Referer", "https://view.awsapps.com/")
        .json(&accept_body)
        .send()
        .await
        .map_err(|e| format!("接受用户代码请求失败: {e}"))?;

    if !accept_resp.status().is_success() {
        let status = accept_resp.status();
        let body = accept_resp.text().await.unwrap_or_default();
        return Err(format!("接受用户代码失败 ({status}): {body}"));
    }

    #[derive(Deserialize, Default)]
    #[serde(rename_all = "camelCase")]
    struct DeviceContext {
        device_context_id: Option<String>,
        client_id: Option<String>,
        client_type: Option<String>,
    }
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct AcceptResponse {
        #[serde(default)]
        device_context: Option<DeviceContext>,
    }
    let accept: AcceptResponse = accept_resp.json().await
        .map_err(|e| format!("解析接受用户代码响应失败: {e}"))?;
    log::info!("[SSO] 用户代码接受成功");

    // ── Step 6: 批准授权 ──────────────────────────────────────────────────
    if let Some(ref ctx) = accept.device_context {
        if let Some(ref ctx_id) = ctx.device_context_id {
            log::info!("[SSO] Step 6: 批准授权...");
            let approve_body = serde_json::json!({
                "deviceContext": {
                    "deviceContextId": ctx_id,
                    "clientId": ctx.client_id.as_deref().unwrap_or(&client_id),
                    "clientType": ctx.client_type.as_deref().unwrap_or("public")
                },
                "userSessionId": device_session_token
            });

            let approve_resp = client
                .post(format!("{oidc_base}/device_authorization/associate_token"))
                .header("Referer", "https://view.awsapps.com/")
                .json(&approve_body)
                .send()
                .await
                .map_err(|e| format!("批准授权请求失败: {e}"))?;

            if !approve_resp.status().is_success() {
                let status = approve_resp.status();
                let body = approve_resp.text().await.unwrap_or_default();
                return Err(format!("批准授权失败 ({status}): {body}"));
            }
            log::info!("[SSO] 授权批准成功");
        }
    }

    // ── Step 7: 轮询获取 Token ────────────────────────────────────────────
    log::info!("[SSO] Step 7: 轮询获取 Token...");
    let token_body = serde_json::json!({
        "clientId": client_id,
        "clientSecret": client_secret,
        "grantType": "urn:ietf:params:oauth:grant-type:device_code",
        "deviceCode": device_code
    });

    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(120);

    loop {
        if start.elapsed() > timeout {
            return Err("轮询 Token 超时（120s）".to_string());
        }

        tokio::time::sleep(std::time::Duration::from_secs(poll_interval)).await;

        let token_resp = client
            .post(format!("{oidc_base}/token"))
            .json(&token_body)
            .send()
            .await
            .map_err(|e| format!("Token 请求失败: {e}"))?;

        if token_resp.status().is_success() {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct TokenResponse {
                access_token: String,
                refresh_token: String,
                expires_in: Option<i64>,
            }
            let token: TokenResponse = token_resp.json().await
                .map_err(|e| format!("解析 Token 响应失败: {e}"))?;

            log::info!("[SSO] Token 获取成功！");
            return Ok(SsoTokenConvertResult {
                access_token: token.access_token,
                refresh_token: token.refresh_token,
                client_id,
                client_secret,
                region: region.to_string(),
                expires_in: token.expires_in,
            });
        }

        // authorization_pending 继续轮询，其他错误直接失败
        let status = token_resp.status();
        let body = token_resp.text().await.unwrap_or_default();
        if body.contains("authorization_pending") || body.contains("AuthorizationPending") {
            log::debug!("[SSO] 等待授权中...");
            continue;
        }
        return Err(format!("Token 轮询失败 ({status}): {body}"));
    }
}
