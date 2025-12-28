// Web OAuth 命令 - 直接存储 usage_data

use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};
use crate::state::AppState;
use crate::account::Account;
use crate::auth::User;
use crate::providers::web_oauth::{WebOAuthProvider, WebOAuthInitResult, KiroWebPortalClient};

// 常量定义
const START_URL: &str = "https://view.awsapps.com/start";
const OIDC_REGION: &str = "us-east-1";
const REDIRECT_URI: &str = "http://127.0.0.1/oauth/callback";

static PENDING_LOGIN: OnceLock<Mutex<Option<WebOAuthInitResult>>> = OnceLock::new();
static BUILDERID_AUTH_STATE: OnceLock<Mutex<Option<BuilderIdAuthState>>> = OnceLock::new();

fn get_pending_login() -> &'static Mutex<Option<WebOAuthInitResult>> {
    PENDING_LOGIN.get_or_init(|| Mutex::new(None))
}

fn get_builderid_auth_state() -> &'static Mutex<Option<BuilderIdAuthState>> {
    BUILDERID_AUTH_STATE.get_or_init(|| Mutex::new(None))
}

// BuilderId Authorization Code Flow 状态
#[derive(Clone)]
struct BuilderIdAuthState {
    client_id: String,
    client_secret: String,
    code_verifier: String,
    state: String,
}

// 生成随机字母数字字符串
fn generate_random_string(len: usize) -> String {
    (0..len).map(|_| {
        let idx = rand::random::<u8>() % 62;
        match idx {
            0..=25 => (b'A' + idx) as char,
            26..=51 => (b'a' + idx - 26) as char,
            _ => (b'0' + idx - 52) as char,
        }
    }).collect()
}

// 生成 PKCE 参数
fn generate_pkce() -> (String, String) {
    use sha2::{Sha256, Digest};
    use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
    
    let code_verifier = generate_random_string(64);
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let code_challenge = URL_SAFE_NO_PAD.encode(hasher.finalize());
    
    (code_verifier, code_challenge)
}

// 创建 HTTP 客户端
fn create_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))
}

// 获取 OIDC 基础 URL
fn oidc_base_url() -> String {
    format!("https://oidc.{}.amazonaws.com", OIDC_REGION)
}

