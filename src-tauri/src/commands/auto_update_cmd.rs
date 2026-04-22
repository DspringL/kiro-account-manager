// Kiro IDE 自动更新管理命令
// 提供禁用/恢复/查询 Kiro IDE 自动更新的功能

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

// ==================== 路径工具 ====================

/// 获取 Kiro updater 目录路径
fn get_updater_path() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("kiro-updater"),
        )
    }
    #[cfg(target_os = "windows")]
    {
        let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
        Some(PathBuf::from(local_app_data).join("kiro-updater"))
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").ok()?;
        Some(PathBuf::from(home).join(".config").join("kiro-updater"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        None
    }
}

/// 获取 app-update.yml 路径
fn get_update_yml_path() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        Some(PathBuf::from(
            "/Applications/Kiro.app/Contents/Resources/app-update.yml",
        ))
    }
    #[cfg(target_os = "windows")]
    {
        let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
        Some(
            PathBuf::from(local_app_data)
                .join("Programs")
                .join("Kiro")
                .join("resources")
                .join("app-update.yml"),
        )
    }
    #[cfg(target_os = "linux")]
    {
        Some(PathBuf::from("/opt/Kiro/resources/app-update.yml"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        None
    }
}

/// 获取 product.json 路径
fn get_product_json_path() -> Option<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        Some(PathBuf::from(
            "/Applications/Kiro.app/Contents/Resources/app/product.json",
        ))
    }
    #[cfg(target_os = "windows")]
    {
        let local_app_data = std::env::var("LOCALAPPDATA").ok()?;
        Some(
            PathBuf::from(local_app_data)
                .join("Programs")
                .join("Kiro")
                .join("resources")
                .join("app")
                .join("product.json"),
        )
    }
    #[cfg(target_os = "linux")]
    {
        Some(PathBuf::from("/opt/Kiro/resources/app/product.json"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        None
    }
}

// ==================== 工具函数 ====================

/// 设置文件只读
fn set_read_only(path: &PathBuf) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(path)
            .map_err(|e| format!("读取文件权限失败: {e}"))?
            .permissions();
        perms.set_mode(0o444);
        fs::set_permissions(path, perms).map_err(|e| format!("设置只读失败: {e}"))
    }
    #[cfg(windows)]
    {
        let mut perms = fs::metadata(path)
            .map_err(|e| format!("读取文件权限失败: {e}"))?
            .permissions();
        perms.set_readonly(true);
        fs::set_permissions(path, perms).map_err(|e| format!("设置只读失败: {e}"))
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = path;
        Ok(())
    }
}

/// 解除文件只读
fn unset_read_only(path: &PathBuf) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(path)
            .map_err(|e| format!("读取文件权限失败: {e}"))?
            .permissions();
        perms.set_mode(0o644);
        fs::set_permissions(path, perms).map_err(|e| format!("解除只读失败: {e}"))
    }
    #[cfg(windows)]
    {
        let mut perms = fs::metadata(path)
            .map_err(|e| format!("读取文件权限失败: {e}"))?
            .permissions();
        perms.set_readonly(false);
        fs::set_permissions(path, perms).map_err(|e| format!("解除只读失败: {e}"))
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = path;
        Ok(())
    }
}

/// 检查文件是否只读（无写权限）
fn is_read_only(path: &PathBuf) -> bool {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::metadata(path)
            .map(|m| m.permissions().mode() & 0o200 == 0)
            .unwrap_or(false)
    }
    #[cfg(windows)]
    {
        fs::metadata(path)
            .map(|m| m.permissions().readonly())
            .unwrap_or(false)
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = path;
        false
    }
}

// ==================== 数据类型 ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoUpdateStatus {
    /// updater 目录是否被阻断（路径不存在或为只读文件）
    pub updater_blocked: bool,
    /// app-update.yml 是否被锁定（只读或含锁定标记）
    pub update_yml_locked: bool,
    /// product.json 中 updateUrl 是否已清空
    pub update_url_cleared: bool,
    /// 综合状态：三项全部满足则为 true
    pub disabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoUpdateResult {
    pub success: bool,
    pub message: String,
    pub details: Vec<String>,
}

