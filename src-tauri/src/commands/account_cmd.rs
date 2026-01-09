// 账号相关命令 - 直接存储原始 usage_data

use tauri::State;
use crate::state::AppState;
use crate::account::Account;
use crate::auth::{User, refresh_token_desktop};
use crate::providers::{AuthProvider, IdcProvider, RefreshMetadata, KiroPortalClient};
use crate::kiro_portal_client::GetUserUsageAndLimitsResponse;
use crate::commands::common::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifyAccountResponse {
    #[serde(rename = "usageLimit")]
    pub usage_limit: Option<i32>,
    #[serde(rename = "currentUsage")]
    pub current_usage: Option<i32>,
    #[serde(rename = "subscriptionType")]
    pub subscription_type: Option<String>,
    #[serde(rename = "accessToken")]
    pub access_token: String,
    #[serde(rename = "refreshToken")]
    pub refresh_token: String,
}

/// verify_account 命令参数
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]  // access_token 和 csrf_token 保留用于未来扩展
pub struct VerifyAccountParams {
    pub access_token: String,
    pub refresh_token: String,
    pub csrf_token: Option<String>,
    pub provider: String,
    pub client_id: Option<String>,
    pub client_secret: Option<String>,
    pub region: Option<String>,
}

#[tauri::command]
pub fn get_accounts(state: State<AppState>) -> Vec<Account> {
    let mut store = state.store.lock().unwrap();
    // 每次获取前重新从文件加载，确保数据最新
    store.reload();
    store.get_all()
}

#[tauri::command]
pub fn delete_account(state: State<AppState>, id: String) -> bool {
    state.store.lock().unwrap().delete(&id)
}

#[tauri::command]
pub fn delete_accounts(state: State<AppState>, ids: Vec<String>) -> usize {
    state.store.lock().unwrap().delete_many(&ids)
}

#[tauri::command]
pub async fn sync_account(state: State<'_, AppState>, id: String) -> Result<Account, String> {
    let account = {
        let store = state.store.lock().unwrap();
        store.accounts.iter().find(|a| a.id == id).cloned()
    }.ok_or("Account not found")?;

    let provider_str = account.provider.as_deref().unwrap_or("Google");
    let access_token = account.access_token.as_ref().ok_or("No access token")?;
    
    // 先尝试用现有 token 获取配额
    let mut usage_result = get_usage_by_provider(provider_str, access_token).await;
    let mut refresh_result: Option<RefreshResult> = None;
    
    // 如果是认证错误，刷新 token 后重试
    let needs_refresh = match &usage_result {
        Ok(r) => r.is_auth_error,
        Err(_) => false,
    };
    
    if needs_refresh {
        match refresh_token_by_provider(&account).await {
            Ok(refreshed) => {
                usage_result = get_usage_by_provider(provider_str, &refreshed.access_token).await;
                refresh_result = Some(refreshed);
            }
            Err(e) => {
                // 刷新失败，检查是否封禁
                if e.starts_with("BANNED:") {
                    let mut store = state.store.lock().unwrap();
                    if let Some(a) = store.accounts.iter_mut().find(|a| a.id == id) {
                        a.status = "banned".to_string();
                        store.save_to_file();
                    }
                }
                return Err(e);
            }
        }
    }
    
    // 获取配额失败时直接返回错误
    let usage = usage_result?;

    let mut store = state.store.lock().unwrap();
    if let Some(a) = store.accounts.iter_mut().find(|a| a.id == id) {
        // 如果刷新了 token，更新 token 相关字段
        if let Some(ref result) = refresh_result {
            a.access_token = Some(result.access_token.clone());
            if let Some(ref rt) = result.refresh_token { a.refresh_token = Some(rt.clone()); }
            if let Some(ref arn) = result.profile_arn { a.profile_arn = Some(arn.clone()); }
            if let Some(ref id_token) = result.id_token { a.id_token = Some(id_token.clone()); }
            if let Some(ref session_id) = result.sso_session_id { a.sso_session_id = Some(session_id.clone()); }
            a.expires_at = Some(calc_expires_at(result.expires_in));
        }
        // 更新 usage 数据
        a.usage_data = Some(usage.usage_data.clone());
        a.status = calc_status(usage.is_banned);
        
        let result = a.clone();
        store.save_to_file();
        return Ok(result);
    }
    Err("Account not found after update".to_string())
}

