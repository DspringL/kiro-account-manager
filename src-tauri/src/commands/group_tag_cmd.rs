// 分组与标签管理命令

use tauri::State;
use crate::state::AppState;
use crate::account::{AccountGroup, AccountTag, AccountTagLink};

// ============================================================
// 分组命令
// ============================================================

#[tauri::command]
pub fn get_groups(state: State<AppState>) -> Vec<AccountGroup> {
    state.group_tag_store.lock().expect("Failed to acquire group_tag_store lock").get_groups()
}

#[tauri::command]
pub fn add_group(state: State<AppState>, name: String, color: Option<String>) -> Result<AccountGroup, String> {
    state.group_tag_store.lock().expect("Failed to acquire group_tag_store lock").add_group(name, color)
}

#[tauri::command]
pub fn update_group(state: State<AppState>, id: String, name: Option<String>, color: Option<String>) -> Result<AccountGroup, String> {
    state.group_tag_store.lock().expect("Failed to acquire group_tag_store lock").update_group(&id, name, color)
}

#[tauri::command]
pub fn delete_group(state: State<AppState>, id: String) -> bool {
    // 删除分组时，清除所有账号的 group_id
    let mut store = state.store.lock().expect("Failed to acquire store lock");
    for account in store.accounts.iter_mut() {
        if account.group_id.as_deref() == Some(&id) {
            account.group_id = None;
        }
    }
    store.save_to_file();
    drop(store);
    state.group_tag_store.lock().expect("Failed to acquire group_tag_store lock").delete_group(&id)
}

#[tauri::command]
pub fn reorder_groups(state: State<AppState>, ids: Vec<String>) -> bool {
    state.group_tag_store.lock().expect("Failed to acquire group_tag_store lock").reorder_groups(ids)
}

// ============================================================
// 标签命令
// ============================================================

#[tauri::command]
pub fn get_tags(state: State<AppState>) -> Vec<AccountTag> {
    state.group_tag_store.lock().expect("Failed to acquire group_tag_store lock").get_tags()
}

#[tauri::command]
pub fn add_tag(state: State<AppState>, name: String, color: String) -> Result<AccountTag, String> {
    state.group_tag_store.lock().expect("Failed to acquire group_tag_store lock").add_tag(name, color)
}

#[tauri::command]
pub fn update_tag(state: State<AppState>, id: String, name: Option<String>, color: Option<String>) -> Result<AccountTag, String> {
    state.group_tag_store.lock().expect("Failed to acquire group_tag_store lock").update_tag(&id, name, color)
}

#[tauri::command]
pub fn delete_tag(state: State<AppState>, id: String) -> bool {
    // 删除标签时，从所有账号中移除该标签
    let mut store = state.store.lock().expect("Failed to acquire store lock");
    for account in store.accounts.iter_mut() {
        account.tag_links.retain(|l| l.tag_id != id);
    }
    store.save_to_file();
    drop(store);
    state.group_tag_store.lock().expect("Failed to acquire group_tag_store lock").delete_tag(&id)
}

// ============================================================
// 账号分组/标签关联命令
// ============================================================

#[tauri::command]
pub fn set_account_group(state: State<AppState>, account_id: String, group_id: Option<String>) -> Result<(), String> {
    let mut store = state.store.lock().expect("Failed to acquire store lock");
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
    // 先获取标签名
    let tag_name = {
        let gt_store = state.group_tag_store.lock().expect("Failed to acquire group_tag_store lock");
        gt_store.get_tags().iter().find(|t| t.id == tag_id).map(|t| t.name.clone())
    };
    
    let mut store = state.store.lock().expect("Failed to acquire store lock");
    if let Some(account) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        // 检查是否已存在
        if !account.tag_links.iter().any(|l| l.tag_id == tag_id) {
            account.tag_links.push(AccountTagLink::new(tag_id, tag_name));
            store.save_to_file();
        }
        Ok(())
    } else {
        Err("账号不存在".to_string())
    }
}

#[tauri::command]
pub fn remove_tag_from_account(state: State<AppState>, account_id: String, tag_id: String) -> Result<(), String> {
    let mut store = state.store.lock().expect("Failed to acquire store lock");
    if let Some(account) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        account.tag_links.retain(|l| l.tag_id != tag_id);
        store.save_to_file();
        Ok(())
    } else {
        Err("账号不存在".to_string())
    }
}

#[tauri::command]
pub fn set_account_tags(state: State<AppState>, account_id: String, tag_ids: Vec<String>) -> Result<(), String> {
    // 先获取所有标签名
    let tag_names: std::collections::HashMap<String, String> = {
        let gt_store = state.group_tag_store.lock().expect("Failed to acquire group_tag_store lock");
        gt_store.get_tags().iter().map(|t| (t.id.clone(), t.name.clone())).collect()
    };
    
    let mut store = state.store.lock().expect("Failed to acquire store lock");
    if let Some(account) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        // 保留已有的 tag_links（保持时间戳），只添加新的
        let existing_ids: Vec<String> = account.tag_links.iter().map(|l| l.tag_id.clone()).collect();
        // 移除不在新列表中的
        account.tag_links.retain(|l| tag_ids.contains(&l.tag_id));
        // 添加新的
        for tag_id in &tag_ids {
            if !existing_ids.contains(tag_id) {
                let tag_name = tag_names.get(tag_id).cloned();
                account.tag_links.push(AccountTagLink::new(tag_id.clone(), tag_name));
            }
        }
        store.save_to_file();
        Ok(())
    } else {
        Err("账号不存在".to_string())
    }
}

#[tauri::command]
pub fn remove_account_tags(state: State<AppState>, account_id: String, tag_ids: Vec<String>) -> Result<(), String> {
    let mut store = state.store.lock().expect("Failed to acquire store lock");
    if let Some(account) = store.accounts.iter_mut().find(|a| a.id == account_id) {
        account.tag_links.retain(|l| !tag_ids.contains(&l.tag_id));
        store.save_to_file();
        Ok(())
    } else {
        Err("账号不存在".to_string())
    }
}
