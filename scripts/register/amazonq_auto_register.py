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

# 告诉 SeleniumBase 启用线程锁定（多线程并行必需）
if "-n" not in sys.argv:
    sys.argv.append("-n")

import requests
from seleniumbase import Driver

from gptmail_service import GPTMailHandler


# ========== 路径配置 ==========
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ACCOUNTS_FILE = os.path.join(SCRIPT_DIR, "accounts.json")
SCREENSHOT_DIR = os.path.join(SCRIPT_DIR, "screenshots")

# 确保截图目录存在
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# ========== User-Agent 池配置 ==========
# AWS SDK 版本（保持最新）
AWS_SDK_VERSIONS = [
    "1.4.1", "1.4.0", "1.3.9", "1.3.8", "1.3.7", "1.3.6", "1.3.5",
    "1.3.4", "1.3.3", "1.3.2", "1.3.1", "1.3.0", "1.2.16", "1.2.15"
]

# Rust 版本（保持最新稳定版）
RUST_VERSIONS = [
    "1.88.0", "1.87.0", "1.86.0", "1.85.0", "1.84.0",
    "1.83.0", "1.82.0", "1.81.0", "1.80.0", "1.79.0"
]

# 操作系统类型
OS_TYPES = ["windows", "macos", "linux"]

# SSO OIDC 版本
SSOOIDC_VERSIONS = [
    "1.89.0", "1.88.0", "1.87.0", "1.86.0", "1.85.0",
    "1.84.0", "1.83.0", "1.82.0", "1.81.0", "1.80.0"
]

# UA 模式标识
UA_MODE = ["m/E", "m/F", "m/D", "m/G", "m/H", "m/I"]

# 真实浏览器 User-Agent 池（用于 Selenium）
BROWSER_USER_AGENTS = [
    # Chrome Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    # Chrome macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    # Edge Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
]


def get_random_browser_ua():
    """获取随机浏览器 User-Agent"""
    return random.choice(BROWSER_USER_AGENTS)


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


def post_json(url: str, payload: Dict, retries: int = 3) -> requests.Response:
    """发送JSON POST请求，带重试"""
    payload_str = json.dumps(payload, ensure_ascii=False)
    headers = make_headers()
    
    for attempt in range(retries):
        try:
            return requests.post(url, headers=headers, data=payload_str, timeout=(30, 120))
        except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # 指数退避: 1s, 2s, 4s
                continue
            raise


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
HEADLESS_MODE = False  # 无头模式开关（建议关闭，否则可能收不到验证码）

# 全局锁（只有文件写入需要锁，API 调用可以并行）
file_lock = threading.Lock()


def set_headless_mode(enabled: bool):
    """设置无头模式"""
    global HEADLESS_MODE
    HEADLESS_MODE = enabled
    print(f"🖥️  无头模式: {'开启' if enabled else '关闭'}")


def check_page_error(sb):
    """检查页面是否有错误提示，返回 True 表示有错误"""
    try:
        # 检查 AWS 错误文本（语言无关）
        error_texts = [
            'error processing your request',
            'please try again',
            "it's not you, it's us",
            'something went wrong',
            'unable to process',
            'sorry, there was an error'
        ]
        
        try:
            page_text = sb.get_page_source().lower()
            for text in error_texts:
                if text in page_text:
                    print(f"   ❌ 检测到错误: {text}")
                    return True
        except:
            pass
        
        # 检查 AWS 错误提示元素
        error_selectors = [
            "[data-testid*='error-alert']",
            ".awsui_type-error",
            "[data-analytics-alert='error']",
            "[role='alert']"
        ]
        
        for selector in error_selectors:
            try:
                if sb.is_element_visible(selector):
                    print(f"   ❌ 页面出现错误提示")
                    return True
            except:
                continue
        
        return False
    except:
        return False