// 注册 OIDC 客户端并返回授权 URL
async fn prepare_builderid_auth() -> Result<(String, BuilderIdAuthState), String> {
    let client = create_http_client()?;
    let oidc_base = oidc_base_url();
    
    let scopes = vec![
        "codewhisperer:analysis",
        "codewhisperer:completions", 
        "codewhisperer:conversations",
        "codewhisperer:taskassist",
        "codewhisperer:transformations"
    ];
    
    // Step 1: 注册 OIDC 客户端
    let reg_body = serde_json::json!({
        "clientName": "Kiro Account Manager",
        "clientType": "public",
        "scopes": scopes,
        "grantTypes": ["authorization_code", "refresh_token"],
        "redirectUris": [REDIRECT_URI],
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
    struct RegisterClientResponse { client_id: String, client_secret: String }
    
    let reg_data: RegisterClientResponse = reg_res.json().await
        .map_err(|e| format!("解析注册响应失败: {}", e))?;

    // Step 2: 生成 PKCE 参数和 state
    let (code_verifier, code_challenge) = generate_pkce();
    let state = generate_random_string(32);

    // Step 3: 构建授权 URL
    let authorize_url = format!(
        "{}/authorize?response_type=code&client_id={}&redirect_uri={}&scopes={}&state={}&code_challenge={}&code_challenge_method=S256",
        oidc_base,
        urlencoding::encode(&reg_data.client_id),
        urlencoding::encode(REDIRECT_URI),
        urlencoding::encode(&scopes.join(",")),
        urlencoding::encode(&state),
        urlencoding::encode(&code_challenge)
    );
    
    Ok((authorize_url, BuilderIdAuthState {
        client_id: reg_data.client_id,
        client_secret: reg_data.client_secret,
        code_verifier,
        state,
    }))
}

// 用授权码换取 Token
async fn exchange_code_for_token(
    code: &str,
    auth_state: &BuilderIdAuthState,
) -> Result<(String, String, String, String), String> {
    let client = create_http_client()?;
    
    let token_body = serde_json::json!({
        "clientId": auth_state.client_id,
        "clientSecret": auth_state.client_secret,
        "grantType": "authorization_code",
        "redirectUri": REDIRECT_URI,
        "code": code,
        "codeVerifier": auth_state.code_verifier
    });
    
    let token_res = client
        .post(format!("{}/token", oidc_base_url()))
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
    struct TokenResponse { access_token: String, refresh_token: String }
    
    let token_data: TokenResponse = token_res.json().await
        .map_err(|e| format!("解析 Token 响应失败: {}", e))?;
    
    Ok((
        auth_state.client_id.clone(),
        auth_state.client_secret.clone(),
        token_data.access_token,
        token_data.refresh_token,
    ))
}

#[tauri::command]
pub async fn web_oauth_initiate(provider: String) -> Result<WebOAuthInitResponse, String> {
    if provider != "Google" && provider != "Github" && provider != "BuilderId" {
        return Err(format!("Unsupported provider: {}. Use 'Google', 'Github', or 'BuilderId'", provider));
    }

    let web_provider = WebOAuthProvider::new(&provider);
    let init_result = web_provider.initiate_login().await?;
    
    let response = WebOAuthInitResponse {
        authorize_url: init_result.authorize_url.clone(),
        state: init_result.state.clone(),
    };
    
    *get_pending_login().lock().unwrap() = Some(init_result);
    Ok(response)
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
    
    // BuilderId 应该走专用流程
    if provider == "BuilderId" {
        return Err("BuilderId 请使用专用的 Authorization Code Flow 登录".to_string());
    }

    // Google/Github 继续使用原有流程
    auth_result.csrf_token.as_ref()
        .ok_or("No csrf_token from ExchangeToken")?;

    let portal_client = KiroWebPortalClient::new();
    
    // 获取配额数据，检测封禁状态
    let usage_call = portal_client.get_user_usage_and_limits(
        &auth_result.access_token,
        &init_result.idp,
    ).await;
    
    let (usage, is_banned) = match &usage_call {
        Ok(u) => (Some(u.clone()), false),
        Err(e) if e.starts_with("BANNED:") => (None, true),
        Err(e) => return Err(e.clone()),
    };
    
    let new_email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|u| u.email.clone());
    let user_id = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|u| u.user_id.clone());
    
    // 检测账号状态
    let is_banned = is_banned || portal_client.get_user_info(
        &auth_result.access_token,
        &init_result.idp,
    ).await.map(|info| info.status.as_deref() == Some("Suspended")).unwrap_or(false);
    
    let usage_data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);

    let mut store = state.store.lock().unwrap();
    
    // 查找已有账号
    let existing_idx = if let Some(email) = &new_email {
        store.accounts.iter().position(|a| &a.email == email && a.provider.as_deref() == Some(provider))
    } else {
        let rt = &auth_result.refresh_token;
        store.accounts.iter().position(|a| {
            a.provider.as_deref() == Some(provider) && 
            (a.refresh_token.as_ref() == Some(rt) || a.session_token.as_ref() == Some(rt))
        })
    };
    
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(auth_result.access_token.clone());
        existing.refresh_token = Some(auth_result.refresh_token.clone());
        existing.session_token = None;
        if let Some(email) = &new_email { existing.email = email.clone(); }
        existing.user_id = user_id;
        existing.expires_at = Some(auth_result.expires_at.clone());
        existing.profile_arn = auth_result.profile_arn.clone();
        existing.csrf_token = auth_result.csrf_token.clone();
        existing.usage_data = Some(usage_data);
        existing.status = if is_banned { "banned".to_string() } else { "active".to_string() };
        existing.clone()
    } else {
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

    if account.csrf_token.is_none() {
        return Err("This account is not a Web OAuth account (no csrfToken)".to_string());
    }

    let access_token = account.access_token.as_ref().ok_or("No access_token found")?;
    let csrf_token = account.csrf_token.as_ref().ok_or("No csrf_token found")?;
    let provider = account.provider.as_ref().ok_or("No provider found")?;
    
    let token = if provider == "BuilderId" {
        account.session_token.as_ref().ok_or("No session_token found")?
    } else {
        account.refresh_token.as_ref().ok_or("No refresh_token found")?
    };
    
    let web_provider = WebOAuthProvider::new(provider);
    
    let auth_result = match web_provider.refresh_token_impl(access_token, csrf_token, token).await {
        Ok(result) => result,
        Err(e) if e.starts_with("BANNED:") => {
            let mut store = state.store.lock().unwrap();
            if let Some(a) = store.accounts.iter_mut().find(|a| a.id == account_id) {
                a.status = "banned".to_string();
                let result = a.clone();
                store.save_to_file();
                return Ok(result);
            }
            return Err(e);
        }
        Err(e) => return Err(e),
    };
    
    let portal_client = KiroWebPortalClient::new();
    let usage_call = portal_client.get_user_usage_and_limits(&auth_result.access_token, provider).await;
    
    let (usage, is_banned) = match &usage_call {
        Ok(u) => (Some(u.clone()), false),
        Err(e) if e.starts_with("BANNED:") => (None, true),
        Err(_) => (None, false),
    };
    let usage_data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);

    let mut store = state.store.lock().unwrap();
    if let Some(a) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        a.access_token = Some(auth_result.access_token);
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
        if auth_result.profile_arn.is_some() { a.profile_arn = auth_result.profile_arn; }
        
        let result = a.clone();
        store.save_to_file();
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
    if provider != "Google" && provider != "Github" && provider != "BuilderId" {
        return Err(format!("Unsupported provider: {}. Use 'Google', 'Github', or 'BuilderId'", provider));
    }

    let web_provider = WebOAuthProvider::new(&provider);
    let init_result = web_provider.initiate_login().await?;
    
    *get_pending_login().lock().unwrap() = Some(init_result.clone());
    
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
        if url_str.starts_with("https://app.kiro.dev/signin/oauth") && url_str.contains("code=") {
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
    
    Ok(WebOAuthLoginResponse { window_label, state: init_result.state })
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
    let (authorize_url, auth_state) = prepare_builderid_auth().await?;
    
    *get_builderid_auth_state().lock().unwrap() = Some(auth_state.clone());
    
    let window_label = "oauth_builderid".to_string();
    
    if let Some(existing) = app_handle.get_webview_window(&window_label) {
        let _ = existing.close();
    }
    
    let app_handle_clone = app_handle.clone();
    let window_label_clone = window_label.clone();
    let expected_state = auth_state.state.clone();
    
    let auth_url = authorize_url.parse()
        .map_err(|e| format!("Invalid authorize URL: {}", e))?;
    
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
        
        if url_str.starts_with(REDIRECT_URI) && url_str.contains("code=") {
            if let Ok(parsed_url) = url::Url::parse(url_str) {
                let code = parsed_url.query_pairs().find(|(k, _)| k == "code").map(|(_, v)| v.to_string());
                let returned_state = parsed_url.query_pairs().find(|(k, _)| k == "state").map(|(_, v)| v.to_string());
                
                if let (Some(code), Some(state)) = (code, returned_state) {
                    if state == expected_state {
                        let _ = app_handle_clone.emit("builderid-oauth-callback", code);
                    } else {
                        let _ = app_handle_clone.emit("builderid-oauth-error", "State 不匹配");
                    }
                }
            }
            
            if let Some(win) = app_handle_clone.get_webview_window(&window_label_clone) {
                let _ = win.close();
            }
            return false;
        }
        true
    })
    .build()
    .map_err(|e| format!("Failed to create auth window: {}", e))?;
    
    Ok(WebOAuthLoginResponse { window_label, state: auth_state.state })
}

