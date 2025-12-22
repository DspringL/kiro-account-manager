"""
Amazon Q Developer 批量自动注册脚本 (合并版)
使用临时邮箱 API 自动接收验证码，完全自动化批量注册

功能:
1. 自动生成临时邮箱
2. 调用 AWS Device Authorization API 获取授权链接
3. 自动接收邮箱验证码
4. 自动完成 AWS Builder ID 注册流程 (邮箱 → 验证码 → 姓名 → 密码 → 确认 → 授权)
5. 自动获取 refreshToken、accessToken、clientId、clientSecret
6. 支持批量注册多个账号
7. 绕过 Cloudflare 验证

使用方法:
    python amazonq_auto_register.py                    # 默认注册 1 个账号
    python amazonq_auto_register.py 5                  # 注册 5 个账号
    python amazonq_auto_register.py 10 3               # 注册 10 个账号，同时开 3 个窗口

⚠️ 仅供学习研究使用
"""

import json
import time
import uuid
import os
import re
import sys
import random
import threading
from typing import Dict, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, as_completed

import requests
from seleniumbase import SB
from selenium.webdriver.common.keys import Keys

from gptmail_service import GPTMailHandler


# ========== 路径配置 ==========
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ACCOUNTS_FILE = os.path.join(SCRIPT_DIR, "accounts.json")

# ========== 代理配置 ==========
PROXY_HOST = "127.0.0.1"
PROXY_PORT = "7897"
PROXY_SOCKS5 = f"socks5://{PROXY_HOST}:{PROXY_PORT}"

# ========== User-Agent 池配置 ==========
AWS_SDK_VERSIONS = [
    "1.3.9", "1.3.8", "1.3.7", "1.4.0", "1.4.1",
    "1.2.15", "1.2.16", "1.3.0", "1.3.1"
]
RUST_VERSIONS = [
    "1.87.0", "1.86.0", "1.85.0", "1.84.0", "1.83.0",
    "1.88.0", "1.81.0", "1.82.0"
]
OS_TYPES = ["windows", "macos", "linux"]
SSOOIDC_VERSIONS = [
    "1.88.0", "1.87.0", "1.86.0", "1.85.0", "1.89.0"
]
UA_MODE = ["m/E", "m/F", "m/D", "m/G"]


def generate_auth_user_agent():
    """生成OIDC认证用的User-Agent"""
    sdk_version = random.choice(AWS_SDK_VERSIONS)
    os_type = random.choice(OS_TYPES)
    rust_version = random.choice(RUST_VERSIONS)
    ssooidc_version = random.choice(SSOOIDC_VERSIONS)
    mode = random.choice(UA_MODE)

    user_agent = f"aws-sdk-rust/{sdk_version} os/{os_type} lang/rust/{rust_version}"
    x_amz_user_agent = (
        f"aws-sdk-rust/{sdk_version} ua/2.1 api/ssooidc/{ssooidc_version} "
        f"os/{os_type} lang/rust/{rust_version} {mode} app/AmazonQ-For-CLI"
    )
    return user_agent, x_amz_user_agent


# ========== OIDC 认证配置 ==========
OIDC_BASE = "https://oidc.us-east-1.amazonaws.com"
REGISTER_URL = f"{OIDC_BASE}/client/register"
DEVICE_AUTH_URL = f"{OIDC_BASE}/device_authorization"
TOKEN_URL = f"{OIDC_BASE}/token"
START_URL = "https://view.awsapps.com/start"
AMZ_SDK_REQUEST = "attempt=1; max=3"


def make_headers() -> Dict[str, str]:
    """生成请求头"""
    user_agent, x_amz_user_agent = generate_auth_user_agent()
    return {
        "content-type": "application/json",
        "user-agent": user_agent,
        "x-amz-user-agent": x_amz_user_agent,
        "amz-sdk-request": AMZ_SDK_REQUEST,
        "amz-sdk-invocation-id": str(uuid.uuid4()),
    }


