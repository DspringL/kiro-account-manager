#!/usr/bin/env python3
"""检查 Kiro 数据库中的 token 相关信息"""

import sqlite3
import os
import json

appdata = os.environ.get('APPDATA', '')
db_path = os.path.join(appdata, 'Kiro', 'User', 'globalStorage', 'state.vscdb')

print(f'DB Path: {db_path}')
print(f'Exists: {os.path.exists(db_path)}')

try:
    conn = sqlite3.connect(f'file:{db_path}?mode=ro', uri=True)
    cursor = conn.cursor()
    
    # 查找相关的 keys
    cursor.execute("""
        SELECT key FROM ItemTable 
        WHERE key LIKE '%token%' 
           OR key LIKE '%auth%' 
           OR key LIKE '%kiro%' 
           OR key LIKE '%email%'
           OR key LIKE '%account%'
           OR key LIKE '%login%'
    """)
    keys = cursor.fetchall()
    print(f'\nRelevant keys ({len(keys)}):')
    for k in keys:
        print(f'  {k[0]}')
    
    # 读取 kiro.kiroAgent 的内容
    cursor.execute("SELECT value FROM ItemTable WHERE key = 'kiro.kiroAgent'")
    row = cursor.fetchone()
    if row:
        print(f'\n=== kiro.kiroAgent ===')
        value = row[0]
        if isinstance(value, bytes):
            value = value.decode('utf-8')
        try:
            data = json.loads(value)
            print(json.dumps(data, indent=2, ensure_ascii=False)[:2000])
        except:
            print(value[:500])
    
    conn.close()
except Exception as e:
    print(f'Error: {e}')
