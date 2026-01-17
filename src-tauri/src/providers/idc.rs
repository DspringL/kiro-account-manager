// IdC Provider - BuilderId/Enterprise 登录
// 使用 Authorization Code Flow（跟 Kiro Desktop 一致）

use crate::aws_sso_client::{AWSSSOClient, GRANT_SCOPES};
use crate::browser::open_browser;
use crate::auth_social::{generate_code_verifier_social, generate_code_challenge_social};
use sha1::{Sha1, Digest};
use super::{AuthResult, AuthProvider, RefreshMetadata};
use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::oneshot;

const BUILDER_ID_START_URL: &str = "https://view.awsapps.com/start";
const INTERNAL_SSO_START_URL: &str = "https://amzn.awsapps.com/start";

pub struct IdcProvider {
    provider_id: String,
    region: String,
    start_url: Option<String>,
}

impl IdcProvider {
    pub fn new(provider_id: &str, region: &str, start_url: Option<String>) -> Self {
        Self {
            provider_id: provider_id.to_string(),
            region: region.to_string(),
            start_url,
        }
    }

    /// 获取 start URL（跟 Kiro 一样的逻辑）
    fn get_start_url(&self) -> &str {
        if let Some(ref url) = self.start_url {
            return url;
        }
        if self.provider_id == "BuilderId" {
            BUILDER_ID_START_URL
        } else {
            INTERNAL_SSO_START_URL
        }
    }

    /// 计算 clientIdHash（跟 Kiro 一样用 SHA1）
    fn compute_client_id_hash(start_url: &str) -> String {
        let input = serde_json::json!({ "startUrl": start_url }).to_string();
        let mut hasher = Sha1::new();
        hasher.update(input.as_bytes());
        let hash = hasher.finalize();
        hex::encode(hash)
    }

    /// 构建 scopes 字符串
    fn get_scopes() -> String {
        GRANT_SCOPES.join(",")
    }
}

