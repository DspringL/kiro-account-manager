// Claude Code 配置命令
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

/// Claude Code settings.json 结构
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ClaudeCodeSettings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub env: Option<HashMap<String, String>>,
    #[serde(flatten)]
    pub other: HashMap<String, serde_json::Value>,
}

/// 获取 Claude Code 配置文件路径
fn get_claude_settings_path() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("无法获取用户目录")?;
    Ok(home.join(".claude").join("settings.json"))
}

/// 读取 Claude Code 配置
#[tauri::command]
pub fn get_claude_code_settings() -> Result<ClaudeCodeSettings, String> {
    let path = get_claude_settings_path()?;
    if !path.exists() {
        return Ok(ClaudeCodeSettings::default());
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取配置失败: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("解析配置失败: {}", e))
}

/// 配置 Claude Code 使用 KiroGate
#[tauri::command]
pub fn configure_claude_code(api_key: String, base_url: String, model: Option<String>) -> Result<(), String> {
    let path = get_claude_settings_path()?;
    
    // 确保目录存在
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    
    // 读取现有配置或创建新配置
    let mut settings: ClaudeCodeSettings = if path.exists() {
        let content = fs::read_to_string(&path)
            .map_err(|e| format!("读取配置失败: {}", e))?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        ClaudeCodeSettings::default()
    };
    
    // 更新 env 配置
    let mut env = settings.env.unwrap_or_default();
    env.insert("ANTHROPIC_BASE_URL".to_string(), base_url);
    env.insert("ANTHROPIC_API_KEY".to_string(), api_key);
    
    // 设置模型（如果指定）
    if let Some(m) = model {
        if !m.is_empty() {
            env.insert("ANTHROPIC_MODEL".to_string(), m);
        }
    }
    
    settings.env = Some(env);
    
    // 写入配置
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("写入配置失败: {}", e))?;
    
    Ok(())
}

/// 清除 Claude Code 的 KiroGate 配置
#[tauri::command]
pub fn clear_claude_code_config() -> Result<(), String> {
    let path = get_claude_settings_path()?;
    if !path.exists() {
        return Ok(());
    }
    
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取配置失败: {}", e))?;
    let mut settings: ClaudeCodeSettings = serde_json::from_str(&content)
        .unwrap_or_default();
    
    // 移除 KiroGate 相关配置
    if let Some(ref mut env) = settings.env {
        env.remove("ANTHROPIC_BASE_URL");
        env.remove("ANTHROPIC_AUTH_TOKEN");
        env.remove("ANTHROPIC_API_KEY");
        env.remove("ANTHROPIC_MODEL");
        if env.is_empty() {
            settings.env = None;
        }
    }
    
    // 写入配置
    let content = serde_json::to_string_pretty(&settings)
        .map_err(|e| format!("序列化配置失败: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("写入配置失败: {}", e))?;
    
    Ok(())
}
