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


# ========== 代理配置 ==========
PROXY_HOST = "127.0.0.1"
PROXY_PORT = "7897"
PROXY_SOCKS5 = f"socks5://{PROXY_HOST}:{PROXY_PORT}"

# ========== User-Agent 池配置 ==========

# AWS SDK版本池
AWS_SDK_VERSIONS = [
    "1.3.9", "1.3.8", "1.3.7", "1.4.0", "1.4.1",
    "1.2.15", "1.2.16", "1.3.0", "1.3.1"
]

# Rust版本池
RUST_VERSIONS = [
    "1.87.0", "1.86.0", "1.85.0", "1.84.0", "1.83.0",
    "1.88.0", "1.81.0", "1.82.0"
]

# OS版本池
OS_TYPES = ["windows", "macos", "linux"]

# API版本池 (ssooidc)
SSOOIDC_VERSIONS = [
    "1.88.0", "1.87.0", "1.86.0", "1.85.0", "1.89.0"
]

# UA模式标识池
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
    """发送JSON POST请求（不使用代理）"""
    payload_str = json.dumps(payload, ensure_ascii=False)
    headers = make_headers()
    resp = requests.post(url, headers=headers, data=payload_str, timeout=(15, 60))
    return resp


def register_client_min() -> Tuple[str, str]:
    """注册OIDC客户端，返回 (clientId, clientSecret)"""
    payload = {
        "clientName": "Amazon Q Developer for command line",
        "clientType": "public",
        "scopes": [
            "codewhisperer:completions",
            "codewhisperer:analysis",
            "codewhisperer:conversations",
        ],
    }
    r = post_json(REGISTER_URL, payload)
    r.raise_for_status()
    data = r.json()
    print(f"[DEBUG] OIDC Register Response: {json.dumps(data, indent=2)}")
    return data["clientId"], data["clientSecret"]


def device_authorize(client_id: str, client_secret: str) -> Dict:
    """发起设备授权"""
    payload = {
        "clientId": client_id,
        "clientSecret": client_secret,
        "startUrl": START_URL,
    }
    r = post_json(DEVICE_AUTH_URL, payload)
    r.raise_for_status()
    return r.json()


