// Kiro IDE 相关功能

use serde::{Deserialize, Serialize};

// ===== Kiro IDE 本地 Token =====

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KiroLocalToken {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub expires_at: Option<String>,
    pub auth_method: Option<String>,
    pub provider: Option<String>,
    // Social 专用
    pub profile_arn: Option<String>,
    // IdC 专用
    pub client_id_hash: Option<String>,
    pub region: Option<String>,
}

/// IdC 客户端注册信息 (从 {clientIdHash}.json 读取)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientRegistration {
    pub client_id: String,
    pub client_secret: String,
    pub expires_at: Option<String>,
}

#[tauri::command]
pub async fn get_kiro_local_token() -> Option<KiroLocalToken> {
    tokio::task::spawn_blocking(|| {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .ok()?;
        let path = std::path::Path::new(&home)
            .join(".aws")
            .join("sso")
            .join("cache")
            .join("kiro-auth-token.json");
        
        let content = std::fs::read_to_string(&path).ok()?;
        serde_json::from_str(&content).ok()
    }).await.ok().flatten()
}

/// 读取 IdC 客户端注册信息
pub async fn get_client_registration(client_id_hash: &str) -> Option<ClientRegistration> {
    let hash = client_id_hash.to_string();
    tokio::task::spawn_blocking(move || {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .ok()?;
        let path = std::path::Path::new(&home)
            .join(".aws")
            .join("sso")
            .join("cache")
            .join(format!("{}.json", hash));
        
        let content = std::fs::read_to_string(&path).ok()?;
        serde_json::from_str(&content).ok()
    }).await.ok().flatten()
}



// ===== 切换账号 =====

use crate::process::{check_kiro_running, launch_kiro};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchAccountResult {
    pub success: bool,
    pub message: String,
    pub kiro_was_running: bool,
    pub kiro_restarted: bool,
}

/// 切换账号参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchAccountParams {
    pub access_token: String,
    pub refresh_token: String,
    pub provider: String,
    #[serde(default)]
    pub auth_method: Option<String>,
    // Social 专用
    #[serde(default)]
    pub profile_arn: Option<String>,
    // IdC 专用
    #[serde(default)]
    pub client_id_hash: Option<String>,
    #[serde(default)]
    pub client_id: Option<String>,
    #[serde(default)]
    pub client_secret: Option<String>,
    #[serde(default)]
    pub region: Option<String>,
    // 选项
    #[serde(default)]
    pub auto_restart: Option<bool>,
}

/// 切换 Kiro 账号（直接写入 Token 文件）
#[tauri::command]
pub async fn switch_kiro_account(params: SwitchAccountParams) -> Result<SwitchAccountResult, String> {
    // 使用 spawn_blocking 避免阻塞异步运行时
    tokio::task::spawn_blocking(move || {
        let kiro_was_running = check_kiro_running();
        let should_restart = params.auto_restart.unwrap_or(true);
        let auth_method = params.auth_method.unwrap_or_else(|| "social".to_string());
        let access_token = params.access_token;
        let refresh_token = params.refresh_token;
        let provider = params.provider;
        let profile_arn = params.profile_arn;
        let client_id_hash = params.client_id_hash;
        let client_id = params.client_id;
        let client_secret = params.client_secret;
        let region = params.region;
        
        // 1. 替换 Token
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .map_err(|_| "Cannot find home directory")?;
        
        let dir_path = std::path::Path::new(&home)
            .join(".aws")
            .join("sso")
            .join("cache");
        
        std::fs::create_dir_all(&dir_path)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
        
        let file_path = dir_path.join("kiro-auth-token.json");
        
        let expires_at = chrono::Utc::now() + chrono::Duration::hours(1);
        
        // 根据 auth_method 构建不同的 token 数据
        let token_data = if auth_method == "IdC" {
            // IdC 账号: clientIdHash + region
            let hash = client_id_hash.clone().unwrap_or_default();
            let data = serde_json::json!({
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "expiresAt": expires_at.to_rfc3339(),
                "authMethod": "IdC",
                "provider": provider,
                "clientIdHash": hash,
                "region": region.clone().unwrap_or_else(|| "us-east-1".to_string())
            });
            data
        } else {
            // Social 账号: profileArn
            let arn = profile_arn.unwrap_or_else(|| 
                "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK".to_string()
            );
            serde_json::json!({
                "accessToken": access_token,
                "refreshToken": refresh_token,
                "profileArn": arn,
                "expiresAt": expires_at.to_rfc3339(),
                "authMethod": "social",
                "provider": provider
            })
        };
        
        let content = serde_json::to_string_pretty(&token_data)
            .map_err(|e| format!("Failed to serialize: {}", e))?;
        
        // 原子写入：先写临时文件，再覆盖
        let temp_file_path = dir_path.join("kiro-auth-token.json.tmp");
        std::fs::write(&temp_file_path, &content)
            .map_err(|e| format!("Failed to write temp file: {}", e))?;
        std::fs::rename(&temp_file_path, &file_path)
            .map_err(|e| format!("Failed to rename file: {}", e))?;
        
        // IdC 账号还需要写入 Client Registration 文件
        if auth_method == "IdC" {
            if let (Some(hash), Some(cid), Some(csec)) = (client_id_hash, client_id, client_secret) {
                let client_reg_path = dir_path.join(format!("{}.json", hash));
                let client_reg_temp_path = dir_path.join(format!("{}.json.tmp", hash));
                let client_expires = chrono::Utc::now() + chrono::Duration::days(90);
                let client_reg_data = serde_json::json!({
                    "clientId": cid,
                    "clientSecret": csec,
                    "expiresAt": client_expires.to_rfc3339()
                });
                let client_reg_content = serde_json::to_string_pretty(&client_reg_data)
                    .map_err(|e| format!("Failed to serialize client registration: {}", e))?;
                // 原子写入
                std::fs::write(&client_reg_temp_path, client_reg_content)
                    .map_err(|e| format!("Failed to write client registration temp: {}", e))?;
                std::fs::rename(&client_reg_temp_path, &client_reg_path)
                    .map_err(|e| format!("Failed to rename client registration: {}", e))?;
            }
        }
        
        // 4. 切换完成
        let kiro_restarted = if kiro_was_running && should_restart {
            launch_kiro().is_ok()
        } else {
            false
        };
        
        Ok(SwitchAccountResult {
            success: true,
            message: format!("Switched to {} ({}) account", provider, auth_method),
            kiro_was_running,
            kiro_restarted,
        })
    }).await.map_err(|e| format!("Task failed: {}", e))?
}






