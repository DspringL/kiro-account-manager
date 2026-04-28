// 应用全局状态

use crate::core::account::{AccountStore, GroupTagStore};
use crate::auth::AuthState;
use crate::gateway::GatewayRuntime;
use std::sync::Mutex;

#[derive(Clone)]
pub struct PendingLogin {
    pub provider: String,
    pub code_verifier: String,
    pub state: String,
    pub machineid: String,
}

pub struct AppState {
    pub store: Mutex<AccountStore>,
    pub group_tag_store: Mutex<GroupTagStore>,
    pub auth: AuthState,
    pub pending_login: Mutex<Option<PendingLogin>>,
    pub gateway: Mutex<Option<GatewayRuntime>>,
}
