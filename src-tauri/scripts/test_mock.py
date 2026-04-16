#!/usr/bin/env python3
"""
模拟测试脚本 - 不需要 Camoufox
测试脚本的输入输出格式是否正确
"""

import sys
import json

def log(message: str, email: str = ""):
    """输出日志"""
    print(json.dumps({
        "type": "log",
        "email": email,
        "message": message
    }), flush=True)

def main():
    # 读取输入
    try:
        input_data = json.loads(sys.stdin.read())
    except Exception as e:
        print(json.dumps({
            "type": "error",
            "message": f"解析输入失败: {e}"
        }), flush=True)
        sys.exit(1)
    
    email = input_data.get("email")
    verification_code = input_data.get("verification_code")
    proxy_url = input_data.get("proxy_url")
    
    if not email or not verification_code:
        print(json.dumps({
            "type": "error",
            "message": "缺少必需参数"
        }), flush=True)
        sys.exit(1)
    
    # 模拟注册流程
    log("========== 开始模拟注册 ==========", email)
    log(f"邮箱: {email}", email)
    log(f"验证码: {verification_code}", email)
    if proxy_url:
        log(f"代理: {proxy_url}", email)
    
    log("步骤1: 启动浏览器...", email)
    log("步骤2: 输入邮箱...", email)
    log("步骤3: 输入验证码...", email)
    log("步骤4: 设置密码...", email)
    log("步骤5: 获取 SSO Token...", email)
    
    # 模拟成功结果
    result = {
        "success": True,
        "sso_token": "mock_sso_token_" + email.split("@")[0],
        "refresh_token": None,
        "name": "Test User",
        "email": email
    }
    
    log("========== 注册成功! ==========", email)
    
    # 输出结果
    print(json.dumps({
        "type": "result",
        "data": result
    }), flush=True)

if __name__ == "__main__":
    main()
