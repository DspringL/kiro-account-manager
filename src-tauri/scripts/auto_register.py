#!/usr/bin/env python3
"""
AWS Builder ID 自动注册脚本 (使用 Camoufox)
流程：
  1. 创建临时邮箱（30s超时）
  2. 启动浏览器到注册页面（30s超时）
  3. 输入邮箱点击继续
  4. 输入姓名页面（30s超时）
  5. 输入姓名点击继续
  6. 循环获取邮箱验证码（最多10次，每次5s）
  7. 输入验证码点击继续
  8. 输入密码界面（30s超时）
  9. 输入两次密码点击继续，等待SSO Token（30s超时）
"""

import sys
import json
import asyncio
import random
import requests
import time

try:
    from camoufox.async_api import AsyncCamoufox
    CAMOUFOX_AVAILABLE = True
except ImportError:
    CAMOUFOX_AVAILABLE = False

def log(message: str, email: str = ""):
    from datetime import datetime
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    print(json.dumps({"type": "log", "email": "", "message": f"[{ts}] {message}"}), flush=True)

def fail(error: str):
    print(json.dumps({"type": "result", "data": {"success": False, "error": error}}), flush=True)
    sys.exit(0)

def success(data: dict):
    print(json.dumps({"type": "result", "data": data}), flush=True)
    sys.exit(0)

FIRST_NAMES = ['James','Robert','John','Michael','David','William','Richard',
               'Maria','Elizabeth','Jennifer','Linda','Barbara','Susan','Jessica',
               'Sarah','Karen','Nancy','Lisa','Betty','Margaret']
LAST_NAMES  = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller',
               'Davis','Rodriguez','Martinez','Wilson','Anderson','Thomas',
               'Taylor','Moore','Jackson','Martin','Lee','Thompson','White']

def random_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

# ─── 步骤1：创建临时邮箱 ────────────────────────────────────────────────────

def create_tempmail(api_url: str, admin_password: str, timeout_sec: int = 30):
    log("步骤1: 创建临时邮箱...")
    name = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=12))
    url = f"{api_url.rstrip('/')}/admin/new_address"
    headers = {"x-admin-auth": admin_password, "Content-Type": "application/json"}
    try:
        resp = requests.post(url, headers=headers, json={"enablePrefix": False, "name": name},
                             timeout=timeout_sec)
        if resp.status_code == 200:
            data = resp.json()
            addr = data.get('address')
            jwt  = data.get('jwt')
            aid  = data.get('address_id')
            log(f"✓ 临时邮箱创建成功: {addr}")
            return addr, jwt, aid
        else:
            fail(f"创建临时邮箱失败，状态码: {resp.status_code}")
    except Exception as e:
        fail(f"创建临时邮箱超时或异常: {e}")

def delete_tempmail(api_url: str, admin_password: str, address_id):
    try:
        url = f"{api_url.rstrip('/')}/admin/delete_address/{address_id}"
        requests.delete(url, headers={"x-admin-auth": admin_password}, timeout=10)
        log("✓ 临时邮箱已清理")
    except:
        pass

# ─── 步骤6：轮询验证码（最多10次，每次5s）────────────────────────────────────

