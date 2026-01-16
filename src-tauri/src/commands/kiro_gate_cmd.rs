// KiroGate 服务器命令

use crate::kiro_gate::{start_server, stop_server, get_server_status, ServerStatus};
use crate::kiro_gate::metrics::{MetricsData, METRICS};
use crate::kiro_gate::auth::{TokenConfig, TokenManager};
use crate::kiro_portal_client::KiroPortalClient;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartServerParams {
  pub port: u16,
  pub proxy_api_key: String,
}

// ============================================================
// KiroGate Token 管理
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KiroGateToken {
  pub id: String,
  pub name: String,
  pub refresh_token: String,
  #[serde(default)]
  pub auth_method: String, // "social" 或 "IdC"
  #[serde(skip_serializing_if = "Option::is_none")]
  pub profile_arn: Option<String>, // Social 需要
  #[serde(skip_serializing_if = "Option::is_none")]
  pub client_id: Option<String>, // IdC 需要
  #[serde(skip_serializing_if = "Option::is_none")]
  pub client_secret: Option<String>, // IdC 需要
  #[serde(skip_serializing_if = "Option::is_none")]
  pub region: Option<String>, // IdC 需要，默认 us-east-1
  pub created_at: String,
}

fn get_data_dir() -> PathBuf {
  dirs::data_dir().unwrap_or_else(|| {
    let home = std::env::var("USERPROFILE")
      .or_else(|_| std::env::var("HOME"))
      .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home)
  }).join(".kiro-account-manager")
}

fn get_tokens_path() -> PathBuf {
  get_data_dir().join("kirogate-tokens.json")
}

fn load_tokens() -> Vec<KiroGateToken> {
  let path = get_tokens_path();
  if !path.exists() {
    return Vec::new();
  }
  std::fs::read_to_string(&path)
    .ok()
    .and_then(|c| serde_json::from_str(&c).ok())
    .unwrap_or_default()
}

fn save_tokens(tokens: &[KiroGateToken]) -> Result<(), String> {
  let path = get_tokens_path();
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent).ok();
  }
  let content = serde_json::to_string_pretty(tokens)
    .map_err(|e| format!("序列化失败: {}", e))?;
  std::fs::write(&path, content)
    .map_err(|e| format!("写入失败: {}", e))
}

