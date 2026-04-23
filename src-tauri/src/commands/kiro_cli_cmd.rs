#![allow(clippy::needless_pass_by_value)] // Tauri 命令需要按值传递参数

use crate::core::account::Account;
use crate::commands::common::{extract_user_info, get_usage_by_provider};
use crate::kiro::cli::read_kiro_cli_accounts;
use crate::state::AppState;
use serde::Serialize;
use std::sync::{Mutex, MutexGuard};
use tauri::State;

/// 展开路径中的 ~ 为用户主目录
fn expand_home_dir(path: &str) -> Result<String, String> {
    if path.starts_with('~') {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map_err(|_| "无法获取用户主目录".to_string())?;
        Ok(path.replacen('~', &home, 1))
    } else {
        Ok(path.to_string())
    }
}

/// 从 CLI 账号判断 provider
fn determine_provider(cli_account: &crate::kiro::cli::KiroCliAccount) -> String {
    if cli_account.auth_method == "social" {
        // Social Login，通过 profile_arn 判断
        if let Some(ref arn) = cli_account.profile_arn {
            if arn.contains("google") {
                return "Google".to_string();
            } else if arn.contains("github") {
                return "Github".to_string();
            }
        }
        "Unknown".to_string()
    } else {
        // OIDC，默认 BuilderId
        "BuilderId".to_string()
    }
}

/// 检查账号是否已存在
fn find_existing_account(
    accounts: &[Account],
    user_id: Option<&String>,
    _email: Option<&String>,
) -> Option<usize> {
    if let Some(uid) = user_id {
        return accounts
            .iter()
            .position(|a| a.user_id.as_ref() == Some(uid));
    }

    None
}

/// 创建账号标签
fn create_account_label(
    is_new: bool,
    token_key: &str,
    existing_account: Option<&Account>,
) -> String {
    if is_new {
        format!("从 kiro-cli 导入 ({token_key})")
    } else {
        existing_account.map_or_else(
            || format!("从 kiro-cli 导入 ({token_key})"),
            |a| a.label.clone(),
        )
    }
}

fn lock_account_store<T>(mutex: &Mutex<T>) -> Result<MutexGuard<'_, T>, String> {
    mutex
        .lock()
        .map_err(|_| "Failed to acquire store lock".to_string())
}
#[derive(Serialize)]
pub struct KiroCliImportResult {
    pub success: bool,
    pub is_new: bool,
    pub account: Option<Account>,
    pub error: Option<String>,
}

