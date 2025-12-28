// Web OAuth 命令 - 直接存储 usage_data

use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use crate::state::AppState;
use crate::account::Account;
use crate::auth::User;
use crate::providers::web_oauth::{WebOAuthProvider, WebOAuthInitResult, KiroWebPortalClient};

static PENDING_LOGIN: OnceLock<Mutex<Option<WebOAuthInitResult>>> = OnceLock::new();

fn get_pending_login() -> &'static Mutex<Option<WebOAuthInitResult>> {
    PENDING_LOGIN.get_or_init(|| Mutex::new(None))
}

const START_URL: &str = "https://view.awsapps.com/start";

// BuilderId Authorization Code Flow 状态
#[allow(dead_code)]
#[derive(Clone)]
struct BuilderIdAuthState {
    client_id: String,
    client_secret: String,
    code_verifier: String,
    state: String,
    redirect_uri: String,
}

static BUILDERID_AUTH_STATE: OnceLock<Mutex<Option<BuilderIdAuthState>>> = OnceLock::new();

fn get_builderid_auth_state() -> &'static Mutex<Option<BuilderIdAuthState>> {
    BUILDERID_AUTH_STATE.get_or_init(|| Mutex::new(None))
}

// 生成 PKCE 参数
fn generate_pkce() -> (String, String) {
    use sha2::{Sha256, Digest};
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
    
    // 生成 code_verifier (43-128 字符的随机字符串)
    let code_verifier: String = (0..64)
        .map(|_| {
            let idx = rand::random::<u8>() % 62;
            match idx {
                0..=25 => (b'A' + idx) as char,
                26..=51 => (b'a' + idx - 26) as char,
                _ => (b'0' + idx - 52) as char,
            }
        })
        .collect();
    
    // 计算 code_challenge = base64url(sha256(code_verifier))
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let hash = hasher.finalize();
    let code_challenge = URL_SAFE_NO_PAD.encode(hash);
    
    (code_verifier, code_challenge)
}

// 生成随机 state
fn generate_state() -> String {
    (0..32)
        .map(|_| {
            let idx = rand::random::<u8>() % 62;
            match idx {
                0..=25 => (b'A' + idx) as char,
                26..=51 => (b'a' + idx - 26) as char,
                _ => (b'0' + idx - 52) as char,
            }
        })
        .collect()
}

// 注册 OIDC 客户端并返回授权 URL
async fn prepare_builderid_auth() -> Result<(String, BuilderIdAuthState), String> {
    let region = "us-east-1";
    let oidc_base = format!("https://oidc.{}.amazonaws.com", region);
    // 使用固定的 redirect_uri，WebView 会拦截这个 URL
    let redirect_uri = "http://127.0.0.1/oauth/callback".to_string();
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    // Step 1: 注册 OIDC 客户端
    println!("[AuthCodeFlow] Step 1: 注册 OIDC 客户端...");
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
        "grantTypes": ["authorization_code", "refresh_token"],
        "redirectUris": [redirect_uri],
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
    println!("[AuthCodeFlow] 客户端已注册: {}...", &client_id[..20.min(client_id.len())]);

    // Step 2: 生成 PKCE 参数
    let (code_verifier, code_challenge) = generate_pkce();
    let state = generate_state();
    println!("[AuthCodeFlow] PKCE 参数已生成");

    // Step 3: 构建授权 URL
    let scopes_str = scopes.join(",");
    let authorize_url = format!(
        "{}/authorize?response_type=code&client_id={}&redirect_uri={}&scopes={}&state={}&code_challenge={}&code_challenge_method=S256",
        oidc_base,
        urlencoding::encode(&client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&scopes_str),
        urlencoding::encode(&state),
        urlencoding::encode(&code_challenge)
    );
    
    let auth_state = BuilderIdAuthState {
        client_id,
        client_secret,
        code_verifier,
        state,
        redirect_uri,
    };
    
    Ok((authorize_url, auth_state))
}

