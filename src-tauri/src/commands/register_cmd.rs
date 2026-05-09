// 账号自动注册命令 - 通过 Node.js sidecar 调用 Playwright 完成注册

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use tauri::{Emitter, State};

use crate::state::AppState;
use crate::commands::account_cmd::add_account_by_idc;

// ===== 授权码模式所需常量 =====

const AUTHORIZE_REGION: &str = "us-east-1";
const AUTHORIZE_ISSUER_URL: &str = "https://view.awsapps.com/start";
const AUTHORIZE_SCOPES: &[&str] = &[
    "codewhisperer:completions",
    "codewhisperer:analysis",
    "codewhisperer:conversations",
    "codewhisperer:transformations",
    "codewhisperer:taskassist",
];

// ===== 全局子进程 PID（用于停止） =====

use std::sync::atomic::{AtomicBool, Ordering};

static WORKER_PIDS: OnceLock<Mutex<Vec<u32>>> = OnceLock::new();
static STOP_FLAG: OnceLock<AtomicBool> = OnceLock::new();

fn worker_pids_store() -> &'static Mutex<Vec<u32>> {
    WORKER_PIDS.get_or_init(|| Mutex::new(Vec::new()))
}

fn stop_flag() -> &'static AtomicBool {
    STOP_FLAG.get_or_init(|| AtomicBool::new(false))
}

fn add_worker_pid(pid: u32) {
    if let Ok(mut guard) = worker_pids_store().lock() {
        guard.push(pid);
    }
}

fn remove_worker_pid(pid: u32) {
    if let Ok(mut guard) = worker_pids_store().lock() {
        guard.retain(|&p| p != pid);
    }
}

fn take_all_worker_pids() -> Vec<u32> {
    if let Ok(mut guard) = worker_pids_store().lock() {
        std::mem::take(&mut *guard)
    } else {
        Vec::new()
    }
}

fn is_stopped() -> bool {
    stop_flag().load(Ordering::Relaxed)
}

// 兼容旧接口（设备码模式仍使用单 PID）
fn set_worker_pid(pid: Option<u32>) {
    if let Some(p) = pid {
        add_worker_pid(p);
    }
}

fn get_worker_pid() -> Option<u32> {
    worker_pids_store().lock().ok()?.first().copied()
}

// ===== 数据结构 =====

/// 单个自建邮箱 API 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TempMailApi {
    pub name: String,
    pub api_url: String,
    pub admin_key: String,
}

