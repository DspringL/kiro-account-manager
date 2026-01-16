// KiroGate HTTP 服务器

use axum::{
  extract::{Json, State},
  http::{header, HeaderMap, Method, StatusCode},
  response::{IntoResponse, Response},
  routing::{get, post},
  Router,
};
use reqwest::Client;
use serde::Serialize;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{oneshot, RwLock};
use tower_http::cors::{Any, CorsLayer};

use crate::kiro_gate::auth::{AuthCache, TokenConfig};
use crate::kiro_gate::converter::{build_kiro_payload, get_available_models, anthropic_to_openai};
use crate::kiro_gate::metrics::METRICS;
use crate::kiro_gate::models::*;
use crate::commands::kiro_gate_cmd::KiroGateToken;

// ============================================================
// 服务器状态
// ============================================================

#[derive(Debug, Clone, Serialize)]
pub struct ServerStatus {
  pub running: bool,
  pub port: u16,
  pub url: String,
}

struct ServerState {
  proxy_api_key: String,
  auth_cache: AuthCache,
  http_client: Client,
}

// 全局服务器句柄
static SERVER_HANDLE: RwLock<Option<ServerHandle>> = RwLock::const_new(None);

struct ServerHandle {
  shutdown_tx: oneshot::Sender<()>,
  port: u16,
}

// ============================================================
// 公开 API
// ============================================================

/// 启动服务器
pub async fn start_server(port: u16, proxy_api_key: String) -> Result<(), String> {
  // 检查是否已运行
  {
    let handle = SERVER_HANDLE.read().await;
    if handle.is_some() {
      return Err("服务器已在运行".to_string());
    }
  }

  let http_client = Client::builder()
    .timeout(Duration::from_secs(300))
    .build()
    .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

  let state = Arc::new(ServerState {
    proxy_api_key,
    auth_cache: AuthCache::new(),
    http_client,
  });

  let cors = CorsLayer::new()
    .allow_origin(Any)
    .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
    .allow_headers(Any)
    .expose_headers(Any)
    .max_age(Duration::from_secs(3600));

  let app = Router::new()
    .route("/", get(health_handler))
    .route("/health", get(health_handler))
    .route("/v1/models", get(models_handler))
    .route("/v1/chat/completions", post(chat_completions_handler))
    .route("/v1/messages", post(anthropic_messages_handler))
    .route("/metrics", get(metrics_handler))
    .layer(cors)
    .with_state(state);

  let addr = SocketAddr::from(([127, 0, 0, 1], port));
  
  let listener = tokio::net::TcpListener::bind(addr)
    .await
    .map_err(|e| format!("绑定端口 {} 失败: {}", port, e))?;

  let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

  // 保存句柄
  {
    let mut handle = SERVER_HANDLE.write().await;
    *handle = Some(ServerHandle { shutdown_tx, port });
  }

  // 启动服务器
  tokio::spawn(async move {
    axum::serve(listener, app)
      .with_graceful_shutdown(async {
        let _ = shutdown_rx.await;
      })
      .await
      .ok();
    
    // 清理句柄
    let mut handle = SERVER_HANDLE.write().await;
    *handle = None;
  });

  Ok(())
}

/// 停止服务器
pub async fn stop_server() -> Result<(), String> {
  let mut handle = SERVER_HANDLE.write().await;
  
  if let Some(h) = handle.take() {
    let _ = h.shutdown_tx.send(());
    Ok(())
  } else {
    Err("服务器未运行".to_string())
  }
}

/// 获取服务器状态
pub async fn get_server_status() -> ServerStatus {
  let handle = SERVER_HANDLE.read().await;
  
  if let Some(h) = handle.as_ref() {
    ServerStatus {
      running: true,
      port: h.port,
      url: format!("http://127.0.0.1:{}", h.port),
    }
  } else {
    ServerStatus {
      running: false,
      port: 0,
      url: String::new(),
    }
  }
}

// ============================================================
// 路由处理器
// ============================================================

async fn health_handler() -> impl IntoResponse {
  Json(serde_json::json!({
    "status": "ok",
    "message": "KiroGate is running",
    "version": "1.0.0"
  }))
}