def get_current_page(sb):
    """
    通过 URL 判断当前所在页面
    返回: 'email', 'name', 'verification', 'password', 'confirm', 'allow', 'callback', 'error', 'unknown'
    
    URL 流程：
    0. 授权起始页: https://view.awsapps.com/start/#/device?user_code=XXXX-XXXX
    1. 邮箱页: https://us-east-1.signin.aws/platform/d-9067642ac7/login?workflowStateHandle=...
    2. 姓名页: https://profile.aws.amazon.com/?workflowID=...#/signup/enter-email
    3. 验证码页: https://profile.aws.amazon.com/?workflowID=...#/signup/verify-otp
    4. 密码页: https://us-east-1.signin.aws/platform/d-9067642ac7/signup?registrationCode=...
    5. 确认页: https://view.awsapps.com/start/#/device?user_code=XXXX-XXXX (密码成功后重定向回来)
    6. 允许页: https://view.awsapps.com/start/#/?clientId=...&clientType=...&deviceContextId=...
    """
    try:
        url = sb.current_url.lower()
        
        # 回调页面（最高优先级）
        if '127.0.0.1' in url and 'callback' in url:
            return 'callback'
        
        # Allow access / Confirm 页面（view.awsapps.com 域名）
        if 'view.awsapps.com' in url:
            return 'allow'
        
        # 密码页面（signin.aws 域名 + registrationCode 参数）
        if 'registrationcode=' in url:
            return 'password'
        
        # 邮箱页面：signin.aws 域名 + login 路径
        if 'signin.aws' in url and '/login' in url:
            return 'email'
        
        # profile.aws 域名下，通过 hash 区分姓名页和验证码页
        if 'profile.aws' in url:
            # 验证码页：hash 是 verify-otp
            if 'verify-otp' in url:
                return 'verification'
            # 姓名页：其他情况（包括 enter-email）
            return 'name'
        
        return 'unknown'
    except:
        return 'unknown'


def wait_for_page_change(sb, current_page, timeout=30):
    """
    等待页面变化（URL 变化）
    返回新页面类型，超时返回 None
    """
    start_time = time.time()
    last_url = sb.current_url
    stable_count = 0
    
    while time.time() - start_time < timeout:
        time.sleep(0.5)
        try:
            new_url = sb.current_url
            if new_url != last_url:
                print(f"   🔗 URL 变化: {new_url}")
                last_url = new_url
                stable_count = 0
            else:
                stable_count += 1
                # URL 稳定 2 秒后认为跳转完成
                if stable_count >= 4:
                    new_page = get_current_page(sb)
                    if new_page != current_page:
                        return new_page
        except:
            pass
    
    return None


def hide_cookie_banner(sb):
    """隐藏 cookie banner 和其他遮挡元素"""
    try:
        sb.execute_script("""
            var banners = document.querySelectorAll('[class*="cookie"], [class*="consent"], [id*="cookie"], [id*="consent"]');
            banners.forEach(function(el) { el.style.display = 'none'; });
            var overlays = document.querySelectorAll('[class*="overlay"], [class*="modal-backdrop"]');
            overlays.forEach(function(el) { el.style.display = 'none'; });
        """)
    except:
        pass



def save_account_to_file(email, password, client_id, client_secret, refresh_token, access_token, machine_id=None):
    """保存或更新账号信息到 JSON 文件 - 线程安全，按 email 去重"""
    try:
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
            if os.path.exists(ACCOUNTS_FILE):
                try:
                    with open(ACCOUNTS_FILE, 'r', encoding='utf-8') as f:
                        accounts = json.load(f)
                except:
                    accounts = []
            
            # 按 email 查找是否已存在
            found = False
            for i, a in enumerate(accounts):
                if a.get('email') == email:
                    # 更新现有记录（保留非空值）
                    if access_token:
                        accounts[i]['accessToken'] = access_token
                    if refresh_token:
                        accounts[i]['refreshToken'] = refresh_token
                    if machine_id:
                        accounts[i]['machineId'] = machine_id
                    found = True
                    break
            
            if not found:
                accounts.append(account)
            
            with open(ACCOUNTS_FILE, 'w', encoding='utf-8') as f:
                json.dump(accounts, f, ensure_ascii=False, indent=2)

        print(f"✅ 账号已保存到: {ACCOUNTS_FILE}")
        return ACCOUNTS_FILE

    except Exception as e:
        print(f"⚠️  保存失败: {e}")
        return None



def generate_machine_id():
    """生成新的机器 ID（UUID 格式）"""
    return str(uuid.uuid4()).lower()


def reset_system_machine_guid(new_guid):
    """
    重置系统机器码（需要管理员权限）
    返回 (success, error_message)
    """
    if sys.platform != 'win32':
        return False, "仅支持 Windows"
    
    try:
        import ctypes
        # 检查管理员权限
        if not ctypes.windll.shell32.IsUserAnAdmin():
            return False, "需要管理员权限"
        
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r"SOFTWARE\Microsoft\Cryptography",
            0,
            winreg.KEY_SET_VALUE | winreg.KEY_WOW64_64KEY
        )
        winreg.SetValueEx(key, "MachineGuid", 0, winreg.REG_SZ, new_guid)
        winreg.CloseKey(key)
        return True, None
    except Exception as e:
        return False, str(e)