/// 注册任务参数
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterParams {
    pub count: u32,
    pub concurrency: u32,
    pub proxy_url: Option<String>,
    pub use_fingerprint: bool,
    pub incognito: bool,
    /// 浏览器是否无头模式（true = 无头，false = 有头可见）
    pub headless: bool,
    pub user_code: Option<String>,
    pub verification_uri: Option<String>,
    pub region: Option<String>,
    /// 多个自建邮箱 API 配置列表
    #[serde(default)]
    pub temp_mail_apis: Vec<TempMailApi>,
    /// 邮箱选择策略："random"（随机）或数字索引字符串（如 "0"、"1"）
    #[serde(default)]
    pub temp_mail_select: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRecord {
    pub success: bool,
    pub email: Option<String>,
    pub password: Option<String>,
    pub name: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterResult {
    pub results: Vec<RegisterRecord>,
    pub ok: u32,
    pub fail: u32,
}

#[derive(Debug, Deserialize)]
struct WorkerLine {
    #[serde(rename = "type")]
    kind: String,
    data: serde_json::Value,
}

// ===== 命令 =====

/// 检查 Node.js 是否可用
#[tauri::command]
pub fn check_node_available() -> bool {
    Command::new("node").arg("--version").output().is_ok()
}

/// 检查 Playwright Chromium 是否已安装
#[tauri::command]
pub fn check_playwright_installed() -> bool {
    let sidecar_dir = get_sidecar_dir();
    sidecar_dir.join("node_modules").join("playwright-core").exists()
}

/// 安装 sidecar 依赖（npm install + playwright install chromium）
#[tauri::command]
pub async fn install_register_deps(app_handle: tauri::AppHandle) -> Result<(), String> {
    let sidecar_dir = get_sidecar_dir();
    if !sidecar_dir.exists() {
        return Err(format!("sidecar 目录不存在: {}", sidecar_dir.display()));
    }

    emit_log(&app_handle, "正在安装依赖 (npm install)...");
    let npm_out = Command::new("npm")
        .args(["install", "--prefer-offline"])
        .current_dir(&sidecar_dir)
        .output()
        .map_err(|e| format!("npm install 失败: {e}"))?;
    if !npm_out.status.success() {
        return Err(format!("npm install 失败: {}", String::from_utf8_lossy(&npm_out.stderr)));
    }
    emit_log(&app_handle, "✓ npm install 完成");

    emit_log(&app_handle, "正在安装 Playwright Chromium 浏览器...");
    let pw_out = Command::new("npx")
        .args(["playwright", "install", "chromium"])
        .current_dir(&sidecar_dir)
        .output()
        .map_err(|e| format!("playwright install 失败: {e}"))?;
    if !pw_out.status.success() {
        return Err(format!("playwright install chromium 失败: {}", String::from_utf8_lossy(&pw_out.stderr)));
    }
    emit_log(&app_handle, "✓ Playwright Chromium 安装完成");
    Ok(())
}

/// 启动 AWS Builder ID 设备登录流程
#[tauri::command]
pub async fn start_builder_id_device_login(region: Option<String>) -> Result<serde_json::Value, String> {
    let region = region.unwrap_or_else(|| "us-east-1".to_string());
    let oidc_base = format!("https://oidc.{region}.amazonaws.com");
    let start_url = "https://view.awsapps.com/start";
    let client = reqwest::Client::new();

    let reg_res = client
        .post(format!("{oidc_base}/client/register"))
        .json(&serde_json::json!({
            "clientName": "Kiro Account Manager",
            "clientType": "public",
            "scopes": ["codewhisperer:completions","codewhisperer:analysis","codewhisperer:conversations","codewhisperer:transformations","codewhisperer:taskassist"],
            "grantTypes": ["urn:ietf:params:oauth:grant-type:device_code","refresh_token"],
            "issuerUrl": start_url
        }))
        .send().await.map_err(|e| format!("注册客户端失败: {e}"))?;

    if !reg_res.status().is_success() {
        return Err(format!("注册客户端失败: {}", reg_res.text().await.unwrap_or_default()));
    }
    let reg: serde_json::Value = reg_res.json().await.map_err(|e| format!("解析失败: {e}"))?;
    let client_id     = reg["clientId"].as_str().ok_or("缺少 clientId")?.to_string();
    let client_secret = reg["clientSecret"].as_str().ok_or("缺少 clientSecret")?.to_string();

    let auth_res = client
        .post(format!("{oidc_base}/device_authorization"))
        .json(&serde_json::json!({"clientId": client_id, "clientSecret": client_secret, "startUrl": start_url}))
        .send().await.map_err(|e| format!("设备授权失败: {e}"))?;

    if !auth_res.status().is_success() {
        return Err(format!("设备授权失败: {}", auth_res.text().await.unwrap_or_default()));
    }
    let auth: serde_json::Value = auth_res.json().await.map_err(|e| format!("解析失败: {e}"))?;

    let device_code      = auth["deviceCode"].as_str().ok_or("缺少 deviceCode")?.to_string();
    let user_code        = auth["userCode"].as_str().ok_or("缺少 userCode")?.to_string();
    let verification_uri = auth["verificationUriComplete"].as_str()
        .or_else(|| auth["verificationUri"].as_str())
        .ok_or("缺少 verificationUri")?.to_string();
    let interval   = auth["interval"].as_u64().unwrap_or(5);
    let expires_in = auth["expiresIn"].as_u64().unwrap_or(600);

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

/// 轮询设备授权结果
#[tauri::command]
pub async fn poll_builder_id_device_auth(
    region: String, client_id: String, client_secret: String, device_code: String,
) -> Result<serde_json::Value, String> {
    let oidc_base = format!("https://oidc.{region}.amazonaws.com");
    let client = reqwest::Client::new();

    let res = client
        .post(format!("{oidc_base}/token"))
        .json(&serde_json::json!({
            "clientId": client_id, "clientSecret": client_secret,
            "grantType": "urn:ietf:params:oauth:grant-type:device_code",
            "deviceCode": device_code
        }))
        .send().await.map_err(|e| format!("轮询失败: {e}"))?;

    let status = res.status().as_u16();
    let data: serde_json::Value = res.json().await.map_err(|e| format!("解析失败: {e}"))?;

    if status == 200 {
        return Ok(serde_json::json!({
            "success": true, "completed": true,
            "accessToken": data["accessToken"], "refreshToken": data["refreshToken"],
            "expiresIn": data["expiresIn"],
            "clientId": client_id, "clientSecret": client_secret, "region": region
        }));
    }
    if status == 400 {
        return match data["error"].as_str().unwrap_or("unknown") {
            "authorization_pending" => Ok(serde_json::json!({"success":true,"completed":false,"status":"pending"})),
            "slow_down"             => Ok(serde_json::json!({"success":true,"completed":false,"status":"slow_down"})),
            "expired_token"         => Err("设备码已过期".to_string()),
            "access_denied"         => Err("用户拒绝授权".to_string()),
            e                       => Err(format!("授权错误: {e}")),
        };
    }
    Err(format!("未知响应状态: {status}"))
}

/// 设备码信息（申请后传给 worker，注册完成后用于轮询 token）
#[derive(Debug, Clone)]
struct DeviceCodeInfo {
    client_id: String,
    client_secret: String,
    device_code: String,
    user_code: String,
    poll_interval: u64,
    region: String,
}

/// 向 AWS OIDC 申请设备码（注册前调用）
async fn request_device_code_internal(region: &str) -> Result<DeviceCodeInfo, String> {
    let oidc_base = format!("https://oidc.{region}.amazonaws.com");
    let start_url = "https://view.awsapps.com/start";
    let client = reqwest::Client::new();

    // Step 1: 注册 OIDC 客户端
    let reg_res = client
        .post(format!("{oidc_base}/client/register"))
        .json(&serde_json::json!({
            "clientName": "Kiro Account Manager",
            "clientType": "public",
            "scopes": [
                "codewhisperer:completions","codewhisperer:analysis",
                "codewhisperer:conversations","codewhisperer:transformations",
                "codewhisperer:taskassist"
            ],
            "grantTypes": ["urn:ietf:params:oauth:grant-type:device_code","refresh_token"],
            "issuerUrl": start_url
        }))
        .send().await
        .map_err(|e| format!("注册 OIDC 客户端失败: {e}"))?;

    if !reg_res.status().is_success() {
        return Err(format!("注册 OIDC 客户端失败: {}", reg_res.text().await.unwrap_or_default()));
    }
    let reg: serde_json::Value = reg_res.json().await.map_err(|e| format!("解析注册响应失败: {e}"))?;
    let client_id     = reg["clientId"].as_str().ok_or("缺少 clientId")?.to_string();
    let client_secret = reg["clientSecret"].as_str().ok_or("缺少 clientSecret")?.to_string();

    // Step 2: 发起设备授权，获取 user_code / device_code
    let auth_res = client
        .post(format!("{oidc_base}/device_authorization"))
        .json(&serde_json::json!({
            "clientId": client_id,
            "clientSecret": client_secret,
            "startUrl": start_url
        }))
        .send().await
        .map_err(|e| format!("申请设备码失败: {e}"))?;

    if !auth_res.status().is_success() {
        return Err(format!("申请设备码失败: {}", auth_res.text().await.unwrap_or_default()));
    }
    let auth: serde_json::Value = auth_res.json().await.map_err(|e| format!("解析设备授权响应失败: {e}"))?;

    let device_code   = auth["deviceCode"].as_str().ok_or("缺少 deviceCode")?.to_string();
    let user_code     = auth["userCode"].as_str().ok_or("缺少 userCode")?.to_string();
    let poll_interval = auth["interval"].as_u64().unwrap_or(5);

    Ok(DeviceCodeInfo { client_id, client_secret, device_code, user_code, poll_interval, region: region.to_string() })
}

/// 注册完成后轮询 /token 接口拿 refresh_token（最多等待 timeout_secs 秒）
async fn poll_token_after_register(
    device: &DeviceCodeInfo,
    timeout_secs: u64,
) -> Result<(String, String), String> {
    let oidc_base = format!("https://oidc.{}.amazonaws.com", device.region);
    let client = reqwest::Client::new();

    let token_body = serde_json::json!({
        "clientId": device.client_id,
        "clientSecret": device.client_secret,
        "grantType": "urn:ietf:params:oauth:grant-type:device_code",
        "deviceCode": device.device_code
    });

    let start = std::time::Instant::now();
    let timeout = std::time::Duration::from_secs(timeout_secs);

    loop {
        if start.elapsed() > timeout {
            return Err(format!("轮询 Token 超时（{}s）", timeout_secs));
        }

        tokio::time::sleep(std::time::Duration::from_secs(device.poll_interval)).await;

        let resp = client
            .post(format!("{oidc_base}/token"))
            .json(&token_body)
            .send().await
            .map_err(|e| format!("Token 请求失败: {e}"))?;

        if resp.status().is_success() {
            let data: serde_json::Value = resp.json().await
                .map_err(|e| format!("解析 Token 响应失败: {e}"))?;
            let access_token  = data["accessToken"].as_str().ok_or("缺少 accessToken")?.to_string();
            let refresh_token = data["refreshToken"].as_str().ok_or("缺少 refreshToken")?.to_string();
            return Ok((access_token, refresh_token));
        }

        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        if body.contains("authorization_pending") || body.contains("AuthorizationPending") {
            continue; // 继续等待
        }
        return Err(format!("Token 轮询失败 ({status}): {body}"));
    }
}

/// 执行批量注册（通过 Node.js sidecar）
/// 流程：申请设备码 → 传 user_code 给 worker → worker 完成注册 → 轮询 token → 导入账号表
#[tauri::command]
pub async fn run_auto_register(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    params: RegisterParams,
) -> Result<RegisterResult, String> {
    let sidecar_dir = get_sidecar_dir();
    let worker_path = sidecar_dir.join("register-worker.mjs");
    if !worker_path.exists() {
        return Err(format!("注册脚本不存在: {}", worker_path.display()));
    }

    let region = params.region.clone().unwrap_or_else(|| "us-east-1".to_string());

    // Step 1: 申请设备码
    emit_log(&app_handle, "[设备码] 正在向 AWS OIDC 申请设备码...");
    emit_log(&app_handle, &format!("[设备码] region: {}", region));
    let device_info = match request_device_code_internal(&region).await {
        Ok(info) => {
            emit_log(&app_handle, &format!("✓ 设备码申请成功，user_code: {}", info.user_code));
            info
        }
        Err(e) => {
            emit_log(&app_handle, &format!("✗ 申请设备码失败: {e}"));
            return Err(format!("申请设备码失败: {e}"));
        }
    };

    // Step 2: 把 user_code 注入到 params 中传给 worker
    let mut worker_params = params.clone();
    worker_params.user_code = Some(device_info.user_code.clone());
    worker_params.verification_uri = Some(format!(
        "https://view.awsapps.com/start/#/device?user_code={}",
        device_info.user_code
    ));

    let input = serde_json::to_string(&worker_params).map_err(|e| format!("参数序列化失败: {e}"))?;
    emit_log(&app_handle, &format!("[设备码] 启动浏览器注册 Worker（共 {} 个账号）...", params.count));

    let mut child = Command::new("node")
        .arg(worker_path.to_str().unwrap())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(&sidecar_dir)
        .spawn()
        .map_err(|e| format!("启动 Node.js 失败: {e}，请确保已安装 Node.js"))?;

    let pid = child.id();
    set_worker_pid(Some(pid));
    emit_log(&app_handle, &format!("[Worker] PID: {pid}"));

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(input.as_bytes()).map_err(|e| format!("写入参数失败: {e}"))?;
    }

    let stdout = child.stdout.take().ok_or("无法获取 stdout")?;
    let reader = std::io::BufReader::new(stdout);
    let mut final_result: Option<RegisterResult> = None;

    use std::io::BufRead;
    for line in reader.lines() {
        let line = match line { Ok(l) => l, Err(_) => continue };
        if line.trim().is_empty() { continue }

        match serde_json::from_str::<WorkerLine>(&line) {
            Ok(wl) => match wl.kind.as_str() {
                "log" => {
                    let msg = wl.data.as_str().unwrap_or(&wl.data.to_string()).to_string();
                    emit_log(&app_handle, &msg);
                }
                "result" => {
                    if let Ok(r) = serde_json::from_value::<RegisterResult>(wl.data.clone()) {
                        final_result = Some(r);
                    } else {
                        let err = wl.data["error"].as_str().unwrap_or("未知错误").to_string();
                        final_result = Some(RegisterResult {
                            results: vec![RegisterRecord {
                                success: false, email: None, password: None,
                                name: None, error: Some(err),
                            }],
                            ok: 0, fail: 1,
                        });
                    }
                }
                _ => {}
            },
            Err(_) => emit_log(&app_handle, &line),
        }
    }

    let exit_status = child.wait();
    set_worker_pid(None);

    match exit_status {
        Ok(s) if !s.success() => {
            emit_log(&app_handle, "⚠ 注册 Worker 已停止");
            return Ok(final_result.unwrap_or(RegisterResult { results: vec![], ok: 0, fail: 0 }));
        }
        _ => {}
    }

    let mut result = final_result.ok_or_else(|| "注册 Worker 未返回结果".to_string())?;

    // Step 3: 对每个成功的账号，轮询 token 并导入账号表
    let mut imported_count = 0u32;
    for record in result.results.iter_mut() {
        if !record.success { continue }

        let email    = record.email.clone().unwrap_or_default();
        let password = record.password.clone().unwrap_or_default();
        let name     = record.name.clone().unwrap_or_default();

        emit_log(&app_handle, "========== 设备码注册账号信息 ==========");
        emit_log(&app_handle, &format!("邮箱: {}  密码: {}", email, password));
        emit_log(&app_handle, &format!("姓名: {}  user_code: {}", name, device_info.user_code));
        emit_log(&app_handle, "========================================");

        // 只有第一个成功账号能用这个设备码换 token
        if imported_count > 0 {
            emit_log(&app_handle, &format!("⚠ 账号 {} 注册成功但无法获取 token（设备码已用完），请手动导入", email));
            continue;
        }

        emit_log(&app_handle, &format!("[设备码] 正在轮询 token（账号: {}）...", email));
        let poll_timeout = 120u64;
        match poll_token_after_register(&device_info, poll_timeout).await {
            Ok((access_token, refresh_token)) => {
                emit_log(&app_handle, "✓ 成功获取 token！");
                emit_log(&app_handle, &format!("邮箱: {}  密码: {}", email, password));

                // 导入到账号表并检查账号状态
                emit_log(&app_handle, "正在导入账号并检查账号状态...");
                match add_account_by_idc(
                    state.clone(),
                    Some("BuilderId".to_string()),
                    refresh_token.clone(),
                    device_info.client_id.clone(),
                    device_info.client_secret.clone(),
                    Some(device_info.region.clone()),
                    None,
                    Some(access_token.clone()),
                    Some(password.clone()),
                    None,
                    None,
                ).await {
                    Ok(add_result) => {
                        emit_log(&app_handle, &format!(
                            "✅ 账号已导入！email={} is_new={}",
                            add_result.account.email.as_deref().unwrap_or(&email),
                            add_result.is_new
                        ));
                        imported_count += 1;
                    }
                    Err(e) if e.starts_with("BANNED") => {
                        emit_log(&app_handle, &format!("⚠ 账号已被封禁: {}（注册成功但立即被 AWS 封禁）", email));
                        imported_count += 1; // 仍然算导入了
                    }
                    Err(e) => {
                        emit_log(&app_handle, &format!("⚠ 账号导入失败: {e}（注册已成功，请手动添加）"));
                    }
                }
            }
            Err(e) => {
                emit_log(&app_handle, &format!("⚠ 获取 token 失败: {e}（注册已成功，请手动添加账号）"));
            }
        }
    }

    if imported_count > 0 {
        emit_log(&app_handle, &format!("✅ 共导入 {} 个账号到账号列表", imported_count));
    }

    Ok(result)
}

/// 停止正在运行的注册任务
#[tauri::command]
pub fn stop_auto_register(app_handle: tauri::AppHandle) -> bool {
    // 设置停止标志，阻止新的并发任务启动
    stop_flag().store(true, Ordering::Relaxed);

    let pids = take_all_worker_pids();
    if pids.is_empty() {
        emit_log(&app_handle, "⚠ 没有正在运行的 Worker");
        return false;
    }

    let mut killed_any = false;
    for pid in &pids {
        emit_log(&app_handle, &format!("正在停止注册 Worker (PID: {pid})..."));
        if kill_process(*pid) {
            killed_any = true;
        }
    }

    if killed_any {
        emit_log(&app_handle, "⚠ 注册已停止");
    }
    killed_any
}

/// 重置停止标志（在开始新一轮注册前调用）
#[tauri::command]
pub fn reset_register_stop_flag() {
    stop_flag().store(false, Ordering::Relaxed);
}

/// 授权码模式专用 Worker 启动命令
/// 只负责启动 Node.js worker 完成浏览器注册，不申请设备码
/// 与 run_authorize_register 并发执行
#[tauri::command]
pub async fn run_authorize_worker(
    app_handle: tauri::AppHandle,
    authorize_url: String,
    proxy_url: Option<String>,
    use_fingerprint: bool,
    incognito: bool,
    headless: bool,
    temp_mail_apis: Vec<TempMailApi>,
    temp_mail_select: Option<String>,
) -> Result<RegisterResult, String> {
    let sidecar_dir = get_sidecar_dir();
    let worker_path = sidecar_dir.join("register-worker.mjs");
    if !worker_path.exists() {
        return Err(format!("注册脚本不存在: {}", worker_path.display()));
    }

    // 构造授权码模式参数
    let worker_params = serde_json::json!({
        "count": 1,
        "concurrency": 1,
        "proxyUrl": proxy_url,
        "useFingerprint": use_fingerprint,
        "incognito": incognito,
        "headless": headless,
        "tempMailApis": temp_mail_apis,
        "tempMailSelect": temp_mail_select,
        "registerMode": "authorize",
        "authorizeUrl": authorize_url,
    });

    let input = serde_json::to_string(&worker_params)
        .map_err(|e| format!("参数序列化失败: {e}"))?;

    emit_log(&app_handle, "[授权码] 启动浏览器注册 Worker...");

    let mut child = Command::new("node")
        .arg(worker_path.to_str().unwrap())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .current_dir(&sidecar_dir)
        .spawn()
        .map_err(|e| format!("启动 Node.js 失败: {e}"))?;

    let pid = child.id();
    set_worker_pid(Some(pid));
    emit_log(&app_handle, &format!("[Worker] PID: {pid}"));

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(input.as_bytes())
            .map_err(|e| format!("写入参数失败: {e}"))?;
    }

    let stdout = child.stdout.take().ok_or("无法获取 stdout")?;
    let reader = std::io::BufReader::new(stdout);
    let mut final_result: Option<RegisterResult> = None;

    use std::io::BufRead;
    for line in reader.lines() {
        let line = match line { Ok(l) => l, Err(_) => continue };
        if line.trim().is_empty() { continue }

        match serde_json::from_str::<WorkerLine>(&line) {
            Ok(wl) => match wl.kind.as_str() {
                "log" => {
                    let msg = wl.data.as_str().unwrap_or(&wl.data.to_string()).to_string();
                    emit_log(&app_handle, &msg);
                }
                "result" => {
                    if let Ok(r) = serde_json::from_value::<RegisterResult>(wl.data.clone()) {
                        final_result = Some(r);
                    } else {
                        let err = wl.data["error"].as_str().unwrap_or("未知错误").to_string();
                        final_result = Some(RegisterResult {
                            results: vec![RegisterRecord {
                                success: false, email: None, password: None,
                                name: None, error: Some(err),
                            }],
                            ok: 0, fail: 1,
                        });
                    }
                }
                _ => {}
            },
            Err(_) => emit_log(&app_handle, &line),
        }
    }

    let _ = child.wait();
    set_worker_pid(None);

    final_result.ok_or_else(|| "Worker 未返回结果".to_string())
}

// ===== 辅助函数 =====

fn get_sidecar_dir() -> std::path::PathBuf {
    let dev_path = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("sidecar");
    if dev_path.exists() { return dev_path; }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let prod = dir.join("sidecar");
            if prod.exists() { return prod; }
        }
    }
    dev_path
}

