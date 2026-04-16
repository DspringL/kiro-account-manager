use crate::services::{browser_automation::BrowserAutomation, tempmail_api::TempMailApi};
use crate::types::register::{RegisterResult, TempMailConfig};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AutoRegisterParams {
    pub temp_mail_api_url: String,
    pub temp_mail_password: String,
    pub proxy_url: Option<String>,
}

/// 检查 Camoufox 是否已安装
#[tauri::command]
pub async fn check_camoufox_installed() -> Result<bool, String> {
    let automation = BrowserAutomation::new();
    automation.check_camoufox_installed().await
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
        .wait_for_verification_code(&mail_info.jwt, 120, 5000, Some(&emit_log))
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

    // 4. 调用 Python 脚本完成注册
    emit_log("\n步骤4: 使用验证码完成注册...".to_string());

    let result = match automation
        .register_with_tempmail(
            &email,
            &verification_code,
            params.proxy_url.as_deref(),
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
    emit_log("\n步骤5: 清理临时邮箱...".to_string());
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

            return Ok(RegisterResult {
                success: true,
                sso_token,
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
