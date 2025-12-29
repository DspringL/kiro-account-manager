#!/usr/bin/env python3
# 从 register/accounts.json 批量导入已注册账号到 kiro-account-manager

import json
import os
import hashlib
import httpx
import uuid
import asyncio
from datetime import datetime, timedelta

# 请求超时设置（秒）
REQUEST_TIMEOUT = 15


def generate_machine_id():
    """生成新的机器 ID（UUID 格式）"""
    return str(uuid.uuid4()).lower()


def reset_system_machine_guid(new_guid):
    """
    重置系统机器码（需要管理员权限）
    返回 (success, error_message)
    """
    import sys
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


async def refresh_token_idc(client, refresh_token, client_id, client_secret, region='us-east-1'):
    """调用 AWS SSO OIDC API 刷新 token"""
    url = f'https://oidc.{region}.amazonaws.com/token'
    body = {
        'clientId': client_id,
        'clientSecret': client_secret,
        'grantType': 'refresh_token',
        'refreshToken': refresh_token
    }
    
    try:
        resp = await client.post(url, json=body, headers={'Content-Type': 'application/json'})
    except httpx.TimeoutException:
        return None, '请求超时'
    except httpx.RequestError as e:
        return None, f'网络错误'
    
    if resp.status_code != 200:
        return None, f'刷新失败: {resp.status_code}'
    
    return resp.json(), None


async def get_usage_limits(client, access_token, machine_id):
    """调用 CodeWhisperer API 获取 usage，使用指定的 machine_id"""
    url = 'https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&resourceType=AGENTIC_REQUEST'
    
    kiro_version = '0.6.18'
    headers = {
        'Authorization': f'Bearer {access_token}',
        'x-amz-user-agent': f'aws-sdk-js/1.0.0 KiroIDE-{kiro_version}-{machine_id}',
        'user-agent': f'aws-sdk-js/1.0.0 ua/2.1 os/windows lang/js md/nodejs#20.16.0 api/codewhispererruntime#1.0.0 m/E KiroIDE-{kiro_version}-{machine_id}',
        'amz-sdk-invocation-id': str(uuid.uuid4()),
        'amz-sdk-request': 'attempt=1; max=1',
    }
    
    try:
        resp = await client.get(url, headers=headers)
    except httpx.TimeoutException:
        return None, 'timeout'
    except httpx.RequestError:
        return None, 'network_error'
    
    if resp.status_code == 403:
        return None, 'banned'
    if resp.status_code == 401:
        return None, 'expired'
    if resp.status_code != 200:
        return None, 'error'
    
    return resp.json(), None


def compute_client_id_hash(start_url='https://view.awsapps.com/start'):
    return hashlib.sha256(start_url.encode()).hexdigest()


async def process_account(client, account_data):
    """处理单个账号数据，返回转换后的账号对象"""
    refresh_token = account_data.get('refreshToken')
    client_id = account_data.get('clientId')
    client_secret = account_data.get('clientSecret')
    region = account_data.get('region', 'us-east-1')
    email = account_data.get('email', 'unknown@kiro.dev')
    access_token = account_data.get('accessToken')
    
    if not all([refresh_token, client_id, client_secret]):
        return None, '缺少必要字段'
    
    new_refresh_token = refresh_token
    expires_in = 3600
    
    # 优先用现有 accessToken
    if access_token:
        usage, status = await get_usage_limits(client, access_token)
        if status == 'expired':
            token_result, err = await refresh_token_idc(client, refresh_token, client_id, client_secret, region)
            if err:
                return None, err
            access_token = token_result['accessToken']
            new_refresh_token = token_result['refreshToken']
            expires_in = token_result['expiresIn']
            usage, status = await get_usage_limits(client, access_token)
    else:
        token_result, err = await refresh_token_idc(client, refresh_token, client_id, client_secret, region)
        if err:
            return None, err
        access_token = token_result['accessToken']
        new_refresh_token = token_result['refreshToken']
        expires_in = token_result['expiresIn']
        usage, status = await get_usage_limits(client, access_token)
    
    is_banned = status == 'banned'
    
    user_id = None
    if usage:
        user_info = usage.get('userInfo', {})
        email = user_info.get('email', email)
        user_id = user_info.get('userId')
    
    expires_at = datetime.now() + timedelta(seconds=expires_in)
    client_id_hash = compute_client_id_hash()
    
    account = {
        'id': str(uuid.uuid4()),
        'email': email,
        'label': 'Kiro BuilderId 账号',
        'status': 'banned' if is_banned else 'active',
        'addedAt': datetime.now().strftime('%Y/%m/%d %H:%M:%S'),
        'accessToken': access_token,
        'refreshToken': new_refresh_token,
        'csrfToken': None,
        'sessionToken': None,
        'expiresAt': expires_at.strftime('%Y/%m/%d %H:%M:%S'),
        'provider': 'BuilderId',
        'userId': user_id,
        'clientId': client_id,
        'clientSecret': client_secret,
        'region': region,
        'clientIdHash': client_id_hash,
        'ssoSessionId': None,
        'idToken': None,
        'profileArn': None,
        'usageData': usage
    }
    
    return account, None


