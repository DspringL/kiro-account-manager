#!/usr/bin/env python3
"""
AWS Builder ID 自动注册脚本
支持两种浏览器引擎：
  - camoufox：内置反检测，推荐用于 register 模式
  - playwright：配合指纹注入脚本，可选用于 authorize 模式
"""

import sys
import json
import asyncio
import random
import secrets
import requests
import time

# ─── 浏览器引擎检测 ──────────────────────────────────────────────────────────

try:
    from camoufox.async_api import AsyncCamoufox
    CAMOUFOX_AVAILABLE = True
except ImportError:
    CAMOUFOX_AVAILABLE = False

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


# ─── 日志 / 结果输出 ─────────────────────────────────────────────────────────

def log(message: str, email: str = ""):
    from datetime import datetime
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    print(json.dumps({"type": "log", "email": "", "message": f"[{ts}] {message}"}), flush=True)

def fail(error: str):
    print(json.dumps({"type": "result", "data": {"success": False, "error": error}}), flush=True)
    sys.exit(0)

def success(data: dict):
    print(json.dumps({"type": "result", "data": data}), flush=True)
    sys.exit(0)


# ─── 指纹生成（移植自 kiro-auto-main/lib/fingerprint/generator.ts）────────────

TIMEZONES = [
    {"name": "America/New_York",    "offset": -300},
    {"name": "America/Chicago",     "offset": -360},
    {"name": "America/Denver",      "offset": -420},
    {"name": "America/Los_Angeles", "offset": -480},
    {"name": "Europe/London",       "offset": 0},
    {"name": "Europe/Paris",        "offset": 60},
    {"name": "Asia/Tokyo",          "offset": 540},
    {"name": "Asia/Shanghai",       "offset": 480},
    {"name": "Australia/Sydney",    "offset": 600},
]

SCREEN_RESOLUTIONS = {
    "Windows": [(1920,1080),(2560,1440),(1366,768),(1536,864),(3840,2160)],
    "macOS":   [(2560,1600),(2880,1800),(2560,1440),(1920,1080),(3024,1964)],
    "Linux":   [(1920,1080),(2560,1440),(1366,768),(1600,900)],
}

CHROME_VERSIONS = ["120.0.0.0","121.0.0.0","122.0.0.0","123.0.0.0","124.0.0.0"]

FONTS_BY_OS = {
    "Windows": ["Arial","Arial Black","Calibri","Cambria","Comic Sans MS","Consolas",
                "Courier New","Georgia","Impact","Segoe UI","Tahoma","Times New Roman",
                "Trebuchet MS","Verdana"],
    "macOS":   ["Arial","Avenir","Baskerville","Courier","Courier New","Futura","Geneva",
                "Georgia","Helvetica","Helvetica Neue","Impact","Lucida Grande","Monaco",
                "Optima","Palatino","Times New Roman","Trebuchet MS","Verdana"],
    "Linux":   ["Arial","Courier New","DejaVu Sans","DejaVu Sans Mono","DejaVu Serif",
                "FreeMono","FreeSans","Georgia","Liberation Mono","Liberation Sans",
                "Times New Roman","Ubuntu","Ubuntu Mono","Verdana"],
}

WEBGL_CONFIGS = {
    "Windows": [
        {"vendor":"Google Inc. (NVIDIA)","renderer":"ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)",
         "unmaskedVendor":"NVIDIA Corporation","unmaskedRenderer":"NVIDIA GeForce RTX 3060"},
        {"vendor":"Google Inc. (AMD)","renderer":"ANGLE (AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)",
         "unmaskedVendor":"AMD","unmaskedRenderer":"AMD Radeon RX 580"},
        {"vendor":"Google Inc. (Intel)","renderer":"ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)",
         "unmaskedVendor":"Intel Inc.","unmaskedRenderer":"Intel(R) UHD Graphics 630"},
    ],
    "macOS": [
        {"vendor":"Apple Inc.","renderer":"Apple M1","unmaskedVendor":"Apple Inc.","unmaskedRenderer":"Apple M1"},
        {"vendor":"Apple Inc.","renderer":"Apple M2","unmaskedVendor":"Apple Inc.","unmaskedRenderer":"Apple M2"},
        {"vendor":"Apple Inc.","renderer":"Apple M1 Pro","unmaskedVendor":"Apple Inc.","unmaskedRenderer":"Apple M1 Pro"},
    ],
    "Linux": [
        {"vendor":"NVIDIA Corporation","renderer":"NVIDIA GeForce GTX 1060/PCIe/SSE2",
         "unmaskedVendor":"NVIDIA Corporation","unmaskedRenderer":"NVIDIA GeForce GTX 1060/PCIe/SSE2"},
        {"vendor":"Intel Open Source Technology Center","renderer":"Mesa DRI Intel(R) UHD Graphics 620",
         "unmaskedVendor":"Intel Open Source Technology Center","unmaskedRenderer":"Mesa DRI Intel(R) UHD Graphics 620"},
    ],
}

def generate_fingerprint(os_type: str = None) -> dict:
    """生成一套完整的浏览器指纹配置"""
    if os_type is None:
        os_type = random.choices(["Windows","macOS","Linux"], weights=[70,20,10])[0]

    chrome_ver = random.choice(CHROME_VERSIONS)
    webkit = "537.36"

    if os_type == "Windows":
        ua = f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/{webkit} (KHTML, like Gecko) Chrome/{chrome_ver} Safari/{webkit}"
        platform = "Win32"
    elif os_type == "macOS":
        mac_ver = random.choice(["10_15_7","11_0_0","12_0_0","13_0_0"])
        ua = f"Mozilla/5.0 (Macintosh; Intel Mac OS X {mac_ver}) AppleWebKit/{webkit} (KHTML, like Gecko) Chrome/{chrome_ver} Safari/{webkit}"
        platform = "MacIntel"
    else:
        ua = f"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/{webkit} (KHTML, like Gecko) Chrome/{chrome_ver} Safari/{webkit}"
        platform = "Linux x86_64"

    res = random.choice(SCREEN_RESOLUTIONS[os_type])
    dpr = random.choice([2, 2.5, 3]) if os_type == "macOS" else random.choice([1, 1.25, 1.5, 2])
    tz  = random.choice(TIMEZONES)
    wgl = random.choice(WEBGL_CONFIGS[os_type])
    canvas_seed = secrets.token_hex(16)
    audio_seed  = secrets.token_hex(16)

    return {
        "os": os_type,
        "userAgent": ua,
        "platform": platform,
        "language": "en-US",
        "languages": ["en-US", "en"],
        "screen": {
            "width": res[0], "height": res[1],
            "availWidth": res[0], "availHeight": res[1] - (40 if os_type == "Windows" else 25),
            "colorDepth": 24, "pixelDepth": 24, "devicePixelRatio": dpr,
        },
        "hardware": {
            "hardwareConcurrency": random.choice([4,6,8,12,16]),
            "deviceMemory": random.choice([4,8,16,32]),
            "maxTouchPoints": 0,
        },
        "webgl": wgl,
        "fonts": FONTS_BY_OS[os_type],
        "timezone": tz,
        "canvasSeed": canvas_seed,
        "audioSeed": audio_seed,
        "locale": "en-US",
    }


