// Steering 管理命令

use crate::steering::{SteeringFile, SteeringManager};
use tauri::command;

#[command]
pub async fn get_steering_files() -> Result<Vec<SteeringFile>, String> {
    tokio::task::spawn_blocking(SteeringManager::load_all)
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn get_steering_file(file_name: String) -> Result<SteeringFile, String> {
    tokio::task::spawn_blocking(move || SteeringManager::load(&file_name))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn save_steering_file(file_name: String, content: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || SteeringManager::save(&file_name, &content))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn delete_steering_file(file_name: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || SteeringManager::delete(&file_name))
        .await
        .map_err(|e| e.to_string())?
}

#[command]
pub async fn create_steering_file(file_name: String, content: String) -> Result<SteeringFile, String> {
    tokio::task::spawn_blocking(move || SteeringManager::create(&file_name, &content))
        .await
        .map_err(|e| e.to_string())?
}