async fn models_handler(
  State(state): State<Arc<ServerState>>,
  headers: HeaderMap,
) -> Response {
  // 验证 API Key
  let verify_result = match verify_api_key(&headers, &state.proxy_api_key) {
    Ok(result) => result,
    Err(_) => {
      // 无 API Key 时返回静态列表
      return Json(ModelsResponse {
        object: "list".to_string(),
        data: get_available_models(),
      }).into_response();
    }
  };

  // 构建 TokenConfig
  let config = TokenConfig {
    refresh_token: verify_result.refresh_token.clone(),
    auth_method: verify_result.auth_method.clone(),
    profile_arn: verify_result.profile_arn.clone(),
    client_id: verify_result.client_id.clone(),
    client_secret: verify_result.client_secret.clone(),
    region: verify_result.region.clone(),
  };

  // 获取 TokenManager
  let token_manager = state.auth_cache.get_or_create(&verify_result.refresh_token, config).await;
  
  // 获取 access_token
  let access_token = match token_manager.get_access_token().await {
    Ok(token) => token,
    Err(_) => {
      // Token 获取失败时返回静态列表
      return Json(ModelsResponse {
        object: "list".to_string(),
        data: get_available_models(),
      }).into_response();
    }
  };

  // 调用 Kiro API 获取模型列表
  let region = verify_result.region.as_deref().unwrap_or("us-east-1");
  let url = format!("https://q.{}.amazonaws.com/ListAvailableModels?origin=AI_EDITOR", region);
  
  let resp = match state.http_client
    .get(&url)
    .header("Authorization", format!("Bearer {}", access_token))
    .timeout(std::time::Duration::from_secs(10))
    .send()
    .await
  {
    Ok(r) => r,
    Err(_) => {
      return Json(ModelsResponse {
        object: "list".to_string(),
        data: get_available_models(),
      }).into_response();
    }
  };

  if !resp.status().is_success() {
    return Json(ModelsResponse {
      object: "list".to_string(),
      data: get_available_models(),
    }).into_response();
  }

  // 解析响应
  let body = match resp.text().await {
    Ok(b) => b,
    Err(_) => {
      return Json(ModelsResponse {
        object: "list".to_string(),
        data: get_available_models(),
      }).into_response();
    }
  };

  // 解析 Kiro 模型列表
  #[derive(serde::Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct KiroModel {
    model_id: String,
  }
  
  #[derive(serde::Deserialize)]
  struct KiroModelsResponse {
    models: Vec<KiroModel>,
  }

  let kiro_models: KiroModelsResponse = match serde_json::from_str(&body) {
    Ok(m) => m,
    Err(_) => {
      return Json(ModelsResponse {
        object: "list".to_string(),
        data: get_available_models(),
      }).into_response();
    }
  };

  // 转换为 OpenAI 格式
  let models: Vec<ModelInfo> = kiro_models.models.iter().map(|m| ModelInfo {
    id: m.model_id.clone(),
    object: "model".to_string(),
    created: 1700000000,
    owned_by: "anthropic".to_string(),
  }).collect();

  Json(ModelsResponse {
    object: "list".to_string(),
    data: models,
  }).into_response()
}

async fn metrics_handler() -> impl IntoResponse {
  Json(METRICS.get_metrics())
}