// BuilderId 回调完成命令
#[tauri::command]
pub async fn web_oauth_builderid_complete(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    code: String,
) -> Result<String, String> {
    let auth_state = {
        let mut guard = get_builderid_auth_state().lock().unwrap();
        guard.take()
    }.ok_or("No pending BuilderId authentication state found")?;
    
    let (client_id, client_secret, access_token, refresh_token) = 
        exchange_code_for_token(&code, &auth_state).await?;
    
    let client = KiroWebPortalClient::new();
    let usage = client.get_user_usage_and_limits(&access_token, "BuilderId").await.ok();
    let usage_data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);
    
    let email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.email.clone())
        .unwrap_or_else(|| super::generate_random_email("BuilderId"));
    
    let user_id = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.user_id.clone());
    
    let client_id_hash = {
        use sha2::{Sha256, Digest};
        hex::encode(Sha256::digest(START_URL.as_bytes()))
    };
    
    let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);
    
    let mut store = state.store.lock().unwrap();
    
    let existing_idx = store.accounts.iter().position(|a| 
        a.email == email && a.provider.as_deref() == Some("BuilderId")
    );
    
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(access_token.clone());
        existing.refresh_token = Some(refresh_token.clone());
        existing.client_id = Some(client_id);
        existing.client_secret = Some(client_secret);
        existing.client_id_hash = Some(client_id_hash);
        existing.region = Some(OIDC_REGION.to_string());
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
        account.client_id = Some(client_id);
        account.client_secret = Some(client_secret);
        account.client_id_hash = Some(client_id_hash);
        account.region = Some(OIDC_REGION.to_string());
        account.expires_at = Some(expires_at.to_rfc3339());
        account.usage_data = Some(usage_data);
        account.user_id = user_id;
        store.accounts.insert(0, account.clone());
        account
    };
    
    store.save_to_file();
    drop(store);
    
    update_auth_state_web(&state, &account.email, "BuilderId", &access_token, &refresh_token);
    
    let _ = app_handle.emit("login-success", account.id.clone());
    Ok(format!("BuilderId 登录成功: {}", account.email))
}