def build_fingerprint_script(fp: dict) -> str:
    """生成注入到浏览器的指纹覆盖脚本（移植自 kiro-auto-main injector.ts）"""
    s = fp["screen"]
    h = fp["hardware"]
    wgl = fp["webgl"]
    tz  = fp["timezone"]
    fonts_json = json.dumps(fp["fonts"])
    canvas_seed = fp["canvasSeed"]
    audio_seed  = fp["audioSeed"]

    return f"""
(function() {{
  'use strict';
  if (window.__fp_injected__) return;
  window.__fp_injected__ = true;

  // ── Seeded random ──
  function seededRandom(seed) {{
    let state = 0;
    for (let i = 0; i < seed.length; i++) {{
      state = ((state << 5) - state) + seed.charCodeAt(i);
      state = state & state;
    }}
    return function() {{
      state = (state * 9301 + 49297) % 233280;
      return state / 233280;
    }};
  }}
  const canvasRng = seededRandom('{canvas_seed}');
  const audioRng  = seededRandom('{audio_seed}');

  // ── Navigator ──
  try {{
    Object.defineProperty(Navigator.prototype, 'platform',             {{ get: () => '{fp["platform"]}' }});
    Object.defineProperty(Navigator.prototype, 'hardwareConcurrency',  {{ get: () => {h["hardwareConcurrency"]} }});
    Object.defineProperty(Navigator.prototype, 'deviceMemory',         {{ get: () => {h["deviceMemory"]} }});
    Object.defineProperty(Navigator.prototype, 'maxTouchPoints',       {{ get: () => {h["maxTouchPoints"]} }});
    Object.defineProperty(Navigator.prototype, 'language',             {{ get: () => '{fp["language"]}' }});
    Object.defineProperty(Navigator.prototype, 'languages',            {{ get: () => {json.dumps(fp["languages"])} }});
    Object.defineProperty(Navigator.prototype, 'doNotTrack',           {{ get: () => null }});
    Object.defineProperty(Navigator.prototype, 'webdriver',            {{ get: () => false }});
    Object.defineProperty(Navigator.prototype, 'pdfViewerEnabled',     {{ get: () => true }});
    delete Object.getPrototypeOf(navigator).webdriver;
  }} catch(e) {{}}

  // ── Screen ──
  try {{
    Object.defineProperty(Screen.prototype, 'width',       {{ get: () => {s["width"]} }});
    Object.defineProperty(Screen.prototype, 'height',      {{ get: () => {s["height"]} }});
    Object.defineProperty(Screen.prototype, 'availWidth',  {{ get: () => {s["availWidth"]} }});
    Object.defineProperty(Screen.prototype, 'availHeight', {{ get: () => {s["availHeight"]} }});
    Object.defineProperty(Screen.prototype, 'colorDepth',  {{ get: () => {s["colorDepth"]} }});
    Object.defineProperty(Screen.prototype, 'pixelDepth',  {{ get: () => {s["pixelDepth"]} }});
    Object.defineProperty(window, 'devicePixelRatio',      {{ get: () => {s["devicePixelRatio"]} }});
  }} catch(e) {{}}

  // ── Canvas noise ──
  try {{
    const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    HTMLCanvasElement.prototype.toDataURL = function() {{
      const ctx = this.getContext('2d');
      if (ctx) {{
        const d = ctx.getImageData(0,0,this.width,this.height);
        for (let i=0;i<d.data.length;i+=4) {{
          const n=Math.floor(canvasRng()*5)-2;
          d.data[i]=Math.max(0,Math.min(255,d.data[i]+n));
          d.data[i+1]=Math.max(0,Math.min(255,d.data[i+1]+n));
          d.data[i+2]=Math.max(0,Math.min(255,d.data[i+2]+n));
        }}
        ctx.putImageData(d,0,0);
      }}
      return origToDataURL.apply(this,arguments);
    }};
    CanvasRenderingContext2D.prototype.getImageData = function() {{
      const d = origGetImageData.apply(this,arguments);
      for (let i=0;i<d.data.length;i+=4) {{
        const n=Math.floor(canvasRng()*5)-2;
        d.data[i]=Math.max(0,Math.min(255,d.data[i]+n));
        d.data[i+1]=Math.max(0,Math.min(255,d.data[i+1]+n));
        d.data[i+2]=Math.max(0,Math.min(255,d.data[i+2]+n));
      }}
      return d;
    }};
  }} catch(e) {{}}

  // ── WebGL ──
  try {{
    const patchWebGL = (cls) => {{
      const orig = cls.prototype.getParameter;
      cls.prototype.getParameter = function(p) {{
        if (p===37445) return '{wgl["unmaskedVendor"]}';
        if (p===37446) return '{wgl["unmaskedRenderer"]}';
        if (p===7936)  return '{wgl["vendor"]}';
        if (p===7937)  return '{wgl["renderer"]}';
        return orig.apply(this,arguments);
      }};
    }};
    if (window.WebGLRenderingContext)  patchWebGL(WebGLRenderingContext);
    if (window.WebGL2RenderingContext) patchWebGL(WebGL2RenderingContext);
  }} catch(e) {{}}

  // ── Audio noise ──
  try {{
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {{
      const origOsc = AC.prototype.createOscillator;
      AC.prototype.createOscillator = function() {{
        const osc = origOsc.apply(this,arguments);
        const origStart = osc.start;
        osc.start = function() {{
          if (osc.frequency) osc.frequency.value += (audioRng()-0.5)*0.001;
          return origStart.apply(this,arguments);
        }};
        return osc;
      }};
    }}
  }} catch(e) {{}}

  // ── Timezone ──
  try {{
    Date.prototype.getTimezoneOffset = function() {{ return {tz["offset"]}; }};
    const OrigDTF = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function(locale, opts) {{
      opts = opts || {{}};
      opts.timeZone = '{tz["name"]}';
      return new OrigDTF(locale, opts);
    }};
    Intl.DateTimeFormat.prototype = OrigDTF.prototype;
  }} catch(e) {{}}

  // ── WebRTC disable ──
  try {{
    ['RTCPeerConnection','webkitRTCPeerConnection','mozRTCPeerConnection'].forEach(k => {{
      if (window[k]) window[k] = function() {{ throw new Error('WebRTC disabled'); }};
    }});
  }} catch(e) {{}}

  // ── Fonts ──
  try {{
    const fakeFonts = new Set({fonts_json});
    const origFonts = document.fonts;
    Object.defineProperty(document, 'fonts', {{
      get: function() {{
        return {{
          ...origFonts,
          check: (font) => {{ const f=font.match(/['"]([^'"]+)['"]/)?.[1]||font.split(' ').pop(); return fakeFonts.has(f)||origFonts.check.call(origFonts,font); }},
          size: fakeFonts.size,
        }};
      }}
    }});
  }} catch(e) {{}}

  // ── ClientRects noise ──
  try {{
    const rectsRng = seededRandom('{canvas_seed}_rects');
    const origGBCR = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {{
      const r = origGBCR.call(this);
      const n = (rectsRng()-0.5)*0.0001;
      return {{x:r.x+n,y:r.y+n,width:r.width+n,height:r.height+n,top:r.top+n,right:r.right+n,bottom:r.bottom+n,left:r.left+n,toJSON:r.toJSON}};
    }};
  }} catch(e) {{}}

  // ── WebDriver detection bypass ──
  try {{
    ['cdc_adoQpoasnfa76pfcZLmcfl_','cdc_adoQpoasnfa76pfcZLmcfl_Array',
     'cdc_adoQpoasnfa76pfcZLmcfl_Promise','cdc_adoQpoasnfa76pfcZLmcfl_Symbol'].forEach(k => {{
      Object.defineProperty(window, k, {{ get: ()=>undefined, set: ()=>true }});
    }});
  }} catch(e) {{}}

  // ── Chrome object ──
  try {{
    if (!window.chrome) {{
      window.chrome = {{ runtime: {{}}, app: {{ isInstalled: false }} }};
    }}
  }} catch(e) {{}}

  // ── Connection API ──
  try {{
    Object.defineProperty(Navigator.prototype, 'connection', {{
      get: () => ({{ effectiveType:'4g', rtt:50, downlink:10, saveData:false,
                     addEventListener:()=>{{}}, removeEventListener:()=>{{}} }})
    }});
  }} catch(e) {{}}

}})();
"""