def poll_token_device_code(
    client_id: str,
    client_secret: str,
    device_code: str,
    interval: int,
    expires_in: int,
    max_timeout_sec: Optional[int] = 300,
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
    cap_deadline = now + max_timeout_sec if (max_timeout_sec and max_timeout_sec > 0) else upstream_deadline
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


# ========== 配置 ==========

DEFAULT_BATCH_COUNT = 1
DEFAULT_CONCURRENT_WINDOWS = 1

# 全局锁
file_lock = threading.Lock()
oidc_lock = threading.Lock()


def get_current_page(sb):
    """
    通过 URL 判断当前所在页面
    返回: 'email', 'name', 'verification', 'password', 'confirm', 'allow', 'callback', 'unknown'
    
    URL 流程：
    0. 授权起始页: https://view.awsapps.com/start/#/device?user_code=XXXX-XXXX
    1. 邮箱页: https://us-east-1.signin.aws/platform/.../login?...
    2. 姓名页: https://profile.aws.amazon.com/?...#/signup/enter-email
    3. 验证码页: https://profile.aws.amazon.com/?...#/signup/verify-otp
    4. 密码页: https://us-east-1.signin.aws/platform/.../signup?registrationCode=...
    5. 确认页: https://view.awsapps.com/start/#/device?user_code=XXXX-XXXX (密码成功后重定向回来)
    6. 允许页: https://view.awsapps.com/start/#/?clientId=...
    """
    try:
        url = sb.get_current_url().lower()
        
        # 回调页面（最高优先级）
        if '127.0.0.1' in url and 'callback' in url:
            return 'callback'
        
        # view.awsapps.com 域名下区分确认页和允许页
        if 'view.awsapps.com' in url:
            if 'user_code=' in url:
                return 'confirm'  # 设备确认页
            if 'clientid=' in url:
                return 'allow'  # 允许访问页
            return 'confirm'  # 默认当作确认页
        
        # 密码页面（signin.aws 域名 + registrationCode 参数）
        if 'registrationcode=' in url:
            return 'password'
        
        # 邮箱页面：signin.aws 域名 + login 路径
        if 'signin.aws' in url and '/login' in url:
            return 'email'
        
        # profile.aws 域名下，通过 hash 区分姓名页和验证码页
        if 'profile.aws' in url:
            if 'verify-otp' in url:
                return 'verification'
            return 'name'
        
        return 'unknown'
    except:
        return 'unknown'


def wait_for_page_change(sb, current_page, timeout=30):
    """等待页面变化，返回新页面类型"""
    start_time = time.time()
    last_url = sb.get_current_url()
    stable_count = 0
    
    while time.time() - start_time < timeout:
        time.sleep(0.5)
        try:
            new_url = sb.get_current_url()
            if new_url != last_url:
                print(f"   🔗 URL 变化: {new_url}")
                last_url = new_url
                stable_count = 0
            else:
                stable_count += 1
                if stable_count >= 4:
                    new_page = get_current_page(sb)
                    if new_page != current_page:
                        return new_page
        except:
            pass
    return None


def check_page_error(sb):
    """检查页面是否有错误提示"""
    try:
        error_texts = ['error processing your request', 'please try again', "it's not you, it's us"]
        page_text = sb.get_page_source().lower()
        for text in error_texts:
            if text in page_text:
                print(f"   ❌ 检测到错误: {text}")
                return True
        return False
    except:
        return False


def hide_cookie_banner(sb):
    """隐藏 cookie banner"""
    try:
        sb.execute_script("""
            var banners = document.querySelectorAll('[class*="cookie"], [class*="consent"]');
            banners.forEach(function(el) { el.style.display = 'none'; });
        """)
    except:
        pass


def save_account_to_file(email, password, client_id, client_secret, refresh_token, access_token):
    """保存账号信息到 JSON 文件 - 线程安全"""
    try:
        # 获取脚本所在目录
        script_dir = os.path.dirname(os.path.abspath(__file__))
        json_file = os.path.join(script_dir, "registered_accounts.json")
        machine_id = str(uuid.uuid4())
        
        account = {
            "email": email,
            "password": password,
            "accessToken": access_token,
            "refreshToken": refresh_token,
            "clientId": client_id,
            "clientSecret": client_secret,
            "region": "us-east-1",
            "provider": "BuilderId",
            "machineId": machine_id
        }

        with file_lock:
            accounts = []
            if os.path.exists(json_file):
                try:
                    with open(json_file, 'r', encoding='utf-8') as f:
                        accounts = json.load(f)
                except:
                    accounts = []
            accounts.append(account)
            with open(json_file, 'w', encoding='utf-8') as f:
                json.dump(accounts, f, ensure_ascii=False, indent=2)

        print(f"✅ 账号已保存到: {json_file}")
        return json_file

    except Exception as e:
        print(f"⚠️  保存失败: {e}")
        return None


def register_single_account(account_num, total_accounts):
    """注册单个 Amazon Q Developer 账号"""
    mail_handler = None
    
    print("\n\n" + "🎯"*30)
    print(f"  [窗口 {account_num}] 开始注册账号 {account_num}/{total_accounts}")
    print("🎯"*30 + "\n")

    # 步骤1: 创建 GPTMail 邮箱
    print(f"[窗口 {account_num}] 步骤1: 创建临时邮箱...")
    
    mail_handler = GPTMailHandler()
    email = mail_handler.generate_email()
    
    if not email:
        print(f"❌ [窗口 {account_num}] 创建邮箱失败")
        return False
    
    print(f"[窗口 {account_num}] ✅ 邮箱: {email}")

    # 生成随机用户名（使用常见英文名）
    first_names = [
        "James", "John", "Robert", "Michael", "David", "William", "Richard", "Joseph",
        "Thomas", "Charles", "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth",
        "Barbara", "Susan", "Jessica", "Sarah", "Karen", "Emma", "Olivia", "Ava",
        "Isabella", "Sophia", "Mia", "Charlotte", "Amelia", "Harper", "Evelyn",
        "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul", "Andrew",
        "Joshua", "Kenneth", "Kevin", "Brian", "George", "Timothy", "Ronald", "Edward"
    ]
    last_names = [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis",
        "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson",
        "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
        "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker"
    ]
    username = f"{random.choice(first_names)} {random.choice(last_names)}"
    print(f"👤 用户名设置为: {username}")

    # 生成随机密码（必须包含：大写、小写、数字、符号）
    upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    lower = 'abcdefghijklmnopqrstuvwxyz'
    digits = '0123456789'
    symbols = '!@#$%&*'
    # 先确保每种类型至少一个
    password = [
        random.choice(upper),
        random.choice(lower),
        random.choice(digits),
        random.choice(symbols)
    ]
    # 剩余8位随机填充
    all_chars = upper + lower + digits + symbols
    password += [random.choice(all_chars) for _ in range(8)]
    # 打乱顺序
    random.shuffle(password)
    password = ''.join(password)
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
        sb.sleep(5)
        sb.reconnect(3)
        print(f"✅ [窗口 {account_num}] 授权页面加载完成")

        # 等待重定向到邮箱输入页
        print("⏳ 等待重定向...")
        for i in range(60):
            current_page = get_current_page(sb)
            current_url = sb.get_current_url()
            if i % 5 == 0:
                print(f"   [{i}s] 当前页面: {current_page}, URL: {current_url[:60]}...")
            if current_page == 'email':
                print(f"   ✅ 已到达邮箱页面")
                break
            if current_page != 'unknown':
                print(f"   ✅ 已到达页面: {current_page}")
                break
            time.sleep(1)
        else:
            print(f"   ⚠️ 等待超时，当前URL: {sb.get_current_url()}")

        # 页面1: 输入邮箱
        print("\n" + "="*60)
        print("📧 页面1: 输入邮箱")
        print("="*60)

        try:
            current_page = get_current_page(sb)
            print(f"   当前页面: {current_page}, URL: {sb.get_current_url()}")
            
            if check_page_error(sb):
                print("❌ AWS 服务端错误")
                return False
            
            sb.wait_for_element_visible("input[placeholder='username@example.com']", timeout=20)
            sb.type("input[placeholder='username@example.com']", email)
            print(f"✅ 已输入邮箱: {email}")

            hide_cookie_banner(sb)
            sb.sleep(1)
            
            # 点击继续按钮
            for selector in continue_btn_selectors:
                try:
                    if sb.is_element_visible(selector):
                        sb.click(selector)
                        print("✅ 已点击'继续'")
                        break
                except:
                    continue

            sb.reconnect(3)
            
            if check_page_error(sb):
                print("❌ 邮箱提交失败")
                return False
            
            new_page = wait_for_page_change(sb, 'email', timeout=15)
            if new_page:
                print(f"   ✅ 已跳转到: {new_page}")

        except Exception as e:
            print(f"❌ 页面1失败: {e}")
            return False

        # 页面2: 输入用户名
        print("\n" + "="*60)
        print("👤 页面2: 输入用户名")
        print("="*60)

        try:
            current_page = get_current_page(sb)
            print(f"   当前页面: {current_page}, URL: {sb.get_current_url()}")
            
            # 如果已经跳过姓名页，跳过此步骤
            if current_page == 'verification':
                print("ℹ️ 已在验证码页面，跳过姓名步骤")
            else:
                sb.wait_for_element_visible("[data-testid='signup-full-name-input'] input", timeout=15)
                sb.type("[data-testid='signup-full-name-input'] input", username)
                print(f"✅ 已输入用户名: {username}")

                hide_cookie_banner(sb)
                sb.sleep(1)
                
                for selector in continue_btn_selectors:
                    try:
                        if sb.is_element_visible(selector):
                            sb.click(selector)
                            print("✅ 已点击'继续'")
                            break
                    except:
                        continue
                
                sb.reconnect(3)
                
                if check_page_error(sb):
                    print("❌ 用户名提交失败")
                    return False
                
                # 等待页面跳转到验证码页
                print("⏳ 等待页面跳转...")
                new_page = wait_for_page_change(sb, 'name', timeout=30)
                if new_page:
                    print(f"   ✅ 已跳转到: {new_page}")
                else:
                    print("   ⚠️ 页面未变化，继续执行")

        except Exception as e:
            print(f"❌ 页面2失败: {e}")
            return False

        # 页面3: 输入邮箱验证码
        print("\n" + "="*60)
        print("🔢 页面3: 输入邮箱验证码")
        print("="*60)

        try:
            current_page = get_current_page(sb)
            print(f"   当前页面: {current_page}, URL: {sb.get_current_url()}")
            
            sb.wait_for_element_visible("[data-testid='email-verification-form-code-input'] input", timeout=15)
            
            # 获取验证码
            verification_code = mail_handler.get_verification_code(email, timeout=120, min_wait=10)
            if not verification_code:
                print("❌ 未能获取验证码")
                return False

            sb.type("[data-testid='email-verification-form-code-input'] input", verification_code)
            print(f"✅ 已输入验证码: {verification_code}")

            hide_cookie_banner(sb)
            
            for selector in continue_btn_selectors:
                try:
                    if sb.is_element_visible(selector):
                        sb.click(selector)
                        print("✅ 已点击'继续'")
                        break
                except:
                    continue
            
            sb.reconnect(3)
            
            if check_page_error(sb):
                print("❌ 验证码提交失败")
                return False
            
            new_page = wait_for_page_change(sb, current_page, timeout=20)
            if new_page:
                print(f"   ✅ 已跳转到: {new_page}")

        except Exception as e:
            print(f"❌ 页面3失败: {e}")
            return False

        # 页面4: 设置密码
        print("\n" + "="*60)
        print("🔐 页面4: 设置密码")
        print("="*60)

        try:
            current_page = get_current_page(sb)
            print(f"   当前页面: {current_page}, URL: {sb.get_current_url()}")
            
            # 等待页面完全加载
            sb.sleep(3)
            
            # 检查是否已跳过密码页
            if current_page == 'allow':
                print("ℹ️ 已在允许访问页面，跳过密码步骤")
            else:
                print("⏳ 等待密码输入框出现...")
                sb.wait_for_element_visible("input[type='password']", timeout=20)
                sb.sleep(2)
                
                # 检查密码框数量
                pwd_count = sb.execute_script("return document.querySelectorAll(\"input[type='password']\").length")
                print(f"   找到 {pwd_count} 个密码框")
                
                # 输入密码
                try:
                    first_pwd_id = sb.execute_script("return document.querySelectorAll(\"input[type='password']\")[0].id")
                    second_pwd_id = sb.execute_script("return document.querySelectorAll(\"input[type='password']\")[1].id") if pwd_count >= 2 else None
                    
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

                hide_cookie_banner(sb)
                sb.sleep(1)
                
                # 点击继续按钮
                for selector in continue_btn_selectors:
                    try:
                        if sb.is_element_visible(selector):
                            sb.click(selector)
                            print("✅ 已点击'继续'")
                            break
                    except:
                        continue
                
                sb.reconnect(3)
                
                if check_page_error(sb):
                    print("❌ 密码提交失败")
                    return False
                
                new_page = wait_for_page_change(sb, current_page, timeout=20)
                if new_page:
                    print(f"   ✅ 已跳转到: {new_page}")

        except Exception as e:
            print(f"❌ 页面4失败: {e}")
            return False

        # 页面5: 确认并继续（设备确认页）
        print("\n" + "="*60)
        print("✅ 页面5: 确认并继续")
        print("="*60)

        try:
            current_page = get_current_page(sb)
            print(f"   当前页面: {current_page}, URL: {sb.get_current_url()}")
            
            # 检查是否已跳过确认页
            if current_page == 'callback':
                print("ℹ️ 已完成授权，跳过确认步骤")
            elif current_page == 'confirm':
                sb.sleep(2)
                
                confirm_selectors = [
                    "button[type='submit']",
                    "button[class*='awsui_variant-primary']",
                ]
                
                for selector in confirm_selectors:
                    try:
                        if sb.is_element_visible(selector):
                            sb.click(selector)
                            print("✅ 已点击'确认并继续'")
                            break
                    except:
                        continue
                
                sb.reconnect(3)
                
                new_page = wait_for_page_change(sb, current_page, timeout=15)
                if new_page:
                    print(f"   ✅ 已跳转到: {new_page}")
            else:
                print(f"ℹ️ 当前不在确认页，跳过")

        except Exception as e:
            print(f"ℹ️  页面5处理: {e}")

        # 页面6: 允许访问
        print("\n" + "="*60)
        print("✅ 页面6: 允许访问")
        print("="*60)

        try:
            current_page = get_current_page(sb)
            print(f"   当前页面: {current_page}, URL: {sb.get_current_url()}")
            
            # 检查是否已完成
            if current_page == 'callback':
                print("ℹ️ 已完成授权")
            elif current_page == 'allow':
                sb.sleep(2)
                
                allow_selectors = [
                    "button[type='submit']",
                    "button[class*='awsui_variant-primary']",
                    "input[type='submit']"
                ]
                
                for selector in allow_selectors:
                    try:
                        if sb.is_element_visible(selector):
                            sb.click(selector)
                            print("✅ 已点击'允许访问'")
                            break
                    except:
                        continue
                
                sb.reconnect(3)
                
                new_page = wait_for_page_change(sb, current_page, timeout=15)
                if new_page:
                    print(f"   ✅ 已跳转到: {new_page}")
            else:
                print(f"ℹ️ 当前不在允许访问页，跳过")

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
        if mail_handler is not None:
            try:
                mail_handler.close()
            except:
                pass
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
    print(f"   保存格式: JSON")
    # 获取脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    json_file = os.path.join(script_dir, "registered_accounts.json")
    
    print(f"   保存文件: {json_file} (增量存储)")
    print("")

    # 检查已有账号数量
    existing_count = 0
    if os.path.exists(json_file):
        try:
            with open(json_file, 'r', encoding='utf-8') as f:
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
    print(f"📁 所有账号已保存到: {json_file}")
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