fn emit_log(app_handle: &tauri::AppHandle, msg: &str) {
    let _ = app_handle.emit("register-log", msg.to_string());
}

/// 跨平台杀进程
fn kill_process(pid: u32) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        // 先发 SIGTERM，给进程清理机会
        let term = Command::new("kill").args(["-TERM", &pid.to_string()]).output();
        if term.is_ok() {
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
        // 再发 SIGKILL 确保终止
        Command::new("kill").args(["-KILL", &pid.to_string()]).output().is_ok()
    }
    #[cfg(windows)]
    {
        Command::new("taskkill")
            .args(["/F", "/T", "/PID", &pid.to_string()])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

// ===== 授权码注册模式 =====

/// 授权码注册的准备信息（返回给前端）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizeRegisterInfo {
    /// 浏览器需要打开的授权 URL
    pub authorize_url: String,
    /// 本地回调服务器端口
    pub callback_port: u16,
    /// OIDC client_id（用于后续导入）
    pub client_id: String,
    /// OIDC client_secret
    pub client_secret: String,
    /// PKCE code_verifier（用于换 token）
    pub code_verifier: String,
    /// 完整回调 URI
    pub redirect_uri: String,
    /// 随机 state（防 CSRF）
    pub state: String,
}

/// 生成 PKCE code_verifier 和 code_challenge（S256）
fn generate_pkce() -> (String, String) {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    use sha2::{Digest, Sha256};

    // code_verifier: 43-128 个 URL 安全字符
    let verifier_bytes: Vec<u8> = (0..32).map(|_| rand::random::<u8>()).collect();
    let code_verifier = URL_SAFE_NO_PAD.encode(&verifier_bytes);

    // code_challenge = BASE64URL(SHA256(code_verifier))
    let mut hasher = Sha256::new();
    hasher.update(code_verifier.as_bytes());
    let hash = hasher.finalize();
    let code_challenge = URL_SAFE_NO_PAD.encode(hash);

    (code_verifier, code_challenge)
}

