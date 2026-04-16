use crate::services::{browser_automation::BrowserAutomation, tempmail_api::TempMailApi, sso_token_converter};
use crate::types::register::{RegisterResult, TempMailConfig};
use crate::commands::update_cmd::get_proxy_from_kiro_settings;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoRegisterParams {
    pub temp_mail_api_url: String,
    pub temp_mail_password: String,  // Admin 密码必填
    #[serde(default)]
    pub account_password: Option<String>,  // AWS 账号密码可选，默认使用 Alisi1976230!
}

/// 检查 Camoufox 是否已安装
#[tauri::command]
pub async fn check_camoufox_installed() -> Result<bool, String> {
    // 检查 Python 是否可用
    let python_check = std::process::Command::new("python3")
        .arg("--version")
        .output();

    if python_check.is_err() {
        return Ok(false);
    }

    // 检查 camoufox 模块是否已安装
    let camoufox_check = std::process::Command::new("python3")
        .arg("-c")
        .arg("import camoufox")
        .output();

    Ok(camoufox_check.is_ok() && camoufox_check.unwrap().status.success())
}

/// 安装 Camoufox
#[tauri::command]
pub async fn install_camoufox(app_handle: tauri::AppHandle) -> Result<String, String> {
    // 发送日志
    let _ = app_handle.emit("camoufox-install-log", "开始安装 Camoufox...");

    // 安装 camoufox
    let _ = app_handle.emit("camoufox-install-log", "步骤 1/2: 安装 camoufox 包...");
    let install_output = std::process::Command::new("pip3")
        .arg("install")
        .arg("camoufox")
        .arg("requests")
        .output()
        .map_err(|e| format!("执行 pip3 install 失败: {e}"))?;

    if !install_output.status.success() {
        let stderr = String::from_utf8_lossy(&install_output.stderr);
        return Err(format!("安装 camoufox 失败: {stderr}"));
    }

    let _ = app_handle.emit("camoufox-install-log", "✓ camoufox 包安装成功");

    // 下载 Camoufox 浏览器
    let _ = app_handle.emit("camoufox-install-log", "步骤 2/2: 下载 Camoufox 浏览器...");
    let fetch_output = std::process::Command::new("python3")
        .arg("-m")
        .arg("camoufox")
        .arg("fetch")
        .output()
        .map_err(|e| format!("执行 camoufox fetch 失败: {e}"))?;

    if !fetch_output.status.success() {
        let stderr = String::from_utf8_lossy(&fetch_output.stderr);
        return Err(format!("下载 Camoufox 浏览器失败: {stderr}"));
    }

    let _ = app_handle.emit("camoufox-install-log", "✓ Camoufox 浏览器下载成功");
    let _ = app_handle.emit("camoufox-install-log", "✓ Camoufox 安装完成！");

    Ok("Camoufox 安装成功".to_string())
}

