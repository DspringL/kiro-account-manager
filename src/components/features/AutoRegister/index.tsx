import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  UserPlus, Play, Square, Settings, Terminal, CheckCircle,
  XCircle, AlertCircle, Download, Mail, ChevronDown, ChevronUp,
  Copy, RefreshCw,
} from 'lucide-react'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Switch } from '../../ui/switch'
import { Badge } from '../../ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'

// ===== 类型 =====

type MailService = 'auto' | 'custom' | 'tempmail.lol' | '1secmail' | 'mail.tm'

interface RegisterParams {
  count: number
  concurrency: number
  proxyUrl: string
  useFingerprint: boolean
  incognito: boolean
  headless: boolean
  region: string
  mailService: MailService
  tempMailApiUrl: string
  tempMailAdminKey: string
  userCode?: string
  verificationUri?: string
}

interface RegisterRecord {
  success: boolean
  email?: string
  password?: string
  name?: string
  error?: string
}

interface RegisterResult {
  results: RegisterRecord[]
  ok: number
  fail: number
}

interface DeviceLoginInfo {
  userCode: string
  verificationUri: string
  deviceCode: string
  clientId: string
  clientSecret: string
  region: string
  interval: number
  expiresIn: number
  expiresAt: number
}

const MAIL_SERVICE_OPTIONS: { value: MailService; label: string; desc: string }[] = [
  { value: 'auto',        label: '自动（推荐）',    desc: '优先自建，依次降级到公共服务' },
  { value: 'custom',      label: '自建 TempMail',  desc: '使用自建 API，需填写地址和密码' },
  { value: 'tempmail.lol',label: 'tempmail.lol',   desc: '公共临时邮箱服务' },
  { value: '1secmail',    label: '1secmail.com',   desc: '公共临时邮箱服务' },
  { value: 'mail.tm',     label: 'mail.tm',        desc: '公共临时邮箱服务' },
]

// ===== 主组件 =====

