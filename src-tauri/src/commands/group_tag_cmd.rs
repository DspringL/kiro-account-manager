// 分组与标签管理命令

use tauri::State;
use crate::state::AppState;
use crate::account::{AccountGroup, AccountTag, AccountTagLink};

// ============================================================
// 分组命令
// ============================================================

#[tauri::command]
pub fn get_groups(state: State<AppState>) -> Vec<AccountGroup> {
    state.group_tag_store.lock().unwrap().get_groups()
}

#[tauri::command]
pub fn add_group(state: State<AppState>, name: String, color: Option<String>) -> Result<AccountGroup, String> {
    state.group_tag_store.lock().unwrap().add_group(name, color)
}

#[tauri::command]
pub fn update_group(state: State<AppState>, id: String, name: Option<String>, color: Option<String>) -> Result<AccountGroup, String> {
    state.group_tag_store.lock().unwrap().update_group(&id, name, color)
}

#[tauri::command]
pub fn delete_group(state: State<AppState>, id: String) -> bool {
    // 删除分组时，清除所有账号的 group_id
    let mut store = state.store.lock().unwrap();
    for account in store.accounts.iter_mut() {
        if account.group_id.as_deref() == Some(&id) {
            account.group_id = None;
        }
    }
    store.save_to_file();
    drop(store);
    state.group_tag_store.lock().unwrap().delete_group(&id)
}

#[tauri::command]
pub fn reorder_groups(state: State<AppState>, ids: Vec<String>) -> bool {
    state.group_tag_store.lock().unwrap().reorder_groups(ids)
}

// ============================================================
// 标签命令
// ============================================================

#[tauri::command]
pub fn get_tags(state: State<AppState>) -> Vec<AccountTag> {
    state.group_tag_store.lock().unwrap().get_tags()
}

#[tauri::command]
pub fn add_tag(state: State<AppState>, name: String, color: String) -> Result<AccountTag, String> {
    state.group_tag_store.lock().unwrap().add_tag(name, color)
}

#[tauri::command]
pub fn update_tag(state: State<AppState>, id: String, name: Option<String>, color: Option<String>) -> Result<AccountTag, String> {
    state.group_tag_store.lock().unwrap().update_tag(&id, name, color)
}

#[tauri::command]
pub fn delete_tag(state: State<AppState>, id: String) -> bool {
    // 删除标签时，从所有账号中移除该标签
    let mut store = state.store.lock().unwrap();
    for account in store.accounts.iter_mut() {
        account.tags.retain(|t| t != &id);
    }
    store.save_to_file();
    drop(store);
    state.group_tag_store.lock().unwrap().delete_tag(&id)
}

// ============================================================
// 账号分组/标签关联命令
// ============================================================

#[tauri::command]
pub fn set_account_group(state: State<AppState>, account_id: String, group_id: Option<String>) -> Result<(), String> {
    let mut store = state.store.lock().unwrap();
    if let Some(account) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        account.group_id = group_id;
        store.save_to_file();
        Ok(())
    } else {
        Err("账号不存在".to_string())
    }
}

#[tauri::command]
pub fn add_tag_to_account(state: State<AppState>, account_id: String, tag_id: String) -> Result<(), String> {
    let mut store = state.store.lock().unwrap();
    if let Some(account) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        // 检查是否已存在（兼容旧数据）
        if !account.tags.contains(&tag_id) && !account.tag_links.iter().any(|l| l.tag_id == tag_id) {
            account.tag_links.push(AccountTagLink::new(tag_id.clone()));
            // 同时更新 tags 保持兼容
            account.tags.push(tag_id);
            store.save_to_file();
        }
        Ok(())
    } else {
        Err("账号不存在".to_string())
    }
}

#[tauri::command]
pub fn remove_tag_from_account(state: State<AppState>, account_id: String, tag_id: String) -> Result<(), String> {
    let mut store = state.store.lock().unwrap();
    if let Some(account) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        account.tags.retain(|t| t != &tag_id);
        account.tag_links.retain(|l| l.tag_id != tag_id);
        store.save_to_file();
        Ok(())
    } else {
        Err("账号不存在".to_string())
    }
}

#[tauri::command]
pub fn set_account_tags(state: State<AppState>, account_id: String, tag_ids: Vec<String>) -> Result<(), String> {
    let mut store = state.store.lock().unwrap();
    if let Some(account) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        // 保留已有的 tag_links（保持时间戳），只添加新的
        let existing_ids: Vec<String> = account.tag_links.iter().map(|l| l.tag_id.clone()).collect();
        // 移除不在新列表中的
        account.tag_links.retain(|l| tag_ids.contains(&l.tag_id));
        // 添加新的
        for tag_id in &tag_ids {
            if !existing_ids.contains(tag_id) {
                account.tag_links.push(AccountTagLink::new(tag_id.clone()));
            }
        }
        account.tags = tag_ids;
        store.save_to_file();
        Ok(())
    } else {
        Err("账号不存在".to_string())
    }
}

#[tauri::command]
pub fn remove_account_tags(state: State<AppState>, account_id: String, tag_ids: Vec<String>) -> Result<(), String> {
    let mut store = state.store.lock().unwrap();
    if let Some(account) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        account.tags.retain(|t| !tag_ids.contains(t));
        account.tag_links.retain(|l| !tag_ids.contains(&l.tag_id));
        store.save_to_file();
        Ok(())
    } else {
        Err("账号不存在".to_string())
    }
}
