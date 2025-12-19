// Auth 相关命令 - 直接存储 usage_data

use tauri::{Emitter, State};
use crate::state::AppState;
use crate::account::Account;
use crate::auth::{User, get_usage_limits_desktop};
use crate::auth_social;
use crate::codewhisperer_client::CodeWhispererClient;
use crate::providers::{AuthMethod, AuthProvider, get_provider_config, create_social_provider, create_idc_provider};
use crate::commands::machine_guid_cmd::get_machine_id;
use serde::Deserialize;

/// add_kiro_account 命令参数
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddKiroAccountParams {
    pub email: String,
    pub access_token: String,
    pub refresh_token: String,
    pub csrf_token: String,
    pub idp: String,
    pub quota: Option<i32>,
    pub used: Option<i32>,
}

#[tauri::command]
pub fn get_current_user(state: State<AppState>) -> Option<User> {
    state.auth.user.lock().unwrap().clone()
}

#[tauri::command]
pub fn logout(state: State<AppState>) {
    *state.auth.user.lock().unwrap() = None;
    *state.auth.csrf_token.lock().unwrap() = None;
    *state.auth.access_token.lock().unwrap() = None;
}

#[tauri::command]
pub async fn kiro_login(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    provider: String,
) -> Result<String, String> {
    let config = get_provider_config(&provider)
        .ok_or_else(|| format!("Unsupported provider: {}", provider))?;

    match config.auth_method {
        AuthMethod::Social => login_social(app_handle, state, &config).await,
        AuthMethod::Idc => login_idc(app_handle, state, &config).await,
    }
}

async fn login_social(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    config: &crate::providers::ProviderConfig,
) -> Result<String, String> {
    let social_provider = create_social_provider(config);
    let provider_id = social_provider.get_provider_id().to_string();
    let auth_method = social_provider.get_auth_method();
    
    let auth_result = social_provider.login().await?;
    
    // 获取 usage，检测封禁状态
    let usage_call = get_usage_limits_desktop(&auth_result.access_token).await;
    let (usage, is_banned) = match &usage_call {
        Ok(u) => (Some(u.clone()), false),
        Err(e) if e.starts_with("BANNED:") => (None, true),
        Err(_) => (None, false),
    };
    let usage_data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);

    // 从 usage 获取 email
    let new_email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.email.clone());
    let user_id = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.user_id.clone());

    let mut store = state.store.lock().unwrap();
    
    // 查找已有账号：优先用邮箱匹配，否则用 refresh_token 匹配
    let existing_idx = if let Some(email) = &new_email {
        store.accounts.iter().position(|a| &a.email == email && a.provider.as_deref() == Some(&provider_id))
    } else {
        // 被封禁时无法获取邮箱，尝试用 refresh_token 匹配
        let rt = &auth_result.refresh_token;
        store.accounts.iter().position(|a| {
            a.provider.as_deref() == Some(&provider_id) && a.refresh_token.as_ref() == Some(rt)
        })
    };
    
    // 更新或新建账号
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        // 更新现有账号，保留原有邮箱
        existing.access_token = Some(auth_result.access_token.clone());
        existing.refresh_token = Some(auth_result.refresh_token.clone());
        // 如果获取到了新邮箱，更新它
        if let Some(email) = &new_email {
            existing.email = email.clone();
        }
        existing.user_id = user_id;
        existing.expires_at = Some(auth_result.expires_at.clone());
        existing.profile_arn = auth_result.profile_arn;
        existing.label = format!("Kiro {} 账号", provider_id);
        // 不覆盖 csrfToken，保留 Web OAuth 的
        existing.usage_data = Some(usage_data);
        existing.status = if is_banned { "banned".to_string() } else { "active".to_string() };
        existing.clone()
    } else {
        // 新建账号
        let email = new_email.unwrap_or_else(|| super::generate_random_email(&provider_id));
        let mut account = Account::new(email.clone(), format!("Kiro {} 账号", provider_id));
        account.access_token = Some(auth_result.access_token.clone());
        account.refresh_token = Some(auth_result.refresh_token.clone());
        account.provider = Some(provider_id.clone());
        account.user_id = user_id;
        account.expires_at = Some(auth_result.expires_at.clone());
        account.profile_arn = auth_result.profile_arn;
        account.csrf_token = auth_result.csrf_token;
        account.usage_data = Some(usage_data);
        account.status = if is_banned { "banned".to_string() } else { "active".to_string() };
        store.accounts.insert(0, account.clone());
        account
    };
    
    let final_email = account.email.clone();
    
    store.save_to_file();
    drop(store);

    update_auth_state(&state, &final_email, &provider_id, &auth_result.access_token, &auth_result.refresh_token);
    println!("\n[{}] LOGIN SUCCESS: {}", auth_method, account.email);

    let _ = app_handle.emit("login-success", account.id.clone());
    Ok(format!("{} login completed for {}", auth_method, provider_id))
}