/// 启动授权码注册流程：
/// 1. 注册 OIDC 客户端（authorization_code 类型）
/// 2. 生成 PKCE
/// 3. 构建 authorize_url
/// 4. 启动本地 HTTP 服务器监听回调
/// 返回 AuthorizeRegisterInfo 给前端，前端把 authorize_url 传给 worker
#[tauri::command]
pub async fn start_authorize_register() -> Result<AuthorizeRegisterInfo, String> {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};

    let oidc_base = format!("https://oidc.{AUTHORIZE_REGION}.amazonaws.com");
    let client = reqwest::Client::new();

    // Step 1: 启动本地回调服务器（随机端口）
    let server = tiny_http::Server::http("127.0.0.1:0")
        .map_err(|e| format!("启动本地服务器失败: {e}"))?;
    let port = server
        .server_addr()
        .to_ip()
        .ok_or_else(|| "获取服务器端口失败".to_string())?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}/oauth/callback");

    // Step 2: 注册 OIDC 客户端（authorization_code 类型）
    let scopes: Vec<&str> = AUTHORIZE_SCOPES.to_vec();
    let reg_body = serde_json::json!({
        "clientName": "Kiro IDE",
        "clientType": "public",
        "scopes": scopes,
        "grantTypes": ["authorization_code", "refresh_token"],
        "redirectUris": [redirect_uri],
        "issuerUrl": AUTHORIZE_ISSUER_URL
    });

    let reg_resp = client
        .post(format!("{oidc_base}/client/register"))
        .json(&reg_body)
        .send().await
        .map_err(|e| format!("注册 OIDC 客户端失败: {e}"))?;

    if !reg_resp.status().is_success() {
        return Err(format!("注册 OIDC 客户端失败: {}", reg_resp.text().await.unwrap_or_default()));
    }

    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct RegResp { client_id: String, client_secret: String }
    let reg: RegResp = reg_resp.json().await
        .map_err(|e| format!("解析注册响应失败: {e}"))?;

    // Step 3: 生成 PKCE 和 state
    let (code_verifier, code_challenge) = generate_pkce();
    let state = uuid::Uuid::new_v4().to_string().replace('-', "");

    // Step 4: 构建 authorize_url
    let authorize_url = format!(
        "{oidc_base}/authorize?response_type=code&client_id={}&redirect_uri={}&scopes={}&state={}&code_challenge={}&code_challenge_method=S256",
        urlencoding::encode(&reg.client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&AUTHORIZE_SCOPES.join(",")),
        urlencoding::encode(&state),
        urlencoding::encode(&code_challenge),
    );

    // Step 5: 后台线程监听回调，通过全局 channel 传递 code
    let expected_state = state.clone();
    let (tx, rx) = tokio::sync::oneshot::channel::<Result<String, String>>();

    std::thread::spawn(move || {
        let timeout = std::time::Duration::from_secs(600); // 10 分钟超时
        let start = std::time::Instant::now();
        loop {
            if start.elapsed() > timeout {
                let _ = tx.send(Err("等待 OAuth 回调超时（10分钟）".to_string()));
                break;
            }
            match server.try_recv() {
                Ok(Some(request)) => {
                    let url = request.url().to_string();
                    if url.starts_with("/oauth/callback") {
                        let query = url.split('?').nth(1).unwrap_or("");
                        let params: std::collections::HashMap<String, String> =
                            url::form_urlencoded::parse(query.as_bytes())
                                .into_owned()
                                .collect();

                        // 回复浏览器
                        let html = if params.get("state").map(|s| s.as_str()) == Some(&expected_state) {
                            "<html><body><h1>授权成功</h1><p>注册完成，您可以关闭此窗口</p></body></html>"
                        } else {
                            "<html><body><h1>授权失败</h1><p>state 不匹配</p></body></html>"
                        };
                        let resp = tiny_http::Response::from_string(html).with_header(
                            tiny_http::Header::from_bytes(
                                &b"Content-Type"[..],
                                &b"text/html; charset=utf-8"[..],
                            ).unwrap(),
                        );
                        let _ = request.respond(resp);

                        // 验证 state
                        if params.get("state").map(|s| s.as_str()) != Some(&expected_state) {
                            let _ = tx.send(Err("state 不匹配，可能存在 CSRF 攻击".to_string()));
                        } else if let Some(error) = params.get("error") {
                            let _ = tx.send(Err(format!("OAuth 错误: {error}")));
                        } else if let Some(code) = params.get("code") {
                            let _ = tx.send(Ok(code.clone()));
                        } else {
                            let _ = tx.send(Err("回调中未找到 code 参数".to_string()));
                        }
                        break;
                    }
                }
                Ok(None) => {}
                Err(_) => break,
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    });

    // 把 rx 存到全局，供 run_authorize_register 使用
    {
        let mut guard = authorize_callback_store().lock().await;
        *guard = Some(rx);
    }

    Ok(AuthorizeRegisterInfo {
        authorize_url,
        callback_port: port,
        client_id: reg.client_id,
        client_secret: reg.client_secret,
        code_verifier,
        redirect_uri,
        state,
    })
}

// 全局存储授权码回调的 oneshot receiver（用 tokio Mutex 保证 Send+Sync）
type AuthCallbackRx = tokio::sync::Mutex<Option<tokio::sync::oneshot::Receiver<Result<String, String>>>>;

static AUTHORIZE_CALLBACK_RX: OnceLock<AuthCallbackRx> = OnceLock::new();

fn authorize_callback_store() -> &'static AuthCallbackRx {
    AUTHORIZE_CALLBACK_RX.get_or_init(|| tokio::sync::Mutex::new(None))
}

