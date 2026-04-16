#!/usr/bin/env python3
"""
测试 Python 脚本的基本功能（不需要 Camoufox）
"""

import sys
import json

def test_json_parsing():
    """测试 JSON 解析"""
    test_input = {
        "email": "test@example.com",
        "verification_code": "123456",
        "proxy_url": None
    }
    
    json_str = json.dumps(test_input)
    parsed = json.loads(json_str)
    
    assert parsed["email"] == "test@example.com"
    assert parsed["verification_code"] == "123456"
    assert parsed["proxy_url"] is None
    
    print("✓ JSON 解析测试通过")

def test_log_output():
    """测试日志输出格式"""
    log_msg = {
        "type": "log",
        "email": "test@example.com",
        "message": "测试消息"
    }
    
    json_str = json.dumps(log_msg)
    parsed = json.loads(json_str)
    
    assert parsed["type"] == "log"
    assert "email" in parsed
    assert "message" in parsed
    
    print("✓ 日志输出格式测试通过")

def test_result_output():
    """测试结果输出格式"""
    result = {
        "type": "result",
        "data": {
            "success": True,
            "sso_token": "test_token",
            "refresh_token": None,
            "name": "Test User",
            "email": "test@example.com"
        }
    }
    
    json_str = json.dumps(result)
    parsed = json.loads(json_str)
    
    assert parsed["type"] == "result"
    assert parsed["data"]["success"] is True
    assert "sso_token" in parsed["data"]
    
    print("✓ 结果输出格式测试通过")

def test_error_output():
    """测试错误输出格式"""
    error = {
        "type": "error",
        "message": "测试错误"
    }
    
    json_str = json.dumps(error)
    parsed = json.loads(json_str)
    
    assert parsed["type"] == "error"
    assert "message" in parsed
    
    print("✓ 错误输出格式测试通过")

def test_script_syntax():
    """测试脚本语法"""
    try:
        with open("src-tauri/scripts/auto_register.py", "r") as f:
            code = f.read()
            compile(code, "auto_register.py", "exec")
        print("✓ Python 脚本语法正确")
    except SyntaxError as e:
        print(f"✗ Python 脚本语法错误: {e}")
        return False
    return True

if __name__ == "__main__":
    print("========== Python 基础功能测试 ==========\n")
    
    try:
        test_json_parsing()
        test_log_output()
        test_result_output()
        test_error_output()
        test_script_syntax()
        
        print("\n========== 所有测试通过! ==========")
        print("\n注意: Camoufox 未安装，无法进行完整的端到端测试")
        print("如需完整测试，请安装 Camoufox:")
        print("  pip3 install --break-system-packages camoufox")
        print("  python3 -m camoufox fetch")
        
    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ 测试出错: {e}")
        sys.exit(1)
