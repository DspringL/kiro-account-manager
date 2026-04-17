import { useState, useCallback, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { Play, Square, AlertCircle, Terminal, Mail, Settings, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { useApp } from '../../../hooks/useApp'
import { getThemeAccent } from '../KiroConfig/themeAccent'
import { showSuccess, showError } from '../../../utils/toast'

export default function AutoRegister() {
  const { t, colors, theme } = useApp()
  const accent = getThemeAccent(theme)
  const logEndRef = useRef(null)

  // 临时邮箱配置
  const [tempMailApiUrl, setTempMailApiUrl] = useState(
    localStorage.getItem('tempMailApiUrl') || ''
  )
  const [tempMailPassword, setTempMailPassword] = useState(
    localStorage.getItem('tempMailPassword') || ''
  )
  // AWS 账号密码（可选）
  const [accountPassword, setAccountPassword] = useState(
    localStorage.getItem('accountPassword') || ''
  )

  // 注册状态
  const [isRegistering, setIsRegistering] = useState(false)
  const isRegisteringRef = useRef(false)  // 用 ref 跟踪运行状态，避免闭包陷阱
  const [registerCount, setRegisterCount] = useState(1)
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({ success: 0, failed: 0, total: 0 })

  // Camoufox 状态
  const [camoufoxInstalled, setCamoufoxInstalled] = useState(null)
  const [checkingCamoufox, setCheckingCamoufox] = useState(false)
  const [installingCamoufox, setInstallingCamoufox] = useState(false)

  // 添加日志（需要先定义，因为其他函数会用到）
  const addLog = useCallback((message) => {
    setLogs((prev) => [...prev, message])
  }, [])

  // 清空日志
  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  // 安装 Camoufox
  const installCamoufox = useCallback(async () => {
    setInstallingCamoufox(true)
    addLog('开始安装 Camoufox...')
    
    try {
      // 监听安装日志
      const unlisten = await listen('camoufox-install-log', (event) => {
        addLog(event.payload)
      })
      
      const result = await invoke('install_camoufox')
      addLog(result)
      setCamoufoxInstalled(true)
      showSuccess('Camoufox 安装成功')
      
      unlisten()
    } catch (error) {
      addLog(`✗ 安装失败: ${error}`)
      showError(`安装 Camoufox 失败: ${error}`)
    } finally {
      setInstallingCamoufox(false)
    }
  }, [addLog])

  // 检查 Camoufox 是否已安装
  const checkCamoufox = useCallback(async () => {
    setCheckingCamoufox(true)
    try {
      const installed = await invoke('check_camoufox_installed')
      setCamoufoxInstalled(installed)
      if (!installed) {
        addLog('⚠ Camoufox 未安装，请先运行安装脚本')
      } else {
        addLog('✓ Camoufox 已安装')
      }
    } catch (error) {
      addLog(`✗ 检查 Camoufox 失败: ${error}`)
      setCamoufoxInstalled(false)
    } finally {
      setCheckingCamoufox(false)
    }
  }, [addLog])

  // 监听实时日志
  useEffect(() => {
    const unlisten = listen('auto-register-log', (event) => {
      const { email, message } = event.payload
      addLog(email ? `[${email.split('@')[0]}] ${message}` : message)
    })

    return () => {
      unlisten.then((fn) => fn())
    }
  }, [addLog])

  // 自动滚动到日志底部
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // 保存配置
  const saveConfig = useCallback(() => {
    localStorage.setItem('tempMailApiUrl', tempMailApiUrl)
    localStorage.setItem('tempMailPassword', tempMailPassword)
    if (accountPassword) {
      localStorage.setItem('accountPassword', accountPassword)
    }
  }, [tempMailApiUrl, tempMailPassword, accountPassword])

  // 开始批量注册
  const startRegistration = async () => {
    if (!tempMailApiUrl || !tempMailPassword) {
      showError('请先配置临时邮箱 API 地址和密码')
      return
    }

    if (camoufoxInstalled === false) {
      showError('Camoufox 未安装，请先运行安装脚本')
      return
    }

    saveConfig()
    isRegisteringRef.current = true
    setIsRegistering(true)

    let successCount = 0
    let failedCount = 0

    setStats({ success: 0, failed: 0, total: registerCount })
    clearLogs()
    addLog(`========== 开始批量注册 (数量: ${registerCount}) ==========`)

    for (let i = 0; i < registerCount; i++) {
      if (!isRegisteringRef.current) {
        addLog('已停止注册')
        break
      }

      addLog(`\n[${i + 1}/${registerCount}] 开始注册...`)

      try {
        const result = await invoke('auto_register_with_tempmail', {
          params: {
            temp_mail_api_url: tempMailApiUrl,
            temp_mail_password: tempMailPassword,
            account_password: accountPassword || null,
          },
        })

        if (result.success) {
          successCount++
          setStats(prev => ({ ...prev, success: successCount }))
          addLog(`✓ 注册成功: ${result.email || ''}`)

          const token = result.refresh_token || result.sso_token
          if (token) {
            try {
              await invoke('add_account_by_social', {
                refreshToken: token,
                provider: 'BuilderId',
                machineId: null,
                accessToken: null,
              })
              addLog(`✓ 账号已导入: ${result.email}`)
              showSuccess(`账号 ${result.email} 注册成功并已导入`)
            } catch (err) {
              addLog(`⚠ 导入账号失败: ${err}`)
              showError(`导入账号失败: ${err}`)
            }
          }
        } else {
          failedCount++
          setStats(prev => ({ ...prev, failed: failedCount }))
          addLog(`✗ 注册失败: ${result.error || '未知错误'}`)
          showError(`注册失败: ${result.error}`)
        }
      } catch (err) {
        failedCount++
        setStats(prev => ({ ...prev, failed: failedCount }))
        addLog(`✗ 注册出错: ${err}`)
        showError(`注册出错: ${err}`)
      }
    }

    isRegisteringRef.current = false
    setIsRegistering(false)
    addLog(`\n========== 注册完成: 成功 ${successCount}，失败 ${failedCount} ==========`)
  }

  // 停止注册
  const stopRegistration = () => {
    isRegisteringRef.current = false
    setIsRegistering(false)
    addLog('正在停止注册...')
  }

  return (
    <div className={`h-full flex flex-col ${colors.main} p-6 space-y-6`}>
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-bold ${colors.text}`}>账号自动注册</h1>
          <p className={`text-sm ${colors.textMuted} mt-1`}>
            使用临时邮箱自动注册 AWS Builder ID 账号
          </p>
        </div>
        <div className="flex gap-2">
          {checkingCamoufox ? (
            <button
              disabled
              className={`px-4 py-2 rounded-lg ${colors.card} border ${colors.cardBorder} flex items-center gap-2`}
            >
              <Loader2 size={16} className="animate-spin" />
              检查中...
            </button>
          ) : camoufoxInstalled === null ? (
            <button
              onClick={checkCamoufox}
              className={`px-4 py-2 rounded-lg ${colors.card} border ${colors.cardBorder} ${colors.cardHover} flex items-center gap-2`}
            >
              <Settings size={16} />
              检查环境
            </button>
          ) : camoufoxInstalled ? (
            <div className="px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-green-500">
              <CheckCircle size={16} />
              环境正常
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-500">
                <XCircle size={16} />
                环境异常
              </div>
              {installingCamoufox ? (
                <button
                  disabled
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white flex items-center gap-2"
                >
                  <Loader2 size={16} className="animate-spin" />
                  安装中...
                </button>
              ) : (
                <button
                  onClick={installCamoufox}
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 flex items-center gap-2"
                >
                  <Settings size={16} />
                  一键修复
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 配置区域 */}
      <div className={`${colors.card} border ${colors.cardBorder} rounded-xl p-6 space-y-4`}>
        <div className="flex items-center gap-2 mb-4">
          <Mail size={20} className={accent.text} />
          <h2 className={`text-lg font-semibold ${colors.text}`}>临时邮箱配置</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className={`text-sm font-medium ${colors.text}`}>API 地址</label>
            <input
              type="text"
              value={tempMailApiUrl}
              onChange={(e) => setTempMailApiUrl(e.target.value)}
              placeholder="https://apimail.example.com"
              disabled={isRegistering}
              className={`w-full px-3 py-2 border rounded-lg ${colors.input} ${colors.inputFocus} ${colors.text}`}
            />
          </div>

          <div className="space-y-2">
            <label className={`text-sm font-medium ${colors.text}`}>Admin 密码</label>
            <input
              type="password"
              value={tempMailPassword}
              onChange={(e) => setTempMailPassword(e.target.value)}
              placeholder="x-admin-auth 密码"
              disabled={isRegistering}
              className={`w-full px-3 py-2 border rounded-lg ${colors.input} ${colors.inputFocus} ${colors.text}`}
            />
          </div>

          <div className="space-y-2">
            <label className={`text-sm font-medium ${colors.text}`}>
              AWS 账号密码 (可选)
              <span className={`text-xs ${colors.textMuted} ml-2`}>留空使用默认密码</span>
            </label>
            <input
              type="password"
              value={accountPassword}
              onChange={(e) => setAccountPassword(e.target.value)}
              placeholder="留空使用默认密码 Alisi1976230!"
              disabled={isRegistering}
              className={`w-full px-3 py-2 border rounded-lg ${colors.input} ${colors.inputFocus} ${colors.text}`}
            />
          </div>

          <div className="space-y-2">
            <label className={`text-sm font-medium ${colors.text}`}>注册数量</label>
            <input
              type="number"
              min={1}
              max={100}
              value={registerCount}
              onChange={(e) => setRegisterCount(Math.max(1, Math.min(100, Number(e.target.value))))}
              disabled={isRegistering}
              className={`w-full px-3 py-2 border rounded-lg ${colors.input} ${colors.inputFocus} ${colors.text}`}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {isRegistering ? (
            <button
              onClick={stopRegistration}
              className="px-6 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 flex items-center gap-2"
            >
              <Square size={16} />
              停止注册
            </button>
          ) : (
            <button
              onClick={startRegistration}
              disabled={!tempMailApiUrl || !tempMailPassword}
              className={`px-6 py-2 rounded-lg bg-gradient-to-r ${accent.gradientFrom} ${accent.gradientTo} text-white hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
            >
              <Play size={16} />
              开始注册
            </button>
          )}
        </div>
      </div>

      {/* 统计信息 */}
      {stats.total > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className={`${colors.card} border ${colors.cardBorder} rounded-lg p-4`}>
            <div className={`text-2xl font-bold ${colors.text}`}>{stats.total}</div>
            <div className={`text-sm ${colors.textMuted}`}>总数</div>
          </div>
          <div className={`${colors.card} border ${colors.cardBorder} rounded-lg p-4`}>
            <div className="text-2xl font-bold text-green-500">{stats.success}</div>
            <div className={`text-sm ${colors.textMuted}`}>成功</div>
          </div>
          <div className={`${colors.card} border ${colors.cardBorder} rounded-lg p-4`}>
            <div className="text-2xl font-bold text-red-500">{stats.failed}</div>
            <div className={`text-sm ${colors.textMuted}`}>失败</div>
          </div>
        </div>
      )}

      {/* 日志区域 */}
      <div className={`flex-1 ${colors.card} border ${colors.cardBorder} rounded-xl p-6 flex flex-col min-h-[300px]`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal size={20} className={accent.text} />
            <h2 className={`text-lg font-semibold ${colors.text}`}>运行日志</h2>
          </div>
          <button
            onClick={clearLogs}
            className={`text-sm ${colors.textMuted} hover:${colors.text}`}
          >
            清空
          </button>
        </div>

        <div className="flex-1 overflow-auto bg-black/90 rounded-lg p-4 font-mono text-xs space-y-1 min-h-0">
          {logs.length === 0 ? (
            <div className="text-gray-500">暂无日志</div>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={
                  log.includes('✓')
                    ? 'text-green-400'
                    : log.includes('✗') || log.includes('失败')
                    ? 'text-red-400'
                    : log.includes('=====')
                    ? 'text-yellow-400'
                    : 'text-gray-300'
                }
              >
                {log}
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* 使用说明（折叠） */}
      <details className={`${colors.card} border ${colors.cardBorder} rounded-xl`}>
        <summary className={`flex items-center gap-2 p-4 cursor-pointer select-none`}>
          <AlertCircle size={18} className={accent.text} />
          <span className={`text-sm font-semibold ${colors.text}`}>使用说明</span>
        </summary>
        <div className={`px-6 pb-5 text-sm ${colors.textMuted} space-y-2`}>
          <p>1. 填写临时邮箱 API 地址和 Admin 密码（配置后自动保存）</p>
          <p>2. （可选）设置 AWS 账号密码，留空使用默认密码</p>
          <p>3. 设置注册数量，点击"开始注册"</p>
          <p>4. 程序自动完成：创建临时邮箱 → AWS 注册 → 获取验证码 → 导入账号 → 清理邮箱</p>
          <p>5. 注册成功的账号会自动添加到账号管理器</p>
          <p>6. 代理设置使用 Kiro IDE 设置中的代理配置</p>
          <p className="text-yellow-500 flex items-center gap-1 pt-2">
            <AlertCircle size={16} />
            首次使用需检查环境，如果环境异常可点击"一键修复"自动安装 Camoufox
          </p>
        </div>
      </details>
    </div>
  )
}