/// 授权码注册参数（worker 完成注册后调用）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizeRegisterParams {
    /// 从 start_authorize_register 获取的信息
    pub client_id: String,
    pub client_secret: String,
    pub code_verifier: String,
    pub redirect_uri: String,
    /// worker 注册的账号信息
    pub email: Option<String>,
    pub password: Option<String>,
    pub name: Option<String>,
}

/// 等待 OAuth 回调并用 code 换 token，最后导入账号
/// 在 worker 完成注册（浏览器点击 Allow access）后调用
#[tauri::command]
pub async fn run_authorize_register(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    params: AuthorizeRegisterParams,
) -> Result<serde_json::Value, String> {
    emit_log(&app_handle, "等待 OAuth 回调（浏览器点击 Allow access 后自动完成）...");

    // 取出 receiver
    let rx = {
        let mut guard = authorize_callback_store().lock().await;
        guard.take()
    };

    let rx = rx.ok_or("未找到授权回调通道，请先调用 start_authorize_register")?;

    // 等待回调
    let code = match rx.await {
        Ok(Ok(c)) => c,
        Ok(Err(e)) => {
            emit_log(&app_handle, &format!("✗ 回调失败: {e}"));
            return Err(format!("OAuth 回调失败: {e}"));
        }
        Err(_) => return Err("授权回调通道已关闭".to_string()),
    };

    emit_log(&app_handle, "✓ 收到 OAuth 回调，正在用 code 换取 token...");

    // 用 code + code_verifier 换 token
    let oidc_base = format!("https://oidc.{AUTHORIZE_REGION}.amazonaws.com");
    let client = reqwest::Client::new();

    let token_body = serde_json::json!({
        "clientId":     params.client_id,
        "clientSecret": params.client_secret,
        "grantType":    "authorization_code",
        "code":         code,
        "codeVerifier": params.code_verifier,
        "redirectUri":  params.redirect_uri,
    });

    let token_resp = client
        .post(format!("{oidc_base}/token"))
        .json(&token_body)
        .send().await
        .map_err(|e| format!("换取 token 失败: {e}"))?;

    if !token_resp.status().is_success() {
        let err = token_resp.text().await.unwrap_or_default();
        emit_log(&app_handle, &format!("✗ 换取 token 失败: {err}"));
        return Err(format!("换取 token 失败: {err}"));
    }

    let token_data: serde_json::Value = token_resp.json().await
        .map_err(|e| format!("解析 token 响应失败: {e}"))?;

    let access_token  = token_data["accessToken"].as_str().ok_or("缺少 accessToken")?.to_string();
    let refresh_token = token_data["refreshToken"].as_str().ok_or("缺少 refreshToken")?.to_string();

    let email    = params.email.clone().unwrap_or_default();
    let password = params.password.clone().unwrap_or_default();
    let name     = params.name.clone().unwrap_or_default();

    emit_log(&app_handle, "✓ 成功获取 token！");
    emit_log(&app_handle, &format!("========== 注册账号信息 =========="));
    emit_log(&app_handle, &format!("邮箱:          {}", email));
    emit_log(&app_handle, &format!("密码:          {}", password));
    emit_log(&app_handle, &format!("姓名:          {}", name));
    emit_log(&app_handle, &format!("access_token:  {}...", &access_token[..access_token.len().min(20)]));
    emit_log(&app_handle, &format!("refresh_token: {}...", &refresh_token[..refresh_token.len().min(20)]));
    emit_log(&app_handle, &format!("client_id:     {}", params.client_id));
    emit_log(&app_handle, &format!("region:        {}", AUTHORIZE_REGION));
    emit_log(&app_handle, &format!("=================================="));

    // 导入账号
    emit_log(&app_handle, "正在导入账号到账号列表...");
    match add_account_by_idc(
        state,
        Some("BuilderId".to_string()),
        refresh_token.clone(),
        params.client_id.clone(),
        params.client_secret.clone(),
        Some(AUTHORIZE_REGION.to_string()),
        None,
        Some(access_token.clone()),
        Some(password.clone()),
        None,
        None,
    ).await {
        Ok(add_result) => {
            emit_log(&app_handle, &format!(
                "✅ 账号已导入！id={} email={} is_new={}",
                add_result.account.id,
                add_result.account.email.as_deref().unwrap_or(&email),
                add_result.is_new
            ));
            Ok(serde_json::json!({
                "success": true,
                "email": add_result.account.email,
                "accountId": add_result.account.id,
                "isNew": add_result.is_new,
            }))
        }
        Err(e) => {
            emit_log(&app_handle, &format!("⚠ 账号导入失败: {e}（注册已成功，请手动添加）"));
            Ok(serde_json::json!({
                "success": true,
                "email": email,
                "importError": e,
            }))
        }
    }
}