/// 只刷新 token，不获取 usage（启动时快速刷新用）
/// 如果 token 还有 5 分钟以上有效期，跳过刷新直接返回
#[tauri::command]
pub async fn refresh_account_token(state: State<'_, AppState>, id: String) -> Result<Account, String> {
    let account = {
        let store = state.store.lock().unwrap();
        store.accounts.iter().find(|a| a.id == id).cloned()
    }.ok_or("Account not found")?;

    // 检查 token 是否还有 5 分钟以上有效期
    if let Some(expires_at) = &account.expires_at {
        if let Ok(exp) = chrono::NaiveDateTime::parse_from_str(expires_at, "%Y/%m/%d %H:%M:%S") {
            let now = chrono::Local::now().naive_local();
            let remaining = exp.signed_duration_since(now);
            if remaining.num_minutes() >= 5 {
                return Ok(account);
            }
        }
    }

    let refresh_result = refresh_token_by_provider(&account).await?;

    let mut store = state.store.lock().unwrap();
    if let Some(a) = store.accounts.iter_mut().find(|a| a.id == id) {
        a.access_token = Some(refresh_result.access_token);
        if let Some(rt) = refresh_result.refresh_token { a.refresh_token = Some(rt.clone()); }
        a.expires_at = Some(calc_expires_at(refresh_result.expires_in));
        let result = a.clone();
        store.save_to_file();
        return Ok(result);
    }
    Err("Account not found after update".to_string())
}

#[tauri::command]
pub async fn verify_account(
    state: State<'_, AppState>,
    params: VerifyAccountParams,
) -> Result<VerifyAccountResponse, String> {
    let VerifyAccountParams {
        access_token: _,
        refresh_token,
        csrf_token: _,
        provider,
        client_id,
        client_secret,
        region,
    } = params;
    
    let is_idc = provider == "BuilderId" || provider == "Enterprise";
    
    // 刷新 token
    let (new_access_token, new_refresh_token) = if is_idc {
        let (cid, csec, reg) = if client_id.is_some() && client_secret.is_some() {
            (client_id, client_secret, region)
        } else {
            let store = state.store.lock().unwrap();
            store.accounts.iter().find(|a| a.refresh_token.as_ref() == Some(&refresh_token))
                .map(|a| (a.client_id.clone(), a.client_secret.clone(), a.region.clone()))
                .unwrap_or((None, None, None))
        };
        
        let cid = cid.ok_or("IdC 账号缺少 client_id，请重新添加账号")?;
        let csec = csec.ok_or("IdC 账号缺少 client_secret，请重新添加账号")?;
        let metadata = RefreshMetadata {
            client_id: Some(cid), client_secret: Some(csec), region: reg.clone(), ..Default::default()
        };
        
        let idc_provider = IdcProvider::new(&provider, reg.as_deref().unwrap_or("us-east-1"), None);
        let auth = idc_provider.refresh_token(&refresh_token, metadata).await?;
        (auth.access_token, auth.refresh_token)
    } else {
        let auth = refresh_token_desktop(&refresh_token).await?;
        (auth.access_token, auth.refresh_token)
    };
    
    // 获取 usage（统一逻辑）
    let client = KiroPortalClient::new();
    let usage = client.get_user_usage_and_limits(&new_access_token, &provider).await?;
    let (quota, used, subscription_type) = extract_quota(&usage);
    
    // 更新数据库
    {
        let mut store = state.store.lock().unwrap();
        if let Some(account) = store.accounts.iter_mut().find(|a| a.refresh_token.as_ref() == Some(&refresh_token)) {
            account.access_token = Some(new_access_token.clone());
            account.refresh_token = Some(new_refresh_token.clone());
            store.save_to_file();
        }
    }
    
    Ok(VerifyAccountResponse {
        usage_limit: quota,
        current_usage: used,
        subscription_type,
        access_token: new_access_token,
        refresh_token: new_refresh_token,
    })
}