export default function AutoRegister() {
  // 环境
  const [nodeOk,       setNodeOk]       = useState<boolean | null>(null)
  const [playwrightOk, setPlaywrightOk] = useState<boolean | null>(null)
  const [installing,   setInstalling]   = useState(false)

  // 参数
  const [params, setParams] = useState<RegisterParams>({
    count: 1, concurrency: 1,
    proxyUrl: '', useFingerprint: true, incognito: true, headless: true,
    region: 'us-east-1',
    mailService: 'auto',
    tempMailApiUrl: '', tempMailAdminKey: '',
  })

  // 折叠状态
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showDevice,   setShowDevice]   = useState(false)

  // 设备码
  const [deviceInfo,    setDeviceInfo]    = useState<DeviceLoginInfo | null>(null)
  const [loadingDevice, setLoadingDevice] = useState(false)
  const [deviceExpired, setDeviceExpired] = useState(false)

  // 运行
  const [running, setRunning] = useState(false)
  const [logs,    setLogs]    = useState<string[]>([])
  const [result,  setResult]  = useState<RegisterResult | null>(null)
  const logsEndRef  = useRef<HTMLDivElement>(null)
  const unlistenRef = useRef<(() => void) | null>(null)

  // 自动滚动
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])

  useEffect(() => { checkEnv() }, [])
  useEffect(() => () => { unlistenRef.current?.() }, [])

  // 设备码倒计时
  useEffect(() => {
    if (!deviceInfo) return
    const id = setInterval(() => {
      if (Date.now() >= deviceInfo.expiresAt) { setDeviceExpired(true); clearInterval(id) }
    }, 10000)
    return () => clearInterval(id)
  }, [deviceInfo])

  async function checkEnv() {
    try {
      const node = await invoke<boolean>('check_node_available')
      setNodeOk(node)
      if (node) {
        const pw = await invoke<boolean>('check_playwright_installed')
        setPlaywrightOk(pw)
      }
    } catch { setNodeOk(false) }
  }

  async function handleInstallDeps() {
    setInstalling(true)
    setLogs([])
    try {
      const unlisten = await listen<string>('register-log', e => setLogs(p => [...p, e.payload]))
      unlistenRef.current = unlisten
      await invoke('install_register_deps')
      setLogs(p => [...p, '✅ 依赖安装完成！'])
      await checkEnv()
    } catch (e: any) {
      setLogs(p => [...p, `❌ 安装失败: ${e}`])
    } finally {
      setInstalling(false)
      unlistenRef.current?.(); unlistenRef.current = null
    }
  }

  async function handleStop() {
    try {
      await invoke('stop_auto_register')
    } catch (e: any) {
      setLogs(p => [...p, `⚠ 停止失败: ${e}`])
    }
  }

  async function handleGetDeviceCode() {
    setLoadingDevice(true)
    setDeviceExpired(false)
    try {
      const info = await invoke<DeviceLoginInfo>('start_builder_id_device_login', {
        region: params.region || 'us-east-1',
      })
      setDeviceInfo(info)
      setParams(p => ({ ...p, userCode: info.userCode, verificationUri: info.verificationUri }))
    } catch (e: any) {
      setLogs(p => [...p, `❌ 获取设备码失败: ${e}`])
    } finally { setLoadingDevice(false) }
  }

  const handleStart = useCallback(async () => {
    if (running) return
    setRunning(true); setLogs([]); setResult(null)
    try {
      const unlisten = await listen<string>('register-log', e => setLogs(p => [...p, e.payload]))
      unlistenRef.current = unlisten

      // 根据邮箱服务选择决定传哪些参数
      const isCustom = params.mailService === 'custom' || params.mailService === 'auto'
      const finalParams = {
        count:          params.count,
        concurrency:    params.concurrency,
        proxyUrl:       params.proxyUrl.trim() || undefined,
        useFingerprint: params.useFingerprint,
        incognito:      params.incognito,
        headless:       params.headless,
        region:         params.region,
        userCode:       params.userCode,
        verificationUri:params.verificationUri,
        tempMailApiUrl:  isCustom ? (params.tempMailApiUrl.trim() || undefined) : undefined,
        tempMailAdminKey:isCustom ? (params.tempMailAdminKey.trim() || undefined) : undefined,
        forcedMailService: params.mailService !== 'auto' ? params.mailService : undefined,
      }

      const res = await invoke<RegisterResult>('run_auto_register', { params: finalParams })
      setResult(res)
      setLogs(p => [...p, `\n✅ 完成！成功 ${res.ok} 个，失败 ${res.fail} 个`])
    } catch (e: any) {
      setLogs(p => [...p, `❌ 注册失败: ${e}`])
    } finally {
      setRunning(false)
      unlistenRef.current?.(); unlistenRef.current = null
    }
  }, [running, params])

  const canStart = nodeOk && playwrightOk && !running
  const needCustomConfig = (params.mailService === 'custom' || params.mailService === 'auto')
    && params.tempMailApiUrl && !params.tempMailAdminKey

  // ===== 渲染 =====
  return (
    <div className="flex h-full overflow-hidden">

      {/* ── 左侧配置面板 ── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-border overflow-y-auto">
        {/* 标题 */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-border flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <UserPlus size={16} className="text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold">自动注册账号</div>
            <div className="text-xs text-muted-foreground">批量注册 AWS Builder ID</div>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4">

          {/* 环境检查 */}
          <Section title="环境检查" icon={<Settings size={13} />}>
            <EnvItem label="Node.js" ok={nodeOk} />
            <EnvItem label="Playwright Chromium" ok={playwrightOk} />
            {nodeOk === false && (
              <p className="text-xs text-destructive mt-1">请先安装 Node.js 18+</p>
            )}
            {nodeOk && playwrightOk === false && (
              <Button size="sm" variant="outline" onClick={handleInstallDeps}
                disabled={installing} className="w-full mt-1">
                <Download size={12} className="mr-1.5" />
                {installing ? '安装中...' : '安装 Playwright 依赖'}
              </Button>
            )}
          </Section>

          {/* 基础参数 */}
          <Section title="注册参数">
            <div className="grid grid-cols-2 gap-2">
              <Field label="注册数量">
                <Input type="number" min={1} max={50} value={params.count} disabled={running}
                  onChange={e => setParams(p => ({ ...p, count: Math.max(1, +e.target.value || 1) }))} />
              </Field>
              <Field label="并发数">
                <Input type="number" min={1} max={5} value={params.concurrency} disabled={running}
                  onChange={e => setParams(p => ({ ...p, concurrency: Math.max(1, +e.target.value || 1) }))} />
              </Field>
            </div>
            <Field label="代理地址（可选）">
              <Input placeholder="http://127.0.0.1:7890" value={params.proxyUrl} disabled={running}
                onChange={e => setParams(p => ({ ...p, proxyUrl: e.target.value }))} />
            </Field>
            <Field label="AWS 区域">
              <Input placeholder="us-east-1" value={params.region} disabled={running}
                onChange={e => setParams(p => ({ ...p, region: e.target.value }))} />
            </Field>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">指纹伪装</span>
              <Switch checked={params.useFingerprint} disabled={running}
                onCheckedChange={v => setParams(p => ({ ...p, useFingerprint: v }))} />
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">无痕模式</span>
              <Switch checked={params.incognito} disabled={running}
                onCheckedChange={v => setParams(p => ({ ...p, incognito: v }))} />
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-xs text-muted-foreground">无头模式（后台运行）</span>
              <Switch checked={params.headless} disabled={running}
                onCheckedChange={v => setParams(p => ({ ...p, headless: v }))} />
            </div>
            {!params.headless && (
              <p className="text-[11px] text-yellow-500 -mt-1">
                ⚠ 关闭无头模式后浏览器窗口可见，便于调试
              </p>
            )}
          </Section>

          {/* 邮箱服务 */}
          <Section title="临时邮箱服务" icon={<Mail size={13} />}>
            {/* 服务选择 */}
            <div className="flex flex-col gap-1.5">
              {MAIL_SERVICE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  disabled={running}
                  onClick={() => setParams(p => ({ ...p, mailService: opt.value }))}
                  className={[
                    'flex items-start gap-2 px-3 py-2 rounded-lg border text-left transition-colors',
                    params.mailService === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50',
                    running ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <div className={[
                    'w-3.5 h-3.5 rounded-full border-2 mt-0.5 flex-shrink-0 transition-colors',
                    params.mailService === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground',
                  ].join(' ')} />
                  <div>
                    <div className="text-xs font-medium">{opt.label}</div>
                    <div className="text-[11px] text-muted-foreground">{opt.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* 自建邮箱配置（custom 或 auto 时显示） */}
            {(params.mailService === 'custom' || params.mailService === 'auto') && (
              <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">自建 API 配置</span>
                  {params.tempMailApiUrl && params.tempMailAdminKey && (
                    <Badge variant="outline" className="text-[10px] text-green-600 border-green-500 h-4 px-1.5">
                      <CheckCircle size={8} className="mr-1" />已配置
                    </Badge>
                  )}
                </div>
                <Field label="API 地址">
                  <Input placeholder="https://your-tempmail-api.example.com"
                    value={params.tempMailApiUrl} disabled={running}
                    onChange={e => setParams(p => ({ ...p, tempMailApiUrl: e.target.value }))} />
                </Field>
                <Field label="Admin 密码">
                  <Input type="password" placeholder="YOUR_ADMIN_PASSWORD"
                    value={params.tempMailAdminKey} disabled={running}
                    onChange={e => setParams(p => ({ ...p, tempMailAdminKey: e.target.value }))} />
                </Field>
                {needCustomConfig && (
                  <p className="text-[11px] text-yellow-500">⚠ 已填 API 地址，请同时填写 Admin 密码</p>
                )}
                {params.mailService === 'auto' && (
                  <p className="text-[11px] text-muted-foreground">
                    auto 模式：有配置则优先自建，否则自动降级到公共服务
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* 高级设置（折叠） */}
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowAdvanced(v => !v)}
          >
            {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            高级设置（AWS 设备码）
          </button>

          {showAdvanced && (
            <Section title="AWS 设备码（可选）">
              <p className="text-[11px] text-muted-foreground">
                获取设备码后注册完成可自动拿到 refreshToken，不获取也能正常注册。
              </p>
              <Button size="sm" variant="outline" onClick={handleGetDeviceCode}
                disabled={running || loadingDevice} className="w-full">
                <RefreshCw size={12} className={['mr-1.5', loadingDevice ? 'animate-spin' : ''].join(' ')} />
                {loadingDevice ? '获取中...' : '获取设备码'}
              </Button>
              {deviceInfo && (
                <div className={['flex flex-col gap-1.5 p-2 rounded-lg border', deviceExpired ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-muted/30'].join(' ')}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold tracking-widest">{deviceInfo.userCode}</span>
                    <button onClick={() => navigator.clipboard.writeText(deviceInfo.userCode)}
                      className="text-muted-foreground hover:text-foreground">
                      <Copy size={11} />
                    </button>
                    {deviceExpired
                      ? <Badge variant="destructive" className="text-[10px] h-4 px-1.5 ml-auto">已过期</Badge>
                      : <Badge variant="outline" className="text-[10px] h-4 px-1.5 ml-auto text-green-600 border-green-500">有效</Badge>
                    }
                  </div>
                  <p className="text-[10px] text-muted-foreground break-all">{deviceInfo.verificationUri}</p>
                </div>
              )}
            </Section>
          )}

          {/* 开始 / 停止按钮 */}
          {running ? (
            <Button size="default" variant="destructive" onClick={handleStop} className="w-full mt-1">
              <Square size={14} className="mr-2" />
              停止注册
            </Button>
          ) : (
            <Button size="default" onClick={handleStart} disabled={!canStart} className="w-full mt-1">
              <Play size={14} className="mr-2" />
              开始注册
            </Button>
          )}

        </div>
      </div>

      {/* ── 右侧：日志 + 结果 ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* 结果条（有结果时显示） */}
        {result && (
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/30 flex-shrink-0">
            <span className="text-sm font-medium">注册完成</span>
            <Badge className="bg-green-500 hover:bg-green-500">成功 {result.ok}</Badge>
            <Badge variant="destructive">失败 {result.fail}</Badge>
            <button className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowDevice(v => !v)}>
              {showDevice ? '收起明细' : '展开明细'}
            </button>
          </div>
        )}

        {/* 结果明细（可折叠） */}
        {result && showDevice && (
          <div className="border-b border-border bg-muted/20 max-h-48 overflow-y-auto flex-shrink-0">
            {result.results.map((r, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-1.5 text-xs border-b border-border/40 last:border-0">
                {r.success
                  ? <CheckCircle size={12} className="text-green-500 flex-shrink-0" />
                  : <XCircle    size={12} className="text-destructive flex-shrink-0" />
                }
                <span className="flex-1 truncate font-mono">{r.success ? r.email : r.error}</span>
                {r.success && r.password && (
                  <span className="text-muted-foreground font-mono flex-shrink-0">{r.password}</span>
                )}
                {r.success && r.email && (
                  <button onClick={() => navigator.clipboard.writeText(`${r.email}\t${r.password}`)}
                    className="text-muted-foreground hover:text-foreground flex-shrink-0">
                    <Copy size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 日志区 */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-shrink-0">
            <Terminal size={13} className="text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">运行日志</span>
            {running && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse ml-1" />}
            <div className="ml-auto flex items-center gap-2">
              {running && (
                <button
                  onClick={handleStop}
                  className="text-[11px] text-destructive hover:text-destructive/80 flex items-center gap-1 border border-destructive/40 rounded px-1.5 py-0.5"
                >
                  <Square size={9} />停止
                </button>
              )}
              {logs.length > 0 && (
                <button className="text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setLogs([])}>
                  清空
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-5">
            {logs.length === 0 ? (
              <p className="text-muted-foreground">等待开始...</p>
            ) : (
              logs.map((line, i) => <LogLine key={i} text={line} />)
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

      </div>
    </div>
  )
}

// ===== 子组件 =====

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/70">
        {icon}
        {title}
      </div>
      <div className="flex flex-col gap-2 pl-0.5">
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function EnvItem({ label, ok }: { label: string; ok: boolean | null }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs">{label}</span>
      {ok === null ? (
        <span className="text-[11px] text-muted-foreground">检查中...</span>
      ) : ok ? (
        <span className="text-[11px] text-green-600 flex items-center gap-1">
          <CheckCircle size={10} />已就绪
        </span>
      ) : (
        <span className="text-[11px] text-destructive flex items-center gap-1">
          <AlertCircle size={10} />未安装
        </span>
      )}
    </div>
  )
}

function LogLine({ text }: { text: string }) {
  const cls =
    text.includes('✅') || text.includes('✓') || text.includes('成功') ? 'text-green-600 dark:text-green-400' :
    text.includes('❌') || text.includes('✗') || text.includes('失败') || text.includes('错误') ? 'text-red-500' :
    text.includes('⚠') ? 'text-yellow-500' :
    text.startsWith('[') ? 'text-blue-500 dark:text-blue-400' :
    'text-foreground/75'
  return <div className={cls}>{text || '\u00A0'}</div>
}
