// Kiro IDE 设置命令 (读写 Kiro IDE 的 settings.json)

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KiroSettings {
    pub http_proxy: Option<String>,
    pub model_selection: Option<String>,
    pub enable_codebase_indexing: bool,
    pub trusted_commands_mode: Option<String>,
    pub custom_trusted_commands: Option<String>,
    // Agent 设置
    pub agent_autonomy: Option<String>,
    pub enable_tab_autocomplete: bool,
    pub usage_summary: bool,
    pub code_references: bool,
    pub enable_debug_logs: bool,
    // 通知设置
    pub notify_action_required: bool,
    pub notify_failure: bool,
    pub notify_success: bool,
    pub notify_billing: bool,
}

impl Default for KiroSettings {
    fn default() -> Self {
        Self {
            http_proxy: None,
            model_selection: Some("claude-sonnet-4.5".to_string()),
            enable_codebase_indexing: true,
            trusted_commands_mode: Some("none".to_string()),
            custom_trusted_commands: None,
            agent_autonomy: Some("Supervised".to_string()),
            enable_tab_autocomplete: true,
            usage_summary: true,
            code_references: true,
            enable_debug_logs: false,
            notify_action_required: true,
            notify_failure: true,
            notify_success: true,
            notify_billing: true,
        }
    }
}

fn get_kiro_settings_path() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA").ok().map(|appdata| {
            PathBuf::from(appdata).join("Kiro").join("User").join("settings.json")
        })
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var("HOME").ok().map(|home| {
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("Kiro")
                .join("User")
                .join("settings.json")
        })
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var("HOME").ok().map(|home| {
            PathBuf::from(home)
                .join(".config")
                .join("Kiro")
                .join("User")
                .join("settings.json")
        })
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

