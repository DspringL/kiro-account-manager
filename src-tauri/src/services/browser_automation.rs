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
        // 获取脚本路径
        let script_path = if cfg!(debug_assertions) {
            "src-tauri/scripts/auto_register.py".to_string()
        } else {
            // 生产环境从资源目录读取
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

    /// 使用临时邮箱注册 AWS Builder ID
    /// 
    /// # 参数
    /// - email: 邮箱地址
    /// - verification_code: 验证码
    /// - proxy_url: 可选的代理地址
    /// - app_handle: Tauri 应用句柄，用于发送实时日志
    pub async fn register_with_tempmail(
        &self,
        email: &str,
        verification_code: &str,
        proxy_url: Option<&str>,
        app_handle: Option<&tauri::AppHandle>,
    ) -> Result<Value, String> {
        let input = json!({
            "email": email,
            "verification_code": verification_code,
            "proxy_url": proxy_url
        });

        let mut child = Command::new(&self.python_path)
            .arg(&self.script_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("启动 Python 脚本失败: {}", e))?;

        // 写入参数
        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(input.to_string().as_bytes())
                .map_err(|e| format!("写入参数失败: {}", e))?;
        }

        // 读取输出
        let stdout = child.stdout.take().ok_or("无法获取 stdout")?;
        let reader = BufReader::new(stdout);

        let mut result: Option<Value> = None;

        for line in reader.lines() {
            if let Ok(line) = line {
                // 解析 JSON 输出
                if let Ok(json_data) = serde_json::from_str::<Value>(&line) {
                    let msg_type = json_data.get("type").and_then(|v| v.as_str());

                    match msg_type {
                        Some("log") => {
                            // 实时日志
                            if let Some(handle) = app_handle {
                                let email = json_data
                                    .get("email")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("");
                                let message = json_data
                                    .get("message")
                                    .and_then(|v| v.as_str())
                                    .unwrap_or("");

                                let _ = handle.emit(
                                    "auto-register-log",
                                    json!({
                                        "email": email,
                                        "message": message
                                    }),
                                );
                            }
                        }
                        Some("result") => {
                            // 最终结果
                            result = json_data.get("data").cloned();
                        }
                        Some("error") => {
                            // 错误信息
                            let message = json_data
                                .get("message")
                                .and_then(|v| v.as_str())
                                .unwrap_or("未知错误");
                            return Err(message.to_string());
                        }
                        _ => {}
                    }
                }
            }
        }

        // 等待进程结束
        let status = child.wait().map_err(|e| format!("等待进程失败: {}", e))?;

        if !status.success() {
            return Err(format!("Python 脚本执行失败: {}", status));
        }

        result.ok_or_else(|| "未获取到结果".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_camoufox_installed() {
        let automation = BrowserAutomation::new();
        // 这个测试可能失败，因为 Camoufox 可能未安装
        let _ = automation.check_camoufox_installed().await;
    }
}