async fn chat_completions_handler(
  State(state): State<Arc<ServerState>>,
  headers: HeaderMap,
  Json(request): Json<ChatCompletionRequest>,
) -> Response {
  let start_time = std::time::Instant::now();
  let model = request.model.clone();
  let is_stream = request.stream;

  // 验证 API Key 并获取完整的 Token 信息
  let verify_result = match verify_api_key(&headers, &state.proxy_api_key) {
    Ok(result) => result,
    Err(e) => {
      METRICS.record_request("/v1/chat/completions", 401, start_time.elapsed().as_millis() as f64, &model, is_stream, "openai");
      return error_response(StatusCode::UNAUTHORIZED, &e);
    }
  };

  // 构建 TokenConfig（直接使用验证结果中的信息）
  let config = TokenConfig {
    refresh_token: verify_result.refresh_token.clone(),
    auth_method: verify_result.auth_method.clone(),
    profile_arn: verify_result.profile_arn.clone(),
    client_id: verify_result.client_id.clone(),
    client_secret: verify_result.client_secret.clone(),
    region: verify_result.region.clone(),
  };

  // 获取 TokenManager
  let token_manager = state.auth_cache.get_or_create(&verify_result.refresh_token, config).await;
  
  // 获取 access_token
  let access_token = match token_manager.get_access_token().await {
    Ok(token) => token,
    Err(e) => {
      METRICS.record_request("/v1/chat/completions", 401, start_time.elapsed().as_millis() as f64, &model, is_stream, "openai");
      return error_response(StatusCode::UNAUTHORIZED, &e);
    }
  };

  let profile_arn = token_manager.get_profile_arn().await;

  // 构建 Kiro payload
  let kiro_payload = match build_kiro_payload(&request, profile_arn) {
    Ok(p) => p,
    Err(e) => {
      METRICS.record_request("/v1/chat/completions", 400, start_time.elapsed().as_millis() as f64, &model, is_stream, "openai");
      return error_response(StatusCode::BAD_REQUEST, &e);
    }
  };

  // 根据 region 选择 API host
  let region = verify_result.region.as_deref().unwrap_or("us-east-1");
  let api_host = format!("https://codewhisperer.{}.amazonaws.com", region);
  let url = format!("{}/generateAssistantResponse", api_host);

  // 发送请求
  let resp = match state.http_client
    .post(&url)
    .header("Authorization", format!("Bearer {}", access_token))
    .header("Content-Type", "application/json")
    .header("Accept", "application/vnd.amazon.eventstream")
    .json(&kiro_payload)
    .send()
    .await
  {
    Ok(r) => r,
    Err(e) => {
      METRICS.record_request("/v1/chat/completions", 502, start_time.elapsed().as_millis() as f64, &model, is_stream, "openai");
      return error_response(StatusCode::BAD_GATEWAY, &format!("请求 Kiro API 失败: {}", e));
    }
  };

  if !resp.status().is_success() {
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    METRICS.record_request("/v1/chat/completions", status.as_u16(), start_time.elapsed().as_millis() as f64, &model, is_stream, "openai");
    return error_response(
      StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
      &format!("Kiro API 错误: {}", text),
    );
  }

  // 记录成功请求
  METRICS.record_request("/v1/chat/completions", 200, start_time.elapsed().as_millis() as f64, &model, is_stream, "openai");

  // 处理响应
  if request.stream {
    stream_response(resp, &request.model).await
  } else {
    non_stream_response(resp, &request.model).await
  }
}

// ============================================================
// Anthropic Messages API 端点
// ============================================================

async fn anthropic_messages_handler(
  State(state): State<Arc<ServerState>>,
  headers: HeaderMap,
  Json(request): Json<AnthropicMessagesRequest>,
) -> Response {
  let start_time = std::time::Instant::now();
  let model = request.model.clone();
  let is_stream = request.stream;

  // 验证 API Key（支持 x-api-key 和 Authorization 两种方式）
  let verify_result = match verify_anthropic_api_key(&headers, &state.proxy_api_key) {
    Ok(result) => result,
    Err(e) => {
      METRICS.record_request("/v1/messages", 401, start_time.elapsed().as_millis() as f64, &model, is_stream, "anthropic");
      return anthropic_error_response(StatusCode::UNAUTHORIZED, "authentication_error", &e);
    }
  };

  // 构建 TokenConfig
  let config = TokenConfig {
    refresh_token: verify_result.refresh_token.clone(),
    auth_method: verify_result.auth_method.clone(),
    profile_arn: verify_result.profile_arn.clone(),
    client_id: verify_result.client_id.clone(),
    client_secret: verify_result.client_secret.clone(),
    region: verify_result.region.clone(),
  };

  // 获取 TokenManager
  let token_manager = state.auth_cache.get_or_create(&verify_result.refresh_token, config).await;
  
  // 获取 access_token
  let access_token = match token_manager.get_access_token().await {
    Ok(token) => token,
    Err(e) => {
      METRICS.record_request("/v1/messages", 401, start_time.elapsed().as_millis() as f64, &model, is_stream, "anthropic");
      return anthropic_error_response(StatusCode::UNAUTHORIZED, "authentication_error", &e);
    }
  };

  let profile_arn = token_manager.get_profile_arn().await;

  // 转换为 OpenAI 格式，复用现有逻辑
  let openai_request = anthropic_to_openai(&request);

  // 构建 Kiro payload
  let kiro_payload = match build_kiro_payload(&openai_request, profile_arn) {
    Ok(p) => p,
    Err(e) => {
      METRICS.record_request("/v1/messages", 400, start_time.elapsed().as_millis() as f64, &model, is_stream, "anthropic");
      return anthropic_error_response(StatusCode::BAD_REQUEST, "invalid_request_error", &e);
    }
  };

  // 根据 region 选择 API host
  let region = verify_result.region.as_deref().unwrap_or("us-east-1");
  let api_host = format!("https://codewhisperer.{}.amazonaws.com", region);
  let url = format!("{}/generateAssistantResponse", api_host);

  // 发送请求
  let resp = match state.http_client
    .post(&url)
    .header("Authorization", format!("Bearer {}", access_token))
    .header("Content-Type", "application/json")
    .header("Accept", "application/vnd.amazon.eventstream")
    .json(&kiro_payload)
    .send()
    .await
  {
    Ok(r) => r,
    Err(e) => {
      METRICS.record_request("/v1/messages", 502, start_time.elapsed().as_millis() as f64, &model, is_stream, "anthropic");
      return anthropic_error_response(StatusCode::BAD_GATEWAY, "api_error", &format!("请求 Kiro API 失败: {}", e));
    }
  };

  if !resp.status().is_success() {
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    METRICS.record_request("/v1/messages", status.as_u16(), start_time.elapsed().as_millis() as f64, &model, is_stream, "anthropic");
    return anthropic_error_response(
      StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
      "api_error",
      &format!("Kiro API 错误: {}", text),
    );
  }

  // 记录成功请求
  METRICS.record_request("/v1/messages", 200, start_time.elapsed().as_millis() as f64, &model, is_stream, "anthropic");

  // 处理响应（转换为 Anthropic 格式）
  if request.stream {
    anthropic_stream_response(resp, &request.model).await
  } else {
    anthropic_non_stream_response(resp, &request.model).await
  }
}

