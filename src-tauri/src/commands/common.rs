// 公共工具函数 - 提取重复逻辑

use crate::account::Account;
use crate::providers::{AuthProvider, IdcProvider, RefreshMetadata, SocialProvider, KiroWebPortalClient};

// 常量
pub const START_URL: &str = "https://view.awsapps.com/start";
pub const MAX_ACCOUNT_COUNT: usize = 500;

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
}

/// 根据 provider 刷新 token
pub async fn refresh_token_by_provider(
    account: &Account,
) -> Result<RefreshResult, String> {
    let provider = account.provider.as_deref().unwrap_or("Google");
    let refresh_token = account.refresh_token.as_ref().ok_or("No refresh token")?;

    if provider == "BuilderId" {
        let metadata = RefreshMetadata {
            client_id: account.client_id.clone(),
            client_secret: account.client_secret.clone(),
            region: account.region.clone(),
            ..Default::default()
        };
        let region = metadata.region.as_deref().unwrap_or("us-east-1");
        let idc_provider = IdcProvider::new("BuilderId", region, None);
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
) -> UsageResult {
    // 统一使用 KiroWebPortalService 的 GetUserUsageAndLimits 接口
    // provider 即 idp: Google / Github / BuilderId
    let client = KiroWebPortalClient::new();
    let usage_call = client.get_user_usage_and_limits(access_token, provider).await;
    parse_usage_result(usage_call)
}

/// 解析 usage 结果，提取封禁状态
fn parse_usage_result<T: serde::Serialize>(
    result: Result<T, String>,
) -> UsageResult {
    match result {
        Ok(usage) => UsageResult {
            usage_data: serde_json::to_value(&usage).unwrap_or(serde_json::Value::Null),
            is_banned: false,
        },
        Err(e) if e.starts_with("BANNED:") => UsageResult {
            usage_data: serde_json::Value::Null,
            is_banned: true,
        },
        Err(_) => UsageResult {
            usage_data: serde_json::Value::Null,
            is_banned: false,
        },
    }
}

/// 计算过期时间字符串
pub fn calc_expires_at(expires_in: i64) -> String {
    let expires_at = chrono::Local::now() + chrono::Duration::seconds(expires_in);
    expires_at.format("%Y/%m/%d %H:%M:%S").to_string()
}


/// 计算 client_id_hash
pub fn calc_client_id_hash() -> String {
    use sha2::{Digest, Sha256};
    hex::encode(Sha256::digest(START_URL.as_bytes()))
}

/// 从 usage 中提取 email 和 user_id
pub fn extract_user_info(usage: &Option<crate::providers::web_oauth::GetUserUsageAndLimitsResponse>) -> (Option<String>, Option<String>) {
    let email = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|u| u.email.clone());
    let user_id = usage.as_ref()
        .and_then(|u| u.user_info.as_ref())
        .and_then(|u| u.user_id.clone());
    (email, user_id)
}

/// 查找已存在的账号索引（优先邮箱匹配，其次 refresh_token 匹配）
pub fn find_existing_account_idx(
    accounts: &[Account],
    email: &Option<String>,
    provider: &str,
    refresh_token: &str,
) -> Option<usize> {
    if let Some(ref e) = email {
        accounts.iter().position(|a| &a.email == e && a.provider.as_deref() == Some(provider))
    } else {
        accounts.iter().position(|a| {
            a.provider.as_deref() == Some(provider) && a.refresh_token.as_ref() == Some(&refresh_token.to_string())
        })
    }
}

/// 检查账号数量上限
pub fn check_account_limit(count: usize) -> Result<(), String> {
    if count >= MAX_ACCOUNT_COUNT {
        Err(format!("账号数量已达上限 ({})，无法继续添加", MAX_ACCOUNT_COUNT))
    } else {
        Ok(())
    }
}

/// 根据 usage_result 计算账号状态
pub fn calc_status(is_banned: bool) -> String {
    if is_banned { "banned".to_string() } else { "active".to_string() }
}

/// 从 usage 响应中提取配额信息
pub fn extract_quota(usage: &crate::providers::web_oauth::GetUserUsageAndLimitsResponse) -> (Option<i32>, Option<i32>, Option<String>) {
    let (q, u) = usage.usage_breakdown_list.as_ref()
        .and_then(|list| list.first())
        .map(|b| (b.usage_limit, b.current_usage))
        .unwrap_or((None, None));
    let sub_type = usage.subscription_info.as_ref().and_then(|s| s.subscription_type.clone());
    (q, u, sub_type)
}

/// 更新账号的 token 和 usage 字段（sync_account 用）
pub fn apply_refresh_result(account: &mut Account, result: &RefreshResult, usage: &UsageResult) {
    account.access_token = Some(result.access_token.clone());
    if let Some(ref rt) = result.refresh_token { account.refresh_token = Some(rt.clone()); }
    if let Some(ref arn) = result.profile_arn { account.profile_arn = Some(arn.clone()); }
    if let Some(ref id_token) = result.id_token { account.id_token = Some(id_token.clone()); }
    if let Some(ref session_id) = result.sso_session_id { account.sso_session_id = Some(session_id.clone()); }
    account.expires_at = Some(calc_expires_at(result.expires_in));
    account.usage_data = Some(usage.usage_data.clone());
    account.status = calc_status(usage.is_banned);
}
