import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { Lock, Copy, Sun, Moon, Palette, Check, RefreshCw, Settings as SettingsIcon, Clock, Globe, Search, Shield, Download, Upload, Shuffle, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { useApp } from '../hooks/useApp'
import { useDialog } from '../contexts/DialogContext'
import { useAppSettings } from '../contexts/AppSettingsContext'
import { usePrivacy } from '../contexts/PrivacyContext'

function Settings() {
    const { t, theme, colors, setTheme } = useApp()
    const { showConfirm, showError, showSuccess } = useDialog()
    const { updateSettings: updateAppSettings } = useAppSettings()
    const { privacyMode, setPrivacyMode } = usePrivacy()
    // 用于 SVG 箭头颜色（浅色主题用深色）
    const isLightTheme = theme === 'light'

    const [aiModel, setAiModel] = useState('claude-sonnet-4.5')
    const [lockModel, setLockModel] = useState(true)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [autoRefreshInterval, setAutoRefreshInterval] = useState(50) // 分钟
    const [autoChangeMachineId, setAutoChangeMachineId] = useState(true) // 默认开启
    const [machineIdMode, setMachineIdMode] = useState('bind') // 'random' | 'bind'
    const [httpProxy, setHttpProxy] = useState('')
    const [originalProxy, setOriginalProxy] = useState('') // 原始代理值，用于判断是否修改
    const [savingProxy, setSavingProxy] = useState(false)
    const [savingModel, setSavingModel] = useState(false)
    const [browserPath, setBrowserPath] = useState('')
    const [originalBrowserPath, setOriginalBrowserPath] = useState('')
    const [savingBrowser, setSavingBrowser] = useState(false)
    const [detectedBrowsers, setDetectedBrowsers] = useState([])
    const [showBrowserList, setShowBrowserList] = useState(false)
    const [detectingProxy, setDetectingProxy] = useState(false)
    const [enableCodebaseIndexing, setEnableCodebaseIndexing] = useState(true)
    const [trustAllCommands, setTrustAllCommands] = useState(false)

    // Kiro IDE 状态
    const [loading, setLoading] = useState(false)

    // 系统机器码
    const [systemMachineInfo, setSystemMachineInfo] = useState(null)
    const [machineGuidAction, setMachineGuidAction] = useState(null) // 'reset'





    // 加载设置（指纹延迟加载，不阻塞页面）
    const loadSettings = async () => {
        setLoading(true)
        try {
            // 先加载核心设置（快速）
            const [kiroSettings, appSettings, sysMachine] = await Promise.all([
                invoke('get_kiro_settings').catch(() => null),
                invoke('get_app_settings').catch(() => null),
                invoke('get_system_machine_guid').catch(() => null)
            ])
            setSystemMachineInfo(sysMachine)


            // 从 Kiro IDE 设置读取
            if (kiroSettings) {
                const proxy = kiroSettings.httpProxy || ''
                setHttpProxy(proxy)
                setOriginalProxy(proxy)
                setAiModel(kiroSettings.modelSelection || 'claude-sonnet-4.5')
                setEnableCodebaseIndexing(kiroSettings.enableCodebaseIndexing ?? true)
                setTrustAllCommands(kiroSettings.trustAllCommands ?? false)
            }
            // 从应用设置读取
            if (appSettings) {
                setLockModel(appSettings.lockModel ?? true)
                setAutoRefresh(appSettings.autoRefresh ?? true)
                setAutoRefreshInterval(appSettings.autoRefreshInterval ?? 50)
                setAutoChangeMachineId(appSettings.autoChangeMachineId !== false) // 默认 true
                setMachineIdMode(appSettings.bindMachineIdToAccount !== false ? 'bind' : 'random')
                const browser = appSettings.browserPath || ''
                setBrowserPath(browser)
                setOriginalBrowserPath(browser)
            }
        } catch (err) {
            console.error('Failed to load settings:', err)
            // 暂时不显示错误弹窗，避免阻塞页面
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadSettings()
    }, [])

    // 保存应用设置（后端已实现增量更新，直接传入要更新的字段）
    const saveAppSettings = async (updates, notifyChange = false) => {
        try {
            await invoke('save_app_settings', { settings: updates })
            // 同步到AppSettingsContext缓存
            await updateAppSettings(updates)
            if (notifyChange) {
                await emit('settings-changed')
            }
            // 同时发送app-settings-changed事件，确保App.jsx的ref同步
            await emit('app-settings-changed')
        } catch (err) {
            console.error('Failed to save app settings:', err)
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        }
    }

    // 验证代理URL格式
    const isValidProxy = (url) => {
        if (!url) return true // 允许空值（清除代理）
        try {
            const urlObj = new URL(url)
            return ['http:', 'https:', 'socks5:', 'socks5h:', 'socks4:'].includes(urlObj.protocol)
        } catch {
            return false
        }
    }

    const handleApplyProxy = async () => {
        // 验证代理格式
        if (!isValidProxy(httpProxy)) {
            await showError(t('settings.saveFailed'), t('settings.invalidProxyFormat'))
            return
        }

        setSavingProxy(true)
        try {
            await invoke('set_kiro_proxy', { proxy: httpProxy })
            setOriginalProxy(httpProxy) // 保存成功后更新原始值
            await showSuccess(t('settings.saveSuccess'), httpProxy ? t('settings.proxyApplied') : t('settings.proxyCleared'))
        } catch (err) {
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        } finally {
            setSavingProxy(false)
        }
    }

    // 代理是否有修改
    const proxyChanged = httpProxy !== originalProxy

    const handleApplyModel = async (model) => {
        setAiModel(model)
        setSavingModel(true)
        try {
            await invoke('set_kiro_model', { model })
            // 如果锁定模型，保存到应用设置
            if (lockModel) {
                await saveAppSettings({ lockedModel: model })
                await emit('app-settings-changed')
            }
        } catch (err) {
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        } finally {
            setSavingModel(false)
        }
    }

    const handleLockModelChange = async (checked) => {
        setLockModel(checked)
        await saveAppSettings({ lockModel: checked, lockedModel: checked ? aiModel : null })
        await emit('app-settings-changed')
    }

    const handleAutoRefreshChange = async (checked) => {
        setAutoRefresh(checked)
        await saveAppSettings({ autoRefresh: checked }, true)
        await emit('app-settings-changed')
    }

    const handleAutoRefreshIntervalChange = async (value) => {
        const interval = parseInt(value) || 50
        setAutoRefreshInterval(interval)
        await saveAppSettings({ autoRefreshInterval: interval }, true)
        await emit('app-settings-changed')
    }

    const handleAutoChangeMachineIdChange = async (checked) => {
        setAutoChangeMachineId(checked)
        await saveAppSettings({ autoChangeMachineId: checked })
    }

    const handleMachineIdModeChange = async (mode) => {
        setMachineIdMode(mode)
        await saveAppSettings({ bindMachineIdToAccount: mode === 'bind' })
    }

    const handleCodebaseIndexingChange = async (checked) => {
        setEnableCodebaseIndexing(checked)
        try {
            await invoke('set_kiro_codebase_indexing', { enabled: checked })
        } catch (err) {
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        }
    }

    const handleTrustAllCommandsChange = async (checked) => {
        setTrustAllCommands(checked)
        try {
            await invoke('set_kiro_trust_all_commands', { enabled: checked })
        } catch (err) {
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        }
    }

    // 验证浏览器路径（基础检查）
    const isValidBrowserPath = (path) => {
        if (!path) return true // 允许空值（使用默认浏览器）
        // 检查是否包含引号和可执行文件后缀
        const hasValidSuffix = /\.(exe|cmd|bat|sh|app)($|\s|")/i.test(path)
        const isQuoted = path.includes('"')
        return hasValidSuffix || isQuoted || path.includes('/')
    }

    const handleApplyBrowser = async () => {
        // 验证浏览器路径
        if (!isValidBrowserPath(browserPath)) {
            await showError(t('settings.saveFailed'), t('settings.invalidBrowserPath'))
            return
        }

        setSavingBrowser(true)
        try {
            await saveAppSettings({ browserPath: browserPath })
            setOriginalBrowserPath(browserPath)
            await showSuccess(t('settings.saveSuccess'), browserPath ? t('settings.browserSaved') : t('settings.defaultBrowser'))
        } catch (err) {
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        } finally {
            setSavingBrowser(false)
        }
    }

    const browserChanged = browserPath !== originalBrowserPath

    const handleDetectBrowsers = async () => {
        try {
            const browsers = await invoke('detect_installed_browsers')
            setDetectedBrowsers(browsers)
            setShowBrowserList(true)
            if (browsers.length === 0) {
                await showError(t('settings.detectFailed'), t('settings.noBrowserFound'))
            }
        } catch (err) {
            await showError(t('settings.detectFailed'), t('settings.detectFailed') + ': ' + err)
        }
    }

    // 检测系统代理
    const handleDetectProxy = async () => {
        setDetectingProxy(true)
        try {
            const proxyInfo = await invoke('detect_system_proxy')
            
            // 检测到 TUN 模式
            if (proxyInfo.tunMode) {
                const tunInfo = proxyInfo.tunInterface ? ` (${proxyInfo.tunInterface})` : ''
                await showSuccess(t('settings.tunModeDetected'), `${t('settings.tunModeEnabled')}${tunInfo}\n\n${t('settings.tunModeHint')}`)
                return
            }
            
            if (proxyInfo.enabled && proxyInfo.httpProxy) {
                setHttpProxy(proxyInfo.httpProxy)
                await showSuccess(t('settings.detectSuccess'), `${t('settings.systemProxyDetected')}: ${proxyInfo.httpProxy}`)
            } else if (proxyInfo.proxyServer) {
                // 代理已配置但未启用
                const useIt = await showConfirm(t('settings.proxyConfigured'), `${t('settings.proxyNotEnabled')}: ${proxyInfo.proxyServer}\n\n${t('settings.useThisProxy')}`)
                if (useIt) {
                    const proxy = proxyInfo.proxyServer.startsWith('http') ? proxyInfo.proxyServer : `http://${proxyInfo.proxyServer}`
                    setHttpProxy(proxy)
                }
            } else {
                await showError(t('settings.noProxyDetected'), t('settings.noProxyConfigured'))
            }
        } catch (err) {
            await showError(t('settings.detectFailed'), t('settings.detectFailed') + ': ' + err)
        } finally {
            setDetectingProxy(false)
        }
    }

    const handleSelectBrowser = (browser, useIncognito = true) => {
        const path = useIncognito && browser.incognitoArg
            ? `"${browser.path}" ${browser.incognitoArg}`
            : `"${browser.path}"`
        setBrowserPath(path)
        setShowBrowserList(false)
    }

    // 系统机器码操作
    const handleResetSystemMachineGuid = async () => {
        const confirmed = await showConfirm(
            `⚠️ ${t('settings.resetSystemMachineGuid')}`,
            t('settings.confirmResetSystemMachineGuid'),
            { confirmText: t('settings.confirmReset'), cancelText: t('common.cancel') }
        )
        if (!confirmed) return

        setMachineGuidAction('reset')
        try {
            const newGuid = await invoke('reset_system_machine_guid')
            setSystemMachineInfo(prev => ({ ...prev, machineGuid: newGuid }))
            await showSuccess(t('settings.resetSuccess'), `${t('settings.newMachineGuid')}: ${newGuid}`)
        } catch (err) {
            await showError(t('settings.resetFailed'), err.toString())
            setMachineGuidAction(null) // 错误时立即清除状态，允许重试
        }
    }

    // 格式化时间戳
    const formatTimestamp = (ts) => {
        if (!ts) return '-'
        const date = new Date(ts * 1000)
        return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
    }

    const themeOptions = [
        { key: 'light', name: t('settings.light'), icon: Sun, color: 'from-blue-400 to-blue-600' },
        { key: 'dark', name: t('settings.dark'), icon: Moon, color: 'from-gray-700 to-gray-900' },
        { key: 'purple', name: t('settings.purple'), icon: Palette, color: 'from-purple-500 to-purple-700' },
        { key: 'green', name: t('settings.green'), icon: Palette, color: 'from-emerald-500 to-emerald-700' },
    ]

    // 复制到剪贴板
    const [copiedField, setCopiedField] = useState(null)
    const copiedTimerRef = useRef(null)

    // 清理timer
    useEffect(() => {
        return () => {
            if (copiedTimerRef.current) {
                clearTimeout(copiedTimerRef.current)
            }
        }
    }, [])

    const copyToClipboard = (text, field) => {
        navigator.clipboard.writeText(text).catch(e => console.error('Copy failed:', e))
        setCopiedField(field)
        if (copiedTimerRef.current) {
            clearTimeout(copiedTimerRef.current)
        }
        copiedTimerRef.current = setTimeout(() => setCopiedField(null), 1500)
    }

    // 信息项组件
    const InfoItem = ({ label, value, copyable = false, fieldKey }) => (
        <div className={`flex items-center justify-between py-2 ${colors.cardBorder} border-b last:border-0`}>
            <span className={`text-sm ${colors.textMuted}`}>{label}</span>
            <div className="flex items-center gap-2">
                <code className={`text-xs ${colors.cardSecondary} px-2 py-1 rounded-lg font-mono ${colors.text} max-w-[200px] truncate`}>
                    {value || '-'}
                </code>
                {copyable && value && (
                    <button
                        onClick={() => copyToClipboard(value, fieldKey)}
                        className={`btn-icon p-1 rounded-lg ${colors.cardHover} transition-colors`}
                    >
                        {copiedField === fieldKey ? (
                            <Check size={14} className="text-green-500" />
                        ) : (
                            <Copy size={14} className={colors.textMuted} />
                        )}
                    </button>
                )}
            </div>
        </div>
    )

    return (
        <div className={`h-full ${colors.main} p-8 overflow-auto`}>
            {/* 背景装饰 */}
            <div className="bg-glow bg-glow-1" />
            <div className="bg-glow bg-glow-2" />

            <div className="max-w-3xl mx-auto relative">
                {/* Header */}
                <div className="mb-8 animate-slide-in-left">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-gradient-to-br from-gray-500 to-gray-700 rounded-2xl flex items-center justify-center shadow-lg animate-float">
                            <SettingsIcon size={24} className="text-white" />
                        </div>
                        <div>
                            <h1 className={`text-2xl font-bold ${colors.text}`}>{t('settings.title')}</h1>
                            <p className={colors.textMuted}>{t('settings.subtitle')}</p>
                        </div>
                    </div>
                </div>

                {/* 主题设置 */}
                <section className={`card-glow ${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6 animate-slide-in-left delay-100`}>
                    <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{t('settings.theme')}</h2>
                    <p className={`text-sm ${colors.textMuted} mb-5`}>{t('settings.themeDesc')}</p>

                    <div className="grid grid-cols-4 gap-3">
                        {themeOptions.map((opt, index) => {
                            const Icon = opt.icon
                            const isActive = theme === opt.key
                            return (
                                <button
                                    key={opt.key}
                                    onClick={() => setTheme(opt.key)}
                                    className={`relative p-4 rounded-xl border-2 transition-all hover:scale-105 ${isActive
                                        ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                                        : `${colors.cardBorder} ${colors.cardHover}`
                                        }`}
                                    style={{ animationDelay: `${index * 0.05}s` }}
                                >
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${opt.color} flex items-center justify-center mx-auto mb-2 transition-transform group-hover:scale-110`}>
                                        <Icon size={20} className="text-white" />
                                    </div>
                                    <div className={`text-sm font-medium ${colors.text}`}>{opt.name}</div>
                                    {isActive && (
                                        <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center animate-scale-in">
                                            <Check size={12} className="text-white" />
                                        </div>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </section>

                {/* Kiro IDE 设置（模型、代理、代码库索引） */}
                <section className={`card-glow ${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6 animate-slide-in-left delay-200`}>
                    <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{t('settings.kiroSettings')}</h2>
                    <p className={`text-sm ${colors.textMuted} mb-5`}>{t('settings.kiroSettingsDesc')}</p>

                    {/* AI 模型 + 锁定开关 */}
                    <div className="mb-5">
                        <label className={`block text-sm ${colors.textMuted} mb-2`}>{t('settings.aiModel')} {savingModel && <span className="text-blue-500 text-xs ml-2">{t('settings.saving')}</span>}</label>
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                {lockModel && (
                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none z-10">
                                        <Lock size={14} className="text-blue-500" />
                                    </div>
                                )}
                                <select
                                    value={aiModel}
                                    onChange={(e) => handleApplyModel(e.target.value)}
                                    disabled={savingModel}
                                    title={lockModel ? t('settings.lockModelDesc') : ''}
                                    className={`w-full ${lockModel ? 'pl-10' : 'pl-4'} pr-10 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 appearance-none cursor-pointer transition-all ${lockModel ? 'opacity-60 bg-opacity-60' : ''}`}
                                >
                                    <option value="claude-sonnet-4.5">{lockModel ? '🔒 ' : ''}Claude Sonnet 4.5 - 1.3x (⭐ {t('common.recommended')})</option>
                                    <option value="claude-sonnet-4">{lockModel ? '🔒 ' : ''}Claude Sonnet 4 - 1.3x</option>
                                    <option value="claude-haiku-4.5">{lockModel ? '🔒 ' : ''}Claude Haiku 4.5 - 0.4x</option>
                                    <option value="claude-opus-4.5">{lockModel ? '🔒 ' : ''}Claude Opus 4.5 - 2.2x</option>
                                </select>
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M2.5 4.5L6 8L9.5 4.5" stroke={isLightTheme ? '#666' : '#888'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            </div>
                            <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border transition-all ${lockModel
                                ? 'bg-blue-500/20 border-blue-500/50 text-blue-500'
                                : `${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text}`
                                }`} title={t('settings.lockModelDesc')}>
                                <input
                                    type="checkbox"
                                    checked={lockModel}
                                    onChange={(e) => handleLockModelChange(e.target.checked)}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                                />
                                <Lock size={16} />
                                <span className="text-sm font-medium whitespace-nowrap">{t('settings.lockModel')}</span>
                            </label>
                        </div>
                    </div>

                    {/* 代码库索引 */}
                    <label className={`flex items-start gap-3 cursor-pointer ${colors.cardSecondary} ${colors.cardHover} rounded-xl p-4 transition-all hover:scale-[1.01] mb-3`}>
                        <input
                            type="checkbox"
                            checked={enableCodebaseIndexing}
                            onChange={(e) => handleCodebaseIndexingChange(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded-lg border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        <Search size={16} className={`${colors.textMuted} mt-0.5 flex-shrink-0`} />
                        <div>
                            <span className={`text-sm font-medium ${colors.text}`}>{t('settings.enableCodebaseIndexing')}</span>
                            <p className={`text-xs ${colors.textMuted} mt-0.5`}>{t('settings.enableCodebaseIndexingDesc')}</p>
                        </div>
                    </label>

                    {/* 信任所有命令 */}
                    <label className={`flex items-start gap-3 cursor-pointer ${colors.cardSecondary} ${colors.cardHover} rounded-xl p-4 transition-all hover:scale-[1.01] mb-3`}>
                        <input
                            type="checkbox"
                            checked={trustAllCommands}
                            onChange={(e) => handleTrustAllCommandsChange(e.target.checked)}
                            className="mt-0.5 w-4 h-4 rounded-lg border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        <Shield size={16} className={`${colors.textMuted} mt-0.5 flex-shrink-0`} />
                        <div>
                            <span className={`text-sm font-medium ${colors.text}`}>{t('settings.trustAllCommands')}</span>
                            <p className={`text-xs ${colors.textMuted} mt-0.5`}>{t('settings.trustAllCommandsDesc')}</p>
                        </div>
                    </label>

                    {/* HTTP 代理 */}
                    <div className={`mt-5 pt-5 border-t border-dashed ${colors.cardBorder}`}>
                        <label className={`block text-sm ${colors.textMuted} mb-2`}>{t('settings.httpProxy')}</label>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={httpProxy}
                                onChange={(e) => setHttpProxy(e.target.value)}
                                placeholder="http://127.0.0.1:7897"
                                className={`flex-1 px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
                            />
                            <button
                                onClick={handleDetectProxy}
                                disabled={detectingProxy}
                                className={`btn-icon px-4 py-3 border rounded-xl ${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text} transition-all flex items-center gap-2`}
                                title={t('settings.detectProxyTitle')}
                            >
                                {detectingProxy ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                                {t('settings.detect')}
                            </button>
                            <button
                                onClick={handleApplyProxy}
                                disabled={savingProxy || !proxyChanged}
                                className={`btn-icon px-5 py-3 rounded-xl flex items-center gap-2 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all ${proxyChanged
                                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                                    : `${colors.cardSecondary} ${colors.textMuted}`
                                    }`}
                            >
                                {savingProxy ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                                {savingProxy ? t('settings.saving') : t('settings.apply')}
                            </button>
                        </div>
                        <p className={`text-xs ${colors.textMuted} mt-2`}>{t('settings.proxyTip')}</p>
                    </div>
                </section>

                {/* 账号设置 */}
                <section className={`card-glow ${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6 animate-slide-in-left delay-300`}>
                    <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{t('settings.account')}</h2>
                    <p className={`text-sm ${colors.textMuted} mb-5`}>{t('settings.accountDesc')}</p>

                    {/* 自动刷新 Token + 刷新间隔 */}
                    <div className="flex items-center gap-3 mb-4">
                        <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border transition-all flex-shrink-0 ${autoRefresh
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-500'
                            : `${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text}`
                            }`} title={t('settings.autoRefreshDesc')}>
                            <input
                                type="checkbox"
                                checked={autoRefresh}
                                onChange={(e) => handleAutoRefreshChange(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                            />
                            <Clock size={16} />
                            <span className="text-sm font-medium whitespace-nowrap">{t('settings.autoRefresh')}</span>
                        </label>
                        <div className="relative flex-1">
                            <select
                                value={autoRefreshInterval}
                                onChange={(e) => handleAutoRefreshIntervalChange(e.target.value)}
                                disabled={!autoRefresh}
                                className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 appearance-none ${!autoRefresh ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} transition-all`}
                            >
                                <option value="30">30 {t('common.minutes')}</option>
                                <option value="50">50 {t('common.minutes')} ({t('common.recommended')})</option>
                                <option value="60">60 {t('common.minutes')}</option>
                                <option value="120">2 {t('common.hours')}</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke={isLightTheme ? '#666' : '#888'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* 机器码设置 - 勾选框 + 二选一下拉框 */}
                    <div className="flex items-center gap-3 mb-4">
                        <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border transition-all flex-shrink-0 ${autoChangeMachineId
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-500'
                            : `${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text}`
                            }`} title={t('settings.autoChangeMachineIdDesc')}>
                            <input
                                type="checkbox"
                                checked={autoChangeMachineId}
                                onChange={(e) => handleAutoChangeMachineIdChange(e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                            />
                            <Shuffle size={16} />
                            <span className="text-sm font-medium whitespace-nowrap">{t('settings.autoChangeMachineId')}</span>
                        </label>
                        <div className="relative flex-1">
                            <select
                                value={machineIdMode}
                                onChange={(e) => handleMachineIdModeChange(e.target.value)}
                                disabled={!autoChangeMachineId}
                                className={`w-full px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 appearance-none ${!autoChangeMachineId ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} transition-all`}
                            >
                                <option value="bind">{t('settings.machineIdBind')} ({t('common.recommended')})</option>
                                <option value="random">{t('settings.machineIdRandom')}</option>
                            </select>
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2.5 4.5L6 8L9.5 4.5" stroke={isLightTheme ? '#666' : '#888'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* 隐私模式 */}
                    <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border transition-all ${privacyMode
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-500'
                        : `${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text}`
                        }`} title={t('settings.privacyModeDesc')}>
                        <input
                            type="checkbox"
                            checked={privacyMode}
                            onChange={(e) => setPrivacyMode(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                        {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
                        <span className="text-sm font-medium whitespace-nowrap">{t('settings.privacyMode')}</span>
                        <span className={`text-xs ${colors.textMuted} ml-1`}>({t('settings.privacyModeHint')})</span>
                    </label>
                </section>

                {/* 浏览器设置 */}
                <section className={`card-glow ${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6 animate-slide-in-left delay-350`}>
                    <div className="flex items-center gap-2 mb-1">
                        <Globe size={18} className="text-blue-500" />
                        <h2 className={`text-lg font-semibold ${colors.text}`}>{t('settings.browser')}</h2>
                    </div>
                    <p className={`text-sm ${colors.textMuted} mb-5`}>
                        {t('settings.browserDesc')}
                    </p>

                    <div className="mb-3">
                        <label className={`block text-sm ${colors.textMuted} mb-2`}>{t('settings.browserPath')}</label>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={browserPath}
                                onChange={(e) => setBrowserPath(e.target.value)}
                                placeholder={t('settings.browserPlaceholder')}
                                className={`flex-1 px-4 py-3 border rounded-xl ${colors.text} ${colors.input} ${colors.inputFocus} focus:ring-2 transition-all`}
                            />
                            <button
                                onClick={handleDetectBrowsers}
                                className={`btn-icon px-4 py-3 border rounded-xl ${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text} transition-all flex items-center gap-2`}
                                title={t('settings.detectBrowsersTitle')}
                            >
                                <Search size={16} />
                                {t('settings.detect')}
                            </button>
                            <button
                                onClick={handleApplyBrowser}
                                disabled={savingBrowser || !browserChanged}
                                className={`btn-icon px-5 py-3 rounded-xl flex items-center gap-2 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all ${browserChanged
                                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                                    : `${colors.cardSecondary} ${colors.textMuted}`
                                    }`}
                            >
                                {savingBrowser ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                                {savingBrowser ? t('settings.saving') : t('settings.apply')}
                            </button>
                        </div>
                    </div>

                    {/* 检测到的浏览器列表 */}
                    {showBrowserList && detectedBrowsers.length > 0 && (
                        <div className={`mt-4 p-4 rounded-xl ${colors.cardSecondary}`}>
                            <div className="flex items-center justify-between mb-3">
                                <span className={`text-sm font-medium ${colors.text}`}>{t('settings.detectedBrowsers')}</span>
                                <button
                                    onClick={() => setShowBrowserList(false)}
                                    className={`text-xs ${colors.textMuted} hover:underline`}
                                >
                                    {t('settings.close')}
                                </button>
                            </div>
                            <div className="space-y-2">
                                {detectedBrowsers.map((browser, index) => (
                                    <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${colors.card} ${colors.cardHover} transition-colors`}>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-medium ${colors.text}`}>{browser.name}</div>
                                            <div className={`text-xs ${colors.textMuted} truncate`}>{browser.path}</div>
                                        </div>
                                        <div className="flex gap-2 ml-3">
                                            {browser.incognitoArg && (
                                                <button
                                                    onClick={() => handleSelectBrowser(browser, true)}
                                                    className="btn-icon px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                                >
                                                    {t('settings.incognitoMode')}
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleSelectBrowser(browser, false)}
                                                className={`btn-icon px-3 py-1.5 text-xs rounded-lg transition-colors ${colors.cardSecondary} ${colors.cardHover} ${colors.text}`}
                                            >
                                                {t('settings.normalMode')}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <p className={`text-xs ${colors.textMuted} mt-3`}>
                        {t('settings.browserTip')}
                    </p>
                </section>

                {/* 系统机器码管理 */}
                <section className={`card-glow ${colors.card} rounded-2xl p-6 shadow-sm border ${colors.cardBorder} mb-6 animate-slide-in-left delay-600`}>
                    <div className="flex items-center gap-2 mb-1">
                        <Shield size={18} className="text-orange-500" />
                        <h2 className={`text-lg font-semibold ${colors.text}`}>{t('settings.systemMachineGuid')}</h2>
                        {systemMachineInfo?.osType && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${colors.cardSecondary} ${colors.textMuted}`}>
                                {systemMachineInfo.osType === 'windows' ? 'Windows' : systemMachineInfo.osType === 'macos' ? 'macOS' : 'Linux'}
                            </span>
                        )}
                    </div>
                    <p className={`text-sm ${colors.textMuted} mb-5`}>
                        {systemMachineInfo?.osType === 'macos'
                            ? t('settings.machineGuidDescMac')
                            : systemMachineInfo?.osType === 'linux'
                                ? t('settings.machineGuidDescLinux')
                                : t('settings.machineGuidDescWin')}
                    </p>

                    {/* 当前值 */}
                    <div className={`${colors.cardSecondary} rounded-xl p-4 mb-4`}>
                        <div className="flex items-center justify-between mb-3">
                            <span className={`text-sm font-medium ${colors.text}`}>{t('settings.currentMachineGuid')}</span>
                            <button
                                onClick={loadSettings}
                                disabled={loading}
                                className={`btn-icon p-1.5 rounded-lg ${colors.cardHover} transition-colors`}
                            >
                                <RefreshCw size={14} className={`${colors.textMuted} ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <code className={`flex-1 text-sm ${colors.cardSecondary} px-3 py-2 rounded-lg font-mono ${colors.text}`}>
                                {systemMachineInfo?.machineGuid || t('common.loading')}
                            </code>
                            {systemMachineInfo?.machineGuid && (
                                <button
                                    onClick={() => copyToClipboard(systemMachineInfo.machineGuid, 'sysMachineGuid')}
                                    className={`btn-icon p-2 rounded-lg ${colors.cardHover} transition-colors`}
                                >
                                    {copiedField === 'sysMachineGuid' ? (
                                        <Check size={16} className="text-green-500" />
                                    ) : (
                                        <Copy size={16} className={colors.textMuted} />
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 警告提示 - 需要管理员权限时显示 */}
                    {systemMachineInfo?.requiresAdmin && (
                        <div className={`flex items-start gap-3 ${colors.warning} rounded-xl p-4 mb-4 border ${colors.warningBorder}`}>
                            <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
                            <div className={`text-xs ${colors.textMuted}`}>
                                <p className="font-medium text-orange-500 mb-1">{t('settings.adminWarningTitle')}</p>
                                <ul className="list-disc list-inside space-y-0.5">
                                    <li>{t('settings.adminWarning1')}</li>
                                    <li>{t('settings.adminWarning2')}</li>
                                    <li>{t('settings.adminWarning3')}</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* macOS 提示 */}
                    {systemMachineInfo?.osType === 'macos' && (
                        <div className={`flex items-start gap-3 ${colors.info} rounded-xl p-4 mb-4 border ${colors.infoBorder}`}>
                            <Shield size={18} className="text-blue-500 flex-shrink-0 mt-0.5" />
                            <div className={`text-xs ${colors.textMuted}`}>
                                <p className="font-medium text-blue-500 mb-1">{t('settings.macOSNote')}</p>
                                <p>{t('settings.macOSNoteDesc')}</p>
                            </div>
                        </div>
                    )}

                    {/* 操作按钮 - 可修改时显示 */}
                    {systemMachineInfo?.canModify && (
                        <button
                            onClick={handleResetSystemMachineGuid}
                            disabled={machineGuidAction !== null}
                            className={`w-full btn-icon px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium transition-all ${colors.danger} ${colors.dangerHover} disabled:opacity-50`}
                        >
                            {machineGuidAction === 'reset' ? <RefreshCw size={16} className="animate-spin" /> : <Shuffle size={16} />}
                            {t('common.reset')}
                        </button>
                    )}
                </section>


            </div>
        </div>
    )
}

export default Settings
