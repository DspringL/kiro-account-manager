use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use serde_json::{json, Value};
use tauri::Emitter;

/// 浏览器自动化服务（调用 Python 脚本）
pub struct BrowserAutomation {
    python_path: String,
    script_path: String,
}

impl BrowserAutomation {
    pub fn new() -> Self {
        let script_path = if cfg!(debug_assertions) {
            "src-tauri/scripts/auto_register.py".to_string()
        } else {
            "scripts/auto_register.py".to_string()
        };
        Self {
            python_path: "python3".to_string(),
            script_path,
        }
    }

    /// 检查 Camoufox 是否已安装
    pub async fn check_camoufox_installed(&self) -> Result<bool, String> {
        let output = Command::new(&self.python_path)
            .arg("-c")
            .arg("from camoufox.async_api import AsyncCamoufox")
            .output()
            .map_err(|e| format!("检查 Camoufox 失败: {}", e))?;
        Ok(output.status.success())
    }

    /// 完整注册流程：传入临时邮箱 API 配置，Python 脚本内部完成所有步骤
    ///
    /// # 参数
    /// - api_url: 临时邮箱 API 地址
    /// - admin_password: 临时邮箱 Admin 密码
    /// - proxy_url: 可选代理地址
    /// - account_password: 可选 AWS 账号密码
    /// - app_handle: Tauri 应用句柄，用于发送实时日志
    pub async fn register_full_flow(
        &self,
        api_url: &str,
        admin_password: &str,
        proxy_url: Option<&str>,
        account_password: Option<&str>,
        app_handle: Option<&tauri::AppHandle>,
    ) -> Result<Value, String> {
        let input = json!({
            "api_url": api_url,
            "admin_password": admin_password,
            "proxy_url": proxy_url,
            "account_password": account_password
        });

        let mut child = Command::new(&self.python_path)
            .arg(&self.script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("启动 Python 脚本失败: {}", e))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(input.to_string().as_bytes())
                .map_err(|e| format!("写入参数失败: {}", e))?;
        }

        let stdout = child.stdout.take().ok_or("无法获取 stdout")?;
        let reader = BufReader::new(stdout);
        let mut result: Option<Value> = None;

        for line in reader.lines() {
            if let Ok(line) = line {
                if let Ok(json_data) = serde_json::from_str::<Value>(&line) {
                    match json_data.get("type").and_then(|v| v.as_str()) {
                        Some("log") => {
                            if let Some(handle) = app_handle {
                                let email = json_data.get("email").and_then(|v| v.as_str()).unwrap_or("");
                                let message = json_data.get("message").and_then(|v| v.as_str()).unwrap_or("");
                                let _ = handle.emit("auto-register-log", json!({
                                    "email": email,
                                    "message": message
                                }));
                            }
                        }
                        Some("result") => {
                            result = json_data.get("data").cloned();
                        }
                        Some("error") => {
                            let message = json_data.get("message").and_then(|v| v.as_str()).unwrap_or("未知错误");
                            return Err(message.to_string());
                        }
                        _ => {}
                    }
                }
            }
        }

        let _ = child.wait();
        result.ok_or_else(|| "未获取到结果".to_string())
    }
}