# ─── 浏览器上下文工厂 ────────────────────────────────────────────────────────

class BrowserContext:
    """统一封装 Camoufox / Playwright 的浏览器上下文"""
    def __init__(self, browser_type: str, proxy_url: str = None, fp: dict = None):
        self.browser_type = browser_type
        self.proxy_url = proxy_url
        self.fp = fp or generate_fingerprint()
        self._pw_cm = None
        self._pw = None
        self._browser = None
        self._context = None
        self._camoufox_cm = None

    async def __aenter__(self):
        if self.browser_type == "playwright":
            if not PLAYWRIGHT_AVAILABLE:
                fail("Playwright 未安装，请运行: pip install playwright && playwright install chromium")
            self._pw_cm = async_playwright()
            self._pw = await self._pw_cm.__aenter__()

            import os, subprocess
            # 使用固定的用户数据目录，跨次注册保留 cookie/localStorage
            home = os.path.expanduser("~")
            self._user_data_dir = os.path.join(home, ".kiro-account-manager", "pw_profile")
            os.makedirs(self._user_data_dir, exist_ok=True)

            # 清理残留的 SingletonLock，避免上次异常退出导致无法启动
            for lock_file in ["SingletonLock", "SingletonCookie", "SingletonSocket"]:
                lock_path = os.path.join(self._user_data_dir, lock_file)
                try:
                    if os.path.exists(lock_path):
                        os.remove(lock_path)
                        log(f"[Playwright] 清理残留锁文件: {lock_file}")
                except Exception:
                    pass

            # 获取真实屏幕分辨率，窗口不超过屏幕大小
            screen_w, screen_h = 1920, 1080  # 默认值
            try:
                if sys.platform == "darwin":
                    out = subprocess.check_output(
                        ["system_profiler", "SPDisplaysDataType"], text=True, timeout=5
                    )
                    import re
                    m = re.search(r"Resolution:\s*(\d+)\s*x\s*(\d+)", out)
                    if m:
                        screen_w, screen_h = int(m.group(1)), int(m.group(2))
                elif sys.platform == "win32":
                    import ctypes
                    screen_w = ctypes.windll.user32.GetSystemMetrics(0)
                    screen_h = ctypes.windll.user32.GetSystemMetrics(1)
                elif sys.platform.startswith("linux"):
                    out = subprocess.check_output(
                        ["xrandr", "--current"], text=True, timeout=5
                    )
                    import re
                    m = re.search(r"current (\d+) x (\d+)", out)
                    if m:
                        screen_w, screen_h = int(m.group(1)), int(m.group(2))
            except Exception:
                pass

            # 窗口大小：指纹分辨率与屏幕分辨率取较小值，留出任务栏空间
            fp_w = self.fp["screen"]["width"]
            fp_h = self.fp["screen"]["height"]
            win_w = min(fp_w, screen_w)
            win_h = min(fp_h, screen_h - 80)  # 留 80px 给任务栏/菜单栏
            log(f"[Playwright] 屏幕: {screen_w}x{screen_h}，窗口: {win_w}x{win_h}，指纹: {fp_w}x{fp_h}")

            launch_args = {
                "user_data_dir": self._user_data_dir,
                "headless": False,
                "args": [
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-infobars",
                    "--disable-notifications",
                ],
                "user_agent": self.fp["userAgent"],
                "locale": self.fp["locale"],
                "timezone_id": self.fp["timezone"]["name"],
                "viewport": {
                    "width": win_w,
                    "height": win_h,
                },
                "device_scale_factor": self.fp["screen"]["devicePixelRatio"],
                "java_script_enabled": True,
            }
            if self.proxy_url:
                launch_args["proxy"] = {
                    "server": self.proxy_url,
                    "bypass": "127.0.0.1,localhost",
                }

            # launch_persistent_context 直接返回 context，不需要再 new_context
            self._context = await self._pw.chromium.launch_persistent_context(**launch_args)
            # 注入指纹脚本
            await self._context.add_init_script(build_fingerprint_script(self.fp))
            log(f"[Playwright] 持久化上下文启动: os={self.fp['os']} ua={self.fp['userAgent'][:60]}...")
            return self

        else:  # camoufox
            if not CAMOUFOX_AVAILABLE:
                fail("Camoufox 未安装，请运行: pip install camoufox && python -m camoufox fetch")
            fp = self.fp
            os_map = {"Windows": "windows", "macOS": "macos", "Linux": "linux"}
            args = {
                "headless": False,
                "os": os_map.get(fp["os"], "windows"),
                "window": (fp["screen"]["width"], fp["screen"]["height"]),
                "locale": fp["locale"],
                "humanize": True,
                "block_webrtc": True,
            }
            if self.proxy_url:
                args["proxy"] = {"server": self.proxy_url, "bypass": "127.0.0.1,localhost"}
            self._camoufox_cm = AsyncCamoufox(**args)
            self._browser = await self._camoufox_cm.__aenter__()
            log(f"[Camoufox] 启动完成: os={fp['os']} {fp['screen']['width']}x{fp['screen']['height']}")
            return self

    async def __aexit__(self, *args):
        if self.browser_type == "playwright":
            try:
                if self._context:
                    await self._context.close()
            except Exception:
                pass
            try:
                if self._pw_cm:
                    await self._pw_cm.__aexit__(*args)
            except Exception:
                pass
            # 固定目录不删除，保留浏览器历史状态
            self._user_data_dir = None
        else:
            try:
                if self._camoufox_cm:
                    await self._camoufox_cm.__aexit__(*args)
            except Exception:
                pass

    async def new_page(self):
        if self.browser_type == "playwright":
            # launch_persistent_context 直接返回 context
            return await self._context.new_page()
        else:
            return await self._browser.new_page()


