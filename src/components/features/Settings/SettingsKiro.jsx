import { Lock, Search, RefreshCw, Check } from 'lucide-react'
import { Card, CardContent } from '../../ui/card'
import { Input } from '../../ui/input'
import { Textarea } from '../../ui/textarea'
import { Switch } from '../../ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { Label } from '../../ui/label'
import { AI_MODELS } from './settingsConstants'
import React from 'react'

function SettingsKiro({
  aiModel,
  setAiModel,
  lockModel,
  setLockModel,
  agentAutonomy,
  setAgentAutonomy,
  trustedCommandsMode,
  setTrustedCommandsMode,
  customTrustedCommands,
  setCustomTrustedCommands,
  trustedTools,
  setTrustedTools,
  configureMcp,
  setConfigureMcp,
  httpProxy,
  setHttpProxy,
  originalProxy,
  savingProxy,
  detectingProxy,
  savingModel,
  handleApplyModel,
  handleLockModelChange,
  handleAgentAutonomyChange,
  handleTrustedCommandsModeChange,
  handleCustomTrustedCommandsChange,
  handleTrustedToolsSave,
  handleConfigureMcpChange,
  handleApplyProxy,
  handleDetectProxy,
  t,
  colors,
  themeAccentTextClass,
  themeAccentButtonClass
}) {
  const proxyChanged = httpProxy !== originalProxy

  return (
    <Card className="card-glow animate-slide-in-left delay-150 mb-6">
      <CardContent className="p-6">
        <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{t('settings.kiroSettings')}</h2>
        <p className={`text-sm ${colors.textMuted} mb-4`}>{t('settings.kiroSettingsDesc')}</p>

        <div className="grid grid-cols-2 gap-6">
          {/* 左列：下拉选项 + 代理 */}
          <div className="space-y-4">
            {/* AI 模型 */}
            <div>
              <Label className={`block text-sm ${colors.textMuted} mb-1.5`}>
                {t('settings.aiModel')} {savingModel && <span className={`text-xs ml-2 ${themeAccentTextClass}`}>{t('settings.saving')}</span>}
              </Label>
              <Select value={aiModel} onValueChange={handleApplyModel} disabled={savingModel}>
                <SelectTrigger className={`${colors.text} ${colors.input}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={`${colors.card} border ${colors.cardBorder}`}>
                  {AI_MODELS.map(model => (
                    <SelectItem key={model.value} value={model.value} className={colors.text}>
                      {model.recommended ? `${model.label} (⭐ ${t('common.recommended')})` : model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 锁定模型 */}
            <label className={`flex items-center gap-3 cursor-pointer rounded-lg p-3 border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
              <Switch checked={lockModel} onCheckedChange={handleLockModelChange} />
              <Lock size={14} className={colors.textMuted} />
              <div>
                <span className={`text-sm ${colors.text}`}>{t('settings.lockModel')}</span>
                <p className={`text-xs ${colors.textMuted}`}>{t('settings.lockModelDesc')}</p>
              </div>
            </label>

            {/* Agent 自主模式 */}
            <div>
              <Label className={`block text-sm ${colors.textMuted} mb-1.5`}>{t('settings.agentAutonomy')}</Label>
              <Select value={agentAutonomy} onValueChange={handleAgentAutonomyChange}>
                <SelectTrigger className={`${colors.text} ${colors.input} ${colors.inputFocus}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={`${colors.card} border ${colors.cardBorder}`}>
                  <SelectItem value="Supervised" className={colors.text}>{t('settings.agentSupervised')}</SelectItem>
                  <SelectItem value="Autopilot" className={colors.text}>{t('settings.agentAutopilot')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 信任命令 */}
            <div>
              <Label className={`block text-sm ${colors.textMuted} mb-1.5`}>{t('settings.trustedCommands')}</Label>
              <Select value={trustedCommandsMode} onValueChange={handleTrustedCommandsModeChange}>
                <SelectTrigger className={`${colors.text} ${colors.input} ${colors.inputFocus}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={`${colors.card} border ${colors.cardBorder}`}>
                  <SelectItem value="none" className={colors.text}>{t('settings.trustedCommandsNone')}</SelectItem>
                  <SelectItem value="common" className={colors.text}>{t('settings.trustedCommandsCommon')}</SelectItem>
                  <SelectItem value="all" className={colors.text}>{t('settings.trustedCommandsAll')}</SelectItem>
                </SelectContent>
              </Select>
              {trustedCommandsMode === 'common' && (
                <Textarea
                  value={customTrustedCommands}
                  onChange={(e) => handleCustomTrustedCommandsChange(e.target.value)}
                  placeholder="npm *&#10;git *&#10;cargo *"
                  className={`${colors.text} ${colors.input} ${colors.inputFocus} font-mono text-sm mt-2`}
                  rows={3}
                />
              )}
              <p className={`text-xs ${colors.textMuted} mt-1`}>{t('settings.trustedCommandsDesc')}</p>
            </div>

            {/* 信任工具 */}
            <div>
              <label className={`block text-sm ${colors.textMuted} mb-1.5`}>{t('settings.trustedTools')}</label>
              <Input
                value={trustedTools}
                onChange={(e) => setTrustedTools(e.target.value)}
                onBlur={(e) => handleTrustedToolsSave(e.target.value)}
                placeholder={t('settings.trustedToolsPlaceholder')}
                className={`${colors.text} ${colors.input} ${colors.inputFocus}`}
              />
              <p className={`text-xs ${colors.textMuted} mt-1`}>{t('settings.trustedToolsDesc')}</p>
            </div>

            {/* MCP 配置 */}
            <div>
              <label className={`block text-sm ${colors.textMuted} mb-1.5`}>{t('settings.configureMCP')}</label>
              <Select value={configureMcp} onValueChange={handleConfigureMcpChange}>
                <SelectTrigger className={`${colors.text} ${colors.input} ${colors.inputFocus}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={`${colors.card} border ${colors.cardBorder}`}>
                  <SelectItem value="Enabled" className={colors.text}>{t('settings.configureMCPEnabled')}</SelectItem>
                  <SelectItem value="Disabled" className={colors.text}>{t('settings.configureMCPDisabled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* HTTP 代理 */}
            <div>
              <label className={`block text-sm ${colors.textMuted} mb-1.5`}>{t('settings.httpProxy')}</label>
              <div className="flex gap-2">
                <Input
                  value={httpProxy}
                  onChange={(e) => setHttpProxy(e.target.value)}
                  placeholder="http://127.0.0.1:7897"
                  className={`${colors.text} ${colors.input} ${colors.inputFocus} flex-1`}
                />
                <button
                  onClick={handleDetectProxy}
                  disabled={detectingProxy}
                  className={`btn-icon px-3 py-2 border rounded-lg ${colors.card} ${colors.cardHover} border ${colors.cardBorder} ${colors.text} flex items-center gap-1 text-xs`}
                  title={t('settings.detectProxyTitle')}
                >
                  {detectingProxy ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
                  {t('settings.detect')}
                </button>
                <button
                  onClick={handleApplyProxy}
                  disabled={savingProxy || !proxyChanged}
                  className={`btn-icon px-3 py-2 rounded-lg flex items-center gap-1 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed border ${proxyChanged
                    ? themeAccentButtonClass
                    : `${colors.cardSecondary} ${colors.textMuted} ${colors.cardBorder}`
                    }`}
                >
                  {savingProxy ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                  {savingProxy ? t('settings.saving') : t('settings.apply')}
                </button>
              </div>
              <p className={`text-xs ${colors.textMuted} mt-1`}>{t('settings.proxyTip')}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default SettingsKiro
