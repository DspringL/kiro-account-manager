// KiroGate HTTP 服务器

use axum::{
  extract::{Json, State},
  http::{header, HeaderMap, StatusCode},
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
use crate::kiro_gate::converter::{build_kiro_payload, get_available_models};
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
    .allow_methods(Any)
    .allow_headers(Any);

  let app = Router::new()
    .route("/", get(health_handler))
    .route("/health", get(health_handler))
    .route("/v1/models", get(models_handler))
    .route("/v1/chat/completions", post(chat_completions_handler))
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

async fn models_handler() -> impl IntoResponse {
  Json(ModelsResponse {
    object: "list".to_string(),
    data: get_available_models(),
  })
}

async fn chat_completions_handler(
  State(state): State<Arc<ServerState>>,
  headers: HeaderMap,
  Json(request): Json<ChatCompletionRequest>,
) -> Response {
  // 验证 API Key 并获取 token_id
  let token_id = match verify_api_key(&headers, &state.proxy_api_key) {
    Ok(id) => id,
    Err(e) => return error_response(StatusCode::UNAUTHORIZED, &e),
  };

  // 从存储中查找 Token
  let token = match load_token_by_id(&token_id) {
    Some(t) => t,
    None => return error_response(StatusCode::UNAUTHORIZED, "Token 不存在"),
  };

  // 构建 TokenConfig
  let config = TokenConfig {
    refresh_token: token.refresh_token.clone(),
    auth_method: token.auth_method.clone(),
    profile_arn: token.profile_arn.clone(),
    client_id: token.client_id.clone(),
    client_secret: token.client_secret.clone(),
    region: token.region.clone(),
  };

  // 获取 TokenManager
  let token_manager = state.auth_cache.get_or_create(&token_id, config).await;
  
  // 获取 access_token
  let access_token = match token_manager.get_access_token().await {
    Ok(token) => token,
    Err(e) => return error_response(StatusCode::UNAUTHORIZED, &e),
  };

  let profile_arn = token_manager.get_profile_arn().await;

  // 构建 Kiro payload
  let kiro_payload = match build_kiro_payload(&request, profile_arn) {
    Ok(p) => p,
    Err(e) => return error_response(StatusCode::BAD_REQUEST, &e),
  };

  // 根据 region 选择 API host
  let region = token.region.as_deref().unwrap_or("us-east-1");
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
    Err(e) => return error_response(StatusCode::BAD_GATEWAY, &format!("请求 Kiro API 失败: {}", e)),
  };

  if !resp.status().is_success() {
    let status = resp.status();
    let text = resp.text().await.unwrap_or_default();
    return error_response(
      StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR),
      &format!("Kiro API 错误: {}", text),
    );
  }

  // 处理响应
  if request.stream {
    stream_response(resp, &request.model).await
  } else {
    non_stream_response(resp, &request.model).await
  }
}

// ============================================================
// 辅助函数
// ============================================================

fn verify_api_key(headers: &HeaderMap, proxy_api_key: &str) -> Result<String, String> {
  let auth_header = headers
    .get(header::AUTHORIZATION)
    .and_then(|v| v.to_str().ok())
    .ok_or("缺少 Authorization 头")?;

  let token = if auth_header.starts_with("Bearer ") {
    &auth_header[7..]
  } else {
    auth_header
  };

  // 格式: PROXY_API_KEY:TOKEN_ID
  if token.contains(':') {
    let parts: Vec<&str> = token.splitn(2, ':').collect();
    if parts.len() != 2 {
      return Err("API Key 格式无效".to_string());
    }
    
    if parts[0] != proxy_api_key {
      return Err("API Key 无效".to_string());
    }
    
    Ok(parts[1].to_string())
  } else {
    Err("API Key 格式无效，需要 PROXY_API_KEY:TOKEN_ID".to_string())
  }
}

fn load_token_by_id(token_id: &str) -> Option<KiroGateToken> {
  let path = dirs::data_dir()
    .unwrap_or_else(|| std::path::PathBuf::from("."))
    .join(".kiro-account-manager")
    .join("kirogate-tokens.json");
  
  if !path.exists() {
    return None;
  }

  let content = std::fs::read_to_string(&path).ok()?;
  let tokens: Vec<KiroGateToken> = serde_json::from_str(&content).ok()?;
  
  tokens.into_iter().find(|t| t.id == token_id)
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
    
    use futures::StreamExt;
    
    while let Some(chunk_result) = bytes_stream.next().await {
      match chunk_result {
        Ok(bytes) => {
          buffer.push_str(&String::from_utf8_lossy(&bytes));
          
          // 解析事件流
          while let Some(pos) = buffer.find("\n\n") {
            let event = buffer[..pos].to_string();
            buffer = buffer[pos + 2..].to_string();
            
            // 解析 Kiro 事件
            if let Some(content) = parse_kiro_event(&event) {
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
  
  // 解析所有事件
  for line in text.lines() {
    if let Some(c) = parse_kiro_event(line) {
      content.push_str(&c);
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
  // Kiro 事件格式: :event-type {...json...}
  // 或者 :content-block-delta {"delta":{"text":"..."}}
  
  for line in event.lines() {
    let line = line.trim();
    
    // 跳过空行和注释
    if line.is_empty() || line.starts_with(':') && !line.contains('{') {
      continue;
    }
    
    // 尝试提取 JSON
    if let Some(json_start) = line.find('{') {
      let json_str = &line[json_start..];
      if let Ok(value) = serde_json::from_str::<serde_json::Value>(json_str) {
        // 提取文本内容
        if let Some(text) = value.get("delta").and_then(|d| d.get("text")).and_then(|t| t.as_str()) {
          return Some(text.to_string());
        }
        if let Some(text) = value.get("assistantResponseEvent")
          .and_then(|e| e.get("content"))
          .and_then(|c| c.as_str())
        {
          return Some(text.to_string());
        }
        // contentBlockDelta 格式
        if let Some(text) = value.get("contentBlockDelta")
          .and_then(|e| e.get("delta"))
          .and_then(|d| d.get("text"))
          .and_then(|t| t.as_str())
        {
          return Some(text.to_string());
        }
      }
    }
  }
  
  None
}
