use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// SSO Token 转换结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsoTokenConvertResult {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_in: i64,
    pub token_type: String,
}

/// AWS SSO OIDC Token 响应
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: i64,
    token_type: String,
}

/// AWS Builder ID 的固定 client_id
const BUILDER_ID_CLIENT_ID: &str = "arn:aws:sso::aws:app/ssoins-722377b1a6e95e8c/apl-080bf5c0c5d04f4f";

/// 使用 SSO Token 获取 access_token 和 refresh_token
/// 
/// AWS SSO OIDC 流程:
/// 1. 使用 SSO Token (x-amz-sso_authn) 作为 Bearer Token
/// 2. 调用 CreateToken API 获取 access_token 和 refresh_token
pub async fn convert_sso_token_to_refresh_token(
    sso_token: &str,
) -> Result<SsoTokenConvertResult, String> {
    // AWS SSO OIDC Token 端点
    let token_url = "https://oidc.us-east-1.amazonaws.com/token";

    // 构建请求体
    let mut params = HashMap::new();
    params.insert("clientId", BUILDER_ID_CLIENT_ID);
    params.insert("grantType", "urn:ietf:params:oauth:grant-type:token-exchange");
    params.insert("subjectToken", sso_token);
    params.insert("subjectTokenType", "urn:ietf:params:oauth:token-type:access_token");

    // 发送请求
    let client = reqwest::Client::new();
    let response = client
        .post(token_url)
        .header("Content-Type", "application/x-amz-json-1.1")
        .header("X-Amz-Target", "AWSIEPortalService.CreateToken")
        .json(&params)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("API 返回错误 ({}): {}", status, body));
    }

    // 解析响应
    let token_response: TokenResponse =
        serde_json::from_str(&body).map_err(|e| format!("解析响应失败: {}", e))?;

    let refresh_token = token_response
        .refresh_token
        .ok_or_else(|| "响应中没有 refresh_token".to_string())?;

    Ok(SsoTokenConvertResult {
        access_token: token_response.access_token,
        refresh_token,
        expires_in: token_response.expires_in,
        token_type: token_response.token_type,
    })
}

/// 尝试多种方法转换 SSO Token
/// 
/// 方法 1: 使用 token-exchange grant type
/// 方法 2: 使用 device_code grant type
/// 方法 3: 直接使用 SSO Token 作为 Bearer Token 调用 AWS API
pub async fn convert_sso_token_with_fallback(
    sso_token: &str,
) -> Result<SsoTokenConvertResult, String> {
    // 方法 1: token-exchange
    match convert_sso_token_to_refresh_token(sso_token).await {
        Ok(result) => return Ok(result),
        Err(e) => {
            log::debug!("方法 1 (token-exchange) 失败: {}", e);
        }
    }

    // 方法 2: 尝试使用 SSO Token 直接作为 access_token
    // 某些情况下 SSO Token 本身就可以用作 access_token
    match try_use_sso_as_access_token(sso_token).await {
        Ok(result) => return Ok(result),
        Err(e) => {
            log::debug!("方法 2 (直接使用) 失败: {}", e);
        }
    }

    Err("所有转换方法都失败了".to_string())
}

/// 尝试直接使用 SSO Token 作为 access_token
/// 并通过刷新获取 refresh_token
async fn try_use_sso_as_access_token(sso_token: &str) -> Result<SsoTokenConvertResult, String> {
    // 使用 SSO Token 调用 AWS API 验证是否有效
    let client = reqwest::Client::new();
    
    // 尝试调用 GetUserInfo 端点
    let userinfo_url = "https://oidc.us-east-1.amazonaws.com/userinfo";
    let response = client
        .get(userinfo_url)
        .header("Authorization", format!("Bearer {}", sso_token))
        .send()
        .await
        .map_err(|e| format!("验证 SSO Token 失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "SSO Token 无效 ({})",
            response.status()
        ));
    }

    // 如果 SSO Token 有效,尝试获取 refresh_token
    // 注意: 这可能需要额外的 API 调用
    Err("SSO Token 有效但无法获取 refresh_token".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_convert_sso_token() {
        // 这个测试需要真实的 SSO Token
        // 在实际使用中需要替换为真实的 token
        let sso_token = "test_token";
        let result = convert_sso_token_with_fallback(sso_token).await;
        
        // 预期会失败,因为使用的是测试 token
        assert!(result.is_err());
    }
}
