// AWS Q Service 客户端 - 统一的 REST API 接口
// 支持 getUsageLimits、ListAvailableModels 和 MCP

use crate::clients::http_client::{
    apply_kiro_runtime_headers, build_http_client, build_kiro_custom_user_agent,
    build_q_service_url, get_usage_probe_regions,
};

pub struct KiroQClient {
    client: reqwest::Client,
}

impl KiroQClient {
    pub fn new() -> Result<Self, String> {
        let client = build_http_client()?;
        Ok(Self { client })
    }

    /// 统一的 getUsageLimits 接口（支持所有账号类型）
    pub async fn get_usage_limits(
        &self,
        access_token: &str,
        machine_id: &str,
        region: &str,
        profile_arn: Option<&str>,
        auth_method: Option<&str>,
        provider: Option<&str>,
    ) -> Result<serde_json::Value, String> {
        let user_agent = build_kiro_custom_user_agent(machine_id);
        let mut url = format!(
            "{}/getUsageLimits?origin=AI_EDITOR&resourceType=AGENTIC_REQUEST&isEmailRequired=true",
            build_q_service_url(region)
        );

        if let Some(arn) = profile_arn.filter(|s| !s.trim().is_empty()) {
            url = format!("{}&profileArn={}", url, urlencoding::encode(arn));
        }

        let request = apply_kiro_runtime_headers(
            self.client.get(&url),
            access_token,
            &user_agent,
            "application/json",
            auth_method,
            provider,
        );

        let response = request
            .send()
            .await
            .map_err(|e| format!("getUsageLimits 请求失败: {}", e))?;

        let status = response.status();
        let status_code = status.as_u16();

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();

            if status_code == 401 {
                return Err("AUTH_ERROR: Token expired or invalid".to_string());
            }

            if status_code == 403 {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&body) {
                    let reason = parsed.get("reason").and_then(|r| r.as_str()).unwrap_or("");
                    let message = parsed
                        .get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("账号已被封禁");

                    if reason == "TEMPORARILY_SUSPENDED" {
                        return Err(format!("BANNED: {}", message));
                    }
                }
                return Err(format!("AUTH_ERROR: getUsageLimits 403: {}", body));
            }

            if status_code == 423 {
                return Err("BANNED: Account suspended".to_string());
            }

            return Err(format!(
                "getUsageLimits failed - HTTP {}: {}",
                status_code, body
            ));
        }

        response
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {}", e))
    }

    /// 多区域探测获取企业账号的 usage 数据
    pub async fn get_usage_limits_with_region_probe(
        &self,
        access_token: &str,
        machine_id: &str,
    ) -> Result<(serde_json::Value, String), String> {
        let regions = get_usage_probe_regions();

        for region in regions {
            match self
                .get_usage_limits(access_token, machine_id, region, None, None, None)
                .await
            {
                Ok(data) => return Ok((data, region.to_string())),
                Err(e) if e.starts_with("AUTH_ERROR") && e.contains("403") => continue,
                Err(e) => return Err(e),
            }
        }

        Err("Failed to find account in any region (all returned 403)".to_string())
    }

    /// ListAvailableModels 接口
    pub async fn list_available_models(
        &self,
        access_token: &str,
        machine_id: &str,
        region: &str,
        profile_arn: Option<&str>,
        auth_method: Option<&str>,
        provider: Option<&str>,
        model_provider: Option<&str>,
        next_token: Option<&str>,
    ) -> Result<serde_json::Value, String> {
        let user_agent = build_kiro_custom_user_agent(machine_id);
        let mut url = format!(
            "{}/ListAvailableModels?origin=AI_EDITOR&maxResults=50",
            build_q_service_url(region)
        );

        if let Some(arn) = profile_arn.filter(|s| !s.trim().is_empty()) {
            url = format!("{}&profileArn={}", url, urlencoding::encode(arn));
        }

        if let Some(mp) = model_provider.filter(|s| !s.trim().is_empty()) {
            url = format!("{}&modelProvider={}", url, urlencoding::encode(mp));
        }

        if let Some(token) = next_token.filter(|s| !s.trim().is_empty()) {
            url = format!("{}&nextToken={}", url, urlencoding::encode(token));
        }

        let request = apply_kiro_runtime_headers(
            self.client.get(&url),
            access_token,
            &user_agent,
            "application/json",
            auth_method,
            provider,
        );

        let response = request
            .send()
            .await
            .map_err(|e| format!("ListAvailableModels 请求失败: {}", e))?;

        let status = response.status();
        let status_code = status.as_u16();

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();

            if status_code == 401 {
                return Err("AUTH_ERROR: ListAvailableModels failed (401)".to_string());
            }

            if status_code == 403 {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&body) {
                    let reason = parsed.get("reason").and_then(|r| r.as_str());
                    if reason == Some("TEMPORARILY_SUSPENDED") {
                        let message = parsed
                            .get("message")
                            .and_then(|m| m.as_str())
                            .unwrap_or("账号已被封禁");
                        return Err(format!("BANNED: {}", message));
                    }
                }
                return Err(format!("AUTH_ERROR: ListAvailableModels 403: {}", body));
            }

            if status_code == 423 {
                return Err("BANNED: Account suspended".to_string());
            }

            return Err(format!(
                "ListAvailableModels failed - HTTP {}: {}",
                status_code, body
            ));
        }

        response
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {}", e))
    }

    /// MCP 接口 - JSON-RPC 2.0 格式
    pub async fn call_mcp(
        &self,
        access_token: &str,
        machine_id: &str,
        region: &str,
        profile_arn: Option<&str>,
        auth_method: Option<&str>,
        provider: Option<&str>,
        json_rpc_request: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let user_agent = build_kiro_custom_user_agent(machine_id);
        let url = format!("{}/mcp", build_q_service_url(region));

        let mut request = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .header("authorization", format!("Bearer {}", access_token))
            .header("x-amz-user-agent", &user_agent);

        if let Some(arn) = profile_arn.filter(|s| !s.trim().is_empty()) {
            request = request.header("x-amzn-kiro-profilearn", arn);
        }

        if let Some(method) = auth_method.filter(|s| !s.trim().is_empty()) {
            request = request.header("x-amzn-kiro-authmethod", method);
        }

        if let Some(prov) = provider.filter(|s| !s.trim().is_empty()) {
            request = request.header("x-amzn-kiro-provider", prov);
        }

        let response = request
            .json(&json_rpc_request)
            .send()
            .await
            .map_err(|e| format!("MCP 请求失败: {}", e))?;

        let status = response.status();
        let status_code = status.as_u16();

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();

            if status_code == 401 {
                return Err("AUTH_ERROR: MCP failed (401)".to_string());
            }

            if status_code == 403 {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&body) {
                    let reason = parsed.get("reason").and_then(|r| r.as_str()).unwrap_or("");
                    let message = parsed
                        .get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("账号已被封禁");

                    if reason == "TEMPORARILY_SUSPENDED" {
                        return Err(format!("BANNED: {}", message));
                    }
                }
                return Err(format!("AUTH_ERROR: MCP 403: {}", body));
            }

            if status_code == 423 {
                return Err("BANNED: Account suspended".to_string());
            }

            return Err(format!("MCP failed - HTTP {}: {}", status_code, body));
        }

        response
            .json()
            .await
            .map_err(|e| format!("Failed to parse JSON: {}", e))
    }
}