async fn login_idc(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    config: &crate::providers::ProviderConfig,
) -> Result<String, String> {
    let idc_provider = create_idc_provider(config);
    let provider_id = idc_provider.get_provider_id().to_string();
    let auth_method = idc_provider.get_auth_method();
    
    let auth_result = idc_provider.login().await?;

    let machine_id = get_machine_id();
    let cw_client = CodeWhispererClient::new(&machine_id);
    let usage_call = cw_client.get_usage_limits(&auth_result.access_token).await;
    let (usage, is_banned) = match &usage_call {
        Ok(u) => (Some(u.clone()), false),
        Err(e) if e.starts_with("BANNED:") => (None, true),
        Err(_) => (None, false),
    };
    let usage_data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);

    let new_email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.email.clone());
    let user_id = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.user_id.clone());

    let mut store = state.store.lock().unwrap();
    
    // 查找已有账号：优先用邮箱匹配，否则用 refresh_token 匹配
    let existing_idx = if let Some(email) = &new_email {
        store.accounts.iter().position(|a| &a.email == email && a.provider.as_deref() == Some(&provider_id))
    } else {
        let rt = &auth_result.refresh_token;
        store.accounts.iter().position(|a| {
            a.provider.as_deref() == Some(&provider_id) && a.refresh_token.as_ref() == Some(rt)
        })
    };
    
    // 更新或新建账号
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(auth_result.access_token.clone());
        existing.refresh_token = Some(auth_result.refresh_token.clone());
        if let Some(email) = &new_email {
            existing.email = email.clone();
        }
        existing.user_id = user_id;
        existing.expires_at = Some(auth_result.expires_at.clone());
        existing.client_id_hash = auth_result.client_id_hash;
        existing.client_id = auth_result.client_id;
        existing.client_secret = auth_result.client_secret;
        existing.region = auth_result.region;
        existing.sso_session_id = auth_result.sso_session_id;
        existing.id_token = auth_result.id_token;
        existing.profile_arn = auth_result.profile_arn;
        existing.usage_data = Some(usage_data);
        existing.status = if is_banned { "banned".to_string() } else { "active".to_string() };
        existing.clone()
    } else {
        let email = new_email.unwrap_or_else(|| super::generate_random_email("BuilderId"));
        let mut account = Account::new(email.clone(), format!("Kiro {} 账号", provider_id));
        account.access_token = Some(auth_result.access_token.clone());
        account.refresh_token = Some(auth_result.refresh_token.clone());
        account.provider = Some(provider_id.clone());
        account.user_id = user_id;
        account.expires_at = Some(auth_result.expires_at.clone());
        account.client_id_hash = auth_result.client_id_hash;
        account.client_id = auth_result.client_id;
        account.client_secret = auth_result.client_secret;
        account.region = auth_result.region;
        account.sso_session_id = auth_result.sso_session_id;
        account.id_token = auth_result.id_token;
        account.profile_arn = auth_result.profile_arn;
        account.usage_data = Some(usage_data);
        account.status = if is_banned { "banned".to_string() } else { "active".to_string() };
        store.accounts.insert(0, account.clone());
        account
    };
    
    let final_email = account.email.clone();
    store.save_to_file();
    drop(store);

    update_auth_state(&state, &final_email, &provider_id, &auth_result.access_token, &auth_result.refresh_token);
    println!("\n[{}] LOGIN SUCCESS: {}", auth_method, account.email);

    let _ = app_handle.emit("login-success", account.id.clone());
    Ok(format!("{} login completed for {}", auth_method, final_email))
}

fn update_auth_state(state: &State<'_, AppState>, email: &str, provider: &str, access_token: &str, refresh_token: &str) {
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
    *state.pending_login.lock().unwrap() = None;
}