/// 授权码模式一体化命令：注册 OIDC 客户端 + 启动回调服务器 + 启动 worker + 等待回调 + 换 token + 导入账号
/// 每次调用独立，不依赖全局状态，天然支持并发
#[tauri::command]
pub async fn run_authorize_register_full(
    app_handle: tauri::AppHandle,
    state: State<'_, AppState>,
    proxy_url: Option<String>,
    use_fingerprint: bool,
    incognito: bool,
    headless: bool,
    temp_mail_apis: Vec<TempMailApi>,
    temp_mail_select: Option<String>,
) -> Result<serde_json::Value, String> {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};

    let oidc_base = format!("https://oidc.{AUTHORIZE_REGION}.amazonaws.com");
    let client = reqwest::Client::new();

    // Step 1: 启动本地回调服务器（随机端口）
    emit_log(&app_handle, "[授权码] 启动本地回调服务器...");
    let server = tiny_http::Server::http("127.0.0.1:0")
        .map_err(|e| format!("启动本地服务器失败: {e}"))?;
    let port = server
        .server_addr()
        .to_ip()
        .ok_or_else(|| "获取服务器端口失败".to_string())?
        .port();
    let redirect_uri = format!("http://127.0.0.1:{port}/oauth/callback");
    emit_log(&app_handle, &format!("[授权码] 回调端口: {port}"));

    // Step 2: 注册 OIDC 客户端
    emit_log(&app_handle, "[授权码] 注册 OIDC 客户端...");
    let scopes: Vec<&str> = AUTHORIZE_SCOPES.to_vec();
    let reg_body = serde_json::json!({
        "clientName": "Kiro IDE",
        "clientType": "public",
        "scopes": scopes,
        "grantTypes": ["authorization_code", "refresh_token"],
        "redirectUris": [redirect_uri],
        "issuerUrl": AUTHORIZE_ISSUER_URL
    });

    let reg_resp = client
        .post(format!("{oidc_base}/client/register"))
        .json(&reg_body)
        .send().await
        .map_err(|e| format!("注册 OIDC 客户端失败: {e}"))?;

    if !reg_resp.status().is_success() {
        return Err(format!("注册 OIDC 客户端失败: {}", reg_resp.text().await.unwrap_or_default()));
    }

    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct RegResp { client_id: String, client_secret: String }
    let reg: RegResp = reg_resp.json().await
        .map_err(|e| format!("解析注册响应失败: {e}"))?;

    // Step 3: 生成 PKCE 和 state
    let (code_verifier, code_challenge) = generate_pkce();
    let state_str = uuid::Uuid::new_v4().to_string().replace('-', "");

    // Step 4: 构建 authorize_url
    let authorize_url = format!(
        "{oidc_base}/authorize?response_type=code&client_id={}&redirect_uri={}&scopes={}&state={}&code_challenge={}&code_challenge_method=S256",
        urlencoding::encode(&reg.client_id),
        urlencoding::encode(&redirect_uri),
        urlencoding::encode(&AUTHORIZE_SCOPES.join(",")),
        urlencoding::encode(&state_str),
        urlencoding::encode(&code_challenge),
    );
    emit_log(&app_handle, "[授权码] 授权 URL 已生成，启动浏览器注册...");

    // Step 5: 后台线程监听回调
    let expected_state = state_str.clone();
    let (tx, rx) = tokio::sync::oneshot::channel::<Result<String, String>>();

    std::thread::spawn(move || {
        let timeout = std::time::Duration::from_secs(600);
        let start = std::time::Instant::now();
        loop {
            if start.elapsed() > timeout {
                let _ = tx.send(Err("等待 OAuth 回调超时（10分钟）".to_string()));
                break;
            }
            match server.try_recv() {
                Ok(Some(request)) => {
                    let url = request.url().to_string();
                    if url.starts_with("/oauth/callback") {
                        let query = url.split('?').nth(1).unwrap_or("");
                        let params: std::collections::HashMap<String, String> =
                            url::form_urlencoded::parse(query.as_bytes())
                                .into_owned()
                                .collect();

                        let html = if params.get("state").map(|s| s.as_str()) == Some(&expected_state) {
                            "<html><body><h1>授权成功</h1><p>注册完成，您可以关闭此窗口</p></body></html>"
                        } else {
                            "<html><body><h1>授权失败</h1><p>state 不匹配</p></body></html>"
                        };
                        let resp = tiny_http::Response::from_string(html).with_header(
                            tiny_http::Header::from_bytes(
                                &b"Content-Type"[..],
                                &b"text/html; charset=utf-8"[..],
                            ).unwrap(),
                        );
                        let _ = request.respond(resp);

                        if params.get("state").map(|s| s.as_str()) != Some(&expected_state) {
                            let _ = tx.send(Err("state 不匹配，可能存在 CSRF 攻击".to_string()));
                        } else if let Some(error) = params.get("error") {
                            let _ = tx.send(Err(format!("OAuth 错误: {error}")));
                        } else if let Some(code) = params.get("code") {
                            let _ = tx.send(Ok(code.clone()));
                        } else {
                            let _ = tx.send(Err("回调中未找到 code 参数".to_string()));
                        }
                        break;
                    }
                }
                Ok(None) => {}
                Err(_) => break,
            }
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    });

    // Step 6: 启动 worker（浏览器注册）
    // 先检查停止标志
    if is_stopped() {
        return Err("注册已被停止".to_string());
    }

    let sidecar_dir = get_sidecar_dir();
    let worker_path = sidecar_dir.join("register-worker.mjs");
    if !worker_path.exists() {
        return Err(format!("注册脚本不存在: {}", worker_path.display()));
    }

    let worker_params = serde_json::json!({
        "count": 1,
        "concurrency": 1,
        "proxyUrl": proxy_url,
        "useFingerprint": use_fingerprint,
        "incognito": incognito,
        "headless": headless,
        "tempMailApis": temp_mail_apis,
        "tempMailSelect": temp_mail_select,
        "registerMode": "authorize",
        "authorizeUrl": authorize_url,
    });

    let input = serde_json::to_string(&worker_params)
        .map_err(|e| format!("参数序列化失败: {e}"))?;

    let app_handle2 = app_handle.clone();
    let worker_handle = tokio::task::spawn_blocking(move || {
        let mut child = Command::new("node")
            .arg(worker_path.to_str().unwrap())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .current_dir(&sidecar_dir)
            .spawn()
            .map_err(|e| format!("启动 Node.js 失败: {e}"))?;

        let pid = child.id();
        add_worker_pid(pid);
        emit_log(&app_handle2, &format!("[Worker] PID: {pid}"));

        if let Some(mut stdin) = child.stdin.take() {
            stdin.write_all(input.as_bytes())
                .map_err(|e| format!("写入参数失败: {e}"))?;
        }

        let stdout = child.stdout.take().ok_or("无法获取 stdout")?;
        let reader = std::io::BufReader::new(stdout);
        let mut final_result: Option<RegisterResult> = None;

        use std::io::BufRead;
        for line in reader.lines() {
            let line = match line { Ok(l) => l, Err(_) => continue };
            if line.trim().is_empty() { continue }

            match serde_json::from_str::<WorkerLine>(&line) {
                Ok(wl) => match wl.kind.as_str() {
                    "log" => {
                        let msg = wl.data.as_str().unwrap_or(&wl.data.to_string()).to_string();
                        emit_log(&app_handle2, &msg);
                    }
                    "result" => {
                        if let Ok(r) = serde_json::from_value::<RegisterResult>(wl.data.clone()) {
                            final_result = Some(r);
                        } else {
                            let err = wl.data["error"].as_str().unwrap_or("未知错误").to_string();
                            final_result = Some(RegisterResult {
                                results: vec![RegisterRecord {
                                    success: false, email: None, password: None,
                                    name: None, error: Some(err),
                                }],
                                ok: 0, fail: 1,
                            });
                        }
                    }
                    _ => {}
                },
                Err(_) => emit_log(&app_handle2, &line),
            }
        }

        let _ = child.wait();
        remove_worker_pid(pid);
        final_result.ok_or_else(|| "Worker 未返回结果".to_string())
    });

    // Step 7: 等待 worker 完成
    let worker_result = worker_handle.await
        .map_err(|e| format!("Worker 任务失败: {e}"))??;

    let record = worker_result.results.first();
    let email = record.and_then(|r| r.email.clone()).unwrap_or_default();
    let password = record.and_then(|r| r.password.clone()).unwrap_or_default();

    if !worker_result.results.iter().any(|r| r.success) {
        let err = record.and_then(|r| r.error.clone()).unwrap_or_else(|| "注册失败".to_string());
        return Err(err);
    }

    // Step 8: 等待 OAuth 回调
    emit_log(&app_handle, "等待 OAuth 回调（浏览器点击 Allow access 后自动完成）...");
    let code = match rx.await {
        Ok(Ok(c)) => c,
        Ok(Err(e)) => {
            emit_log(&app_handle, &format!("✗ 回调失败: {e}"));
            return Err(format!("OAuth 回调失败: {e}"));
        }
        Err(_) => return Err("授权回调通道已关闭".to_string()),
    };

    emit_log(&app_handle, "✓ 收到 OAuth 回调，正在用 code 换取 token...");

    // Step 9: 用 code 换 token
    let token_body = serde_json::json!({
        "clientId":     reg.client_id,
        "clientSecret": reg.client_secret,
        "grantType":    "authorization_code",
        "code":         code,
        "codeVerifier": code_verifier,
        "redirectUri":  redirect_uri,
    });

    let token_resp = client
        .post(format!("{oidc_base}/token"))
        .json(&token_body)
        .send().await
        .map_err(|e| format!("换取 token 失败: {e}"))?;

    if !token_resp.status().is_success() {
        let err = token_resp.text().await.unwrap_or_default();
        emit_log(&app_handle, &format!("✗ 换取 token 失败: {err}"));
        return Err(format!("换取 token 失败: {err}"));
    }

    let token_data: serde_json::Value = token_resp.json().await
        .map_err(|e| format!("解析 token 响应失败: {e}"))?;

    let access_token  = token_data["accessToken"].as_str().ok_or("缺少 accessToken")?.to_string();
    let refresh_token = token_data["refreshToken"].as_str().ok_or("缺少 refreshToken")?.to_string();

    emit_log(&app_handle, "✓ 成功获取 token！");
    emit_log(&app_handle, &format!("邮箱: {email}  密码: {password}"));

    // Step 10: 导入账号（内部会调用 get_usage_by_provider 检查账号状态）
    emit_log(&app_handle, "正在导入账号并检查账号状态...");
    match add_account_by_idc(
        state,
        Some("BuilderId".to_string()),
        refresh_token.clone(),
        reg.client_id.clone(),
        reg.client_secret.clone(),
        Some(AUTHORIZE_REGION.to_string()),
        None,
        Some(access_token.clone()),
        Some(password.clone()),
        None,
        None,
    ).await {
        Ok(add_result) => {
            let is_banned = add_result.account.status == "banned";
            if is_banned {
                emit_log(&app_handle, &format!(
                    "⚠ 账号已被封禁！email={}",
                    add_result.account.email.as_deref().unwrap_or(&email),
                ));
            } else {
                emit_log(&app_handle, &format!(
                    "✅ 账号已导入！email={} is_new={}",
                    add_result.account.email.as_deref().unwrap_or(&email),
                    add_result.is_new
                ));
            }
            Ok(serde_json::json!({
                "success": true,
                "banned": is_banned,
                "email": add_result.account.email.or(Some(email)),
                "password": password,
                "accountId": add_result.account.id,
                "isNew": add_result.is_new,
            }))
        }
        Err(e) => {
            if e.starts_with("BANNED") {
                emit_log(&app_handle, &format!("⚠ 账号已被封禁: {email}（注册成功但立即被 AWS 封禁）"));
                Ok(serde_json::json!({
                    "success": true,
                    "banned": true,
                    "email": email,
                    "password": password,
                }))
            } else {
                emit_log(&app_handle, &format!("⚠ 账号导入失败: {e}（注册已成功，请手动添加）"));
                Ok(serde_json::json!({
                    "success": true,
                    "email": email,
                    "password": password,
                    "importError": e,
                }))
            }
        }
    }
}

