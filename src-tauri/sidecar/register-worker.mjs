#!/usr/bin/env node
/**
 * 账号自动注册 Worker
 * 通过 stdout 输出 JSON 行格式的日志和结果，供 Tauri 后端读取
 * 格式：{"type":"log"|"result","data":...}
 *
 * 邮箱服务：仅支持自建 TempMail API，支持多个配置，可随机或指定使用
 */

import { chromium } from 'playwright'
import { randomBytes } from 'crypto'

// ===== 工具函数 =====

function emit(type, data) {
  process.stdout.write(JSON.stringify({ type, data }) + '\n')
}

function log(msg) {
  emit('log', msg)
}

function randomDelay(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min
  return new Promise(r => setTimeout(r, delay))
}

function generateRandomName() {
  const FIRST = ['James','Robert','John','Michael','David','William','Richard','Maria','Elizabeth','Jennifer','Linda','Barbara','Susan','Jessica']
  const LAST  = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Wilson','Anderson','Thomas','Taylor']
  return `${FIRST[Math.floor(Math.random()*FIRST.length)]} ${LAST[Math.floor(Math.random()*LAST.length)]}`
}

// ===== 指纹生成 =====

function generateFingerprint() {
  const OS_LIST = ['Windows','Windows','Windows','Windows','Windows','Windows','Windows','macOS','macOS','Linux']
  const os = OS_LIST[Math.floor(Math.random() * OS_LIST.length)]

  const CHROME_VERSIONS = ['120.0.0.0','121.0.0.0','122.0.0.0','123.0.0.0','124.0.0.0']
  const cv = CHROME_VERSIONS[Math.floor(Math.random() * CHROME_VERSIONS.length)]

  const UA_MAP = {
    Windows: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${cv} Safari/537.36`,
    macOS:   `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${cv} Safari/537.36`,
    Linux:   `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${cv} Safari/537.36`,
  }

  const SCREENS = {
    Windows: [{w:1920,h:1080},{w:2560,h:1440},{w:1366,h:768},{w:1536,h:864}],
    macOS:   [{w:2560,h:1600},{w:2880,h:1800},{w:2560,h:1440},{w:1920,h:1080}],
    Linux:   [{w:1920,h:1080},{w:2560,h:1440},{w:1366,h:768}],
  }
  const screen = SCREENS[os][Math.floor(Math.random() * SCREENS[os].length)]

  const TIMEZONES = [
    {name:'America/New_York',offset:-300},{name:'America/Chicago',offset:-360},
    {name:'America/Los_Angeles',offset:-480},{name:'Europe/London',offset:0},
    {name:'Europe/Paris',offset:60},{name:'Asia/Tokyo',offset:540},
    {name:'Asia/Shanghai',offset:480},
  ]
  const tz = TIMEZONES[Math.floor(Math.random() * TIMEZONES.length)]

  const WEBGL = {
    Windows: [
      {vendor:'Google Inc. (NVIDIA)',renderer:'ANGLE (NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)',uv:'NVIDIA Corporation',ur:'NVIDIA GeForce RTX 3060'},
      {vendor:'Google Inc. (Intel)',renderer:'ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)',uv:'Intel Inc.',ur:'Intel(R) UHD Graphics 630'},
    ],
    macOS: [
      {vendor:'Apple Inc.',renderer:'Apple M1',uv:'Apple Inc.',ur:'Apple M1'},
      {vendor:'Apple Inc.',renderer:'Apple M2',uv:'Apple Inc.',ur:'Apple M2'},
    ],
    Linux: [
      {vendor:'NVIDIA Corporation',renderer:'NVIDIA GeForce GTX 1060/PCIe/SSE2',uv:'NVIDIA Corporation',ur:'NVIDIA GeForce GTX 1060/PCIe/SSE2'},
    ],
  }
  const wgl = WEBGL[os][Math.floor(Math.random() * WEBGL[os].length)]

  const cores = [4,6,8,12,16][Math.floor(Math.random()*5)]
  const mem   = [4,8,16,32][Math.floor(Math.random()*4)]
  const seed  = randomBytes(16).toString('hex')

  return { os, userAgent: UA_MAP[os], screen, timezone: tz, webgl: wgl, cores, mem, seed }
}

function buildInjectionScript(fp) {
  return `
(function(){
  if(window.__fp_injected__) return;
  window.__fp_injected__ = true;
  try {
    Object.defineProperty(Navigator.prototype,'platform',{get:()=>'${fp.os==='Windows'?'Win32':fp.os==='macOS'?'MacIntel':'Linux x86_64'}'});
    Object.defineProperty(Navigator.prototype,'hardwareConcurrency',{get:()=>${fp.cores}});
    Object.defineProperty(Navigator.prototype,'deviceMemory',{get:()=>${fp.mem}});
    Object.defineProperty(Navigator.prototype,'maxTouchPoints',{get:()=>0});
    Object.defineProperty(Navigator.prototype,'language',{get:()=>'en-US'});
    Object.defineProperty(Navigator.prototype,'languages',{get:()=>['en-US','en']});
    Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>false});
    Object.defineProperty(Screen.prototype,'width',{get:()=>${fp.screen.w}});
    Object.defineProperty(Screen.prototype,'height',{get:()=>${fp.screen.h}});
    Object.defineProperty(Screen.prototype,'availWidth',{get:()=>${fp.screen.w}});
    Object.defineProperty(Screen.prototype,'availHeight',{get:()=>${fp.screen.h - (fp.os==='Windows'?40:25)}});
    Object.defineProperty(window,'devicePixelRatio',{get:()=>${fp.os==='macOS'?2:1}});
    const _gp = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function(p){
      if(p===37445) return '${fp.webgl.uv}';
      if(p===37446) return '${fp.webgl.ur}';
      if(p===7936)  return '${fp.webgl.vendor}';
      if(p===7937)  return '${fp.webgl.renderer}';
      return _gp.apply(this,arguments);
    };
    Date.prototype.getTimezoneOffset = function(){ return ${fp.timezone.offset}; };
    delete Object.getPrototypeOf(navigator).webdriver;
    if(window.RTCPeerConnection) window.RTCPeerConnection = function(){ throw new Error('disabled'); };
  } catch(e){}
})();
`
}

// ===== 临时邮箱（仅自建 API） =====

// AWS 发件人白名单
const AWS_SENDERS = [
  'signin.aws', 'awsapps.com', 'amazonses.com', 'amazon.com',
  'no-reply@signin.aws', 'no-reply@login.awsapps.com',
  'noreply@amazon.com', 'no-reply@aws.amazon.com', 'noreply@aws.amazon.com',
]

// 验证码提取正则（按优先级排列）
const CODE_PATTERNS = [
  /verification\s*code\s+is[:\s]*(\d{6})/i,
  /Your\s+code\s+is[:\s]*(\d{6})/i,
  /code\s+is[:\s]*(\d{6})/i,
  />\s*(\d{6})\s*</,
  /\b(\d{6})\b/,
]

function extractCode(text) {
  if (!text) return null
  for (const re of CODE_PATTERNS) {
    const m = text.match(re)
    if (m && /^\d{6}$/.test(m[1])) return m[1]
  }
  return null
}

function htmlToText(html) {
  if (!html) return ''
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ').trim()
}

function isAwsSender(from) {
  const s = (from || '').toLowerCase()
  return AWS_SENDERS.some(a => s.includes(a.toLowerCase()))
}

function randomMailName() {
  return Math.random().toString(36).slice(2, 14).replace(/[^a-z0-9]/g, 'x').padEnd(12, 'x').slice(0, 12)
}

/**
 * 根据选择策略从多个自建 API 中选一个
 * @param {Array<{name,apiUrl,adminKey}>} apis
 * @param {string} select - "random" 或数字索引字符串
 */
function pickMailApi(apis, select) {
  if (!apis || apis.length === 0) return null
  if (select === 'random' || select == null) {
    return apis[Math.floor(Math.random() * apis.length)]
  }
  const idx = parseInt(select, 10)
  if (!isNaN(idx) && idx >= 0 && idx < apis.length) return apis[idx]
  return apis[0]
}

/**
 * 创建临时邮箱（仅自建 API）
 * @param {{name,apiUrl,adminKey}} api - 选定的自建邮箱配置
 */
async function createTempMail(api) {
  if (!api || !api.apiUrl || !api.adminKey) {
    return null
  }
  const base = api.apiUrl.replace(/\/$/, '')
  const name = randomMailName()
  log(`[邮箱] 使用自建服务「${api.name || base}」创建邮箱: ${name}@...`)
  try {
    const r = await fetch(`${base}/admin/new_address`, {
      method: 'POST',
      headers: {
        'x-admin-auth': api.adminKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ enablePrefix: false, name }),
    })
    if (r.ok) {
      const d = await r.json()
      if (d.address && d.jwt) {
        log(`✓ 临时邮箱创建成功: ${d.address}`)
        return {
          email: d.address,
          token: d.jwt,
          password: Math.random().toString(36).slice(-8) + 'A1!',
          service: 'custom',
          addressId: d.address_id,
          api,
        }
      }
      log(`[邮箱] 响应格式异常: ${JSON.stringify(d)}`)
    } else {
      const errText = await r.text().catch(() => '')
      log(`[邮箱] 创建失败 HTTP ${r.status}: ${errText}`)
    }
  } catch (e) {
    log(`[邮箱] 请求异常: ${e.message}`)
  }
  return null
}

/**
 * 轮询收件箱，提取 AWS 验证码（仅自建 API）
 */
async function getTempMailCode(mailInfo, timeoutSec = 120) {
  const { token, email, api } = mailInfo
  log(`等待验证码 (邮箱: ${email})...`)

  const base = api.apiUrl.replace(/\/$/, '')
  const start = Date.now()
  const seen = new Set()

  while (Date.now() - start < timeoutSec * 1000) {
    try {
      const r = await fetch(`${base}/api/mails?limit=20&offset=0`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
      if (r.ok) {
        const d = await r.json()
        for (const item of d.results || []) {
          if (!isAwsSender(item.source)) continue
          const raw = item.raw || ''
          const bodyStart = raw.indexOf('\r\n\r\n')
          const body = bodyStart >= 0 ? raw.slice(bodyStart + 4) : raw
          const key = `${item.source}_${body.length}`
          if (seen.has(key)) continue
          seen.add(key)
          const text = htmlToText(body)
          const code = extractCode(text) || extractCode(body)
          if (code) {
            log(`✓ 找到验证码: ${code}`)
            return code
          }
        }
      }
    } catch (e) {
      // 忽略轮询错误，继续重试
    }
    await new Promise(r => setTimeout(r, 5000))
  }

  log('✗ 获取验证码超时')
  return null
}

/**
 * 注册完成后清理自建邮箱
 */
async function deleteTempMail(mailInfo) {
  if (!mailInfo?.addressId || !mailInfo?.api) return
  const { apiUrl, adminKey } = mailInfo.api
  const base = apiUrl.replace(/\/$/, '')
  try {
    await fetch(`${base}/admin/delete_address/${mailInfo.addressId}`, {
      method: 'DELETE',
      headers: { 'x-admin-auth': adminKey },
    })
    log(`[邮箱] 已清理邮箱 ID: ${mailInfo.addressId}`)
  } catch {}
}

// ===== 浏览器操作辅助 =====

async function waitAndFill(page, selector, value, desc, timeout = 30000) {
  try {
    const el = page.locator(selector).first()
    await el.waitFor({ state: 'visible', timeout })
    await el.click()
    await randomDelay(100, 200)
    await el.clear()
    for (const ch of value) {
      await el.pressSequentially(ch, { delay: Math.floor(Math.random()*80)+40 })
    }
    log(`✓ 已输入${desc}`)
    return true
  } catch (e) {
    log(`✗ 输入${desc}失败: ${e.message}`)
    return false
  }
}

async function tryClick(page, selectors, desc, timeout = 15000) {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first()
      await el.waitFor({ state: 'visible', timeout: Math.floor(timeout / selectors.length) })
      await randomDelay(200, 400)
      await el.click()
      log(`✓ 已点击${desc}`)
      return true
    } catch {}
  }
  log(`⚠ 未找到${desc}`)
  return false
}

// ===== 核心注册流程 =====

async function registerOne(opts) {
  const { userCode, verificationUri, proxyUrl, useFingerprint, incognito, headless = true, mailApi } = opts

  // 1. 申请临时邮箱（仅自建 API）
  log('申请临时邮箱...')
  if (!mailApi) {
    return { success: false, error: '未配置自建邮箱 API，请在设置中添加至少一个邮箱服务' }
  }
  const mail = await createTempMail(mailApi)
  if (!mail) return { success: false, error: `自建邮箱「${mailApi.name || mailApi.apiUrl}」创建失败` }

  const { email, password } = mail
  const name = generateRandomName()
  // 注册开始时明文打印账号信息，方便查看和记录
  log(`========== 账号注册信息 ==========`)
  log(`邮箱:   ${email}`)
  log(`密码:   ${password}`)
  log(`姓名:   ${name}`)
  log(`user_code: ${userCode || '（未提供，将无法自动获取 token）'}`)
  log(`==================================`)

  // 2. 生成指纹
  const fp = useFingerprint ? generateFingerprint() : null
  if (fp) log(`[指纹] OS=${fp.os} UA=${fp.userAgent.substring(0,60)}...`)

  let browser = null
  try {
    // 3. 启动浏览器
    log(`启动浏览器 (${headless ? '无头模式' : '有头模式'})...`)
    const launchOpts = {
      headless,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox'],
    }
    if (proxyUrl) launchOpts.proxy = { server: proxyUrl }

    browser = await chromium.launch(launchOpts)

    const ctxOpts = {
      viewport: { width: 1400, height: 900 },
      userAgent: fp ? fp.userAgent : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
    if (fp) {
      ctxOpts.locale = 'en-US'
      ctxOpts.timezoneId = fp.timezone.name
    }
    if (incognito) ctxOpts.acceptDownloads = false

    const ctx = await browser.newContext(ctxOpts)
    const page = await ctx.newPage()

    if (fp) {
      await page.addInitScript(buildInjectionScript(fp))
      log('[指纹] 注入完成')
    }

    // 4. 打开注册页面
    const url = verificationUri || `https://view.awsapps.com/start/#/device?user_code=${userCode}`
    log(`打开注册页面: ${url}`)
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 })
    log('✓ 页面加载完成')

    // 模拟预热
    await randomDelay(800, 1500)
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => window.scrollBy(0, Math.random()*200-100))
      await randomDelay(300, 600)
    }

    // 5. 输入邮箱
    if (!await waitAndFill(page, 'input[placeholder="username@example.com"]', email, '邮箱')) {
      throw new Error('未找到邮箱输入框')
    }
    await randomDelay(500, 1000)

    // 6. 点击第一个继续
    if (!await tryClick(page, ['button[data-testid="test-primary-button"]'], '第一个继续按钮')) {
      throw new Error('点击继续按钮失败')
    }
    await randomDelay(2000, 3000)

    // 7. 判断是新注册还是已有账号
    const nameInputSel = 'input[placeholder="Maria José Silva"]'
    const loginHeadingSel = 'span[class*="awsui_heading-text"]:has-text("Sign in with your AWS Builder ID")'
    const verifyInputSel = 'input[placeholder="6-digit"]'

    let flow = 'register'
    try {
      const result = await Promise.race([
        page.locator(nameInputSel).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => 'register'),
        page.locator(loginHeadingSel).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => 'login'),
        page.locator(verifyInputSel).first().waitFor({ state: 'visible', timeout: 10000 }).then(() => 'verify'),
      ])
      flow = result
    } catch {}

    log(`检测到流程: ${flow}`)

    if (flow === 'login' || flow === 'verify') {
      // 已有账号，走登录+验证码流程
      if (flow === 'login') {
        log('步骤: 输入登录密码...')
        if (!await waitAndFill(page, 'input[placeholder="Enter password"]', password, '密码')) {
          throw new Error('未找到密码输入框')
        }
        await randomDelay(500, 800)
        await tryClick(page, ['button[data-testid="test-primary-button"]'], '登录继续按钮')
        await randomDelay(2000, 3000)
      }

      log('步骤: 等待验证码...')
      const code = await getTempMailCode(mail, 120)
      if (!code) throw new Error('获取验证码超时')

      if (!await waitAndFill(page, 'input[placeholder="6-digit"]', code, '验证码')) {
        throw new Error('输入验证码失败')
      }
      await randomDelay(500, 800)
      await tryClick(page, ['button[data-testid="test-primary-button"]'], '验证码确认按钮')
      await randomDelay(3000, 5000)

    } else {
      // 新注册流程
      log('步骤: 输入姓名...')
      if (!await waitAndFill(page, nameInputSel, name, '姓名')) {
        throw new Error('未找到姓名输入框')
      }
      await randomDelay(500, 800)

      await tryClick(page, ['button[data-testid="signup-next-button"]'], '第二个继续按钮')
      await randomDelay(2000, 3000)

      log('步骤: 等待验证码...')
      const code = await getTempMailCode(mail, 120)
      if (!code) throw new Error('获取验证码超时')

      if (!await waitAndFill(page, 'input[placeholder="6-digit"]', code, '验证码')) {
        throw new Error('输入验证码失败')
      }
      await randomDelay(500, 800)

      // 处理 Cookie 弹窗
      try {
        const cb = page.locator('button:has-text("Accept")').first()
        if (await cb.isVisible({ timeout: 2000 })) { await cb.click(); log('✓ 关闭 Cookie 弹窗') }
      } catch {}

      // 点击验证码确认
      const verifyBtn = 'button[data-testid="email-verification-verify-button"]'
      await tryClick(page, [verifyBtn], 'Continue 按钮', 30000)
      await randomDelay(3000, 5000)

      // 等待密码输入框（最多重试 15 次）
      let pwVisible = false
      for (let i = 0; i < 15; i++) {
        try {
          if (await page.locator('input[placeholder="Enter password"]').first().isVisible({ timeout: 3000 })) {
            pwVisible = true; break
          }
        } catch {}
        // 如果还在验证码页面，重试点击
        try {
          if (await page.locator('input[placeholder="6-digit"]').first().isVisible({ timeout: 1000 })) {
            log(`⚠ 仍在验证码页面，重试 (${i+1}/15)...`)
            await tryClick(page, [verifyBtn], 'Continue 按钮（重试）', 5000)
          }
        } catch {}
        await randomDelay(3000, 5000)
      }
      if (!pwVisible) throw new Error('验证码提交失败，无法进入密码步骤')

      log('步骤: 输入密码...')
      if (!await waitAndFill(page, 'input[placeholder="Enter password"]', password, '密码')) {
        throw new Error('未找到密码输入框')
      }
      await randomDelay(300, 500)
      if (!await waitAndFill(page, 'input[placeholder="Re-enter password"]', password, '确认密码')) {
        // 尝试备用选择器
        await waitAndFill(page, 'input[placeholder="Confirm password"]', password, '确认密码')
      }
      await randomDelay(500, 800)

      await tryClick(page, ['button[data-testid="test-primary-button"]'], '第三个继续按钮')
      await randomDelay(4000, 6000)
    }

    // 8. 授权确认
    log('步骤: 等待授权确认...')
    await tryClick(page, [
      'button:has-text("Confirm and continue")',
      'button:has-text("确认并继续")',
    ], '"Confirm and continue" 按钮', 20000)
    await randomDelay(3000, 5000)

    await tryClick(page, [
      'button:has-text("Allow access")',
      'button:has-text("允许访问")',
    ], '"Allow access" 按钮', 20000)
    await randomDelay(8000, 12000)

    // 9. 等待授权完成（检测 SSO Cookie）
    log('步骤: 等待授权完成...')
    let authDone = false
    for (let i = 0; i < 60; i++) {
      const cookies = await ctx.cookies()
      if (cookies.find(c => c.name === 'x-amz-sso_authn')) {
        authDone = true
        log('✓ 检测到 SSO Cookie，授权完成')
        break
      }
      const url2 = page.url()
      if (url2.includes('/start') && !url2.includes('/device') && !url2.includes('/signup')) {
        authDone = true
        log('✓ 页面跳转到成功页面')
        break
      }
      await randomDelay(1000, 1000)
    }

    if (!authDone) throw new Error('授权超时')

    await browser.close()
    browser = null

    // 注册完成后清理自建邮箱
    await deleteTempMail(mail)

    log('✅ 注册成功！')
    return { success: true, email, password, name }

  } catch (err) {
    if (browser) { try { await browser.close() } catch {} }
    // 失败时也清理邮箱
    await deleteTempMail(mail)
    return { success: false, error: err.message || String(err) }
  }
}

