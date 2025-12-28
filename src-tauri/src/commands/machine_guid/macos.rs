// macOS 平台机器码实现

use chrono::Local;
use std::process::Command;
use uuid::Uuid;

use super::types::{MachineGuidBackup, SystemMachineInfo};
use super::utils::*;

fn read_hardware_uuid() -> Result<String, String> {
    let output = Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .map_err(|e| format!("执行 ioreg 失败: {}", e))?;
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .find(|l| l.contains("IOPlatformUUID"))
        .and_then(|l| l.split('"').nth(3).map(String::from))
        .ok_or_else(|| "无法获取 IOPlatformUUID".to_string())
}

fn write_override(content: &str) -> Result<(), String> {
    write_file_with_dir(&get_macos_override_path(), content)
        .map_err(|e| format!("写入覆盖文件失败: {}", e))
}

pub fn get_system_machine_guid_inner() -> Result<SystemMachineInfo, String> {
    let (backup_exists, backup_time) = read_backup_info();
    let override_path = get_macos_override_path();
    
    let machine_guid = if override_path.exists() {
        std::fs::read_to_string(&override_path).ok().map(|s| s.trim().to_string())
    } else {
        None
    }.map_or_else(|| read_hardware_uuid(), Ok)?;

    Ok(SystemMachineInfo {
        machine_guid: Some(machine_guid),
        backup_exists, backup_time,
        os_type: "macos".to_string(),
        can_modify: true, requires_admin: false,
    })
}

pub fn backup_machine_guid_inner() -> Result<MachineGuidBackup, String> {
    let backup = MachineGuidBackup {
        machine_guid: read_hardware_uuid()?,
        backup_time: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        computer_name: std::env::var("HOSTNAME").ok().or_else(|| std::env::var("USER").ok()),
        os_type: Some("macos".to_string()),
    };
    save_backup(&backup)?;
    Ok(backup)
}

pub fn restore_machine_guid_inner() -> Result<String, String> {
    let backup = load_backup()?;
    write_override(&backup.machine_guid)?;
    Ok(backup.machine_guid)
}

pub fn reset_machine_guid_inner() -> Result<String, String> {
    let new_guid = Uuid::new_v4().to_string().to_lowercase();
    write_override(&new_guid)?;
    Ok(new_guid)
}

pub fn set_custom_machine_guid_inner(new_guid: String) -> Result<String, String> {
    if !is_valid_machine_id(&new_guid) {
        return Err("无效的机器码格式".to_string());
    }
    let formatted = new_guid.to_lowercase();
    write_override(&formatted)?;
    Ok(formatted)
}

pub fn clear_override_inner() -> Result<(), String> {
    let path = get_macos_override_path();
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("删除覆盖文件失败: {}", e))?;
    }
    Ok(())
}