// ===== 邮箱 API 测试与清理 =====

/// 构建带可选代理的 HTTP 客户端
fn build_client_with_proxy(proxy_url: Option<&str>) -> Result<reqwest::Client, String> {
    let mut builder = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .connect_timeout(std::time::Duration::from_secs(10));

    // 优先使用传入的代理，否则从 Kiro 设置获取
    if let Some(url) = proxy_url.filter(|u| !u.is_empty()) {
        if let Ok(proxy) = reqwest::Proxy::all(url) {
            builder = builder.proxy(proxy);
        }
    } else {
        // 使用 Kiro IDE 配置的代理
        if let Ok(client) = crate::clients::http_client::build_http_client() {
            return Ok(client);
        }
    }

    builder.build().map_err(|e| format!("创建 HTTP 客户端失败: {e}"))
}

/// 测试邮箱 API 接口是否正常（创建测试邮箱后立即删除）
#[tauri::command]
pub async fn test_temp_mail_api(
    api_url: String,
    admin_key: String,
    proxy_url: Option<String>,
) -> Result<String, String> {
    let client = build_client_with_proxy(proxy_url.as_deref())?;
    let base = api_url.trim_end_matches('/');

    // 创建测试邮箱
    let create_body = serde_json::json!({
        "enablePrefix": false,
        "name": format!("test{}", uuid::Uuid::new_v4().to_string().replace('-', "")[..12].to_lowercase())
    });

    let resp = client
        .post(format!("{base}/admin/new_address"))
        .header("x-admin-auth", &admin_key)
        .header("Content-Type", "application/json")
        .json(&create_body)
        .send()
        .await
        .map_err(|e| format!("连接失败: {e}"))?;

    if resp.status().as_u16() == 401 || resp.status().as_u16() == 403 {
        return Err("Admin 密码错误".to_string());
    }

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("HTTP {status}: {body}"));
    }

    let data: serde_json::Value = resp.json().await
        .map_err(|e| format!("响应解析失败: {e}"))?;

    let address = data["address"].as_str().unwrap_or("").to_string();
    let address_id = data["address_id"].as_u64();
    let domain = address.split('@').nth(1).unwrap_or("未知").to_string();

    // 清理测试邮箱
    if let Some(id) = address_id {
        let _ = client
            .delete(format!("{base}/admin/delete_address/{id}"))
            .header("x-admin-auth", &admin_key)
            .send()
            .await;
    }

    Ok(format!("接口正常，域名: {domain}"))
}

