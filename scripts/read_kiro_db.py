#!/usr/bin/env python3
"""读取 Kiro IDE 的配置信息"""

import sqlite3
import os
import json

def read_kiro_state_db(db_path=None):
    """读取 state.vscdb 数据库"""
    if db_path is None:
        appdata = os.environ.get('APPDATA', '')
        db_path = os.path.join(appdata, 'Kiro', 'User', 'globalStorage', 'state.vscdb')
    
    if not os.path.exists(db_path):
        print(f"数据库不存在: {db_path}")
        return {}
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # 读取所有数据
    cursor.execute("SELECT key, value FROM ItemTable")
    rows = cursor.fetchall()
    conn.close()
    
    data = {}
    for key, value in rows:
        try:
            if isinstance(value, bytes):
                value = value.decode('utf-8')
            data[key] = json.loads(value) if value.startswith(('{', '[')) else value
        except:
            data[key] = value
    
    return data

def read_kiro_storage_json():
    """读取 storage.json"""
    appdata = os.environ.get('APPDATA', '')
    path = os.path.join(appdata, 'Kiro', 'User', 'globalStorage', 'storage.json')
    
    if not os.path.exists(path):
        return {}
    
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_kiro_info():
    """获取 Kiro IDE 关键信息"""
    storage = read_kiro_storage_json()
    
    # 尝试读取 state.vscdb（可能被占用）
    try:
        state = read_kiro_state_db()
    except:
        state = {}
    
    info = {
        # 从 storage.json
        'machineId': storage.get('telemetry.machineId'),
        'sqmId': storage.get('telemetry.sqmId'),
        'devDeviceId': storage.get('telemetry.devDeviceId'),
        
        # 从 state.vscdb
        'serviceMachineId': state.get('storage.serviceMachineId'),
        'firstSessionDate': state.get('telemetry.firstSessionDate'),
        'lastSessionDate': state.get('telemetry.lastSessionDate'),
        'currentSessionDate': state.get('telemetry.currentSessionDate'),
    }
    
    return info

if __name__ == '__main__':
    print("=== Kiro IDE 信息 ===\n")
    
    # 读取 storage.json
    print("--- storage.json ---")
    storage = read_kiro_storage_json()
    print(f"machineId: {storage.get('telemetry.machineId')}")
    print(f"sqmId: {storage.get('telemetry.sqmId')}")
    print(f"devDeviceId: {storage.get('telemetry.devDeviceId')}")
    
    # 读取 state.vscdb（使用副本）
    print("\n--- state.vscdb ---")
    appdata = os.environ.get('APPDATA', '')
    db_copy = os.path.join(appdata, 'Kiro', 'User', 'globalStorage', 'state - 副本.vscdb')
    
    if os.path.exists(db_copy):
        state = read_kiro_state_db(db_copy)
        print(f"serviceMachineId: {state.get('storage.serviceMachineId')}")
        print(f"firstSessionDate: {state.get('telemetry.firstSessionDate')}")
        print(f"lastSessionDate: {state.get('telemetry.lastSessionDate')}")
        print(f"currentSessionDate: {state.get('telemetry.currentSessionDate')}")
        
        # kiroAgent 信息
        kiro_agent = state.get('kiro.kiroAgent', {})
        if isinstance(kiro_agent, dict):
            print(f"\n--- kiroAgent ---")
            print(json.dumps(kiro_agent, indent=2, ensure_ascii=False))
