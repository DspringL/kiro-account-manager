// 账号自动注册命令 - 通过 Node.js sidecar 调用 Playwright 完成注册

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};
use tauri::{Emitter, State};

use crate::state::AppState;

/// 注册任务参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterParams {
    /// 注册数量
    pub count: u32,
    /// 并发数
    pub concurrency: u32,
    /// 代理地址（可选）
    pub proxy_url: Option<String>,
    /// 是否使用指纹伪装
    pub use_fingerprint: bool,
    /// 是否使用无痕模式
    pub incognito: bool,
    /// AWS 设备码（可选，由前端先调用 start_builder_id_device_login 获取）
    pub user_code: Option<String>,
    /// AWS 验证 URI
    pub verification_uri: Option<String>,
    /// AWS 区域
    pub region: Option<String>,
    /// 自建临时邮箱 API 地址（可选，优先于公共服务）
    pub temp_mail_api_url: Option<String>,
    /// 自建临时邮箱 Admin 密码（可选）
    pub temp_mail_admin_key: Option<String>,
}

/// 单个注册结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRecord {
    pub success: bool,
    pub email: Option<String>,
    pub password: Option<String>,
    pub name: Option<String>,
    pub error: Option<String>,
}

/// 注册任务整体结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterResult {
    pub results: Vec<RegisterRecord>,
    pub ok: u32,
    pub fail: u32,
}

/// Worker 输出的单行 JSON
#[derive(Debug, Deserialize)]
struct WorkerLine {
    #[serde(rename = "type")]
    kind: String,
    data: serde_json::Value,
}

/// 检查 Node.js 是否可用
#[tauri::command]
pub fn check_node_available() -> bool {
    Command::new("node").arg("--version").output().is_ok()
}

/// 检查 Playwright Chromium 是否已安装
#[tauri::command]
pub fn check_playwright_installed() -> bool {
    // 检查 sidecar 目录下的 node_modules
    let sidecar_dir = get_sidecar_dir();
    let chromium_path = sidecar_dir.join("node_modules").join("playwright-core");
    chromium_path.exists()
}

/// 安装 sidecar 依赖（npm install + playwright install chromium）
#[tauri::command]
pub async fn install_register_deps(app_handle: tauri::AppHandle) -> Result<(), String> {
    let sidecar_dir = get_sidecar_dir();

    if !sidecar_dir.exists() {
        return Err(format!("sidecar 目录不存在: {}", sidecar_dir.display()));
    }

    // npm install
    emit_log(&app_handle, "正在安装依赖 (npm install)...");
    let npm_output = Command::new("npm")
        .args(["install", "--prefer-offline"])
        .current_dir(&sidecar_dir)
        .output()
        .map_err(|e| format!("npm install 失败: {e}"))?;

    if !npm_output.status.success() {
        let stderr = String::from_utf8_lossy(&npm_output.stderr);
        return Err(format!("npm install 失败: {stderr}"));
    }
    emit_log(&app_handle, "✓ npm install 完成");

    // playwright install chromium
    emit_log(&app_handle, "正在安装 Playwright Chromium 浏览器...");
    let pw_output = Command::new("npx")
        .args(["playwright", "install", "chromium"])
        .current_dir(&sidecar_dir)
        .output()
        .map_err(|e| format!("playwright install 失败: {e}"))?;

    if !pw_output.status.success() {
        let stderr = String::from_utf8_lossy(&pw_output.stderr);
        return Err(format!("playwright install chromium 失败: {stderr}"));
    }
    emit_log(&app_handle, "✓ Playwright Chromium 安装完成");

    Ok(())
}

