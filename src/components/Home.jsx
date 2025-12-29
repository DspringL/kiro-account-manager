import { useState } from 'react'
import { Users, Zap, Shield, TrendingUp, Sparkles } from 'lucide-react'
import { useApp } from '../hooks/useApp'
import { useDialog } from '../contexts/DialogContext'
import { useAccount } from '../contexts/AccountContext'
import { usePrivacy } from '../contexts/PrivacyContext'

// 子组件
import LoadingSkeleton from './Home/LoadingSkeleton'
import StatCard from './Home/StatCard'
import CurrentAccountCard from './Home/CurrentAccountCard'
import QuotaOverviewCard from './Home/QuotaOverviewCard'
import AccountQuotaDetail from './Home/AccountQuotaDetail'
import UsageDistribution from './Home/UsageDistribution'
import QuotaPieChart from './Home/QuotaPieChart'
import UsageTrendChart from './Home/UsageTrendChart'

function Home() {
  const { t, theme, colors } = useApp()
  const { showError } = useDialog()
  const { maskEmail } = usePrivacy()
  const { 
    accounts: tokens, 
    localToken, 
    loading, 
    refreshing, 
    stats, 
    currentAccount,
    currentQuotaInfo,
    refresh,
    refreshAccount 
  } = useAccount()
  const [refreshingAccount, setRefreshingAccount] = useState(false)

  const handleRefresh = () => refresh()

  // 刷新当前账号的 token 和 usage
  const handleRefreshCurrentAccount = async () => {
    if (!currentAccount || refreshingAccount) return
    setRefreshingAccount(true)
    try {
      await refreshAccount(currentAccount.id)
    } catch (e) {
      console.error('Refresh account failed:', e)
      showError(t('common.refreshFailed'), String(e))
    } finally {
      setRefreshingAccount(false)
    }
  }

  const isLightTheme = theme === 'light'

  if (loading) {
    return <LoadingSkeleton colors={colors} />
  }

  const statCards = [
    { icon: Users, iconBg: isLightTheme ? 'bg-blue-100 text-blue-600' : 'bg-blue-500/20 text-blue-400', value: stats.total, label: t('home.totalAccounts'), delay: 'delay-100' },
    { icon: Shield, iconBg: isLightTheme ? 'bg-green-100 text-green-600' : 'bg-green-500/20 text-green-400', value: `${stats.active}/${stats.banned}`, label: t('home.activeVsBanned'), delay: 'delay-200' },
    { icon: Zap, iconBg: isLightTheme ? 'bg-purple-100 text-purple-600' : 'bg-purple-500/20 text-purple-400', value: stats.proPlus + stats.pro, label: t('home.proAccounts'), delay: 'delay-300' },
    { icon: TrendingUp, iconBg: isLightTheme ? 'bg-orange-100 text-orange-600' : 'bg-orange-500/20 text-orange-400', value: `${stats.usagePercent}%`, label: t('home.usagePercent'), delay: 'delay-400' },
  ]

  return (
    <div className={`h-full overflow-auto ${colors.main}`}>
      {/* 背景装饰光晕 */}
      <div className="bg-glow bg-glow-1" />
      <div className="bg-glow bg-glow-2" />
      
      <div className="max-w-5xl mx-auto p-8 relative">
        {/* Header */}
        <div className="mb-8 animate-bounce-in">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25 animate-float">
              <Sparkles size={24} className="text-white" />
            </div>
            <h1 className={`text-2xl font-bold ${colors.text}`}>{t('home.title')}</h1>
          </div>
          <p className={colors.textMuted}>{t('home.subtitle')}</p>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {statCards.map((card, index) => (
            <StatCard key={index} {...card} isLightTheme={isLightTheme} />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* 当前账号 */}
          <CurrentAccountCard 
            localToken={localToken}
            refreshing={refreshing}
            handleRefresh={handleRefresh}
            isLightTheme={isLightTheme}
            colors={colors}
            t={t}
          />

          {/* 配额总览 */}
          <QuotaOverviewCard 
            stats={stats}
            isLightTheme={isLightTheme}
            colors={colors}
            t={t}
          />
        </div>

        {/* 当前账号配额详情 */}
        {localToken && currentAccount && (
          <AccountQuotaDetail 
            currentAccount={currentAccount}
            currentQuotaInfo={currentQuotaInfo}
            refreshingAccount={refreshingAccount}
            handleRefreshCurrentAccount={handleRefreshCurrentAccount}
            maskEmail={maskEmail}
            isLightTheme={isLightTheme}
            colors={colors}
            t={t}
          />
        )}

        {/* 使用率分布统计 */}
        {tokens.length > 0 && (
          <UsageDistribution 
            tokens={tokens}
            isLightTheme={isLightTheme}
            colors={colors}
            t={t}
          />
        )}

        {/* 配额分布饼图 + 使用量趋势图 */}
        {tokens.length > 0 && (
          <div className="grid grid-cols-2 gap-6 mt-6">
            <QuotaPieChart accounts={tokens} />
            <UsageTrendChart accounts={tokens} stats={stats} />
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