# ─── 仿真操作工具 ────────────────────────────────────────────────────────────

def generate_user_code() -> str:
    letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    return f"{''.join(random.choices(letters,k=4))}-{''.join(random.choices(letters,k=4))}"

async def human_type(page, selector: str, text: str, slow_mode: bool,
                     min_sec: float = 1.0, max_sec: float = 10.0):
    """
    仿真人类输入。
    - slow_mode: 逐字符输入 + 随机延迟
    - 普通模式: pressSequentially 逐字符（每字符 50-150ms），更接近真实输入
    """
    if slow_mode:
        delay = random.uniform(min_sec, max_sec)
        log(f"  [仿真延迟] 等待 {delay:.1f} 秒...")
        await asyncio.sleep(delay)
        # JS focus 聚焦，避免 click 被覆盖层拦截
        try:
            await page.evaluate(
                "sel => { const el = document.querySelector(sel); if (el) el.focus(); }",
                selector
            )
        except Exception:
            pass
        await asyncio.sleep(random.uniform(0.3, 0.8))
        for char in text:
            await page.keyboard.type(char)
            await asyncio.sleep(random.uniform(0.3, 0.7) if random.random() < 0.08 else random.uniform(0.05, 0.18))
    else:
        # 先移动鼠标到元素，再用 pressSequentially 逐字符输入（50-150ms/字符）
        try:
            element = page.locator(selector).first()
            box = await element.bounding_box()
            if box:
                tx = box["x"] + box["width"] / 2
                ty = box["y"] + box["height"] / 2
                await simulate_mouse_move(page, tx, ty)
            await asyncio.sleep(random.uniform(0.1, 0.2))
            await element.click()
            await asyncio.sleep(random.uniform(0.1, 0.2))
            await element.clear()
            await element.press_sequentially(text, delay=random.randint(50, 150))
        except Exception:
            # 降级：JS 直接赋值并触发 React 事件
            try:
                await page.evaluate(
                    """([sel, val]) => {
                        const el = document.querySelector(sel);
                        if (!el) return;
                        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                        setter.call(el, val);
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                        el.dispatchEvent(new Event('change', { bubbles: true }));
                    }""",
                    [selector, text]
                )
            except Exception:
                pass

async def human_click(page, selector: str):
    """
    仿真人类点击：贝塞尔曲线移动鼠标 + 随机偏移点击。
    失败时降级用 JS el.click()。
    """
    try:
        element = page.locator(selector).first()
        await element.wait_for(state="visible", timeout=5000)
        box = await element.bounding_box()
        if box:
            tx = box["x"] + box["width"] / 2 + (random.random() - 0.5) * 10
            ty = box["y"] + box["height"] / 2 + (random.random() - 0.5) * 5
            await simulate_mouse_move(page, tx, ty)
        await asyncio.sleep(random.uniform(0.1, 0.3))
        await element.click(timeout=5000)
        return
    except Exception:
        pass
    # 降级：JS 直接触发 click
    try:
        await page.evaluate(
            "sel => { const el = document.querySelector(sel); if (el) el.click(); }",
            selector
        )
    except Exception:
        pass

async def simulate_mouse_move(page, target_x: float, target_y: float):
    """贝塞尔曲线鼠标轨迹（移植自 kiro-auto-main simulateMouseMove）"""
    try:
        steps = random.randint(5, 15)
        for i in range(steps + 1):
            t = i / steps
            control_x = target_x / 2 + (random.random() - 0.5) * 50
            control_y = target_y / 2 + (random.random() - 0.5) * 50
            point_x = (1-t)*(1-t)*0 + 2*(1-t)*t*control_x + t*t*target_x
            point_y = (1-t)*(1-t)*0 + 2*(1-t)*t*control_y + t*t*target_y
            await page.mouse.move(int(point_x), int(point_y))
            if random.random() < 0.3:
                await asyncio.sleep(random.uniform(0.01, 0.05))
    except Exception:
        pass


async def simulate_pre_registration_behavior(page):
    """页面加载后的预热行为：只做鼠标移动，不滚动（避免触发 AWS 表单错误）"""
    log("[反检测] 模拟用户预热行为...")
    await asyncio.sleep(random.uniform(0.5, 1.5))

    # 随机鼠标移动 2-3 次
    try:
        vp = page.viewport_size
        if vp:
            for _ in range(random.randint(2, 3)):
                x = random.randint(100, vp["width"] - 100)
                y = random.randint(100, vp["height"] - 100)
                await simulate_mouse_move(page, x, y)
                await asyncio.sleep(random.uniform(0.2, 0.5))
    except Exception:
        pass

    log("[反检测] ✓ 预热行为完成")


