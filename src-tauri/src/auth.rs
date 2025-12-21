// Auth 模块 - 当前使用的认证相关代码

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// ============================================================
// User 和 AuthState
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: String,
    pub email: String,
    pub name: String,
    pub avatar: Option<String>,
    pub provider: String,
}

pub struct AuthState {
    pub user: Mutex<Option<User>>,
    pub csrf_token: Mutex<Option<String>>,
    pub access_token: Mutex<Option<String>>,
    pub refresh_token: Mutex<Option<String>>,
}

impl AuthState {
    pub fn new() -> Self {
        Self {
            user: Mutex::new(None),
            csrf_token: Mutex::new(None),
            access_token: Mutex::new(None),
            refresh_token: Mutex::new(None),
        }
    }
}

// ============================================================
// API 常量
// ============================================================

pub const DESKTOP_AUTH_API: &str = "https://prod.us-east-1.auth.desktop.kiro.dev";
const DESKTOP_USAGE_API: &str = "https://codewhisperer.us-east-1.amazonaws.com";
const PROFILE_ARN: &str = "arn:aws:codewhisperer:us-east-1:699475941385:profile/EHGA3GRVQMUK";

// ============================================================
// 桌面端 API 响应结构
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopRefreshResponse {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub profile_arn: String,
    pub csrf_token: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUsageResponse {
    pub days_until_reset: Option<i32>,
    pub next_date_reset: Option<f64>,
    pub user_info: Option<DesktopUserInfo>,
    pub subscription_info: Option<DesktopSubscriptionInfo>,
    pub usage_breakdown_list: Option<Vec<DesktopUsageBreakdown>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUserInfo {
    pub email: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSubscriptionInfo {
    pub subscription_title: Option<String>,
    #[serde(rename = "type")]
    pub subscription_type: Option<String>,
    pub overage_capability: Option<String>,
    pub upgrade_capability: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopUsageBreakdown {
    pub usage_limit: Option<i32>,
    pub current_usage: Option<i32>,
    pub next_date_reset: Option<f64>,
    pub free_trial_info: Option<FreeTrialInfo>,
    pub bonuses: Option<Vec<BonusInfo>>,
    pub overage_rate: Option<f64>,
    pub overage_cap: Option<i32>,
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FreeTrialInfo {
    pub usage_limit: Option<i32>,
    pub current_usage: Option<i32>,
    pub free_trial_expiry: Option<f64>,
    pub free_trial_status: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BonusInfo {
    pub bonus_code: Option<String>,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub usage_limit: Option<f64>,
    pub current_usage: Option<f64>,
    pub expires_at: Option<f64>,
    pub redeemed_at: Option<f64>,
    pub status: Option<String>,
}


// ============================================================
// 桌面端 API 方法
// ============================================================

/// 使用桌面端 API 刷新 Token（只需要 RefreshToken）
pub async fn refresh_token_desktop(refresh_token: &str) -> Result<DesktopRefreshResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;
    
    let body = serde_json::json!({
        "refreshToken": refresh_token
    });
    
    // 重试机制
    let mut last_error = String::new();
    for attempt in 0..3 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        }
        
        match client
            .post(format!("{}/refreshToken", DESKTOP_AUTH_API))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .json(&body)
            .send()
            .await
        {
            Ok(response) => {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                
                // 只在调试时输出状态码，不输出敏感的 token 内容
                #[cfg(debug_assertions)]
                println!("[Desktop] RefreshToken Status: {}", status);
                
                if !status.is_success() {
                    if status.as_u16() == 401 {
                        return Err("RefreshToken 已过期或无效".to_string());
                    }
                    return Err(format!("RefreshToken failed ({})", status));
                }
                
                return serde_json::from_str(&text)
                    .map_err(|e| format!("Parse failed: {}", e));
            }
            Err(e) => {
                last_error = format!("网络错误: {}", e);
                continue;
            }
        }
    }
    
    Err(last_error)
}

/// 使用桌面端 API 获取配额和用户信息
pub async fn get_usage_limits_desktop(access_token: &str) -> Result<DesktopUsageResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;
    
    let url = format!(
        "{}/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&profileArn={}",
        DESKTOP_USAGE_API,
        urlencoding::encode(PROFILE_ARN)
    );

    // println!("\n[7] GET USAGE LIMITS REQUEST");
    // println!("URL: {}", url);
    // println!("Token: {}", access_token);
    
    // 重试机制
    let mut last_error = String::new();
    for attempt in 0..3 {
        if attempt > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        }
        
        match client
            .get(&url)
            .header("Authorization", format!("Bearer {}", access_token))
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(response) => {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                
                // 只在调试时输出状态码，不输出敏感内容
                #[cfg(debug_assertions)]
                println!("[Social] GetUsageLimits Status: {}", status);
                
                if !status.is_success() {
                    // 403 Forbidden = TEMPORARILY_SUSPENDED = 账号被封禁
                    if status.as_u16() == 403 {
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                            if let Some(msg) = parsed.get("message").and_then(|m| m.as_str()) {
                                return Err(format!("BANNED: {}", msg));
                            }
                        }
                        return Err("BANNED: 账号已被封禁".to_string());
                    }
                    
                    // 解析错误响应，提取 reason 字段（其他封禁情况）
                    if let Ok(error_json) = serde_json::from_str::<serde_json::Value>(&text) {
                        if let Some(reason) = error_json.get("reason").and_then(|r| r.as_str()) {
                            return Err(format!("BANNED:{}", reason));
                        }
                    }
                    return Err(format!("GetUsageLimits failed ({})", status));
                }
                
                return serde_json::from_str(&text)
                    .map_err(|e| format!("Parse failed: {}", e));
            }
            Err(e) => {
                last_error = format!("网络错误: {}", e);
                continue;
            }
        }
    }
    
    Err(last_error)
}


/// 使用桌面端 API 删除账号（从 AWS 服务端删除）
pub async fn delete_account_desktop(access_token: &str, machine_id: &str) -> Result<(), String> {
    let user_agent = format!("KiroIDE-0.6.18-{}", machine_id);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create client: {}", e))?;
    
    // Kiro Desktop 使用 DELETE /account 端点
    let url = format!("{}/account", DESKTOP_AUTH_API);
    
    #[cfg(debug_assertions)]
    println!("[Desktop] DeleteAccount request");
    
    let response = client
        .delete(&url)
        .header("Authorization", format!("Bearer {}", access_token))
        .header("User-Agent", &user_agent)
        .send()
        .await
        .map_err(|e| format!("网络错误: {}", e))?;
    
    let status = response.status();
    
    #[cfg(debug_assertions)]
    println!("[Desktop] DeleteAccount Status: {}", status);
    
    if !status.is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("删除账号失败 ({}): {}", status, text));
    }
    
    Ok(())
}