// 用授权码换取 Token
async fn exchange_code_for_token(
    code: &str,
    auth_state: &BuilderIdAuthState,
) -> Result<(String, String, String, String), String> {
    let region = "us-east-1";
    let oidc_base = format!("https://oidc.{}.amazonaws.com", region);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    
    println!("[AuthCodeFlow] 用授权码换取 Token...");
    let token_body = serde_json::json!({
        "clientId": auth_state.client_id,
        "clientSecret": auth_state.client_secret,
        "grantType": "authorization_code",
        "redirectUri": auth_state.redirect_uri,
        "code": code,
        "codeVerifier": auth_state.code_verifier
    });
    
    let token_res = client
        .post(format!("{}/token", oidc_base))
        .header("Content-Type", "application/json")
        .json(&token_body)
        .send()
        .await
        .map_err(|e| format!("获取 Token 请求失败: {}", e))?;
    
    if !token_res.status().is_success() {
        let text = token_res.text().await.unwrap_or_default();
        return Err(format!("获取 Token 失败: {}", text));
    }
    
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct TokenResponse {
        access_token: String,
        refresh_token: String,
    }
    
    let token_data: TokenResponse = token_res.json().await
        .map_err(|e| format!("解析 Token 响应失败: {}", e))?;
    
    println!("[AuthCodeFlow] Token 获取成功!");
    
    Ok((
        auth_state.client_id.clone(),
        auth_state.client_secret.clone(),
        token_data.access_token,
        token_data.refresh_token,
    ))
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
    
    // BuilderId 不再通过 Web Portal 登录，而是直接使用 Authorization Code Flow
    // 这里保留代码以防万一，但实际上 BuilderId 应该走 web_oauth_builderid_login
    if provider == "BuilderId" {
        return Err("BuilderId 请使用专用的 Authorization Code Flow 登录".to_string());
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

// BuilderId 专用登录命令 - 使用 Authorization Code Flow + WebView
#[tauri::command]
pub async fn web_oauth_builderid_login(
    app_handle: AppHandle,
) -> Result<WebOAuthLoginResponse, String> {
    println!("\n========== web_oauth_builderid_login START ==========");
    
    // 准备授权 URL 和状态
    let (authorize_url, auth_state) = prepare_builderid_auth().await?;
    
    println!("[BuilderId] 授权 URL: {}", authorize_url);
    println!("[BuilderId] State: {}", auth_state.state);
    
    // 保存状态供回调使用
    *get_builderid_auth_state().lock().unwrap() = Some(auth_state.clone());
    
    let window_label = "oauth_builderid".to_string();
    
    // 关闭已有窗口
    if let Some(existing) = app_handle.get_webview_window(&window_label) {
        let _ = existing.close();
    }
    
    let app_handle_clone = app_handle.clone();
    let window_label_clone = window_label.clone();
    let expected_state = auth_state.state.clone();
    
    let auth_url = authorize_url.parse()
        .map_err(|e| format!("Invalid authorize URL: {}", e))?;
    
    // 创建 WebView 窗口
    let _window = WebviewWindowBuilder::new(
        &app_handle,
        &window_label,
        WebviewUrl::External(auth_url)
    )
    .title("Login with AWS Builder ID")
    .inner_size(500.0, 700.0)
    .center()
    .incognito(true)
    .on_navigation(move |url| {
        let url_str = url.as_str();
        println!("[BuilderId WebView] Navigation: {}", url_str);
        
        // 拦截回调 URL: http://127.0.0.1/oauth/callback?code=xxx&state=xxx
        if url_str.starts_with("http://127.0.0.1/oauth/callback") && url_str.contains("code=") {
            println!("[BuilderId WebView] Callback URL detected!");
            
            // 解析 code 和 state
            if let Ok(parsed_url) = url::Url::parse(url_str) {
                let code = parsed_url.query_pairs()
                    .find(|(k, _)| k == "code")
                    .map(|(_, v)| v.to_string());
                let returned_state = parsed_url.query_pairs()
                    .find(|(k, _)| k == "state")
                    .map(|(_, v)| v.to_string());
                
                if let (Some(code), Some(state)) = (code, returned_state) {
                    if state == expected_state {
                        // 发送回调事件
                        let _ = app_handle_clone.emit("builderid-oauth-callback", code);
                    } else {
                        let _ = app_handle_clone.emit("builderid-oauth-error", "State 不匹配");
                    }
                }
            }
            
            // 关闭窗口
            if let Some(win) = app_handle_clone.get_webview_window(&window_label_clone) {
                let _ = win.close();
            }
            return false; // 阻止导航
        }
        true
    })
    .build()
    .map_err(|e| format!("Failed to create auth window: {}", e))?;
    
    println!("========== web_oauth_builderid_login WINDOW OPENED ==========\n");
    
    Ok(WebOAuthLoginResponse {
        window_label,
        state: auth_state.state,
    })
}

// BuilderId 回调完成命令
#[tauri::command]
pub async fn web_oauth_builderid_complete(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    code: String,
) -> Result<String, String> {
    println!("[BuilderId] web_oauth_builderid_complete: code={}...", &code[..20.min(code.len())]);
    
    // 获取保存的状态
    let auth_state = {
        let mut guard = get_builderid_auth_state().lock().unwrap();
        guard.take()
    }.ok_or("No pending BuilderId authentication state found")?;
    
    // 用授权码换取 Token
    let (client_id, client_secret, access_token, refresh_token) = 
        exchange_code_for_token(&code, &auth_state).await?;
    
    // 统一使用 Web Portal 接口获取用量信息
    let client = KiroWebPortalClient::new();
    let usage = client.get_user_usage_and_limits(&access_token, "BuilderId").await.ok();
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
        existing.access_token = Some(access_token.clone());
        existing.refresh_token = Some(refresh_token.clone());
        existing.client_id = Some(client_id.clone());
        existing.client_secret = Some(client_secret.clone());
        existing.client_id_hash = Some(client_id_hash);
        existing.region = Some("us-east-1".to_string());
        existing.expires_at = Some(expires_at.to_rfc3339());
        existing.usage_data = Some(usage_data);
        existing.status = "active".to_string();
        existing.user_id = user_id;
        existing.session_token = None;
        existing.csrf_token = None;
        existing.clone()
    } else {
        let mut account = Account::new(email.clone(), email.clone());
        account.provider = Some("BuilderId".to_string());
        account.access_token = Some(access_token.clone());
        account.refresh_token = Some(refresh_token.clone());
        account.client_id = Some(client_id.clone());
        account.client_secret = Some(client_secret.clone());
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
    
    update_auth_state_web(&state, &account.email, "BuilderId", &access_token, &refresh_token);
    println!("[WebOAuth] BuilderId LOGIN SUCCESS: email={}", account.email);
    
    let _ = app_handle.emit("login-success", account.id.clone());
    Ok(format!("BuilderId 登录成功: {}", account.email))
}