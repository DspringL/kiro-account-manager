// Web OAuth 命令 - 直接存储 usage_data

use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use crate::state::AppState;
use crate::account::Account;
use crate::auth::User;
use crate::providers::web_oauth::{WebOAuthProvider, WebOAuthInitResult};
use crate::commands::machine_guid_cmd::get_machine_id;
use crate::codewhisperer_client::CodeWhispererClient;

static PENDING_LOGIN: OnceLock<Mutex<Option<WebOAuthInitResult>>> = OnceLock::new();

fn get_pending_login() -> &'static Mutex<Option<WebOAuthInitResult>> {
    PENDING_LOGIN.get_or_init(|| Mutex::new(None))
}

const START_URL: &str = "https://view.awsapps.com/start";
const PORTAL_BASE: &str = "https://portal.sso.us-east-1.amazonaws.com";

// Device Flow 结果
#[derive(Debug)]
struct DeviceFlowResult {
    client_id: String,
    client_secret: String,
    access_token: String,
    refresh_token: String,
}

// 为 BuilderId 执行 Device Flow 获取 clientId/clientSecret
async fn execute_device_flow_for_builderid(bearer_token: &str) -> Result<DeviceFlowResult, String> {
    let region = "us-east-1";
    let oidc_base = format!("https://oidc.{}.amazonaws.com", region);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    // Step 1: 注册 OIDC 客户端
    println!("[DeviceFlow] Step 1: 注册 OIDC 客户端...");
    let scopes = vec![
        "codewhisperer:analysis",
        "codewhisperer:completions", 
        "codewhisperer:conversations",
        "codewhisperer:taskassist",
        "codewhisperer:transformations"
    ];
    
    let reg_body = serde_json::json!({
        "clientName": "Kiro Account Manager",
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
    
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct RegisterClientResponse {
        client_id: String,
        client_secret: String,
    }
    
    let reg_data: RegisterClientResponse = reg_res.json().await
        .map_err(|e| format!("解析注册响应失败: {}", e))?;
    
    let client_id = reg_data.client_id;
    let client_secret = reg_data.client_secret;
    println!("[DeviceFlow] 客户端已注册: {}...", &client_id[..20.min(client_id.len())]);

    // Step 2: 发起设备授权
    println!("[DeviceFlow] Step 2: 发起设备授权...");
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
    
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct DeviceAuthResponse {
        device_code: String,
        user_code: String,
        #[serde(default)]
        interval: Option<u64>,
    }
    
    let dev_data: DeviceAuthResponse = dev_res.json().await
        .map_err(|e| format!("解析设备授权响应失败: {}", e))?;
    
    let device_code = dev_data.device_code;
    let user_code = dev_data.user_code;
    let interval = dev_data.interval.unwrap_or(1);
    println!("[DeviceFlow] 设备码已获取, user_code: {}", user_code);

    // Step 3: 获取设备会话令牌
    println!("[DeviceFlow] Step 3: 获取设备会话令牌...");
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
    
    #[derive(serde::Deserialize)]
    struct DeviceSessionResponse {
        token: String,
    }
    
    let sess_data: DeviceSessionResponse = sess_res.json().await
        .map_err(|e| format!("解析设备会话响应失败: {}", e))?;
    
    let device_session_token = sess_data.token;
    println!("[DeviceFlow] 设备会话令牌已获取");

    // Step 4: 接受用户代码
    println!("[DeviceFlow] Step 4: 接受用户代码...");
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
    
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct AcceptUserCodeResponse {
        device_context: Option<DeviceContext>,
    }
    
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct DeviceContext {
        device_context_id: Option<String>,
        client_id: Option<String>,
        client_type: Option<String>,
    }
    
    let accept_data: AcceptUserCodeResponse = accept_res.json().await
        .map_err(|e| format!("解析接受用户代码响应失败: {}", e))?;
    
    let device_context = accept_data.device_context;
    println!("[DeviceFlow] 用户代码已接受");

    // Step 5: 批准授权
    if let Some(ref ctx) = device_context {
        if let Some(ref ctx_id) = ctx.device_context_id {
            println!("[DeviceFlow] Step 5: 批准授权...");
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
            println!("[DeviceFlow] 授权已批准");
        }
    }

    // Step 6: 轮询获取 Token
    println!("[DeviceFlow] Step 6: 轮询获取 Token...");
    let start_time = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(60);
    let mut current_interval = interval;
    
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct TokenResponse {
        access_token: String,
        refresh_token: String,
    }
    
    #[derive(serde::Deserialize)]
    struct TokenErrorResponse {
        error: Option<String>,
    }
    
    let token_data = loop {
        if start_time.elapsed() > timeout {
            return Err("Device Flow 授权超时".to_string());
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
    
    println!("[DeviceFlow] Token 获取成功!");
    
    Ok(DeviceFlowResult {
        client_id,
        client_secret,
        access_token: token_data.access_token,
        refresh_token: token_data.refresh_token,
    })
}

#[tauri::command]
pub async fn web_oauth_initiate(provider: String) -> Result<WebOAuthInitResponse, String> {
    println!("\n========== web_oauth_initiate START ==========");
    println!("Provider: {}", provider);
    
    if provider != "Google" && provider != "Github" && provider != "BuilderId" {
        return Err(format!("Unsupported provider: {}. Use 'Google', 'Github', or 'BuilderId'", provider));
    }

    let web_provider = WebOAuthProvider::new(&provider);
    
    match web_provider.initiate_login().await {
        Ok(init_result) => {
            println!("Authorize URL: {}", init_result.authorize_url);
            println!("State: {}", init_result.state);
            
            let response = WebOAuthInitResponse {
                authorize_url: init_result.authorize_url.clone(),
                state: init_result.state.clone(),
            };
            
            *get_pending_login().lock().unwrap() = Some(init_result);
            println!("========== web_oauth_initiate SUCCESS ==========\n");
            
            Ok(response)
        },
        Err(e) => {
            println!("initiate_login FAILED: {}", e);
            Err(e)
        }
    }
}

#[derive(serde::Serialize)]
pub struct WebOAuthInitResponse {
    pub authorize_url: String,
    pub state: String,
}

#[tauri::command]
pub async fn web_oauth_complete(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    callback_url: String,
) -> Result<String, String> {
    println!("[WebOAuth] web_oauth_complete: callback_url={}", &callback_url[..80.min(callback_url.len())]);
    
    let url = url::Url::parse(&callback_url)
        .map_err(|e| format!("Invalid callback URL: {}", e))?;
    
    let code = url.query_pairs()
        .find(|(k, _)| k == "code")
        .map(|(_, v)| v.to_string())
        .ok_or("No 'code' parameter in callback URL")?;
    
    let returned_state = url.query_pairs()
        .find(|(k, _)| k == "state")
        .map(|(_, v)| v.to_string())
        .ok_or("No 'state' parameter in callback URL")?;
    
    let init_result = {
        let mut pending_guard = get_pending_login().lock().unwrap();
        pending_guard.take()
    }.ok_or("No pending authentication state found")?;
    
    let web_provider = WebOAuthProvider::new(&init_result.provider_id);
    let auth_result = web_provider.complete_login(
        &code,
        &returned_state,
        &init_result.code_verifier,
        &init_result.state,
    ).await?;

    let provider = &init_result.provider_id;
    
    // BuilderId 使用 Device Flow 获取 clientId/clientSecret
    if provider == "BuilderId" {
        println!("[WebOAuth] BuilderId: 执行 Device Flow 获取 clientId/clientSecret...");
        
        // 用 Web OAuth 获取的 access_token 作为 bearer token 执行 Device Flow
        let device_result = execute_device_flow_for_builderid(&auth_result.access_token).await?;
        
        // 使用 Device Flow 的 token 获取用量信息
        let machine_id = get_machine_id();
        let cw_client = CodeWhispererClient::new(&machine_id);
        
        let usage = cw_client.get_usage_limits(&device_result.access_token).await.ok();
        let usage_data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);
        
        // 从 usage 中提取 email 和 user_id
        let email = usage.as_ref()
            .and_then(|u| u.user_info.as_ref())
            .and_then(|ui| ui.email.clone())
            .unwrap_or_else(|| super::generate_random_email("BuilderId"));
        
        let user_id = usage.as_ref()
            .and_then(|u| u.user_info.as_ref())
            .and_then(|ui| ui.user_id.clone());
        
        // 计算 clientIdHash
        let client_id_hash = {
            use sha2::{Sha256, Digest};
            let mut hasher = Sha256::new();
            hasher.update(START_URL.as_bytes());
            hex::encode(hasher.finalize())
        };
        
        let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);
        
        let mut store = state.store.lock().unwrap();
        
        // 查找已有账号
        let existing_idx = store.accounts.iter().position(|a| 
            a.email == email && a.provider.as_deref() == Some("BuilderId")
        );
        
        let account = if let Some(idx) = existing_idx {
            let existing = &mut store.accounts[idx];
            existing.access_token = Some(device_result.access_token.clone());
            existing.refresh_token = Some(device_result.refresh_token.clone());
            existing.client_id = Some(device_result.client_id.clone());
            existing.client_secret = Some(device_result.client_secret.clone());
            existing.client_id_hash = Some(client_id_hash);
            existing.region = Some("us-east-1".to_string());
            existing.expires_at = Some(expires_at.to_rfc3339());
            existing.usage_data = Some(usage_data);
            existing.status = "active".to_string();
            existing.user_id = user_id;
            existing.session_token = None; // 清除旧的 session_token
            existing.csrf_token = None; // Device Flow 不需要 csrf_token
            existing.clone()
        } else {
            let mut account = Account::new(email.clone(), email.clone());
            account.provider = Some("BuilderId".to_string());
            account.access_token = Some(device_result.access_token.clone());
            account.refresh_token = Some(device_result.refresh_token.clone());
            account.client_id = Some(device_result.client_id.clone());
            account.client_secret = Some(device_result.client_secret.clone());
            account.client_id_hash = Some(client_id_hash);
            account.region = Some("us-east-1".to_string());
            account.expires_at = Some(expires_at.to_rfc3339());
            account.usage_data = Some(usage_data);
            account.user_id = user_id;
            store.accounts.insert(0, account.clone());
            account
        };
        
        store.save_to_file();
        drop(store);
        
        update_auth_state_web(&state, &account.email, "BuilderId", &device_result.access_token, &device_result.refresh_token);
        println!("[WebOAuth] BuilderId LOGIN SUCCESS (Device Flow): email={}", account.email);
        
        let _ = app_handle.emit("login-success", account.id.clone());
        return Ok("Web OAuth BuilderId login completed (with Device Flow)".to_string());
    }

    // Google/Github 继续使用原有流程
    // 验证 csrf_token 存在
    auth_result.csrf_token.as_ref()
        .ok_or("No csrf_token from ExchangeToken")?;

    let portal_client = crate::providers::web_oauth::KiroWebPortalClient::new();
    
    // 获取配额数据（包含 userInfo），检测封禁状态
    let usage_call = portal_client.get_user_usage_and_limits(
        &auth_result.access_token,
        &init_result.idp,
    ).await;
    
    let (usage, is_banned) = match &usage_call {
        Ok(u) => (Some(u.clone()), false),
        Err(e) if e.starts_with("BANNED:") => (None, true),
        Err(e) => return Err(e.clone()),
    };
    
    // 从 usage.user_info 获取 email 和 user_id
    let new_email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|u| u.email.clone());
    let user_id = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|u| u.user_id.clone());
    
    // 检测账号状态（仅用于封禁检测，不保存）
    let is_banned = is_banned || portal_client.get_user_info(
        &auth_result.access_token,
        &init_result.idp,
    ).await.map(|info| info.status.as_deref() == Some("Suspended")).unwrap_or(false);
    
    let usage_data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);

    let mut store = state.store.lock().unwrap();
    
    // 查找已有账号：优先用邮箱匹配，否则用 refresh_token 匹配
    let existing_idx = if let Some(email) = &new_email {
        store.accounts.iter().position(|a| &a.email == email && a.provider.as_deref() == Some(provider))
    } else {
        // 被封禁时无法获取邮箱，尝试用 refresh_token 匹配
        let rt = &auth_result.refresh_token;
        store.accounts.iter().position(|a| {
            a.provider.as_deref() == Some(provider) && 
            (a.refresh_token.as_ref() == Some(rt) || a.session_token.as_ref() == Some(rt))
        })
    };
    
    // 更新或新建账号
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        // 更新现有账号，保留原有邮箱
        existing.access_token = Some(auth_result.access_token.clone());
        existing.refresh_token = Some(auth_result.refresh_token.clone());
        existing.session_token = None;
        // 如果获取到了新邮箱，更新它（正常情况）
        if let Some(email) = &new_email {
            existing.email = email.clone();
        }
        // 不更新 provider，保留原有
        existing.user_id = user_id;
        existing.expires_at = Some(auth_result.expires_at.clone());
        existing.profile_arn = auth_result.profile_arn.clone();
        existing.csrf_token = auth_result.csrf_token.clone();
        existing.usage_data = Some(usage_data);
        existing.status = if is_banned { "banned".to_string() } else { "active".to_string() };
        existing.clone()
    } else {
        // 新建账号 - 必须有邮箱
        let email = new_email.unwrap_or_else(|| super::generate_random_email(provider));
        let mut account = Account::new(email.clone(), format!("Kiro {} (Web OAuth)", provider));
        account.access_token = Some(auth_result.access_token.clone());
        account.refresh_token = Some(auth_result.refresh_token.clone());
        account.provider = Some(provider.clone());
        account.user_id = user_id;
        account.expires_at = Some(auth_result.expires_at.clone());
        account.profile_arn = auth_result.profile_arn.clone();
        account.csrf_token = auth_result.csrf_token.clone();
        account.usage_data = Some(usage_data);
        account.status = if is_banned { "banned".to_string() } else { "active".to_string() };
        store.accounts.insert(0, account.clone());
        account
    };
    
    store.save_to_file();
    drop(store);

    let final_email = account.email.clone();
    update_auth_state_web(&state, &final_email, provider, &auth_result.access_token, &auth_result.refresh_token);
    println!("[WebOAuth] LOGIN SUCCESS: email={}, provider={}", final_email, provider);

    let _ = app_handle.emit("login-success", account.id.clone());
    Ok(format!("Web OAuth login completed for {}", provider))
}

