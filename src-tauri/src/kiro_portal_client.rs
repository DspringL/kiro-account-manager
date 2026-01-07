// Kiro Web Portal 客户端 - CBOR API
// 提供 GetUserUsageAndLimits 等公共接口，所有账号类型共用

use serde::{Deserialize, Serialize};

const KIRO_WEB_PORTAL: &str = "https://app.kiro.dev";

// ============================================================
// CBOR 编解码
// ============================================================

pub fn cbor_encode<T: Serialize>(value: &T) -> Result<Vec<u8>, String> {
    let mut buf = Vec::new();
    ciborium::into_writer(value, &mut buf)
        .map_err(|e| format!("CBOR encode error: {}", e))?;
    Ok(buf)
}

pub fn cbor_decode<T: for<'de> Deserialize<'de>>(data: &[u8]) -> Result<T, String> {
    ciborium::from_reader(data)
        .map_err(|e| format!("CBOR decode error: {}", e))
}

// ============================================================
// 响应结构体
// ============================================================

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GetUserInfoResponse {
    pub email: Option<String>,
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
    pub idp: Option<String>,
    pub status: Option<String>,
    #[serde(rename = "featureFlags")]
    pub feature_flags: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct UsageBreakdown {
    #[serde(rename = "resourceType")]
    pub resource_type: Option<String>,
    #[serde(rename = "usageLimit")]
    pub usage_limit: Option<i32>,
    #[serde(rename = "currentUsage")]
    pub current_usage: Option<i32>,
    #[serde(rename = "usageLimitWithPrecision")]
    pub usage_limit_with_precision: Option<f64>,
    #[serde(rename = "currentUsageWithPrecision")]
    pub current_usage_with_precision: Option<f64>,
    #[serde(rename = "overageRate")]
    pub overage_rate: Option<f64>,
    #[serde(rename = "overageCap")]
    pub overage_cap: Option<i32>,
    pub currency: Option<String>,
    #[serde(rename = "freeTrialInfo")]
    pub free_trial_info: Option<FreeTrialInfo>,
    pub bonuses: Option<Vec<BonusInfo>>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct FreeTrialInfo {
    #[serde(rename = "freeTrialStatus")]
    pub free_trial_status: Option<String>,
    #[serde(rename = "usageLimit")]
    pub usage_limit: Option<i32>,
    #[serde(rename = "currentUsage")]
    pub current_usage: Option<i32>,
    #[serde(rename = "freeTrialExpiry")]
    pub free_trial_expiry: Option<f64>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct BonusInfo {
    #[serde(rename = "bonusCode")]
    pub bonus_code: Option<String>,
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(rename = "usageLimit")]
    pub usage_limit: Option<f64>,
    #[serde(rename = "currentUsage")]
    pub current_usage: Option<f64>,
    #[serde(rename = "expiresAt")]
    pub expires_at: Option<f64>,
    pub status: Option<String>,
}


#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SubscriptionInfo {
    #[serde(rename = "type")]
    pub subscription_type: Option<String>,
    #[serde(rename = "subscriptionTitle")]
    pub subscription_title: Option<String>,
    #[serde(rename = "overageCapability")]
    pub overage_capability: Option<String>,
    #[serde(rename = "upgradeCapability")]
    pub upgrade_capability: Option<String>,
    #[serde(rename = "subscriptionManagementTarget")]
    pub subscription_management_target: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OverageConfiguration {
    #[serde(rename = "overageStatus")]
    pub overage_status: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GetUserUsageAndLimitsResponse {
    #[serde(rename = "usageBreakdownList")]
    pub usage_breakdown_list: Option<Vec<UsageBreakdown>>,
    #[serde(rename = "usageBreakdown")]
    pub usage_breakdown: Option<UsageBreakdown>,
    #[serde(rename = "subscriptionInfo")]
    pub subscription_info: Option<SubscriptionInfo>,
    #[serde(rename = "overageConfiguration")]
    pub overage_configuration: Option<OverageConfiguration>,
    #[serde(rename = "daysUntilReset")]
    pub days_until_reset: Option<i32>,
    #[serde(rename = "nextDateReset")]
    pub next_date_reset: Option<f64>,
    #[serde(rename = "userInfo")]
    pub user_info: Option<GetUserInfoResponse>,
    pub limits: Option<Vec<serde_json::Value>>,
}

// ============================================================
// 请求结构体
// ============================================================

#[derive(Debug, Serialize)]
struct GetUserUsageAndLimitsRequest {
    #[serde(rename = "isEmailRequired")]
    is_email_required: bool,
    origin: String,
}

// ============================================================
// KiroPortalClient
// ============================================================

pub struct KiroPortalClient {
    client: reqwest::Client,
    endpoint: String,
}

impl KiroPortalClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
            endpoint: KIRO_WEB_PORTAL.to_string(),
        }
    }

    /// 获取用户配额和用量信息
    pub async fn get_user_usage_and_limits(
        &self,
        access_token: &str,
        idp: &str,
    ) -> Result<GetUserUsageAndLimitsResponse, String> {
        let url = format!(
            "{}/service/KiroWebPortalService/operation/GetUserUsageAndLimits",
            self.endpoint
        );

        let request = GetUserUsageAndLimitsRequest {
            is_email_required: true,
            origin: "KIRO_IDE".to_string(),
        };

        let body = cbor_encode(&request)?;
        let cookie = format!("Idp={}; AccessToken={}", idp, access_token);

        let response = self.client
            .post(&url)
            .header("Content-Type", "application/cbor")
            .header("Accept", "application/cbor")
            .header("smithy-protocol", "rpc-v2-cbor")
            .header("authorization", format!("Bearer {}", access_token))
            .header("Cookie", cookie)
            .body(body)
            .send()
            .await
            .map_err(|e| format!("GetUserUsageAndLimits request failed: {}", e))?;

        let status = response.status();
        let bytes = response.bytes().await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        if !status.is_success() {
            let error_msg = if let Ok(error) = cbor_decode::<serde_json::Value>(&bytes) {
                serde_json::to_string_pretty(&error).unwrap_or_default()
            } else {
                String::from_utf8_lossy(&bytes).to_string()
            };
            
            // 打印失败日志到开发者工具
            log::debug!("[KiroPortal] GetUserUsageAndLimits Status: {}", status);
            log::debug!("[KiroPortal] Response:\n{}", error_msg);
            
            // 401 → token 过期，需要刷新
            if status.as_u16() == 401 {
                return Err(format!("AUTH_ERROR: {}", error_msg));
            }
            
            // 423 Locked + AccountSuspendedException → 封禁
            if status.as_u16() == 423 {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&error_msg) {
                    let type_field = parsed.get("__type").and_then(|t| t.as_str()).unwrap_or("");
                    if type_field.contains("AccountSuspendedException") {
                        let message = parsed.get("message").and_then(|m| m.as_str()).unwrap_or("账号已被暂停");
                        return Err(format!("BANNED: {}", message));
                    }
                }
            }
            
            // 403 处理
            if status.as_u16() == 403 {
                // 解析 JSON 检查 reason 字段
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&error_msg) {
                    let reason = parsed.get("reason").and_then(|r| r.as_str()).unwrap_or("");
                    let message = parsed.get("message").and_then(|m| m.as_str()).unwrap_or("账号已被封禁");
                    
                    // 403 + reason 为 TEMPORARILY_SUSPENDED → 封禁
                    if reason == "TEMPORARILY_SUSPENDED" {
                        return Err(format!("BANNED: {}", message));
                    }
                }
                // 403 + 其他情况 → token 无效，需要刷新
                return Err(format!("AUTH_ERROR: {}", error_msg));
            }
            
            return Err(format!("GetUserUsageAndLimits failed ({}): {}", status, error_msg));
        }

        cbor_decode(&bytes)
    }
}