#[tauri::command]
pub async fn add_account_by_social(
    state: State<'_, AppState>,
    refresh_token: String,
    provider: Option<String>,
    machine_id: Option<String>,
    access_token: Option<String>,
) -> Result<Account, String> {
    let idp = provider.clone().unwrap_or_else(|| "Google".to_string());
    
    // 先尝试用传入的 access_token 获取配额
    let (final_access_token, final_refresh_token, usage_result) = if let Some(at) = access_token {
        match get_usage_by_provider(&idp, &at).await {
            Ok(result) if result.is_auth_error => {
                // 401 了，刷新 token
                let refresh_result = refresh_token_desktop(&refresh_token).await?;
                let new_usage = get_usage_by_provider(&idp, &refresh_result.access_token).await?;
                (refresh_result.access_token, refresh_result.refresh_token, new_usage)
            }
            Ok(result) => (at, refresh_token.clone(), result),
            Err(e) => return Err(e),
        }
    } else {
        // 没有 access_token，直接刷新
        let refresh_result = refresh_token_desktop(&refresh_token).await?;
        let usage_result = get_usage_by_provider(&idp, &refresh_result.access_token).await?;
        (refresh_result.access_token, refresh_result.refresh_token, usage_result)
    };
    
    // 封禁账号直接报错
    if usage_result.is_banned {
        return Err("BANNED: 账号已被封禁".to_string());
    }
    
    let usage: Option<GetUserUsageAndLimitsResponse> = 
        serde_json::from_value(usage_result.usage_data.clone()).ok();
    
    let (new_email, user_id) = extract_user_info(&usage);
    
    // 获取不到邮箱直接报错
    let final_email = new_email.ok_or("获取邮箱失败，请检查账号状态")?;
    
    // 根据邮箱推断最终 provider
    let idp = provider.unwrap_or_else(|| {
        if final_email.contains("gmail") { "Google".to_string() } 
        else if final_email.contains("github") { "Github".to_string() } 
        else { "Google".to_string() }
    });
    
    let mut store = state.store.lock().unwrap();
    let existing_idx = find_existing_account_idx(&store.accounts, &Some(final_email.clone()), &idp, &refresh_token);
    
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(final_access_token.clone());
        existing.refresh_token = Some(final_refresh_token.clone());
        existing.user_id = user_id;
        existing.usage_data = Some(usage_result.usage_data);
        existing.status = calc_status(usage_result.is_banned);
        existing.clone()
    } else {
        let mut account = Account::new(final_email.clone(), format!("Kiro {} 账号", idp));
        account.access_token = Some(final_access_token.clone());
        account.refresh_token = Some(final_refresh_token.clone());
        account.provider = Some(idp.clone());
        account.auth_method = Some("social".to_string());
        account.user_id = user_id;
        account.usage_data = Some(usage_result.usage_data);
        account.status = calc_status(usage_result.is_banned);
        // 使用传入的 machine_id，没有则自动生成
        account.machine_id = Some(machine_id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string().to_lowercase()));
        store.accounts.insert(0, account.clone());
        account
    };
    
    store.save_to_file();
    drop(store);
    
    let user = User {
        id: uuid::Uuid::new_v4().to_string(),
        email: account.email.clone(),
        name: account.email.split('@').next().unwrap_or("User").to_string(),
        avatar: None,
        provider: idp,
    };
    *state.auth.user.lock().unwrap() = Some(user);
    *state.auth.access_token.lock().unwrap() = Some(final_access_token);
    
    Ok(account)
}

#[tauri::command]
pub fn import_accounts(state: State<AppState>, json: String) -> Result<usize, String> {
    state.store.lock().unwrap().import_from_json(&json)
}

#[tauri::command]
pub fn export_accounts(state: State<AppState>, ids: Option<Vec<String>>) -> String {
    let store = state.store.lock().unwrap();
    match ids {
        Some(id_list) if !id_list.is_empty() => {
            // 导出选中的账号
            let selected: Vec<&Account> = store.accounts.iter()
                .filter(|a| id_list.contains(&a.id))
                .collect();
            serde_json::to_string_pretty(&selected).unwrap_or_else(|_| "[]".to_string())
        }
        _ => {
            // 导出全部
            store.export_to_json()
        }
    }
}

/// 添加本地 Kiro IDE 账号
#[tauri::command]
pub async fn add_local_kiro_account(state: State<'_, AppState>) -> Result<Account, String> {
    use crate::kiro::{get_kiro_local_token, get_client_registration};
    
    let local_token = get_kiro_local_token().await
        .ok_or("未找到本地 Kiro 账号，请先在 Kiro IDE 中登录")?;
    
    let refresh_token = local_token.refresh_token
        .ok_or("本地账号缺少 refresh_token")?;
    
    let auth_method = local_token.auth_method.as_deref().unwrap_or("social");
    let provider = local_token.provider.clone().unwrap_or_else(|| "Google".to_string());
    
    // 根据 auth_method 调用对应的添加函数
    if auth_method == "IdC" {
        let hash = local_token.client_id_hash.clone()
            .ok_or("IdC 账号缺少 clientIdHash")?;
        let region = local_token.region.clone().unwrap_or_else(|| "us-east-1".to_string());
        
        let client_reg = get_client_registration(&hash).await
            .ok_or(format!("未找到客户端注册信息: {}.json", hash))?;
        
        add_account_by_idc(
            state,
            refresh_token,
            client_reg.client_id,
            client_reg.client_secret,
            Some(region),
            None, // 本地导入不指定 machine_id，自动生成
            local_token.access_token.clone(), // 传入 access_token
            None, // 本地导入无密码
        ).await
    } else {
        add_account_by_social(
            state,
            refresh_token,
            Some(provider),
            None, // 本地导入不指定 machine_id，自动生成
            local_token.access_token.clone(), // 传入 access_token
        ).await
    }
}

