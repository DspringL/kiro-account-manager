#!/usr/bin/env python3
"""
Windows 系统机器码 (MachineGuid) 管理工具

功能:
- 获取当前机器码
- 备份机器码
- 重置机器码（生成新的 UUID）
- 恢复机器码

注意: 修改注册表需要管理员权限
"""

import os
import sys
import json
import uuid
import ctypes
from datetime import datetime

# Windows 注册表路径
MACHINE_GUID_KEY = r"SOFTWARE\Microsoft\Cryptography"
MACHINE_GUID_VALUE = "MachineGuid"

# 备份文件路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKUP_FILE = os.path.join(SCRIPT_DIR, "machine_guid_backup.json")


def is_admin():
    """检查是否以管理员权限运行"""
    try:
        return ctypes.windll.shell32.IsUserAnAdmin()
    except:
        return False


def run_as_admin():
    """以管理员权限重新运行脚本"""
    if sys.platform != 'win32':
        print("❌ 此功能仅支持 Windows")
        return False
    
    ctypes.windll.shell32.ShellExecuteW(
        None, "runas", sys.executable, " ".join(sys.argv), None, 1
    )
    return True


def get_machine_guid():
    """获取当前系统机器码"""
    if sys.platform != 'win32':
        return None, "仅支持 Windows"
    
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, MACHINE_GUID_KEY, 0, winreg.KEY_READ)
        value, _ = winreg.QueryValueEx(key, MACHINE_GUID_VALUE)
        winreg.CloseKey(key)
        return value, None
    except Exception as e:
        return None, str(e)


def set_machine_guid(new_guid):
    """设置系统机器码（需要管理员权限）"""
    if sys.platform != 'win32':
        return False, "仅支持 Windows"
    
    if not is_admin():
        return False, "需要管理员权限"
    
    try:
        import winreg
        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE, 
            MACHINE_GUID_KEY, 
            0, 
            winreg.KEY_SET_VALUE | winreg.KEY_WOW64_64KEY
        )
        winreg.SetValueEx(key, MACHINE_GUID_VALUE, 0, winreg.REG_SZ, new_guid)
        winreg.CloseKey(key)
        return True, None
    except Exception as e:
        return False, str(e)


def backup_machine_guid():
    """备份当前机器码"""
    current_guid, err = get_machine_guid()
    if err:
        return False, err
    
    backup_data = {
        "machineGuid": current_guid,
        "backupTime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "computerName": os.environ.get("COMPUTERNAME", "unknown")
    }
    
    try:
        with open(BACKUP_FILE, 'w', encoding='utf-8') as f:
            json.dump(backup_data, f, ensure_ascii=False, indent=2)
        return True, current_guid
    except Exception as e:
        return False, str(e)


def restore_machine_guid():
    """从备份恢复机器码"""
    if not os.path.exists(BACKUP_FILE):
        return False, "备份文件不存在"
    
    try:
        with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
            backup_data = json.load(f)
        
        old_guid = backup_data.get("machineGuid")
        if not old_guid:
            return False, "备份文件格式错误"
        
        success, err = set_machine_guid(old_guid)
        if not success:
            return False, err
        
        return True, old_guid
    except Exception as e:
        return False, str(e)


def reset_machine_guid(auto_backup=True):
    """
    重置机器码（生成新的 UUID）
    
    参数:
        auto_backup: 是否自动备份当前机器码（默认 True）
    
    返回:
        (success, new_guid_or_error)
    """
    # 自动备份
    if auto_backup:
        # 检查是否已有备份，没有才备份
        if not os.path.exists(BACKUP_FILE):
            success, result = backup_machine_guid()
            if success:
                print(f"✅ 已备份原机器码: {result}")
            else:
                print(f"⚠️ 备份失败: {result}")
    
    # 生成新的 UUID
    new_guid = str(uuid.uuid4()).lower()
    
    # 设置新机器码
    success, err = set_machine_guid(new_guid)
    if not success:
        return False, err
    
    return True, new_guid


def get_backup_info():
    """获取备份信息"""
    if not os.path.exists(BACKUP_FILE):
        return None
    
    try:
        with open(BACKUP_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return None


# ========== 命令行接口 ==========

def main():
    """命令行入口"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Windows 系统机器码管理工具")
    parser.add_argument("action", choices=["get", "backup", "restore", "reset"], 
                        help="操作: get=获取, backup=备份, restore=恢复, reset=重置")
    parser.add_argument("--no-backup", action="store_true", 
                        help="重置时不自动备份")
    
    args = parser.parse_args()
    
    if args.action == "get":
        guid, err = get_machine_guid()
        if err:
            print(f"❌ 获取失败: {err}")
        else:
            print(f"当前机器码: {guid}")
            backup = get_backup_info()
            if backup:
                print(f"备份机器码: {backup['machineGuid']}")
                print(f"备份时间: {backup['backupTime']}")
    
    elif args.action == "backup":
        success, result = backup_machine_guid()
        if success:
            print(f"✅ 备份成功: {result}")
            print(f"备份文件: {BACKUP_FILE}")
        else:
            print(f"❌ 备份失败: {result}")
    
    elif args.action == "restore":
        if not is_admin():
            print("❌ 需要管理员权限，正在请求提权...")
            run_as_admin()
            return
        
        success, result = restore_machine_guid()
        if success:
            print(f"✅ 恢复成功: {result}")
        else:
            print(f"❌ 恢复失败: {result}")
    
    elif args.action == "reset":
        if not is_admin():
            print("❌ 需要管理员权限，正在请求提权...")
            run_as_admin()
            return
        
        success, result = reset_machine_guid(auto_backup=not args.no_backup)
        if success:
            print(f"✅ 重置成功，新机器码: {result}")
        else:
            print(f"❌ 重置失败: {result}")


if __name__ == "__main__":
    main()
