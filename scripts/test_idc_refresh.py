#!/usr/bin/env python3
# 测试 AWS SSO OIDC refresh_token 接口

import json
import os
import requests

def main():
    home = os.environ.get('USERPROFILE') or os.environ.get('HOME')
    cache_dir = os.path.join(home, '.aws', 'sso', 'cache')
    
    # 读取 token 文件
    token_file = os.path.join(cache_dir, 'kiro-auth-token.json')
    with open(token_file, 'r') as f:
        token_data = json.load(f)
    
    refresh_token = token_data['refreshToken']
    client_id_hash = token_data['clientIdHash']
    region = token_data.get('region', 'us-east-1')
    
    print(f'refreshToken 长度: {len(refresh_token)}')
    print(f'clientIdHash: {client_id_hash}')
    print(f'region: {region}')
    
    # 读取 client registration 文件
    client_file = os.path.join(cache_dir, f'{client_id_hash}.json')
    with open(client_file, 'r') as f:
        client_data = json.load(f)
    
    client_id = client_data['clientId']
    client_secret = client_data['clientSecret']
    
    print(f'clientId: {client_id}')
    print(f'clientSecret 长度: {len(client_secret)}')
    
    # 调用 AWS SSO OIDC API
    url = f'https://oidc.{region}.amazonaws.com/token'
    body = {
        'clientId': client_id,
        'clientSecret': client_secret,
        'grantType': 'refresh_token',
        'refreshToken': refresh_token
    }
    
    print(f'\n请求 URL: {url}')
    print(f'请求体 keys: {list(body.keys())}')
    
    resp = requests.post(url, json=body, headers={'Content-Type': 'application/json'})
    
    print(f'\n响应状态码: {resp.status_code}')
    print(f'响应内容: {resp.text[:500]}...' if len(resp.text) > 500 else f'响应内容: {resp.text}')
    
    if resp.status_code == 200:
        result = resp.json()
        print(f'\n✅ 成功!')
        print(f'新 accessToken 长度: {len(result.get("accessToken", ""))}')
        print(f'expiresIn: {result.get("expiresIn")}')
    else:
        print(f'\n❌ 失败!')

if __name__ == '__main__':
    main()
