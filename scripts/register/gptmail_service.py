"""邮件服务 - 集成 GPTMail 临时邮箱"""

import re
import time
import random
import requests
import urllib3
import threading
from typing import Optional

# 禁用 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# 全局锁，用于并发邮箱生成
_email_lock = threading.Lock()

# User-Agent 池
_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
]


class GPTMailHandler:
    """GPTMail 临时邮箱处理器。
    
    提供邮箱生成、验证码获取等功能。
    """
    
    BASE_URL = 'https://mail.chatgpt.org.uk'
    
    def __init__(self, proxy: Optional[str] = None, log_prefix: str = ""):
        """初始化邮箱处理器。
        
        Args:
            proxy: 代理地址，如 'socks5://127.0.0.1:7897'
            log_prefix: 日志前缀，如 '[窗口 1]'
        """
        self.session = requests.Session()
        self.session.headers.update({
            'user-agent': random.choice(_USER_AGENTS),
            'accept': 'application/json',
            'content-type': 'application/json',
            'referer': 'https://mail.chatgpt.org.uk/',
            'origin': 'https://mail.chatgpt.org.uk'
        })
        # 禁用 SSL 验证
        self.session.verify = False
        # 设置代理
        if proxy:
            self.session.proxies = {'http': proxy, 'https': proxy}
        self.current_email = None
        self.log_prefix = log_prefix
    
    def _log(self, msg: str):
        """带前缀的日志输出"""
        if self.log_prefix:
            print(f"{self.log_prefix} [MAIL] {msg}")
        else:
            print(f"[MAIL] {msg}")
    
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
    
    def get_verification_code(self, email: str, timeout: int = 300, min_wait: int = 10) -> Optional[str]:
        """等待并获取验证码。
        
        Args:
            email: 邮箱地址
            timeout: 超时时间（秒）
            min_wait: 最少等待时间（秒），在此之前不判定失败
        """
        start_time = time.time()
        checked_ids = set()
        poll_interval = 1.5
        max_interval = 4.0
        
        self._log(f"等待验证邮件 {email}...")
        
        while time.time() - start_time < timeout:
            try:
                emails = self.get_emails(email)
                elapsed = time.time() - start_time
                
                # 超过最少等待时间后，如果还是空邮箱就直接失败
                if len(emails) == 0 and elapsed >= min_wait:
                    self._log(f"等待 {min_wait}s 后无邮件，跳过")
                    return None
                
                new_emails = [m for m in emails if m.get('id') not in checked_ids]
                
                for mail in new_emails:
                    checked_ids.add(mail.get('id'))
                    subject = mail.get('subject', '')
                    
                    # 直接尝试提取验证码，不过滤主题
                    code = self._extract_code(mail)
                    if code:
                        self._log(f"✅ 验证码: {code}")
                        self.clear_inbox(email)
                        return code
                
                if elapsed < 15:
                    poll_interval = 1.5
                elif elapsed < 60:
                    poll_interval = 2.5
                else:
                    poll_interval = min(poll_interval * 1.2, max_interval)
                
                time.sleep(poll_interval)
            except Exception as e:
                self._log(f"错误: {e}")
                time.sleep(3)
        
        self._log(f"❌ {timeout}s 内未获取到验证码")
        return None
    
    def _extract_code(self, mail: dict) -> Optional[str]:
        """从邮件中提取6位验证码。"""
        priority_patterns = [
            r'验证码[:：\s]*[:：]?\s*(\d{6})',  # 中文：验证码：: 123456
            r'verification code[:：\s]*(\d{6})',
            r'code is[:：\s]*(\d{6})',
            r'code[:：]\s*(\d{6})',
        ]
        general_patterns = [
            r'class="code"[^>]*>(\d{6})<',  # HTML: <div class="code">123456</div>
            r'>(\d{6})<',
            r'\b(\d{6})\b',
        ]
        
        texts = [mail.get('subject', ''), mail.get('content', '')]
        html = mail.get('html_content', '')
        if html:
            texts.append(html)  # 保留原始 HTML 用于匹配 class="code"
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