/// 获取 kiro-cli 默认数据库路径
#[tauri::command]
pub fn get_kiro_cli_default_path() -> Result<String, String> {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "无法获取用户主目录".to_string())?;

    let mut candidates = Vec::new();

    if cfg!(target_os = "macos") {
        candidates.push(
            std::path::PathBuf::from(&home)
                .join("Library")
                .join("Application Support")
                .join("kiro-cli")
                .join("data.sqlite3"),
        );
    } else if cfg!(target_os = "windows") {
        // Kiro CLI 2.0 原生支持 Windows
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            candidates.push(
                std::path::PathBuf::from(local_app_data)
                    .join("Kiro-Cli")
                    .join("data.sqlite3"),
            );
        }
    } else {
        if let Ok(xdg_data_home) = std::env::var("XDG_DATA_HOME") {
            candidates.push(
                std::path::PathBuf::from(xdg_data_home)
                    .join("kiro-cli")
                    .join("data.sqlite3"),
            );
        }
        candidates.push(
            std::path::PathBuf::from(&home)
                .join(".local")
                .join("share")
                .join("kiro-cli")
                .join("data.sqlite3"),
        );
    }

    for path in candidates {
        if path.exists() {
            return Ok(path.to_string_lossy().to_string());
        }
    }

    // 文件不存在，返回空字符串（前端会显示占位符）
    Ok(String::new())
}
/// 从 kiro-cli 数据库导入账号
#[tauri::command]
pub async fn import_from_kiro_cli(
    db_path: String,
    state: State<'_, AppState>,
) -> Result<KiroCliImportResult, String> {
    eprintln!("[Kiro CLI Import] 开始导入，数据库路径: {db_path}");

    // 展开 ~ 为用户主目录
    let expanded_path = expand_home_dir(&db_path)?;
    eprintln!("[Kiro CLI Import] 展开后的路径: {expanded_path}");

    // 1. 读取 kiro-cli 数据库
    let cli_accounts = read_kiro_cli_accounts(&expanded_path)?;

    if cli_accounts.is_empty() {
        return Err("数据库中没有账号数据".to_string());
    }

    if cli_accounts.len() > 1 {
        return Err("数据库中有多个账号，请联系开发者".to_string());
    }

    let cli_account = &cli_accounts[0];
    let auth_method = &cli_account.auth_method;
    let token_key = &cli_account.token_key;
    eprintln!("[Kiro CLI Import] 读取到账号: auth_method={auth_method}, token_key={token_key}");

    // 2. 调用统一的 getUsageLimits API 获取配额
    let provider = determine_provider(cli_account);
    let usage_result = get_usage_by_provider(&provider, &cli_account.access_token).await;

    let (email, user_id, usage_data) = match usage_result {
        Ok(result) => {
            let (email, user_id) = extract_user_info(&result.usage_data);
            (email, user_id, Some(result.usage_data))
        }
        Err(e) => {
            eprintln!("[Kiro CLI Import] 获取配额失败: {e}");
            return Ok(KiroCliImportResult {
                success: false,
                is_new: false,
                account: None,
                error: Some(format!("获取账号信息失败: {e}")),
            });
        }
    };

    // 3. 检查账号是否已存在
    let mut store = lock_account_store(&state.store)?;
    let existing_index = find_existing_account(&store.accounts, user_id.as_ref(), email.as_ref());
    let is_new = existing_index.is_none();

    // 4. 创建或更新 Account
    let existing_account = existing_index.and_then(|idx| store.accounts.get(idx));
    let label = create_account_label(is_new, &cli_account.token_key, existing_account);

    let mut account = if let Some(e) = email.clone() {
        Account::new(e, label)
    } else if let Some(uid) = user_id.clone() {
        Account::new_enterprise(uid, label)
    } else {
        return Ok(KiroCliImportResult {
            success: false,
            is_new: false,
            account: None,
            error: Some("无法获取账号标识（email 或 userId）".to_string()),
        });
    };

    // 5. 填充字段
    account.access_token = Some(cli_account.access_token.clone());
    account.refresh_token = Some(cli_account.refresh_token.clone());
    account.expires_at.clone_from(&cli_account.expires_at);
    account.provider = Some(provider);
    account.user_id = user_id;
    account.region = Some(cli_account.region.clone());
    account.usage_data = usage_data;

    // 6. 根据认证类型填充字段
    if cli_account.auth_method == "social" {
        account.auth_method = Some("social".to_string());
        account.profile_arn.clone_from(&cli_account.profile_arn);
    } else {
        account.auth_method = Some("IdC".to_string());
        account.client_id.clone_from(&cli_account.client_id);
        account.client_secret.clone_from(&cli_account.client_secret);
    }

    // 7. 生成或保留 machine_id
    if let Some(idx) = existing_index {
        // 更新现有账号，保留 machine_id
        account
            .machine_id
            .clone_from(&store.accounts[idx].machine_id);
        account.id.clone_from(&store.accounts[idx].id);
        store.accounts[idx] = account.clone();
    } else {
        // 新账号，生成 machine_id
        if account.machine_id.is_none() {
            account.machine_id = Some(uuid::Uuid::new_v4().to_string().to_lowercase());
        }
        store.accounts.push(account.clone());
    }

    store.save_to_file();
    drop(store);

    let email = &account.email;
    let user_id = &account.user_id;
    eprintln!("[Kiro CLI Import] 导入成功: is_new={is_new}, email={email:?}, user_id={user_id:?}");

    Ok(KiroCliImportResult {
        success: true,
        is_new,
        account: Some(account),
        error: None,
    })
}

// ============================================================
// CLI 2.0 切号功能
// ============================================================

/// 检测 CLI 2.0 安装状态
#[tauri::command]
pub fn check_cli_installation() -> crate::kiro::cli::CliInstallationInfo {
    crate::kiro::cli::check_cli_installation()
}

