use serde::{Deserialize, Serialize};

/// 临时邮箱配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TempMailConfig {
    pub api_url: String,
    pub admin_password: String,
}

/// 临时邮箱地址信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TempMailAddress {
    pub jwt: String,
    pub address: String,
    pub address_id: i64,
}

/// 临时邮件消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TempMailMessage {
    pub id: i64,
    pub address: String,
    pub message_id: String,
    pub source: String,
    pub raw: String,
    pub metadata: String,
    pub created_at: String,
}

/// 邮件列表响应
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TempMailMessagesResponse {
    pub results: Vec<TempMailMessage>,
    pub count: i64,
}

/// 注册结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sso_token: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl RegisterResult {
    pub fn success(sso_token: String, name: String, email: String) -> Self {
        Self {
            success: true,
            sso_token: Some(sso_token),
            name: Some(name),
            email: Some(email),
            error: None,
        }
    }

    pub fn error(error: String) -> Self {
        Self {
            success: false,
            sso_token: None,
            name: None,
            email: None,
            error: Some(error),
        }
    }
}
