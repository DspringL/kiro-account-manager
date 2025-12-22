"""邮件服务 - 集成 GPTMail 临时邮箱"""

import re
import time
import requests
import urllib3
import threading
from typing import Optional

# 禁用 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 全局锁，用于并发邮箱生成
_email_lock = threading.Lock()


class GPTMailHandler:
    """GPTMail 临时邮箱处理器。
    
    提供邮箱生成、验证码获取等功能。
    """
    
    BASE_URL = 'https://mail.chatgpt.org.uk'
    
    def __init__(self):
        """初始化邮箱处理器。"""
        self.session = requests.Session()
        self.session.headers.update({
            'user-agent': (
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                'AppleWebKit/537.36'
            ),
            'accept': 'application/json',
            'content-type': 'application/json',
            'referer': 'https://mail.chatgpt.org.uk/',
            'origin': 'https://mail.chatgpt.org.uk'
        })
        # 禁用 SSL 验证
        self.session.verify = False
        self.current_email = None
    
    def generate_email(self, prefix: Optional[str] = None) -> Optional[str]:
        """生成邮箱地址（线程安全）。"""
        try:
            with _email_lock:
                if prefix:
                    resp = self.session.post(
                        f'{self.BASE_URL}/api/generate-email',
                        json={'prefix': prefix},
                        timeout=15
                    )
                else:
                    resp = self.session.get(
                        f'{self.BASE_URL}/api/generate-email',
                        timeout=15
                    )
                
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get('success'):
                        email = data.get('data', {}).get('email')
                        if email:
                            self.current_email = email
                            return email
                return None
        except Exception:
            return None
    
    def get_emails(self, email: str) -> list:
        """获取邮箱中的所有邮件。"""
        try:
            resp = self.session.get(
                f'{self.BASE_URL}/api/emails',
                params={'email': email},
                timeout=15
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get('success'):
                    return data.get('data', {}).get('emails', [])
            return []
        except Exception:
            return []
    
    def get_verification_code(self, email: str, timeout: int = 300) -> Optional[str]:
        """等待并获取验证码。"""
        start_time = time.time()
        checked_ids = set()
        poll_interval = 1.5
        max_interval = 4.0
        
        print(f"[MAIL] Waiting for verification email to {email}...")
        
        while time.time() - start_time < timeout:
            try:
                emails = self.get_emails(email)
                new_emails = [m for m in emails if m.get('id') not in checked_ids]
                
                for mail in new_emails:
                    checked_ids.add(mail.get('id'))
                    subject = mail.get('subject', '').lower()
                    if not any(kw in subject for kw in ['verif', 'code', 'confirm', 'aws', 'amazon']):
                        continue
                    
                    code = self._extract_code(mail)
                    if code:
                        print(f"[OK] Verification code: {code}")
                        self.clear_inbox(email)
                        return code
                
                elapsed = time.time() - start_time
                if elapsed < 15:
                    poll_interval = 1.5
                elif elapsed < 60:
                    poll_interval = 2.5
                else:
                    poll_interval = min(poll_interval * 1.2, max_interval)
                
                time.sleep(poll_interval)
            except Exception as e:
                print(f"[!] Error: {e}")
                time.sleep(3)
        
        print(f"[X] Verification code not found in {timeout}s")
        return None
    
    def _extract_code(self, mail: dict) -> Optional[str]:
        """从邮件中提取6位验证码。"""
        priority_patterns = [
            r'verification code[:：\s]*(\d{6})',
            r'code is[:：\s]*(\d{6})',
        ]
        general_patterns = [
            r'>(\d{6})<',
            r'\b(\d{6})\b',
        ]
        
        texts = [mail.get('subject', ''), mail.get('content', '')]
        html = mail.get('html_content', '')
        if html:
            texts.append(re.sub(r'<[^>]+>', ' ', html))
        
        combined = ' '.join(texts)
        
        for pattern in priority_patterns:
            match = re.search(pattern, combined, re.IGNORECASE)
            if match:
                return match.group(1)
        
        for pattern in general_patterns:
            match = re.search(pattern, combined)
            if match:
                code = match.group(1)
                if not code.startswith('20') and not code.startswith('19'):
                    return code
        return None
    
    def clear_inbox(self, email: str) -> int:
        """清空邮箱。"""
        try:
            resp = self.session.delete(
                f'{self.BASE_URL}/api/emails/clear',
                params={'email': email}
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get('success'):
                    return data.get('data', {}).get('count', 0)
            return 0
        except Exception:
            return 0
    
    def close(self):
        """关闭 session。"""
        if self.session:
            self.session.close()