// ===== 主入口 =====

async function main() {
  // 从 stdin 读取参数
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk

  let opts
  try {
    opts = JSON.parse(raw.trim())
  } catch {
    emit('result', { success: false, error: '参数解析失败' })
    process.exit(1)
  }

  const {
    count = 1,
    concurrency = 1,
    proxyUrl,
    useFingerprint = true,
    incognito = true,
    headless = true,
    userCode,
    verificationUri,
    region = 'us-east-1',
    tempMailApis = [],
    tempMailSelect,
  } = opts

  // 校验：必须有至少一个自建邮箱配置
  if (!tempMailApis || tempMailApis.length === 0) {
    emit('result', { success: false, error: '未配置自建邮箱 API，请在设置中添加至少一个邮箱服务' })
    process.exit(0)
  }

  log(`已加载 ${tempMailApis.length} 个自建邮箱配置，选择策略: ${tempMailSelect || 'random'}`)
  tempMailApis.forEach((api, i) => log(`  [${i}] ${api.name || api.apiUrl}`))

  log(`开始注册 ${count} 个账号，并发 ${concurrency}`)
  log(`浏览器模式: ${headless ? '无头（后台）' : '有头（可见窗口）'}`)

  const results = []
  const tasks = Array.from({ length: count }, (_, i) => i)
  let next = 0

  const workers = Array.from({ length: Math.min(concurrency, count) }, async () => {
    while (true) {
      const idx = next++
      if (idx >= tasks.length) return

      // 每个任务独立选择邮箱 API（random 时每次重新随机）
      const mailApi = pickMailApi(tempMailApis, tempMailSelect)
      log(`[${idx+1}/${count}] 开始注册，使用邮箱服务: ${mailApi?.name || mailApi?.apiUrl || '未知'}`)

      const r = await registerOne({ userCode, verificationUri, proxyUrl, useFingerprint, incognito, headless, mailApi })
      results[idx] = r
      if (r.success) {
        log(`[${idx+1}/${count}] ✅ 成功: ${r.email}`)
      } else {
        log(`[${idx+1}/${count}] ❌ 失败: ${r.error}`)
      }
    }
  })

  await Promise.all(workers)

  emit('result', { results, ok: results.filter(r=>r?.success).length, fail: results.filter(r=>r&&!r.success).length })
}

main().catch(err => {
  emit('result', { success: false, error: err.message || String(err) })
  process.exit(1)
})
