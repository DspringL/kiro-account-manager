import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { emit } from '@tauri-apps/api/event'
import { Lock, Copy, Sun, Moon, Palette, Check, RefreshCw, Settings as SettingsIcon, Clock, Globe, Search, Shield, Download, Upload, Shuffle, AlertTriangle, Eye, EyeOff, Repeat, LayoutDashboard, Cpu, Bot, Bell } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs'
import { useApp } from '../../../hooks/useApp'
import { useDialog } from '../../../contexts/DialogContext'
import { useAppSettings } from '../../../contexts/AppSettingsContext'
import { usePrivacy } from '../../../contexts/PrivacyContext'
import { getThemeAccent, isLightTheme as checkIsLightTheme } from '../KiroConfig/themeAccent'
import { buildSettingsErrorMessage, persistAppSettings, runKiroCommandWithAppSettings } from './settingsActions'
import { AI_MODELS, buildThemeOptions, NOTIFICATION_SETTINGS_FIELD_MAP } from './settingsConstants'
import { isValidBrowserPath, isValidProxy, resolveOsLabel } from './settingsValidators'
import SettingsAppearance from './SettingsAppearance'
import SettingsGeneral from './SettingsGeneral'
import SettingsKiro from './SettingsKiro'
import SettingsAgent from './SettingsAgent'
import SettingsNotifications from './SettingsNotifications'

