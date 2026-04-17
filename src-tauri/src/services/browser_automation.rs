use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use serde_json::{json, Value};
use tauri::Emitter;

pub struct BrowserAutomation {
    python_path: String,
    script_path: String,
}

impl BrowserAutomation {
    pub fn new() -> Self {
        // CARGO_MANIFEST_DIR 在编译时指向 src-tauri/ 目录
        // 脚本放在 src-tauri/scripts/ 下
        let script_path = if cfg!(debug_assertions) {
            format!("{}/scripts/auto_register.py", env!("CARGO_MANIFEST_DIR"))
        } else {
            "scripts/auto_register.py".to_string()
        };
        Self {
            python_path: "python3".to_string(),
            script_path,
        }
    }

    pub async fn check_camoufox_installed(&self) -> Result<bool, String> {
        let output = Command::new(&self.python_path)
            .arg("-c")
            .arg("from camoufox.async_api import AsyncCamoufox")
            .output()
            .map_err(|e| format!("检查 Camoufox 失败: {}", e))?;
        Ok(output.status.success())
    }

    /// 完整注册流程：传入临时邮箱 API 配置，Python 脚本内部完成所有步骤
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
        let input_bytes = input.to_string().into_bytes();

        let mut child = Command::new(&self.python_path)
            .arg(&self.script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("启动 Python 脚本失败: {e}"))?;

        // 写入参数后立即关闭 stdin，让 Python 的 sys.stdin.read() 能返回
        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(&input_bytes)
                .map_err(|e| format!("写入参数失败: {e}"))?;
            // stdin 在这里 drop，自动关闭，Python 才能读到 EOF
        }

        // 读取 stdout（实时日志 + 最终结果）
        let stdout = child.stdout.take().ok_or("无法获取 stdout")?;
        let reader = BufReader::new(stdout);
        let mut result: Option<Value> = None;

        for line in reader.lines() {
            let line = match line {
                Ok(l) => l,
                Err(_) => continue,
            };
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if let Ok(json_data) = serde_json::from_str::<Value>(trimmed) {
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
                        let msg = json_data.get("message").and_then(|v| v.as_str()).unwrap_or("未知错误");
                        return Err(msg.to_string());
                    }
                    _ => {
                        // 非 JSON 行也尝试作为日志输出
                        if let Some(handle) = app_handle {
                            let _ = handle.emit("auto-register-log", json!({
                                "email": "",
                                "message": trimmed
                            }));
                        }
                    }
                }
            } else {
                // 非 JSON 行（如 Python 的 print 调试输出）也转发到日志
                if let Some(handle) = app_handle {
                    let _ = handle.emit("auto-register-log", json!({
                        "email": "",
                        "message": trimmed
                    }));
                }
            }
        }

        // 等待进程结束，同时收集 stderr 用于调试
        let output = child.wait_with_output()
            .map_err(|e| format!("等待进程失败: {e}"))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if !stderr.trim().is_empty() {
                if let Some(handle) = app_handle {
                    let _ = handle.emit("auto-register-log", json!({
                        "email": "",
                        "message": format!("[stderr] {}", stderr.trim())
                    }));
                }
            }
        }

        result.ok_or_else(|| "未获取到结果".to_string())
    }
}
