import { Switch } from '../../ui/switch'
import { Card, CardContent } from '../../ui/card'
import React from 'react'

function SettingsNotifications({
  notifyActionRequired,
  setNotifyActionRequired,
  notifyFailure,
  setNotifyFailure,
  notifySuccess,
  setNotifySuccess,
  notifyBilling,
  setNotifyBilling,
  telemetryContentCollection,
  setTelemetryContentCollection,
  telemetryUsageAnalytics,
  setTelemetryUsageAnalytics,
  telemetryEditStats,
  setTelemetryEditStats,
  telemetryFeedback,
  setTelemetryFeedback,
  handleNotificationChange,
  handleTelemetryChange,
  t,
  colors
}) {
  return (
    <>
      {/* 通知设置 */}
      <Card className="card-glow animate-slide-in-left delay-200 mb-6">
        <CardContent className="p-6">
          <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{t('settings.notifications')}</h2>
          <p className={`text-sm ${colors.textMuted} mb-4`}>{t('settings.notificationsDesc')}</p>

          <div className="grid grid-cols-2 gap-2">
            <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
              <Switch checked={notifyActionRequired} onCheckedChange={(checked) => handleNotificationChange('kiroAgent.notifications.agent.actionRequired', checked, setNotifyActionRequired)} />
              <span className={`text-xs ${colors.text}`}>{t('settings.notifyActionRequired')}</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
              <Switch checked={notifyFailure} onCheckedChange={(checked) => handleNotificationChange('kiroAgent.notifications.agent.failure', checked, setNotifyFailure)} />
              <span className={`text-xs ${colors.text}`}>{t('settings.notifyFailure')}</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
              <Switch checked={notifySuccess} onCheckedChange={(checked) => handleNotificationChange('kiroAgent.notifications.agent.success', checked, setNotifySuccess)} />
              <span className={`text-xs ${colors.text}`}>{t('settings.notifySuccess')}</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
              <Switch checked={notifyBilling} onCheckedChange={(checked) => handleNotificationChange('kiroAgent.notifications.billing', checked, setNotifyBilling)} />
              <span className={`text-xs ${colors.text}`}>{t('settings.notifyBilling')}</span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* 遥测与隐私 */}
      <Card className="card-glow animate-slide-in-left delay-250 mb-6">
        <CardContent className="p-6">
          <h2 className={`text-lg font-semibold ${colors.text} mb-1`}>{t('settings.telemetry')}</h2>
          <p className={`text-sm ${colors.textMuted} mb-4`}>{t('settings.telemetryDesc')}</p>

          <div className="grid grid-cols-2 gap-2">
            <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
              <Switch checked={telemetryContentCollection} onCheckedChange={(checked) => handleTelemetryChange('telemetry.dataSharingAndPromptLogging.contentCollectionForServiceImprovement', checked, setTelemetryContentCollection, 'telemetryContentCollection')} />
              <span className={`text-xs ${colors.text}`}>{t('settings.telemetryContentCollection')}</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
              <Switch checked={telemetryUsageAnalytics} onCheckedChange={(checked) => handleTelemetryChange('telemetry.dataSharingAndPromptLogging.usageAnalyticsAndPerformanceMetrics', checked, setTelemetryUsageAnalytics, 'telemetryUsageAnalytics')} />
              <span className={`text-xs ${colors.text}`}>{t('settings.telemetryUsageAnalytics')}</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
              <Switch checked={telemetryEditStats} onCheckedChange={(checked) => handleTelemetryChange('telemetry.editStats.enabled', checked, setTelemetryEditStats, 'telemetryEditStats')} />
              <span className={`text-xs ${colors.text}`}>{t('settings.telemetryEditStats')}</span>
            </label>
            <label className={`flex items-center gap-2 cursor-pointer p-2 rounded-lg border ${colors.cardBorder} ${colors.cardSecondary} ${colors.cardHover}`}>
              <Switch checked={telemetryFeedback} onCheckedChange={(checked) => handleTelemetryChange('telemetry.feedback.enabled', checked, setTelemetryFeedback, 'telemetryFeedback')} />
              <span className={`text-xs ${colors.text}`}>{t('settings.telemetryFeedback')}</span>
            </label>
          </div>
        </CardContent>
      </Card>
    </>
  )
}

export default SettingsNotifications