// ============================================================
// 辅助函数
// ============================================================

/// 验证结果：包含完整的 Token 信息
struct VerifyResult {
  refresh_token: String,
  auth_method: String,
  profile_arn: Option<String>,
  client_id: Option<String>,
  client_secret: Option<String>,
  region: Option<String>,
}

fn verify_api_key(headers: &HeaderMap, proxy_api_key: &str) -> Result<VerifyResult, String> {
  let auth_header = headers
    .get(header::AUTHORIZATION)
    .and_then(|v| v.to_str().ok())
    .ok_or("缺少 Authorization 头")?;

  let token = if auth_header.starts_with("Bearer ") {
    &auth_header[7..]
  } else {
    auth_header
  };

  // 支持三种格式（按原版 KiroGate 逻辑）：
  // 1. 多租户格式：PROXY_API_KEY:REFRESH_TOKEN
  // 2. 传统格式：PROXY_API_KEY
  // 3. 用户 API Key：sk-{48位十六进制}
  
  // 检查是否包含冒号（多租户格式）
  if token.contains(':') {
    let parts: Vec<&str> = token.splitn(2, ':').collect();
    if parts.len() != 2 {
      return Err("API Key 格式无效".to_string());
    }
    
    // 验证 PROXY_API_KEY 部分
    if parts[0] != proxy_api_key {
      return Err("API Key 无效".to_string());
    }
    
    // 多租户模式默认为 Social 类型
    Ok(VerifyResult {
      refresh_token: parts[1].to_string(),
      auth_method: "social".to_string(),
      profile_arn: None,
      client_id: None,
      client_secret: None,
      region: Some("us-east-1".to_string()),
    })
  }
  // 检查传统格式：整个 token 就是 PROXY_API_KEY
  else if token == proxy_api_key {
    Err("传统模式需要服务器配置全局 REFRESH_TOKEN，请使用 PROXY_API_KEY:REFRESH_TOKEN 格式".to_string())
  }
  // 检查用户 API Key 格式：sk-{48位十六进制}
  else if token.starts_with("sk-") && token.len() == 51 {
    // 先检查 Token 池是否为空
    if is_token_pool_empty() {
      return Err("Token 池为空，请先在「Token」页面添加 Token".to_string());
    }
    // 用户 API Key 格式，查找完整的 Token 信息
    match find_token_by_api_key(token) {
      Some(kiro_token) => Ok(VerifyResult {
        refresh_token: kiro_token.refresh_token,
        auth_method: if kiro_token.auth_method.is_empty() { "social".to_string() } else { kiro_token.auth_method },
        profile_arn: kiro_token.profile_arn,
        client_id: kiro_token.client_id,
        client_secret: kiro_token.client_secret,
        region: kiro_token.region.or(Some("us-east-1".to_string())),
      }),
      None => Err("API Key 无效或已过期".to_string()),
    }
  }
  else {
    Err("API Key 格式无效".to_string())
  }
}

