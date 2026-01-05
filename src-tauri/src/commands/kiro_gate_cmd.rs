// KiroGate 服务器命令

use crate::kiro_gate::{start_server, stop_server, get_server_status, ServerStatus};
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
