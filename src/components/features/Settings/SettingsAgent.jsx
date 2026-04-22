import { Switch } from '../../ui/switch'
import { Card, CardContent } from '../../ui/card'
import React from 'react'

function SettingsAgent({
  enableCodebaseIndexing,
  enableTabAutocomplete,
  usageSummary,
  codeReferences,
  enableDebugLogs,
  referenceTracker,
  handleCodebaseIndexingChange,
  handleTabAutocompleteChange,
  handleUsageSummaryChange,
  handleCodeReferencesChange,
  handleDebugLogsChange,
  handleReferenceTrackerChange,
  t
}) {
  return (
    <Card className="card-glow animate-slide-in-left delay-200 mb-6">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-foreground mb-1">{t('settings.agentSettings')}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t('settings.agentSettingsDesc')}</p>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
            <Switch checked={enableCodebaseIndexing} onCheckedChange={handleCodebaseIndexingChange} />
            <span className="text-xs text-foreground">{t('settings.enableCodebaseIndexing')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
            <Switch checked={enableTabAutocomplete} onCheckedChange={handleTabAutocompleteChange} />
            <span className="text-xs text-foreground">{t('settings.enableTabAutocomplete')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
            <Switch checked={usageSummary} onCheckedChange={handleUsageSummaryChange} />
            <span className="text-xs text-foreground">{t('settings.usageSummary')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
            <Switch checked={codeReferences} onCheckedChange={handleCodeReferencesChange} />
            <span className="text-xs text-foreground">{t('settings.codeReferences')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
            <Switch checked={enableDebugLogs} onCheckedChange={handleDebugLogsChange} />
            <span className="text-xs text-foreground">{t('settings.enableDebugLogs')}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border bg-muted/30 hover:bg-muted/50">
            <Switch checked={referenceTracker} onCheckedChange={handleReferenceTrackerChange} />
            <span className="text-xs text-foreground">{t('settings.referenceTracker')}</span>
          </label>
        </div>
      </CardContent>
    </Card>
  )
}

export default SettingsAgent