#[tauri::command]
pub async fn handle_kiro_social_callback(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    code: String,
    callback_state: String,
) -> Result<(), String> {
    let pending = {
        let lock = state.pending_login.lock().unwrap();
        lock.clone().ok_or("No pending login found")?
    };
    
    if pending.state != callback_state {
        return Err("State mismatch".to_string());
    }
    
    let redirect_uri = "kiro://app/callback";
    let token_response = auth_social::exchange_social_code_for_token(
        &code, &pending.code_verifier, redirect_uri, &pending.machineid,
    ).await?;
    
    let usage_call = get_usage_limits_desktop(&token_response.access_token).await;
    let (usage, is_banned) = match &usage_call {
        Ok(u) => (Some(u.clone()), false),
        Err(e) if e.starts_with("BANNED:") => (None, true),
        Err(_) => (None, false),
    };
    let usage_data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);
    
    let new_email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.email.clone());
    let user_id = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.user_id.clone());

    let mut store = state.store.lock().unwrap();
    
    // 查找已有账号：优先用邮箱匹配，否则用 refresh_token 匹配
    let existing_idx = if let Some(email) = &new_email {
        store.accounts.iter().position(|a| &a.email == email && a.provider.as_deref() == Some(&pending.provider))
    } else {
        let rt = &token_response.refresh_token;
        store.accounts.iter().position(|a| {
            a.provider.as_deref() == Some(&pending.provider) && a.refresh_token.as_ref() == Some(rt)
        })
    };
    
    // 更新或新建账号
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(token_response.access_token.clone());
        existing.refresh_token = Some(token_response.refresh_token.clone());
        if let Some(email) = &new_email {
            existing.email = email.clone();
        }
        existing.user_id = user_id;
        existing.usage_data = Some(usage_data);
        existing.status = if is_banned { "banned".to_string() } else { "active".to_string() };
        existing.clone()
    } else {
        let email = new_email.unwrap_or_else(|| super::generate_random_email(&pending.provider));
        let mut account = Account::new(email.clone(), format!("Kiro {} 账号", pending.provider));
        account.access_token = Some(token_response.access_token.clone());
        account.refresh_token = Some(token_response.refresh_token.clone());
        account.provider = Some(pending.provider.clone());
        account.user_id = user_id;
        account.usage_data = Some(usage_data);
        account.status = if is_banned { "banned".to_string() } else { "active".to_string() };
        store.accounts.insert(0, account.clone());
        account
    };
    
    let final_email = account.email.clone();
    store.save_to_file();
    drop(store);
    
    update_auth_state(&state, &final_email, &pending.provider, &token_response.access_token, &token_response.refresh_token);
    let _ = app_handle.emit("login-success", account.id);
    println!("Social callback login completed: {}", final_email);
    Ok(())
}

#[tauri::command]
pub async fn add_kiro_account(
    state: State<'_, AppState>,
    params: AddKiroAccountParams,
) -> Result<Account, String> {
    let AddKiroAccountParams {
        email,
        access_token,
        refresh_token,
        csrf_token,
        idp,
        quota,
        used,
    } = params;
    
    println!("Adding Kiro account: email={}, idp={}, quota={:?}, used={:?}", email, idp, quota, used);
    
    let (usage, is_banned) = if !access_token.is_empty() {
        let usage_call = get_usage_limits_desktop(&access_token).await;
        match &usage_call {
            Ok(u) => (Some(u.clone()), false),
            Err(e) if e.starts_with("BANNED:") => (None, true),
            Err(_) => (None, false),
        }
    } else {
        (None, false)
    };
    let usage_data = serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null);
    
    // 从 usage 获取邮箱，如果获取不到则使用传入的 email
    let new_email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.email.clone());
    let user_id = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|ui| ui.user_id.clone());

    *state.auth.access_token.lock().unwrap() = Some(access_token.clone());
    *state.auth.refresh_token.lock().unwrap() = Some(refresh_token.clone());
    *state.auth.csrf_token.lock().unwrap() = Some(csrf_token.clone());
    
    let mut store = state.store.lock().unwrap();
    
    // 查找已有账号：优先用新邮箱匹配，其次用传入的邮箱，最后用 refresh_token
    let existing_idx = if let Some(e) = &new_email {
        store.accounts.iter().position(|a| &a.email == e && a.provider.as_deref() == Some(&idp))
    } else {
        // 先尝试用传入的邮箱匹配
        store.accounts.iter().position(|a| a.email == email && a.provider.as_deref() == Some(&idp))
            .or_else(|| {
                // 再尝试用 refresh_token 匹配
                store.accounts.iter().position(|a| {
                    a.provider.as_deref() == Some(&idp) && a.refresh_token.as_ref() == Some(&refresh_token)
                })
            })
    };
    
    // 更新或新建账号
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(access_token.clone());
        existing.refresh_token = Some(refresh_token.clone());
        // 如果获取到了新邮箱，更新它
        if let Some(e) = &new_email {
            existing.email = e.clone();
        }
        existing.user_id = user_id;
        existing.csrf_token = Some(csrf_token.clone());
        existing.usage_data = Some(usage_data);
        existing.status = if is_banned { "banned".to_string() } else { "active".to_string() };
        existing.clone()
    } else {
        let final_email = new_email.unwrap_or(email.clone());
        let mut account = Account::new(final_email.clone(), format!("Kiro {} 账号", idp));
        account.access_token = Some(access_token.clone());
        account.refresh_token = Some(refresh_token.clone());
        account.provider = Some(idp.clone());
        account.user_id = user_id;
        account.csrf_token = Some(csrf_token.clone());
        account.usage_data = Some(usage_data);
        account.status = if is_banned { "banned".to_string() } else { "active".to_string() };
        store.accounts.insert(0, account.clone());
        account
    };
    
    let final_email = account.email.clone();
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: final_email.clone(),
        name: final_email.split('@').next().unwrap_or("User").to_string(),
        avatar: None,
        provider: idp.clone(),
    };
    *state.auth.user.lock().unwrap() = Some(user);
    *state.pending_login.lock().unwrap() = None;
    
    store.save_to_file();
    
    Ok(account)
}

#[tauri::command]
pub fn get_supported_providers() -> Vec<&'static str> {
    crate::providers::get_supported_providers()
}