def register_single_account(account_num, total_accounts, reset_machine_id=True):
    """
    注册单个 Amazon Q Developer 账号
    
    参数:
        account_num: 当前账号序号
        total_accounts: 总账号数
        reset_machine_id: 是否重置系统机器 ID（需要管理员权限，默认 True）
    """
    
    # 日志前缀
    tag = f"[W{account_num}]"
    def log(msg):
        print(f"{tag} {msg}")
    
    password_success = False  # 标记密码是否设置成功
    
    # 生成本次注册使用的机器 ID
    current_machine_id = generate_machine_id()
    
    log("")
    log("🎯" * 20)
    log(f"开始注册账号 {account_num}/{total_accounts}")
    log("🎯" * 20)
    
    # 重置系统机器 ID
    if reset_machine_id:
        log(f"🔧 重置系统机器 ID: {current_machine_id}")
        success, err = reset_system_machine_guid(current_machine_id)
        if success:
            log(f"✅ 系统机器 ID 已重置")
        else:
            log(f"⚠️ 重置失败: {err}（继续使用生成的 ID）")
    else:
        log(f"🆔 使用机器 ID: {current_machine_id}")
    log("🎯" * 20)

    # 步骤1: 自动创建 GPTMail 邮箱
    log("步骤1: 创建临时邮箱...")
    
    mail_handler = GPTMailHandler()
    email = mail_handler.generate_email()
    
    if not email:
        log("❌ 创建邮箱失败")
        return False
    
    log(f"✅ 邮箱: {email}")

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
    log(f"👤 用户名设置为: {username}")

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
    log(f"🔑 密码设置为: {password}")

    # 步骤2: 调用 AWS Device Authorization API
    log("=" * 60)
    log("🔑 调用 AWS Device Authorization API")
    log("=" * 60)

    try:
        log("⏳ 正在注册 OIDC 客户端...")
        client_id, client_secret = register_client_min()
        log("✅ 客户端注册成功")
        log(f"   Client ID: {client_id}")
        log(f"   Client Secret: {client_secret[:20]}...")

        log(f"\n⏳ [窗口 {account_num}] 正在获取设备授权...")
        device_auth = device_authorize(client_id, client_secret)

        device_code = device_auth.get('deviceCode')
        verification_uri_complete = device_auth.get('verificationUriComplete')
        user_code = device_auth.get('userCode')
        interval = device_auth.get('interval', 5)
        expires_in = device_auth.get('expiresIn', 600)

        log(f"✅ 设备授权成功")
        log(f"   授权链接: {verification_uri_complete}")
        log(f"   用户代码: {user_code}")
        log(f"   有效期: {expires_in} 秒")

    except Exception as e:
        log(f"❌ Device Authorization 失败: {e}")
        import traceback
        traceback.print_exc()
        return False

    # 步骤3: 启动浏览器并打开授权链接
    log("\n" + "="*60)
    log(f"🌐 启动独立浏览器会话（无缓存）")
    log("=" * 60)

    sb = None

    # 按钮选择器（按优先级排序）
    continue_btn_selectors = [
        "button[data-testid='test-primary-button']",  # 邮箱页 Continue
        "button[data-testid='signup-next-button']",   # 姓名页 Continue
        "button[data-testid='email-verification-verify-button']",  # 验证码页
        "button.awsui_variant-primary_vjswe_19dg5_235",  # 主按钮 class
        "button[type='submit']",  # 通用 submit
    ]

    # 在 try 块外初始化临时目录变量
    temp_user_data = None
    
    try:
        log(f"⏳ 正在启动浏览器...")
        browser_ua = get_random_browser_ua()
        log(f"   🌐 使用 UA: {browser_ua}...")
        
        # 使用 Driver 类（UC 模式反检测配置）
        # 参考官方文档: https://github.com/seleniumbase/seleniumbase/blob/master/help_docs/uc_mode.md
        # 使用 chromium_arg 强制启用无痕模式
        sb = Driver(
            uc=True,                    # 启用 undetected-chromedriver
            uc_subprocess=True,         # 子进程模式（多线程必需）
            uc_cdp_events=True,         # 启用 CDP 事件捕获
            headless2=HEADLESS_MODE,    # 新版无头模式（支持扩展）
            agent=browser_ua,           # 随机 User-Agent
            locale_code="en",           # 语言设置
            ad_block_on=True,           # 广告拦截
            do_not_track=True,          # DNT 头
            disable_csp=True,           # 禁用 CSP
            page_load_strategy="eager", # 快速加载（不等待所有资源）
            chromium_arg="--incognito,--disable-extensions",  # 强制无痕模式
        )
        log(f"✅ 浏览器启动成功 ({'无头模式' if HEADLESS_MODE else '有头模式'})")

        log(f"⏳ 正在打开授权链接...")
        sb.uc_open_with_reconnect(verification_uri_complete, reconnect_time=4)
        log(f"   🔗 初始页面: {sb.current_url}")
        sb.uc_gui_click_captcha()  # 自动处理 CF 验证

        # 等待重定向到邮箱输入页（view.awsapps.com → signin.aws）
        log("⏳ 等待重定向...")
        last_url = sb.current_url
        for _ in range(45):  # 最多等 45 秒
            current_url = sb.current_url
            if current_url != last_url:
                log(f"   🔗 重定向到: {current_url}")
                last_url = current_url
            current_page = get_current_page(sb)
            if current_page == 'email':
                break
            time.sleep(1)

        # 页面1: 输入邮箱
        log("\n📧 页面1: 输入邮箱")
        max_retries = 2
        for retry in range(max_retries):
            try:
                # 1. 确认当前页面（通过 URL）
                current_page = get_current_page(sb)
                log(f"   当前页面: {current_page}, URL: {sb.current_url}")
                
                if check_page_error(sb):
                    log("❌ AWS 服务端错误")
                    sb.save_screenshot(os.path.join(SCREENSHOT_DIR, "error_page1_blocked.png"))
                    return False
                
                # 2. 等待页面加载完成（增加超时时间）
                sb.wait_for_element_visible("input[placeholder='username@example.com']", timeout=20)
                sb.type("input[placeholder='username@example.com']", email)
                log(f"✅ 已输入邮箱: {email}")

                hide_cookie_banner(sb)
                
                # 点击继续按钮
                for selector in continue_btn_selectors:
                    if sb.is_element_visible(selector):
                        sb.uc_click(selector, reconnect_time=3)
                        log("✅ 已点击'继续'")
                        break
                
                sb.uc_gui_click_captcha()
                
                if check_page_error(sb):
                    log("❌ 邮箱提交失败")
                    sb.save_screenshot(os.path.join(SCREENSHOT_DIR, "error_page1_rejected.png"))
                    return False
                
                # 4. 等待页面跳转到姓名页
                new_page = wait_for_page_change(sb, 'email', timeout=15)
                if new_page:
                    log(f"   ✅ 已跳转到: {new_page}")
                break  # 成功，跳出重试循环

            except Exception as e:
                if retry < max_retries - 1:
                    log(f"⚠️ 页面1失败: {e}，刷新重试...")
                    sb.refresh()
                    time.sleep(3)
                    sb.uc_gui_click_captcha()
                else:
                    log(f"❌ 页面1失败: {e}")
                    return False

        # 页面2: 输入用户名
        log("\n" + "="*60)
        log("👤 页面2: 输入用户名")
        log("=" * 60)

        try:
            # 1. 确认当前页面（通过 URL）
            current_page = get_current_page(sb)
            log(f"   当前页面: {current_page}, URL: {sb.current_url}")
            
            # 如果已经跳过姓名页（直接到验证码页），跳过此步骤
            if current_page == 'verification':
                log("ℹ️ 已在验证码页面，跳过姓名步骤")
            else:
                # 2. 等待页面加载完成
                # 等待用户名输入框（使用 data-testid 更可靠）
                sb.wait_for_element_visible("[data-testid='signup-full-name-input'] input", timeout=10)
                sb.type("[data-testid='signup-full-name-input'] input", username)
                log(f"✅ 已输入用户名: {username}")

                hide_cookie_banner(sb)
                
                for selector in continue_btn_selectors:
                    if sb.is_element_visible(selector):
                        sb.uc_click(selector, reconnect_time=3)
                        log("✅ 已点击'继续'")
                        break
                
                sb.uc_gui_click_captcha()
                
                if check_page_error(sb):
                    log("❌ 用户名提交失败")
                    sb.save_screenshot(os.path.join(SCREENSHOT_DIR, "error_page2_rejected.png"))
                    return False
                
                # 4. 等待页面跳转到验证码页
                new_page = wait_for_page_change(sb, current_page, timeout=20)
                if new_page:
                    log(f"   ✅ 已跳转到: {new_page}")

        except Exception as e:
            log(f"❌ 页面2失败: {e}")
            return False

        # 页面3: 输入邮箱验证码
        log("\n🔢 页面3: 输入邮箱验证码")
        try:
            # 1. 确认当前页面（通过 URL）
            current_page = get_current_page(sb)
            log(f"   当前页面: {current_page}, URL: {sb.current_url}")
            
            # 验证是否在验证码页面
            if current_page != 'verification':
                log(f"   ⚠️ 期望在验证码页面，实际在: {current_page}")
            
            # 2. 等待页面加载完成
            # 等待验证码输入框
            sb.wait_for_element_visible("[data-testid='email-verification-form-code-input'] input", timeout=15)
            
            # 获取验证码
            verification_code = mail_handler.get_verification_code(email, timeout=100)
            if not verification_code:
                log("❌ 未能获取验证码")
                return False

            sb.type("[data-testid='email-verification-form-code-input'] input", verification_code)
            log(f"✅ 已输入验证码: {verification_code}")

            hide_cookie_banner(sb)
            
            for selector in continue_btn_selectors:
                if sb.is_element_visible(selector):
                    sb.uc_click(selector, reconnect_time=3)
                    log("✅ 已点击'继续'")
                    break
            
            sb.uc_gui_click_captcha()
            
            if check_page_error(sb):
                log("❌ 验证码提交失败")
                sb.save_screenshot(os.path.join(SCREENSHOT_DIR, "error_page3_rejected.png"))
                return False
            
            # 4. 等待页面跳转到密码页（URL 中有 registrationCode=）
            new_page = wait_for_page_change(sb, current_page, timeout=20)
            if new_page:
                log(f"   ✅ 已跳转到: {new_page}")

        except Exception as e:
            log(f"❌ 页面3失败: {e}")
            return False

        # 页面4: 设置密码
        log("\n🔐 页面4: 设置密码")
        try:
            # 1. 确认当前页面（通过 URL，应该有 registrationCode=）
            current_page = get_current_page(sb)
            log(f"   当前页面: {current_page}, URL: {sb.current_url}")
            
            # 验证是否在密码页面
            if current_page != 'password':
                log(f"   ⚠️ 期望在密码页面，实际在: {current_page}")
            
            # 2. 等待页面加载完成
            # 等待密码输入框
            sb.wait_for_element_visible("[data-testid='test-input'] input", timeout=15)
            
            # 输入密码
            sb.type("[data-testid='test-input'] input", password)
            
            # 输入确认密码
            if sb.is_element_visible("[data-testid='test-retype-input'] input"):
                sb.type("[data-testid='test-retype-input'] input", password)
            
            log(f"✅ 密码输入完成")

            hide_cookie_banner(sb)
            
            for selector in continue_btn_selectors:
                if sb.is_element_visible(selector):
                    sb.uc_click(selector, reconnect_time=3)
                    log("✅ 已点击'继续'")
                    break
            
            sb.uc_gui_click_captcha()
            
            if check_page_error(sb):
                log("❌ 密码设置失败")
                sb.save_screenshot(os.path.join(SCREENSHOT_DIR, "error_page4_rejected.png"))
                return False
            
            # 4. 等待页面跳转到 allow 页面（view.awsapps.com）
            new_page = wait_for_page_change(sb, current_page, timeout=20)
            if new_page:
                log(f"✅ 已跳转到: {new_page}")
                # 密码设置成功，先保存基本信息（无 token）
                log("🎉 密码设置成功！")
                save_account_to_file(email, password, client_id, client_secret, None, None, current_machine_id)
                password_success = True  # 标记密码设置成功

        except Exception as e:
            log(f"❌ 页面4失败: {e}")
            return False

        # 页面5+6: 确认并继续 + 允许访问（都在 view.awsapps.com）
        allow_selectors = [
            "#cli_verification_btn",
            "button[data-testid='allow-access-button']",
            "button[data-analytics='accept-user-code']",
            "button.awsui_variant-primary_vjswe_1hxdq_235",
            "button[type='submit']"
        ]
        
        max_poll_retries = 5
        for poll_attempt in range(max_poll_retries):
            if poll_attempt > 0:
                log(f"\n🔄 第 {poll_attempt + 1} 次重试轮询...")
            
            # 页面5: 确认并继续
            log("\n✅ 页面5: 确认并继续")
            try:
                # 1. 确认当前页面（通过 URL，应该是 view.awsapps.com）
                current_page = get_current_page(sb)
                log(f"   当前页面: {current_page}, URL: {sb.current_url}")
                
                # 2. 等待页面加载完成
                # 等待并点击按钮
                for selector in allow_selectors:
                    if sb.is_element_visible(selector):
                        sb.uc_click(selector, reconnect_time=3)
                        log("✅ 已点击'确认并继续'")
                        break
                
                # 4. 等待页面变化
                new_page = wait_for_page_change(sb, current_page, timeout=10)
                if new_page:
                    log(f"   ✅ 已跳转到: {new_page}")
                    
            except Exception as e:
                log(f"ℹ️  页面5: {e}")

            # 页面6: 允许访问
            log("\n✅ 页面6: 允许访问")
            try:
                # 1. 确认当前页面
                current_page = get_current_page(sb)
                log(f"   当前页面: {current_page}, URL: {sb.current_url}")
                
                # 如果已经到 callback，跳过
                if current_page == 'callback':
                    log("✅ 已重定向到 callback!")
                    break
                
                # 2. 等待页面加载完成
                # 等待并点击按钮
                for selector in allow_selectors:
                    if sb.is_element_visible(selector):
                        sb.uc_click(selector, reconnect_time=3)
                        log("✅ 已点击'允许访问'")
                        break

            except Exception as e:
                log(f"ℹ️  页面6处理: {e}")

            # 轮询获取 tokens
            log("\n" + "="*60)
            log("🔄 等待授权完成并获取 Tokens")
            log("=" * 60)

            log("⏳ 正在轮询获取 tokens...")
            poll_timeout = 60  # 每次轮询 60 秒
            log(f"   本次轮询超时: {poll_timeout} 秒")

            try:
                payload = {
                    "clientId": client_id,
                    "clientSecret": client_secret,
                    "deviceCode": device_code,
                    "grantType": "urn:ietf:params:oauth:grant-type:device_code",
                }
                
                deadline = time.time() + poll_timeout
                poll_interval = max(1, int(interval or 5))
                tokens = None
                
                while time.time() < deadline:
                    r = post_json(TOKEN_URL, payload)
                    if r.status_code == 200:
                        tokens = r.json()
                        break
                        
                    if r.status_code == 400:
                        try:
                            err = r.json()
                        except:
                            err = {"error": r.text}
                        
                        if str(err.get("error")) == "authorization_pending":
                            time.sleep(poll_interval)
                            continue
                        r.raise_for_status()
                    r.raise_for_status()
                
                if tokens:
                    access_token = tokens.get('accessToken')
                    refresh_token = tokens.get('refreshToken')

                    if access_token and refresh_token:
                        log("\n" + "🎉"*30)
                        log("🎉 账号注册成功！")
                        log("🎉" * 20)
                        log(f"\n📧 邮箱: {email}")
                        log(f"🔑 密码: {password}")
                        log(f"🆔 机器 ID: {current_machine_id}")
                        log(f"\n🔐 Client ID: {client_id}")
                        log(f"🔐 Client Secret: {client_secret[:20]}...")
                        log(f"🔐 Access Token: {access_token[:50]}...")
                        log(f"🔄 Refresh Token: {refresh_token[:50]}...")

                        # 更新 token（machineId 已在第一次保存时存入）
                        save_account_to_file(email, password, client_id, client_secret, refresh_token, access_token)

                        log("\n✅ 浏览器会话即将关闭...")
                        return True
                    else:
                        log("❌ Token 数据不完整")
                else:
                    log(f"   ⚠️ 轮询超时，准备重试...")
                    continue

            except Exception as e:
                log(f"   ⚠️ 轮询出错: {e}")
                continue
        
        # token 轮询失败，但密码已成功
        if password_success:
            log("⚠️ Token 轮询超时，但账号已保存（无 token）")
            return True
        
        log("❌ 授权超时，已重试 3 次")
        return False

    except Exception as e:
        log(f"❌ 注册过程出错: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        if sb is not None:
            try:
                sb.quit()
                log("✅ 浏览器已关闭")
            except:
                pass



if __name__ == "__main__":
    # 直接启动 GUI
    from register_gui import main as gui_main
    gui_main()