async def dismiss_error_banner(page) -> bool:
    """检测并关闭 AWS 错误弹窗，返回是否存在错误"""
    error_texts = [
        "Sorry, there was an error processing your request",
        "error processing your request",
        "Please try again",
        "抱歉，处理您的请求时出错",
    ]
    try:
        # 检查是否有错误弹窗
        for sel in ['div[role="alert"]', '[class*="awsui_flash"]', '[data-testid="flash-error"]']:
            el = await page.query_selector(sel)
            if el and await el.is_visible():
                text = await el.text_content() or ""
                if any(t.lower() in text.lower() for t in error_texts):
                    log(f"[反检测] 检测到错误弹窗，尝试关闭...")
                    # 尝试点关闭按钮
                    for close_sel in ['button[aria-label="Close"]', 'button[aria-label="关闭"]',
                                      '[class*="awsui_dismiss"]']:
                        close_btn = await page.query_selector(close_sel)
                        if close_btn and await close_btn.is_visible():
                            await close_btn.click()
                            await asyncio.sleep(0.5)
                            break
                    return True
    except Exception:
        pass
    return False
    """关闭 AWS Cookie 弹窗（如果存在，不强制）"""
    try:
        btn = await page.query_selector(
            'button[data-id="awsccc-cb-btn-accept"], button#awsccc-cb-btn-accept'
        )
        if btn and await btn.is_visible():
            await btn.click()
            await asyncio.sleep(0.5)
            return True
    except Exception:
        pass
    return False
    """关闭 AWS Cookie 弹窗（如果存在）"""
    try:
        btn = await page.query_selector(
            'button[data-id="awsccc-cb-btn-accept"], button#awsccc-cb-btn-accept'
        )
        if btn and await btn.is_visible():
            await btn.click()
            await asyncio.sleep(0.5)
            return True
    except Exception:
        pass
    return False


# ─── 名字 / 密码生成 ─────────────────────────────────────────────────────────

FIRST_NAMES = ["James","Robert","John","Michael","David","William","Richard",
               "Maria","Elizabeth","Jennifer","Linda","Barbara","Susan","Jessica",
               "Sarah","Karen","Nancy","Lisa","Betty","Margaret"]
LAST_NAMES  = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller",
               "Davis","Rodriguez","Martinez","Wilson","Anderson","Thomas","Taylor",
               "Moore","Jackson","Martin","Lee","Thompson","White"]

def random_name():
    return f"{random.choice(FIRST_NAMES)} {random.choice(LAST_NAMES)}"

def _generate_password(length: int = None) -> str:
    import string
    if length is None:
        length = random.randint(10, 16)
    lower, upper, digits, special = string.ascii_lowercase, string.ascii_uppercase, string.digits, "!@#$%^&*"
    chars = [random.choice(lower), random.choice(upper), random.choice(digits), random.choice(special)]
    chars += random.choices(lower + upper + digits + special, k=length - 4)
    random.shuffle(chars)
    return "".join(chars)


# ─── 临时邮箱 ────────────────────────────────────────────────────────────────

def create_tempmail(api_url: str, admin_password: str, timeout_sec: int = 30):
    log("步骤1: 创建临时邮箱...")
    name = "".join(random.choices("abcdefghijklmnopqrstuvwxyz0123456789", k=12))
    url = f"{api_url.rstrip('/')}/admin/new_address"
    try:
        resp = requests.post(url, headers={"x-admin-auth": admin_password, "Content-Type": "application/json"},
                             json={"enablePrefix": False, "name": name}, timeout=timeout_sec)
        if resp.status_code == 200:
            data = resp.json()
            log(f"✓ 临时邮箱创建成功: {data.get('address')}")
            return data.get("address"), data.get("jwt"), data.get("address_id")
        else:
            fail(f"创建临时邮箱失败，状态码: {resp.status_code}")
    except Exception as e:
        fail(f"创建临时邮箱超时或异常: {e}")

def delete_tempmail(api_url: str, admin_password: str, address_id):
    try:
        requests.delete(f"{api_url.rstrip('/')}/admin/delete_address/{address_id}",
                        headers={"x-admin-auth": admin_password}, timeout=10)
        log("✓ 临时邮箱已清理")
    except Exception:
        pass


# ─── 验证码轮询 ──────────────────────────────────────────────────────────────

def poll_verification_code(api_url: str, jwt: str, email: str,
                           max_tries: int = 10, interval: int = 5):
    import re
    log(f"步骤6: 开始轮询验证码（最多 {max_tries} 次，每次等待 {interval}s）...", email)
    url = f"{api_url.rstrip('/')}/api/mails?limit=20&offset=0"
    for attempt in range(1, max_tries + 1):
        log(f"  轮询 #{attempt}/{max_tries}...", email)
        try:
            resp = requests.get(url, headers={"Authorization": f"Bearer {jwt}"}, timeout=10)
            if resp.status_code == 200:
                messages = resp.json().get("results", [])
                log(f"  收件箱共 {len(messages)} 封邮件", email)
                for mail in messages:
                    raw = mail.get("raw", "")
                    source = mail.get("source", "")
                    if any(x in source.lower() for x in ["signin.aws","awsapps.com","amazonses.com","amazon.com"]):
                        for pat in [r"verification code is[:\s]*(\d{6})",r"Your code is[:\s]*(\d{6})",
                                    r"code is[:\s]*(\d{6})",r">\s*(\d{6})\s*<",r"\b(\d{6})\b"]:
                            m = re.search(pat, raw, re.IGNORECASE)
                            if m:
                                log(f"✓ 获取到验证码: {m.group(1)}", email)
                                return m.group(1)
                        log("  ⚠ 收到 AWS 邮件但未提取到验证码", email)
        except Exception as e:
            log(f"  轮询异常: {e}", email)
        if attempt < max_tries:
            log(f"  未找到验证码，{interval} 秒后重试...", email)
            time.sleep(interval)
    return None



# ─── authorize 模式注册流程 ──────────────────────────────────────────────────

