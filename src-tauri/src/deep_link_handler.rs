// Deep Link 回调处理
// 处理 kiro://kiro.kiroAgent/authenticate-success?code=xxx&state=xxx 格式的 OAuth 回调

use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// OAuth 回调结果（state 已在 handle_deep_link 中验证）
#[derive(Debug, Clone)]
pub struct OAuthCallbackResult {
    pub code: String,
}

/// 回调结果类型别名
type CallbackResult = Result<OAuthCallbackResult, String>;
/// 回调接收器类型别名
type CallbackReceiver = Arc<Mutex<Option<Receiver<CallbackResult>>>>;
/// 待处理发送器类型别名
type PendingSender = Mutex<Option<(String, Sender<CallbackResult>)>>;

/// Deep Link OAuth 回调等待器
pub struct DeepLinkCallbackWaiter {
    result_rx: CallbackReceiver,
    timeout: Duration,
}

impl DeepLinkCallbackWaiter {
    /// 获取 redirect_uri (使用 Kiro 官方协议)
    pub fn get_redirect_uri() -> String {
        "kiro://kiro.kiroAgent/authenticate-success".to_string()
    }

    /// 等待回调结果
    pub fn wait_for_callback(&self) -> Result<OAuthCallbackResult, String> {
        let rx = self.result_rx.lock().expect("Failed to acquire result_rx lock").take()
            .ok_or("Callback channel already consumed")?;

        match rx.recv_timeout(self.timeout) {
            Ok(result) => result,
            Err(_) => Err("OAuth callback timeout (5 minutes)".to_string()),
        }
    }
}

/// 全局回调发送器存储
static PENDING_SENDER: std::sync::OnceLock<PendingSender> = std::sync::OnceLock::new();

/// 注册一个新的回调等待器，返回接收端
pub fn register_waiter(state: &str) -> DeepLinkCallbackWaiter {
    let (tx, rx) = mpsc::channel();
    
    // 存储发送端
    let storage = PENDING_SENDER.get_or_init(|| Mutex::new(None));
    *storage.lock().expect("Failed to acquire pending sender lock") = Some((state.to_string(), tx));
    
    DeepLinkCallbackWaiter {
        result_rx: Arc::new(Mutex::new(Some(rx))),
        timeout: Duration::from_secs(300),
    }
}

/// 处理 deep link URL（由 main.rs 调用）
pub fn handle_deep_link(url: &str) -> bool {
    let storage = match PENDING_SENDER.get() {
        Some(s) => s,
        None => return false,
    };
    
    let mut guard = storage.lock().expect("Failed to acquire pending sender lock");
    let (expected_state, tx) = match guard.take() {
        Some(s) => s,
        None => return false,
    };
    
    // 解析 URL
    let parsed = match url::Url::parse(url) {
        Ok(u) => u,
        Err(e) => {
            let _ = tx.send(Err(format!("Invalid URL: {}", e)));
            return false;
        }
    };

    // 检查是否是 kiro:// 协议
    if parsed.scheme() != "kiro" {
        *guard = Some((expected_state, tx)); // 放回去
        return false;
    }

    // 提取参数
    let params: std::collections::HashMap<_, _> = parsed.query_pairs().collect();
    
    // 检查错误
    if let Some(error) = params.get("error") {
        let desc = params.get("error_description")
            .map(|s| s.to_string())
            .unwrap_or_else(|| "Unknown error".to_string());
        let _ = tx.send(Err(format!("OAuth error: {} - {}", error, desc)));
        return true;
    }
    
    let code = match params.get("code") {
        Some(c) => c.to_string(),
        None => {
            let _ = tx.send(Err("Missing code parameter".to_string()));
            return true;
        }
    };

    let state = match params.get("state") {
        Some(s) => s.to_string(),
        None => {
            let _ = tx.send(Err("Missing state parameter".to_string()));
            return true;
        }
    };

    // 验证 state
    if state != expected_state {
        let _ = tx.send(Err("State mismatch - possible CSRF attack".to_string()));
        return true;
    }

    let _ = tx.send(Ok(OAuthCallbackResult { code }));
    true
}
