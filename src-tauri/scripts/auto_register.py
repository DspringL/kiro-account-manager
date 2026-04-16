#!/usr/bin/env python3
"""
AWS Builder ID 自动注册脚本 (使用 Camoufox)
接收 JSON 参数，输出 JSON 结果和实时日志
"""

import sys
import json
import asyncio
import os

# 检查 Camoufox 是否已安装
try:
    from camoufox.async_api import AsyncCamoufox
    CAMOUFOX_AVAILABLE = True
except ImportError:
    CAMOUFOX_AVAILABLE = False
    print(json.dumps({
        "type": "error",
        "message": "Camoufox 未安装。请运行: pip install camoufox && python -m camoufox fetch"
    }), flush=True)


def log(message: str, email: str = ""):
    """输出日志到 stdout，供 Rust 读取"""
    print(json.dumps({
        "type": "log",
        "email": email,
        "message": message
    }), flush=True)


async def wait_and_fill(page, selector: str, value: str, description: str, timeout: int = 30000):
    """等待元素出现并填充内容"""
    log(f"等待{description}出现...")
    try:
        await page.wait_for_selector(selector, timeout=timeout)
        await asyncio.sleep(0.5)
        await page.fill(selector, value)
        log(f"✓ 已输入{description}: {value}")
        return True
    except Exception as e:
        log(f"✗ {description}操作失败: {e}")
        return False


async def wait_and_click(page, selector: str, description: str, timeout: int = 30000):
    """等待按钮出现并点击"""
    log(f"等待{description}出现...")
    try:
        await page.wait_for_selector(selector, timeout=timeout)
        await asyncio.sleep(0.5)
        await page.click(selector)
        log(f"✓ 已点击{description}")
        return True
    except Exception as e:
        log(f"✗ 点击{description}失败: {e}")
        return False