// ==================== 查询状态 ====================

#[tauri::command]
pub fn get_auto_update_status() -> AutoUpdateStatus {
    // 1. updater 是否被阻断
    let updater_blocked = match get_updater_path() {
        None => true,
        Some(path) => {
            if path.exists() {
                // 存在且是只读文件则视为阻断
                path.is_file() && is_read_only(&path)
            } else {
                // 路径不存在也算阻断
                true
            }
        }
    };

    // 2. update.yml 是否被锁定
    let update_yml_locked = match get_update_yml_path() {
        None => false,
        Some(path) => {
            if path.exists() {
                let locked_by_perm = is_read_only(&path);
                let locked_by_content = fs::read_to_string(&path)
                    .map(|c| c.contains("version: 0.0.0"))
                    .unwrap_or(false);
                locked_by_perm || locked_by_content
            } else {
                false
            }
        }
    };

    // 3. product.json 中 updateUrl 是否已清空
    let update_url_cleared = match get_product_json_path() {
        None => true,
        Some(path) => {
            if path.exists() {
                fs::read_to_string(&path)
                    .ok()
                    .and_then(|c| serde_json::from_str::<serde_json::Value>(&c).ok())
                    .map(|json| {
                        json.get("updateUrl")
                            .and_then(|v| v.as_str())
                            .map(|s| s.is_empty())
                            .unwrap_or(true)
                    })
                    .unwrap_or(false)
            } else {
                true // 文件不存在视为已处理
            }
        }
    };

    let disabled = updater_blocked && update_yml_locked && update_url_cleared;

    AutoUpdateStatus {
        updater_blocked,
        update_yml_locked,
        update_url_cleared,
        disabled,
    }
}

// ==================== 禁用自动更新 ====================

#[tauri::command]
pub async fn disable_kiro_auto_update() -> Result<AutoUpdateResult, String> {
    let mut details = Vec::new();
    let mut has_error = false;

    // 1. 终止 Kiro 进程
    kill_kiro_processes().await;
    details.push("已终止 Kiro 进程".to_string());

    // 2. 删除 updater 目录，创建同名只读阻断文件
    match get_updater_path() {
        None => {
            details.push("当前平台不支持 updater 路径，跳过".to_string());
        }
        Some(updater_path) => {
            if let Err(e) = block_updater_path(&updater_path, &mut details) {
                details.push(format!("updater 阻断失败: {e}"));
                has_error = true;
            }
        }
    }

    // 3. 锁定 app-update.yml
    match get_update_yml_path() {
        None => {
            details.push("当前平台不支持 update.yml 路径，跳过".to_string());
        }
        Some(yml_path) => {
            if let Err(e) = lock_update_yml(&yml_path, &mut details) {
                details.push(format!("锁定 app-update.yml 失败: {e}"));
                has_error = true;
            }
        }
    }

    // 4. 清空 product.json 中的 updateUrl / downloadUrl
    match get_product_json_path() {
        None => {
            details.push("当前平台不支持 product.json 路径，跳过".to_string());
        }
        Some(product_path) => {
            if let Err(e) = clear_product_json_urls(&product_path, &mut details) {
                details.push(format!("修改 product.json 失败: {e}"));
                has_error = true;
            }
        }
    }

    Ok(AutoUpdateResult {
        success: !has_error,
        message: if has_error {
            "禁用自动更新完成（部分步骤失败，请查看详情）".to_string()
        } else {
            "已成功禁用 Kiro 自动更新".to_string()
        },
        details,
    })
}