/// 读取 CLI 数据库快照（前端展示用）
#[tauri::command]
pub fn read_cli_db_snapshot(
    db_path: String,
) -> Result<crate::kiro::cli::KiroCliDbSnapshot, String> {
    let expanded_path = expand_home_dir(&db_path)?;
    crate::kiro::cli::read_cli_db_snapshot(&expanded_path)
}

/// 切号到 CLI 账号
#[tauri::command]
pub async fn switch_to_cli_account(
    account_id: String,
    db_path: String,
    state: State<'_, AppState>,
) -> Result<crate::kiro::cli::KiroCliWriteBackup, String> {
    let expanded_path = expand_home_dir(&db_path)?;

    // 1. 从 store 读取账号数据
    let store = lock_account_store(&state.store)?;
    let account = store
        .accounts
        .iter()
        .find(|a| a.id == account_id)
        .ok_or_else(|| format!("账号不存在: {account_id}"))?;

    // 2. 构造切号载荷
    let payload = build_switch_payload(account)?;

    // 3. 执行切号写入
    crate::kiro::cli::switch_cli_account(&expanded_path, &payload)
}

/// 回滚切号操作
#[tauri::command]
pub fn rollback_cli_switch(
    db_path: String,
    backup: crate::kiro::cli::KiroCliWriteBackup,
) -> Result<(), String> {
    let expanded_path = expand_home_dir(&db_path)?;
    crate::kiro::cli::rollback_cli_switch(&expanded_path, &backup)
}

/// 构造切号载荷（从 Account 转换为 CLI 2.0 格式）
fn build_switch_payload(
    account: &Account,
) -> Result<crate::kiro::cli::KiroCliSwitchPayload, String> {
    // 判断账号类型
    let provider = account.provider.as_ref().ok_or("账号缺少 provider 字段")?;
    let (token_key, device_reg_key, auth_method) = match provider.as_str() {
        "BuilderId" => (
            "kirocli:odic:token",
            "kirocli:odic:device-registration",
            "IdC",
        ),
        "Google" | "Github" => (
            "kirocli:social:token",
            "kirocli:social:device-registration",
            "social",
        ),
        _ => return Err(format!("不支持的 provider: {}", provider)),
    };

    // 构造 token JSON
    let mut token_data = serde_json::json!({
        "access_token": account.access_token,
        "refresh_token": account.refresh_token,
        "region": account.region,
    });

    // IdC 账号：补齐固定字段
    if auth_method == "IdC" {
        token_data["scopes"] = serde_json::json!([
            "codewhisperer:completions",
            "codewhisperer:analysis",
            "codewhisperer:conversations",
        ]);
        token_data["oauth_flow"] = serde_json::json!("Pkce");
    }

    // Social 账号：补齐 start_url
    if auth_method == "social" {
        token_data["start_url"] = serde_json::json!("https://view.awsapps.com/start");
        if let Some(ref profile_arn) = account.profile_arn {
            token_data["profile_arn"] = serde_json::json!(profile_arn);
        }
    }

    // 补齐过期时间
    if let Some(ref expires_at) = account.expires_at {
        token_data["expires_at"] = serde_json::json!(expires_at);
    }

    let token_value = serde_json::to_string(&token_data)
        .map_err(|e| format!("序列化 token 失败: {e}"))?;

    // 构造 device registration JSON
    let device_reg_data = serde_json::json!({
        "client_id": account.client_id.as_ref().unwrap_or(&String::new()),
        "client_secret": account.client_secret.as_ref().unwrap_or(&String::new()),
        "region": account.region,
    });

    let device_reg_value = serde_json::to_string(&device_reg_data)
        .map_err(|e| format!("序列化 device registration 失败: {e}"))?;

    Ok(crate::kiro::cli::KiroCliSwitchPayload {
        token_key: token_key.to_string(),
        token_value,
        device_reg_key: device_reg_key.to_string(),
        device_reg_value,
    })
}

#[cfg(test)]
mod tests {
    use super::lock_account_store;
    use std::sync::Mutex;

    #[test]
    fn lock_account_store_returns_error_when_mutex_is_poisoned() {
        let mutex = Mutex::new(());
        let _ = std::panic::catch_unwind(|| {
            let _guard = mutex.lock().expect("mutex should lock before poison");
            panic!("poison lock");
        });

        let err = lock_account_store(&mutex).expect_err("poisoned mutex should return error");
        assert!(err.contains("store lock"));
    }
}
