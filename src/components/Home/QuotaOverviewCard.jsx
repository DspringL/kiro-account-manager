import { TrendingUp } from 'lucide-react'

// 配额总览卡片
function QuotaOverviewCard({ stats, isLightTheme, colors, t }) {
  return (
    <div className={`card-glow ${colors.card} rounded-2xl shadow-sm border ${colors.cardBorder} p-5 animate-scale-in delay-400`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isLightTheme ? 'bg-emerald-100' : 'bg-emerald-500/20'}`}>
          <TrendingUp size={20} className="text-emerald-500" />
        </div>
        <h2 className={`font-semibold ${colors.text}`}>{t('home.quotaOverview')}</h2>
      </div>
      <div className="flex items-center gap-4 mb-3">
        <div className="flex-1">
          <div className={`h-3 ${isLightTheme ? 'bg-gray-100' : 'bg-white/10'} rounded-full overflow-hidden`}>
            <div 
              className={`h-full rounded-full transition-all duration-1000 ease-out ${
                stats.usagePercent > 80 ? 'bg-gradient-to-r from-red-400 to-red-500' : 
                stats.usagePercent > 50 ? 'bg-gradient-to-r from-yellow-400 to-orange-500' : 
                'bg-gradient-to-r from-green-400 to-emerald-500'
              }`}
              style={{ width: `${stats.usagePercent}%` }}
            />
          </div>
        </div>
        <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${
          stats.usagePercent > 80 
            ? (isLightTheme ? 'bg-red-100 text-red-600' : 'bg-red-500/20 text-red-400') 
            : stats.usagePercent > 50 
              ? (isLightTheme ? 'bg-yellow-100 text-yellow-700' : 'bg-yellow-500/20 text-yellow-400') 
              : (isLightTheme ? 'bg-green-100 text-green-600' : 'bg-green-500/20 text-green-400')
        }`}>
          {stats.usagePercent}%
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className={colors.textMuted}>{t('home.usedTotal')}</span>
        <span className={`font-medium ${colors.text}`}>{stats.totalUsed} / {stats.totalQuota}</span>
      </div>
    </div>
  )
}

export default QuotaOverviewCard