function Settings() {
    const { t, theme, colors, setTheme } = useApp()
    const { showConfirm, showError, showSuccess } = useDialog()
    const { updateSettings: updateAppSettings } = useAppSettings()
    const { privacyMode, setPrivacyMode } = usePrivacy()
    const [activeTab, setActiveTab] = useState('general')
    // 用于 SVG 箭头颜色（浅色主题用深色）
    const isLightTheme = checkIsLightTheme(theme)

    const [aiModel, setAiModel] = useState('claude-sonnet-4.5')
    const [lockModel, setLockModel] = useState(false)
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

    // 新增 Kiro IDE 设置
    const [trustedTools, setTrustedTools] = useState('')
    const [referenceTracker, setReferenceTracker] = useState(false)
    const [configureMcp, setConfigureMcp] = useState('Enabled')
    const [telemetryContentCollection, setTelemetryContentCollection] = useState(false)
    const [telemetryUsageAnalytics, setTelemetryUsageAnalytics] = useState(false)
    const [telemetryEditStats, setTelemetryEditStats] = useState(false)
    const [telemetryFeedback, setTelemetryFeedback] = useState(false)

    // 自动换号设置
    const [autoSwitchEnabled, setAutoSwitchEnabled] = useState(false)
    const [autoSwitchThreshold, setAutoSwitchThreshold] = useState(1)
    const [autoSwitchInterval, setAutoSwitchInterval] = useState(5)

    // Kiro IDE 状态
    const [loading, setLoading] = useState(false)

    // 系统机器码
    const [systemMachineInfo, setSystemMachineInfo] = useState(null)
    const [machineGuidAction, setMachineGuidAction] = useState(null) // 'reset'

    const accountToggleContainerClass = `${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text}`
    const accent = getThemeAccent(theme)
    const themeAccentBorderClass = `${accent.border} shadow-md ${accent.shadow}`
    const themeAccentDotClass = accent.solidBg
    const themeAccentTextClass = accent.text
    const themeAccentButtonClass = `${accent.solidBg} text-white ${accent.solidHoverBg} ${accent.border}`

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
                setCustomTrustedCommands(kiroSettings.customTrustedCommands || '')
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
                // 新增设置
                setTrustedTools((kiroSettings.trustedTools || []).join(', '))
                setReferenceTracker(kiroSettings.referenceTracker ?? false)
                setConfigureMcp(kiroSettings.configureMcp || 'Enabled')
                setTelemetryContentCollection(kiroSettings.telemetryContentCollection ?? false)
                setTelemetryUsageAnalytics(kiroSettings.telemetryUsageAnalytics ?? false)
                setTelemetryEditStats(kiroSettings.telemetryEditStats ?? false)
                setTelemetryFeedback(kiroSettings.telemetryFeedback ?? false)
            }
            // 从应用设置读取
            if (appSettings) {
                setLockModel(appSettings.lockModel ?? false)
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

    const saveAppSettings = (updates, notifyChange = false) => persistAppSettings({
        updates,
        notifyChange,
        updateAppSettings,
        emitFn: emit,
        showError,
        t,
    })

    const runKiroCommand = (command, commandArgs, appSettingsUpdates = null, notifyChange = false) => runKiroCommandWithAppSettings({
        command,
        commandArgs,
        appSettingsUpdates,
        notifyChange,
        invokeFn: invoke,
        persistSettings: ({ updates, notifyChange: shouldNotify }) => saveAppSettings(updates, shouldNotify),
        showError,
        t,
    })

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
    }

    const handleAutoRefreshChange = async (checked) => {
        setAutoRefresh(checked)
        await saveAppSettings({ autoRefresh: checked }, true)
    }

    const handleAutoRefreshIntervalChange = async (value) => {
        const interval = parseInt(value) || 50
        setAutoRefreshInterval(interval)
        await saveAppSettings({ autoRefreshInterval: interval }, true)
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
        const parsedValue = typeof value === 'number' ? value : parseFloat(value)
        const threshold = Number.isFinite(parsedValue) ? parsedValue : 1
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
        await runKiroCommand('set_kiro_codebase_indexing', { enabled: checked }, { enableCodebaseIndexing: checked })
    }

    const handleTrustedCommandsModeChange = async (mode) => {
        if (!mode) return
        if (mode === 'all') {
            const confirmed = await showConfirm(
                t('settings.trustedCommandsAllConfirmTitle'),
                t('settings.trustedCommandsAllConfirmMessage'),
                { confirmText: t('settings.trustedCommandsAllConfirmAction'), cancelText: t('common.cancel') }
            )
            if (!confirmed) {
                return
            }
        }
        const previousMode = trustedCommandsMode
        setTrustedCommandsMode(mode)
        try {
            await invoke('set_kiro_trusted_commands', { mode, customCommands: customTrustedCommands })
        } catch (err) {
            setTrustedCommandsMode(previousMode)
            await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
        }
    }

    const handleCustomTrustedCommandsChange = async (commands) => {
        if (trustedCommandsMode === 'common') {
            const hasGlobalWildcard = commands
                .split('\n')
                .map(line => line.trim())
                .some(line => line === '*')
            if (hasGlobalWildcard) {
                await showError(t('settings.saveFailed'), t('settings.trustedCommandsWildcardBlocked'))
                return
            }
            setCustomTrustedCommands(commands)
            try {
                await invoke('set_kiro_trusted_commands', { mode: 'common', customCommands: commands })
            } catch (err) {
                await showError(t('settings.saveFailed'), t('settings.saveFailed') + ': ' + err)
            }
        } else {
            setCustomTrustedCommands(commands)
        }
    }

    // Agent 设置处理函数
    const handleAgentAutonomyChange = async (mode) => {
        setAgentAutonomy(mode)
        await runKiroCommand('set_kiro_agent_autonomy', { autonomy: mode })
    }

    const handleTabAutocompleteChange = async (checked) => {
        setEnableTabAutocomplete(checked)
        await runKiroCommand('set_kiro_tab_autocomplete', { enabled: checked }, { enableTabAutocomplete: checked })
    }

    const handleUsageSummaryChange = async (checked) => {
        setUsageSummary(checked)
        await runKiroCommand('set_kiro_usage_summary', { enabled: checked }, { usageSummary: checked })
    }

    const handleCodeReferencesChange = async (checked) => {
        setCodeReferences(checked)
        await runKiroCommand('set_kiro_code_references', { enabled: checked }, { codeReferences: checked })
    }

    const handleDebugLogsChange = async (checked) => {
        setEnableDebugLogs(checked)
        await runKiroCommand('set_kiro_debug_logs', { enabled: checked }, { enableDebugLogs: checked })
    }

    // 通知设置处理函数
    const handleNotificationChange = async (key, checked, setter) => {
        setter(checked)
        const field = NOTIFICATION_SETTINGS_FIELD_MAP[key]
        await runKiroCommand('set_kiro_notification', { key, enabled: checked }, field ? { [field]: checked } : null)
    }

    // 信任工具处理（逗号分隔字符串 → 数组）
    const handleTrustedToolsSave = async (value) => {
        setTrustedTools(value)
        const tools = value.split(',').map(s => s.trim()).filter(Boolean)
        await runKiroCommand('set_kiro_trusted_tools', { tools }, { trustedTools: tools })
    }

    // 代码引用追踪
    const handleReferenceTrackerChange = async (checked) => {
        setReferenceTracker(checked)
        await runKiroCommand('set_kiro_reference_tracker', { enabled: checked }, { referenceTracker: checked })
    }

    // MCP 配置开关
    const handleConfigureMcpChange = async (mode) => {
        setConfigureMcp(mode)
        await runKiroCommand('set_kiro_configure_mcp', { mode }, { configureMcp: mode })
    }

    // 遥测设置
    const handleTelemetryChange = async (ideKey, checked, setter, appField) => {
        setter(checked)
        await runKiroCommand('set_kiro_telemetry', { key: ideKey, enabled: checked }, { [appField]: checked })
    }

    const handleApplyBrowser = async () => {
        // 验证浏览器路径
        if (!isValidBrowserPath(browserPath)) {
            await showError(t('settings.saveFailed'), t('settings.invalidBrowserPath'))
            return
        }

        setSavingBrowser(true)
        try {
            const nextSettings = await saveAppSettings({ browserPath: browserPath })
            if (!nextSettings) {
                return
            }
            setOriginalBrowserPath(browserPath)
            await showSuccess(t('settings.saveSuccess'), browserPath ? t('settings.browserSaved') : t('settings.defaultBrowser'))
        } catch (err) {
            const errorInfo = buildSettingsErrorMessage(t, err)
            await showError(errorInfo.title, errorInfo.message)
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

            <div className="max-w-5xl w-full relative">
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

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="glass-card mb-6 flex h-11 w-full justify-start overflow-x-auto rounded-xl border-none p-1 no-scrollbar lg:w-fit">
                        <TabsTrigger value="general" className="gap-2 px-5 shrink-0 text-sm font-medium">
                            <LayoutDashboard size={16} />
                            {t('settings.general')}
                        </TabsTrigger>
                        <TabsTrigger value="appearance" className="gap-2 px-5 shrink-0 text-sm font-medium">
                            <Palette size={16} />
                            {t('settings.appearance')}
                        </TabsTrigger>
                        <TabsTrigger value="kiro" className="gap-2 px-5 shrink-0 text-sm font-medium">
                            <Cpu size={16} />
                            {t('settings.kiro')}
                        </TabsTrigger>
                        <TabsTrigger value="agent" className="gap-2 px-5 shrink-0 text-sm font-medium">
                            <Bot size={16} />
                            {t('settings.agent')}
                        </TabsTrigger>
                        <TabsTrigger value="notifications" className="gap-2 px-5 shrink-0 text-sm font-medium">
                            <Bell size={16} />
                            {t('settings.notifications')}
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="general">
                        <SettingsGeneral
                            autoRefresh={autoRefresh}
                            setAutoRefresh={setAutoRefresh}
                            autoRefreshInterval={autoRefreshInterval}
                            setAutoRefreshInterval={setAutoRefreshInterval}
                            autoChangeMachineId={autoChangeMachineId}
                            setAutoChangeMachineId={setAutoChangeMachineId}
                            machineIdMode={machineIdMode}
                            setMachineIdMode={setMachineIdMode}
                            privacyMode={privacyMode}
                            setPrivacyMode={setPrivacyMode}
                            autoSwitchEnabled={autoSwitchEnabled}
                            setAutoSwitchEnabled={setAutoSwitchEnabled}
                            autoSwitchThreshold={autoSwitchThreshold}
                            setAutoSwitchThreshold={setAutoSwitchThreshold}
                            autoSwitchInterval={autoSwitchInterval}
                            setAutoSwitchInterval={setAutoSwitchInterval}
                            browserPath={browserPath}
                            setBrowserPath={setBrowserPath}
                            originalBrowserPath={originalBrowserPath}
                            setOriginalBrowserPath={setOriginalBrowserPath}
                            savingBrowser={savingBrowser}
                            setSavingBrowser={setSavingBrowser}
                            detectedBrowsers={detectedBrowsers}
                            setDetectedBrowsers={setDetectedBrowsers}
                            showBrowserList={showBrowserList}
                            setShowBrowserList={setShowBrowserList}
                            systemMachineInfo={systemMachineInfo}
                            setSystemMachineInfo={setSystemMachineInfo}
                            machineGuidAction={machineGuidAction}
                            handleResetSystemMachineGuid={handleResetSystemMachineGuid}
                            handleDetectBrowsers={handleDetectBrowsers}
                            handleApplyBrowser={handleApplyBrowser}
                            handleAutoRefreshChange={handleAutoRefreshChange}
                            handleAutoRefreshIntervalChange={handleAutoRefreshIntervalChange}
                            handleAutoChangeMachineIdChange={handleAutoChangeMachineIdChange}
                            handleMachineIdModeChange={handleMachineIdModeChange}
                            handleAutoSwitchEnabledChange={handleAutoSwitchEnabledChange}
                            handleAutoSwitchThresholdChange={handleAutoSwitchThresholdChange}
                            handleAutoSwitchIntervalChange={handleAutoSwitchIntervalChange}
                            t={t}
                            colors={colors}
                            accent={accent}
                            themeAccentButtonClass={themeAccentButtonClass}
                            themeAccentTextClass={themeAccentTextClass}
                        />
                    </TabsContent>

                    <TabsContent value="appearance">
                        <SettingsAppearance
                            theme={theme}
                            setTheme={setTheme}
                            t={t}
                            colors={colors}
                        />
                    </TabsContent>

                    <TabsContent value="kiro">
                        <SettingsKiro
                            aiModel={aiModel}
                            setAiModel={setAiModel}
                            lockModel={lockModel}
                            setLockModel={setLockModel}
                            agentAutonomy={agentAutonomy}
                            setAgentAutonomy={setAgentAutonomy}
                            trustedCommandsMode={trustedCommandsMode}
                            setTrustedCommandsMode={setTrustedCommandsMode}
                            customTrustedCommands={customTrustedCommands}
                            setCustomTrustedCommands={setCustomTrustedCommands}
                            trustedTools={trustedTools}
                            setTrustedTools={setTrustedTools}
                            configureMcp={configureMcp}
                            setConfigureMcp={setConfigureMcp}
                            httpProxy={httpProxy}
                            setHttpProxy={setHttpProxy}
                            originalProxy={originalProxy}
                            savingProxy={savingProxy}
                            detectingProxy={detectingProxy}
                            savingModel={savingModel}
                            handleApplyModel={handleApplyModel}
                            handleLockModelChange={handleLockModelChange}
                            handleAgentAutonomyChange={handleAgentAutonomyChange}
                            handleTrustedCommandsModeChange={handleTrustedCommandsModeChange}
                            handleCustomTrustedCommandsChange={handleCustomTrustedCommandsChange}
                            handleTrustedToolsSave={handleTrustedToolsSave}
                            handleConfigureMcpChange={handleConfigureMcpChange}
                            handleApplyProxy={handleApplyProxy}
                            handleDetectProxy={handleDetectProxy}
                            t={t}
                            colors={colors}
                            themeAccentTextClass={themeAccentTextClass}
                            themeAccentButtonClass={themeAccentButtonClass}
                        />
                    </TabsContent>

                    <TabsContent value="agent">
                        <SettingsAgent
                            enableCodebaseIndexing={enableCodebaseIndexing}
                            setEnableCodebaseIndexing={setEnableCodebaseIndexing}
                            enableTabAutocomplete={enableTabAutocomplete}
                            setEnableTabAutocomplete={setEnableTabAutocomplete}
                            usageSummary={usageSummary}
                            setUsageSummary={setUsageSummary}
                            codeReferences={codeReferences}
                            setCodeReferences={setCodeReferences}
                            enableDebugLogs={enableDebugLogs}
                            setEnableDebugLogs={setEnableDebugLogs}
                            referenceTracker={referenceTracker}
                            setReferenceTracker={setReferenceTracker}
                            handleCodebaseIndexingChange={handleCodebaseIndexingChange}
                            handleTabAutocompleteChange={handleTabAutocompleteChange}
                            handleUsageSummaryChange={handleUsageSummaryChange}
                            handleCodeReferencesChange={handleCodeReferencesChange}
                            handleDebugLogsChange={handleDebugLogsChange}
                            handleReferenceTrackerChange={handleReferenceTrackerChange}
                            t={t}
                            colors={colors}
                        />
                    </TabsContent>

                    <TabsContent value="notifications">
                        <SettingsNotifications
                            notifyActionRequired={notifyActionRequired}
                            setNotifyActionRequired={setNotifyActionRequired}
                            notifyFailure={notifyFailure}
                            setNotifyFailure={setNotifyFailure}
                            notifySuccess={notifySuccess}
                            setNotifySuccess={setNotifySuccess}
                            notifyBilling={notifyBilling}
                            setNotifyBilling={setNotifyBilling}
                            telemetryContentCollection={telemetryContentCollection}
                            setTelemetryContentCollection={setTelemetryContentCollection}
                            telemetryUsageAnalytics={telemetryUsageAnalytics}
                            setTelemetryUsageAnalytics={setTelemetryUsageAnalytics}
                            telemetryEditStats={telemetryEditStats}
                            setTelemetryEditStats={setTelemetryEditStats}
                            telemetryFeedback={telemetryFeedback}
                            setTelemetryFeedback={setTelemetryFeedback}
                            handleNotificationChange={handleNotificationChange}
                            handleTelemetryChange={handleTelemetryChange}
                            t={t}
                            colors={colors}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    )
}

export default Settings
