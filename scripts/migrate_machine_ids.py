#!/usr/bin/env python3
"""
迁移脚本：将 settings.json 中的 account_machine_ids 映射表迁移到 accounts.json 的 machineId 字段

使用方法：
    python scripts/migrate_machine_ids.py

数据路径：
    - app-settings.json: %APPDATA%\\.kiro-account-manager\\app-settings.json
    - accounts.json: %APPDATA%\\.kiro-account-manager\\accounts.json
"""

import os
import json
from pathlib import Path


def get_data_dir():
    """获取数据目录"""
    if os.name == 'nt':
        return Path(os.environ.get('APPDATA', '')) / '.kiro-account-manager'
    return Path.home() / '.kiro-account-manager'


def main():
    data_dir = get_data_dir()
    settings_path = data_dir / 'app-settings.json'
    accounts_path = data_dir / 'accounts.json'
    
    # 读取 app-settings.json
    if not settings_path.exists():
        print('❌ app-settings.json 不存在，无需迁移')
        return
    
    with open(settings_path, 'r', encoding='utf-8') as f:
        settings = json.load(f)
    
    machine_ids = settings.get('accountMachineIds') or settings.get('account_machine_ids')
    if not machine_ids:
        print('❌ 没有找到 accountMachineIds 映射表，无需迁移')
        return
    
    print(f'📋 找到 {len(machine_ids)} 个机器码映射')
    
    # 读取 accounts.json
    if not accounts_path.exists():
        print('❌ accounts.json 不存在')
        return
    
    with open(accounts_path, 'r', encoding='utf-8') as f:
        accounts = json.load(f)
    
    # 迁移
    migrated = 0
    for account in accounts:
        account_id = account.get('id')
        if account_id and account_id in machine_ids:
            old_value = account.get('machineId')
            new_value = machine_ids[account_id]
            if old_value != new_value:
                account['machineId'] = new_value
                migrated += 1
                print(f'  ✅ {account.get("email", account_id)}: {new_value[:8]}...')
    
    if migrated == 0:
        print('✅ 所有账号已是最新，无需迁移')
        return
    
    # 备份原文件
    backup_path = accounts_path.with_suffix('.json.bak')
    with open(backup_path, 'w', encoding='utf-8') as f:
        json.dump(accounts, f, ensure_ascii=False, indent=2)
    print(f'📦 已备份原文件到 {backup_path}')
    
    # 保存
    with open(accounts_path, 'w', encoding='utf-8') as f:
        json.dump(accounts, f, ensure_ascii=False, indent=2)
    
    print(f'✅ 迁移完成，共迁移 {migrated} 个账号')
    
    # 清理 settings.json 中的映射表
    if 'accountMachineIds' in settings:
        del settings['accountMachineIds']
    if 'account_machine_ids' in settings:
        del settings['account_machine_ids']
    
    with open(settings_path, 'w', encoding='utf-8') as f:
        json.dump(settings, f, ensure_ascii=False, indent=2)
    
    print('🧹 已清理 settings.json 中的旧映射表')


if __name__ == '__main__':
    main()