async def register_aws_manual_debug(
    authorize_url: str,
    proxy_url: str = None,
    step_timeout: int = 300,
    browser_type: str = "playwright",
):
    """
    手动调试模式：打开浏览器到授权页面，让用户手动完成注册。
    注册完点击"允许访问"后，浏览器会跳转到本地回调地址，Rust 侧自动完成 token 换取。
    """
    fp = generate_fingerprint()
    log(f"[手动调试] 打开浏览器，请手动完成注册流程")
    log(f"[手动调试] 授权 URL: {authorize_url[:80]}...")
    log(f"[手动调试] 浏览器引擎: {browser_type}，指纹: os={fp['os']}")
    if proxy_url:
        log(f"[手动调试] 代理: {proxy_url}（127.0.0.1 直连）")

    try:
        async with BrowserContext(browser_type, proxy_url, fp) as ctx:
            page = await ctx.new_page()

            log("[手动调试] 正在打开授权页面...")
            await page.goto(authorize_url, wait_until="networkidle", timeout=60000)
            log("[手动调试] ✓ 页面已打开，请手动完成以下步骤：")
            log("[手动调试]   1. 输入邮箱")
            log("[手动调试]   2. 输入姓名")
            log("[手动调试]   3. 输入验证码")
            log("[手动调试]   4. 输入两次密码")
            log("[手动调试]   5. 点击'允许访问'按钮")
            log(f"[手动调试] 等待您完成操作（最多 {step_timeout} 秒）...")

            # 等待浏览器跳转到回调地址（无超时，一直等到用户完成）
            log(f"[手动调试] 等待您完成操作（无超时限制，完成后自动继续）...")
            while True:
                current_url = page.url
                if "127.0.0.1" in current_url or "localhost" in current_url:
                    log(f"[手动调试] ✓ 检测到回调跳转: {current_url}")
                    await asyncio.sleep(3)
                    break
                await asyncio.sleep(1)

            # 获取 SSO Token（如果有）
            cookies = await page.context.cookies()
            sso_token = next((c["value"] for c in cookies if c["name"] == "x-amz-sso_authn"), None)
            if sso_token:
                log("[手动调试] ✓ 获取到 SSO Token")

            success({
                "success": True,
                "sso_token": sso_token,
                "email": None,
                "name": None,
            })

    except SystemExit:
        raise
    except Exception as e:
        fail(f"手动调试模式异常: {e}")


async def register_aws_authorize(
    authorize_url: str,
    api_url: str,
    admin_password: str,
    proxy_url: str = None,
    account_password: str = None,
    slow_mode: bool = False,
    slow_min: float = 1.0,
    slow_max: float = 10.0,
    step_timeout: int = 60,
    browser_type: str = "camoufox",
):
    """
    通过 Kiro OAuth authorize_url 注册新 AWS Builder ID 账号。
    页面流程：邮箱 → 姓名 → 验证码 → 密码 → 允许访问
    browser_type: "camoufox" | "playwright"
    """
    timeout_ms = step_timeout * 1000
    password = account_password if account_password else _generate_password()
    name = random_name()
    fp = generate_fingerprint()

    log(f"授权注册模式 [{browser_type}]，姓名: {name}，指纹: os={fp['os']} {fp['screen']['width']}x{fp['screen']['height']}")
    if proxy_url:
        log(f"使用代理: {proxy_url}（127.0.0.1 直连）")

    email = jwt = address_id = None

    try:
        async with BrowserContext(browser_type, proxy_url, fp) as ctx:
            page = await ctx.new_page()

            # 步骤1：打开授权页面
            log("步骤1: 打开授权页面...")
            try:
                await page.goto(authorize_url, wait_until="networkidle", timeout=timeout_ms)
                log("✓ 授权页面已加载")
            except Exception as e:
                fail(f"步骤1失败: {e}")

            # 预热行为（模拟真实用户）
            await simulate_pre_registration_behavior(page)

            if await dismiss_cookie_banner(page):
                log("✓ 已关闭 Cookie 弹窗")

            # 步骤2：创建临时邮箱并输入
            email, jwt, address_id = create_tempmail(api_url, admin_password)
            log(f"临时邮箱: {email}")
            log("步骤2: 输入邮箱...")
            try:
                await page.wait_for_selector('input[placeholder="username@example.com"]', timeout=timeout_ms)
                await human_type(page, 'input[placeholder="username@example.com"]', email, slow_mode, slow_min, slow_max)
                await dismiss_cookie_banner(page)
                await human_click(page, 'button[data-testid="test-primary-button"]')
                log("✓ 邮箱已输入，点击继续")
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤2失败: {e}")

            # 步骤3：输入姓名
            log("步骤3: 等待姓名输入页面...")
            try:
                await page.wait_for_selector('input[placeholder="Maria José Silva"]', timeout=timeout_ms)
                # 检查是否有错误弹窗，有则等待后重试点击继续
                for retry in range(3):
                    await dismiss_error_banner(page)
                    await human_type(page, 'input[placeholder="Maria José Silva"]', name, slow_mode, slow_min, slow_max)
                    await human_click(page, 'button[data-testid="signup-next-button"]')
                    await asyncio.sleep(2)
                    # 检查是否还有错误弹窗
                    if not await dismiss_error_banner(page):
                        break
                    log(f"[反检测] 姓名提交出错，第 {retry+1}/3 次重试...")
                    await asyncio.sleep(3)
                log(f"✓ 姓名已输入: {name}，点击继续")
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤3失败: {e}")

            # 步骤4：等待并输入验证码
            log("步骤4: 等待验证码输入框...")
            code_selectors = ['input[placeholder="6 位数"]', 'input[placeholder="6-digit"]', 'input[data-testid*="code"]']
            code_selector = None
            try:
                tasks = [asyncio.ensure_future(page.wait_for_selector(sel, timeout=timeout_ms)) for sel in code_selectors]
                done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for t in pending: t.cancel()
                for i, task in enumerate(tasks):
                    if task in done and not task.cancelled():
                        try:
                            task.result()
                            code_selector = code_selectors[i]
                            log(f"✓ 验证码输入框已出现 (选择器: {code_selector})")
                            break
                        except Exception:
                            pass
            except Exception as e:
                log(f"等待验证码输入框异常: {e}")

            if not code_selector:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤4失败: 验证码输入框未出现（{step_timeout}s）")

            code = poll_verification_code(api_url, jwt, email, max_tries=10, interval=5)
            if not code:
                delete_tempmail(api_url, admin_password, address_id)
                fail("步骤4失败: 10次轮询未获取到验证码")

            try:
                await human_type(page, code_selector, code, slow_mode, slow_min, slow_max)
                await human_click(page, 'button[data-testid="email-verification-verify-button"]')
                log(f"✓ 验证码已输入: {code}，点击继续")
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤4失败（提交验证码）: {e}")

            # 步骤5：输入两次密码
            log("步骤5: 等待密码输入界面...")
            pwd_selector = None
            for sel in ['input[placeholder="Enter password"]', 'input[type="password"]']:
                try:
                    await page.wait_for_selector(sel, timeout=timeout_ms)
                    pwd_selector = sel
                    log("✓ 密码输入界面已出现")
                    break
                except Exception:
                    continue
            if not pwd_selector:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤5失败: 密码输入界面未出现（{step_timeout}s）")

            try:
                # 密码页面可能出现 Cookie 弹窗，先关掉再操作
                if await dismiss_cookie_banner(page):
                    log("✓ 已关闭 Cookie 弹窗")
                await human_type(page, pwd_selector, password, slow_mode, slow_min, slow_max)
                confirm_sel = 'input[placeholder="Re-enter password"]'
                try:
                    await page.wait_for_selector(confirm_sel, timeout=5000)
                    await human_type(page, confirm_sel, password, slow_mode, slow_min, slow_max)
                except Exception:
                    inputs = await page.query_selector_all('input[type="password"]')
                    if len(inputs) >= 2:
                        await inputs[1].fill(password)
                        log("✓ 使用第二个密码框输入确认密码")
                if await dismiss_cookie_banner(page):
                    log("✓ 已关闭 Cookie 弹窗")
                await human_click(page, 'button[data-testid="test-primary-button"]')
                log("✓ 密码已输入，点击继续")
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤5失败: {e}")

            # 步骤6：点击"允许访问"
            log("步骤6: 等待'允许访问'按钮...")
            try:
                await page.wait_for_selector('button[data-testid="allow-access-button"]', timeout=timeout_ms)
                await human_click(page, 'button[data-testid="allow-access-button"]')
                log("✓ 已点击'允许访问'，授权完成")
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤6失败: 未找到'允许访问'按钮: {e}")

            # 等待 SSO Token
            log(f"等待授权处理完成（最多 {step_timeout}s）...")
            sso_token = None
            deadline = asyncio.get_event_loop().time() + step_timeout
            while asyncio.get_event_loop().time() < deadline:
                cookies = await page.context.cookies()
                for c in cookies:
                    if c["name"] == "x-amz-sso_authn":
                        sso_token = c["value"]
                        break
                if sso_token:
                    log("✓ 获取到 SSO Token")
                    break
                await asyncio.sleep(1)

            delete_tempmail(api_url, admin_password, address_id)
            if not sso_token:
                fail("步骤6失败: 授权完成后未获取到 SSO Token")

            log("========== 授权注册成功！==========")

            # 保持浏览器打开，等待 OAuth 回调
            log(f"保持浏览器打开，等待 OAuth 回调（最多 {step_timeout}s）...")
            wait_deadline = asyncio.get_event_loop().time() + step_timeout
            while asyncio.get_event_loop().time() < wait_deadline:
                current_url = page.url
                if "127.0.0.1" in current_url or "localhost" in current_url:
                    log(f"✓ 浏览器已跳转到回调地址: {current_url}")
                    break
                await asyncio.sleep(1)

            success({"success": True, "sso_token": sso_token, "email": email, "name": name})

    except SystemExit:
        raise
    except Exception as e:
        if address_id is not None:
            delete_tempmail(api_url, admin_password, address_id)
        fail(f"授权注册异常: {e}")