#[tauri::command]
pub async fn get_kiro_gate_tokens() -> Result<Vec<KiroGateToken>, String> {
  Ok(load_tokens())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddTokenParams {
  pub name: Option<String>,
  pub refresh_token: String,
  #[serde(default)]
  pub auth_method: String,
  pub profile_arn: Option<String>,
  pub client_id: Option<String>,
  pub client_secret: Option<String>,
  pub region: Option<String>,
}

#[tauri::command]
pub async fn add_kiro_gate_token(params: AddTokenParams) -> Result<KiroGateToken, String> {
  let mut tokens = load_tokens();
  let auth_method = if params.auth_method.is_empty() { "social".to_string() } else { params.auth_method };
  
  // 自动生成名称
  let name = params.name.unwrap_or_else(|| {
    let count = tokens.len() + 1;
    if auth_method == "IdC" {
      format!("BuilderId Token {}", count)
    } else {
      format!("Social Token {}", count)
    }
  });

  let token = KiroGateToken {
    id: uuid::Uuid::new_v4().to_string(),
    name,
    refresh_token: params.refresh_token,
    auth_method,
    profile_arn: params.profile_arn,
    client_id: params.client_id,
    client_secret: params.client_secret,
    region: params.region,
    created_at: chrono::Utc::now().to_rfc3339(),
  };
  tokens.push(token.clone());
  save_tokens(&tokens)?;
  Ok(token)
}

#[tauri::command]
pub async fn update_kiro_gate_token(id: String, name: String, refresh_token: String) -> Result<(), String> {
  let mut tokens = load_tokens();
  if let Some(t) = tokens.iter_mut().find(|t| t.id == id) {
    t.name = name;
    t.refresh_token = refresh_token;
    save_tokens(&tokens)?;
    Ok(())
  } else {
    Err("Token 不存在".to_string())
  }
}

#[tauri::command]
pub async fn delete_kiro_gate_token(id: String) -> Result<(), String> {
  let mut tokens = load_tokens();
  tokens.retain(|t| t.id != id);
  save_tokens(&tokens)?;
  Ok(())
}

/// 启动 KiroGate 服务器
#[tauri::command]
pub async fn start_kiro_gate(params: StartServerParams) -> Result<ServerStatus, String> {
  start_server(params.port, params.proxy_api_key).await?;
  Ok(get_server_status().await)
}

/// 停止 KiroGate 服务器
#[tauri::command]
pub async fn stop_kiro_gate() -> Result<(), String> {
  stop_server().await
}

/// 获取 KiroGate 服务器状态
#[tauri::command]
pub async fn get_kiro_gate_status() -> ServerStatus {
  get_server_status().await
}

/// 获取 KiroGate 统计数据
#[tauri::command]
pub async fn get_kiro_gate_metrics() -> MetricsData {
  METRICS.get_metrics()
}

// ============================================================
// API Key 管理
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyMapping {
  pub id: String,
  pub api_key: String,
  pub token_id: String,
  pub token_name: String,
  pub created_at: String,
}

fn get_api_keys_path() -> PathBuf {
  get_data_dir().join("kirogate-api-keys.json")
}

fn load_api_keys() -> Vec<ApiKeyMapping> {
  let path = get_api_keys_path();
  if !path.exists() {
    return Vec::new();
  }
  std::fs::read_to_string(&path)
    .ok()
    .and_then(|c| serde_json::from_str(&c).ok())
    .unwrap_or_default()
}

fn save_api_keys(keys: &[ApiKeyMapping]) -> Result<(), String> {
  let path = get_api_keys_path();
  if let Some(parent) = path.parent() {
    std::fs::create_dir_all(parent).ok();
  }
  let content = serde_json::to_string_pretty(keys)
    .map_err(|e| format!("序列化失败: {}", e))?;
  std::fs::write(&path, content)
    .map_err(|e| format!("写入失败: {}", e))
}

#[tauri::command]
pub async fn get_api_keys() -> Result<Vec<ApiKeyMapping>, String> {
  Ok(load_api_keys())
}

#[tauri::command]
pub async fn generate_api_key(token_id: String) -> Result<ApiKeyMapping, String> {
  let tokens = load_tokens();
  let token = tokens.iter().find(|t| t.id == token_id)
    .ok_or("Token 不存在")?;
  
  // 生成 sk-{48位十六进制} 格式
  let random_bytes: Vec<u8> = (0..24).map(|_| rand::random::<u8>()).collect();
  let hex_string: String = random_bytes.iter().map(|b| format!("{:02x}", b)).collect();
  let api_key = format!("sk-{}", hex_string);
  
  let mapping = ApiKeyMapping {
    id: uuid::Uuid::new_v4().to_string(),
    api_key,
    token_id: token.id.clone(),
    token_name: token.name.clone(),
    created_at: chrono::Utc::now().to_rfc3339(),
  };
  
  let mut keys = load_api_keys();
  keys.push(mapping.clone());
  save_api_keys(&keys)?;
  
  Ok(mapping)
}

#[tauri::command]
pub async fn delete_api_key(id: String) -> Result<(), String> {
  let mut keys = load_api_keys();
  keys.retain(|k| k.id != id);
  save_api_keys(&keys)?;
  Ok(())
}

#[tauri::command]
pub async fn find_token_by_api_key(api_key: String) -> Result<Option<KiroGateToken>, String> {
  let keys = load_api_keys();
  let mapping = keys.iter().find(|k| k.api_key == api_key);
  
  if let Some(m) = mapping {
    let tokens = load_tokens();
    Ok(tokens.iter().find(|t| t.id == m.token_id).cloned())
  } else {
    Ok(None)
  }
}

// ============================================================
// Token 配额查询
// ============================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TokenUsageInfo {
  pub token_id: String,
  pub email: Option<String>,
  pub subscription_type: Option<String>,
  pub usage_limit: Option<i32>,
  pub current_usage: Option<i32>,
  pub days_until_reset: Option<i32>,
  pub free_trial_limit: Option<i32>,
  pub free_trial_usage: Option<i32>,
  pub bonus_limit: Option<f64>,
  pub bonus_usage: Option<f64>,
  pub error: Option<String>,
}

