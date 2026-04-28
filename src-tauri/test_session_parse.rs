use std::fs;

#[path = "src/models/ide_session.rs"]
mod ide_session;

fn main() {
    let hash = "ZTpcVlNDb2RlU3BhY2VcS2lyb1xraXJvLWFjY291bnQtbWFuYWdlcg__";
    let path = format!(
        "C:\\Users\\12925\\AppData\\Roaming\\Kiro\\User\\globalStorage\\kiro.kiroagent\\workspace-sessions\\{}\\030579cc-926e-4829-8829-0dd0ab3c9cb5.json",
        hash
    );
    
    println!("Reading file: {}", path);
    
    match fs::read_to_string(&path) {
        Ok(content) => {
            println!("File size: {} bytes", content.len());
            
            match serde_json::from_str::<ide_session::IdeSession>(&content) {
                Ok(session) => {
                    println!("✅ Successfully parsed session!");
                    println!("  Session ID: {}", session.session_id);
                    println!("  Title: {}", session.title);
                    println!("  Type: {}", session.session_type);
                    println!("  History count: {}", session.history.len());
                }
                Err(e) => {
                    println!("❌ Failed to parse JSON: {}", e);
                }
            }
        }
        Err(e) => {
            println!("❌ Failed to read file: {}", e);
        }
    }
}
