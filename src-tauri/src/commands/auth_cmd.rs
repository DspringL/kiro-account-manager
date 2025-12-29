// Auth 相关命令 - 直接存储 usage_data

use tauri::{Emitter, State};
use crate::state::AppState;
use crate::account::Account;
use crate::auth::User;
use crate::auth_social;
use crate::providers::{AuthMethod, AuthProvider, get_provider_config, create_social_provider, create_idc_provider};
use crate::commands::common::{get_usage_by_provider, extract_user_info, find_existing_account_idx, calc_status};
use serde::Deserialize;

/// add_kiro_account 命令参数
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]  // quota 和 used 保留用于兼容旧版前端
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
    
    let usage_result = get_usage_by_provider(&provider_id, &auth_result.access_token).await;
    let usage: Option<crate::providers::web_oauth::GetUserUsageAndLimitsResponse> = 
        serde_json::from_value(usage_result.usage_data.clone()).ok();
    let (new_email, user_id) = extract_user_info(&usage);

    let mut store = state.store.lock().unwrap();
    let existing_idx = find_existing_account_idx(&store.accounts, &new_email, &provider_id, &auth_result.refresh_token);
    
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(auth_result.access_token.clone());
        existing.refresh_token = Some(auth_result.refresh_token.clone());
        if let Some(email) = &new_email { existing.email = email.clone(); }
        existing.user_id = user_id;
        existing.expires_at = Some(auth_result.expires_at.clone());
        existing.profile_arn = auth_result.profile_arn;
        existing.label = format!("Kiro {} 账号", provider_id);
        existing.usage_data = Some(usage_result.usage_data);
        existing.status = calc_status(usage_result.is_banned);
        existing.clone()
    } else {
        let email = new_email.unwrap_or_else(|| super::generate_random_email(&provider_id));
        let mut account = Account::new(email.clone(), format!("Kiro {} 账号", provider_id));
        account.access_token = Some(auth_result.access_token.clone());
        account.refresh_token = Some(auth_result.refresh_token.clone());
        account.provider = Some(provider_id.clone());
        account.user_id = user_id;
        account.expires_at = Some(auth_result.expires_at.clone());
        account.profile_arn = auth_result.profile_arn;
        account.csrf_token = auth_result.csrf_token;
        account.usage_data = Some(usage_result.usage_data);
        account.status = calc_status(usage_result.is_banned);
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

    let usage_result = get_usage_by_provider(&provider_id, &auth_result.access_token).await;
    let usage: Option<crate::providers::web_oauth::GetUserUsageAndLimitsResponse> = 
        serde_json::from_value(usage_result.usage_data.clone()).ok();
    let (new_email, user_id) = extract_user_info(&usage);

    let mut store = state.store.lock().unwrap();
    let existing_idx = find_existing_account_idx(&store.accounts, &new_email, &provider_id, &auth_result.refresh_token);
    
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(auth_result.access_token.clone());
        existing.refresh_token = Some(auth_result.refresh_token.clone());
        if let Some(email) = &new_email { existing.email = email.clone(); }
        existing.user_id = user_id;
        existing.expires_at = Some(auth_result.expires_at.clone());
        existing.client_id_hash = auth_result.client_id_hash;
        existing.client_id = auth_result.client_id;
        existing.client_secret = auth_result.client_secret;
        existing.region = auth_result.region;
        existing.sso_session_id = auth_result.sso_session_id;
        existing.id_token = auth_result.id_token;
        existing.profile_arn = auth_result.profile_arn;
        existing.usage_data = Some(usage_result.usage_data);
        existing.status = calc_status(usage_result.is_banned);
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
        account.usage_data = Some(usage_result.usage_data);
        account.status = calc_status(usage_result.is_banned);
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
    
    let usage_result = get_usage_by_provider(&pending.provider, &token_response.access_token).await;
    let usage: Option<crate::providers::web_oauth::GetUserUsageAndLimitsResponse> = 
        serde_json::from_value(usage_result.usage_data.clone()).ok();
    let (new_email, user_id) = extract_user_info(&usage);

    let mut store = state.store.lock().unwrap();
    let existing_idx = find_existing_account_idx(&store.accounts, &new_email, &pending.provider, &token_response.refresh_token);
    
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(token_response.access_token.clone());
        existing.refresh_token = Some(token_response.refresh_token.clone());
        if let Some(email) = &new_email { existing.email = email.clone(); }
        existing.user_id = user_id;
        existing.usage_data = Some(usage_result.usage_data);
        existing.status = calc_status(usage_result.is_banned);
        existing.clone()
    } else {
        let email = new_email.unwrap_or_else(|| super::generate_random_email(&pending.provider));
        let mut account = Account::new(email.clone(), format!("Kiro {} 账号", pending.provider));
        account.access_token = Some(token_response.access_token.clone());
        account.refresh_token = Some(token_response.refresh_token.clone());
        account.provider = Some(pending.provider.clone());
        account.user_id = user_id;
        account.usage_data = Some(usage_result.usage_data);
        account.status = calc_status(usage_result.is_banned);
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
    let AddKiroAccountParams { email, access_token, refresh_token, csrf_token, idp, quota: _, used: _ } = params;
    
    println!("Adding Kiro account: email={}, idp={}", email, idp);
    
    let usage_result = if !access_token.is_empty() {
        get_usage_by_provider(&idp, &access_token).await
    } else {
        crate::commands::common::UsageResult { usage_data: serde_json::Value::Null, is_banned: false, is_auth_error: false }
    };
    let usage: Option<crate::providers::web_oauth::GetUserUsageAndLimitsResponse> = 
        serde_json::from_value(usage_result.usage_data.clone()).ok();
    let (new_email, user_id) = extract_user_info(&usage);

    *state.auth.access_token.lock().unwrap() = Some(access_token.clone());
    *state.auth.refresh_token.lock().unwrap() = Some(refresh_token.clone());
    *state.auth.csrf_token.lock().unwrap() = Some(csrf_token.clone());
    
    let mut store = state.store.lock().unwrap();
    
    // 查找已有账号
    let existing_idx = if let Some(e) = &new_email {
        store.accounts.iter().position(|a| &a.email == e && a.provider.as_deref() == Some(&idp))
    } else {
        store.accounts.iter().position(|a| a.email == email && a.provider.as_deref() == Some(&idp))
            .or_else(|| find_existing_account_idx(&store.accounts, &None, &idp, &refresh_token))
    };
    
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(access_token.clone());
        existing.refresh_token = Some(refresh_token.clone());
        if let Some(e) = &new_email { existing.email = e.clone(); }
        existing.user_id = user_id;
        existing.csrf_token = Some(csrf_token.clone());
        existing.usage_data = Some(usage_result.usage_data);
        existing.status = calc_status(usage_result.is_banned);
        existing.clone()
    } else {
        let final_email = new_email.unwrap_or(email.clone());
        let mut account = Account::new(final_email.clone(), format!("Kiro {} 账号", idp));
        account.access_token = Some(access_token.clone());
        account.refresh_token = Some(refresh_token.clone());
        account.provider = Some(idp.clone());
        account.user_id = user_id;
        account.csrf_token = Some(csrf_token.clone());
        account.usage_data = Some(usage_result.usage_data);
        account.status = calc_status(usage_result.is_banned);
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