/// 获取单个 Token 的配额信息
#[tauri::command]
pub async fn get_kiro_gate_token_usage(token_id: String) -> Result<TokenUsageInfo, String> {
  let tokens = load_tokens();
  let token = tokens.iter().find(|t| t.id == token_id)
    .ok_or("Token 不存在")?;
  
  // 构建 TokenConfig
  let config = TokenConfig {
    refresh_token: token.refresh_token.clone(),
    auth_method: if token.auth_method.is_empty() { "social".to_string() } else { token.auth_method.clone() },
    profile_arn: token.profile_arn.clone(),
    client_id: token.client_id.clone(),
    client_secret: token.client_secret.clone(),
    region: token.region.clone(),
  };
  
  // 获取 access_token
  let token_manager = TokenManager::new(config);
  let access_token = match token_manager.get_access_token().await {
    Ok(t) => t,
    Err(e) => {
      return Ok(TokenUsageInfo {
        token_id,
        email: None,
        subscription_type: None,
        usage_limit: None,
        current_usage: None,
        days_until_reset: None,
        free_trial_limit: None,
        free_trial_usage: None,
        bonus_limit: None,
        bonus_usage: None,
        error: Some(e),
      });
    }
  };
  
  // 确定 idp
  let idp = if token.auth_method == "IdC" { "BuilderId" } else { "Google" };
  
  // 调用 KiroPortalClient 获取配额
  let client = KiroPortalClient::new();
  match client.get_user_usage_and_limits(&access_token, idp).await {
    Ok(resp) => {
      let email = resp.user_info.as_ref().and_then(|u| u.email.clone());
      let subscription_type = resp.subscription_info.as_ref().and_then(|s| s.subscription_type.clone());
      let days_until_reset = resp.days_until_reset;
      
      // 优先从 usageBreakdownList 获取，否则从 usageBreakdown 获取
      let breakdown = resp.usage_breakdown_list.as_ref()
        .and_then(|list| list.first())
        .or(resp.usage_breakdown.as_ref());
      
      // 主配额
      let (usage_limit, current_usage) = breakdown
        .map(|b| (b.usage_limit, b.current_usage))
        .unwrap_or((None, None));
      
      // 试用配额
      let (free_trial_limit, free_trial_usage) = breakdown
        .and_then(|b| b.free_trial_info.as_ref())
        .map(|f| (f.usage_limit, f.current_usage))
        .unwrap_or((None, None));
      
      // 奖励配额（合计）
      let (bonus_limit, bonus_usage) = breakdown
        .and_then(|b| b.bonuses.as_ref())
        .filter(|bonuses| !bonuses.is_empty())
        .map(|bonuses| {
          let total_limit: f64 = bonuses.iter().filter_map(|b| b.usage_limit).sum();
          let total_usage: f64 = bonuses.iter().filter_map(|b| b.current_usage).sum();
          (Some(total_limit), Some(total_usage))
        })
        .unwrap_or((None, None));
      
      Ok(TokenUsageInfo {
        token_id,
        email,
        subscription_type,
        usage_limit,
        current_usage,
        days_until_reset,
        free_trial_limit,
        free_trial_usage,
        bonus_limit,
        bonus_usage,
        error: None,
      })
    }
    Err(e) => {
      Ok(TokenUsageInfo {
        token_id,
        email: None,
        subscription_type: None,
        usage_limit: None,
        current_usage: None,
        days_until_reset: None,
        free_trial_limit: None,
        free_trial_usage: None,
        bonus_limit: None,
        bonus_usage: None,
        error: Some(e),
      })
    }
  }
}