#[tauri::command]
pub async fn web_oauth_refresh(
    state: State<'_, AppState>,
    account_id: String,
) -> Result<Account, String> {
    let account = {
        let store = state.store.lock().unwrap();
        store.accounts.iter()
            .find(|a| a.id == account_id)
            .cloned()
            .ok_or("Account not found")?
    };

    // Web OAuth 账号必须有 csrfToken
    if account.csrf_token.is_none() {
        return Err("This account is not a Web OAuth account (no csrfToken)".to_string());
    }

    let access_token = account.access_token.as_ref().ok_or("No access_token found")?;
    let csrf_token = account.csrf_token.as_ref().ok_or("No csrf_token found")?;
    let provider = account.provider.as_ref().ok_or("No provider found")?;
    
    // 根据 provider 从不同字段读取
    let token = if provider == "BuilderId" {
        account.session_token.as_ref().ok_or("No session_token found")?
    } else {
        account.refresh_token.as_ref().ok_or("No refresh_token found")?
    };
    
    let web_provider = WebOAuthProvider::new(provider);
    
    // 先尝试刷新 token，如果失败检查是否是封禁
    let auth_result = match web_provider.refresh_token_impl(access_token, csrf_token, token).await {
        Ok(result) => result,
        Err(e) if e.starts_with("BANNED:") => {
            // 封禁时更新状态但保留原有信息
            let mut store = state.store.lock().unwrap();
            if let Some(a) = store.accounts.iter_mut().find(|a| a.id == account_id) {
                a.status = "banned".to_string();
                let result = a.clone();
                store.save_to_file();
                println!("[WebOAuth] Account banned: {}", result.email);
                return Ok(result);
            }
            return Err(e);
        }
        Err(e) => return Err(e),
    };
    
    let portal_client = crate::providers::web_oauth::KiroWebPortalClient::new();
    let idp = provider.as_str();
    let usage_call = portal_client.get_user_usage_and_limits(
        &auth_result.access_token,
        idp,
    ).await;
    
    // 检测封禁状态
    let (usage, is_banned) = match &usage_call {
        Ok(u) => (Some(u.clone()), false),
        Err(e) if e.starts_with("BANNED:") => (None, true),
        Err(_) => (None, false),
    };
    let usage_data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);

    let mut store = state.store.lock().unwrap();
    if let Some(a) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        a.access_token = Some(auth_result.access_token);
        // 根据 provider 存到不同字段
        if provider == "BuilderId" {
            a.session_token = Some(auth_result.refresh_token);
            a.refresh_token = None;
        } else {
            a.refresh_token = Some(auth_result.refresh_token);
            a.session_token = None;
        }
        a.csrf_token = auth_result.csrf_token;
        a.expires_at = Some(auth_result.expires_at);
        a.usage_data = Some(usage_data);
        a.status = if is_banned { "banned".to_string() } else { "active".to_string() };
        if auth_result.profile_arn.is_some() {
            a.profile_arn = auth_result.profile_arn;
        }
        
        let result = a.clone();
        store.save_to_file();
        println!("[WebOAuth] Account refreshed: {}", result.email);
        return Ok(result);
    }

    Err("Account not found after refresh".to_string())
}