# ─── register 模式注册流程（设备码方式）────────────────────────────────────────

async def register_aws(
    email: str, jwt: str, address_id,
    api_url: str, admin_password: str,
    proxy_url: str = None, account_password: str = None,
    slow_mode: bool = False, slow_min: float = 1.0, slow_max: float = 10.0,
    step_timeout: int = 60, user_code: str = None,
    browser_type: str = "camoufox",
):
    timeout_ms = step_timeout * 1000
    password = account_password if account_password else _generate_password()
    name = random_name()
    fp = generate_fingerprint()

    if user_code:
        log(f"使用 AWS 真实设备码: {user_code}", email)
    else:
        user_code = generate_user_code()
        log(f"⚠ 未收到真实设备码，本地随机生成（兜底）: {user_code}", email)

    log(f"[{browser_type}] user_code: {user_code}，姓名: {name}，"
        f"仿真模式: {'开启' if slow_mode else '关闭'}"
        + (f"（延迟 {slow_min}~{slow_max}s）" if slow_mode else "")
        + f"，步骤超时: {step_timeout}s", email)

    try:
        async with BrowserContext(browser_type, proxy_url, fp) as ctx:
            page = await ctx.new_page()

            url = f"https://view.awsapps.com/start/#/device?user_code={user_code}"
            log(f"步骤2: 启动浏览器，打开注册页面...", email)
            try:
                await page.goto(url, wait_until="networkidle", timeout=timeout_ms)
                log(f"✓ 注册页面已加载: {url}", email)
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤2失败: {e}")

            # 预热行为
            await simulate_pre_registration_behavior(page)

            log("步骤3: 输入邮箱...", email)
            try:
                await page.wait_for_selector('input[placeholder="username@example.com"]', timeout=timeout_ms)
                await human_type(page, 'input[placeholder="username@example.com"]', email, slow_mode, slow_min, slow_max)
                await human_click(page, 'button[data-testid="test-primary-button"]')
                log("✓ 邮箱已输入，点击继续", email)
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤3失败: {e}")

            log("步骤4: 等待姓名输入页面...", email)
            try:
                await page.wait_for_selector('input[placeholder="Maria José Silva"]', timeout=timeout_ms)
                for retry in range(3):
                    await dismiss_error_banner(page)
                    await human_type(page, 'input[placeholder="Maria José Silva"]', name, slow_mode, slow_min, slow_max)
                    await human_click(page, 'button[data-testid="signup-next-button"]')
                    await asyncio.sleep(2)
                    if not await dismiss_error_banner(page):
                        break
                    log(f"[反检测] 姓名提交出错，第 {retry+1}/3 次重试...", email)
                    await asyncio.sleep(3)
                log("✓ 姓名已输入，点击继续", email)
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤4失败: {e}")

            log(f"等待验证码输入框出现（超时 {step_timeout}s）...", email)
            code_selectors = ['input[placeholder="6 位数"]', 'input[placeholder="6-digit"]', 'input[data-testid*="code"]']
            code_selector = None
            try:
                tasks = [asyncio.ensure_future(page.wait_for_selector(sel, timeout=timeout_ms)) for sel in code_selectors]
                done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
                for t in pending: t.cancel()
                for i, task in enumerate(tasks):
                    if task in done and not task.cancelled():
                        try:
                            task.result()
                            code_selector = code_selectors[i]
                            log(f"✓ 验证码输入框已出现 (选择器: {code_selector})", email)
                            break
                        except Exception:
                            pass
            except Exception as e:
                log(f"等待验证码输入框异常: {e}", email)

            if not code_selector:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"等待验证码输入框超时（{step_timeout}s）")

            code = poll_verification_code(api_url, jwt, email, max_tries=10, interval=5)
            if not code:
                delete_tempmail(api_url, admin_password, address_id)
                fail("步骤6失败: 10次轮询未获取到验证码")

            log(f"步骤7: 输入验证码 {code}...", email)
            try:
                await human_type(page, code_selector, code, slow_mode, slow_min, slow_max)
                await human_click(page, 'button[data-testid="email-verification-verify-button"]')
                log("✓ 验证码已输入，点击继续", email)
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤7失败: {e}")

            log("步骤8: 等待密码输入界面...", email)
            pwd_selector = None
            for sel in ['input[placeholder="Enter password"]', 'input[type="password"]']:
                try:
                    await page.wait_for_selector(sel, timeout=timeout_ms)
                    pwd_selector = sel
                    log("✓ 密码输入界面已出现", email)
                    break
                except Exception:
                    continue
            if not pwd_selector:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤8失败: 密码输入界面未出现（{step_timeout}s）")

            log("步骤9: 输入密码...", email)
            try:
                # 密码页面可能出现 Cookie 弹窗，先关掉再操作
                if await dismiss_cookie_banner(page):
                    log("✓ 已关闭 Cookie 弹窗", email)
                await human_type(page, pwd_selector, password, slow_mode, slow_min, slow_max)
                confirm_sel = 'input[placeholder="Re-enter password"]'
                try:
                    await page.wait_for_selector(confirm_sel, timeout=5000)
                    await human_type(page, confirm_sel, password, slow_mode, slow_min, slow_max)
                except Exception:
                    inputs = await page.query_selector_all('input[type="password"]')
                    if len(inputs) >= 2:
                        await inputs[1].fill(password)
                        log("✓ 使用第二个密码框输入确认密码", email)
                await human_click(page, 'button[data-testid="test-primary-button"]')
                log("✓ 密码已输入，点击继续", email)
            except Exception as e:
                delete_tempmail(api_url, admin_password, address_id)
                fail(f"步骤9失败: {e}")

            # 等待 SSO Token
            log(f"等待 SSO Token（最多 {step_timeout}s）...", email)
            sso_token = None
            deadline = asyncio.get_event_loop().time() + step_timeout
            while asyncio.get_event_loop().time() < deadline:
                cookies = await page.context.cookies()
                for c in cookies:
                    if c["name"] == "x-amz-sso_authn":
                        sso_token = c["value"]
                        break
                if sso_token:
                    log(f"✓ 获取到 SSO Token", email)
                    break
                await asyncio.sleep(1)

            if not sso_token:
                delete_tempmail(api_url, admin_password, address_id)
                fail("步骤9失败: 未获取到 SSO Token")

            # 步骤10：Confirm and continue
            log("步骤10: 等待授权确认页面...", email)
            for sel in ['button:has-text("Confirm and continue")', 'button:has-text("确认并继续")', 'button[data-testid="confirm-button"]']:
                try:
                    await page.wait_for_selector(sel, timeout=10000)
                    await human_click(page, sel)
                    log("✓ 已点击 'Confirm and continue'", email)
                    break
                except Exception:
                    continue

            # 步骤11：Allow access
            log("步骤11: 等待访问授权页面...", email)
            for sel in ['button:has-text("Allow access")', 'button:has-text("允许访问")', 'button[data-testid="allow-access-button"]']:
                try:
                    await page.wait_for_selector(sel, timeout=10000)
                    await human_click(page, sel)
                    log("✓ 已点击 'Allow access'，设备授权完成", email)
                    break
                except Exception:
                    continue

            await asyncio.sleep(3)
            delete_tempmail(api_url, admin_password, address_id)
            log("========== 注册成功！==========", email)
            success({"success": True, "sso_token": sso_token, "email": email, "name": name})

    except SystemExit:
        raise
    except Exception as e:
        delete_tempmail(api_url, admin_password, address_id)
        fail(f"注册异常: {e}")