/// 使用临时邮箱自动注册 AWS Builder ID
#[tauri::command]
pub async fn auto_register_with_tempmail(
    params: AutoRegisterParams,
    app_handle: AppHandle,
) -> Result<RegisterResult, String> {
    // 1. 创建临时邮箱
    let config = TempMailConfig {
        api_url: params.temp_mail_api_url.clone(),
        admin_password: params.temp_mail_password.clone(),
    };

    let tempmail = TempMailApi::new(config);

    // 发送日志
    let emit_log = |message: String| {
        let _ = app_handle.emit(
            "auto-register-log",
            serde_json::json!({
                "email": "",
                "message": message
            }),
        );
    };

    emit_log("========== 开始使用临时邮箱注册 AWS Builder ID ==========".to_string());
    emit_log("步骤1: 创建临时邮箱地址...".to_string());

    let mail_info = match tempmail.create_address(None).await {
        Ok(info) => {
            emit_log(format!("✓ 临时邮箱创建成功: {}", info.address));
            info
        }
        Err(e) => {
            emit_log(format!("✗ 创建临时邮箱失败: {}", e));
            return Ok(RegisterResult::error(format!("创建临时邮箱失败: {}", e)));
        }
    };

    let email = mail_info.address.clone();
    let address_id = mail_info.address_id;

    // 2. 启动浏览器，进入 AWS 注册页面，等待验证码输入框
    emit_log("\n步骤2: 启动浏览器，进入注册页面...".to_string());

    let automation = BrowserAutomation::new();

    // 先不输入验证码，只是打开页面并输入邮箱
    // 这里需要修改 Python 脚本支持分步操作
    // 暂时使用完整流程，先获取验证码再调用

    // 3. 等待验证码
    emit_log("\n步骤3: 等待验证码邮件...".to_string());

    let verification_code = match tempmail
        .wait_for_verification_code(&mail_info.jwt, 120, 5000, Some(emit_log.clone()))
        .await
    {
        Ok(code) => {
            emit_log(format!("✓ 获取到验证码: {}", code));
            code
        }
        Err(e) => {
            emit_log(format!("✗ 获取验证码失败: {}", e));
            let _ = tempmail.delete_address(address_id).await;
            return Ok(RegisterResult::error(format!("获取验证码失败: {}", e)));
        }
    };

    // 4. 获取代理设置（从 Kiro IDE 设置中读取）
    let proxy_url = match get_proxy_from_kiro_settings() {
        Some(proxy) => {
            emit_log(format!("✓ 使用代理: {}", proxy));
            Some(proxy)
        }
        None => {
            emit_log("未配置代理，将不使用代理".to_string());
            None
        }
    };

    // 5. 调用 Python 脚本完成注册
    emit_log("\n步骤5: 使用验证码完成注册...".to_string());

    let result = match automation
        .register_with_tempmail(
            &email,
            &verification_code,
            proxy_url.as_deref(),
            params.account_password.as_deref(),  // 传递 AWS 账号密码（可选）
            Some(&app_handle),
        )
        .await
    {
        Ok(result) => result,
        Err(e) => {
            emit_log(format!("✗ 注册失败: {}", e));
            let _ = tempmail.delete_address(address_id).await;
            return Ok(RegisterResult::error(format!("注册失败: {}", e)));
        }
    };

    // 5. 清理临时邮箱
    emit_log("\n步骤6: 清理临时邮箱...".to_string());
    match tempmail.delete_address(address_id).await {
        Ok(_) => emit_log("✓ 临时邮箱已清理".to_string()),
        Err(e) => emit_log(format!("⚠ 清理临时邮箱失败: {}", e)),
    }

    // 6. 解析结果
    if let Some(success) = result.get("success").and_then(|v| v.as_bool()) {
        if success {
            let sso_token = result
                .get("sso_token")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let name = result
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let email = result
                .get("email")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            emit_log("\n========== 注册成功! ==========".to_string());

            // 7. 尝试将 SSO Token 转换为 refresh_token
            let mut refresh_token = None;
            if let Some(ref token) = sso_token {
                emit_log("\n步骤7: 转换 SSO Token 为 refresh_token...".to_string());
                match sso_token_converter::convert_sso_token_with_fallback(token).await {
                    Ok(convert_result) => {
                        emit_log(format!("✓ 成功获取 refresh_token!"));
                        refresh_token = Some(convert_result.refresh_token);
                    }
                    Err(e) => {
                        emit_log(format!("⚠ 转换失败: {}", e));
                        emit_log("将使用 SSO Token 作为 refresh_token 尝试导入".to_string());
                        // 如果转换失败,使用 SSO Token 作为 fallback
                        refresh_token = sso_token.clone();
                    }
                }
            }

            return Ok(RegisterResult {
                success: true,
                sso_token,
                refresh_token,
                name,
                email,
                error: None,
            });
        }
    }

    let error = result
        .get("error")
        .and_then(|v| v.as_str())
        .unwrap_or("未知错误")
        .to_string();

    emit_log(format!("\n========== 注册失败: {} ==========", error));

    Ok(RegisterResult::error(error))
}