// 查找 API Key 对应的完整 Token 信息
fn find_token_by_api_key(api_key: &str) -> Option<KiroGateToken> {
  // 从 API Key 映射表查找
  let path = dirs::data_dir()
    .unwrap_or_else(|| std::path::PathBuf::from("."))
    .join(".kiro-account-manager")
    .join("kirogate-api-keys.json");
  
  if !path.exists() {
    return None;
  }

  let content = std::fs::read_to_string(&path).ok()?;
  
  #[derive(serde::Deserialize)]
  #[serde(rename_all = "camelCase")]
  struct ApiKeyMapping {
    api_key: String,
    token_id: String,
  }
  
  let mappings: Vec<ApiKeyMapping> = serde_json::from_str(&content).ok()?;
  let mapping = mappings.iter().find(|m| m.api_key == api_key)?;
  
  // 根据 token_id 查找完整的 Token 信息
  let tokens_path = dirs::data_dir()
    .unwrap_or_else(|| std::path::PathBuf::from("."))
    .join(".kiro-account-manager")
    .join("kirogate-tokens.json");
  
  let tokens_content = std::fs::read_to_string(&tokens_path).ok()?;
  let tokens: Vec<KiroGateToken> = serde_json::from_str(&tokens_content).ok()?;
  
  tokens.iter().find(|t| t.id == mapping.token_id).cloned()
}

// 检查 Token 池是否为空
fn is_token_pool_empty() -> bool {
  let tokens_path = dirs::data_dir()
    .unwrap_or_else(|| std::path::PathBuf::from("."))
    .join(".kiro-account-manager")
    .join("kirogate-tokens.json");
  
  if !tokens_path.exists() {
    return true;
  }
  
  match std::fs::read_to_string(&tokens_path) {
    Ok(content) => {
      match serde_json::from_str::<Vec<KiroGateToken>>(&content) {
        Ok(tokens) => tokens.is_empty(),
        Err(_) => true,
      }
    }
    Err(_) => true,
  }
}

fn error_response(status: StatusCode, message: &str) -> Response {
  let body = Json(ErrorResponse {
    error: ErrorDetail {
      message: message.to_string(),
      error_type: "api_error".to_string(),
      code: Some(status.as_u16() as i32),
    },
  });
  
  (status, body).into_response()
}

async fn stream_response(resp: reqwest::Response, model: &str) -> Response {
  let model = model.to_string();
  let id = format!("chatcmpl-{}", uuid::Uuid::new_v4());
  let created = chrono::Utc::now().timestamp();

  let stream = async_stream::stream! {
    let mut bytes_stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut sent_role = false;
    let mut last_content: Option<String> = None; // 去重
    
    use futures::StreamExt;
    
    while let Some(chunk_result) = bytes_stream.next().await {
      match chunk_result {
        Ok(bytes) => {
          buffer.push_str(&String::from_utf8_lossy(&bytes));
          
          // 解析所有 JSON 对象（Kiro 返回的是连续的 JSON，不是 SSE 格式）
          while let Some(start) = buffer.find('{') {
            let remaining = &buffer[start..];
            if let Some(json_str) = extract_json(remaining) {
              let json_len = json_str.len();
              
              // 解析 Kiro 事件
              if let Some(content) = parse_kiro_content(&json_str, &mut last_content) {
                // 发送 role（仅第一次）
                if !sent_role {
                  let chunk = ChatCompletionChunk {
                    id: id.clone(),
                    object: "chat.completion.chunk".to_string(),
                    created,
                    model: model.clone(),
                    choices: vec![ChunkChoice {
                      index: 0,
                      delta: Delta {
                        role: Some("assistant".to_string()),
                        content: None,
                        tool_calls: None,
                      },
                      finish_reason: None,
                    }],
                  };
                  yield Ok::<_, Infallible>(format!("data: {}\n\n", serde_json::to_string(&chunk).unwrap()));
                  sent_role = true;
                }
                
                // 发送内容
                let chunk = ChatCompletionChunk {
                  id: id.clone(),
                  object: "chat.completion.chunk".to_string(),
                  created,
                  model: model.clone(),
                  choices: vec![ChunkChoice {
                    index: 0,
                    delta: Delta {
                      role: None,
                      content: Some(content),
                      tool_calls: None,
                    },
                    finish_reason: None,
                  }],
                };
                yield Ok::<_, Infallible>(format!("data: {}\n\n", serde_json::to_string(&chunk).unwrap()));
              }
              
              // 移除已处理的 JSON
              buffer = buffer[start + json_len..].to_string();
            } else {
              // JSON 不完整，等待更多数据
              break;
            }
          }
        }
        Err(e) => {
          eprintln!("Stream error: {}", e);
          break;
        }
      }
    }
    
    // 发送结束
    let chunk = ChatCompletionChunk {
      id: id.clone(),
      object: "chat.completion.chunk".to_string(),
      created,
      model: model.clone(),
      choices: vec![ChunkChoice {
        index: 0,
        delta: Delta {
          role: None,
          content: None,
          tool_calls: None,
        },
        finish_reason: Some("stop".to_string()),
      }],
    };
    yield Ok::<_, Infallible>(format!("data: {}\n\n", serde_json::to_string(&chunk).unwrap()));
    yield Ok::<_, Infallible>("data: [DONE]\n\n".to_string());
  };

  Response::builder()
    .status(StatusCode::OK)
    .header(header::CONTENT_TYPE, "text/event-stream")
    .header(header::CACHE_CONTROL, "no-cache")
    .body(axum::body::Body::from_stream(stream))
    .unwrap()
}

