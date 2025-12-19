// 命令模块

/// 生成随机邮箱（用于被封禁账号无法获取真实邮箱时）
pub fn generate_random_email(provider: &str) -> String {
    use rand::Rng;
    let random_id: u32 = rand::thread_rng().gen_range(100000..999999);
    format!("banned_{}@{}.unknown", random_id, provider.to_lowercase())
}

pub mod account_cmd;
pub mod app_settings_cmd;
pub mod auth_cmd;
pub mod fingerprint_cmd;
pub mod kiro_settings_cmd;
pub mod machine_guid_cmd;
pub mod mcp_cmd;

pub mod proxy_cmd;
pub mod sso_import_cmd;
pub mod steering_cmd;
pub mod update_cmd;
pub mod web_oauth_cmd;
