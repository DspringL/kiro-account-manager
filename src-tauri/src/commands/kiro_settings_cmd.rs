// Kiro IDE 设置命令 (读写 Kiro IDE 的 settings.json)

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct KiroSettings {
    pub http_proxy: Option<String>,
    pub model_selection: Option<String>,
    pub enable_codebase_indexing: Option<bool>,
    pub trust_all_commands: Option<bool>,
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
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
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
    
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("读取设置文件失败: {}", e))?;
    
    let json: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("解析设置文件失败: {}", e))?;
    
    Ok(KiroSettings {
        http_proxy: json.get("http.proxy").and_then(|v| v.as_str()).map(|s| s.to_string()),
        model_selection: json.get("kiroAgent.modelSelection").and_then(|v| v.as_str()).map(|s| s.to_string()),
        enable_codebase_indexing: json.get("kiroAgent.enableCodebaseIndexing").and_then(|v| v.as_bool()),
        trust_all_commands: json.get("kiroAgent.trustedCommands")
            .and_then(|v| v.as_array())
            .map(|arr| arr.iter().any(|item| item.as_str() == Some("*"))),
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
            obj.remove("http.proxy");
        } else {
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

fn set_kiro_trust_all_commands_inner(enabled: bool) -> Result<(), String> {
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
        if enabled {
            obj.insert("kiroAgent.trustedCommands".to_string(), serde_json::json!(["*"]));
        } else {
            obj.insert("kiroAgent.trustedCommands".to_string(), serde_json::json!([]));
        }
    }
    
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;
    
    std::fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn set_kiro_trust_all_commands(enabled: bool) -> Result<(), String> {
    tokio::task::spawn_blocking(move || set_kiro_trust_all_commands_inner(enabled))
        .await
        .map_err(|e| format!("Task failed: {}", e))?
}