def poll_verification_code(api_url: str, jwt: str, email: str, max_tries: int = 10, interval: int = 5):
    import re
    log(f"步骤6: 开始轮询验证码（最多 {max_tries} 次，每次等待 {interval}s）...", email)
    headers = {"Authorization": f"Bearer {jwt}"}
    url = f"{api_url.rstrip('/')}/api/mails?limit=20&offset=0"

    for attempt in range(1, max_tries + 1):
        log(f"  轮询 #{attempt}/{max_tries}...", email)
        try:
            resp = requests.get(url, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                messages = data.get("results", [])
                log(f"  收件箱共 {len(messages)} 封邮件", email)
                for mail in messages:
                    raw = mail.get("raw", "")
                    source = mail.get("source", "")
                    if any(x in source.lower() for x in ["signin.aws", "awsapps.com", "amazonses.com", "amazon.com"]):
                        patterns = [
                            r'verification code is[:\s]*(\d{6})',
                            r'Your code is[:\s]*(\d{6})',
                            r'code is[:\s]*(\d{6})',
                            r'>\s*(\d{6})\s*<',
                            r'\b(\d{6})\b',
                        ]
                        for pat in patterns:
                            m = re.search(pat, raw, re.IGNORECASE)
                            if m:
                                code = m.group(1)
                                log(f"✓ 获取到验证码: {code}", email)
                                return code
                        log("  ⚠ 收到 AWS 邮件但未提取到验证码", email)
                    else:
                        log(f"  非 AWS 邮件，来源: {source}", email)
            else:
                log(f"  轮询失败，状态码: {resp.status_code}", email)
        except Exception as e:
            log(f"  轮询异常: {e}", email)

        if attempt < max_tries:
            log(f"  未找到验证码，{interval} 秒后重试...", email)
            time.sleep(interval)

    return None  # 10次都没拿到

# ─── 主注册流程 ──────────────────────────────────────────────────────────────

async def register_aws(email: str, jwt: str, address_id, api_url: str, admin_password: str,
                       proxy_url: str = None, account_password: str = None):
    if not CAMOUFOX_AVAILABLE:
        fail("Camoufox 未安装，请运行: pip install camoufox && python -m camoufox fetch")

    password = account_password if account_password else "Alisi1976230!"
    name = random_name()
    log(f"使用姓名: {name}，密码: {'自定义' if account_password else '默认'}", email)

    browser_args = {'headless': False}
    if proxy_url:
        browser_args['proxy'] = {'server': proxy_url}
        log(f"使用代理: {proxy_url}", email)

    try:
        async with AsyncCamoufox(**browser_args) as browser:
            page = await browser.new_page()

            # ── 步骤2：打开注册页面（30s超时）──────────────────────────────
            log("步骤2: 启动浏览器，打开注册页面...", email)
            try:
                await asyncio.wait_for(
                    page.goto('https://view.awsapps.com/start/#/device?user_code=PQCF-FCCN'),
                    timeout=30
                )
                log("✓ 注册页面已加载", email)
            except asyncio.TimeoutError:
                delete_tempmail(api_url, admin_password, address_id)
                fail("步骤2失败: 打开注册页面超时（30s）")

            await asyncio.sleep(2)

            # ── 步骤3：输入邮箱点击继续 ─────────────────────────────────────
            log("步骤3: 输入邮箱...", email)
            try:
                await asyncio.wait_for(
                    page.wait_for_selector('input[placeholder="username@example.com"]'),
                    timeout=30
                )
                await page.fill('input[placeholder="username@example.com"]', email)
                await page.click('button[data-testid="test-primary-button"]')
                log("✓ 邮箱已输入，点击继续", email)
            except asyncio.TimeoutError:
                delete_tempmail(api_url, admin_password, address_id)
                fail("步骤3失败: 邮箱输入框未出现（30s）")
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤3失败: {e}")

            await asyncio.sleep(2)

            # ── 步骤4：等待姓名输入页面（30s超时）──────────────────────────
            log("步骤4: 等待姓名输入页面...", email)
            name_selector = 'input[placeholder="Maria José Silva"]'
            try:
                await asyncio.wait_for(
                    page.wait_for_selector(name_selector),
                    timeout=30
                )
                log("✓ 姓名输入页面已出现", email)
            except asyncio.TimeoutError:
                delete_tempmail(api_url, admin_password, address_id)
                fail("步骤4失败: 姓名输入页面未出现（30s）")

            # ── 步骤5：输入姓名点击继续 ─────────────────────────────────────
            log(f"步骤5: 输入姓名 {name}...", email)
            try:
                await page.fill(name_selector, name)
                await page.click('button[data-testid="signup-next-button"]')
                log("✓ 姓名已输入，点击继续", email)
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤5失败: {e}")

            await asyncio.sleep(2)

            # ── 等待验证码输入框出现（并发检测多个选择器）──────────────────
            log("等待验证码输入框出现（确认邮件已发送）...", email)
            code_selectors = [
                'input[placeholder="6 位数"]',
                'input[placeholder="6-digit"]',
                'input[data-testid*="code"]',
            ]
            code_selector = None
            try:
                # 并发等待所有选择器，任意一个出现即可
                tasks = [
                    asyncio.ensure_future(page.wait_for_selector(sel, timeout=30000))
                    for sel in code_selectors
                ]
                done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                # 取消未完成的任务
                for t in pending:
                    t.cancel()
                # 找到对应的选择器
                for i, task in enumerate(tasks):
                    if task in done and not task.exception():
                        code_selector = code_selectors[i]
                        log(f"✓ 验证码输入框已出现 (选择器: {code_selector})", email)
                        break
            except Exception as e:
                log(f"等待验证码输入框异常: {e}", email)

            if not code_selector:
                delete_tempmail(api_url, admin_password, address_id)
                fail("等待验证码输入框超时（30s），邮件可能未发送")

            # ── 步骤6：轮询获取验证码（最多10次）───────────────────────────
            code = poll_verification_code(api_url, jwt, email, max_tries=10, interval=5)
            if not code:
                delete_tempmail(api_url, admin_password, address_id)
                fail("步骤6失败: 10次轮询未获取到验证码")

            # ── 步骤7：输入验证码点击继续 ───────────────────────────────────
            log(f"步骤7: 输入验证码 {code}...", email)
            try:
                await page.fill(code_selector, code)
                await page.click('button[data-testid="email-verification-verify-button"]')
                log("✓ 验证码已输入，点击继续", email)
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤7失败: {e}")

            await asyncio.sleep(2)

            # ── 步骤8：等待密码输入界面（30s超时）──────────────────────────
            log("步骤8: 等待密码输入界面...", email)
            pwd_selector = None
            for sel in ['input[placeholder="Enter password"]', 'input[type="password"]']:
                try:
                    await asyncio.wait_for(page.wait_for_selector(sel), timeout=30)
                    pwd_selector = sel
                    log("✓ 密码输入界面已出现", email)
                    break
                except asyncio.TimeoutError:
                    continue

            if not pwd_selector:
                delete_tempmail(api_url, admin_password, address_id)
                fail("步骤8失败: 密码输入界面未出现（30s），验证码可能错误")

            # ── 步骤9：输入两次密码，等待SSO Token（30s超时）───────────────
            log(f"步骤9: 输入密码...", email)
            try:
                await page.fill(pwd_selector, password)
                # 确认密码
                confirm_sel = 'input[placeholder="Re-enter password"]'
                try:
                    await asyncio.wait_for(page.wait_for_selector(confirm_sel), timeout=5)
                    await page.fill(confirm_sel, password)
                except asyncio.TimeoutError:
                    # 尝试第二个 password 输入框
                    inputs = await page.query_selector_all('input[type="password"]')
                    if len(inputs) >= 2:
                        await inputs[1].fill(password)
                        log("✓ 使用第二个密码框输入确认密码", email)

                await page.click('button[data-testid="test-primary-button"]')
                log("✓ 密码已输入，点击继续", email)
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤9失败（输入密码）: {e}")

            # 等待 SSO Token（30s超时）
            log("等待 SSO Token（最多30s）...", email)
            sso_token = None
            deadline = asyncio.get_event_loop().time() + 30
            while asyncio.get_event_loop().time() < deadline:
                cookies = await page.context.cookies()
                for c in cookies:
                    if c['name'] == 'x-amz-sso_authn':
                        sso_token = c['value']
                        break
                if sso_token:
                    log(f"✓ 获取到 SSO Token（长度: {len(sso_token)}）", email)
                    break
                await asyncio.sleep(1)

            delete_tempmail(api_url, admin_password, address_id)

            if not sso_token:
                fail("步骤9失败: 30s内未获取到 SSO Token")

            log("========== 注册成功！==========", email)
            success({
                "success": True,
                "sso_token": sso_token,
                "email": email,
                "name": name,
            })

    except SystemExit:
        raise
    except Exception as e:
        delete_tempmail(api_url, admin_password, address_id)
        fail(f"注册异常: {e}")


async def main():
    try:
        input_data = json.loads(sys.stdin.read())
    except Exception as e:
        fail(f"解析输入参数失败: {e}")

    api_url        = input_data.get("api_url", "")
    admin_password = input_data.get("admin_password", "")
    proxy_url      = input_data.get("proxy_url")
    account_password = input_data.get("account_password")

    if not api_url or not admin_password:
        fail("缺少必需参数: api_url 或 admin_password")

    # 步骤1：创建临时邮箱
    email, jwt, address_id = create_tempmail(api_url, admin_password)

    # 步骤2-9：浏览器注册流程
    await register_aws(email, jwt, address_id, api_url, admin_password, proxy_url, account_password)


if __name__ == "__main__":
    asyncio.run(main())
