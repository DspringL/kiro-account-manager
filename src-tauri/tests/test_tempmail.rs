#[cfg(test)]
mod tests {
    use kiro_account_manager::services::tempmail_api::TempMailApi;

    #[test]
    fn test_extract_code_basic() {
        assert_eq!(
            TempMailApi::extract_code("Your verification code is: 123456"),
            Some("123456".to_string())
        );
    }

    #[test]
    fn test_extract_code_chinese() {
        assert_eq!(
            TempMailApi::extract_code("验证码：654321"),
            Some("654321".to_string())
        );
    }

    #[test]
    fn test_extract_code_html() {
        assert_eq!(
            TempMailApi::extract_code("<div>123456</div>"),
            Some("123456".to_string())
        );
    }

    #[test]
    fn test_extract_code_color() {
        // 应该排除颜色值
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