/// 启动 AWS Builder ID 设备登录流程，获取 userCode 和 verificationUri
#[tauri::command]
pub async fn start_builder_id_device_login(
    region: Option<String>,
) -> Result<serde_json::Value, String> {
    let region = region.unwrap_or_else(|| "us-east-1".to_string());
    let oidc_base = format!("https://oidc.{region}.amazonaws.com");
    let start_url = "https://view.awsapps.com/start";

    let client = reqwest::Client::new();

    // 1. 注册客户端
    let reg_body = serde_json::json!({
        "clientName": "Kiro Account Manager",
        "clientType": "public",
        "scopes": [
            "codewhisperer:completions",
            "codewhisperer:analysis",
            "codewhisperer:conversations",
            "codewhisperer:transformations",
            "codewhisperer:taskassist"
        ],
        "grantTypes": ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"],
        "issuerUrl": start_url
    });

    let reg_res = client
        .post(format!("{oidc_base}/client/register"))
        .json(&reg_body)
        .send()
        .await
        .map_err(|e| format!("注册客户端失败: {e}"))?;

    if !reg_res.status().is_success() {
        return Err(format!("注册客户端失败: {}", reg_res.text().await.unwrap_or_default()));
    }

    let reg_data: serde_json::Value = reg_res.json().await.map_err(|e| format!("解析注册响应失败: {e}"))?;
    let client_id = reg_data["clientId"].as_str().ok_or("缺少 clientId")?.to_string();
    let client_secret = reg_data["clientSecret"].as_str().ok_or("缺少 clientSecret")?.to_string();

    // 2. 设备授权
    let auth_body = serde_json::json!({
        "clientId": client_id,
        "clientSecret": client_secret,
        "startUrl": start_url
    });

    let auth_res = client
        .post(format!("{oidc_base}/device_authorization"))
        .json(&auth_body)
        .send()
        .await
        .map_err(|e| format!("设备授权失败: {e}"))?;

    if !auth_res.status().is_success() {
        return Err(format!("设备授权失败: {}", auth_res.text().await.unwrap_or_default()));
    }

    let auth_data: serde_json::Value = auth_res.json().await.map_err(|e| format!("解析授权响应失败: {e}"))?;

    let device_code = auth_data["deviceCode"].as_str().ok_or("缺少 deviceCode")?.to_string();
    let user_code = auth_data["userCode"].as_str().ok_or("缺少 userCode")?.to_string();
    let verification_uri = auth_data["verificationUriComplete"]
        .as_str()
        .or_else(|| auth_data["verificationUri"].as_str())
        .ok_or("缺少 verificationUri")?
        .to_string();
    let interval = auth_data["interval"].as_u64().unwrap_or(5);
    let expires_in = auth_data["expiresIn"].as_u64().unwrap_or(600);

    Ok(serde_json::json!({
        "success": true,
        "userCode": user_code,
        "verificationUri": verification_uri,
        "deviceCode": device_code,
        "clientId": client_id,
        "clientSecret": client_secret,
        "region": region,
        "interval": interval,
        "expiresIn": expires_in,
        "expiresAt": chrono::Utc::now().timestamp_millis() + (expires_in as i64 * 1000)
    }))
}

/// 轮询设备授权结果，获取 refreshToken
#[tauri::command]
pub async fn poll_builder_id_device_auth(
    region: String,
    client_id: String,
    client_secret: String,
    device_code: String,
) -> Result<serde_json::Value, String> {
    let oidc_base = format!("https://oidc.{region}.amazonaws.com");
    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "clientId": client_id,
        "clientSecret": client_secret,
        "grantType": "urn:ietf:params:oauth:grant-type:device_code",
        "deviceCode": device_code
    });

    let res = client
        .post(format!("{oidc_base}/token"))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("轮询失败: {e}"))?;

    let status = res.status().as_u16();
    let data: serde_json::Value = res.json().await.map_err(|e| format!("解析响应失败: {e}"))?;

    if status == 200 {
        return Ok(serde_json::json!({
            "success": true,
            "completed": true,
            "accessToken": data["accessToken"],
            "refreshToken": data["refreshToken"],
            "expiresIn": data["expiresIn"],
            "clientId": client_id,
            "clientSecret": client_secret,
            "region": region
        }));
    }

    if status == 400 {
        let error = data["error"].as_str().unwrap_or("unknown");
        match error {
            "authorization_pending" => return Ok(serde_json::json!({"success":true,"completed":false,"status":"pending"})),
            "slow_down" => return Ok(serde_json::json!({"success":true,"completed":false,"status":"slow_down"})),
            "expired_token" => return Err("设备码已过期".to_string()),
            "access_denied" => return Err("用户拒绝授权".to_string()),
            _ => return Err(format!("授权错误: {error}")),
        }
    }

    Err(format!("未知响应状态: {status}"))
}

