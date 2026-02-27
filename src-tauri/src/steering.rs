// Steering 管理（读取/编辑 ~/.kiro/steering/*.md 和 <project>/.kiro/steering/*.md）

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SteeringFile {
    pub file_name: String,
    pub content: String,
    pub size: u64,
    pub modified_at: Option<String>,
    /// "user" 或 "project"
    pub scope: String,
}

pub struct SteeringManager;

impl SteeringManager {
    /// 获取用户级 steering 目录
    pub fn user_dir() -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".kiro").join("steering"))
    }

    /// 获取项目级 steering 目录
    pub fn project_dir(project_dir: &str) -> PathBuf {
        PathBuf::from(project_dir).join(".kiro").join("steering")
    }

    /// 从指定目录读取所有 steering 文件
    fn load_from_dir(dir: &PathBuf, scope: &str) -> Result<Vec<SteeringFile>, String> {
        if !dir.exists() {
            return Ok(vec![]);
        }

        let mut files = vec![];

        for entry in fs::read_dir(dir).map_err(|e| format!("读取目录失败: {e}"))? {
            let entry = entry.map_err(|e| format!("读取条目失败: {e}"))?;
            let path = entry.path();

            if path.extension().is_some_and(|e| e == "md") {
                let file_name = path.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default();

                let metadata = fs::metadata(&path).ok();
                let size = metadata.as_ref().map_or(0, std::fs::Metadata::len);
                let modified_at = metadata
                    .and_then(|m| m.modified().ok())
                    .map(|t| {
                        let datetime: chrono::DateTime<chrono::Local> = t.into();
                        datetime.format("%Y/%m/%d %H:%M:%S").to_string()
                    });

                let content = fs::read_to_string(&path).unwrap_or_default();

                files.push(SteeringFile {
                    file_name,
                    content,
                    size,
                    modified_at,
                    scope: scope.to_string(),
                });
            }
        }

        Ok(files)
    }

    /// 根据 scope 获取目标目录
    fn resolve_dir(scope: &str, project_dir: Option<&str>) -> Result<PathBuf, String> {
        match scope {
            "project" => {
                let pd = project_dir.ok_or("项目级操作需要提供项目目录")?;
                Ok(Self::project_dir(pd))
            }
            _ => Self::user_dir().ok_or_else(|| "无法获取用户目录".to_string()),
        }
    }

fn sanitize_file_name(file_name: &str) -> Result<&str, String> {
        if file_name.trim().is_empty() {
            return Err("文件名不能为空".to_string());
        }
if !file_name.ends_with(".md") {
            return Err("Steering 文件必须以 .md 结尾".to_string());
        }

        let path = Path::new(file_name);
        let mut components = path.components();
        let only_normal = matches!(components.next(), Some(Component::Normal(_))) && components.next().is_none();
        if !only_normal {
            return Err("文件名不合法".to_string());
        }

        Ok(file_name)
    }

    fn resolve_file_path(file_name: &str, scope: &str, project_dir: Option<&str>) -> Result<PathBuf, String> {
        let safe_name = Self::sanitize_file_name(file_name)?;
        let dir = Self::resolve_dir(scope, project_dir)?;
        Ok(dir.join(safe_name))
    }

    /// 读取所有 steering 文件（合并用户级和项目级）
    pub fn load_all(project_dir: Option<&str>) -> Result<Vec<SteeringFile>, String> {
        let mut all_files = vec![];

        if let Some(dir) = Self::user_dir() {
            all_files.extend(Self::load_from_dir(&dir, "user")?);
        }

        if let Some(pd) = project_dir {
            let dir = Self::project_dir(pd);
            all_files.extend(Self::load_from_dir(&dir, "project")?);
        }

        Ok(all_files)
    }

    /// 读取单个 steering 文件
    pub fn load(file_name: &str, scope: &str, project_dir: Option<&str>) -> Result<SteeringFile, String> {
        let path = Self::resolve_file_path(file_name, scope, project_dir)?;

        if !path.exists() {
            return Err(format!("Steering 文件不存在: {file_name}"));
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| format!("读取文件失败: {e}"))?;

        let metadata = fs::metadata(&path).ok();
        let size = metadata.as_ref().map_or(0, std::fs::Metadata::len);
        let modified_at = metadata
            .and_then(|m| m.modified().ok())
            .map(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                datetime.format("%Y/%m/%d %H:%M:%S").to_string()
            });

        Ok(SteeringFile {
            file_name: file_name.to_string(),
            content,
            size,
            modified_at,
            scope: scope.to_string(),
        })
    }

    /// 保存 steering 文件
    pub fn save(file_name: &str, content: &str, scope: &str, project_dir: Option<&str>) -> Result<(), String> {
        let dir = Self::resolve_dir(scope, project_dir)?;
        fs::create_dir_all(&dir).ok();

        let path = Self::resolve_file_path(file_name, scope, project_dir)?;
        fs::write(&path, content)
            .map_err(|e| format!("写入失败: {e}"))
    }

    /// 删除 steering 文件
    pub fn delete(file_name: &str, scope: &str, project_dir: Option<&str>) -> Result<(), String> {
        let path = Self::resolve_file_path(file_name, scope, project_dir)?;

        if path.exists() {
            fs::remove_file(&path)
                .map_err(|e| format!("删除失败: {e}"))?;
        }

        Ok(())
    }

    /// 创建新的 steering 文件
    pub fn create(file_name: &str, content: &str, scope: &str, project_dir: Option<&str>) -> Result<SteeringFile, String> {
        let dir = Self::resolve_dir(scope, project_dir)?;
        fs::create_dir_all(&dir).ok();

        let path = Self::resolve_file_path(file_name, scope, project_dir)?;

        if path.exists() {
            return Err(format!("文件已存在: {file_name}"));
        }

        fs::write(&path, content)
            .map_err(|e| format!("写入失败: {e}"))?;

        Self::load(file_name, scope, project_dir)
    }
}
