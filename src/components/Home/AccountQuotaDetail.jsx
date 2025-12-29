import { RefreshCw } from 'lucide-react'

// 当前账号配额详情
function AccountQuotaDetail({ 
  currentAccount, 
  currentQuotaInfo, 
  refreshingAccount, 
  handleRefreshCurrentAccount, 
  maskEmail,
  isLightTheme, 
  colors, 
  t 
}) {
  const usageData = currentAccount.usageData
  const breakdown = usageData?.usageBreakdownList?.[0] || usageData?.usageBreakdown
  const subInfo = usageData?.subscriptionInfo
  const userInfo = usageData?.userInfo
  const overageConfig = usageData?.overageConfiguration
  const freeTrial = breakdown?.freeTrialInfo
  const bonuses = breakdown?.bonuses || []
  const mainUsed = breakdown?.currentUsage ?? 0
  const mainLimit = breakdown?.usageLimit ?? 0
  const mainPercent = mainLimit > 0 ? Math.round((mainUsed / mainLimit) * 100) : 0
  const nextDateReset = usageData?.nextDateReset
  const isTrial = subInfo?.subscriptionTitle?.toLowerCase()?.includes('trial') || 
                  subInfo?.subscriptionTitle?.toLowerCase()?.includes('free')
  
  // 计算剩余天数
  let daysUntilReset = null
  let resetTimestamp = null
  
  if (isTrial && freeTrial?.freeTrialExpiry) {
    resetTimestamp = freeTrial.freeTrialExpiry
  } else if (nextDateReset) {
    resetTimestamp = nextDateReset
  }
  
  if (resetTimestamp) {
    const resetDate = new Date(resetTimestamp * 1000)
    const now = new Date()
    const diffTime = resetDate.getTime() - now.getTime()
    daysUntilReset = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
  }

  const { quota: currentQuota, used: currentUsed, percent: currentPercent } = currentQuotaInfo

  return (
    <div className={`card-glow ${colors.card} rounded-2xl shadow-sm border ${colors.cardBorder} overflow-hidden animate-scale-in delay-500`}>
      {/* 头部 */}
      <AccountHeader 
        currentAccount={currentAccount}
        userInfo={userInfo}
        subInfo={subInfo}
        daysUntilReset={daysUntilReset}
        refreshingAccount={refreshingAccount}
        handleRefreshCurrentAccount={handleRefreshCurrentAccount}
        maskEmail={maskEmail}
        isLightTheme={isLightTheme}
        colors={colors}
        t={t}
      />
      
      <div className="p-5">
        {/* 本月用量进度 */}
        <MonthlyUsageProgress 
          currentPercent={currentPercent}
          currentUsed={currentUsed}
          currentQuota={currentQuota}
          isLightTheme={isLightTheme}
          colors={colors}
          t={t}
        />

        {/* 两列布局 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {subInfo && (
            <SubscriptionDetails 
              subInfo={subInfo}
              overageConfig={overageConfig}
              isLightTheme={isLightTheme}
              colors={colors}
              t={t}
            />
          )}
          <AccountInfo 
            currentAccount={currentAccount}
            userInfo={userInfo}
            breakdown={breakdown}
            nextDateReset={nextDateReset}
            isLightTheme={isLightTheme}
            colors={colors}
            t={t}
          />
        </div>

        {/* 额度明细 */}
        <QuotaBreakdown 
          mainUsed={mainUsed}
          mainLimit={mainLimit}
          mainPercent={mainPercent}
          freeTrial={freeTrial}
          bonuses={bonuses}
          isLightTheme={isLightTheme}
          colors={colors}
          t={t}
        />
      </div>
    </div>
  )
}