/// 手动添加 BuilderId 账号
#[tauri::command]
pub async fn add_account_by_idc(
    state: State<'_, AppState>,
    refresh_token: String,
    client_id: String,
    client_secret: String,
    region: Option<String>,
    machine_id: Option<String>,
    access_token: Option<String>,
    password: Option<String>,
) -> Result<Account, String> {
    let region = region.unwrap_or_else(|| "us-east-1".to_string());
    
    // 先尝试用传入的 access_token 获取配额
    let (final_access_token, final_refresh_token, usage_result, expires_at, id_token, sso_session_id) = 
        if let Some(at) = access_token {
            match get_usage_by_provider("BuilderId", &at).await {
                Ok(result) if result.is_auth_error => {
                    // 401 了，刷新 token
                    let metadata = RefreshMetadata {
                        client_id: Some(client_id.clone()),
                        client_secret: Some(client_secret.clone()),
                        region: Some(region.clone()),
                        ..Default::default()
                    };
                    let idc_provider = IdcProvider::new("BuilderId", &region, None);
                    let auth_result = idc_provider.refresh_token(&refresh_token, metadata).await?;
                    let new_usage = get_usage_by_provider("BuilderId", &auth_result.access_token).await?;
                    let expires_at = calc_expires_at(auth_result.expires_in);
                    (auth_result.access_token, auth_result.refresh_token, new_usage, expires_at, auth_result.id_token, auth_result.sso_session_id)
                }
                Ok(result) => {
                    // access_token 有效，不需要刷新
                    (at, refresh_token.clone(), result, String::new(), None, None)
                }
                Err(e) => return Err(e),
            }
        } else {
            // 没有 access_token，直接刷新
            let metadata = RefreshMetadata {
                client_id: Some(client_id.clone()),
                client_secret: Some(client_secret.clone()),
                region: Some(region.clone()),
                ..Default::default()
            };
            let idc_provider = IdcProvider::new("BuilderId", &region, None);
            let auth_result = idc_provider.refresh_token(&refresh_token, metadata).await?;
            let usage_result = get_usage_by_provider("BuilderId", &auth_result.access_token).await?;
            let expires_at = calc_expires_at(auth_result.expires_in);
            (auth_result.access_token, auth_result.refresh_token, usage_result, expires_at, auth_result.id_token, auth_result.sso_session_id)
        };
    
    // 封禁账号直接报错
    if usage_result.is_banned {
        return Err("BANNED: 账号已被封禁".to_string());
    }
    
    let usage: Option<GetUserUsageAndLimitsResponse> = 
        serde_json::from_value(usage_result.usage_data.clone()).ok();
    
    let (new_email, user_id) = extract_user_info(&usage);
    
    // 获取不到邮箱直接报错
    let final_email = new_email.ok_or("获取邮箱失败，请检查账号状态")?;
    
    let client_id_hash = calc_client_id_hash();
    
    let mut store = state.store.lock().unwrap();
    let existing_idx = find_existing_account_idx(&store.accounts, &Some(final_email.clone()), "BuilderId", &refresh_token);
    
    let account = if let Some(idx) = existing_idx {
        let existing = &mut store.accounts[idx];
        existing.access_token = Some(final_access_token);
        existing.refresh_token = Some(final_refresh_token);
        existing.user_id = user_id;
        if !expires_at.is_empty() {
            existing.expires_at = Some(expires_at);
        }
        existing.client_id = Some(client_id);
        existing.client_secret = Some(client_secret);
        existing.region = Some(region);
        existing.client_id_hash = Some(client_id_hash);
        if id_token.is_some() {
            existing.id_token = id_token;
        }
        if sso_session_id.is_some() {
            existing.sso_session_id = sso_session_id;
        }
        existing.usage_data = Some(usage_result.usage_data);
        existing.status = calc_status(usage_result.is_banned);
        existing.clone()
    } else {
        let mut account = Account::new(final_email, "Kiro BuilderId 账号".to_string());
        account.access_token = Some(final_access_token);
        account.refresh_token = Some(final_refresh_token);
        account.provider = Some("BuilderId".to_string());
        account.auth_method = Some("IdC".to_string());
        account.user_id = user_id;
        if !expires_at.is_empty() {
            account.expires_at = Some(expires_at);
        }
        account.client_id = Some(client_id);
        account.client_secret = Some(client_secret);
        account.region = Some(region);
        account.client_id_hash = Some(client_id_hash);
        account.id_token = id_token;
        account.sso_session_id = sso_session_id;
        account.usage_data = Some(usage_result.usage_data);
        account.status = calc_status(usage_result.is_banned);
        account.machine_id = Some(machine_id.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string().to_lowercase()));
        account.password = password.clone();
        store.accounts.insert(0, account.clone());
        account
    };
    
    store.save_to_file();
    Ok(account)
}

