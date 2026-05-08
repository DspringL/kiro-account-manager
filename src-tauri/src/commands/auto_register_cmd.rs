use crate::services::{browser_automation::BrowserAutomation, sso_token_converter};
use crate::types::register::RegisterResult;
use crate::commands::update_cmd::get_proxy_from_kiro_settings;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

const DEVICE_CODE_REGION: &str = "us-east-1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoRegisterParams {
    pub temp_mail_api_url: String,
    pub temp_mail_password: String,
    #[serde(default)]
    pub account_password: Option<String>,
    #[serde(default)]
    pub slow_mode: bool,
    #[serde(default = "default_slow_min")]
    pub slow_min: f64,
    #[serde(default = "default_slow_max")]
    pub slow_max: f64,
    #[serde(default = "default_step_timeout")]
    pub step_timeout: u32,
    #[serde(default = "default_register_mode")]
    pub register_mode: String,
    #[serde(default)]
    pub register_authorize_url: Option<String>,
    #[serde(default = "default_browser_type")]
    pub browser_type: String,
}

fn default_slow_min() -> f64 { 1.0 }
fn default_slow_max() -> f64 { 10.0 }
fn default_step_timeout() -> u32 { 60 }
fn default_register_mode() -> String { "register".to_string() }
fn default_browser_type() -> String { "camoufox".to_string() }

/// 检查 Camoufox 是否已安装
#[tauri::command]
pub async fn check_camoufox_installed() -> Result<bool, String> {
    let python_ok = std::process::Command::new("python3")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);

    if !python_ok {
        return Ok(false);
    }

    Ok(std::process::Command::new("python3")
        .arg("-c")
        .arg("import camoufox")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false))
}

/// 安装 Camoufox
#[tauri::command]
pub async fn install_camoufox(app_handle: tauri::AppHandle) -> Result<String, String> {
    let _ = app_handle.emit("camoufox-install-log", "开始安装 Camoufox...");
    let _ = app_handle.emit("camoufox-install-log", "步骤 1/2: 安装 camoufox 和 requests 包...");

    let install = std::process::Command::new("pip3")
        .args(["install", "camoufox", "requests"])
        .output()
        .map_err(|e| format!("执行 pip3 install 失败: {e}"))?;

    if !install.status.success() {
        return Err(format!("安装失败: {}", String::from_utf8_lossy(&install.stderr)));
    }
    let _ = app_handle.emit("camoufox-install-log", "✓ camoufox 包安装成功");

    let _ = app_handle.emit("camoufox-install-log", "步骤 2/2: 下载 Camoufox 浏览器...");
    let fetch = std::process::Command::new("python3")
        .args(["-m", "camoufox", "fetch"])
        .output()
        .map_err(|e| format!("执行 camoufox fetch 失败: {e}"))?;

    if !fetch.status.success() {
        return Err(format!("下载失败: {}", String::from_utf8_lossy(&fetch.stderr)));
    }
    let _ = app_handle.emit("camoufox-install-log", "✓ Camoufox 安装完成！");
    Ok("Camoufox 安装成功".to_string())
}