def post_json(url: str, payload: Dict) -> requests.Response:
    """发送JSON POST请求"""
    payload_str = json.dumps(payload, ensure_ascii=False)
    headers = make_headers()
    proxies = {"http": PROXY_SOCKS5, "https": PROXY_SOCKS5}
    return requests.post(url, headers=headers, data=payload_str, timeout=(15, 60), proxies=proxies)


def register_client_min() -> Tuple[str, str]:
    """注册OIDC客户端，返回 (clientId, clientSecret)"""
    payload = {
        "clientName": "Amazon Q Developer for command line",
        "clientType": "public",
        "scopes": [
            "codewhisperer:completions",
            "codewhisperer:analysis",
            "codewhisperer:conversations",
            "codewhisperer:transformations",
            "codewhisperer:taskassist",
        ],
    }
    r = post_json(REGISTER_URL, payload)
    r.raise_for_status()
    data = r.json()
    print(f"[DEBUG] OIDC Register Response: {json.dumps(data, indent=2)}")
    return data["clientId"], data["clientSecret"]


def device_authorize(client_id: str, client_secret: str) -> Dict:
    """发起设备授权"""
    payload = {"clientId": client_id, "clientSecret": client_secret, "startUrl": START_URL}
    r = post_json(DEVICE_AUTH_URL, payload)
    r.raise_for_status()
    return r.json()


def poll_token_device_code(
    client_id: str, client_secret: str, device_code: str,
    interval: int, expires_in: int, max_timeout_sec: Optional[int] = 300
) -> Dict:
    """轮询获取token"""
    payload = {
        "clientId": client_id,
        "clientSecret": client_secret,
        "deviceCode": device_code,
        "grantType": "urn:ietf:params:oauth:grant-type:device_code",
    }

    now = time.time()
    upstream_deadline = now + max(1, int(expires_in))
    cap_deadline = now + max_timeout_sec if max_timeout_sec and max_timeout_sec > 0 else upstream_deadline
    deadline = min(upstream_deadline, cap_deadline)
    poll_interval = max(1, int(interval or 1))

    while time.time() < deadline:
        r = post_json(TOKEN_URL, payload)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 400:
            try:
                err = r.json()
            except Exception:
                err = {"error": r.text}
            if str(err.get("error")) == "authorization_pending":
                time.sleep(poll_interval)
                continue
            r.raise_for_status()
        r.raise_for_status()

    raise TimeoutError("Device authorization expired before approval (timeout reached)")


# ========== 批量注册配置 ==========
DEFAULT_BATCH_COUNT = 1
DEFAULT_CONCURRENT_WINDOWS = 1

# 全局锁
file_lock = threading.Lock()
oidc_lock = threading.Lock()
gptmail_lock = threading.Lock()


def solve_cf_if_present(sb):
    """如果存在 Cloudflare 验证，自动解决"""
    try:
        print("   🛡️  检查 CF 验证...")
        sb.solve_captcha()
        print("   ✅ CF 验证已通过")
        sb.sleep(1)
    except Exception:
        print("   ℹ️  无需 CF 验证")


def save_account_to_file(email, password, client_id, client_secret, refresh_token, access_token):
    """保存账号信息到 JSON 文件 - 线程安全"""
    try:
        account = {
            "email": email,
            "password": password,
            "refreshToken": refresh_token,
            "clientId": client_id,
            "clientSecret": client_secret,
            "region": "us-east-1",
            "provider": "BuilderId"
        }

        with file_lock:
            accounts = []
            if os.path.exists(ACCOUNTS_FILE):
                try:
                    with open(ACCOUNTS_FILE, 'r', encoding='utf-8') as f:
                        accounts = json.load(f)
                except:
                    accounts = []
            
            accounts.append(account)
            
            with open(ACCOUNTS_FILE, 'w', encoding='utf-8') as f:
                json.dump(accounts, f, ensure_ascii=False, indent=2)

        print(f"✅ 账号已保存到: {ACCOUNTS_FILE}")
        return ACCOUNTS_FILE

    except Exception as e:
        print(f"⚠️  保存失败: {e}")
        return None



