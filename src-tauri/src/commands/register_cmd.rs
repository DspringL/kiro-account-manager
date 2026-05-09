// 账号自动注册命令 - 通过 Node.js sidecar 调用 Playwright 完成注册

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::{Mutex, OnceLock};
use tauri::{Emitter, State};

use crate::state::AppState;
use crate::commands::account_cmd::add_account_by_idc;

// ===== 全局子进程 PID（用于停止） =====

static WORKER_PID: OnceLock<Mutex<Option<u32>>> = OnceLock::new();

fn worker_pid_store() -> &'static Mutex<Option<u32>> {
    WORKER_PID.get_or_init(|| Mutex::new(None))
}

fn set_worker_pid(pid: Option<u32>) {
    if let Ok(mut guard) = worker_pid_store().lock() {
        *guard = pid;
    }
}

fn get_worker_pid() -> Option<u32> {
    worker_pid_store().lock().ok()?.clone()
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

    // ── Step 1: 申请设备码（每次注册前统一申请一个，worker 内多账号共用同一 user_code）──
    // 注意：设备码是一次性的，注册完成后只能轮询一次 token。
    // 如果 count > 1，每个账号需要独立的设备码；此处为简化，count=1 时直接申请，
    // count>1 时 worker 内部各自注册，Rust 侧只为第一个账号申请设备码并轮询。
    // 前端应控制 count=1 以保证每个账号都能拿到 token。
    emit_log(&app_handle, &format!("正在向 AWS OIDC 申请设备码（region: {}）...", region));
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

    // ── Step 2: 把 user_code 注入到 params 中传给 worker ──
    let mut worker_params = params.clone();
    worker_params.user_code = Some(device_info.user_code.clone());
    // verificationUri 带上 user_code，方便 worker 直接打开
    worker_params.verification_uri = Some(format!(
        "https://view.awsapps.com/start/#/device?user_code={}",
        device_info.user_code
    ));

    let input = serde_json::to_string(&worker_params).map_err(|e| format!("参数序列化失败: {e}"))?;
    emit_log(&app_handle, &format!("启动注册 Worker，共 {} 个账号...", params.count));

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

    // ── Step 3: 对每个成功的账号，轮询 token 并导入账号表 ──
    // 注意：设备码只能换一次 token，所以只处理第一个成功的账号
    let mut imported_count = 0u32;
    for record in result.results.iter_mut() {
        if !record.success { continue }

        let email    = record.email.clone().unwrap_or_default();
        let password = record.password.clone().unwrap_or_default();
        let name     = record.name.clone().unwrap_or_default();

        emit_log(&app_handle, &format!("========== 注册账号信息 =========="));
        emit_log(&app_handle, &format!("邮箱:   {}", email));
        emit_log(&app_handle, &format!("密码:   {}", password));
        emit_log(&app_handle, &format!("姓名:   {}", name));
        emit_log(&app_handle, &format!("user_code: {}", device_info.user_code));
        emit_log(&app_handle, &format!("=================================="));

        // 只有第一个成功账号能用这个设备码换 token
        if imported_count > 0 {
            emit_log(&app_handle, &format!("⚠ 账号 {} 注册成功但无法获取 token（设备码已用完），请手动导入", email));
            continue;
        }

        emit_log(&app_handle, &format!("正在轮询 token（账号: {}）...", email));
        let poll_timeout = 120u64; // 2 分钟
        match poll_token_after_register(&device_info, poll_timeout).await {
            Ok((access_token, refresh_token)) => {
                emit_log(&app_handle, "✓ 成功获取 refresh_token！");
                emit_log(&app_handle, &format!("access_token:  {}...", &access_token[..access_token.len().min(20)]));
                emit_log(&app_handle, &format!("refresh_token: {}...", &refresh_token[..refresh_token.len().min(20)]));
                emit_log(&app_handle, &format!("client_id:     {}", device_info.client_id));
                emit_log(&app_handle, &format!("region:        {}", device_info.region));

                // 导入到账号表
                emit_log(&app_handle, "正在导入账号到账号列表...");
                match add_account_by_idc(
                    state.clone(),
                    Some("BuilderId".to_string()),
                    refresh_token.clone(),
                    device_info.client_id.clone(),
                    device_info.client_secret.clone(),
                    Some(device_info.region.clone()),
                    None,                          // machine_id 自动生成
                    Some(access_token.clone()),
                    Some(password.clone()),        // 记录密码
                    None,                          // start_url
                    None,                          // client_id_hash
                ).await {
                    Ok(add_result) => {
                        emit_log(&app_handle, &format!(
                            "✅ 账号已导入！id={} email={} is_new={}",
                            add_result.account.id,
                            add_result.account.email.as_deref().unwrap_or(&email),
                            add_result.is_new
                        ));
                        imported_count += 1;
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
    if let Some(pid) = get_worker_pid() {
        emit_log(&app_handle, &format!("正在停止注册 Worker (PID: {pid})..."));
        let killed = kill_process(pid);
        set_worker_pid(None);
        if killed {
            emit_log(&app_handle, "⚠ 注册已停止");
        }
        killed
    } else {
        false
    }
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