fn get_kiro_settings_inner() -> Result<KiroSettings, String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    if !path.exists() {
        return Ok(KiroSettings::default());
    }
    
    // 读取 app-settings.json（首次启动会使用默认值）
    let app_settings = super::app_settings_cmd::get_app_settings_inner().unwrap_or_default();
    
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取设置文件失败: {}", e))?;
    
    let mut json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析设置文件失败: {}", e))?;
    
    let mut ide_modified = false;
    
    // 核心逻辑：以 app-settings.json 为准，强制同步到 Kiro IDE
    // 首次启动时，app_settings 使用默认值，会将默认值写入 IDE
    
    // enableCodebaseIndexing
    let codebase_indexing = app_settings.enable_codebase_indexing.unwrap_or(true);
    if json.get("kiroAgent.enableCodebaseIndexing").and_then(|v| v.as_bool()) != Some(codebase_indexing) {
        if let Some(obj) = json.as_object_mut() {
            obj.insert("kiroAgent.enableCodebaseIndexing".to_string(), serde_json::Value::Bool(codebase_indexing));
            ide_modified = true;
        }
    }
    
    // enableTabAutocomplete
    let tab_autocomplete = app_settings.enable_tab_autocomplete.unwrap_or(true);
    if json.get("kiroAgent.enableTabAutocomplete").and_then(|v| v.as_bool()) != Some(tab_autocomplete) {
        if let Some(obj) = json.as_object_mut() {
            obj.insert("kiroAgent.enableTabAutocomplete".to_string(), serde_json::Value::Bool(tab_autocomplete));
            ide_modified = true;
        }
    }
    
    // usageSummary
    let usage_summary = app_settings.usage_summary.unwrap_or(true);
    if json.get("kiroAgent.usageSummary").and_then(|v| v.as_bool()) != Some(usage_summary) {
        if let Some(obj) = json.as_object_mut() {
            obj.insert("kiroAgent.usageSummary".to_string(), serde_json::Value::Bool(usage_summary));
            ide_modified = true;
        }
    }
    
    // codeReferences
    let code_references = app_settings.code_references.unwrap_or(true);
    if json.get("kiroAgent.codeReferences").and_then(|v| v.as_bool()) != Some(code_references) {
        if let Some(obj) = json.as_object_mut() {
            obj.insert("kiroAgent.codeReferences".to_string(), serde_json::Value::Bool(code_references));
            ide_modified = true;
        }
    }
    
    // enableDebugLogs
    let debug_logs = app_settings.enable_debug_logs.unwrap_or(false);
    if json.get("kiroAgent.enableDebugLogs").and_then(|v| v.as_bool()) != Some(debug_logs) {
        if let Some(obj) = json.as_object_mut() {
            obj.insert("kiroAgent.enableDebugLogs".to_string(), serde_json::Value::Bool(debug_logs));
            ide_modified = true;
        }
    }
    
    // notifyActionRequired
    let notify_action = app_settings.notify_action_required.unwrap_or(true);
    if json.get("kiroAgent.notifications.agent.actionRequired").and_then(|v| v.as_bool()) != Some(notify_action) {
        if let Some(obj) = json.as_object_mut() {
            obj.insert("kiroAgent.notifications.agent.actionRequired".to_string(), serde_json::Value::Bool(notify_action));
            ide_modified = true;
        }
    }
    
    // notifyFailure
    let notify_failure = app_settings.notify_failure.unwrap_or(true);
    if json.get("kiroAgent.notifications.agent.failure").and_then(|v| v.as_bool()) != Some(notify_failure) {
        if let Some(obj) = json.as_object_mut() {
            obj.insert("kiroAgent.notifications.agent.failure".to_string(), serde_json::Value::Bool(notify_failure));
            ide_modified = true;
        }
    }
    
    // notifySuccess
    let notify_success = app_settings.notify_success.unwrap_or(true);
    if json.get("kiroAgent.notifications.agent.success").and_then(|v| v.as_bool()) != Some(notify_success) {
        if let Some(obj) = json.as_object_mut() {
            obj.insert("kiroAgent.notifications.agent.success".to_string(), serde_json::Value::Bool(notify_success));
            ide_modified = true;
        }
    }
    
    // notifyBilling
    let notify_billing = app_settings.notify_billing.unwrap_or(true);
    if json.get("kiroAgent.notifications.billing").and_then(|v| v.as_bool()) != Some(notify_billing) {
        if let Some(obj) = json.as_object_mut() {
            obj.insert("kiroAgent.notifications.billing".to_string(), serde_json::Value::Bool(notify_billing));
            ide_modified = true;
        }
    }
    
    // 如果有修改，写入 Kiro IDE settings.json
    if ide_modified {
        let content = serde_json::to_string_pretty(&json)
            .map_err(|e| format!("序列化设置失败: {}", e))?;
        std::fs::write(&path, content)
            .map_err(|e| format!("写入设置文件失败: {}", e))?;
    }
    
    Ok(KiroSettings {
        http_proxy: json.get("http.proxy").and_then(|v| v.as_str()).map(|s| s.to_string()),
        model_selection: json.get("kiroAgent.modelSelection").and_then(|v| v.as_str()).map(|s| s.to_string()),
        enable_codebase_indexing: codebase_indexing,
        trusted_commands_mode: json.get("kiroAgent.trustedCommands")
            .and_then(|v| v.as_array())
            .map(|arr| {
                if arr.iter().any(|item| item.as_str() == Some("*")) {
                    "all".to_string()
                } else if arr.is_empty() {
                    "none".to_string()
                } else {
                    "common".to_string()
                }
            }),
        custom_trusted_commands: json.get("kiroAgent.trustedCommands")
            .and_then(|v| v.as_array())
            .filter(|arr| !arr.iter().any(|item| item.as_str() == Some("*")) && !arr.is_empty())
            .map(|arr| arr.iter()
                .filter_map(|item| item.as_str())
                .collect::<Vec<_>>()
                .join("\n")),
        agent_autonomy: json.get("kiroAgent.agentAutonomy").and_then(|v| v.as_str()).map(|s| s.to_string()),
        enable_tab_autocomplete: tab_autocomplete,
        usage_summary,
        code_references,
        enable_debug_logs: debug_logs,
        notify_action_required: notify_action,
        notify_failure,
        notify_success,
        notify_billing,
    })
}