#[async_trait]
impl AuthProvider for IdcProvider {
    async fn login(&self) -> Result<AuthResult, String> {
        let provider = &self.provider_id;
        let region = &self.region;
        let start_url = self.get_start_url();

        #[cfg(debug_assertions)]
        println!("\n[IdC] Starting {} authentication (Authorization Code Flow)...", provider);
        #[cfg(debug_assertions)]
        println!("[IdC] Region: {}, Start URL: {}", region, start_url);

        // Step 1: 创建 AWS SSO 客户端
        let sso_client = AWSSSOClient::new(region);

        // Step 2: 启动本地 HTTP 服务器接收回调
        let (tx, rx) = oneshot::channel::<Result<(String, String), String>>();
        let tx = Arc::new(std::sync::Mutex::new(Some(tx)));
        
        // 生成 state
        let state = uuid::Uuid::new_v4().to_string();
        let state_clone = state.clone();
        let tx_clone = tx.clone();

        // 启动本地服务器
        let server = tiny_http::Server::http("127.0.0.1:0")
            .map_err(|e| format!("无法启动本地服务器: {}", e))?;
        let port = server.server_addr().to_ip().map(|a| a.port()).unwrap_or(0);
        let redirect_uri = format!("http://127.0.0.1:{}/oauth/callback", port);

        #[cfg(debug_assertions)]
        println!("[IdC] Local server started on port {}", port);

        // Step 3: 注册客户端（Authorization Code Flow）
        #[cfg(debug_assertions)]
        println!("[IdC] Registering auth code client...");
        let client_reg = sso_client.register_client(start_url, &redirect_uri).await?;
        
        #[cfg(debug_assertions)]
        println!("[IdC] Client ID: {}", client_reg.client_id);

        // Step 4: 生成 PKCE
        let code_verifier = generate_code_verifier_social();
        let code_challenge = generate_code_challenge_social(&code_verifier);

        // Step 5: 构建授权 URL（跟 Kiro 一样）
        let scopes = Self::get_scopes();
        let authorize_url = format!(
            "{}?response_type=code&client_id={}&redirect_uri={}&scopes={}&state={}&code_challenge={}&code_challenge_method=S256",
            sso_client.get_authorize_url(),
            client_reg.client_id,
            urlencoding::encode(&redirect_uri),
            urlencoding::encode(&scopes),
            &state,
            &code_challenge
        );

        #[cfg(debug_assertions)]
        println!("[IdC] Opening browser for authorization...");

        // Step 6: 打开浏览器
        open_browser(&authorize_url)?;

        // Step 7: 在后台线程等待回调
        let server = Arc::new(server);
        let server_clone = server.clone();
        
        std::thread::spawn(move || {
            // 设置 10 分钟超时
            let timeout = std::time::Duration::from_secs(600);
            let start = std::time::Instant::now();
            
            loop {
                if start.elapsed() > timeout {
                    if let Some(tx) = tx_clone.lock().expect("Failed to acquire callback lock").take() {
                        let _ = tx.send(Err("授权超时".to_string()));
                    }
                    break;
                }

                // 非阻塞接收请求
                if let Ok(Some(request)) = server_clone.try_recv() {
                    let url = request.url().to_string();
                    
                    if url.starts_with("/oauth/callback") {
                        // 解析 URL 参数
                        let query = url.split('?').nth(1).unwrap_or("");
                        let params: std::collections::HashMap<_, _> = query
                            .split('&')
                            .filter_map(|p| {
                                let mut parts = p.splitn(2, '=');
                                Some((parts.next()?, parts.next()?))
                            })
                            .collect();

                        // 返回成功页面
                        let response = tiny_http::Response::from_string(
                            "<html><body><h1>授权成功</h1><p>您可以关闭此窗口</p></body></html>"
                        ).with_header(
                            tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).expect("Failed to create header")
                        );
                        let _ = request.respond(response);

                        // 验证 state
                        if let Some(returned_state) = params.get("state") {
                            if *returned_state != state_clone {
                                if let Some(tx) = tx_clone.lock().expect("Failed to acquire callback lock").take() {
                                    let _ = tx.send(Err("State 不匹配".to_string()));
                                }
                                break;
                            }
                        }

                        // 检查错误
                        if let Some(error) = params.get("error") {
                            if let Some(tx) = tx_clone.lock().expect("Failed to acquire callback lock").take() {
                                let desc = params.get("error_description").unwrap_or(&"未知错误");
                                let _ = tx.send(Err(format!("{}: {}", error, desc)));
                            }
                            break;
                        }

                        // 获取 code
                        if let Some(code) = params.get("code") {
                            if let Some(tx) = tx_clone.lock().expect("Failed to acquire callback lock").take() {
                                let _ = tx.send(Ok((code.to_string(), state_clone.clone())));
                            }
                        } else if let Some(tx) = tx_clone.lock().expect("Failed to acquire callback lock").take() {
                            let _ = tx.send(Err("未收到授权码".to_string()));
                        }
                        break;
                    }
                }
                
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        });

        // Step 8: 等待回调
        #[cfg(debug_assertions)]
        println!("[IdC] Waiting for authorization callback...");
        
        let (code, _) = rx.await
            .map_err(|_| "等待授权回调失败".to_string())??;

        #[cfg(debug_assertions)]
        println!("[IdC] Authorization code received");

        // Step 9: 用授权码换 Token
        #[cfg(debug_assertions)]
        println!("[IdC] Exchanging code for token...");
        
        let token_response = sso_client.create_token(
            &client_reg.client_id,
            &client_reg.client_secret,
            &code,
            &code_verifier,
            &redirect_uri,
        ).await?;

        // Step 10: 构建 AuthResult
        let expires_at = chrono::Local::now() + chrono::Duration::seconds(token_response.expires_in);
        let client_id_hash = Self::compute_client_id_hash(start_url);

        #[cfg(debug_assertions)]
        println!("[IdC] {} login successful!", provider);

        Ok(AuthResult {
            access_token: token_response.access_token,
            refresh_token: token_response.refresh_token,
            expires_at: expires_at.format("%Y/%m/%d %H:%M:%S").to_string(),
            provider: provider.clone(),
            auth_method: "IdC".to_string(),
            id_token: token_response.id_token,
            token_type: token_response.token_type,
            expires_in: token_response.expires_in,
            region: Some(region.clone()),
            client_id: Some(client_reg.client_id),
            client_secret: Some(client_reg.client_secret),
            client_id_hash: Some(client_id_hash),
            sso_session_id: token_response.aws_sso_app_session_id,
            profile_arn: None,
            csrf_token: None,
            session_token: None,
        })
    }

    async fn refresh_token(&self, refresh_token: &str, metadata: RefreshMetadata) -> Result<AuthResult, String> {
        // IdC 刷新需要 client_id 和 client_secret
        let client_id = metadata.client_id.ok_or("Client ID is required for IdC token refresh")?;
        let client_secret = metadata.client_secret.ok_or("Client secret is required for IdC token refresh")?;
        let region = metadata.region.as_deref().unwrap_or(&self.region);

        let sso_client = AWSSSOClient::new(region);
        let token_response = sso_client.refresh_token(&client_id, &client_secret, refresh_token).await?;

        let expires_at = chrono::Local::now() + chrono::Duration::seconds(token_response.expires_in);
        let client_id_hash = metadata.client_id_hash.unwrap_or_else(|| Self::compute_client_id_hash(self.get_start_url()));

        Ok(AuthResult {
            access_token: token_response.access_token,
            refresh_token: token_response.refresh_token,
            expires_at: expires_at.format("%Y/%m/%d %H:%M:%S").to_string(),
            provider: self.provider_id.clone(),
            auth_method: "IdC".to_string(),
            id_token: token_response.id_token,
            token_type: token_response.token_type,
            expires_in: token_response.expires_in,
            region: Some(region.to_string()),
            client_id: Some(client_id),
            client_secret: Some(client_secret),
            client_id_hash: Some(client_id_hash),
            sso_session_id: token_response.aws_sso_app_session_id,
            profile_arn: None,
            csrf_token: None,
            session_token: None,
        })
    }

    fn get_provider_id(&self) -> &str {
        &self.provider_id
    }

    fn get_auth_method(&self) -> &str {
        "IdC"
    }
}