/// 创建 updater 阻断文件
fn block_updater_path(updater_path: &PathBuf, details: &mut Vec<String>) -> Result<(), String> {
    if updater_path.exists() {
        if updater_path.is_dir() {
            fs::remove_dir_all(updater_path).map_err(|e| format!("删除 updater 目录失败: {e}"))?;
            details.push("已删除 updater 目录".to_string());
        } else {
            // 已是文件，先解除只读以便重写
            let _ = unset_read_only(updater_path);
        }
    }

    // 确保父目录存在
    if let Some(parent) = updater_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建父目录失败: {e}"))?;
    }

    // 创建空文件并设为只读
    fs::write(updater_path, "").map_err(|e| format!("创建阻断文件失败: {e}"))?;
    set_read_only(updater_path)?;
    details.push("已创建 updater 阻断文件（只读）".to_string());
    Ok(())
}

/// 锁定 app-update.yml
fn lock_update_yml(yml_path: &PathBuf, details: &mut Vec<String>) -> Result<(), String> {
    if yml_path.exists() {
        let _ = unset_read_only(yml_path);
    }

    let parent = yml_path
        .parent()
        .ok_or_else(|| "无法获取 app-update.yml 父目录".to_string())?;

    if !parent.exists() {
        details.push("app-update.yml 所在目录不存在，跳过".to_string());
        return Ok(());
    }

    fs::write(
        yml_path,
        "# Locked to prevent auto-updates\nversion: 0.0.0\n",
    )
    .map_err(|e| format!("写入 app-update.yml 失败: {e}"))?;
    set_read_only(yml_path)?;
    details.push("已锁定 app-update.yml（只读，version: 0.0.0）".to_string());
    Ok(())
}

