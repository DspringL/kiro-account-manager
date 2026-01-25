#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod auth;
mod auth_social;
mod auto_switch;
mod aws_sso_client;
mod browser;
mod commands;
mod deep_link_handler;
mod http_client;

mod kiro;
mod kiro_auth_client;
mod kiro_portal_client;
mod mcp;

mod process;
mod providers;
mod state;
mod steering;
mod account;

use account::{AccountStore, GroupTagStore};
use auth::AuthState;
use state::AppState;
use std::sync::Mutex;
use tauri::{Listener, Manager};

// 导入命令
use browser::detect_installed_browsers;
use commands::account_cmd::{
    get_accounts, delete_account, delete_accounts, delete_account_remote, update_account, sync_account,
    refresh_account_token, verify_account, add_account_by_social, add_local_kiro_account,
    add_account_by_builderid, add_account_by_enterprise, import_accounts, export_accounts,
    get_available_accounts, get_accounts_by_group, get_accounts_by_tag, get_account_usage
};
use commands::group_tag_cmd::{
    get_groups, add_group, update_group, delete_group, reorder_groups,
    get_tags, add_tag, update_tag, delete_tag,
    set_account_group, add_tag_to_account, remove_tag_from_account, set_account_tags, remove_account_tags
};
use commands::app_settings_cmd::*;
use commands::auth_cmd::*;
use commands::kiro_settings_cmd::*;
use commands::machine_guid::*;
use commands::mcp_cmd::*;

use commands::proxy_cmd::*;
use commands::update_cmd::*;
use commands::steering_cmd::*;
use kiro::{
    get_kiro_local_token, switch_kiro_account, read_kiro_accounts,
};
use process::{close_kiro_ide, is_kiro_ide_running, start_kiro_ide};

fn main() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Debug)
                // 只显示我们自己的日志，过滤掉第三方库的日志
                .filter(|metadata| {
                    let target = metadata.target();
                    target.starts_with("kiro_account_manager")
                })
                .build()
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_http::init())
        // 单实例插件：确保只有一个实例运行，deep-link 回调传递给已运行的实例
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // 当第二个实例尝试启动时，处理传入的参数（deep-link 回调）
            for arg in argv.iter() {
                if arg.starts_with("kiro://") {
                    deep_link_handler::handle_deep_link(arg);
                }
            }
            
            // 聚焦主窗口
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            // 首次启动时检查命令行参数中的 deep link（Windows/Linux）
            for arg in std::env::args() {
                if arg.starts_with("kiro://") {
                    deep_link_handler::handle_deep_link(&arg);
                }
            }
            
            // 监听 deep link 事件 (使用 kiro:// 协议)
            #[cfg(any(target_os = "linux", all(debug_assertions, windows)))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                let _ = app.deep_link().register("kiro");
            }
            
            // 监听 deep link URL
            let app_handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event| {
                let payload = event.payload();
                
                // payload 可能是 JSON 格式 ["kiro://..."] 或纯 URL
                let url = if payload.starts_with('[') {
                    // JSON 数组格式，解析第一个元素
                    serde_json::from_str::<Vec<String>>(payload)
                        .ok()
                        .and_then(|v| v.into_iter().next())
                        .unwrap_or_else(|| payload.to_string())
                } else if payload.starts_with('"') {
                    // JSON 字符串格式
                    serde_json::from_str::<String>(payload)
                        .unwrap_or_else(|_| payload.to_string())
                } else {
                    payload.to_string()
                };
                
                // 只处理 kiro:// 协议的 URL
                if !url.starts_with("kiro://") {
                    return;
                }
                
                // 处理 OAuth 回调
                deep_link_handler::handle_deep_link(&url);
                // 聚焦窗口
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.set_focus();
                }
            });
            
            Ok(())
        })
        .manage(AppState {
            store: Mutex::new(AccountStore::new()),
            group_tag_store: Mutex::new(GroupTagStore::new()),
            auth: AuthState::new(),
            pending_login: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            // 账号命令
            get_accounts,
            delete_account,
            delete_accounts,
            delete_account_remote,
            update_account,
            sync_account,
            refresh_account_token,
            verify_account,
            add_account_by_social,
            add_local_kiro_account,
            add_account_by_builderid,
            add_account_by_enterprise,
            import_accounts,
            export_accounts,
            get_available_accounts,
            get_accounts_by_group,
            get_accounts_by_tag,
            get_account_usage,
            // 分组与标签命令
            get_groups,
            add_group,
            update_group,
            delete_group,
            reorder_groups,
            get_tags,
            add_tag,
            update_tag,
            delete_tag,
            set_account_group,
            add_tag_to_account,
            remove_tag_from_account,
            set_account_tags,
            remove_account_tags,
            // Auth 命令
            get_current_user,
            logout,
            kiro_login,
            get_supported_providers,
            handle_kiro_social_callback,
            // Kiro IDE 命令
            get_kiro_local_token,
            switch_kiro_account,
            read_kiro_accounts,
            read_kiro_accounts,
            // 进程管理命令
            close_kiro_ide,
            start_kiro_ide,
            is_kiro_ide_running,
            // Kiro IDE 设置命令
            get_kiro_settings,
            set_kiro_proxy,
            set_kiro_model,
            set_kiro_codebase_indexing,
            set_kiro_trusted_commands,
            set_kiro_agent_autonomy,
            set_kiro_tab_autocomplete,
            set_kiro_usage_summary,
            set_kiro_code_references,
            set_kiro_debug_logs,
            set_kiro_notification,
            // 应用设置命令
            get_app_settings,
            save_app_settings,
            // 使用量历史记录命令
            get_usage_history,
            save_usage_history_entry,
            // 账号绑定机器码命令
            bind_machine_id_to_account,
            unbind_machine_id_from_account,
            get_bound_machine_id,
            get_all_bound_machine_ids,
            // 系统机器码命令
            get_system_machine_guid,
            backup_machine_guid,
            restore_machine_guid,
            reset_system_machine_guid,
            get_machine_guid_backup,
            set_custom_machine_guid,
            clear_macos_override,
            generate_machine_guid,
            restart_as_admin,
            // 浏览器检测
            detect_installed_browsers,
            // MCP 管理命令
            get_mcp_config,
            save_mcp_server,
            delete_mcp_server,
            toggle_mcp_server,
            get_mcp_tool_stats,

            // 代理检测命令
            detect_system_proxy,
            // 更新检查命令
            check_update,
            // Steering 管理命令
            get_steering_files,
            get_steering_file,
            save_steering_file,
            delete_steering_file,
            create_steering_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