/// 使用临时邮箱自动注册 AWS Builder ID
/// 流程：先向 AWS OIDC 申请真实设备码，再启动浏览器注册，注册完直接轮询拿 token
#[tauri::command]
pub async fn auto_register_with_tempmail(
    mut params: AutoRegisterParams,
    app_handle: AppHandle,
) -> Result<RegisterResult, String> {
    let emit_log = |msg: &str| {
        let _ = app_handle.emit("auto-register-log", serde_json::json!({
            "email": "",
            "message": msg
        }));
    };

    // 获取代理（优先使用 Kiro IDE 设置）
    let proxy_url = get_proxy_from_kiro_settings();
    if let Some(ref p) = proxy_url {
        emit_log(&format!("使用代理: {}", p));
    }

    if params.register_mode == "authorize" || params.register_mode == "manual_debug" {
        let mode_label = if params.register_mode == "manual_debug" {
            "手动调试模式（请在浏览器中手动完成注册）"
        } else {
            "AWS Builder ID 在线注册"
        };
        emit_log(&format!("使用授权注册模式（{}）...", mode_label));

        let automation = BrowserAutomation::new();
        let (authorize_url, packed, expected_state, server) = automation.generate_authorize_url()
            .await
            .map_err(|e| format!("生成授权URL失败: {}", e))?;

        // 解包 packed: "code_verifier|client_id|client_secret|redirect_uri"
        let parts: Vec<&str> = packed.splitn(4, '|').collect();
        if parts.len() != 4 {
            return Ok(RegisterResult::error("内部错误：授权参数格式异常".to_string()));
        }
        let (code_verifier, client_id, client_secret, redirect_uri) =
            (parts[0].to_string(), parts[1].to_string(), parts[2].to_string(), parts[3].to_string());

        emit_log(&format!("本地回调服务器已启动，等待 AWS 回调..."));
        params.register_authorize_url = Some(authorize_url);

        // 后台线程监听回调（与 idc.rs 的 spawn_callback_listener 逻辑一致）
        let (tx, rx) = tokio::sync::oneshot::channel::<Result<String, String>>();
        let expected_state_clone = expected_state.clone();
        let is_manual = params.register_mode == "manual_debug";
        std::thread::spawn(move || {
            // manual_debug 模式无超时；其他模式 10 分钟超时
            let timeout = if is_manual {
                None
            } else {
                Some(std::time::Duration::from_secs(600))
            };
            let start = std::time::Instant::now();
            loop {
                if let Some(t) = timeout {
                    if start.elapsed() > t {
                        let _ = tx.send(Err("等待回调超时（10分钟）".to_string()));
                        break;
                    }
                }
                if let Ok(Some(request)) = server.try_recv() {
                    let url = request.url().to_string();
                    if url.starts_with("/oauth/callback") {
                        // 解析 code 和 state
                        let query = url.split('?').nth(1).unwrap_or("");
                        let p: std::collections::HashMap<_, _> =
                            url::form_urlencoded::parse(query.as_bytes()).into_owned().collect();

                        let html = if p.get("state").map(|s| s.as_str()) == Some(&expected_state_clone) {
                            "<html><body><h1>授权成功</h1><p>您可以关闭此窗口</p></body></html>"
                        } else {
                            "<html><body><h1>授权失败</h1><p>state 不匹配</p></body></html>"
                        };
                        let resp = tiny_http::Response::from_string(html).with_header(
                            tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..]).unwrap()
                        );
                        let _ = request.respond(resp);

                        if p.get("state").map(|s| s.as_str()) != Some(&expected_state_clone) {
                            let _ = tx.send(Err("state 不匹配".to_string()));
                        } else if let Some(error) = p.get("error") {
                            let _ = tx.send(Err(format!("OAuth 错误: {error}")));
                        } else if let Some(code) = p.get("code") {
                            let _ = tx.send(Ok(code.clone()));
                        } else {
                            let _ = tx.send(Err("回调中未找到 code".to_string()));
                        }
                        break;
                    }
                }
                std::thread::sleep(std::time::Duration::from_millis(100));
            }
        });

        // 调用 Python 完成注册流程
        let result = match automation
            .register_full_flow(
                &params.temp_mail_api_url,
                &params.temp_mail_password,
                proxy_url.as_deref(),
                params.account_password.as_deref(),
                params.slow_mode,
                params.slow_min,
                params.slow_max,
                params.step_timeout,
                &params.register_mode,
                None,
                params.register_authorize_url.as_deref(),
                &params.browser_type,
                Some(&app_handle),
            )
            .await
        {
            Ok(r) => r,
            Err(e) => {
                emit_log(&format!("✗ 注册失败: {}", e));
                return Ok(RegisterResult::error(e));
            }
        };

        let is_success = result.get("success").and_then(|v| v.as_bool()).unwrap_or(false);
        if !is_success {
            let error = result.get("error").and_then(|v| v.as_str()).unwrap_or("未知错误").to_string();
            emit_log(&format!("========== 注册失败: {} ==========", error));
            return Ok(RegisterResult::error(error));
        }

        let name  = result.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
        let email = result.get("email").and_then(|v| v.as_str()).map(|s| s.to_string());
        emit_log("========== 注册成功！等待 OAuth 回调... ==========");

        // 等待本地服务器收到回调
        let code = match rx.await {
            Ok(Ok(c)) => c,
            Ok(Err(e)) => {
                emit_log(&format!("✗ 回调失败: {}", e));
                return Ok(RegisterResult::error(format!("OAuth 回调失败: {}", e)));
            }
            Err(_) => {
                return Ok(RegisterResult::error("OAuth 回调通道异常".to_string()));
            }
        };

        emit_log("✓ 收到 OAuth 回调，正在换取 token...");

        // 用 code 换 token（与 idc.rs 的 create_token 一致）
        let sso_client = crate::aws_sso_client::AWSSSOClient::new("us-east-1");
        match sso_client.create_token(&client_id, &client_secret, &code, &code_verifier, &redirect_uri).await {
            Ok(token) => {
                emit_log("✓ 成功获取 token！");
                return Ok(RegisterResult {
                    success: true,
                    sso_token: None,
                    access_token: Some(token.access_token),
                    refresh_token: Some(token.refresh_token),
                    client_id: Some(client_id),
                    client_secret: Some(client_secret),
                    region: Some("us-east-1".to_string()),
                    name,
                    email,
                    error: None,
                });
            }
            Err(e) => {
                emit_log(&format!("✗ token 换取失败: {}", e));
                return Ok(RegisterResult::error(format!("token 换取失败: {}", e)));
            }
        }
    }

    // ── 注册模式：先向 AWS OIDC 申请真实设备码 ──────────────────────────
    let device_code_info = if params.register_mode == "register" {
        emit_log("正在向 AWS OIDC 申请设备码...");
        match sso_token_converter::request_device_code(DEVICE_CODE_REGION).await {
            Ok(info) => {
                emit_log(&format!("✓ 设备码申请成功，user_code: {}", info.user_code));
                Some(info)
            }
            Err(e) => {
                emit_log(&format!("✗ 申请设备码失败: {}", e));
                return Ok(RegisterResult::error(format!("申请设备码失败: {}", e)));
            }
        }
    } else {
        None
    };

    let automation = BrowserAutomation::new();

    // 调用 Python 完整注册流程，传入真实 user_code
    let result = match automation
        .register_full_flow(
            &params.temp_mail_api_url,
            &params.temp_mail_password,
            proxy_url.as_deref(),
            params.account_password.as_deref(),
            params.slow_mode,
            params.slow_min,
            params.slow_max,
            params.step_timeout,
            &params.register_mode,
            device_code_info.as_ref().map(|d| d.user_code.as_str()),
            None,
            &params.browser_type,
            Some(&app_handle),
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            emit_log(&format!("✗ 注册失败: {}", e));
            return Ok(RegisterResult::error(e));
        }
    };

    // 解析结果
    let is_success = result.get("success").and_then(|v| v.as_bool()).unwrap_or(false);

    if !is_success {
        let error = result.get("error").and_then(|v| v.as_str()).unwrap_or("未知错误").to_string();
        emit_log(&format!("========== 注册失败: {} ==========", error));
        return Ok(RegisterResult::error(error));
    }

    let name  = result.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
    let email = result.get("email").and_then(|v| v.as_str()).map(|s| s.to_string());

    emit_log("========== 注册成功！==========");

    // ── 注册模式：用 deviceCode 直接轮询拿 token（无需 SSO Token 转换）──
    if let Some(ref device) = device_code_info {
        emit_log("正在轮询 AWS OIDC 获取 refresh_token...");
        // 轮询超时设为 step_timeout 的 2 倍，给足时间
        let poll_timeout = (params.step_timeout as u64) * 2;
        match sso_token_converter::poll_token_after_register(device, poll_timeout).await {
            Ok(r) => {
                emit_log("✓ 成功获取 OIDC refresh_token！");
                return Ok(RegisterResult {
                    success: true,
                    sso_token: None,
                    access_token: Some(r.access_token),
                    refresh_token: Some(r.refresh_token),
                    client_id: Some(r.client_id),
                    client_secret: Some(r.client_secret),
                    region: Some(r.region),
                    name,
                    email,
                    error: None,
                });
            }
            Err(e) => {
                // 轮询失败时降级：尝试用 SSO Token 转换（如果有的话）
                emit_log(&format!("⚠ 直接轮询失败: {}，尝试 SSO Token 降级方案...", e));
                let sso_token = result.get("sso_token").and_then(|v| v.as_str()).map(|s| s.to_string());
                if let Some(ref token) = sso_token {
                    match sso_token_converter::convert_sso_token_with_fallback(token).await {
                        Ok(r) => {
                            emit_log("✓ SSO Token 降级方案成功！");
                            return Ok(RegisterResult {
                                success: true,
                                sso_token: sso_token.clone(),
                                access_token: Some(r.access_token),
                                refresh_token: Some(r.refresh_token),
                                client_id: Some(r.client_id),
                                client_secret: Some(r.client_secret),
                                region: Some(r.region),
                                name,
                                email,
                                error: None,
                            });
                        }
                        Err(e2) => {
                            emit_log(&format!("✗ 降级方案也失败: {}", e2));
                            return Ok(RegisterResult {
                                success: true,
                                sso_token,
                                access_token: None,
                                refresh_token: None,
                                client_id: None,
                                client_secret: None,
                                region: None,
                                name,
                                email,
                                error: Some(format!("Token 获取失败: {e} / {e2}")),
                            });
                        }
                    }
                } else {
                    return Ok(RegisterResult {
                        success: true,
                        sso_token: None,
                        access_token: None,
                        refresh_token: None,
                        client_id: None,
                        client_secret: None,
                        region: None,
                        name,
                        email,
                        error: Some(format!("Token 获取失败: {e}")),
                    });
                }
            }
        }
    }

    // authorize 模式：走原有 SSO Token 转换路径
    let sso_token = result.get("sso_token").and_then(|v| v.as_str()).map(|s| s.to_string());
    if let Some(ref token) = sso_token {
        emit_log("正在通过 SSO Token 换取 OIDC refresh_token...");
        match sso_token_converter::convert_sso_token_with_fallback(token).await {
            Ok(r) => {
                emit_log("✓ 成功获取 OIDC refresh_token！");
                return Ok(RegisterResult {
                    success: true,
                    sso_token: sso_token.clone(),
                    access_token: Some(r.access_token),
                    refresh_token: Some(r.refresh_token),
                    client_id: Some(r.client_id),
                    client_secret: Some(r.client_secret),
                    region: Some(r.region),
                    name,
                    email,
                    error: None,
                });
            }
            Err(e) => {
                emit_log(&format!("⚠ SSO Token 转换失败: {}", e));
                return Ok(RegisterResult {
                    success: true,
                    sso_token: sso_token.clone(),
                    access_token: None,
                    refresh_token: None,
                    client_id: None,
                    client_secret: None,
                    region: None,
                    name,
                    email,
                    error: Some(format!("SSO Token 转换失败: {}", e)),
                });
            }
        }
    }

    Ok(RegisterResult {
        success: true,
        sso_token,
        access_token: None,
        refresh_token: None,
        client_id: None,
        client_secret: None,
        region: None,
        name,
        email,
        error: None,
    })
}