/// 清空 product.json 中的 updateUrl / downloadUrl
fn clear_product_json_urls(
    product_path: &PathBuf,
    details: &mut Vec<String>,
) -> Result<(), String> {
    if !product_path.exists() {
        details.push("product.json 不存在，跳过".to_string());
        return Ok(());
    }

    let content =
        fs::read_to_string(product_path).map_err(|e| format!("读取 product.json 失败: {e}"))?;

    // 首次备份
    let backup_path = {
        let mut p = product_path.clone();
        let name = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("product.json")
            .to_string();
        p.set_file_name(format!("{name}.bak"));
        p
    };
    if !backup_path.exists() {
        fs::write(&backup_path, &content)
            .map_err(|e| format!("备份 product.json 失败: {e}"))?;
    }

    // 替换 updateUrl 和 downloadUrl（含 download 关键字的）
    let update_url_re = regex::Regex::new(r#""updateUrl"\s*:\s*"[^"]*""#)
        .map_err(|e| format!("正则编译失败: {e}"))?;
    let download_url_re = regex::Regex::new(r#""downloadUrl"\s*:\s*"[^"]*download[^"]*""#)
        .map_err(|e| format!("正则编译失败: {e}"))?;

    let mut modified = false;
    let mut new_content = content.clone();

    if update_url_re.is_match(&new_content) {
        new_content = update_url_re
            .replace_all(&new_content, r#""updateUrl": """#)
            .to_string();
        modified = true;
    }
    if download_url_re.is_match(&new_content) {
        new_content = download_url_re
            .replace_all(&new_content, r#""downloadUrl": """#)
            .to_string();
        modified = true;
    }

    if modified {
        fs::write(product_path, &new_content)
            .map_err(|e| format!("写入 product.json 失败: {e}"))?;
        details.push("已清空 product.json 中的 updateUrl/downloadUrl".to_string());
    } else {
        details.push("product.json 中未找到 updateUrl，无需修改".to_string());
    }

    Ok(())
}

// ==================== 恢复自动更新 ====================

#[tauri::command]
pub async fn enable_kiro_auto_update() -> Result<AutoUpdateResult, String> {
    let mut details = Vec::new();
    let mut has_error = false;

    // 1. 删除 updater 阻断文件
    match get_updater_path() {
        None => {
            details.push("当前平台不支持 updater 路径，跳过".to_string());
        }
        Some(updater_path) => {
            if let Err(e) = remove_updater_block(&updater_path, &mut details) {
                details.push(format!("恢复 updater 失败: {e}"));
                has_error = true;
            }
        }
    }

    // 2. 删除锁定的 app-update.yml
    match get_update_yml_path() {
        None => {
            details.push("当前平台不支持 update.yml 路径，跳过".to_string());
        }
        Some(yml_path) => {
            if let Err(e) = unlock_update_yml(&yml_path, &mut details) {
                details.push(format!("恢复 app-update.yml 失败: {e}"));
                has_error = true;
            }
        }
    }

    // 3. 从备份恢复 product.json
    match get_product_json_path() {
        None => {
            details.push("当前平台不支持 product.json 路径，跳过".to_string());
        }
        Some(product_path) => {
            if let Err(e) = restore_product_json(&product_path, &mut details) {
                details.push(format!("恢复 product.json 失败: {e}"));
                has_error = true;
            }
        }
    }

    Ok(AutoUpdateResult {
        success: !has_error,
        message: if has_error {
            "恢复自动更新完成（部分步骤失败，请查看详情）".to_string()
        } else {
            "已成功恢复 Kiro 自动更新，重启 Kiro 后生效".to_string()
        },
        details,
    })
}

/// 删除 updater 阻断文件
fn remove_updater_block(
    updater_path: &PathBuf,
    details: &mut Vec<String>,
) -> Result<(), String> {
    if !updater_path.exists() {
        details.push("updater 路径不存在，无需处理".to_string());
        return Ok(());
    }

    if updater_path.is_file() {
        let _ = unset_read_only(updater_path);
        fs::remove_file(updater_path).map_err(|e| format!("删除阻断文件失败: {e}"))?;
        details.push("已删除 updater 阻断文件".to_string());
    } else {
        details.push("updater 目录已存在，无需处理".to_string());
    }

    Ok(())
}

/// 解锁 app-update.yml
fn unlock_update_yml(yml_path: &PathBuf, details: &mut Vec<String>) -> Result<(), String> {
    if !yml_path.exists() {
        details.push("app-update.yml 不存在，无需处理".to_string());
        return Ok(());
    }

    let _ = unset_read_only(yml_path);
    let content =
        fs::read_to_string(yml_path).map_err(|e| format!("读取 app-update.yml 失败: {e}"))?;

    if content.contains("version: 0.0.0") {
        fs::remove_file(yml_path).map_err(|e| format!("删除锁定文件失败: {e}"))?;
        details.push("已删除锁定的 app-update.yml（Kiro 启动时将重新生成）".to_string());
    } else {
        details.push("app-update.yml 内容正常，无需处理".to_string());
    }

    Ok(())
}

/// 从备份恢复 product.json
fn restore_product_json(
    product_path: &PathBuf,
    details: &mut Vec<String>,
) -> Result<(), String> {
    let backup_path = {
        let mut p = product_path.clone();
        let name = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("product.json")
            .to_string();
        p.set_file_name(format!("{name}.bak"));
        p
    };

    if backup_path.exists() {
        fs::copy(&backup_path, product_path)
            .map_err(|e| format!("恢复 product.json 失败: {e}"))?;
        fs::remove_file(&backup_path).map_err(|e| format!("删除备份文件失败: {e}"))?;
        details.push("已从备份恢复 product.json".to_string());
    } else if product_path.exists() {
        details.push("product.json 无备份，保持当前状态".to_string());
    } else {
        details.push("product.json 不存在，跳过".to_string());
    }

    Ok(())
}

// ==================== 进程管理 ====================

async fn kill_kiro_processes() {
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/IM", "Kiro.exe", "/T"])
            .output();
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = std::process::Command::new("pkill")
            .args(["-f", "Kiro"])
            .output();
    }
}
