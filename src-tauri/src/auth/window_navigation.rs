use tauri::Manager;

/// 导航主窗口到指定路由
pub fn navigate_main_window_to_route(app_handle: &tauri::AppHandle, route: &str) {
    let Some(window) = app_handle.get_webview_window("main") else {
        log::warn!("收到 deep link，但未找到主窗口");
        return;
    };

    let (path, query) = route
        .split_once('?')
        .map_or((route, None), |(path, query)| (path, Some(query)));

    let navigation = || -> Result<(), String> {
        let mut url = window
            .url()
            .map_err(|e| format!("获取主窗口 URL 失败: {e}"))?;
        url.set_path(path);
        url.set_query(query);
        window
            .navigate(url)
            .map_err(|e| format!("跳转主窗口到 {route} 失败: {e}"))?;
        Ok(())
    };

    if let Err(err) = navigation() {
        log::error!("{err}");
    }
}

/// 处理传入的 deep link
pub fn handle_incoming_deep_link(app_handle: &tauri::AppHandle, url: &str) {
    if let Some(route) = crate::core::deep_link_handler::get_app_callback_route(url) {
        navigate_main_window_to_route(app_handle, &route);
    } else {
        // Social OAuth 回调由后端 login_social 的 wait_for_callback 处理
        // 不需要前端导航到 /callback 页面
        let (_handled, _should_navigate) = crate::core::deep_link_handler::handle_deep_link(url);
    }

    // 显示主窗口
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