/// 一键删除邮箱 API 中的所有邮箱和邮件
#[tauri::command]
pub async fn cleanup_temp_mail_api(
    app_handle: tauri::AppHandle,
    api_url: String,
    admin_key: String,
    proxy_url: Option<String>,
) -> Result<String, String> {
    let client = build_client_with_proxy(proxy_url.as_deref())?;
    let base = api_url.trim_end_matches('/');

    emit_log(&app_handle, &format!("[清理] 正在获取所有邮箱列表: {base}"));

    // 获取所有邮箱（尝试 /admin/address_list 接口）
    let resp = client
        .get(format!("{base}/admin/address_list"))
        .header("x-admin-auth", &admin_key)
        .send()
        .await
        .map_err(|e| format!("连接失败: {e}"))?;

    if resp.status().as_u16() == 401 || resp.status().as_u16() == 403 {
        return Err("Admin 密码错误".to_string());
    }

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("获取邮箱列表失败 HTTP {status}: {body}"));
    }

    let data: serde_json::Value = resp.json().await
        .map_err(|e| format!("响应解析失败: {e}"))?;

    // 尝试解析邮箱列表（兼容不同格式）
    let addresses: Vec<u64> = if let Some(arr) = data.as_array() {
        arr.iter().filter_map(|item| item["id"].as_u64().or(item["address_id"].as_u64())).collect()
    } else if let Some(arr) = data["results"].as_array() {
        arr.iter().filter_map(|item| item["id"].as_u64().or(item["address_id"].as_u64())).collect()
    } else {
        Vec::new()
    };

    if addresses.is_empty() {
        emit_log(&app_handle, "[清理] 没有找到需要删除的邮箱");
        return Ok("没有需要清理的邮箱".to_string());
    }

    emit_log(&app_handle, &format!("[清理] 找到 {} 个邮箱，开始删除...", addresses.len()));

    let mut deleted = 0u32;
    let mut failed = 0u32;

    for id in &addresses {
        match client
            .delete(format!("{base}/admin/delete_address/{id}"))
            .header("x-admin-auth", &admin_key)
            .send()
            .await
        {
            Ok(r) if r.status().is_success() => {
                deleted += 1;
            }
            Ok(r) => {
                failed += 1;
                emit_log(&app_handle, &format!("[清理] 删除邮箱 {id} 失败: HTTP {}", r.status()));
            }
            Err(e) => {
                failed += 1;
                emit_log(&app_handle, &format!("[清理] 删除邮箱 {id} 失败: {e}"));
            }
        }
    }

    let msg = format!("清理完成：成功删除 {deleted} 个，失败 {failed} 个");
    emit_log(&app_handle, &format!("[清理] {msg}"));
    Ok(msg)
}