fn set_kiro_proxy_inner(proxy: String) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    let mut settings: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    if let Some(obj) = settings.as_object_mut() {
        if proxy.is_empty() {
            // 清除代理时，必须把 proxySupport 设为 off，否则 Kiro 会尝试连接系统代理
            obj.remove("http.proxy");
            obj.insert("http.proxySupport".to_string(), serde_json::Value::String("off".to_string()));
        } else {
            // 设置代理时，proxySupport 必须为 on，同时提供代理地址
            obj.insert("http.proxy".to_string(), serde_json::Value::String(proxy));
            obj.insert("http.proxyStrictSSL".to_string(), serde_json::Value::Bool(false));
            obj.insert("http.proxySupport".to_string(), serde_json::Value::String("on".to_string()));
        }
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

fn set_kiro_model_inner(model: String) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    let mut settings: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("kiroAgent.modelSelection".to_string(), serde_json::Value::String(model));
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn get_kiro_settings() -> Result<KiroSettings, String> {
    tokio::task::spawn_blocking(get_kiro_settings_inner)
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn set_kiro_proxy(proxy: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_proxy_inner(proxy))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn set_kiro_model(model: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_model_inner(model))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

fn set_kiro_codebase_indexing_inner(enabled: bool) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    let mut settings: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("kiroAgent.enableCodebaseIndexing".to_string(), serde_json::Value::Bool(enabled));
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn set_kiro_codebase_indexing(enabled: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_codebase_indexing_inner(enabled))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

fn set_kiro_trusted_commands_inner(mode: String, custom_commands: Option<String>) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    let mut settings: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    if let Some(obj) = settings.as_object_mut() {
        let commands = match mode.as_str() {
            "all" => serde_json::json!(["*"]),
            "common" => {
                // 如果有自定义命令，解析它；否则使用默认列表
                if let Some(ref custom) = custom_commands {
                    if !custom.trim().is_empty() {
                        let cmds: Vec<&str> = custom.lines()
                            .map(|s| s.trim())
                            .filter(|s| !s.is_empty())
                            .collect();
                        serde_json::json!(cmds)
                    } else {
                        // 默认常用命令
                        serde_json::json!([
                            "npm *", "pnpm *", "yarn *", "bun *",
                            "git *", "cargo *", "rustup *",
                            "python *", "pip *", "uv *", "uvx *",
                            "node *", "npx *", "deno *",
                            "cat *", "ls *", "dir *", "cd *", "pwd",
                            "mkdir *", "touch *", "echo *"
                        ])
                    }
                } else {
                    serde_json::json!([
                        "npm *", "pnpm *", "yarn *", "bun *",
                        "git *", "cargo *", "rustup *",
                        "python *", "pip *", "uv *", "uvx *",
                        "node *", "npx *", "deno *",
                        "cat *", "ls *", "dir *", "cd *", "pwd",
                        "mkdir *", "touch *", "echo *"
                    ])
                }
            },
            _ => serde_json::json!([]),
        };
        obj.insert("kiroAgent.trustedCommands".to_string(), commands);
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn set_kiro_trusted_commands(mode: String, custom_commands: Option<String>) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_trusted_commands_inner(mode, custom_commands))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}


// 设置 Agent 自主模式
fn set_kiro_agent_autonomy_inner(autonomy: String) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    let mut settings: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("kiroAgent.agentAutonomy".to_string(), serde_json::Value::String(autonomy));
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn set_kiro_agent_autonomy(autonomy: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_agent_autonomy_inner(autonomy))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

// 设置 Tab 自动补全
fn set_kiro_tab_autocomplete_inner(enabled: bool) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    let mut settings: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("kiroAgent.enableTabAutocomplete".to_string(), serde_json::Value::Bool(enabled));
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn set_kiro_tab_autocomplete(enabled: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_tab_autocomplete_inner(enabled))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

// 设置使用统计
fn set_kiro_usage_summary_inner(enabled: bool) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    let mut settings: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("kiroAgent.usageSummary".to_string(), serde_json::Value::Bool(enabled));
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn set_kiro_usage_summary(enabled: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_usage_summary_inner(enabled))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

// 设置代码引用
fn set_kiro_code_references_inner(enabled: bool) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    let mut settings: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("kiroAgent.codeReferences".to_string(), serde_json::Value::Bool(enabled));
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn set_kiro_code_references(enabled: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_code_references_inner(enabled))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

// 设置调试日志
fn set_kiro_debug_logs_inner(enabled: bool) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    let mut settings: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    if let Some(obj) = settings.as_object_mut() {
        obj.insert("kiroAgent.enableDebugLogs".to_string(), serde_json::Value::Bool(enabled));
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn set_kiro_debug_logs(enabled: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_debug_logs_inner(enabled))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}

// 设置通知选项
fn set_kiro_notification_inner(key: String, enabled: bool) -> Result<(), String> {
    let path = get_kiro_settings_path()
        .ok_or("无法获取 Kiro 设置路径")?;
    
    let mut settings: serde_json::Value = if path.exists() {
        let content = std::fs::read_to_string(&path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    
    if let Some(obj) = settings.as_object_mut() {
        obj.insert(key, serde_json::Value::Bool(enabled));
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn set_kiro_notification(key: String, enabled: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_notification_inner(key, enabled))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}
