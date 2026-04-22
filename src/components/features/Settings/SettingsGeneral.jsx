import { Clock, Globe, Search, Shield, Shuffle, AlertTriangle, Eye, EyeOff, Repeat, RefreshCw, Check, Copy } from 'lucide-react'
import { Card, CardContent } from '../../ui/card'
import { Input } from '../../ui/input'
import { Switch } from '../../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Button } from '../../ui/button'
import { Label } from '../../ui/label'
import { resolveOsLabel } from './settingsValidators'
import React from 'react'

function SettingsGeneral({ 
  autoRefresh, 
  setAutoRefresh, 
  autoRefreshInterval, 
  setAutoRefreshInterval, 
  autoChangeMachineId, 
  setAutoChangeMachineId, 
  machineIdMode, 
  setMachineIdMode, 
  privacyMode, 
  setPrivacyMode, 
  autoSwitchEnabled, 
  setAutoSwitchEnabled, 
  autoSwitchThreshold, 
  setAutoSwitchThreshold, 
  autoSwitchInterval, 
  setAutoSwitchInterval, 
  browserPath, 
  setBrowserPath, 
  originalBrowserPath, 
  setOriginalBrowserPath, 
  savingBrowser, 
  setSavingBrowser, 
  detectedBrowsers, 
  setDetectedBrowsers, 
  showBrowserList, 
  setShowBrowserList, 
  systemMachineInfo, 
  setSystemMachineInfo, 
  machineGuidAction, 
  handleResetSystemMachineGuid, 
  handleDetectBrowsers, 
  handleApplyBrowser, 
  handleAutoRefreshChange, 
  handleAutoRefreshIntervalChange, 
  handleAutoChangeMachineIdChange, 
  handleMachineIdModeChange, 
  handleAutoSwitchEnabledChange, 
  handleAutoSwitchThresholdChange, 
  handleAutoSwitchIntervalChange, 
  t, 
  colors, 
  accent, 
  themeAccentButtonClass, 
  themeAccentTextClass 
}) {
  const accountToggleContainerClass = `${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text}`
  const browserChanged = browserPath !== originalBrowserPath

  const [copiedField, setCopiedField] = React.useState(null)
  const copiedTimerRef = React.useRef(null)

  React.useEffect(() => {
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

  const handleSelectBrowser = (browser, useIncognito = true) => {
    const path = useIncognito && browser.incognitoArg
      ? `"${browser.path}" ${browser.incognitoArg}`
      : `"${browser.path}"`
    setBrowserPath(path)
    setShowBrowserList(false)
  }

  return (
    <>
      {/* 账号设置 */}
      <Card className="card-glow animate-slide-in-left delay-200 mb-6">
        <CardContent className="p-6">
          <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{t('settings.account')}</h2>
          <p className={`text-sm ${colors.textMuted} mb-4`}>{t('settings.accountDesc')}</p>

          {/* 自动刷新 Token + 刷新间隔 */}
          <div className="flex items-center gap-3 mb-4">
            <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border flex-shrink-0 ${accountToggleContainerClass}`} title={t('settings.autoRefreshDesc')}>
              <Switch checked={autoRefresh} onCheckedChange={handleAutoRefreshChange} />
              <Clock size={16} />
              <span className="text-sm font-medium whitespace-nowrap">{t('settings.autoRefresh')}</span>
            </label>
            <div className="relative flex-1">
              <Select value={String(autoRefreshInterval)} onValueChange={handleAutoRefreshIntervalChange} disabled={!autoRefresh}>
                <SelectTrigger className={`${colors.text} ${colors.input} ${colors.inputFocus}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={`${colors.card} border ${colors.cardBorder}`}>
                  <SelectItem value="10" className={colors.text}>10 {t('common.minutes')}</SelectItem>
                  <SelectItem value="20" className={colors.text}>20 {t('common.minutes')}</SelectItem>
                  <SelectItem value="30" className={colors.text}>30 {t('common.minutes')}</SelectItem>
                  <SelectItem value="40" className={colors.text}>40 {t('common.minutes')}</SelectItem>
                  <SelectItem value="50" className={colors.text}>50 {t('common.minutes')} ({t('common.recommended')})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 机器码设置 - 勾选框 + 二选一下拉框 */}
          <div className="flex items-center gap-3 mb-4">
            <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border flex-shrink-0 ${accountToggleContainerClass}`} title={t('settings.autoChangeMachineIdDesc')}>
              <Switch checked={autoChangeMachineId} onCheckedChange={handleAutoChangeMachineIdChange} />
              <Shuffle size={16} />
              <span className="text-sm font-medium whitespace-nowrap">{t('settings.autoChangeMachineId')}</span>
            </label>
            <div className="relative flex-1">
              <Select value={machineIdMode} onValueChange={handleMachineIdModeChange} disabled={!autoChangeMachineId}>
                <SelectTrigger className={`${colors.text} ${colors.input} ${colors.inputFocus}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={`${colors.card} border ${colors.cardBorder}`}>
                  <SelectItem value="bind" className={colors.text}>{t('settings.machineIdBind')} ({t('common.recommended')})</SelectItem>
                  <SelectItem value="random" className={colors.text}>{t('settings.machineIdRandom')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 隐私模式 */}
          <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border mb-4 ${accountToggleContainerClass}`} title={t('settings.privacyModeDesc')}>
            <Switch checked={privacyMode} onCheckedChange={setPrivacyMode} />
            {privacyMode ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="text-sm font-medium whitespace-nowrap">{t('settings.privacyMode')}</span>
            <span className={`text-xs ${colors.textMuted} ml-1`}>({t('settings.privacyModeHint')})</span>
          </label>

          {/* 自动换号 */}
          <div>
            <label className={`flex items-center gap-2 cursor-pointer px-4 py-3 rounded-xl border mb-2 ${accountToggleContainerClass}`} title={t('settings.autoSwitchDesc')}>
              <Switch checked={autoSwitchEnabled} onCheckedChange={handleAutoSwitchEnabledChange} />
              <Repeat size={16} />
              <span className="text-sm font-medium whitespace-nowrap">{t('settings.autoSwitch')}</span>
            </label>
            <div className="flex items-center gap-2">
              <span className={`text-xs ${colors.textMuted} whitespace-nowrap`}>{t('settings.autoSwitchThreshold')}</span>
              <Input
                type="number"
                value={autoSwitchThreshold}
                onChange={(e) => handleAutoSwitchThresholdChange(parseFloat(e.target.value) || 0)}
                disabled={!autoSwitchEnabled}
                min={0}
                step={0.1}
                className={`${colors.text} ${colors.input} ${colors.inputFocus} text-center w-16`}
              />
              <Select value={String(autoSwitchInterval)} onValueChange={handleAutoSwitchIntervalChange} disabled={!autoSwitchEnabled}>
                <SelectTrigger className={`${colors.text} ${colors.input} ${colors.inputFocus} flex-1`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={`${colors.card} border ${colors.cardBorder}`}>
                  <SelectItem value="1" className={colors.text}>1 {t('common.minutes')}</SelectItem>
                  <SelectItem value="3" className={colors.text}>3 {t('common.minutes')}</SelectItem>
                  <SelectItem value="5" className={colors.text}>5 {t('common.minutes')}</SelectItem>
                  <SelectItem value="10" className={colors.text}>10 {t('common.minutes')}</SelectItem>
                  <SelectItem value="15" className={colors.text}>15 {t('common.minutes')}</SelectItem>
                  <SelectItem value="30" className={colors.text}>30 {t('common.minutes')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 浏览器设置 */}
      <Card className="card-glow animate-slide-in-left delay-250 mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Globe size={18} className={themeAccentTextClass} />
            <h2 className={`text-lg font-semibold ${colors.text}`}>{t('settings.browser')}</h2>
          </div>
          <p className={`text-sm ${colors.textMuted} mb-4`}>{t('settings.browserDesc')}</p>

          <div className="mb-3">
            <label className={`block text-sm ${colors.textMuted} mb-2`}>{t('settings.browserPath')}</label>
            <div className="flex gap-3">
              <Input
                value={browserPath}
                onChange={(e) => setBrowserPath(e.target.value)}
                placeholder={t('settings.browserPlaceholder')}
                className={`${colors.text} ${colors.input} ${colors.inputFocus} flex-1`}
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
                  ? themeAccentButtonClass
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
                <button onClick={() => setShowBrowserList(false)} className={`text-xs ${colors.textMuted} hover:underline`}>
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
                      <button onClick={() => handleSelectBrowser(browser, true)} className={`btn-icon px-3 py-1.5 text-xs rounded-lg transition-colors border ${themeAccentButtonClass}`}>
                        {t('settings.selectBrowser')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className={`text-xs ${colors.textMuted} mt-3`}>{t('settings.browserTip')}</p>
        </CardContent>
      </Card>

      {/* 系统机器码管理 */}
      <Card className="card-glow animate-slide-in-left delay-300 mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-orange-500" />
            <h2 className={`text-lg font-semibold ${colors.text}`}>{t('settings.systemMachineGuid')}</h2>
            {systemMachineInfo?.osType && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${colors.textMuted} border ${colors.cardBorder} ${colors.cardSecondary}`}>
                {resolveOsLabel(systemMachineInfo.osType, t('common.unknown'))}
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
              <button onClick={() => {}} className={`btn-icon p-1.5 rounded-lg ${colors.cardHover} transition-colors`}>
                <RefreshCw size={14} className={`${colors.textMuted}`} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <code className={`flex-1 text-sm px-3 py-2 rounded-lg font-mono ${colors.text} border ${colors.cardBorder} ${colors.card}`}>
                {systemMachineInfo?.machineGuid || t('common.loading')}
              </code>
              {systemMachineInfo?.machineGuid && (
                <button onClick={() => copyToClipboard(systemMachineInfo.machineGuid, 'sysMachineGuid')} className={`btn-icon p-2 rounded-lg ${colors.cardHover} transition-colors`}>
                  {copiedField === 'sysMachineGuid' ? <Check size={16} className="text-green-500" /> : <Copy size={16} className={colors.textMuted} />}
                </button>
              )}
            </div>
          </div>

          {/* 警告提示 - 需要管理员权限时显示 */}
          {systemMachineInfo?.requiresAdmin && (
            <div className={`flex items-start gap-3 ${colors.warning} rounded-xl p-4 mb-4 border ${colors.warningBorder}`}>
              <AlertTriangle size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className={`font-medium text-orange-500 mb-2 text-sm`}>{t('settings.adminWarningTitle')}</p>
                <ul className={`list-disc list-inside space-y-1 mb-3 text-xs ${colors.textMuted}`}>
                  <li>{t('settings.adminWarning1')}</li>
                  <li>{t('settings.adminWarning2')}</li>
                  <li>{t('settings.adminWarning3')}</li>
                </ul>
                {systemMachineInfo?.osType !== 'macos' && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-500/20 border border-orange-500/30 rounded-lg mt-1">
                    <Shield size={14} className="text-orange-500" />
                    <span className="text-xs font-medium text-orange-500">{t('settings.restartAsAdmin')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* macOS 提示 */}
          {systemMachineInfo?.osType === 'macos' && (
            <div className={`flex items-start gap-3 ${colors.info} rounded-xl p-4 mb-4 border ${colors.infoBorder}`}>
              <Shield size={18} className={`${themeAccentTextClass} flex-shrink-0 mt-0.5`} />
              <div className={`text-xs ${colors.textMuted}`}>
                <p className={`font-medium ${themeAccentTextClass} mb-1`}>{t('settings.macOSNote')}</p>
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
        </CardContent>
      </Card>
    </>
  )
}

export default SettingsGeneral
