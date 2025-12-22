#!/usr/bin/env python3
# 模拟 add_account_by_idc 完整逻辑

import json
import os
import hashlib
import requests
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
    
    print(f'\n[1] 刷新 Token')
    print(f'    URL: {url}')
    print(f'    refreshToken 长度: {len(refresh_token)}')
    print(f'    clientId: {client_id}')
    print(f'    clientSecret 长度: {len(client_secret)}')
    
    resp = requests.post(url, json=body, headers={'Content-Type': 'application/json'})
    
    if resp.status_code != 200:
        print(f'    ❌ 失败: {resp.status_code} - {resp.text}')
        return None
    
    result = resp.json()
    print(f'    ✅ 成功')
    print(f'    新 accessToken 长度: {len(result.get("accessToken", ""))}')
    print(f'    expiresIn: {result.get("expiresIn")}')
    return result

def get_usage_limits(access_token, machine_id):
    """调用 CodeWhisperer API 获取 usage"""
    url = 'https://codewhisperer.us-east-1.amazonaws.com/getUsageLimits?isEmailRequired=true&origin=AI_EDITOR&resourceType=AGENTIC_REQUEST'
    
    kiro_version = '0.6.18'
    x_amz_user_agent = f'aws-sdk-js/1.0.0 KiroIDE-{kiro_version}-{machine_id}'
    user_agent = f'aws-sdk-js/1.0.0 ua/2.1 os/windows lang/js md/nodejs#20.16.0 api/codewhispererruntime#1.0.0 m/E KiroIDE-{kiro_version}-{machine_id}'
    
    headers = {
        'Authorization': f'Bearer {access_token}',
        'x-amz-user-agent': x_amz_user_agent,
        'user-agent': user_agent,
        'amz-sdk-invocation-id': str(__import__('uuid').uuid4()),
        'amz-sdk-request': 'attempt=1; max=1',
        'Connection': 'close'
    }
    
    print(f'\n[2] 获取 Usage')
    print(f'    URL: {url}')
    print(f'    machineId: {machine_id}')
    
    resp = requests.get(url, headers=headers)
    
    if resp.status_code != 200:
        print(f'    ❌ 失败: {resp.status_code} - {resp.text[:200]}')
        return None, resp.status_code == 403
    
    result = resp.json()
    print(f'    ✅ 成功')
    print(f'    完整响应: {json.dumps(result, indent=2, ensure_ascii=False)[:1000]}')
    
    # 提取信息
    user_info = result.get('userInfo', {})
    email = user_info.get('email', 'unknown@kiro.dev')
    user_id = user_info.get('userId')
    subscription = result.get('subscriptionInfo', {}).get('subscriptionType')
    
    print(f'    email: {email}')
    print(f'    userId: {user_id}')
    print(f'    subscriptionType: {subscription}')
    
    return result, False

def compute_client_id_hash(start_url='https://view.awsapps.com/start'):
    """计算 clientIdHash"""
    return hashlib.sha256(start_url.encode()).hexdigest()

def add_account_by_idc(refresh_token, client_id, client_secret, region='us-east-1'):
    """模拟 add_account_by_idc 完整逻辑"""
    print('=' * 60)
    print('模拟 add_account_by_idc')
    print('=' * 60)
    
    # Step 1: 刷新 token
    token_result = refresh_token_idc(refresh_token, client_id, client_secret, region)
    if not token_result:
        return None
    
    access_token = token_result['accessToken']
    new_refresh_token = token_result['refreshToken']
    expires_in = token_result['expiresIn']
    
    # Step 2: 获取 usage
    machine_id = get_machine_id()
    usage, is_banned = get_usage_limits(access_token, machine_id)
    
    # Step 3: 计算 clientIdHash
    client_id_hash = compute_client_id_hash()
    print(f'\n[3] 计算 clientIdHash')
    print(f'    clientIdHash: {client_id_hash}')
    
    # Step 4: 构建账号对象
    expires_at = datetime.now() + timedelta(seconds=expires_in)
    
    email = 'unknown@kiro.dev'
    user_id = None
    if usage:
        user_info = usage.get('userInfo', {})
        email = user_info.get('email', email)
        user_id = user_info.get('userId')
    
    account = {
        'email': email,
        'provider': 'BuilderId',
        'accessToken': access_token,
        'refreshToken': new_refresh_token,
        'expiresAt': expires_at.strftime('%Y/%m/%d %H:%M:%S'),
        'clientId': client_id,
        'clientSecret': client_secret,
        'clientIdHash': client_id_hash,
        'region': region,
        'userId': user_id,
        'status': 'banned' if is_banned else 'active',
        'usageData': usage
    }
    
    print(f'\n[4] 构建账号对象')
    print(f'    email: {account["email"]}')
    print(f'    provider: {account["provider"]}')
    print(f'    status: {account["status"]}')
    print(f'    expiresAt: {account["expiresAt"]}')
    
    print('\n' + '=' * 60)
    print('✅ add_account_by_idc 完成')
    print('=' * 60)
    
    return account

def main():
    # 使用 batch-login 目录的 token 文件测试
    token_dir = r'C:\Users\12925\.kiro-batch-login\tokens'
    token_file = os.path.join(token_dir, 'token-BuilderId-IdC-f2688466-1765729370437.json')
    
    with open(token_file, 'r') as f:
        token_data = json.load(f)
    
    refresh_token = token_data['refreshToken']
    client_id = token_data['_clientId']
    client_secret = token_data['_clientSecret']
    region = token_data.get('region', 'us-east-1')
    
    print(f'使用 token 文件: {token_file}')
    print(f'accountName: {token_data.get("accountName")}')
    
    # 执行 add_account_by_idc
    account = add_account_by_idc(refresh_token, client_id, client_secret, region)
    
    if account:
        print(f'\n最终账号数据:')
        print(json.dumps({k: v for k, v in account.items() if k != 'usageData'}, indent=2, ensure_ascii=False))

if __name__ == '__main__':
    main()