async fn non_stream_response(resp: reqwest::Response, model: &str) -> Response {
  let id = format!("chatcmpl-{}", uuid::Uuid::new_v4());
  let created = chrono::Utc::now().timestamp();
  
  let bytes = match resp.bytes().await {
    Ok(b) => b,
    Err(e) => return error_response(StatusCode::BAD_GATEWAY, &format!("读取响应失败: {}", e)),
  };

  let text = String::from_utf8_lossy(&bytes);
  let mut content = String::new();
  
  // 解析所有事件（按 JSON 对象提取）
  let mut remaining = text.as_ref();
  while let Some(start) = remaining.find('{') {
    remaining = &remaining[start..];
    if let Some(json_str) = extract_json(remaining) {
      let json_len = json_str.len();
      if let Some(c) = parse_kiro_event(&json_str) {
        content.push_str(&c);
      }
      remaining = &remaining[json_len..];
    } else {
      break;
    }
  }

  let response = ChatCompletionResponse {
    id,
    object: "chat.completion".to_string(),
    created,
    model: model.to_string(),
    choices: vec![Choice {
      index: 0,
      message: ResponseMessage {
        role: "assistant".to_string(),
        content: Some(content),
        tool_calls: None,
      },
      finish_reason: Some("stop".to_string()),
    }],
    usage: None,
  };

  Json(response).into_response()
}

fn parse_kiro_event(event: &str) -> Option<String> {
  parse_kiro_content(event, &mut None)
}

// 解析 Kiro 事件内容，带去重
fn parse_kiro_content(json_str: &str, last_content: &mut Option<String>) -> Option<String> {
  let value: serde_json::Value = serde_json::from_str(json_str).ok()?;
  
  // 1. 直接 content 字段（最常见格式）
  if let Some(text) = value.get("content").and_then(|c| c.as_str()) {
    if !text.is_empty() {
      // 去重：跳过重复内容
      if last_content.as_deref() == Some(text) {
        return None;
      }
      *last_content = Some(text.to_string());
      return Some(text.to_string());
    }
  }
  
  // 2. delta.text 格式
  if let Some(text) = value.get("delta").and_then(|d| d.get("text")).and_then(|t| t.as_str()) {
    if !text.is_empty() {
      return Some(text.to_string());
    }
  }
  
  // 3. contentBlockDelta 格式
  if let Some(text) = value.get("contentBlockDelta")
    .and_then(|e| e.get("delta"))
    .and_then(|d| d.get("text"))
    .and_then(|t| t.as_str())
  {
    if !text.is_empty() {
      return Some(text.to_string());
    }
  }
  
  // 4. assistantResponseEvent 格式
  if let Some(text) = value.get("assistantResponseEvent")
    .and_then(|e| e.get("content"))
    .and_then(|c| c.as_str())
  {
    if !text.is_empty() {
      return Some(text.to_string());
    }
  }
  
  None
}

