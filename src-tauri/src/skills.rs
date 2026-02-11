// Skills 管理（读取/编辑 ~/.kiro/skills/<name>/SKILL.md 和 <project>/.kiro/skills/）

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInfo {
    pub name: String,
    pub content: String,
    pub size: u64,
    pub modified_at: Option<String>,
    pub extra_files: Vec<String>,
    /// "user" 或 "project"
    pub scope: String,
}

pub struct SkillsManager;

impl SkillsManager {
    pub fn user_dir() -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".kiro").join("skills"))
    }

    pub fn project_dir(project_dir: &str) -> PathBuf {
        PathBuf::from(project_dir).join(".kiro").join("skills")
    }

    fn load_from_dir(dir: &PathBuf, scope: &str) -> Result<Vec<SkillInfo>, String> {
        if !dir.exists() {
            return Ok(vec![]);
        }

        let mut skills = vec![];

        for entry in fs::read_dir(dir).map_err(|e| format!("读取目录失败: {e}"))? {
            let entry = entry.map_err(|e| format!("读取条目失败: {e}"))?;
            let path = entry.path();

            if !path.is_dir() {
                continue;
            }

            let skill_md = path.join("SKILL.md");
            if !skill_md.exists() {
                continue;
            }

            let name = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            let metadata = fs::metadata(&skill_md).ok();
            let size = metadata.as_ref().map_or(0, std::fs::Metadata::len);
            let modified_at = metadata
                .and_then(|m| m.modified().ok())
                .map(|t| {
                    let datetime: chrono::DateTime<chrono::Local> = t.into();
                    datetime.format("%Y/%m/%d %H:%M:%S").to_string()
                });

            let content = fs::read_to_string(&skill_md).unwrap_or_default();

            let extra_files = fs::read_dir(&path)
                .ok()
                .map(|entries| {
                    entries
                        .filter_map(Result::ok)
                        .filter(|e| e.path().is_file())
                        .filter_map(|e| {
                            let fname = e.file_name().to_string_lossy().to_string();
                            if fname == "SKILL.md" { None } else { Some(fname) }
                        })
                        .collect()
                })
                .unwrap_or_default();

            skills.push(SkillInfo { name, content, size, modified_at, extra_files, scope: scope.to_string() });
        }

        skills.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(skills)
    }

    fn resolve_dir(scope: &str, project_dir: Option<&str>) -> Result<PathBuf, String> {
        match scope {
            "project" => {
                let pd = project_dir.ok_or("项目级操作需要提供项目目录")?;
                Ok(Self::project_dir(pd))
            }
            _ => Self::user_dir().ok_or_else(|| "无法获取用户目录".to_string()),
        }
    }

    fn validate_skill_name(name: &str) -> Result<(), String> {
        if name.is_empty() {
            return Err("Skill 名称不能为空".to_string());
        }
        if name.contains('/') || name.contains('\\') {
            return Err("Skill 名称不能包含路径分隔符".to_string());
        }
        if name.contains("..") {
            return Err("Skill 名称不能包含 ..".to_string());
        }

        let path = Path::new(name);
        for comp in path.components() {
            if !matches!(comp, Component::Normal(_)) {
                return Err("Skill 名称非法".to_string());
            }
        }
        Ok(())
    }

    fn safe_skill_dir(base_dir: &Path, name: &str) -> Result<PathBuf, String> {
        Self::validate_skill_name(name)?;
        let candidate = base_dir.join(name);

        if !candidate.starts_with(base_dir) {
            return Err("非法路径".to_string());
        }

        Ok(candidate)
    }

    pub fn load_all(project_dir: Option<&str>) -> Result<Vec<SkillInfo>, String> {
        let mut all = vec![];
        if let Some(dir) = Self::user_dir() {
            all.extend(Self::load_from_dir(&dir, "user")?);
        }
        if let Some(pd) = project_dir {
            all.extend(Self::load_from_dir(&Self::project_dir(pd), "project")?);
        }
        Ok(all)
    }

    pub fn load(name: &str, scope: &str, project_dir: Option<&str>) -> Result<SkillInfo, String> {
        let dir = Self::resolve_dir(scope, project_dir)?;
        let skill_dir = Self::safe_skill_dir(&dir, name)?;
        let skill_md = skill_dir.join("SKILL.md");

        if !skill_md.exists() {
            return Err(format!("Skill 不存在: {name}"));
        }

        let content = fs::read_to_string(&skill_md).map_err(|e| format!("读取文件失败: {e}"))?;
        let metadata = fs::metadata(&skill_md).ok();
        let size = metadata.as_ref().map_or(0, std::fs::Metadata::len);
        let modified_at = metadata
            .and_then(|m| m.modified().ok())
            .map(|t| {
                let datetime: chrono::DateTime<chrono::Local> = t.into();
                datetime.format("%Y/%m/%d %H:%M:%S").to_string()
            });

        let extra_files = fs::read_dir(&skill_dir)
            .ok()
            .map(|entries| {
                entries
                    .filter_map(Result::ok)
                    .filter(|e| e.path().is_file())
                    .filter_map(|e| {
                        let fname = e.file_name().to_string_lossy().to_string();
                        if fname == "SKILL.md" { None } else { Some(fname) }
                    })
                    .collect()
            })
            .unwrap_or_default();

        Ok(SkillInfo { name: name.to_string(), content, size, modified_at, extra_files, scope: scope.to_string() })
    }

    pub fn save(name: &str, content: &str, scope: &str, project_dir: Option<&str>) -> Result<(), String> {
        let dir = Self::resolve_dir(scope, project_dir)?;
        let skill_dir = Self::safe_skill_dir(&dir, name)?;
        fs::create_dir_all(&skill_dir).ok();
        fs::write(skill_dir.join("SKILL.md"), content).map_err(|e| format!("写入失败: {e}"))
    }

    pub fn delete(name: &str, scope: &str, project_dir: Option<&str>) -> Result<(), String> {
        let dir = Self::resolve_dir(scope, project_dir)?;
        let skill_dir = Self::safe_skill_dir(&dir, name)?;
        if skill_dir.exists() {
            fs::remove_dir_all(&skill_dir).map_err(|e| format!("删除失败: {e}"))?;
        }
        Ok(())
    }

    pub fn create(name: &str, content: &str, scope: &str, project_dir: Option<&str>) -> Result<SkillInfo, String> {
        let dir = Self::resolve_dir(scope, project_dir)?;
        let skill_dir = Self::safe_skill_dir(&dir, name)?;
        if skill_dir.exists() {
            return Err(format!("Skill 已存在: {name}"));
        }
        fs::create_dir_all(&skill_dir).map_err(|e| format!("创建目录失败: {e}"))?;
        fs::write(skill_dir.join("SKILL.md"), content).map_err(|e| format!("写入失败: {e}"))?;
        Self::load(name, scope, project_dir)
    }
}