def register_single_account(account_num, total_accounts):
    """注册单个 Amazon Q Developer 账号"""
    print("\n\n" + "🎯"*30)
    print(f"  [窗口 {account_num}] 开始注册账号 {account_num}/{total_accounts}")
    print("🎯"*30 + "\n")

    # 步骤1: 自动创建 GPTMail 邮箱
    print(f"[窗口 {account_num}] 步骤1: 创建临时邮箱...")
    
    with gptmail_lock:
        mail_handler = GPTMailHandler()
        email = mail_handler.generate_email()
        time.sleep(0.5)
    
    if not email:
        print(f"❌ [窗口 {account_num}] 创建邮箱失败")
        return False
    
    print(f"✅ [窗口 {account_num}] 邮箱: {email}")

    # 常用英文名库
    first_names = [
        'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
        'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Donald', 'Steven', 'Paul', 'Andrew', 'Joshua',
        'Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen',
        'Lisa', 'Nancy', 'Betty', 'Margaret', 'Sandra', 'Ashley', 'Kimberly', 'Emily', 'Donna', 'Michelle',
        'Emma', 'Olivia', 'Ava', 'Isabella', 'Sophia', 'Mia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn'
    ]
    last_names = [
        'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez',
        'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin',
        'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
        'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores'
    ]
    
    first_name = random.choice(first_names)
    last_name = random.choice(last_names)
    username = f"{first_name} {last_name}"
    print(f"👤 用户名设置为: {username}")

    # 生成密码（至少12位，包含大小写字母、数字、特殊字符）
    special_chars = '!@#$%^&*'
    password_chars = [
        random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ'),  # 1个大写
        random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ'),  # 1个大写
        random.choice('abcdefghijklmnopqrstuvwxyz'),  # 1个小写
        random.choice('abcdefghijklmnopqrstuvwxyz'),  # 1个小写
        random.choice('abcdefghijklmnopqrstuvwxyz'),  # 1个小写
        random.choice('abcdefghijklmnopqrstuvwxyz'),  # 1个小写
        random.choice('0123456789'),  # 1个数字
        random.choice('0123456789'),  # 1个数字
        random.choice('0123456789'),  # 1个数字
        random.choice(special_chars),  # 1个特殊字符
        random.choice(special_chars),  # 1个特殊字符
        random.choice('abcdefghijklmnopqrstuvwxyz0123456789'),  # 随机填充
    ]
    random.shuffle(password_chars)
    password = ''.join(password_chars)
    print(f"🔑 密码设置为: {password}")

    # 步骤2: 调用 AWS Device Authorization API
    print("\n" + "="*60)
    print(f"🔑 [窗口 {account_num}] 调用 AWS Device Authorization API")
    print("="*60)

    try:
        with oidc_lock:
            print(f"⏳ [窗口 {account_num}] 正在注册 OIDC 客户端...")
            client_id, client_secret = register_client_min()
            print(f"✅ [窗口 {account_num}] 客户端注册成功")
            print(f"   Client ID: {client_id}")
            print(f"   Client Secret: {client_secret[:20]}...")

            print(f"\n⏳ [窗口 {account_num}] 正在获取设备授权...")
            device_auth = device_authorize(client_id, client_secret)
            time.sleep(0.5)

        device_code = device_auth.get('deviceCode')
        verification_uri_complete = device_auth.get('verificationUriComplete')
        user_code = device_auth.get('userCode')
        interval = device_auth.get('interval', 5)
        expires_in = device_auth.get('expiresIn', 600)

        print(f"✅ [窗口 {account_num}] 设备授权成功")
        print(f"   授权链接: {verification_uri_complete}")
        print(f"   用户代码: {user_code}")
        print(f"   有效期: {expires_in} 秒")

    except Exception as e:
        print(f"❌ [窗口 {account_num}] Device Authorization 失败: {e}")
        import traceback
        traceback.print_exc()
        return False

    # 步骤3: 启动浏览器并打开授权链接
    print("\n" + "="*60)
    print(f"🌐 [窗口 {account_num}] 启动独立浏览器会话（无缓存）")
    print("="*60)

    sb_context = None
    sb = None

    continue_btn_selectors = [
        "button[class*='awsui_variant-primary']",
        "button[data-testid='test-primary-button']",
        "button[data-testid='email-verification-verify-button']",
        "button[type='submit']",
    ]

    try:
        print(f"⏳ [窗口 {account_num}] 正在启动浏览器...")
        sb_context = SB(uc=True, proxy=f"{PROXY_HOST}:{PROXY_PORT}", chromium_arg="--enable-logging --v=1")
        sb = sb_context.__enter__()
        print(f"✅ [窗口 {account_num}] 浏览器启动成功")

        print(f"⏳ [窗口 {account_num}] 正在打开授权链接: {verification_uri_complete}")
        sb.open(verification_uri_complete)
        sb.sleep(3)
        solve_cf_if_present(sb)
        print(f"✅ [窗口 {account_num}] 授权页面加载完成")

        # 页面1: 输入邮箱
        print("\n" + "="*60)
        print("📧 页面1: 输入邮箱")
        print("="*60)

        try:
            sb.sleep(3)
            
            email_selectors = [
                "input[placeholder='username@example.com']",
                "input[class*='awsui_input']",
                "input[type='text'][placeholder='username@example.com']"
            ]
            email_found = False
            for selector in email_selectors:
                try:
                    print(f"   尝试选择器: {selector}")
                    sb.wait_for_element_visible(selector, timeout=5)
                    sb.sleep(0.5)
                    sb.click(selector)
                    sb.sleep(0.3)
                    sb.type(selector, email)
                    print(f"✅ 已输入邮箱: {email}")
                    email_found = True
                    break
                except Exception as ex:
                    print(f"   选择器失败: {str(ex)[:80]}")
                    continue

            if not email_found:
                print("❌ 未找到邮箱输入框")
                sb.save_screenshot("error_email_not_found.png")
                return False

            sb.sleep(1)
            btn_clicked = False
            for selector in continue_btn_selectors:
                try:
                    print(f"   尝试按钮选择器: {selector}")
                    sb.wait_for_element_clickable(selector, timeout=3)
                    sb.click(selector)
                    print("✅ 已点击'继续'")
                    btn_clicked = True
                    break
                except Exception as ex:
                    print(f"   按钮选择器失败: {str(ex)[:50]}")
                    continue
            
            if not btn_clicked:
                print("   尝试JavaScript点击...")
                try:
                    sb.execute_script("document.querySelector('button[type=submit]').click()")
                    print("✅ JS点击成功")
                except:
                    print("❌ 无法点击继续按钮")

            sb.sleep(3)
            solve_cf_if_present(sb)

        except Exception as e:
            print(f"❌ 页面1失败: {e}")
            return False

        # 页面2: 输入用户名
        print("\n" + "="*60)
        print("👤 页面2: 输入用户名")
        print("="*60)

        try:
            sb.sleep(3)
            
            username_selectors = [
                "input[placeholder*='Maria']",
                "input[placeholder*='Silva']",
                "input.awsui_input_2rhyz_1jxbf_149",
                "input[class*='awsui_input']",
                "input[autocomplete='on'][type='text']",
            ]

            username_found = False
            for selector in username_selectors:
                try:
                    print(f"   尝试选择器: {selector}")
                    sb.wait_for_element_visible(selector, timeout=5)
                    sb.sleep(0.5)
                    sb.click(selector)
                    sb.sleep(0.3)
                    sb.type(selector, username)
                    print(f"✅ 已输入用户名: {username}")
                    username_found = True
                    break
                except Exception as ex:
                    print(f"   选择器失败: {str(ex)[:50]}")
                    continue

            if not username_found:
                print("❌ 未找到用户名输入框")
                sb.save_screenshot("error_username_not_found.png")
                return False

            sb.sleep(1)
            btn_clicked = False
            for selector in continue_btn_selectors:
                try:
                    print(f"   尝试按钮: {selector}")
                    sb.wait_for_element_clickable(selector, timeout=3)
                    sb.click(selector)
                    print("✅ 已点击'继续'")
                    btn_clicked = True
                    break
                except:
                    continue
            
            if not btn_clicked:
                try:
                    sb.execute_script("document.querySelector('button[type=submit]').click()")
                    print("✅ JS点击成功")
                except:
                    pass

            sb.sleep(3)
            solve_cf_if_present(sb)

        except Exception as e:
            print(f"❌ 页面2失败: {e}")
            return False


        # 页面3: 输入邮箱验证码
        print("\n" + "="*60)
        print("🔢 页面3: 输入邮箱验证码")
        print("="*60)

        try:
            sb.sleep(3)
            
            verification_code = mail_handler.get_verification_code(email, timeout=100)

            if not verification_code:
                print("❌ 未能获取验证码")
                return False

            code_selectors = [
                "input[class*='awsui_input']",
                "input[type='text']",
            ]

            code_found = False
            for selector in code_selectors:
                try:
                    print(f"   尝试选择器: {selector}")
                    sb.wait_for_element_visible(selector, timeout=5)
                    sb.sleep(0.5)
                    sb.click(selector)
                    sb.sleep(0.3)
                    sb.type(selector, verification_code)
                    print(f"✅ 已输入验证码: {verification_code}")
                    code_found = True
                    break
                except Exception as ex:
                    print(f"   选择器失败: {str(ex)[:50]}")
                    continue

            if not code_found:
                print("❌ 未找到验证码输入框")
                sb.save_screenshot("error_code_not_found.png")
                return False

            sb.sleep(1)
            btn_clicked = False
            for selector in continue_btn_selectors:
                try:
                    print(f"   尝试按钮: {selector}")
                    sb.wait_for_element_clickable(selector, timeout=3)
                    sb.click(selector)
                    print("✅ 已点击'继续'")
                    btn_clicked = True
                    break
                except:
                    continue
            
            if not btn_clicked:
                try:
                    sb.execute_script("document.querySelector('button[type=submit]').click()")
                    print("✅ JS点击成功")
                except:
                    pass

            sb.sleep(3)
            solve_cf_if_present(sb)

        except Exception as e:
            print(f"❌ 页面3失败: {e}")
            return False

        # 页面4: 设置密码
        print("\n" + "="*60)
        print("🔐 页面4: 设置密码")
        print("="*60)

        try:
            sb.sleep(5)
            print("⏳ 等待密码输入框出现...")
            
            sb.wait_for_element_visible("input[type='password']", timeout=15)
            sb.sleep(2)
            
            pwd_count = sb.execute_script("return document.querySelectorAll(\"input[type='password']\").length")
            print(f"   找到 {pwd_count} 个密码框")
            
            try:
                first_pwd_id = sb.execute_script("return document.querySelectorAll(\"input[type='password']\")[0].id")
                second_pwd_id = sb.execute_script("return document.querySelectorAll(\"input[type='password']\")[1].id") if pwd_count >= 2 else None
                
                print(f"   第一个密码框ID: {first_pwd_id}")
                if second_pwd_id:
                    print(f"   第二个密码框ID: {second_pwd_id}")
                
                if first_pwd_id:
                    sb.type(f"#{first_pwd_id}", password)
                    print(f"✅ 已输入第一个密码")
                else:
                    sb.type("input[type='password']", password)
                    print(f"✅ 已输入密码")
                
                sb.sleep(0.5)
                
                if second_pwd_id:
                    sb.type(f"#{second_pwd_id}", password)
                    print(f"✅ 已输入确认密码")
                
                print(f"✅ 密码输入完成: {password}")
                
            except Exception as ex:
                print(f"   密码输入异常: {str(ex)[:80]}")
                sb.execute_script(f'''
                    var pwdInputs = document.querySelectorAll("input[type='password']");
                    for (var i = 0; i < pwdInputs.length; i++) {{
                        pwdInputs[i].focus();
                        pwdInputs[i].value = "{password}";
                        pwdInputs[i].dispatchEvent(new Event('input', {{ bubbles: true }}));
                        pwdInputs[i].dispatchEvent(new Event('change', {{ bubbles: true }}));
                    }}
                ''')
                print(f"✅ 已通过JS输入密码")

            sb.sleep(2)
            
            btn_clicked = False
            for selector in continue_btn_selectors:
                try:
                    print(f"   尝试按钮: {selector}")
                    sb.wait_for_element_clickable(selector, timeout=3)
                    sb.click(selector)
                    print("✅ 已点击'继续'")
                    btn_clicked = True
                    break
                except:
                    continue
            
            if not btn_clicked:
                try:
                    sb.execute_script("document.querySelector('button[type=submit]').click()")
                    print("✅ JS点击成功")
                except:
                    pass

            sb.sleep(3)
            solve_cf_if_present(sb)

        except Exception as e:
            print(f"❌ 页面4失败: {e}")
            return False

        # 页面5: 确认并继续
        print("\n" + "="*60)
        print("✅ 页面5: 确认并继续")
        print("="*60)

        try:
            confirm_selectors = [
                "button:contains('确认并继续')",
                "button:contains('Confirm and continue')",
                "button:contains('Confirm')",
                "button[type='submit']"
            ]

            confirm_found = False
            for selector in confirm_selectors:
                try:
                    sb.wait_for_element_visible(selector, timeout=20)
                    sb.click(selector)
                    print("✅ 已点击'确认并继续'")
                    confirm_found = True
                    break
                except:
                    continue

            if not confirm_found:
                print("ℹ️  未找到'确认并继续'按钮，可能已自动跳过")

            sb.sleep(2)

        except Exception as e:
            print(f"ℹ️  页面5处理: {e}")

        # 页面6: 允许访问
        print("\n" + "="*60)
        print("✅ 页面6: 允许访问")
        print("="*60)

        try:
            allow_selectors = [
                "button:contains('允许访问')",
                "button:contains('Allow access')",
                "button[type='submit']",
                "input[type='submit']"
            ]

            for selector in allow_selectors:
                try:
                    sb.wait_for_element_visible(selector, timeout=20)
                    sb.click(selector)
                    print("✅ 已点击'允许访问'")
                    break
                except:
                    continue

            sb.sleep(2)

        except Exception as e:
            print(f"ℹ️  页面6处理: {e}")

        # 轮询获取 tokens
        print("\n" + "="*60)
        print("🔄 等待授权完成并获取 Tokens")
        print("="*60)

        print("⏳ 正在轮询获取 tokens...")
        print(f"   最大等待时间: {expires_in} 秒")
        print(f"   轮询间隔: {interval} 秒")

        try:
            tokens = poll_token_device_code(
                client_id=client_id,
                client_secret=client_secret,
                device_code=device_code,
                interval=interval,
                expires_in=expires_in,
                max_timeout_sec=300
            )

            access_token = tokens.get('accessToken')
            refresh_token = tokens.get('refreshToken')

            if access_token and refresh_token:
                print("\n" + "🎉"*30)
                print("🎉 账号注册成功！")
                print("🎉"*30)
                print(f"\n📧 邮箱: {email}")
                print(f"🔑 密码: {password}")
                print(f"\n🔐 Client ID: {client_id}")
                print(f"🔐 Client Secret: {client_secret[:20]}...")
                print(f"🔐 Access Token: {access_token[:50]}...")
                print(f"🔄 Refresh Token: {refresh_token[:50]}...")

                save_account_to_file(email, password, client_id, client_secret, refresh_token, access_token)

                print("\n✅ 浏览器会话即将关闭...")
                return True
            else:
                print("❌ Token 数据不完整")
                return False

        except TimeoutError:
            print("❌ 授权超时（5 分钟）")
            return False
        except Exception as e:
            print(f"❌ 获取 Token 失败: {e}")
            import traceback
            traceback.print_exc()
            return False

    except Exception as e:
        print(f"❌ 注册过程出错: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        if sb_context is not None:
            try:
                sb_context.__exit__(None, None, None)
                print("✅ 浏览器已关闭，缓存已清空")
            except:
                pass



def main():
    """主函数"""
    batch_count = DEFAULT_BATCH_COUNT
    concurrent_windows = DEFAULT_CONCURRENT_WINDOWS

    if len(sys.argv) > 1:
        try:
            batch_count = int(sys.argv[1])
            if batch_count <= 0:
                print("❌ 注册数量必须大于 0")
                return
        except ValueError:
            print(f"❌ 无效的数量参数: {sys.argv[1]}")
            print(f"使用方法: python {sys.argv[0]} [数量] [并发窗口数]")
            return

    if len(sys.argv) > 2:
        try:
            concurrent_windows = int(sys.argv[2])
            if concurrent_windows <= 0:
                print("❌ 并发窗口数必须大于 0")
                return
            if concurrent_windows > 5:
                print("⚠️  并发窗口数建议不超过 5，已自动调整为 5")
                concurrent_windows = 5
        except ValueError:
            print(f"❌ 无效的并发窗口数参数: {sys.argv[2]}")
            return

    print("\n" + "🤖"*30)
    print("  Amazon Q Developer 批量自动注册")
    print("  完全自动化 - 使用临时邮箱")
    print("🤖"*30 + "\n")

    print(f"📊 批量注册配置:")
    print(f"   目标数量: {batch_count} 个账号")
    print(f"   并发窗口: {concurrent_windows} 个")
    print(f"   注册流程: 邮箱 → 用户名 → 验证码 → 密码 → 确认")
    print(f"   保存格式: JSON (email, password, refreshToken, clientId, clientSecret, region, provider)")
    print(f"   保存文件: {ACCOUNTS_FILE}")
    print("")

    # 检查已有账号数量
    existing_count = 0
    if os.path.exists(ACCOUNTS_FILE):
        try:
            with open(ACCOUNTS_FILE, 'r', encoding='utf-8') as f:
                existing_count = len(json.load(f))
        except:
            existing_count = 0
        print(f"📁 已有 {existing_count} 个账号记录\n")

    success_count = 0
    fail_count = 0
    count_lock = threading.Lock()

    def process_account(account_num):
        nonlocal success_count, fail_count

        print(f"\n{'='*60}")
        print(f"🔄 [窗口 {account_num}] 开始注册")
        print(f"{'='*60}")

        result = register_single_account(account_num, batch_count)

        with count_lock:
            if result:
                success_count += 1
            else:
                fail_count += 1

            print(f"\n📊 当前进度: ✅ 成功 {success_count} | ❌ 失败 {fail_count} | 📝 总计 {batch_count}")

        return result

    if concurrent_windows == 1:
        print("🔄 单窗口模式 - 顺序注册\n")
        for i in range(1, batch_count + 1):
            process_account(i)
            if i < batch_count:
                wait_time = 3
                print(f"\n⏳ 等待 {wait_time} 秒后注册下一个账号...")
                time.sleep(wait_time)
    else:
        print(f"🚀 多窗口并发模式 - 同时 {concurrent_windows} 个窗口\n")
        with ThreadPoolExecutor(max_workers=concurrent_windows) as executor:
            futures = {executor.submit(process_account, i): i for i in range(1, batch_count + 1)}

            for future in as_completed(futures):
                account_num = futures[future]
                try:
                    future.result()
                except Exception as e:
                    print(f"❌ [窗口 {account_num}] 执行出错: {e}")
                    with count_lock:
                        fail_count += 1

    print("\n\n" + "="*60)
    print("📊 批量注册完成")
    print("="*60)
    print(f"✅ 成功: {success_count} 个账号")
    print(f"❌ 失败: {fail_count} 个账号")
    print(f"📁 所有账号已保存到: {ACCOUNTS_FILE}")
    print("="*60)

    print("\n👋 完成\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️  用户中断操作")
    except Exception as e:
        print(f"\n❌ 程序出错: {e}")
        import traceback
        traceback.print_exc()