// 提取完整的 JSON 字符串（处理嵌套大括号）
fn extract_json(s: &str) -> Option<String> {
  if !s.starts_with('{') {
    return None;
  }
  
  let mut brace_count = 0;
  let mut in_string = false;
  let mut escape_next = false;
  
  for (i, c) in s.char_indices() {
    if escape_next {
      escape_next = false;
      continue;
    }
    
    if c == '\\' && in_string {
      escape_next = true;
      continue;
    }
    
    if c == '"' {
      in_string = !in_string;
      continue;
    }
    
    if !in_string {
      if c == '{' {
        brace_count += 1;
      } else if c == '}' {
        brace_count -= 1;
        if brace_count == 0 {
          return Some(s[..=i].to_string());
        }
      }
    }
  }
  
  None
}

// ============================================================
// Anthropic API 辅助函数
// ============================================================

/// 验证 Anthropic API Key（支持 x-api-key 和 Authorization）
fn verify_anthropic_api_key(headers: &HeaderMap, proxy_api_key: &str) -> Result<VerifyResult, String> {
  // 优先检查 x-api-key（Anthropic 标准）
  if let Some(x_api_key) = headers.get("x-api-key").and_then(|v| v.to_str().ok()) {
    return verify_token_string(x_api_key, proxy_api_key);
  }
  
  // 回退到 Authorization（兼容 OpenAI 格式）
  if let Some(auth_header) = headers.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()) {
    let token = if auth_header.starts_with("Bearer ") {
      &auth_header[7..]
    } else {
      auth_header
    };
    return verify_token_string(token, proxy_api_key);
  }
  
  Err("缺少 x-api-key 或 Authorization 头".to_string())
}

/// 验证 token 字符串（复用逻辑）
fn verify_token_string(token: &str, proxy_api_key: &str) -> Result<VerifyResult, String> {
  // 多租户格式：PROXY_API_KEY:REFRESH_TOKEN
  if token.contains(':') {
    let parts: Vec<&str> = token.splitn(2, ':').collect();
    if parts.len() != 2 {
      return Err("API Key 格式无效".to_string());
    }
    if parts[0] != proxy_api_key {
      return Err("API Key 无效".to_string());
    }
    return Ok(VerifyResult {
      refresh_token: parts[1].to_string(),
      auth_method: "social".to_string(),
      profile_arn: None,
      client_id: None,
      client_secret: None,
      region: Some("us-east-1".to_string()),
    });
  }
  
  // 用户 API Key 格式：sk-{48位十六进制}
  if token.starts_with("sk-") && token.len() == 51 {
    // 先检查 Token 池是否为空
    if is_token_pool_empty() {
      return Err("Token 池为空，请先在「Token」页面添加 Token".to_string());
    }
    match find_token_by_api_key(token) {
      Some(kiro_token) => return Ok(VerifyResult {
        refresh_token: kiro_token.refresh_token,
        auth_method: if kiro_token.auth_method.is_empty() { "social".to_string() } else { kiro_token.auth_method },
        profile_arn: kiro_token.profile_arn,
        client_id: kiro_token.client_id,
        client_secret: kiro_token.client_secret,
        region: kiro_token.region.or(Some("us-east-1".to_string())),
      }),
      None => return Err("API Key 无效或已过期".to_string()),
    }
  }
  
  // 传统格式
  if token == proxy_api_key {
    return Err("传统模式需要服务器配置全局 REFRESH_TOKEN".to_string());
  }
  
  Err("API Key 格式无效".to_string())
}

/// Anthropic 格式的错误响应
fn anthropic_error_response(status: StatusCode, error_type: &str, message: &str) -> Response {
  let body = Json(serde_json::json!({
    "type": "error",
    "error": {
      "type": error_type,
      "message": message
    }
  }));
  (status, body).into_response()
}

/// Anthropic 非流式响应
async fn anthropic_non_stream_response(resp: reqwest::Response, model: &str) -> Response {
  let id = format!("msg_{}", uuid::Uuid::new_v4().to_string().replace("-", "")[..24].to_string());
  
  let bytes = match resp.bytes().await {
    Ok(b) => b,
    Err(e) => return anthropic_error_response(StatusCode::BAD_GATEWAY, "api_error", &format!("读取响应失败: {}", e)),
  };

  let text = String::from_utf8_lossy(&bytes);
  let mut content = String::new();
  
  // 解析所有事件
  let mut remaining = text.as_ref();
  while let Some(start) = remaining.find('{') {
    remaining = &remaining[start..];
    if let Some(json_str) = extract_json(remaining) {
      let json_len = json_str.len();
      if let Some(c) = parse_kiro_event(&json_str) {
        content.push_str(&c);
      }
      remaining = &remaining[json_len..];
    } else {
      break;
    }
  }

  let response = AnthropicMessagesResponse {
    id,
    response_type: "message".to_string(),
    role: "assistant".to_string(),
    content: vec![AnthropicContentBlock {
      block_type: "text".to_string(),
      text: Some(content),
      id: None,
      name: None,
      input: None,
    }],
    model: model.to_string(),
    stop_reason: Some("end_turn".to_string()),
    stop_sequence: None,
    usage: AnthropicUsage {
      input_tokens: 0,
      output_tokens: 0,
    },
  };

  Json(response).into_response()
}