async def process_one(client, idx, total, account_data, stats):
    """处理单个账号（异步任务）"""
    email = account_data.get('email', 'unknown')
    
    account, err = await process_account(client, account_data)
    
    stats['done'] += 1
    done = stats['done']
    
    if err:
        print(f'[{done}/{total}] ❌ {email}: {err}')
        stats['failed'] += 1
        return None
    
    print(f'[{done}/{total}] ✅ {email}')
    return account

async def async_main(max_workers=10):
    """异步批量导入"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    source_file = os.path.join(script_dir, 'accounts.json')
    accounts_file = os.path.join(os.environ['APPDATA'], '.kiro-account-manager', 'accounts.json')
    
    if not os.path.exists(source_file):
        print(f'❌ 源文件不存在: {source_file}')
        return
    
    with open(source_file, 'r', encoding='utf-8') as f:
        source_accounts = json.load(f)
    
    total = len(source_accounts)
    if total == 0:
        print('没有待导入的账号')
        return
    
    print(f'读取到 {total} 个账号，并发数: {max_workers}')
    
    existing_accounts = []
    if os.path.exists(accounts_file):
        with open(accounts_file, 'r', encoding='utf-8') as f:
            existing_accounts = json.load(f)
    
    existing_client_ids = {a.get('clientId') for a in existing_accounts if a.get('clientId')}
    
    stats = {'done': 0, 'failed': 0}
    
    # 使用信号量限制并发数
    semaphore = asyncio.Semaphore(max_workers)
    
    async def limited_process(client, idx, acc):
        async with semaphore:
            return await process_one(client, idx, total, acc, stats)
    
    # httpx 异步客户端，连接池复用
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        tasks = [limited_process(client, i, acc) for i, acc in enumerate(source_accounts)]
        results = await asyncio.gather(*tasks)
    
    # 合并结果
    added = 0
    updated = 0
    
    for account in results:
        if account is None:
            continue
        if account['clientId'] in existing_client_ids:
            for j, a in enumerate(existing_accounts):
                if a.get('clientId') == account['clientId']:
                    account['id'] = a['id']
                    existing_accounts[j] = account
                    updated += 1
                    break
        else:
            existing_accounts.insert(0, account)
            existing_client_ids.add(account['clientId'])
            added += 1
    
    os.makedirs(os.path.dirname(accounts_file), exist_ok=True)
    with open(accounts_file, 'w', encoding='utf-8') as f:
        json.dump(existing_accounts, f, ensure_ascii=False, indent=2)
    
    print()
    print(f'完成! 添加: {added}, 更新: {updated}, 失败: {stats["failed"]}')
    print(f'总账号数: {len(existing_accounts)}')
    
    if added > 0 or updated > 0:
        with open(source_file, 'w', encoding='utf-8') as f:
            json.dump([], f)
        print(f'✅ 已清理源文件: {source_file}')

def main(max_workers=10):
    """同步入口，供 GUI 调用"""
    asyncio.run(async_main(max_workers))

if __name__ == '__main__':
    main()
