import { Switch } from '../../ui/switch'
import { Card, CardContent } from '../../ui/card'
import React from 'react'

function SettingsAgent({
  enableCodebaseIndexing,
  setEnableCodebaseIndexing,
  enableTabAutocomplete,
  setEnableTabAutocomplete,
  usageSummary,
  setUsageSummary,
  codeReferences,
  setCodeReferences,
  enableDebugLogs,
  setEnableDebugLogs,
  referenceTracker,
  setReferenceTracker,
  handleCodebaseIndexingChange,
  handleTabAutocompleteChange,
  handleUsageSummaryChange,
  handleCodeReferencesChange,
  handleDebugLogsChange,
  handleReferenceTrackerChange,
  t,
  colors
}) {
  return (
    <Card className="card-glow animate-slide-in-left delay-200 mb-6">
      <CardContent className="p-6">
        <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{t('settings.agentSettings')}</h2>
        <p className={`text-sm ${colors.textMuted} mb-4`}>{t('settings.agentSettingsDesc')}</p>

        <div className="grid grid-cols-2 gap-2">
          <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
            <Switch checked={enableCodebaseIndexing} onCheckedChange={handleCodebaseIndexingChange} />
            <span className={`text-xs ${colors.text}`}>{t('settings.enableCodebaseIndexing')}</span>
          </label>
          <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
            <Switch checked={enableTabAutocomplete} onCheckedChange={handleTabAutocompleteChange} />
            <span className={`text-xs ${colors.text}`}>{t('settings.enableTabAutocomplete')}</span>
          </label>
          <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
            <Switch checked={usageSummary} onCheckedChange={handleUsageSummaryChange} />
            <span className={`text-xs ${colors.text}`}>{t('settings.usageSummary')}</span>
          </label>
          <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
            <Switch checked={codeReferences} onCheckedChange={handleCodeReferencesChange} />
            <span className={`text-xs ${colors.text}`}>{t('settings.codeReferences')}</span>
          </label>
          <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
            <Switch checked={enableDebugLogs} onCheckedChange={handleDebugLogsChange} />
            <span className={`text-xs ${colors.text}`}>{t('settings.enableDebugLogs')}</span>
          </label>
          <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
            <Switch checked={referenceTracker} onCheckedChange={handleReferenceTrackerChange} />
            <span className={`text-xs ${colors.text}`}>{t('settings.referenceTracker')}</span>
          </label>
        </div>
      </CardContent>
    </Card>
  )
}

export default SettingsAgent
