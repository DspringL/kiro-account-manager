//! HTTP 客户端公共模块
//! 提供统一的 HTTP 客户端构建，支持代理配置

use reqwest::{Client, Proxy};
use std::time::Duration;

/// 获取 Kiro IDE 设置中的代理
fn get_proxy_from_kiro_settings() -> Option<String> {
    #[cfg(target_os = "windows")]
    let path = std::env::var("APPDATA").ok().map(|appdata| {
        std::path::PathBuf::from(appdata).join("Kiro").join("User").join("settings.json")
    });
    
    #[cfg(target_os = "macos")]
    let path = std::env::var("HOME").ok().map(|home| {
        std::path::PathBuf::from(home)
            .join("Library")
            .join("Application Support")
            .join("Kiro")
            .join("User")
            .join("settings.json")
    });
    
    #[cfg(target_os = "linux")]
    let path = std::env::var("HOME").ok().map(|home| {
        std::path::PathBuf::from(home)
            .join(".config")
            .join("Kiro")
            .join("User")
            .join("settings.json")
    });
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    let path: Option<std::path::PathBuf> = None;
    
    path.and_then(|p| {
        if p.exists() {
            std::fs::read_to_string(&p).ok()
        } else {
            None
        }
    })
    .and_then(|content| {
        serde_json::from_str::<serde_json::Value>(&content).ok()
    })
    .and_then(|json| {
        json.get("http.proxy")
            .and_then(|v| v.as_str())
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
    })
}

/// 构建 HTTP 客户端（支持代理、超时配置）
pub fn build_http_client() -> Result<Client, String> {
    build_http_client_with_timeout(30, 10)
}

/// 构建 HTTP 客户端（自定义超时）
pub fn build_http_client_with_timeout(timeout_secs: u64, connect_timeout_secs: u64) -> Result<Client, String> {
    let mut builder = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .connect_timeout(Duration::from_secs(connect_timeout_secs));
    
    // 尝试从 Kiro 设置获取代理
    if let Some(proxy_url) = get_proxy_from_kiro_settings() {
        if let Ok(proxy) = Proxy::all(&proxy_url) {
            builder = builder.proxy(proxy);
        }
    }
    
    builder.build().map_err(|e| format!("Failed to create HTTP client: {}", e))
}

/// 构建 HTTP 客户端（带 User-Agent）
pub fn build_http_client_with_user_agent(user_agent: &str) -> Result<Client, String> {
    let mut builder = Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(10))
        .user_agent(user_agent);
    
    // 尝试从 Kiro 设置获取代理
    if let Some(proxy_url) = get_proxy_from_kiro_settings() {
        if let Ok(proxy) = Proxy::all(&proxy_url) {
            builder = builder.proxy(proxy);
        }
    }
    
    builder.build().map_err(|e| format!("Failed to create HTTP client: {}", e))
}
