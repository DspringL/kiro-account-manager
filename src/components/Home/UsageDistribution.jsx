import { PieChart, BarChart2 } from 'lucide-react'
import { usePrivacy } from '../../contexts/PrivacyContext'

// 使用率分布统计
function UsageDistribution({ tokens, isDark, colors, t }) {
  const { maskEmail } = usePrivacy()
  
  // 计算使用率分组
  const getUsagePercent = (account) => {
    const breakdown = account.usageData?.usageBreakdownList?.[0] || account.usageData?.usageBreakdown
    const used = breakdown?.currentUsage ?? 0
    const limit = breakdown?.usageLimit ?? 50
    return limit > 0 ? (used / limit) * 100 : 0
  }
  
  const usageGroups = {
    low: tokens.filter(a => getUsagePercent(a) < 30).length,
    medium: tokens.filter(a => { const p = getUsagePercent(a); return p >= 30 && p < 70 }).length,
    high: tokens.filter(a => getUsagePercent(a) >= 70).length
  }
  
  // 账号配额排行（前5）
  const topAccounts = [...tokens]
    .map(a => {
      const breakdown = a.usageData?.usageBreakdownList?.[0] || a.usageData?.usageBreakdown
      const used = breakdown?.currentUsage ?? 0
      const limit = breakdown?.usageLimit ?? 50
      return { email: a.email, used, limit, percent: limit > 0 ? Math.round((used / limit) * 100) : 0 }
    })
    .sort((a, b) => b.limit - a.limit)
    .slice(0, 5)

  return (
    <div className="grid grid-cols-2 gap-6 mt-6">
      {/* 使用率分布 */}
      <div className={`card-glow ${colors.card} rounded-2xl shadow-sm border ${colors.cardBorder} p-5 animate-scale-in`}>
        <div className="flex items-center gap-2 mb-4">
          <PieChart size={18} className="text-blue-500" />
          <h3 className={`font-semibold ${colors.text}`}>{t('stats.usageDistribution')}</h3>
        </div>
        <div className="space-y-3">
          {[
            { label: t('stats.lowUsage'), value: usageGroups.low, color: 'bg-green-500', desc: '< 30%' },
            { label: t('stats.mediumUsage'), value: usageGroups.medium, color: 'bg-yellow-500', desc: '30-70%' },
            { label: t('stats.highUsage'), value: usageGroups.high, color: 'bg-red-500', desc: '> 70%' }
          ].map((item, i) => {
            const percent = tokens.length > 0 ? (item.value / tokens.length * 100) : 0
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm ${colors.text}`}>{item.label} <span className={colors.textMuted}>({item.desc})</span></span>
                  <span className={`text-sm font-medium ${colors.text}`}>{item.value} {t('stats.accounts')}</span>
                </div>
                <div className={`h-3 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'} overflow-hidden`}>
                  <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${percent}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 账号配额排行 */}
      <div className={`card-glow ${colors.card} rounded-2xl shadow-sm border ${colors.cardBorder} p-5 animate-scale-in`}>
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 size={18} className="text-indigo-500" />
          <h3 className={`font-semibold ${colors.text}`}>{t('stats.accountUsage')}</h3>
        </div>
        <div className="space-y-2.5">
          {topAccounts.map((account, i) => {
            const usageColor = account.percent < 30 ? 'from-green-400 to-green-500'
              : account.percent < 70 ? 'from-yellow-400 to-yellow-500'
              : 'from-red-400 to-red-500'
            return (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs ${colors.text} truncate max-w-[140px]`}>{maskEmail(account.email).split('@')[0]}</span>
                  <span className={`text-xs ${colors.textMuted}`}>{account.used}/{account.limit} ({account.percent}%)</span>
                </div>
                <div className={`h-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'} overflow-hidden`}>
                  <div className={`h-full bg-gradient-to-r ${usageColor} rounded-full transition-all duration-500`} style={{ width: `${account.percent}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default UsageDistribution
