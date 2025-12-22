#!/usr/bin/env python3
# 批量导入 IdC 账号到 kiro-account-manager

import json
import os
import hashlib
import requests
import uuid
from datetime import datetime, timedelta

def get_machine_id():
    """获取 Windows MachineGuid"""
    import winreg
    try:
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Cryptography')
        value, _ = winreg.QueryValueEx(key, 'MachineGuid')
        winreg.CloseKey(key)
        return value
    except:
        return 'unknown-machine-id'

def refresh_token_idc(refresh_token, client_id, client_secret, region='us-east-1'):
    """调用 AWS SSO OIDC API 刷新 token"""
    url = f'https://oidc.{region}.amazonaws.com/token'
    body = {
        'clientId': client_id,
        'clientSecret': client_secret,
        'grantType': 'refresh_token',
        'refreshToken': refresh_token
    }
    
    resp = requests.post(url, json=body, headers={'Content-Type': 'application/json'})
    
    if resp.status_code != 200:
        return None, f'刷新失败: {resp.status_code} - {resp.text[:100]}'
    
    return resp.json(), None

def get_usage_limits(access_token, machine_id):
    """调用 CodeWhisperer API 获取 usage"""
    url = 'https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&resourceType=AGENTIC_REQUEST'
    
    kiro_version = '0.6.18'
    headers = {
        'Authorization': f'Bearer {access_token}',
        'x-amz-user-agent': f'aws-sdk-js/1.0.0 KiroIDE-{kiro_version}-{machine_id}',
        'user-agent': f'aws-sdk-js/1.0.0 ua/2.1 os/windows lang/js md/nodejs#20.16.0 api/codewhispererruntime#1.0.0 m/E KiroIDE-{kiro_version}-{machine_id}',
        'amz-sdk-invocation-id': str(uuid.uuid4()),
        'amz-sdk-request': 'attempt=1; max=1',
        'Connection': 'close'
    }
    
    resp = requests.get(url, headers=headers)
    
    if resp.status_code == 403:
        return None, True  # banned
    if resp.status_code != 200:
        return None, False
    
    return resp.json(), False

def compute_client_id_hash(start_url='https://view.awsapps.com/start'):
    return hashlib.sha256(start_url.encode()).hexdigest()

def process_token_file(token_file, machine_id):
    """处理单个 token 文件，返回账号数据"""
    with open(token_file, 'r') as f:
        token_data = json.load(f)
    
    refresh_token = token_data.get('refreshToken')
    client_id = token_data.get('clientId')
    client_secret = token_data.get('clientSecret')
    region = token_data.get('region', 'us-east-1')
    account_name = token_data.get('accountName', 'unknown')
    
    if not all([refresh_token, client_id, client_secret]):
        return None, f'缺少必要字段'
    
    # 刷新 token
    token_result, err = refresh_token_idc(refresh_token, client_id, client_secret, region)
    if err:
        return None, err
    
    access_token = token_result['accessToken']
    new_refresh_token = token_result['refreshToken']
    expires_in = token_result['expiresIn']
    
    # 获取 usage
    usage, is_banned = get_usage_limits(access_token, machine_id)
    
    # 提取用户信息
    email = 'unknown@kiro.dev'
    user_id = None
    if usage:
        user_info = usage.get('userInfo', {})
        email = user_info.get('email', email)
        user_id = user_info.get('userId')
    
    # 构建账号对象
    expires_at = datetime.now() + timedelta(seconds=expires_in)
    client_id_hash = compute_client_id_hash()
    
    account = {
        'id': str(uuid.uuid4()),
        'email': email,
        'label': f'Kiro BuilderId 账号 ({account_name})',
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

def main():
    token_dir = r'C:\Users\12925\.kiro-batch-login\tokens'
    processed_dir = os.path.join(token_dir, 'processed')
    accounts_file = os.path.join(os.environ['APPDATA'], '.kiro-account-manager', 'accounts.json')
    
    # 创建 processed 目录
    os.makedirs(processed_dir, exist_ok=True)
    
    # 读取现有账号
    existing_accounts = []
    if os.path.exists(accounts_file):
        with open(accounts_file, 'r', encoding='utf-8') as f:
            existing_accounts = json.load(f)
    
    # 获取现有账号的 clientId 列表（用于去重，因为被封禁账号拿不到 email）
    existing_client_ids = {a.get('clientId') for a in existing_accounts if a.get('clientId')}
    
    machine_id = get_machine_id()
    
    # 遍历 token 文件
    token_files = [f for f in os.listdir(token_dir) if f.endswith('.json')]
    
    added = 0
    skipped = 0
    failed = 0
    
    for filename in token_files:
        token_file = os.path.join(token_dir, filename)
        print(f'处理: {filename}')
        
        account, err = process_token_file(token_file, machine_id)
        
        if err:
            print(f'  ❌ 失败: {err}')
            failed += 1
            continue
        
        # 跳过被封禁的账号
        if account['status'] == 'banned':
            print(f'  ⏭️ 跳过: 账号已被封禁')
            skipped += 1
            # 移动到 processed 目录
            import shutil
            shutil.move(token_file, os.path.join(processed_dir, filename))
            continue
        
        # 检查是否已存在（按 clientId 去重）
        if account['clientId'] in existing_client_ids:
            # 更新现有账号
            for i, a in enumerate(existing_accounts):
                if a.get('clientId') == account['clientId']:
                    account['id'] = a['id']  # 保留原 ID
                    existing_accounts[i] = account
                    print(f'  🔄 更新: {account["email"]}')
                    break
            # 移动到 processed 目录
            import shutil
            shutil.move(token_file, os.path.join(processed_dir, filename))
        else:
            existing_accounts.insert(0, account)
            existing_client_ids.add(account['clientId'])
            print(f'  ✅ 添加: {account["email"]}')
            added += 1
            # 移动到 processed 目录
            import shutil
            shutil.move(token_file, os.path.join(processed_dir, filename))
    
    # 保存
    os.makedirs(os.path.dirname(accounts_file), exist_ok=True)
    with open(accounts_file, 'w', encoding='utf-8') as f:
        json.dump(existing_accounts, f, ensure_ascii=False, indent=2)
    
    print()
    print(f'完成! 添加: {added}, 更新: {len(existing_accounts) - added - skipped}, 失败: {failed}')
    print(f'总账号数: {len(existing_accounts)}')

if __name__ == '__main__':
    main()
