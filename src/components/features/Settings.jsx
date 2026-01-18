import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { Lock, Copy, Sun, Moon, Palette, Check, RefreshCw, Settings as SettingsIcon, Clock, Globe, Search, Shield, Download, Upload, Shuffle, AlertTriangle, Eye, EyeOff, Repeat } from 'lucide-react'
import { Select, Switch, TextInput, Textarea, NumberInput, Button, ActionIcon, Card } from '@mantine/core'
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
    const [trustedCommandsMode, setTrustedCommandsMode] = useState('none') // 'none' | 'common' | 'all'
    const [customTrustedCommands, setCustomTrustedCommands] = useState('') // 自定义命令列表

    // Agent 设置
    const [agentAutonomy, setAgentAutonomy] = useState('Supervised') // 'Autopilot' | 'Supervised'
    const [enableTabAutocomplete, setEnableTabAutocomplete] = useState(true)
    const [usageSummary, setUsageSummary] = useState(true)
    const [codeReferences, setCodeReferences] = useState(true)
    const [enableDebugLogs, setEnableDebugLogs] = useState(false)

    // 通知设置
    const [notifyActionRequired, setNotifyActionRequired] = useState(true)
    const [notifyFailure, setNotifyFailure] = useState(true)
    const [notifySuccess, setNotifySuccess] = useState(true)
    const [notifyBilling, setNotifyBilling] = useState(true)

    // 自动换号设置
    const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(false)
    const [autoSwitchThreshold, setAutoSwitchThreshold] = useState(1)
    const [autoSwitchInterval, setAutoSwitchInterval] = useState(5)

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
                setTrustedCommandsMode(kiroSettings.trustedCommandsMode || 'none')
                // Agent 设置
                setAgentAutonomy(kiroSettings.agentAutonomy || 'Supervised')
                setEnableTabAutocomplete(kiroSettings.enableTabAutocomplete ?? true)
                setUsageSummary(kiroSettings.usageSummary ?? true)
                setCodeReferences(kiroSettings.codeReferences ?? true)
                setEnableDebugLogs(kiroSettings.enableDebugLogs ?? false)
                // 通知设置
                setNotifyActionRequired(kiroSettings.notifyActionRequired ?? true)
                setNotifyFailure(kiroSettings.notifyFailure ?? true)
                setNotifySuccess(kiroSettings.notifySuccess ?? true)
                setNotifyBilling(kiroSettings.notifyBilling ?? true)
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
                // 自动换号设置
                setAutoSwitchEnabled(appSettings.autoSwitchEnabled ?? false)
                setAutoSwitchThreshold(appSettings.autoSwitchThreshold ?? 1)
                setAutoSwitchInterval(appSettings.autoSwitchInterval ?? 5)
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

    // 自动换号处理函数
    const handleAutoSwitchEnabledChange = async (checked) => {
        setAutoSwitchEnabled(checked)
        await saveAppSettings({ autoSwitchEnabled: checked }, true)
    }

    const handleAutoSwitchThresholdChange = async (value) => {
        const threshold = parseFloat(value) || 1
        setAutoSwitchThreshold(threshold)
        await saveAppSettings({ autoSwitchThreshold: threshold }, true)
    }

    const handleAutoSwitchIntervalChange = async (value) => {
        const interval = parseInt(value) || 5
        setAutoSwitchInterval(interval)
        await saveAppSettings({ autoSwitchInterval: interval }, true)
    }

    const handleCodebaseIndexingChange = async (checked) => {
        setEnableCodebaseIndexing(checked)
        try {
            await invoke('set_kiro_codebase_indexing', { enabled: checked })
        } catch (err) {
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        }
    }

    const handleTrustedCommandsModeChange = async (mode) => {
        setTrustedCommandsMode(mode)
        try {
            await invoke('set_kiro_trusted_commands', { mode, customCommands: customTrustedCommands })
        } catch (err) {
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        }
    }

    const handleCustomTrustedCommandsChange = async (commands) => {
        setCustomTrustedCommands(commands)
        if (trustedCommandsMode === 'common') {
            try {
                await invoke('set_kiro_trusted_commands', { mode: 'common', customCommands: commands })
            } catch (err) {
                console.error('Failed to save custom commands:', err)
            }
        }
    }

    // Agent 设置处理函数
    const handleAgentAutonomyChange = async (mode) => {
        setAgentAutonomy(mode)
        try {
            await invoke('set_kiro_agent_autonomy', { autonomy: mode })
        } catch (err) {
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        }
    }

    const handleTabAutocompleteChange = async (checked) => {
        setEnableTabAutocomplete(checked)
        try {
            await invoke('set_kiro_tab_autocomplete', { enabled: checked })
        } catch (err) {
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        }
    }

    const handleUsageSummaryChange = async (checked) => {
        setUsageSummary(checked)
        try {
            await invoke('set_kiro_usage_summary', { enabled: checked })
        } catch (err) {
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        }
    }

    const handleCodeReferencesChange = async (checked) => {
        setCodeReferences(checked)
        try {
            await invoke('set_kiro_code_references', { enabled: checked })
        } catch (err) {
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        }
    }

    const handleDebugLogsChange = async (checked) => {
        setEnableDebugLogs(checked)
        try {
            await invoke('set_kiro_debug_logs', { enabled: checked })
        } catch (err) {
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        }
    }

    // 通知设置处理函数
    const handleNotificationChange = async (key, checked, setter) => {
        setter(checked)
        try {
            await invoke('set_kiro_notification', { key, enabled: checked })
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
                <code className={`text-xs px-2 py-1 rounded-lg font-mono ${colors.text} max-w-[200px] truncate border ${colors.cardBorder} ${colors.cardSecondary}`}>
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
        <div className={`h-full ${colors.main} p-8 overflow-auto flex justify-center`}>
            {/* 背景装饰 */}
            <div className="bg-glow bg-glow-1" />
            <div className="bg-glow bg-glow-2" />

            <div className="max-w-3xl w-full relative">
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
                <Card
                    className="card-glow animate-slide-in-left delay-100"
                    shadow="sm"
                    padding="lg"
                    radius="xl"
                    withBorder
                    style={{ marginBottom: '1.5rem' }}
                >
                    <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{t('settings.theme')}</h2>
                    <p className={`text-sm ${colors.textMuted} mb-4`}>{t('settings.themeDesc')}</p>

                    <div className="grid grid-cols-4 gap-3">
                        {themeOptions.map((opt, index) => {
                            const Icon = opt.icon
                            const isActive = theme === opt.key
                            return (
                                <button
                                    key={opt.key}
                                    onClick={() => setTheme(opt.key)}
                                    className={`relative p-4 rounded-xl border-2 hover:scale-105 ${isActive
                                        ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                                        : `${colors.cardBorder} ${colors.cardHover} ${colors.card}`
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
                </Card>

                {/* Kiro IDE 设置 */}
                <Card
                    className="card-glow animate-slide-in-left delay-150"
                    shadow="sm"
                    padding="lg"
                    radius="xl"
                    withBorder
                    style={{ marginBottom: '1.5rem' }}
                >
                    <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{t('settings.kiroSettings')}</h2>
                    <p className={`text-sm ${colors.textMuted} mb-4`}>{t('settings.kiroSettingsDesc')}</p>

                    {/* AI 模型 */}
                    <div className="mb-4">
                        <label className={`block text-sm ${colors.textMuted} mb-2`}>
                            {t('settings.aiModel')} {savingModel && <span className="text-blue-500 text-xs ml-2">{t('settings.saving')}</span>}
                        </label>
                        <Select
                            value={aiModel}
                            onChange={handleApplyModel}
                            disabled={savingModel}
                            data={[
                                { value: 'claude-sonnet-4.5', label: `Claude Sonnet 4.5 - 1.3x (⭐ ${t('common.recommended')})` },
                                { value: 'claude-sonnet-4', label: 'Claude Sonnet 4 - 1.3x' },
                                { value: 'claude-haiku-4.5', label: 'Claude Haiku 4.5 - 0.4x' },
                                { value: 'claude-opus-4.5', label: 'Claude Opus 4.5 - 2.2x' }
                            ]}
                            classNames={{
                                input: `${colors.text} ${colors.input}`,
                                dropdown: `${colors.card} border ${colors.cardBorder}`,
                                option: `${colors.text}`
                            }}
                        />
                    </div>

                    {/* 锁定模型 */}
                    <label className={`flex items-start gap-3 cursor-pointer rounded-xl p-4 hover:scale-[1.01] mb-4 border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
                        <Switch
                            checked={lockModel}
                            onChange={(e) => handleLockModelChange(e.currentTarget.checked)}
                            classNames={{ track: 'cursor-pointer' }}
                        />
                        <Lock size={16} className={`${colors.textMuted} mt-0.5 flex-shrink-0`} />
                        <div>
                            <span className={`text-sm font-medium ${colors.text}`}>{t('settings.lockModel')}</span>
                            <p className={`text-xs ${colors.textMuted} mt-0.5`}>{t('settings.lockModelDesc')}</p>
                        </div>
                    </label>

                    {/* Agent 自主模式 */}
                    <div className="mb-4">
                        <label className={`block text-sm ${colors.textMuted} mb-2`}>{t('settings.agentAutonomy')}</label>
                        <Select
                            value={agentAutonomy}
                            onChange={handleAgentAutonomyChange}
                            data={[
                                { value: 'Supervised', label: t('settings.agentSupervised') },
                                { value: 'Autopilot', label: t('settings.agentAutopilot') }
                            ]}
                            classNames={{
                                input: `${colors.text} ${colors.input}`,
                                dropdown: `${colors.card} border ${colors.cardBorder}`,
                                option: `${colors.text}`
                            }}
                        />
                    </div>

                    {/* 信任命令 */}
                    <div className="mb-4">
                        <label className={`block text-sm ${colors.textMuted} mb-2`}>{t('settings.trustedCommands')}</label>
                        <Select
                            value={trustedCommandsMode}
                            onChange={handleTrustedCommandsModeChange}
                            data={[
                                { value: 'none', label: t('settings.trustedCommandsNone') },
                                { value: 'common', label: t('settings.trustedCommandsCommon') },
                                { value: 'all', label: t('settings.trustedCommandsAll') }
                            ]}
                            classNames={{
                                input: `${colors.text} ${colors.input}`,
                                dropdown: `${colors.card} border ${colors.cardBorder}`,
                                option: `${colors.text}`
                            }}
                        />
                        {trustedCommandsMode === 'common' && (
                            <Textarea
                                value={customTrustedCommands}
                                onChange={(e) => handleCustomTrustedCommandsChange(e.currentTarget.value)}
                                placeholder="npm *&#10;git *&#10;cargo *"
                                classNames={{
                                    input: `${colors.text} ${colors.input} font-mono text-sm mt-3`
                                }}
                                rows={4}
                                autosize={false}
                            />
                        )}
                        <p className={`text-xs ${colors.textMuted} mt-2`}>{t('settings.trustedCommandsDesc')}</p>
                    </div>

                    {/* 功能开关 - 2列布局 */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <label className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
                            <Switch
                                checked={enableCodebaseIndexing}
                                onChange={(e) => handleCodebaseIndexingChange(e.currentTarget.checked)}
                                size="sm"
                            />
                            <span className={`text-sm ${colors.text}`}>{t('settings.enableCodebaseIndexing')}</span>
                        </label>
                        <label className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
                            <Switch
                                checked={enableTabAutocomplete}
                                onChange={(e) => handleTabAutocompleteChange(e.currentTarget.checked)}
                                size="sm"
                            />
                            <span className={`text-sm ${colors.text}`}>{t('settings.enableTabAutocomplete')}</span>
                        </label>
                        <label className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
                            <Switch
                                checked={usageSummary}
                                onChange={(e) => handleUsageSummaryChange(e.currentTarget.checked)}
                                size="sm"
                            />
                            <span className={`text-sm ${colors.text}`}>{t('settings.usageSummary')}</span>
                        </label>
                        <label className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
                            <Switch
                                checked={codeReferences}
                                onChange={(e) => handleCodeReferencesChange(e.currentTarget.checked)}
                                size="sm"
                            />
                            <span className={`text-sm ${colors.text}`}>{t('settings.codeReferences')}</span>
                        </label>
                        <label className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
                            <Switch
                                checked={enableDebugLogs}
                                onChange={(e) => handleDebugLogsChange(e.currentTarget.checked)}
                                size="sm"
                            />
                            <span className={`text-sm ${colors.text}`}>{t('settings.enableDebugLogs')}</span>
                        </label>
                    </div>

                    {/* 通知设置 */}
                    <div className={`pt-4 border-t border-dashed ${colors.cardBorder}`}>
                        <span className={`text-sm ${colors.textMuted} mb-3 block`}>{t('settings.notifications')}</span>
                        <div className="grid grid-cols-2 gap-2">
                            <label className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
                                <Switch
                                    checked={notifyActionRequired}
                                    onChange={(e) => handleNotificationChange('kiroAgent.notifications.agent.actionRequired', e.currentTarget.checked, setNotifyActionRequired)}
                                    size="sm"
                                />
                                <span className={`text-sm ${colors.text}`}>{t('settings.notifyActionRequired')}</span>
                            </label>
                            <label className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
                                <Switch
                                    checked={notifyFailure}
                                    onChange={(e) => handleNotificationChange('kiroAgent.notifications.agent.failure', e.currentTarget.checked, setNotifyFailure)}
                                    size="sm"
                                />
                                <span className={`text-sm ${colors.text}`}>{t('settings.notifyFailure')}</span>
                            </label>
                            <label className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
                                <Switch
                                    checked={notifySuccess}
                                    onChange={(e) => handleNotificationChange('kiroAgent.notifications.agent.success', e.currentTarget.checked, setNotifySuccess)}
                                    size="sm"
                                />
                                <span className={`text-sm ${colors.text}`}>{t('settings.notifySuccess')}</span>
                            </label>
                            <label className={`flex items-center gap-3 cursor-pointer p-2.5 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
                                <Switch
                                    checked={notifyBilling}
                                    onChange={(e) => handleNotificationChange('kiroAgent.notifications.billing', e.currentTarget.checked, setNotifyBilling)}
                                    size="sm"
                                />
                                <span className={`text-sm ${colors.text}`}>{t('settings.notifyBilling')}</span>
                            </label>
                        </div>
                    </div>

                    {/* HTTP 代理 */}
                    <div className={`mt-5 pt-5 border-t border-dashed ${colors.cardBorder}`}>
                        <label className={`block text-sm ${colors.textMuted} mb-2`}>{t('settings.httpProxy')}</label>
                        <div className="flex gap-3">
                            <TextInput
                                value={httpProxy}
                                onChange={(e) => setHttpProxy(e.currentTarget.value)}
                                placeholder="http://127.0.0.1:7897"
                                classNames={{
                                    input: `${colors.text} ${colors.input}`
                                }}
                                className="flex-1"
                            />
                            <button
                                onClick={handleDetectProxy}
                                disabled={detectingProxy}
                                className={`btn-icon px-4 py-3 border rounded-xl ${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text} flex items-center gap-2`}
                                title={t('settings.detectProxyTitle')}
                            >
                                {detectingProxy ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
                                {t('settings.detect')}
                            </button>
                            <button
                                onClick={handleApplyProxy}
                                disabled={savingProxy || !proxyChanged}
                                className={`btn-icon px-5 py-3 rounded-xl flex items-center gap-2 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed border ${proxyChanged
                                    ? 'bg-blue-500 text-white hover:bg-blue-600 border-blue-500'
                                    : `${colors.cardSecondary} ${colors.textMuted} ${colors.cardBorder}`
                                    }`}
                            >
                                {savingProxy ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                                {savingProxy ? t('settings.saving') : t('settings.apply')}
                            </button>
                        </div>
                        <p className={`text-xs ${colors.textMuted} mt-2`}>{t('settings.proxyTip')}</p>
                    </div>
                </Card>

                {/* 账号设置 */}
                <Card
                    className="card-glow animate-slide-in-left delay-200"
                    shadow="sm"
                    padding="lg"
                    radius="xl"
                    withBorder
                    style={{ marginBottom: '1.5rem' }}
                >
                    <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{t('settings.account')}</h2>
                    <p className={`text-sm ${colors.textMuted} mb-4`}>{t('settings.accountDesc')}</p>

                    {/* 自动刷新 Token + 刷新间隔 */}
                    <div className="flex items-center gap-3 mb-4">
                        <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border flex-shrink-0 ${autoRefresh
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-500'
                            : `${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text}`
                            }`} title={t('settings.autoRefreshDesc')}>
                            <Switch
                                checked={autoRefresh}
                                onChange={(e) => handleAutoRefreshChange(e.currentTarget.checked)}
                                size="sm"
                            />
                            <Clock size={16} />
                            <span className="text-sm font-medium whitespace-nowrap">{t('settings.autoRefresh')}</span>
                        </label>
                        <div className="relative flex-1">
                            <label className={`block text-sm ${colors.textMuted} mb-2`}>{t('settings.autoRefreshInterval')}</label>
                            <Select
                                value={String(autoRefreshInterval)}
                                onChange={(value) => handleAutoRefreshIntervalChange(value)}
                                disabled={!autoRefresh}
                                data={[
                                    { value: '10', label: `10 ${t('common.minutes')}` },
                                    { value: '20', label: `20 ${t('common.minutes')}` },
                                    { value: '30', label: `30 ${t('common.minutes')}` },
                                    { value: '40', label: `40 ${t('common.minutes')}` },
                                    { value: '50', label: `50 ${t('common.minutes')} (${t('common.recommended')})` }
                                ]}
                                classNames={{
                                    input: `${colors.text} ${colors.input}`,
                                    dropdown: `${colors.card} border ${colors.cardBorder}`,
                                    option: `${colors.text}`
                                }}
                            />
                        </div>
                    </div>

                    {/* 机器码设置 - 勾选框 + 二选一下拉框 */}
                    <div className="flex items-center gap-3 mb-4">
                        <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border flex-shrink-0 ${autoChangeMachineId
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-500'
                            : `${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text}`
                            }`} title={t('settings.autoChangeMachineIdDesc')}>
                            <Switch
                                checked={autoChangeMachineId}
                                onChange={(e) => handleAutoChangeMachineIdChange(e.currentTarget.checked)}
                                size="sm"
                            />
                            <Shuffle size={16} />
                            <span className="text-sm font-medium whitespace-nowrap">{t('settings.autoChangeMachineId')}</span>
                        </label>
                        <div className="relative flex-1">
                            <label className={`block text-sm ${colors.textMuted} mb-2`}>{t('settings.machineIdMode')}</label>
                            <Select
                                value={machineIdMode}
                                onChange={handleMachineIdModeChange}
                                disabled={!autoChangeMachineId}
                                data={[
                                    { value: 'bind', label: `${t('settings.machineIdBind')} (${t('common.recommended')})` },
                                    { value: 'random', label: t('settings.machineIdRandom') }
                                ]}
                                classNames={{
                                    input: `${colors.text} ${colors.input}`,
                                    dropdown: `${colors.card} border ${colors.cardBorder}`,
                                    option: `${colors.text}`
                                }}
                            />
                        </div>
                    </div>

                    {/* 隐私模式 */}
                    <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border mb-4 ${privacyMode
                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-500'
                        : `${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text}`
                        }`} title={t('settings.privacyModeDesc')}>
                        <Switch
                            checked={privacyMode}
                            onChange={(e) => setPrivacyMode(e.currentTarget.checked)}
                            size="sm"
                        />
                        {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
                        <span className="text-sm font-medium whitespace-nowrap">{t('settings.privacyMode')}</span>
                        <span className={`text-xs ${colors.textMuted} ml-1`}>({t('settings.privacyModeHint')})</span>
                    </label>

                    {/* 自动换号 */}
                    <div className="flex items-center gap-3">
                        <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border flex-shrink-0 ${autoSwitchEnabled
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-500'
                            : `${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text}`
                            }`} title={t('settings.autoSwitchDesc')}>
                            <Switch
                                checked={autoSwitchEnabled}
                                onChange={(e) => handleAutoSwitchEnabledChange(e.currentTarget.checked)}
                                size="sm"
                            />
                            <Repeat size={16} />
                            <span className="text-sm font-medium whitespace-nowrap">{t('settings.autoSwitch')}</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm ${colors.textMuted} whitespace-nowrap`}>{t('settings.autoSwitchThreshold')}</span>
                            <NumberInput
                                value={autoSwitchThreshold}
                                onChange={handleAutoSwitchThresholdChange}
                                disabled={!autoSwitchEnabled}
                                min={0}
                                step={0.1}
                                classNames={{
                                    input: `${colors.text} ${colors.input} text-center w-20`
                                }}
                            />
                        </div>
                        <div className="relative flex-1">
                            <label className={`block text-sm ${colors.textMuted} mb-2`}>{t('settings.autoSwitchInterval')}</label>
                            <Select
                                value={String(autoSwitchInterval)}
                                onChange={(value) => handleAutoSwitchIntervalChange(value)}
                                disabled={!autoSwitchEnabled}
                                data={[
                                    { value: '1', label: `1 ${t('common.minutes')}` },
                                    { value: '3', label: `3 ${t('common.minutes')}` },
                                    { value: '5', label: `5 ${t('common.minutes')}` },
                                    { value: '10', label: `10 ${t('common.minutes')}` },
                                    { value: '15', label: `15 ${t('common.minutes')}` },
                                    { value: '30', label: `30 ${t('common.minutes')}` }
                                ]}
                                classNames={{
                                    input: `${colors.text} ${colors.input}`,
                                    dropdown: `${colors.card} border ${colors.cardBorder}`,
                                    option: `${colors.text}`
                                }}
                            />
                        </div>
                    </div>
                </Card>

                {/* 浏览器设置 */}
                <Card
                    className="card-glow animate-slide-in-left delay-250"
                    shadow="sm"
                    padding="lg"
                    radius="xl"
                    withBorder
                    style={{ marginBottom: '1.5rem' }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <Globe size={18} className="text-blue-500" />
                        <h2 className={`text-lg font-semibold ${colors.text}`}>{t('settings.browser')}</h2>
                    </div>
                    <p className={`text-sm ${colors.textMuted} mb-4`}>
                        {t('settings.browserDesc')}
                    </p>

                    <div className="mb-3">
                        <label className={`block text-sm ${colors.textMuted} mb-2`}>{t('settings.browserPath')}</label>
                        <div className="flex gap-3">
                            <TextInput
                                value={browserPath}
                                onChange={(e) => setBrowserPath(e.currentTarget.value)}
                                placeholder={t('settings.browserPlaceholder')}
                                classNames={{
                                    input: `${colors.text} ${colors.input}`
                                }}
                                className="flex-1"
                            />
                            <button
                                onClick={handleDetectBrowsers}
                                className={`btn-icon px-4 py-3 border rounded-xl ${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text} flex items-center gap-2`}
                                title={t('settings.detectBrowsersTitle')}
                            >
                                <Search size={16} />
                                {t('settings.detect')}
                            </button>
                            <button
                                onClick={handleApplyBrowser}
                                disabled={savingBrowser || !browserChanged}
                                className={`btn-icon px-5 py-3 rounded-xl flex items-center gap-2 font-medium shadow-sm disabled:opacity-50 disabled:cursor-not-allowed border ${browserChanged
                                    ? 'bg-blue-500 text-white hover:bg-blue-600 border-blue-500'
                                    : `${colors.cardSecondary} ${colors.textMuted} ${colors.cardBorder}`
                                    }`}
                            >
                                {savingBrowser ? <RefreshCw size={16} className="animate-spin" /> : <Check size={16} />}
                                {savingBrowser ? t('settings.saving') : t('settings.apply')}
                            </button>
                        </div>
                    </div>

                    {/* 检测到的浏览器列表 */}
                    {showBrowserList && detectedBrowsers.length > 0 && (
                        <div className={`mt-4 p-4 rounded-xl border ${colors.cardBorder} ${colors.cardSecondary}`}>
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
                                    <div key={index} className={`flex items-center justify-between p-3 rounded-lg ${colors.card} ${colors.cardHover} transition-colors border ${colors.cardBorder}`}>
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
                                                className={`btn-icon px-3 py-1.5 text-xs rounded-lg transition-colors border ${colors.cardSecondary} ${colors.cardHover} ${colors.text} ${colors.cardBorder}`}
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
                </Card>

                {/* 系统机器码管理 */}
                <Card
                    className="card-glow animate-slide-in-left delay-300"
                    shadow="sm"
                    padding="lg"
                    radius="xl"
                    withBorder
                    style={{ marginBottom: '1.5rem' }}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <Shield size={18} className="text-orange-500" />
                        <h2 className={`text-lg font-semibold ${colors.text}`}>{t('settings.systemMachineGuid')}</h2>
                        {systemMachineInfo?.osType && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${colors.textMuted} border ${colors.cardBorder} ${colors.cardSecondary}`}>
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
                    <div className={`rounded-xl p-4 mb-4 border ${colors.cardBorder} ${colors.cardSecondary}`}>
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
                            <code className={`flex-1 text-sm px-3 py-2 rounded-lg font-mono ${colors.text} border ${colors.cardBorder} ${colors.card}`}>
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
                            <div className={`text-xs ${colors.textMuted} flex-1`}>
                                <p className="font-medium text-orange-500 mb-1">{t('settings.adminWarningTitle')}</p>
                                <ul className="list-disc list-inside space-y-0.5 mb-3">
                                    <li>{t('settings.adminWarning1')}</li>
                                    <li>{t('settings.adminWarning2')}</li>
                                    <li>{t('settings.adminWarning3')}</li>
                                </ul>
                                {systemMachineInfo?.osType !== 'macos' && (
                                    <button
                                        onClick={async () => {
                                            const confirmed = await showConfirm(
                                                t('settings.restartAsAdmin'),
                                                t('settings.confirmRestartAsAdmin'),
                                                { confirmText: t('settings.restart'), cancelText: t('common.cancel') }
                                            )
                                            if (confirmed) {
                                                try {
                                                    await invoke('restart_as_admin')
                                                } catch (e) {
                                                    await showError(t('settings.restartFailed'), e.toString())
                                                }
                                            }
                                        }}
                                        className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs rounded-lg transition-colors"
                                    >
                                        {t('settings.restartAsAdmin')}
                                    </button>
                                )}
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
                            className={`w-full btn-icon px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium ${colors.danger} ${colors.dangerHover} disabled:opacity-50`}
                        >
                            {machineGuidAction === 'reset' ? <RefreshCw size={16} className="animate-spin" /> : <Shuffle size={16} />}
                            {t('common.reset')}
                        </button>
                    )}
                </Card>


            </div>
        </div>
    )
}

export default Settings