// 账号头部
function AccountHeader({ currentAccount, userInfo, subInfo, daysUntilReset, refreshingAccount, handleRefreshCurrentAccount, maskEmail, isLightTheme, colors, t }) {
  return (
    <div className={`px-5 py-4 border-b ${colors.cardBorder} flex items-center gap-4`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-md ${
        currentAccount.provider === 'Google' ? 'bg-gradient-to-br from-red-500 to-orange-500' :
        currentAccount.provider === 'Github' ? 'bg-gradient-to-br from-gray-700 to-gray-900' :
        'bg-gradient-to-br from-blue-500 to-purple-600'
      }`}>
        {currentAccount.provider?.[0] || 'K'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-semibold ${colors.text} truncate`}>{maskEmail(userInfo?.email || currentAccount.email)}</span>
          {subInfo?.type && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${
              subInfo.type.includes('PRO+') ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' :
              subInfo.type.includes('PRO') ? 'bg-blue-500 text-white' :
              (isLightTheme ? 'bg-gray-200 text-gray-700' : 'bg-gray-600 text-gray-300')
            }`}>
              {subInfo.subscriptionTitle || 'Free'}
            </span>
          )}
        </div>
        <div className={`text-xs ${colors.textMuted} mt-0.5`}>
          {currentAccount.provider}
          {daysUntilReset != null && ` · ${daysUntilReset === 0 ? t('home.resetToday') : `${daysUntilReset} ${t('home.daysUntilReset')}`}`}
        </div>
      </div>
      <button 
        onClick={handleRefreshCurrentAccount}
        disabled={refreshingAccount}
        className={`btn-icon p-2 ${isLightTheme ? 'hover:bg-gray-100' : 'hover:bg-white/10'} rounded-xl disabled:opacity-50 transition-all`}
        title={t('home.refreshAccount')}
      >
        <RefreshCw size={16} className={`${colors.textMuted} ${refreshingAccount ? 'animate-spin' : ''}`} />
      </button>
    </div>
  )
}

// 本月用量进度
function MonthlyUsageProgress({ currentPercent, currentUsed, currentQuota, isLightTheme, colors, t }) {
  return (
    <div className={`${isLightTheme ? 'bg-gradient-to-r from-blue-50 to-purple-50' : 'bg-gradient-to-r from-blue-500/10 to-purple-500/10'} rounded-xl p-4 mb-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-medium ${colors.text}`}>{t('home.monthlyUsage')}</span>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-bold ${
            currentPercent > 80 ? 'text-red-500' : currentPercent > 50 ? 'text-amber-500' : (isLightTheme ? 'text-blue-600' : 'text-blue-400')
          }`}>{currentPercent}%</span>
          <span className={`text-xs ${colors.textMuted}`}>{currentUsed} / {currentQuota}</span>
        </div>
      </div>
      <div className={`h-2.5 ${isLightTheme ? 'bg-white' : 'bg-white/10'} rounded-full overflow-hidden shadow-inner`}>
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            currentPercent > 80 ? 'bg-gradient-to-r from-red-400 to-red-500' : 
            currentPercent > 50 ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 
            'bg-gradient-to-r from-blue-400 to-purple-500'
          }`}
          style={{ width: `${currentPercent}%` }}
        />
      </div>
    </div>
  )
}

// 订阅详情
function SubscriptionDetails({ subInfo, overageConfig, isLightTheme, colors, t }) {
  return (
    <div className={`${isLightTheme ? 'bg-gray-50' : 'bg-white/5'} rounded-lg p-3`}>
      <div className={`text-[10px] font-medium ${isLightTheme ? 'text-blue-600' : 'text-blue-400'} mb-2 uppercase tracking-wide`}>{t('home.subscriptionDetails')}</div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className={colors.textMuted}>{t('home.type')}</span>
          <span className={colors.text}>{subInfo.subscriptionTitle || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.textMuted}>{t('home.overage')}</span>
          <span className={`${subInfo.overageCapability === 'OVERAGE_CAPABLE' ? 'text-green-500' : colors.textMuted}`}>
            {subInfo.overageCapability === 'OVERAGE_CAPABLE' ? '✓' : '✗'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className={colors.textMuted}>{t('home.upgrade')}</span>
          <span className={`${subInfo.upgradeCapability === 'UPGRADE_CAPABLE' ? 'text-green-500' : colors.textMuted}`}>
            {subInfo.upgradeCapability === 'UPGRADE_CAPABLE' ? '✓' : '✗'}
          </span>
        </div>
        {overageConfig && (
          <div className="flex justify-between">
            <span className={colors.textMuted}>{t('home.status')}</span>
            <span className={`${overageConfig.overageStatus === 'ENABLED' ? 'text-green-500' : colors.textMuted}`}>
              {overageConfig.overageStatus === 'ENABLED' ? t('home.enabled') : t('home.disabled')}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// 账户信息
function AccountInfo({ currentAccount, userInfo, breakdown, nextDateReset, isLightTheme, colors, t }) {
  return (
    <div className={`${isLightTheme ? 'bg-gray-50' : 'bg-white/5'} rounded-lg p-3`}>
      <div className={`text-[10px] font-medium ${isLightTheme ? 'text-purple-600' : 'text-purple-400'} mb-2 uppercase tracking-wide`}>{t('home.accountInfo')}</div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className={colors.textMuted}>IDP</span>
          <span className={colors.text}>{currentAccount.provider || '-'}</span>
        </div>
        <div className="flex justify-between">
          <span className={colors.textMuted}>{t('home.reset')}</span>
          <span className={colors.text}>{nextDateReset ? new Date(nextDateReset * 1000).toLocaleDateString() : '-'}</span>
        </div>
        {breakdown?.overageRate && (
          <div className="flex justify-between">
            <span className={colors.textMuted}>{t('home.rate')}</span>
            <span className={colors.text}>${breakdown.overageRate}/次</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className={colors.textMuted}>ID</span>
          <span className={`${colors.text} font-mono truncate max-w-[80px]`} title={userInfo?.userId}>{userInfo?.userId?.split('.').pop()?.substring(0, 8) || '-'}</span>
        </div>
      </div>
    </div>
  )
}

// 额度明细
function QuotaBreakdown({ mainUsed, mainLimit, mainPercent, freeTrial, bonuses, isLightTheme, colors, t }) {
  return (
    <div className={`${isLightTheme ? 'bg-gray-50' : 'bg-white/5'} rounded-lg p-3`}>
      <div className={`text-[10px] font-medium ${colors.text} mb-2 uppercase tracking-wide`}>{t('home.quotaDetails')}</div>
      <div className="space-y-2">
        {/* 基础额度 */}
        <QuotaRow label={t('home.base')} used={mainUsed} limit={mainLimit} percent={mainPercent} color="blue" isLightTheme={isLightTheme} colors={colors} />

        {/* 试用额度 */}
        {freeTrial && freeTrial.usageLimit > 0 && (
          <QuotaRow 
            label={t('home.trial')} 
            used={freeTrial.currentUsage ?? 0} 
            limit={freeTrial.usageLimit} 
            percent={freeTrial.usageLimit > 0 ? ((freeTrial.currentUsage ?? 0) / freeTrial.usageLimit * 100) : 0}
            color="purple" 
            expiry={freeTrial.freeTrialExpiry}
            isLightTheme={isLightTheme} 
            colors={colors}
            t={t}
          />
        )}

        {/* 奖励额度 */}
        {bonuses.map((bonus, idx) => (
          <QuotaRow 
            key={idx}
            label={bonus.displayName?.substring(0, 4) || `奖励${idx+1}`} 
            used={Math.round(bonus.currentUsage ?? 0)} 
            limit={Math.round(bonus.usageLimit ?? 0)} 
            percent={bonus.usageLimit > 0 ? ((bonus.currentUsage ?? 0) / bonus.usageLimit * 100) : 0}
            color="amber" 
            expiry={bonus.expiresAt}
            isLightTheme={isLightTheme} 
            colors={colors}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

// 额度行
function QuotaRow({ label, used, limit, percent, color, expiry, isLightTheme, colors, t }) {
  const colorMap = {
    blue: { dot: 'bg-blue-500', bar: 'bg-blue-500', text: colors.textMuted, barBg: isLightTheme ? 'bg-gray-200' : 'bg-white/10' },
    purple: { dot: 'bg-purple-500', bar: 'bg-purple-500', text: 'text-purple-500', barBg: isLightTheme ? 'bg-purple-100' : 'bg-purple-500/20' },
    amber: { dot: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-600', barBg: isLightTheme ? 'bg-amber-100' : 'bg-amber-500/20' }
  }
  const c = colorMap[color] || colorMap.blue
  const expiryStr = expiry ? new Date(expiry * 1000).toLocaleDateString() : null

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${c.dot} shrink-0`} />
      <span className={`text-xs ${c.text} w-14 shrink-0`} title={expiryStr ? `${expiryStr} ${t?.('home.expires') || '到期'}` : ''}>{label}</span>
      <div className={`flex-1 h-1.5 ${c.barBg} rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full ${c.bar} transition-all`} style={{ width: `${percent}%` }} />
      </div>
      <span className={`text-[10px] ${c.text} w-24 text-right shrink-0`}>
        {used}/{limit}{expiryStr ? ` · ${expiryStr}` : ''}
      </span>
    </div>
  )
}

export default AccountQuotaDetail
