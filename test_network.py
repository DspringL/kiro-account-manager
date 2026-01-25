#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""测试 Kiro API 网络连接 - 测试所有账号类型的配额响应格式"""

import requests
import json
import cbor2
import pprint

def test_account_usage(account, account_type):
    """测试单个账号的配额获取"""
    url = "https://app.kiro.dev/service/KiroWebPortalService/operation/GetUserUsageAndLimits"
    
    access_token = account.get("accessToken")
    if not access_token:
        print(f"❌ {account_type} 账号没有 AccessToken")
        return None
    
    email = account.get("email", "未知")
    provider = account.get("provider", "未知")
    idp = account.get("idp", provider)
    
    print(f"📧 测试账号: {email}")
    print(f"🏷️  Provider: {provider}")
    print(f"🔑 AccessToken: {access_token[:20]}...")
    print()
    
    # 构造 CBOR 请求体
    request_data = {
        "isEmailRequired": True,
        "origin": "KIRO_IDE"
    }
    
    # 编码为 CBOR
    cbor_body = cbor2.dumps(request_data)
    
    # 构造 Cookie
    cookie = f"Idp={idp}; AccessToken={access_token}"
    
    # 构造请求头
    headers = {
        "Content-Type": "application/cbor",
        "Accept": "application/cbor",
        "smithy-protocol": "rpc-v2-cbor",
        "authorization": f"Bearer {access_token}",
        "Cookie": cookie
    }
    
    try:
        print("⏳ 发送请求...")
        response = requests.post(url, data=cbor_body, headers=headers, timeout=30)
        
        print(f"✅ 状态码: {response.status_code}")
        print()
        
        if response.status_code == 200:
            # 解码 CBOR 响应
            response_data = cbor2.loads(response.content)
            print(f"✅ 获取配额成功!")
            print()
            print("📊 配额数据:")
            pprint.pprint(response_data, width=80)
            return response_data
        else:
            print(f"❌ 获取配额失败!")
            try:
                error_data = cbor2.loads(response.content)
                print(f"   错误信息 (CBOR):")
                pprint.pprint(error_data, width=80)
            except:
                print(f"   响应内容 (原始): {response.content}")
            return None
            
    except requests.exceptions.RequestException as e:
        print(f"❌ 网络请求失败: {e}")
        print(f"   错误类型: {type(e).__name__}")
        return None
    except Exception as e:
        print(f"❌ 其他错误: {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """主函数 - 测试所有账号类型"""
    try:
        with open(r"C:\Users\12925\AppData\Roaming\.kiro-account-manager\accounts.json", "r", encoding="utf-8") as f:
            accounts = json.load(f)
            if not accounts:
                print("❌ 没有账号数据")
                return
            
            # 按 Provider 分类
            accounts_by_provider = {
                "Google": [],
                "Github": [],
                "BuilderId": [],
                "Enterprise": []
            }
            
            for acc in accounts:
                provider = acc.get("provider")
                if provider in accounts_by_provider:
                    accounts_by_provider[provider].append(acc)
            
            # 统计
            print("=" * 60)
            print("账号统计")
            print("=" * 60)
            for provider, accs in accounts_by_provider.items():
                print(f"{provider}: {len(accs)} 个")
            print()
            
            # 测试结果存储
            results = {}
            
            # 测试每种类型的第一个账号
            for provider, accs in accounts_by_provider.items():
                if not accs:
                    print(f"⚠️  没有 {provider} 账号，跳过")
                    print()
                    continue
                
                print("=" * 60)
                print(f"测试 {provider} 账号")
                print("=" * 60)
                print()
                
                # 找一个有 accessToken 的账号
                account = None
                for acc in accs:
                    if acc.get("accessToken"):
                        account = acc
                        break
                
                if not account:
                    print(f"❌ 没有找到有 AccessToken 的 {provider} 账号")
                    print()
                    continue
                
                result = test_account_usage(account, provider)
                if result:
                    results[provider] = result
                
                print()
            
            # 保存结果到文件
            if results:
                print("=" * 60)
                print("保存测试结果")
                print("=" * 60)
                print()
                
                for provider, data in results.items():
                    filename = f"usage_response_{provider.lower()}.json"
                    
                    # 转换 datetime 对象为字符串
                    def convert_datetime(obj):
                        if hasattr(obj, 'isoformat'):
                            return obj.isoformat()
                        elif isinstance(obj, dict):
                            return {k: convert_datetime(v) for k, v in obj.items()}
                        elif isinstance(obj, list):
                            return [convert_datetime(item) for item in obj]
                        else:
                            return obj
                    
                    data_serializable = convert_datetime(data)
                    
                    with open(filename, "w", encoding="utf-8") as f:
                        json.dump(data_serializable, f, indent=2, ensure_ascii=False)
                    
                    print(f"✅ {provider} 配额数据已保存到: {filename}")
                
                print()
                print("=" * 60)
                print("测试完成！")
                print("=" * 60)
            
    except FileNotFoundError:
        print("❌ 找不到 accounts.json 文件")
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
