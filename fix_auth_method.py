#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
批量修复账号的 authMethod 字段
将 authMethod 为 null 的账号修复为正确的值
"""

import json
import os
from pathlib import Path

# 账号数据库路径
ACCOUNTS_FILE = Path(os.environ['APPDATA']) / '.kiro-account-manager' / 'accounts.json'

def fix_auth_method():
    """修复所有账号的 authMethod 字段"""
    
    # 读取账号数据
    print(f"📂 读取账号数据: {ACCOUNTS_FILE}")
    with open(ACCOUNTS_FILE, 'r', encoding='utf-8') as f:
        accounts = json.load(f)
    
    print(f"📊 总账号数: {len(accounts)}")
    
    # 备份原文件
    backup_file = ACCOUNTS_FILE.with_suffix('.json.backup')
    print(f"💾 备份原文件到: {backup_file}")
    with open(backup_file, 'w', encoding='utf-8') as f:
        json.dump(accounts, f, indent=2, ensure_ascii=False)
    
    # 修复 authMethod
    fixed_count = 0
    for account in accounts:
        if account.get('authMethod') is None:
            # 根据 clientId 和 clientSecret 判断
            if account.get('clientId') and account.get('clientSecret'):
                account['authMethod'] = 'IdC'
                fixed_count += 1
                print(f"✅ 修复账号: {account.get('email') or account.get('userId')} -> IdC")
            else:
                account['authMethod'] = 'social'
                fixed_count += 1
                print(f"✅ 修复账号: {account.get('email') or account.get('userId')} -> social")
    
    # 保存修复后的数据
    if fixed_count > 0:
        print(f"\n💾 保存修复后的数据...")
        with open(ACCOUNTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(accounts, f, indent=2, ensure_ascii=False)
        print(f"✅ 成功修复 {fixed_count} 个账号的 authMethod 字段")
    else:
        print("✅ 所有账号的 authMethod 字段都正确，无需修复")
    
    # 统计
    idc_count = sum(1 for a in accounts if a.get('authMethod') == 'IdC')
    social_count = sum(1 for a in accounts if a.get('authMethod') == 'social')
    print(f"\n📊 统计:")
    print(f"  - IdC 账号: {idc_count}")
    print(f"  - Social 账号: {social_count}")

if __name__ == '__main__':
    try:
        fix_auth_method()
    except Exception as e:
        print(f"❌ 错误: {e}")
        import traceback
        traceback.print_exc()
