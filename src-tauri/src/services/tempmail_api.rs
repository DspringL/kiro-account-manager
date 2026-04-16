use crate::types::register::{TempMailAddress, TempMailConfig, TempMailMessage, TempMailMessagesResponse};
use reqwest::Client;
use serde_json::json;
use std::collections::HashSet;
use std::time::Duration;

pub struct TempMailApi {
    client: Client,
    config: TempMailConfig,
}

impl TempMailApi {
    pub fn new(config: TempMailConfig) -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(15))
            .build()
            .unwrap();
        Self { client, config }
    }

    /// 创建临时邮箱
    pub async fn create_address(&self, name: Option<String>) -> Result<TempMailAddress, String> {
        let name = name.unwrap_or_else(|| {
            use rand::Rng;
            let mut rng = rand::thread_rng();
            format!("{:x}", rng.gen::<u64>())
        });

        let body = json!({
            "enablePrefix": false,
            "name": name
        });

        let response = self
            .client
            .post(format!("{}/admin/new_address", self.config.api_url))
            .header("x-admin-auth", &self.config.admin_password)
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("创建临时邮箱失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "创建临时邮箱失败 ({}): {}",
                response.status(),
                response.text().await.unwrap_or_default()
            ));
        }

        response
            .json::<TempMailAddress>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))
    }

    /// 获取邮件列表
    pub async fn get_messages(
        &self,
        jwt: &str,
        limit: u32,
        offset: u32,
    ) -> Result<Vec<TempMailMessage>, String> {
        let response = self
            .client
            .get(format!(
                "{}/api/mails?limit={}&offset={}",
                self.config.api_url, limit, offset
            ))
            .header("Authorization", format!("Bearer {}", jwt))
            .send()
            .await
            .map_err(|e| format!("获取邮件列表失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!(
                "获取邮件列表失败 ({})",
                response.status()
            ));
        }

        let data = response
            .json::<TempMailMessagesResponse>()
            .await
            .map_err(|e| format!("解析响应失败: {}", e))?;

        Ok(data.results)
    }

    /// 删除临时邮箱
    pub async fn delete_address(&self, address_id: i64) -> Result<(), String> {
        let response = self
            .client
            .delete(format!(
                "{}/admin/delete_address/{}",
                self.config.api_url, address_id
            ))
            .header("x-admin-auth", &self.config.admin_password)
            .send()
            .await
            .map_err(|e| format!("删除邮箱失败: {}", e))?;

        if !response.status().is_success() {
            log::warn!("删除邮箱 {} 失败: {}", address_id, response.status());
        }

        Ok(())
    }

    /// 从文本中提取 6 位验证码
    pub fn extract_code(text: &str) -> Option<String> {
        use regex::Regex;
        
        let patterns = vec![
            Regex::new(r"验证码[：:\s]*(\d{6})").unwrap(),
            Regex::new(r"(?i)(?:verification\s*code|Your code is|code is)[：:\s]*(\d{6})").unwrap(),
            Regex::new(r">\s*(\d{6})\s*<").unwrap(),
            Regex::new(r"^\s*(\d{6})\s*$").unwrap(),
            Regex::new(r"\b(\d{6})\b").unwrap(),
        ];

        for pattern in &patterns {
            if let Some(caps) = pattern.captures(text) {
                if let Some(code) = caps.get(1) {
                    let code_str = code.as_str();
                    // 排除颜色值 #XXXXXX
                    if text.contains(&format!("#{}", code_str)) {
                        continue;
                    }
                    return Some(code_str.to_string());
                }
            }
        }

        None
    }

    /// 检查是否是 AWS 发件人
    fn is_aws_sender(source: &str) -> bool {
        let source_lower = source.to_lowercase();
        source_lower.contains("signin.aws")
            || source_lower.contains("login.awsapps.com")
            || source_lower.contains("amazonses.com")
            || source_lower.contains("amazon.com")
            || source_lower.contains("aws.amazon.com")
    }

    /// 从 EML 原始内容中提取纯文本
    fn extract_text_from_eml(raw: &str) -> String {
        // 简化版本：移除 HTML 标签，解码常见实体
        let mut text = raw.to_string();
        
        // 移除 style 和 script 标签
        text = regex::Regex::new(r"<style[^>]*>[\s\S]*?</style>")
            .unwrap()
            .replace_all(&text, "")
            .to_string();
        text = regex::Regex::new(r"<script[^>]*>[\s\S]*?</script>")
            .unwrap()
            .replace_all(&text, "")
            .to_string();
        
        // 移除 HTML 标签
        text = regex::Regex::new(r"<[^>]+>")
            .unwrap()
            .replace_all(&text, " ")
            .to_string();
        
        // 解码 HTML 实体
        text = text
            .replace("&nbsp;", " ")
            .replace("&amp;", "&")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&quot;", "\"");
        
        // 清理多余空白
        text = regex::Regex::new(r"\s+")
            .unwrap()
            .replace_all(&text, " ")
            .to_string();
        
        text.trim().to_string()
    }

    /// 轮询等待验证码
    pub async fn wait_for_verification_code(
        &self,
        jwt: &str,
        max_wait_seconds: u64,
        poll_interval_ms: u64,
        log_callback: Option<&dyn Fn(String)>,
    ) -> Result<String, String> {
        let deadline = tokio::time::Instant::now() + Duration::from_secs(max_wait_seconds);
        let mut checked_ids = HashSet::new();

        if let Some(log) = log_callback {
            log(format!("等待验证码邮件（最长 {} 秒）...", max_wait_seconds));
        }

        while tokio::time::Instant::now() < deadline {
            match self.get_messages(jwt, 20, 0).await {
                Ok(messages) => {
                    if let Some(log) = log_callback {
                        log(format!("收件箱共 {} 封邮件", messages.len()));
                    }

                    for mail in messages {
                        if checked_ids.contains(&mail.id) {
                            continue;
                        }
                        checked_ids.insert(mail.id);

                        // 检查是否是 AWS 发件人
                        if !Self::is_aws_sender(&mail.source) {
                            if let Some(log) = log_callback {
                                log(format!("跳过非 AWS 邮件: {}", mail.source));
                            }
                            continue;
                        }

                        if let Some(log) = log_callback {
                            log(format!("检查 AWS 邮件: from=\"{}\"", mail.source));
                        }

                        // 从 raw 中提取文本并查找验证码
                        let text = Self::extract_text_from_eml(&mail.raw);
                        if let Some(code) = Self::extract_code(&text) {
                            if let Some(log) = log_callback {
                                log(format!("========== 找到验证码: {} ==========", code));
                            }
                            return Ok(code);
                        }

                        if let Some(log) = log_callback {
                            log("未能从此邮件提取验证码".to_string());
                        }
                    }

                    if let Some(log) = log_callback {
                        log(format!("未找到验证码，{} 秒后重试...", poll_interval_ms / 1000));
                    }
                }
                Err(e) => {
                    if let Some(log) = log_callback {
                        log(format!("轮询邮件出错: {}", e));
                    }
                }
            }

            tokio::time::sleep(Duration::from_millis(poll_interval_ms)).await;
        }

        Err("等待验证码超时".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_code() {
        assert_eq!(
            TempMailApi::extract_code("Your verification code is: 123456"),
            Some("123456".to_string())
        );
        assert_eq!(
            TempMailApi::extract_code("验证码：654321"),
            Some("654321".to_string())
        );
        assert_eq!(
            TempMailApi::extract_code("<div>123456</div>"),
            Some("123456".to_string())
        );
        // 排除颜色值
        assert_eq!(TempMailApi::extract_code("color: #123456"), None);
    }

    #[test]
    fn test_is_aws_sender() {
        assert!(TempMailApi::is_aws_sender("no-reply@signin.aws"));
        assert!(TempMailApi::is_aws_sender("noreply@login.awsapps.com"));
        assert!(TempMailApi::is_aws_sender("test@amazonses.com"));
        assert!(!TempMailApi::is_aws_sender("test@gmail.com"));
    }
}