/// Anthropic 流式响应
async fn anthropic_stream_response(resp: reqwest::Response, model: &str) -> Response {
  let model = model.to_string();
  let id = format!("msg_{}", uuid::Uuid::new_v4().to_string().replace("-", "")[..24].to_string());

  let stream = async_stream::stream! {
    let mut bytes_stream = resp.bytes_stream();
    let mut buffer = String::new();
    let mut sent_start = false;
    let content_index = 0;
    let mut last_content: Option<String> = None;
    
    use futures::StreamExt;
    
    while let Some(chunk_result) = bytes_stream.next().await {
      match chunk_result {
        Ok(bytes) => {
          buffer.push_str(&String::from_utf8_lossy(&bytes));
          
          while let Some(start) = buffer.find('{') {
            let remaining = &buffer[start..];
            if let Some(json_str) = extract_json(remaining) {
              let json_len = json_str.len();
              
              if let Some(content) = parse_kiro_content(&json_str, &mut last_content) {
                // 发送 message_start（仅第一次）
                if !sent_start {
                  let event = serde_json::json!({
                    "type": "message_start",
                    "message": {
                      "id": id,
                      "type": "message",
                      "role": "assistant",
                      "content": [],
                      "model": model,
                      "stop_reason": null,
                      "stop_sequence": null,
                      "usage": { "input_tokens": 0, "output_tokens": 0 }
                    }
                  });
                  yield Ok::<_, Infallible>(format!("event: message_start\ndata: {}\n\n", serde_json::to_string(&event).unwrap()));
                  
                  // 发送 content_block_start
                  let block_start = serde_json::json!({
                    "type": "content_block_start",
                    "index": content_index,
                    "content_block": { "type": "text", "text": "" }
                  });
                  yield Ok::<_, Infallible>(format!("event: content_block_start\ndata: {}\n\n", serde_json::to_string(&block_start).unwrap()));
                  
                  sent_start = true;
                }
                
                // 发送 content_block_delta
                let delta = serde_json::json!({
                  "type": "content_block_delta",
                  "index": content_index,
                  "delta": { "type": "text_delta", "text": content }
                });
                yield Ok::<_, Infallible>(format!("event: content_block_delta\ndata: {}\n\n", serde_json::to_string(&delta).unwrap()));
              }
              
              buffer = buffer[start + json_len..].to_string();
            } else {
              break;
            }
          }
        }
        Err(e) => {
          eprintln!("Stream error: {}", e);
          break;
        }
      }
    }
    
    // 发送结束事件
    if sent_start {
      // content_block_stop
      let block_stop = serde_json::json!({
        "type": "content_block_stop",
        "index": content_index
      });
      yield Ok::<_, Infallible>(format!("event: content_block_stop\ndata: {}\n\n", serde_json::to_string(&block_stop).unwrap()));
      
      // message_delta
      let msg_delta = serde_json::json!({
        "type": "message_delta",
        "delta": { "stop_reason": "end_turn", "stop_sequence": null },
        "usage": { "output_tokens": 0 }
      });
      yield Ok::<_, Infallible>(format!("event: message_delta\ndata: {}\n\n", serde_json::to_string(&msg_delta).unwrap()));
      
      // message_stop
      let msg_stop = serde_json::json!({ "type": "message_stop" });
      yield Ok::<_, Infallible>(format!("event: message_stop\ndata: {}\n\n", serde_json::to_string(&msg_stop).unwrap()));
    }
  };

  Response::builder()
    .status(StatusCode::OK)
    .header(header::CONTENT_TYPE, "text/event-stream")
    .header(header::CACHE_CONTROL, "no-cache")
    .body(axum::body::Body::from_stream(stream))
    .unwrap()
}