# ─── 入口 ────────────────────────────────────────────────────────────────────

async def main():
    try:
        input_data = json.loads(sys.stdin.read())
    except Exception as e:
        fail(f"解析输入参数失败: {e}")

    api_url        = input_data.get("api_url", "")
    admin_password = input_data.get("admin_password", "")
    proxy_url      = input_data.get("proxy_url")
    account_password = input_data.get("account_password")
    slow_mode      = input_data.get("slow_mode", False)
    slow_min       = float(input_data.get("slow_min", 1.0))
    slow_max       = float(input_data.get("slow_max", 10.0))
    step_timeout   = int(input_data.get("step_timeout", 60))
    register_mode  = input_data.get("register_mode", "register")
    authorize_url  = input_data.get("register_authorize_url")
    user_code      = input_data.get("user_code")
    browser_type   = input_data.get("browser_type", "camoufox")  # "camoufox" | "playwright"

    slow_min     = max(0.0, slow_min)
    slow_max     = max(slow_min, slow_max)
    step_timeout = max(10, step_timeout)

    if register_mode == "authorize" or register_mode == "manual_debug":
        if not authorize_url:
            fail("授权模式缺少 authorize_url")
        if register_mode == "manual_debug":
            await register_aws_manual_debug(
                authorize_url, proxy_url, step_timeout, browser_type,
            )
        else:
            await register_aws_authorize(
                authorize_url, api_url, admin_password,
                proxy_url, account_password,
                slow_mode, slow_min, slow_max, step_timeout,
                browser_type,
            )
        return

    if not api_url or not admin_password:
        fail("缺少必需参数: api_url 或 admin_password")

    email, jwt, address_id = create_tempmail(api_url, admin_password)
    await register_aws(
        email, jwt, address_id,
        api_url, admin_password,
        proxy_url, account_password,
        slow_mode, slow_min, slow_max, step_timeout,
        user_code, browser_type,
    )


if __name__ == "__main__":
    asyncio.run(main())
