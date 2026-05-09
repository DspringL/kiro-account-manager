import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import {
  UserPlus, Play, Square, Settings, Terminal, CheckCircle,
  XCircle, AlertCircle, Download, Mail, Plus, Trash2, Copy, RefreshCw, Link,
} from 'lucide-react'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Switch } from '../../ui/switch'
import { Badge } from '../../ui/badge'

// ===== 类型 =====

type RegisterMode = 'device' | 'authorize'

/** 单个自建邮箱 API 配置 */
interface TempMailApi {
  name: string
  apiUrl: string
  adminKey: string
}

interface RegisterParams {
  count: number
  concurrency: number
  proxyUrl: string
  useFingerprint: boolean
  incognito: boolean
  headless: boolean
  region: string
  /** 多个自建邮箱 API 配置 */
  tempMailApis: TempMailApi[]
  /** 选择策略："random" 或数字索引字符串 */
  tempMailSelect: string
}

/** start_authorize_register 返回的信息 */
interface AuthorizeInfo {
  authorizeUrl: string
  callbackPort: number
  clientId: string
  clientSecret: string
  codeVerifier: string
  redirectUri: string
  state: string
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

// ===== 主组件 =====

export default function AutoRegister() {
  // 环境
  const [nodeOk,       setNodeOk]       = useState<boolean | null>(null)
  const [playwrightOk, setPlaywrightOk] = useState<boolean | null>(null)
  const [installing,   setInstalling]   = useState(false)

  // 注册模式
  const [registerMode, setRegisterMode] = useState<RegisterMode>('device')

  // 授权码模式状态
  const [authorizeInfo,    setAuthorizeInfo]    = useState<AuthorizeInfo | null>(null)
  const [authorizeLoading, setAuthorizeLoading] = useState(false)

  // 持久化 key
  const STORAGE_KEY = 'autoRegister_mailApis'
  const STORAGE_SELECT_KEY = 'autoRegister_mailSelect'

  // 参数（邮箱配置从 localStorage 恢复）
  const [params, setParams] = useState<RegisterParams>(() => {
    let savedApis: TempMailApi[] = []
    let savedSelect = 'random'
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) savedApis = JSON.parse(raw)
      savedSelect = localStorage.getItem(STORAGE_SELECT_KEY) || 'random'
    } catch {}
    return {
      count: 1, concurrency: 1,
      proxyUrl: '', useFingerprint: true, incognito: true, headless: true,
      region: 'us-east-1',
      tempMailApis: savedApis,
      tempMailSelect: savedSelect,
    }
  })

  // 代理自动获取
  const [proxyLoading, setProxyLoading] = useState(false)
  const [proxySource,  setProxySource]  = useState('')  // 'kiro' | 'system' | ''

  // 新增邮箱表单（临时状态）
  const [newApi, setNewApi] = useState<TempMailApi>({ name: '', apiUrl: '', adminKey: '' })
  const [showAddForm, setShowAddForm] = useState(false)

  // 结果明细折叠
  const [showDetail, setShowDetail] = useState(false)

  // 运行
  const [running, setRunning] = useState(false)
  const [logs,    setLogs]    = useState<string[]>([])
  const [result,  setResult]  = useState<RegisterResult | null>(null)
  const logsEndRef  = useRef<HTMLDivElement>(null)
  const unlistenRef = useRef<(() => void) | null>(null)

  // 自动滚动
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [logs])
  useEffect(() => { checkEnv(); autoFillProxy() }, [])
  useEffect(() => () => { unlistenRef.current?.() }, [])

  // 邮箱配置变更时持久化到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(params.tempMailApis))
      localStorage.setItem(STORAGE_SELECT_KEY, params.tempMailSelect)
    } catch {}
  }, [params.tempMailApis, params.tempMailSelect])

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

  // 页面加载时自动从 Kiro IDE 设置获取代理
  async function autoFillProxy() {
    try {
      const proxy = await invoke<string | null>('get_kiro_proxy')
      if (proxy) {
        // 补全协议前缀
        const url = proxy.startsWith('http') ? proxy : `http://${proxy}`
        setParams(p => ({ ...p, proxyUrl: url }))
        setProxySource('kiro')
        return
      }
    } catch {}
    // Kiro 没有配置，尝试系统代理
    try {
      const info = await invoke<{ enabled: boolean; httpProxy: string | null }>('detect_system_proxy')
      if (info.enabled && info.httpProxy) {
        const url = info.httpProxy.startsWith('http') ? info.httpProxy : `http://${info.httpProxy}`
        setParams(p => ({ ...p, proxyUrl: url }))
        setProxySource('system')
      }
    } catch {}
  }

  // 手动点击"自动获取"按钮
  async function handleAutoProxy() {
    setProxyLoading(true)
    setProxySource('')
    try {
      const proxy = await invoke<string | null>('get_kiro_proxy')
      if (proxy) {
        const url = proxy.startsWith('http') ? proxy : `http://${proxy}`
        setParams(p => ({ ...p, proxyUrl: url }))
        setProxySource('kiro')
        return
      }
    } catch {}
    try {
      const info = await invoke<{ enabled: boolean; httpProxy: string | null }>('detect_system_proxy')
      if (info.enabled && info.httpProxy) {
        const url = info.httpProxy.startsWith('http') ? info.httpProxy : `http://${info.httpProxy}`
        setParams(p => ({ ...p, proxyUrl: url }))
        setProxySource('system')
      } else {
        setParams(p => ({ ...p, proxyUrl: '' }))
        setProxySource('')
      }
    } catch {
      setParams(p => ({ ...p, proxyUrl: '' }))
    }
    setProxyLoading(false)
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
    try { await invoke('stop_auto_register') } catch {}
  }

  // 添加邮箱配置
  function handleAddApi() {
    if (!newApi.apiUrl.trim() || !newApi.adminKey.trim()) return
    setParams(p => ({
      ...p,
      tempMailApis: [...p.tempMailApis, {
        name: newApi.name.trim() || `邮箱服务 ${p.tempMailApis.length + 1}`,
        apiUrl: newApi.apiUrl.trim(),
        adminKey: newApi.adminKey.trim(),
      }],
    }))
    setNewApi({ name: '', apiUrl: '', adminKey: '' })
    setShowAddForm(false)
  }

  // 删除邮箱配置
  function handleRemoveApi(idx: number) {
    setParams(p => {
      const apis = p.tempMailApis.filter((_, i) => i !== idx)
      // 如果当前选中的是被删除的那个，重置为 random
      const sel = p.tempMailSelect
      const selIdx = parseInt(sel, 10)
      const newSel = (!isNaN(selIdx) && selIdx === idx) ? 'random' : sel
      return { ...p, tempMailApis: apis, tempMailSelect: newSel }
    })
  }

  const handleStart = useCallback(async () => {
    if (running) return
    // 设备码模式才强制要求邮箱服务
    if (registerMode === 'device' && params.tempMailApis.length === 0) {
      setLogs(['❌ 请先添加至少一个自建邮箱 API 配置'])
      return
    }
    if (registerMode === 'authorize' && !authorizeInfo) {
      setLogs(['❌ 请先点击「准备授权」获取授权 URL'])
      return
    }
    setRunning(true); setLogs([]); setResult(null)
    try {
      const unlisten = await listen<string>('register-log', e => setLogs(p => [...p, e.payload]))
      unlistenRef.current = unlisten

      if (registerMode === 'authorize') {
        // ── 授权码模式 ──
        // worker（浏览器注册）和 run_authorize_register（等待回调换 token）并发
        // worker 完成后把账号信息传给 run_authorize_register
        let workerRecord: RegisterRecord | null = null

        const [workerRes, _authRes] = await Promise.all([
          // 1. 启动 worker 完成浏览器注册（专用命令，不走设备码流程）
          invoke<RegisterResult>('run_authorize_worker', {
            authorizeUrl:    authorizeInfo!.authorizeUrl,
            proxyUrl:        params.proxyUrl.trim() || null,
            useFingerprint:  params.useFingerprint,
            incognito:       params.incognito,
            headless:        params.headless,
            tempMailApis:    params.tempMailApis,
            tempMailSelect:  params.tempMailSelect,
          }).then(res => {
            workerRecord = res.results?.[0] ?? null
            return res
          }),
          // 2. 等待 OAuth 回调并换取 token（与 worker 并发，worker 点 Allow access 后触发）
          invoke('run_authorize_register', {
            params: {
              clientId:     authorizeInfo!.clientId,
              clientSecret: authorizeInfo!.clientSecret,
              codeVerifier: authorizeInfo!.codeVerifier,
              redirectUri:  authorizeInfo!.redirectUri,
              email:    null,
              password: null,
              name:     null,
            }
          }).catch((e: any) => {
            setLogs(p => [...p, `⚠ 授权换取 token 失败: ${e}`])
          }),
        ])

        setResult(workerRes)
        setLogs(p => [...p, `\n✅ 完成！成功 ${workerRes.ok} 个，失败 ${workerRes.fail} 个`])
        setAuthorizeInfo(null)

      } else {
        // ── 设备码模式 ──
        const finalParams = {
          count:          params.count,
          concurrency:    params.concurrency,
          proxyUrl:       params.proxyUrl.trim() || undefined,
          useFingerprint: params.useFingerprint,
          incognito:      params.incognito,
          headless:       params.headless,
          region:         params.region,
          tempMailApis:   params.tempMailApis,
          tempMailSelect: params.tempMailSelect,
          registerMode:   'device',
        }
        const res = await invoke<RegisterResult>('run_auto_register', { params: finalParams })
        setResult(res)
        setLogs(p => [...p, `\n✅ 完成！成功 ${res.ok} 个，失败 ${res.fail} 个`])
      }
    } catch (e: any) {
      setLogs(p => [...p, `❌ 注册失败: ${e}`])
    } finally {
      setRunning(false)
      unlistenRef.current?.(); unlistenRef.current = null
    }
  }, [running, params, registerMode, authorizeInfo])

  const canStart = nodeOk && playwrightOk && !running
    && (registerMode === 'authorize'
      ? !!authorizeInfo  // 授权码模式：只需准备好授权信息
      : params.tempMailApis.length > 0  // 设备码模式：需要邮箱服务
    )

  // 授权码模式：准备授权 URL 和本地服务器（不订阅日志，避免重复）
  async function handlePrepareAuthorize() {
    setAuthorizeLoading(true)
    setAuthorizeInfo(null)
    setLogs([])
    // 清理上一次可能残留的监听器
    unlistenRef.current?.(); unlistenRef.current = null
    try {
      const info = await invoke<AuthorizeInfo>('start_authorize_register')
      setAuthorizeInfo(info)
      setLogs([
        '✓ 授权 URL 已生成，本地回调服务器已启动',
        `回调端口: ${info.callbackPort}`,
        `授权 URL: ${info.authorizeUrl.substring(0, 80)}...`,
        '点击「开始注册」后浏览器将自动打开授权页面完成注册',
      ])
    } catch (e: any) {
      setLogs([`❌ 准备授权失败: ${e}`])
    } finally {
      setAuthorizeLoading(false)
    }
  }

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

        <div className="flex flex-col gap-4 p-4">

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

          {/* 注册模式切换 */}
          <Section title="注册模式">
            <div className="grid grid-cols-2 gap-1.5">
              {([
                { value: 'device',    label: '设备码模式', desc: '申请 user_code，注册后轮询 token' },
                { value: 'authorize', label: '授权码模式', desc: '本地回调服务器，code 换 token' },
              ] as const).map(opt => (
                <button
                  key={opt.value}
                  disabled={running}
                  onClick={() => { setRegisterMode(opt.value); setAuthorizeInfo(null) }}
                  className={[
                    'flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-colors',
                    registerMode === opt.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50',
                    running ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
                  ].join(' ')}
                >
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</span>
                </button>
              ))}
            </div>

            {/* 授权码模式：准备按钮 + 状态 */}
            {registerMode === 'authorize' && (
              <div className="flex flex-col gap-2 pt-2 border-t border-border">
                <Button
                  size="sm" variant="outline"
                  onClick={handlePrepareAuthorize}
                  disabled={running || authorizeLoading}
                  className="w-full"
                >
                  <Link size={12} className={['mr-1.5', authorizeLoading ? 'animate-pulse' : ''].join(' ')} />
                  {authorizeLoading ? '准备中...' : '准备授权（生成 URL + 启动回调服务器）'}
                </Button>
                {authorizeInfo && (
                  <div className="flex flex-col gap-1 p-2 rounded-lg border border-green-500/40 bg-green-500/5">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle size={11} className="text-green-500 flex-shrink-0" />
                      <span className="text-[11px] text-green-600 font-medium">回调服务器已就绪</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">:{authorizeInfo.callbackPort}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground truncate flex-1">
                        {authorizeInfo.authorizeUrl.substring(0, 50)}...
                      </span>
                      <button
                        onClick={() => navigator.clipboard.writeText(authorizeInfo.authorizeUrl)}
                        className="text-muted-foreground hover:text-foreground flex-shrink-0"
                        title="复制授权 URL"
                      >
                        <Copy size={10} />
                      </button>
                    </div>
                  </div>
                )}
                {!authorizeInfo && !authorizeLoading && (
                  <p className="text-[11px] text-yellow-500">⚠ 请先点击「准备授权」再开始注册</p>
                )}
              </div>
            )}
          </Section>

          {/* 注册参数 */}
          <Section title="注册参数">
            {registerMode === 'device' && (
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
            )}
            {registerMode === 'authorize' && (
              <p className="text-[11px] text-muted-foreground">授权码模式每次注册 1 个账号</p>
            )}
            <Field label="代理地址（可选）">
              <div className="flex gap-1.5">
                <div className="relative flex-1">
                  <Input
                    placeholder="http://127.0.0.1:7890"
                    value={params.proxyUrl}
                    disabled={running}
                    onChange={e => { setParams(p => ({ ...p, proxyUrl: e.target.value })); setProxySource('') }}
                  />
                  {proxySource && (
                    <span className={[
                      'absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 rounded',
                      proxySource === 'kiro'
                        ? 'bg-blue-500/15 text-blue-500'
                        : 'bg-muted text-muted-foreground',
                    ].join(' ')}>
                      {proxySource === 'kiro' ? 'Kiro IDE' : '系统'}
                    </span>
                  )}
                </div>
                <button
                  disabled={running || proxyLoading}
                  onClick={handleAutoProxy}
                  title="从 Kiro IDE 设置或系统代理自动获取"
                  className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded border border-border hover:border-primary/60 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
                >
                  <RefreshCw size={12} className={proxyLoading ? 'animate-spin' : ''} />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground -mt-0.5">
                点击 <RefreshCw size={9} className="inline" /> 自动从 Kiro IDE 设置获取
              </p>
            </Field>
            <Field label="AWS 区域">
              <Input placeholder="us-east-1" value={params.region} disabled={running}
                onChange={e => setParams(p => ({ ...p, region: e.target.value }))} />
            </Field>
            <ToggleRow label="指纹伪装" checked={params.useFingerprint} disabled={running}
              onChange={v => setParams(p => ({ ...p, useFingerprint: v }))} />
            <ToggleRow label="无痕模式" checked={params.incognito} disabled={running}
              onChange={v => setParams(p => ({ ...p, incognito: v }))} />
            <ToggleRow label="无头模式（后台运行）" checked={params.headless} disabled={running}
              onChange={v => setParams(p => ({ ...p, headless: v }))} />
            {!params.headless && (
              <p className="text-[11px] text-yellow-500 -mt-1">⚠ 关闭无头模式后浏览器窗口可见，便于调试</p>
            )}
          </Section>

          {/* 自建邮箱配置 */}
          <Section title="自建邮箱服务" icon={<Mail size={13} />}>

            {/* 已添加的邮箱列表 */}
            {params.tempMailApis.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">尚未添加邮箱服务，请点击下方添加</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {/* 选择策略 */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] text-muted-foreground flex-shrink-0">使用策略</span>
                  <select
                    disabled={running}
                    value={params.tempMailSelect}
                    onChange={e => setParams(p => ({ ...p, tempMailSelect: e.target.value }))}
                    className="flex-1 text-[11px] bg-background border border-border rounded px-2 py-1 text-foreground disabled:opacity-50"
                  >
                    <option value="random">随机选择</option>
                    {params.tempMailApis.map((api, i) => (
                      <option key={i} value={String(i)}>
                        指定：{api.name || api.apiUrl}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 邮箱列表 */}
                {params.tempMailApis.map((api, i) => (
                  <div key={i} className={[
                    'flex items-center gap-2 px-2.5 py-2 rounded-lg border',
                    params.tempMailSelect === String(i)
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-muted/20',
                  ].join(' ')}>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate">{api.name || `服务 ${i + 1}`}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{api.apiUrl}</div>
                    </div>
                    <button
                      disabled={running}
                      onClick={() => handleRemoveApi(i)}
                      className="text-muted-foreground hover:text-destructive flex-shrink-0 disabled:opacity-40"
                      title="删除"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* 添加表单 */}
            {showAddForm ? (
              <div className="flex flex-col gap-2 pt-2 border-t border-border mt-1">
                <Field label="名称（可选）">
                  <Input placeholder="我的邮箱服务" value={newApi.name} disabled={running}
                    onChange={e => setNewApi(p => ({ ...p, name: e.target.value }))} />
                </Field>
                <Field label="API 地址 *">
                  <Input placeholder="https://mail.example.com" value={newApi.apiUrl} disabled={running}
                    onChange={e => setNewApi(p => ({ ...p, apiUrl: e.target.value }))} />
                </Field>
                <Field label="Admin 密码 *">
                  <Input type="password" placeholder="YOUR_ADMIN_PASSWORD" value={newApi.adminKey} disabled={running}
                    onChange={e => setNewApi(p => ({ ...p, adminKey: e.target.value }))} />
                </Field>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddApi}
                    disabled={!newApi.apiUrl.trim() || !newApi.adminKey.trim() || running}
                    className="flex-1">
                    确认添加
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowAddForm(false); setNewApi({ name: '', apiUrl: '', adminKey: '' }) }}
                    disabled={running} className="flex-1">
                    取消
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}
                disabled={running} className="w-full mt-1">
                <Plus size={12} className="mr-1.5" />
                添加邮箱服务
              </Button>
            )}

            {params.tempMailApis.length === 0 && !showAddForm && registerMode === 'device' && (
              <p className="text-[11px] text-destructive">⚠ 设备码模式必须添加至少一个邮箱服务</p>
            )}
          </Section>

          {/* 开始 / 停止按钮 */}
          {running ? (
            <Button size="default" variant="destructive" onClick={handleStop} className="w-full">
              <Square size={14} className="mr-2" />停止注册
            </Button>
          ) : (
            <Button size="default" onClick={handleStart} disabled={!canStart} className="w-full">
              <Play size={14} className="mr-2" />开始注册
            </Button>
          )}

        </div>
      </div>

      {/* ── 右侧：日志 + 结果 ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* 结果条 */}
        {result && (
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-muted/30 flex-shrink-0">
            <span className="text-sm font-medium">注册完成</span>
            <Badge className="bg-green-500 hover:bg-green-500">成功 {result.ok}</Badge>
            <Badge variant="destructive">失败 {result.fail}</Badge>
            <button className="ml-auto text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowDetail(v => !v)}>
              {showDetail ? '收起明细' : '展开明细'}
            </button>
          </div>
        )}

        {/* 结果明细 */}
        {result && showDetail && (
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
                <button onClick={handleStop}
                  className="text-[11px] text-destructive hover:text-destructive/80 flex items-center gap-1 border border-destructive/40 rounded px-1.5 py-0.5">
                  <Square size={9} />停止
                </button>
              )}
              {logs.length > 0 && (
                <button className="text-[11px] text-muted-foreground hover:text-foreground"
                  onClick={() => setLogs([])}>清空</button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3 font-mono text-xs leading-5">
            {logs.length === 0
              ? <p className="text-muted-foreground">等待开始...</p>
              : logs.map((line, i) => <LogLine key={i} text={line} />)
            }
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
        {icon}{title}
      </div>
      <div className="flex flex-col gap-2 pl-0.5">{children}</div>
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

function ToggleRow({ label, checked, disabled, onChange }: {
  label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  )
}

function EnvItem({ label, ok }: { label: string; ok: boolean | null }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs">{label}</span>
      {ok === null
        ? <span className="text-[11px] text-muted-foreground">检查中...</span>
        : ok
          ? <span className="text-[11px] text-green-600 flex items-center gap-1"><CheckCircle size={10} />已就绪</span>
          : <span className="text-[11px] text-destructive flex items-center gap-1"><AlertCircle size={10} />未安装</span>
      }
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