fn update_auth_state_web(
    state: &State<'_, AppState>,
    email: &str,
    provider: &str,
    access_token: &str,
    refresh_token: &str,
) {
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: email.to_string(),
        name: email.split('@').next().unwrap_or("User").to_string(),
        avatar: None,
        provider: provider.to_string(),
    };
    *state.auth.user.lock().unwrap() = Some(user);
    *state.auth.access_token.lock().unwrap() = Some(access_token.to_string());
    *state.auth.refresh_token.lock().unwrap() = Some(refresh_token.to_string());
}

#[tauri::command]
pub async fn web_oauth_login(
    app_handle: AppHandle,
    provider: String,
) -> Result<WebOAuthLoginResponse, String> {
    println!("\n========== web_oauth_login START ==========");
    println!("Provider: {}", provider);
    
    if provider != "Google" && provider != "Github" && provider != "BuilderId" {
        return Err(format!("Unsupported provider: {}. Use 'Google', 'Github', or 'BuilderId'", provider));
    }

    let web_provider = WebOAuthProvider::new(&provider);
    let init_result = web_provider.initiate_login().await?;
    
    println!("Authorize URL: {}", init_result.authorize_url);
    println!("State: {}", init_result.state);
    
    *get_pending_login().lock().unwrap() = Some(init_result.clone());
    println!("Saved init_result to PENDING_LOGIN, state: {}", init_result.state);
    
    let window_label = format!("oauth_{}", provider.to_lowercase());
    
    if let Some(existing) = app_handle.get_webview_window(&window_label) {
        let _ = existing.close();
    }
    
    let app_handle_clone = app_handle.clone();
    let window_label_clone = window_label.clone();
    
    let auth_url = init_result.authorize_url.parse()
        .map_err(|e| format!("Invalid authorize URL: {}", e))?;
    
    let _window = WebviewWindowBuilder::new(
        &app_handle,
        &window_label,
        WebviewUrl::External(auth_url)
    )
    .title(format!("Login with {}", provider))
    .inner_size(500.0, 700.0)
    .center()
    .incognito(true)
    .on_navigation(move |url| {
        let url_str = url.as_str();
        println!("[WebView] Navigation: {}", url_str);
        
        if url_str.starts_with("https://app.kiro.dev/signin/oauth") && url_str.contains("code=") {
            println!("[WebView] Callback URL detected! Emitting event...");
            let _ = app_handle_clone.emit("web-oauth-callback", url_str.to_string());
            
            if let Some(win) = app_handle_clone.get_webview_window(&window_label_clone) {
                let _ = win.close();
            }
            return false;
        }
        true
    })
    .build()
    .map_err(|e| format!("Failed to create auth window: {}", e))?;
    
    println!("========== web_oauth_login WINDOW OPENED ==========\n");
    
    Ok(WebOAuthLoginResponse {
        window_label,
        state: init_result.state,
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WebOAuthLoginResponse {
    pub window_label: String,
    pub state: String,
}

#[tauri::command]
pub fn web_oauth_close_window(
    app_handle: AppHandle,
    window_label: String,
) -> Result<(), String> {
    if let Some(window) = app_handle.get_webview_window(&window_label) {
        window.close().map_err(|e| format!("Failed to close window: {}", e))?;
    }
    Ok(())
}