/// 执行批量注册（通过 Node.js sidecar）
/// 注册过程中通过 Tauri 事件实时推送日志
#[tauri::command]
pub async fn run_auto_register(
    app_handle: tauri::AppHandle,
    _state: State<'_, AppState>,
    params: RegisterParams,
) -> Result<RegisterResult, String> {
    let sidecar_dir = get_sidecar_dir();
    let worker_path = sidecar_dir.join("register-worker.mjs");

    if !worker_path.exists() {
        return Err(format!("注册脚本不存在: {}", worker_path.display()));
    }

    // 序列化参数
    let input = serde_json::to_string(&params).map_err(|e| format!("参数序列化失败: {e}"))?;

    emit_log(&app_handle, &format!("启动注册 Worker，共 {} 个账号...", params.count));

    // 启动 Node.js 进程
    let mut child = Command::new("node")
        .arg(worker_path.to_str().unwrap())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(&sidecar_dir)
        .spawn()
        .map_err(|e| format!("启动 Node.js 失败: {e}，请确保已安装 Node.js"))?;

    // 写入参数到 stdin
    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(input.as_bytes()).map_err(|e| format!("写入参数失败: {e}"))?;
    }

    // 读取 stdout（逐行解析 JSON）
    let stdout = child.stdout.take().ok_or("无法获取 stdout")?;
    let reader = std::io::BufReader::new(stdout);

    let mut final_result: Option<RegisterResult> = None;

    use std::io::BufRead;
    for line in reader.lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => continue,
        };
        if line.trim().is_empty() { continue }

        match serde_json::from_str::<WorkerLine>(&line) {
            Ok(wl) => {
                match wl.kind.as_str() {
                    "log" => {
                        let msg = wl.data.as_str().unwrap_or(&wl.data.to_string()).to_string();
                        emit_log(&app_handle, &msg);
                    }
                    "result" => {
                        // 解析最终结果
                        if let Ok(r) = serde_json::from_value::<RegisterResult>(wl.data.clone()) {
                            final_result = Some(r);
                        } else {
                            // 单个失败结果
                            let err = wl.data["error"].as_str().unwrap_or("未知错误").to_string();
                            final_result = Some(RegisterResult {
                                results: vec![RegisterRecord { success: false, email: None, password: None, name: None, error: Some(err) }],
                                ok: 0,
                                fail: 1,
                            });
                        }
                    }
                    _ => {}
                }
            }
            Err(_) => {
                // 非 JSON 行，当作普通日志
                emit_log(&app_handle, &line);
            }
        }
    }

    // 等待进程结束
    let _ = child.wait();

    final_result.ok_or_else(|| "注册 Worker 未返回结果".to_string())
}

// ===== 辅助函数 =====

fn get_sidecar_dir() -> std::path::PathBuf {
    // 开发时：相对于 src-tauri 目录
    let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("sidecar");
    if dev_path.exists() {
        return dev_path;
    }
    // 生产时：相对于可执行文件目录
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let prod_path = dir.join("sidecar");
            if prod_path.exists() {
                return prod_path;
            }
        }
    }
    dev_path
}

fn emit_log(app_handle: &tauri::AppHandle, msg: &str) {
    let _ = app_handle.emit("register-log", msg.to_string());
}