async def register_aws(email: str, verification_code: str, proxy_url: str = None, account_password: str = None):
    """使用 Camoufox 注册 AWS Builder ID"""
    
    if not CAMOUFOX_AVAILABLE:
        return {
            "success": False,
            "error": "Camoufox 未安装"
        }
    
    # 使用自定义密码或默认密码
    password = account_password if account_password else "Alisi1976230!"
    log(f'使用密码: {password}')
    
    # 生成随机姓名
    import random
    first_names = ['James', 'Robert', 'John', 'Michael', 'David', 'William', 'Richard', 'Maria', 'Elizabeth', 'Jennifer']
    last_names = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez']
    random_name = f"{random.choice(first_names)} {random.choice(last_names)}"
    
    log('========== 开始 AWS Builder ID 注册 ==========', email)
    log(f'邮箱: {email}', email)
    log(f'姓名: {random_name}', email)
    if proxy_url:
        log(f'代理: {proxy_url}', email)
    
    try:
        # 启动 Camoufox
        log('\n步骤1: 启动浏览器，进入注册页面...', email)
        
        browser_args = {
            'headless': False,
        }
        if proxy_url:
            browser_args['proxy'] = proxy_url
        
        async with AsyncCamoufox(**browser_args) as browser:
            page = await browser.new_page()
            
            register_url = 'https://view.awsapps.com/start/#/device?user_code=PQCF-FCCN'
            await page.goto(register_url, timeout=60000)
            log('✓ 页面加载完成', email)
            await asyncio.sleep(2)
            
            # 输入邮箱
            if not await wait_and_fill(page, 'input[placeholder="username@example.com"]', email, '邮箱输入框'):
                return {"success": False, "error": "未找到邮箱输入框"}
            await asyncio.sleep(1)
            
            # 点击第一个继续按钮
            if not await wait_and_click(page, 'button[data-testid="test-primary-button"]', '第一个继续按钮'):
                return {"success": False, "error": "点击第一个继续按钮失败"}
            await asyncio.sleep(3)
            
            # 检测是否是已注册账号
            log('\n步骤2: 检测账号状态...', email)
            is_login_flow = False
            try:
                # 尝试检测登录页面
                await page.wait_for_selector('span[class*="awsui_heading-text"]:has-text("Sign in with your AWS Builder ID")', timeout=5000)
                is_login_flow = True
                log('⚠ 检测到邮箱已注册，切换到登录流程...', email)
            except:
                log('✓ 新账号，继续注册流程', email)
            
            if is_login_flow:
                # 登录流程
                log('\n步骤3(登录): 输入密码...', email)
                if not await wait_and_fill(page, 'input[placeholder="Enter password"]', password, '登录密码输入框'):
                    return {"success": False, "error": "未找到登录密码输入框"}
                await asyncio.sleep(1)
                
                if not await wait_and_click(page, 'button[data-testid="test-primary-button"]', '登录继续按钮'):
                    return {"success": False, "error": "点击登录继续按钮失败"}
                await asyncio.sleep(3)
                
                # 等待验证码输入框
                log('\n步骤4(登录): 等待验证码输入框...', email)
                code_selector = 'input[placeholder="6-digit"]'
                try:
                    await page.wait_for_selector(code_selector, timeout=10000)
                    log('✓ 登录验证码输入框已出现', email)
                except:
                    return {"success": False, "error": "未找到登录验证码输入框"}
                
                # 输入验证码
                if not await wait_and_fill(page, code_selector, verification_code, '登录验证码'):
                    return {"success": False, "error": "输入登录验证码失败"}
                await asyncio.sleep(1)
                
                if not await wait_and_click(page, 'button[data-testid="test-primary-button"]', '登录验证码确认按钮'):
                    return {"success": False, "error": "点击登录验证码确认按钮失败"}
                await asyncio.sleep(5)
                
            else:
                # 注册流程
                log('\n步骤3: 输入姓名...', email)
                if not await wait_and_fill(page, 'input[placeholder="Maria José Silva"]', random_name, '姓名输入框'):
                    return {"success": False, "error": "未找到姓名输入框"}
                await asyncio.sleep(1)
                
                if not await wait_and_click(page, 'button[data-testid="signup-next-button"]', '第二个继续按钮'):
                    return {"success": False, "error": "点击第二个继续按钮失败"}
                await asyncio.sleep(3)
                
                # 等待验证码输入框
                log('\n步骤4: 等待验证码输入框...', email)
                code_selector = 'input[placeholder="6 位数"]'
                try:
                    await page.wait_for_selector(code_selector, timeout=60000)
                    log('✓ 验证码输入框已出现', email)
                except Exception as e:
                    log(f'⚠ 未找到验证码输入框: {e}', email)
                    # 尝试其他选择器
                    try:
                        await page.wait_for_selector('input[type="text"]', timeout=10000)
                        log('✓ 找到文本输入框，尝试使用', email)
                        code_selector = 'input[type="text"]'
                    except:
                        return {"success": False, "error": "未找到验证码输入框"}
                await asyncio.sleep(1)
                
                # 输入验证码
                if not await wait_and_fill(page, code_selector, verification_code, '验证码'):
                    return {"success": False, "error": "输入验证码失败"}
                await asyncio.sleep(1)
                
                if not await wait_and_click(page, 'button[data-testid="email-verification-verify-button"]', 'Continue 按钮'):
                    return {"success": False, "error": "点击 Continue 按钮失败"}
                await asyncio.sleep(3)
                
                # 输入密码
                log('\n步骤5: 输入密码...', email)
                password_selector = 'input[placeholder="Enter password"]'
                try:
                    await page.wait_for_selector(password_selector, timeout=30000)
                except:
                    # 尝试其他选择器
                    try:
                        await page.wait_for_selector('input[type="password"]', timeout=10000)
                        password_selector = 'input[type="password"]'
                    except:
                        return {"success": False, "error": "未找到密码输入框"}
                
                if not await wait_and_fill(page, password_selector, password, '密码输入框'):
                    return {"success": False, "error": "未找到密码输入框"}
                await asyncio.sleep(0.5)
                
                confirm_password_selector = 'input[placeholder="Re-enter password"]'
                try:
                    await page.wait_for_selector(confirm_password_selector, timeout=10000)
                except:
                    # 尝试其他选择器
                    try:
                        inputs = await page.query_selector_all('input[type="password"]')
                        if len(inputs) >= 2:
                            confirm_password_selector = 'input[type="password"]:nth-of-type(2)'
                    except:
                        pass
                
                if not await wait_and_fill(page, confirm_password_selector, password, '确认密码输入框'):
                    return {"success": False, "error": "未找到确认密码输入框"}
                await asyncio.sleep(1)
                
                if not await wait_and_click(page, 'button[data-testid="test-primary-button"]', '第三个继续按钮'):
                    return {"success": False, "error": "点击第三个继续按钮失败"}
                await asyncio.sleep(5)
            
            # 获取 SSO Token
            log('\n步骤最终: 获取 SSO Token...', email)
            sso_token = None
            refresh_token = None
            
            for i in range(30):
                cookies = await page.context.cookies()
                for cookie in cookies:
                    if cookie['name'] == 'x-amz-sso_authn':
                        sso_token = cookie['value']
                        log('✓ 成功获取 SSO Token!', email)
                        break
                if sso_token:
                    break
                log(f'等待 SSO Token... ({i + 1}/30)', email)
                await asyncio.sleep(1)
            
            # 使用 SSO Token 获取 refresh_token
            if sso_token:
                log('\n步骤额外: 使用 SSO Token 获取 refresh_token...', email)
                try:
                    # AWS SSO OIDC CreateToken API
                    # 参考: https://docs.aws.amazon.com/singlesignon/latest/OIDCAPIReference/API_CreateToken.html
                    import json
                    
                    # 先获取 client 注册信息
                    register_url = 'https://oidc.us-east-1.amazonaws.com/register'
                    register_payload = {
                        'clientName': 'kiro-account-manager',
                        'clientType': 'public',
                        'scopes': ['sso:account:access']
                    }
                    
                    # 使用 aiohttp 或 requests 发送请求
                    # 这里简化处理,直接使用已知的 client_id
                    # 实际上 AWS Builder ID 使用固定的 client_id
                    client_id = 'arn:aws:sso::aws:app/ssoins-722377b1a6e95e8c/apl-080bf5c0c5d04f4f'
                    
                    # 使用 SSO Token 交换 access_token
                    token_url = 'https://oidc.us-east-1.amazonaws.com/token'
                    token_payload = {
                        'clientId': client_id,
                        'grantType': 'urn:ietf:params:oauth:grant-type:device_code',
                        'deviceCode': 'PQCF-FCCN',  # 这个是注册页面的 device_code
                        'code': sso_token
                    }
                    
                    # 注意: 这个实现可能需要调整,因为 AWS SSO OIDC API 的具体调用方式可能不同
                    # 暂时先返回 SSO Token,后续在 Rust 中实现转换
                    log('⚠ SSO Token 转 refresh_token 功能待实现', email)
                    
                except Exception as e:
                    log(f'⚠ 获取 refresh_token 失败: {e}', email)
            
            if sso_token:
                log('\n========== 操作成功! ==========', email)
                return {
                    "success": True,
                    "sso_token": sso_token,
                    "refresh_token": refresh_token,  # 可能为 None
                    "name": random_name,
                    "email": email
                }
            else:
                return {"success": False, "error": "未能获取 SSO Token"}
                
    except Exception as e:
        log(f'\n✗ 注册失败: {e}', email)
        return {"success": False, "error": str(e)}


async def main():
    # 从 stdin 读取 JSON 参数
    try:
        input_data = json.loads(sys.stdin.read())
    except Exception as e:
        print(json.dumps({
            "type": "error",
            "message": f"解析输入参数失败: {e}"
        }), flush=True)
        sys.exit(1)
    
    email = input_data.get("email")
    verification_code = input_data.get("verification_code")
    proxy_url = input_data.get("proxy_url")
    account_password = input_data.get("account_password")  # 可选的 AWS 账号密码
    
    if not email or not verification_code:
        print(json.dumps({
            "type": "error",
            "message": "缺少必需参数: email 或 verification_code"
        }), flush=True)
        sys.exit(1)
    
    result = await register_aws(email, verification_code, proxy_url, account_password)
    
    # 输出最终结果
    print(json.dumps({
        "type": "result",
        "data": result
    }), flush=True)


if __name__ == "__main__":
    asyncio.run(main())