/// 更新账号信息（支持修改 label、token、SSO Client ID/Secret、machineId）
#[tauri::command]
pub fn update_account(
    state: State<AppState>,
    id: String,
    label: Option<String>,
    access_token: Option<String>,
    refresh_token: Option<String>,
    // BuilderId SSO 字段
    client_id: Option<String>,
    client_secret: Option<String>,
    // 机器码
    machine_id: Option<String>,
) -> Result<Account, String> {
    let mut store = state.store.lock().unwrap();
    
    // 先找到索引，避免借用冲突
    let idx = store.accounts.iter().position(|a| a.id == id);
    
    if let Some(idx) = idx {
        if let Some(l) = label {
            store.accounts[idx].label = l;
        }
        if let Some(at) = access_token {
            store.accounts[idx].access_token = Some(at);
        }
        if let Some(rt) = refresh_token {
            store.accounts[idx].refresh_token = Some(rt);
        }
        // BuilderId SSO 字段
        if let Some(cid) = client_id {
            store.accounts[idx].client_id = Some(cid);
        }
        if let Some(csec) = client_secret {
            store.accounts[idx].client_secret = Some(csec);
        }
        // 机器码
        if let Some(mid) = machine_id {
            store.accounts[idx].machine_id = Some(mid);
        }
        let result = store.accounts[idx].clone();
        store.save_to_file();
        Ok(result)
    } else {
        Err("账号不存在".to_string())
    }
}

/// 从 AWS 服务端删除账号（注销账号）
/// 仅支持 Google、Github，不支持 BuilderId 和 Enterprise
#[tauri::command]
pub async fn delete_account_remote(
    state: State<'_, AppState>,
    id: String,
    delete_local: bool,
) -> Result<String, String> {
    use crate::auth::delete_account_desktop;
    use crate::commands::machine_guid::get_machine_id;
    
    // 获取账号信息
    let account = {
        let store = state.store.lock().unwrap();
        store.accounts.iter().find(|a| a.id == id).cloned()
    }.ok_or("账号不存在")?;
    
    // 检查 provider
    let provider = account.provider.as_deref().unwrap_or("Google");
    if provider == "Enterprise" {
        return Err("Enterprise 账号不支持远程删除".to_string());
    }
    if provider == "BuilderId" {
        return Err("BuilderId 账号不支持远程删除".to_string());
    }
    
    let access_token = account.access_token.as_ref()
        .ok_or("账号缺少 access_token，请先刷新")?;
    
    // Google/Github 账号使用 Desktop API
    let machine_id = get_machine_id();
    delete_account_desktop(access_token, &machine_id).await?;
    
    // 如果需要同时删除本地记录
    if delete_local {
        let mut store = state.store.lock().unwrap();
        store.delete(&id);
    }
    
    Ok(format!("账号 {} 已从服务端删除", account.email))
}


// ============================================================
// 筛选查询命令
// ============================================================

/// 获取可用账号列表（用于自动换号）
#[tauri::command]
pub fn get_available_accounts(state: State<AppState>) -> Vec<Account> {
    let store = state.store.lock().unwrap();
    store.get_available_accounts().into_iter().cloned().collect()
}

/// 按分组筛选账号
#[tauri::command]
pub fn get_accounts_by_group(state: State<AppState>, group_id: String) -> Vec<Account> {
    let store = state.store.lock().unwrap();
    store.get_accounts_by_group(&group_id).into_iter().cloned().collect()
}

/// 按标签筛选账号
#[tauri::command]
pub fn get_accounts_by_tag(state: State<AppState>, tag_id: String) -> Vec<Account> {
    let store = state.store.lock().unwrap();
    store.get_accounts_by_tag(&tag_id).into_iter().cloned().collect()
}
