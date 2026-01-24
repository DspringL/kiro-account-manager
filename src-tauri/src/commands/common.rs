// 公共工具函数 - 提取重复逻辑

use crate::account::Account;
use crate::providers::{AuthProvider, IdcProvider, RefreshMetadata, SocialProvider, KiroPortalClient};

// 常量
pub const MAX_ACCOUNT_COUNT: usize = 4000;

/// Token 刷新结果
pub struct RefreshResult {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: i64,
    pub profile_arn: Option<String>,
    pub id_token: Option<String>,
    pub sso_session_id: Option<String>,
}

/// Usage 获取结果
pub struct UsageResult {
    pub usage_data: serde_json::Value,
    pub is_banned: bool,
    pub is_auth_error: bool,  // 401/认证错误，需要刷新 token
}

/// 根据 provider 刷新 token
pub async fn refresh_token_by_provider(
    account: &Account,
) -> Result<RefreshResult, String> {
    let provider = account.provider.as_deref().unwrap_or("Google");
    let refresh_token = account.refresh_token.as_ref().ok_or("No refresh token")?;

    if provider == "BuilderId" || provider == "Enterprise" {
        let metadata = RefreshMetadata {
            client_id: account.client_id.clone(),
            client_secret: account.client_secret.clone(),
            region: account.region.clone(),
            ..Default::default()
        };
        let region = metadata.region.as_deref().unwrap_or("us-east-1");
        // Enterprise 使用保存的 start_url
        let start_url = if provider == "Enterprise" {
            account.start_url.clone()
        } else {
            None
        };
        let idc_provider = IdcProvider::new(provider, region, start_url);
        let auth = idc_provider.refresh_token(refresh_token, metadata).await?;
        Ok(RefreshResult {
            access_token: auth.access_token,
            refresh_token: Some(auth.refresh_token),
            expires_in: auth.expires_in,
            profile_arn: None,
            id_token: auth.id_token,
            sso_session_id: auth.sso_session_id,
        })
    } else {
        let metadata = RefreshMetadata {
            profile_arn: account.profile_arn.clone(),
            machine_id: account.machine_id.clone(),
            ..Default::default()
        };
        let social_provider = SocialProvider::new(provider);
        let auth = social_provider.refresh_token(refresh_token, metadata).await?;
        Ok(RefreshResult {
            access_token: auth.access_token,
            refresh_token: Some(auth.refresh_token),
            expires_in: auth.expires_in,
            profile_arn: auth.profile_arn,
            id_token: None,
            sso_session_id: None,
        })
    }
}

/// 根据 provider 获取 usage 数据（统一使用 Web Portal 接口）
pub async fn get_usage_by_provider(
    provider: &str,
    access_token: &str,
) -> Result<UsageResult, String> {
    // 统一使用 KiroPortalClient 的 GetUserUsageAndLimits 接口
    // provider 即 idp: Google / Github / BuilderId
    let client = KiroPortalClient::new();
    let usage_call = client.get_user_usage_and_limits(access_token, provider).await;
    parse_usage_result(usage_call)
}

/// 解析 usage 结果，提取封禁状态和认证错误
fn parse_usage_result<T: serde::Serialize>(
    result: Result<T, String>,
) -> Result<UsageResult, String> {
    match result {
        Ok(usage) => Ok(UsageResult {
            usage_data: serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null),
            is_banned: false,
            is_auth_error: false,
        }),
        Err(e) if e.starts_with("BANNED:") => Ok(UsageResult {
            usage_data: serde_json::Value::Null,
            is_banned: true,
            is_auth_error: false,
        }),
        // 401 或认证相关错误（包括 403 + token invalid）
        Err(e) if e.starts_with("AUTH_ERROR:") || e.contains("401") || e.contains("Unauthorized") || e.contains("expired") || e.contains("invalid") => Ok(UsageResult {
            usage_data: serde_json::Value::Null,
            is_banned: false,
            is_auth_error: true,
        }),
        // 其他错误直接抛出
        Err(e) => Err(e),
    }
}

/// 计算过期时间字符串
pub fn calc_expires_at(expires_in: i64) -> String {
    let expires_at = chrono::Local::now() + chrono::Duration::seconds(expires_in);
    expires_at.format("%Y/%m/%d %H:%M:%S").to_string()
}

/// 从 usage 中提取 email 和 user_id
pub fn extract_user_info(usage: &Option<crate::kiro_portal_client::GetUserUsageAndLimitsResponse>) -> (Option<String>, Option<String>) {
    let email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|u| u.email.clone());
    let user_id = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|u| u.user_id.clone());
    (email, user_id)
}

/// 查找已存在的账号索引
/// Enterprise 账号优先用 userId 匹配（因为可能没有 email）
/// 其他账号优先用 email 匹配，其次 refresh_token 匹配
pub fn find_existing_account_idx(
    accounts: &[Account],
    email: &Option<String>,
    provider: &str,
    refresh_token: &str,
    user_id: &Option<String>,
) -> Option<usize> {
    // Enterprise 账号优先用 userId 匹配
    if provider == "Enterprise" {
        if let Some(ref uid) = user_id {
            if let Some(idx) = accounts.iter().position(|a| {
                a.provider.as_deref() == Some(provider) && a.user_id.as_ref() == Some(uid)
            }) {
                return Some(idx);
            }
        }
    }
    
    // 其他账号或 Enterprise 没有 userId 时，用 email 匹配
    if let Some(ref e) = email {
        if let Some(idx) = accounts.iter().position(|a| &a.email == e && a.provider.as_deref() == Some(provider)) {
            return Some(idx);
        }
    }
    
    // 最后用 refresh_token 匹配
    accounts.iter().position(|a| {
        a.provider.as_deref() == Some(provider) && a.refresh_token.as_ref() == Some(&refresh_token.to_string())
    })
}

/// 根据 usage_result 计算账号状态
pub fn calc_status(is_banned: bool) -> String {
    if is_banned { "banned".to_string() } else { "active".to_string() }
}

/// 从 usage 响应中提取配额信息
pub fn extract_quota(usage: &crate::kiro_portal_client::GetUserUsageAndLimitsResponse) -> (Option<i32>, Option<i32>, Option<String>) {
    let (q, u) = usage.usage_breakdown_list.as_ref()
        .and_then(|list| list.first())
        .map(|b| (b.usage_limit, b.current_usage))
        .unwrap_or((None, None));
    let sub_type = usage.subscription_info.as_ref().and_then(|s| s.subscription_type.clone());
    (q, u, sub_type)
}
