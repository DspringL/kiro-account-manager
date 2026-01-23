// SSO Token 导入命令
// 从 x-amz-sso_authn Cookie 导入 BuilderId 账号

use serde::{Deserialize, Serialize};
use tauri::State;
use crate::state::AppState;
use crate::account::Account;
use crate::kiro_portal_client::KiroPortalClient;
use crate::commands::common::{MAX_ACCOUNT_COUNT, calc_client_id_hash, extract_user_info};

const PORTAL_BASE: &str = "https://portal.sso.us-east-1.amazonaws.com";
const START_URL: &str = "https://view.awsapps.com/start";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SsoImportResult {
    pub success: bool,
    pub email: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RegisterClientResponse {
    client_id: String,
    client_secret: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DeviceAuthResponse {
    device_code: String,
    user_code: String,
    #[serde(default)]
    interval: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct DeviceSessionResponse {
    token: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AcceptUserCodeResponse {
    device_context: Option<DeviceContext>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DeviceContext {
    device_context_id: Option<String>,
    client_id: Option<String>,
    client_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TokenResponse {
    access_token: String,
    refresh_token: String,
}

#[derive(Debug, Deserialize)]
struct TokenErrorResponse {
    error: Option<String>,
}

/// 从 SSO Token 导入账号
#[tauri::command]
pub async fn import_from_sso_token(
    bearer_token: String,
    region: Option<String>,
    state: State<'_, AppState>,
) -> Result<SsoImportResult, String> {
    // 检查账号数量上限
    {
        let store = state.store.lock().map_err(|e| format!("锁定存储失败: {}", e))?;
        if store.accounts.len() >= MAX_ACCOUNT_COUNT {
            return Ok(SsoImportResult {
                success: false,
                email: None,
                error: Some(format!("账号数量已达上限 ({})，无法继续添加", MAX_ACCOUNT_COUNT)),
            });
        }
    }
    
    let region = region.unwrap_or_else(|| "us-east-1".to_string());
    let oidc_base = format!("https://oidc.{}.amazonaws.com", region);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    // Step 1: 注册 OIDC 客户端
    println!("[SSO Import] Step 1: 注册 OIDC 客户端...");
    // 使用与 aws_sso_client.rs 相同的 scopes 顺序
    let scopes = vec![
        "codewhisperer:completions",
        "codewhisperer:analysis",
        "codewhisperer:conversations",
        "codewhisperer:transformations",
        "codewhisperer:taskassist",
    ];
    
    let reg_body = serde_json::json!({
        "clientName": "Amazon Q Developer for command line",
        "clientType": "public",
        "scopes": scopes,
        "grantTypes": ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"],
        "issuerUrl": START_URL
    });
    
    let reg_res = client
        .post(format!("{}/client/register", oidc_base))
        .header("Content-Type", "application/json")
        .json(&reg_body)
        .send()
        .await
        .map_err(|e| format!("注册客户端请求失败: {}", e))?;
    
    if !reg_res.status().is_success() {
        let text = reg_res.text().await.unwrap_or_default();
        return Err(format!("注册客户端失败: {}", text));
    }
    
    let reg_data: RegisterClientResponse = reg_res.json().await
        .map_err(|e| format!("解析注册响应失败: {}", e))?;
    
    let client_id = reg_data.client_id;
    let client_secret = reg_data.client_secret;
    println!("[SSO Import] 客户端已注册: {}...", &client_id[..20.min(client_id.len())]);

    // Step 2: 发起设备授权
    println!("[SSO Import] Step 2: 发起设备授权...");
    let dev_body = serde_json::json!({
        "clientId": client_id,
        "clientSecret": client_secret,
        "startUrl": START_URL
    });
    
    let dev_res = client
        .post(format!("{}/device_authorization", oidc_base))
        .header("Content-Type", "application/json")
        .json(&dev_body)
        .send()
        .await
        .map_err(|e| format!("设备授权请求失败: {}", e))?;
    
    if !dev_res.status().is_success() {
        let text = dev_res.text().await.unwrap_or_default();
        return Err(format!("设备授权失败: {}", text));
    }
    
    let dev_data: DeviceAuthResponse = dev_res.json().await
        .map_err(|e| format!("解析设备授权响应失败: {}", e))?;
    
    let device_code = dev_data.device_code;
    let user_code = dev_data.user_code;
    let interval = dev_data.interval.unwrap_or(1);
    println!("[SSO Import] 设备码已获取, user_code: {}", user_code);

    // Step 3: 验证 Bearer Token
    println!("[SSO Import] Step 3: 验证 Bearer Token...");
    let who_res = client
        .get(format!("{}/token/whoAmI", PORTAL_BASE))
        .header("Authorization", format!("Bearer {}", bearer_token))
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("验证 Token 请求失败: {}", e))?;
    
    if !who_res.status().is_success() {
        let status = who_res.status();
        let text = who_res.text().await.unwrap_or_default();
        
        // 提供更友好的错误提示
        let error_msg = if status.as_u16() == 401 {
            "Bearer Token 已过期或无效，请从浏览器重新获取 x-amz-sso_authn Cookie".to_string()
        } else {
            format!("Token 验证失败 ({}): {}", status, text)
        };
        
        return Err(error_msg);
    }
    println!("[SSO Import] Bearer Token 验证通过");

    // Step 4: 获取设备会话令牌
    println!("[SSO Import] Step 4: 获取设备会话令牌...");
    let sess_res = client
        .post(format!("{}/session/device", PORTAL_BASE))
        .header("Authorization", format!("Bearer {}", bearer_token))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({}))
        .send()
        .await
        .map_err(|e| format!("获取设备会话请求失败: {}", e))?;
    
    if !sess_res.status().is_success() {
        let text = sess_res.text().await.unwrap_or_default();
        return Err(format!("获取设备会话失败: {}", text));
    }
    
    let sess_data: DeviceSessionResponse = sess_res.json().await
        .map_err(|e| format!("解析设备会话响应失败: {}", e))?;
    
    let device_session_token = sess_data.token;
    println!("[SSO Import] 设备会话令牌已获取");

    // Step 5: 接受用户代码
    println!("[SSO Import] Step 5: 接受用户代码...");
    let accept_body = serde_json::json!({
        "userCode": user_code,
        "userSessionId": device_session_token
    });
    
    let accept_res = client
        .post(format!("{}/device_authorization/accept_user_code", oidc_base))
        .header("Content-Type", "application/json")
        .header("Referer", "https://view.awsapps.com/")
        .json(&accept_body)
        .send()
        .await
        .map_err(|e| format!("接受用户代码请求失败: {}", e))?;
    
    if !accept_res.status().is_success() {
        let text = accept_res.text().await.unwrap_or_default();
        return Err(format!("接受用户代码失败: {}", text));
    }
    
    let accept_data: AcceptUserCodeResponse = accept_res.json().await
        .map_err(|e| format!("解析接受用户代码响应失败: {}", e))?;
    
    let device_context = accept_data.device_context;
    println!("[SSO Import] 用户代码已接受");

    // Step 6: 批准授权
    if let Some(ref ctx) = device_context {
        if let Some(ref ctx_id) = ctx.device_context_id {
            println!("[SSO Import] Step 6: 批准授权...");
            let approve_body = serde_json::json!({
                "deviceContext": {
                    "deviceContextId": ctx_id,
                    "clientId": ctx.client_id.as_ref().unwrap_or(&client_id),
                    "clientType": ctx.client_type.as_ref().unwrap_or(&"public".to_string())
                },
                "userSessionId": device_session_token
            });
            
            let approve_res = client
                .post(format!("{}/device_authorization/associate_token", oidc_base))
                .header("Content-Type", "application/json")
                .header("Referer", "https://view.awsapps.com/")
                .json(&approve_body)
                .send()
                .await
                .map_err(|e| format!("批准授权请求失败: {}", e))?;
            
            if !approve_res.status().is_success() {
                let text = approve_res.text().await.unwrap_or_default();
                return Err(format!("批准授权失败: {}", text));
            }
            println!("[SSO Import] 授权已批准");
        }
    }

    // Step 7: 轮询获取 Token
    println!("[SSO Import] Step 7: 轮询获取 Token...");
    let start_time = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(120);
    let mut current_interval = interval;
    
    let token_data = loop {
        if start_time.elapsed() > timeout {
            return Err("授权超时，请重试".to_string());
        }
        
        tokio::time::sleep(std::time::Duration::from_secs(current_interval)).await;
        
        let token_body = serde_json::json!({
            "clientId": client_id,
            "clientSecret": client_secret,
            "grantType": "urn:ietf:params:oauth:grant-type:device_code",
            "deviceCode": device_code
        });
        
        let token_res = client
            .post(format!("{}/token", oidc_base))
            .header("Content-Type", "application/json")
            .json(&token_body)
            .send()
            .await
            .map_err(|e| format!("获取 Token 请求失败: {}", e))?;
        
        let status = token_res.status();
        let text = token_res.text().await.unwrap_or_default();
        
        if status.is_success() {
            let data: TokenResponse = serde_json::from_str(&text)
                .map_err(|e| format!("解析 Token 响应失败: {}", e))?;
            break data;
        }
        
        if status.as_u16() == 400 {
            if let Ok(err_data) = serde_json::from_str::<TokenErrorResponse>(&text) {
                match err_data.error.as_deref() {
                    Some("authorization_pending") => continue,
                    Some("slow_down") => {
                        current_interval += 5;
                        continue;
                    }
                    Some(e) => return Err(format!("Token 获取失败: {}", e)),
                    None => return Err(format!("Token 获取失败: {}", text)),
                }
            }
        }
        
        return Err(format!("Token 获取失败 ({}): {}", status, text));
    };
    
    println!("[SSO Import] Token 获取成功!");

    // Step 8: 统一使用 Web Portal 接口获取用量信息
    let client = KiroPortalClient::new();
    let usage_response = client.get_user_usage_and_limits(&token_data.access_token, "BuilderId").await?;
    let usage_data = serde_json::to_value(&usage_response).unwrap_or(serde_json::Value::Null);
    
    let (new_email, user_id) = extract_user_info(&Some(usage_response));
    
    // 获取不到邮箱直接报错
    let email = new_email.ok_or("获取邮箱失败，请检查账号状态")?;
    let client_id_hash = calc_client_id_hash(START_URL);

    let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);
    
    // 添加到账号列表
    let mut store = state.store.lock().map_err(|e| format!("锁定存储失败: {}", e))?;
    
    // 按 email + provider 去重（SSO 导入都是 BuilderId）
    if let Some(existing) = store.accounts.iter_mut().find(|a| a.email == email && a.provider.as_deref() == Some("BuilderId")) {
        existing.access_token = Some(token_data.access_token);
        existing.refresh_token = Some(token_data.refresh_token);
        existing.client_id = Some(client_id);
        existing.client_secret = Some(client_secret);
        existing.client_id_hash = Some(client_id_hash);
        existing.region = Some(region);
        existing.expires_at = Some(expires_at.to_rfc3339());
        existing.usage_data = Some(usage_data);
        existing.status = "active".to_string();
        existing.user_id = user_id;
    } else {
        let mut account = Account::new(email.clone(), email.clone());
        account.provider = Some("BuilderId".to_string());
        account.auth_method = Some("IdC".to_string());
        account.access_token = Some(token_data.access_token);
        account.refresh_token = Some(token_data.refresh_token);
        account.client_id = Some(client_id);
        account.client_secret = Some(client_secret);
        account.client_id_hash = Some(client_id_hash);
        account.region = Some(region);
        account.expires_at = Some(expires_at.to_rfc3339());
        account.usage_data = Some(usage_data);
        account.user_id = user_id;
        store.accounts.insert(0, account);
    }
    
    store.save_to_file();
    
    Ok(SsoImportResult {
        success: true,
        email: Some(email),
        error: None,
    })
}
