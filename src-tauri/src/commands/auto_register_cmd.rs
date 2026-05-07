use crate::services::{browser_automation::BrowserAutomation, sso_token_converter};
use crate::types::register::RegisterResult;
use crate::commands::update_cmd::get_proxy_from_kiro_settings;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoRegisterParams {
    pub temp_mail_api_url: String,
    pub temp_mail_password: String,
    #[serde(default)]
    pub account_password: Option<String>,
    /// 仿真延迟模式：开启后每个输入/点击环节随机延迟 3~10 秒，并逐字符仿真输入
    #[serde(default)]
    pub slow_mode: bool,
}

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
/// Python 脚本负责完整的9步注册流程
#[tauri::command]
pub async fn auto_register_with_tempmail(
    params: AutoRegisterParams,
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

    let automation = BrowserAutomation::new();

    // 调用 Python 完整注册流程（9步）
    let result = match automation
        .register_full_flow(
            &params.temp_mail_api_url,
            &params.temp_mail_password,
            proxy_url.as_deref(),
            params.account_password.as_deref(),
            params.slow_mode,
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

    let sso_token = result.get("sso_token").and_then(|v| v.as_str()).map(|s| s.to_string());
    let name  = result.get("name").and_then(|v| v.as_str()).map(|s| s.to_string());
    let email = result.get("email").and_then(|v| v.as_str()).map(|s| s.to_string());

    emit_log("========== 注册成功！==========");

    // 用 SSO Token 换取真正的 OIDC refresh_token（ssoDeviceAuth 流程）
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
